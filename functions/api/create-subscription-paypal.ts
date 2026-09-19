// Cria uma assinatura recorrente no PayPal e devolve o link de aprovação
// seguro hospedado pelo próprio PayPal. O app nunca vê dados de
// pagamento do usuário.
//
// O PayPal exige um "Produto" e um "Plano" cadastrados antes de criar
// qualquer assinatura — como isso só precisa existir uma vez por plano
// (não por cliente), criamos e guardamos o ID desses objetos no Firestore
// na primeira vez que alguém assina cada plano, reaproveitando depois.
//
// Variáveis de ambiente no Cloudflare Pages:
//   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET (developer.paypal.com > Apps & Credentials)
//   PAYPAL_API_BASE (opcional — "https://api-m.sandbox.paypal.com" para testes;
//   padrão é produção: "https://api-m.paypal.com")

import { firestoreGetDoc, firestoreMergeDoc, verifyFirebaseIdToken, GoogleServiceAccountEnv } from './_googleAuth';
import { resolverPrecoDoPlano } from './_planPrice';

interface Env extends GoogleServiceAccountEnv {
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_API_BASE?: string;
}

async function getPaypalAccessToken(env: Env, apiBase: string): Promise<string> {
  const credentials = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Falha ao autenticar no PayPal: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function getOrCreatePlanId(env: Env, apiBase: string, accessToken: string, plan: string, value: number): Promise<string> {
  // O plano do PayPal tem preço fixo. No Agro Total cada cliente tem um
  // valor negociado, então a chave do cache inclui o valor — antes todos
  // os clientes Agro Total reaproveitavam o plano (e o preço) do primeiro.
  const base = plan.replace(/\s+/g, '_').toLowerCase();
  const cacheKey = plan === 'Agro Total' ? `${base}_${value.toFixed(2).replace('.', '_')}` : base;
  const cached = await firestoreGetDoc(env, 'paymentConfigPaypal', cacheKey);
  if (cached?.planId) return cached.planId;

  // 1. Cria o Produto (uma vez por plano)
  const productRes = await fetch(`${apiBase}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `product-${cacheKey}`,
    },
    body: JSON.stringify({
      name: `Agro Gestão — Plano ${plan}`,
      type: 'SERVICE',
      category: 'SOFTWARE',
    }),
  });
  const product = (await productRes.json()) as any;
  if (!productRes.ok && productRes.status !== 422) {
    throw new Error(`Falha ao criar produto no PayPal: ${JSON.stringify(product)}`);
  }
  const productId = product.id || cached?.productId;

  // 2. Cria o Plano de assinatura recorrente vinculado ao produto
  const planRes = await fetch(`${apiBase}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `plan-${cacheKey}`,
    },
    body: JSON.stringify({
      product_id: productId,
      name: `Assinatura Mensal — ${plan}`,
      billing_cycles: [
        {
          frequency: { interval_unit: 'DAY', interval_count: 7 },
          tenure_type: 'TRIAL',
          sequence: 1,
          total_cycles: 1,
          pricing_scheme: { fixed_price: { value: '0', currency_code: 'BRL' } },
        },
        {
          frequency: { interval_unit: 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 2,
          total_cycles: 0, // 0 = recorrência indefinida
          pricing_scheme: { fixed_price: { value: value.toFixed(2), currency_code: 'BRL' } },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 2,
      },
    }),
  });
  const planData = (await planRes.json()) as any;
  if (!planRes.ok) {
    throw new Error(`Falha ao criar plano no PayPal: ${JSON.stringify(planData)}`);
  }

  await firestoreMergeDoc(env, 'paymentConfigPaypal', cacheKey, { productId, planId: planData.id });
  return planData.id;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Pagamento via PayPal ainda não configurado — faltam PAYPAL_CLIENT_ID e PAYPAL_CLIENT_SECRET no Cloudflare Pages.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { uid, email, plan, customPrice, appUrl } = (await request.json()) as {
      uid?: string;
      email?: string;
      plan?: string;
      customPrice?: number;
      appUrl?: string;
    };

    if (!uid || !email || !plan) {
      return new Response(JSON.stringify({ error: 'Faltam dados (uid, email ou plano).' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const authHeader = request.headers.get('Authorization') || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    const verified = env.FIREBASE_PROJECT_ID ? await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID) : null;
    if (!verified || verified.uid !== uid) {
      return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Valor sempre decidido no servidor — customPrice do cliente é ignorado.
    void customPrice;
    const preco = await resolverPrecoDoPlano(env, uid, plan);
    if ('error' in preco) {
      return new Response(JSON.stringify({ error: preco.error }), {
        status: preco.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const value = preco.value;

    const apiBase = env.PAYPAL_API_BASE || 'https://api-m.paypal.com';
    const accessToken = await getPaypalAccessToken(env, apiBase);
    const planId = await getOrCreatePlanId(env, apiBase, accessToken, plan, value);

    const origin = appUrl ? appUrl.replace(/\/$/, '') : '';

    const subRes = await fetch(`${apiBase}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `sub-${uid}-${Date.now()}`,
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: uid,
        subscriber: { email_address: email },
        application_context: {
          brand_name: 'Agro Gestão',
          return_url: `${origin}/?checkout=sucesso`,
          cancel_url: `${origin}/?checkout=cancelado`,
        },
      }),
    });

    const subData = (await subRes.json()) as any;
    if (!subRes.ok) {
      console.error('PayPal subscription error:', subData);
      return new Response(JSON.stringify({ error: subData.message || 'Falha ao criar assinatura no PayPal.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const approvalLink = (subData.links || []).find((l: any) => l.rel === 'approve')?.href;

    return new Response(JSON.stringify({ approvalLink, subscriptionId: subData.id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('create-subscription-paypal error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao criar assinatura: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
