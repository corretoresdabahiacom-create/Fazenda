// Preço de cada plano, decidido SEMPRE no servidor.
//
// ANTES: no plano "Agro Total" o valor vinha do corpo da requisição
// (customPrice) e só era checado como "> 0" — qualquer usuário podia
// abrir um checkout de R$ 0,01 e o webhook marcava a assinatura como
// "Ativa". AGORA: o valor do Agro Total é lido de subscriptions/{uid}
// no Firestore, campo customPrice, que só o admin pode gravar (ver
// firestore.rules). O valor enviado pelo cliente é ignorado.

import { firestoreGetDoc, GoogleServiceAccountEnv } from './_googleAuth';

// Espelho de src/types.ts (PLAN_PRICES).
export const PLAN_PRICES: Record<string, number> = {
  '1 Fazenda': 29.9,
  '3 Fazendas': 49.9,
  '5 Fazendas': 79.9,
};

// Piso de sanidade para um valor negociado — evita um erro de digitação
// do admin (ex: 0.5 em vez de 50) virar checkout de centavos.
export const AGRO_TOTAL_MIN = 10;

export type PrecoResolvido = { value: number } | { error: string; status: number };

export async function resolverPrecoDoPlano(
  env: Partial<GoogleServiceAccountEnv>,
  uid: string,
  plan: string,
): Promise<PrecoResolvido> {
  if (plan !== 'Agro Total') {
    const value = PLAN_PRICES[plan];
    return value ? { value } : { error: 'Plano inválido.', status: 400 };
  }
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    return { error: 'O plano Agro Total precisa das credenciais do Firebase no servidor.', status: 500 };
  }
  const sub = await firestoreGetDoc(env as GoogleServiceAccountEnv, 'subscriptions', uid);
  const value = Number(sub?.customPrice);
  if (!sub || sub.plan !== 'Agro Total' || !Number.isFinite(value) || value < AGRO_TOTAL_MIN) {
    return {
      error: 'O valor do plano Agro Total ainda não foi definido pela nossa equipe. Entre em contato com o suporte.',
      status: 400,
    };
  }
  return { value: Math.round(value * 100) / 100 };
}
