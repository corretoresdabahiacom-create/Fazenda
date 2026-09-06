// Cria uma assinatura recorrente no Mercado Pago (API de Assinaturas —
// /preapproval) e devolve o link de checkout seguro hospedado pelo
// próprio Mercado Pago. O app NUNCA vê nem processa dados de cartão — o
// usuário digita tudo na página deles.
//
// Precisa de 1 variável de ambiente no Cloudflare Pages:
//   MERCADOPAGO_ACCESS_TOKEN  (Suas integrações > credenciais de produção
//   ou de teste, em https://www.mercadopago.com.br/developers/panel)

import { verifyFirebaseIdToken } from './_googleAuth';

interface Env {
  MERCADOPAGO_ACCESS_TOKEN?: string;
  FIREBASE_PROJECT_ID?: string;
}

// Preços fixos dos planos — mantidos aqui em espelho de src/types.ts
// (PLAN_PRICES), já que Functions não importam código do frontend.
const PLAN_PRICES: Record<string, number> = {
  '1 Fazenda': 29.9,
  '3 Fazendas': 49.9,
  '5 Fazendas': 79.9,
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    if (!env.MERCADOPAGO_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'Pagamento ainda não configurado — falta a variável MERCADOPAGO_ACCESS_TOKEN no Cloudflare Pages.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { uid, email, plan, customPrice, appUrl } = (await request.json()) as {
      uid?: string;
      email?: string;
      plan?: string;
      customPrice?: number; // usado só no plano "Agro Total"
      appUrl?: string; // origem do app, para montar o back_url de retorno
    };

    if (!uid || !email || !plan) {
      return new Response(JSON.stringify({ error: 'Faltam dados (uid, email ou plano).' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Confirma que quem está chamando é realmente o dono da conta —
    // sem isso, qualquer pessoa poderia criar uma sessão de checkout
    // informando o uid de outra pessoa.
    const authHeader = request.headers.get('Authorization') || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    const verified = env.FIREBASE_PROJECT_ID ? await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID) : null;
    if (!verified || verified.uid !== uid) {
      return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const value = plan === 'Agro Total' ? customPrice : PLAN_PRICES[plan];
    if (!value || value <= 0) {
      return new Response(JSON.stringify({ error: 'Valor do plano inválido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const backUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/` : undefined;

    const res = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: `Agro Gestão — Plano ${plan}`,
        external_reference: uid,
        payer_email: email,
        back_url: backUrl,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: value,
          currency_id: 'BRL',
          free_trial: { frequency: 7, frequency_type: 'days' },
        },
      }),
    });

    const data = (await res.json()) as any;

    if (!res.ok) {
      console.error('Mercado Pago preapproval error:', data);
      return new Response(JSON.stringify({ error: data.message || 'Falha ao criar assinatura no Mercado Pago.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // init_point: link de checkout seguro para redirecionar o usuário —
    // ele conclui o cadastro do cartão diretamente na página do Mercado
    // Pago, nunca no nosso app.
    return new Response(JSON.stringify({ initPoint: data.init_point, preapprovalId: data.id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('create-subscription error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao criar assinatura: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
