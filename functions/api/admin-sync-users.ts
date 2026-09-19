// Sincroniza TODOS os usuários já cadastrados no Firebase Authentication
// para dentro do índice usado pelo Painel Admin (userDirectory +
// subscriptions) — resolve o caso de contas antigas, criadas antes do
// índice existir, que nunca apareciam na lista porque nunca tinham
// logado de novo desde então.
//
// Só o e-mail de bootstrap admin pode chamar este endpoint.

import { getGoogleAccessToken, firestoreMergeDoc, firestoreGetDoc, requireAdmin, GoogleServiceAccountEnv } from './_googleAuth';

interface Env extends GoogleServiceAccountEnv {}


export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: 'Configuração do servidor incompleta.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const auth = await requireAdmin(request, env);
    if (auth instanceof Response) return auth;

    const accessToken = await getGoogleAccessToken(env, 'https://www.googleapis.com/auth/identitytoolkit');

    let nextPageToken: string | undefined;
    let totalSynced = 0;
    let totalSeen = 0;

    do {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:batchGet?maxResults=1000${nextPageToken ? `&nextPageToken=${nextPageToken}` : ''}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!res.ok) {
        const text = await res.text();
        return new Response(JSON.stringify({ error: `Falha ao listar usuários do Firebase Authentication: ${text}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const data = (await res.json()) as { users?: any[]; nextPageToken?: string };
      const accounts = data.users || [];
      totalSeen += accounts.length;

      for (const acc of accounts) {
        const uid = acc.localId;
        if (!uid) continue;

        const lastLoginMs = Number(acc.lastLoginAt) || Number(acc.createdAt) || Date.now();
        const createdMs = Number(acc.createdAt) || Date.now();

        // userDirectory: sempre atualiza (é seguro reescrever), mas
        // preserva createdAt se já existir um valor gravado antes.
        const existingDir = await firestoreGetDoc(env, 'userDirectory', uid).catch(() => null);
        await firestoreMergeDoc(env, 'userDirectory', uid, {
          userId: uid,
          email: acc.email || '',
          displayName: acc.displayName || undefined,
          createdAt: existingDir?.createdAt || new Date(createdMs).toISOString(),
          lastLoginAt: new Date(lastLoginMs).toISOString(),
        });

        // subscriptions: só cria se ainda não existir — nunca sobrescreve
        // um status já definido (ativo, cancelado etc.) de alguém real.
        const existingSub = await firestoreGetDoc(env, 'subscriptions', uid).catch(() => null);
        if (!existingSub) {
          await firestoreMergeDoc(env, 'subscriptions', uid, {
            userId: uid,
            email: acc.email || '',
            plan: 'Agro Total',
            status: 'Teste',
            createdAt: new Date(createdMs).toISOString(),
          });
        }

        totalSynced++;
      }

      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    return new Response(JSON.stringify({ totalSeen, totalSynced }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('admin-sync-users error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao sincronizar usuários: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
