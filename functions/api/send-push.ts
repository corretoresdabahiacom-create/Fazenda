// Envia notificações push de verdade via Firebase Cloud Messaging (API
// HTTP v1), usada pelo Painel Admin ao enviar notificações e (no futuro)
// por lembretes automáticos de vencimento.
//
// Precisa de 3 variáveis de ambiente no Cloudflare Pages (Settings >
// Environment variables), vindas de um Service Account do Firebase
// (Configurações do projeto > Contas de serviço > Gerar nova chave
// privada — gera um arquivo .json com esses 3 valores):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY  (colar com as quebras de linha como \n literal)

interface Env {
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

async function getAccessToken(env: Env): Promise<string> {
  const clientEmail = env.FIREBASE_CLIENT_EMAIL!;
  const privateKeyPem = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({
          error:
            'Envio de push não configurado ainda — faltam as variáveis FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no Cloudflare Pages.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { tokens, title, body, data } = (await request.json()) as {
      tokens?: string[];
      title?: string;
      body?: string;
      data?: Record<string, string>;
    };

    if (!tokens || tokens.length === 0 || !title) {
      return new Response(JSON.stringify({ error: 'Faltam tokens de dispositivo ou título.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getAccessToken(env);
    const results: { token: string; ok: boolean; error?: string }[] = [];

    for (const token of tokens) {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body: body || '' },
              data: data || {},
              webpush: { fcm_options: { link: '/' } },
            },
          }),
        },
      );
      if (res.ok) {
        results.push({ token, ok: true });
      } else {
        const errText = await res.text();
        results.push({ token, ok: false, error: errText });
      }
    }

    return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('send-push error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao enviar push: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
