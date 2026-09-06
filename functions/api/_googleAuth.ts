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
