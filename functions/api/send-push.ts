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

import { getGoogleAccessToken, GoogleServiceAccountEnv, requireAdmin } from './_googleAuth';

type Env = GoogleServiceAccountEnv;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    // Só administradores — antes qualquer pessoa podia disparar push
    // usando a conta de serviço do Firebase.
    const auth = await requireAdmin(request, env);
    if (auth instanceof Response) return auth;

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

    const accessToken = await getGoogleAccessToken(env, 'https://www.googleapis.com/auth/firebase.messaging');
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
