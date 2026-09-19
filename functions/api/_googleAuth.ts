import firebaseAppletConfig from '../../firebase-applet-config.json';
import { isAdminEmail } from '../../shared/adminEmails';
// Assina uma credencial de servidor do Google (JWT) e troca por um token
// de acesso — usado tanto para mandar notificação push (Firebase Cloud
// Messaging) quanto para gravar direto no Firestore a partir de uma
// Cloudflare Function (ex: quando o Mercado Pago avisa que um pagamento
// foi aprovado). Precisa das mesmas 3 variáveis de ambiente já usadas
// pelo push: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.

export interface GoogleServiceAccountEnv {
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
}

function base64UrlEncode(input: ArrayBuffer | string): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export async function getGoogleAccessToken(env: GoogleServiceAccountEnv, scope: string): Promise<string> {
  const clientEmail = env.FIREBASE_CLIENT_EMAIL!;
  const privateKeyPem = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claimSet))}`;
  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64UrlEncode(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao obter token de acesso do Google: ${text}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function firestoreGetDoc(
  env: GoogleServiceAccountEnv,
  collection: string,
  docId: string,
): Promise<Record<string, any> | null> {
  const accessToken = await getGoogleAccessToken(env, 'https://www.googleapis.com/auth/datastore');
  const projectId = env.FIREBASE_PROJECT_ID;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${DATABASE_ID}/documents/${collection}/${docId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Falha ao ler do Firestore: ${await res.text()}`);
  const data = (await res.json()) as { fields?: Record<string, any> };
  return data.fields ? fromFirestoreFields(data.fields) : {};
}

function fromFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = fromFirestoreValue(value);
  }
  return result;
}

function fromFirestoreValue(value: any): any {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) return fromFirestoreFields(value.mapValue.fields || {});
  return null;
}

// Escreve (merge) num documento do Firestore usando a REST API, autenticado
// como o Service Account — usado para atualizar assinaturas a partir de
// webhooks de pagamento, sem precisar do SDK completo do Firebase Admin
// (que não roda no runtime do Cloudflare Workers).
export async function firestoreMergeDoc(
  env: GoogleServiceAccountEnv,
  collection: string,
  docId: string,
  fields: Record<string, any>,
): Promise<void> {
  const accessToken = await getGoogleAccessToken(env, 'https://www.googleapis.com/auth/datastore');
  const projectId = env.FIREBASE_PROJECT_ID;

  const firestoreFields: Record<string, any> = {};
  const fieldPaths: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    fieldPaths.push(key);
    firestoreFields[key] = toFirestoreValue(value);
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${DATABASE_ID}/documents/${collection}/${docId}?` +
    fieldPaths.map(p => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join('&');

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: firestoreFields }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao gravar no Firestore: ${text}`);
  }
}

// Mesmo ID de banco usado pelo resto do app (ver src/lib/firebase.ts) —
// este projeto não usa o banco "(default)".
const DATABASE_ID = 'ai-studio-2b3ac47a-8172-426f-a2a5-c848844ff479';

function toFirestoreValue(value: any): any {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) fields[k] = toFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

// Verifica um token de autenticação do Firebase (enviado pelo app no
// header Authorization: Bearer ...), confirmando a assinatura contra as
// chaves públicas do Google (formato JWK, importável direto pelo
// WebCrypto — mais simples e confiável do que fazer parsing manual de
// certificado X.509) e checando issuer/audience/validade. Sem essa
// verificação, qualquer pessoa poderia chamar os endpoints de criação de
// assinatura fingindo ser outro usuário, só informando um uid arbitrário
// no corpo da requisição.
export async function verifyFirebaseIdToken(idToken: string, projectId: string): Promise<{ uid: string; email?: string; email_verified?: boolean } | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = idToken.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    const decodeSegment = (s: string) => JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));
    const header = decodeSegment(headerB64);
    const payload = decodeSegment(payloadB64);

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < now) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (payload.aud !== projectId) return null;
    if (!payload.sub) return null;

    const jwksRes = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    const jwks = (await jwksRes.json()) as { keys: JsonWebKey[] };
    const jwk = jwks.keys.find((k: any) => k.kid === header.kid);
    if (!jwk) return null;

    const publicKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, signedData);
    if (!valid) return null;

    return { uid: payload.sub, email: payload.email, email_verified: payload.email_verified === true };
  } catch {
    return null;
  }
}


// ---------------------------------------------------------------------------
// Guardas de autenticação reutilizáveis pelos endpoints.
// ---------------------------------------------------------------------------


export type VerifiedUser = { uid: string; email?: string; email_verified?: boolean };

const jsonError = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Exige um ID token válido do Firebase no header Authorization.
 * Devolve o usuário verificado, ou uma Response 401 pronta para retornar.
 * O projectId não é segredo: se a variável FIREBASE_PROJECT_ID não estiver
 * configurada, usa o do firebase-applet-config.json (o mesmo do app).
 */
export async function requireUser(
  request: Request,
  env: { FIREBASE_PROJECT_ID?: string },
): Promise<VerifiedUser | Response> {
  const projectId = env.FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId;
  const idToken = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!idToken) return jsonError(401, 'Faça login para usar este recurso.');
  const verified = await verifyFirebaseIdToken(idToken, projectId);
  if (!verified) return jsonError(401, 'Sessão inválida ou expirada. Entre novamente.');
  return verified;
}

/** Igual a requireUser, mas só deixa passar administradores do sistema. */
export async function requireAdmin(
  request: Request,
  env: { FIREBASE_PROJECT_ID?: string },
): Promise<VerifiedUser | Response> {
  const result = await requireUser(request, env);
  if (result instanceof Response) return result;
  if (!isAdminEmail(result.email, result.email_verified)) return jsonError(403, 'Não autorizado.');
  return result;
}
