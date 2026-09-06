// Cria uma sessão de assinatura recorrente no Stripe Checkout e devolve o
// link de pagamento seguro hospedado pelo próprio Stripe. O app nunca vê
// nem processa dados de cartão.
//
// Variável de ambiente necessária no Cloudflare Pages:
//   STRIPE_SECRET_KEY  (Dashboard do Stripe > Developers > API keys)

import { verifyFirebaseIdToken } from './_googleAuth';

interface Env {
  STRIPE_SECRET_KEY?: string;
  FIREBASE_PROJECT_ID?: string;
}

const PLAN_PRICES: Record<string, number> = {
  '1 Fazenda': 29.9,
  '3 Fazendas': 49.9,
  '5 Fazendas': 79.9,
};

function toFormBody(obj: Record<string, any>, prefix = ''): string[] {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      parts.push(...toFormBody(value, fullKey));
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v === 'object') parts.push(...toFormBody(v, `${fullKey}[${i}]`));
        else parts.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(String(v))}`);
      });
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    if (!env.STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'Pagamento via Stripe ainda não configurado — falta a variável STRIPE_SECRET_KEY no Cloudflare Pages.' }),
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

    const value = plan === 'Agro Total' ? customPrice : PLAN_PRICES[plan];
    if (!value || value <= 0) {
      return new Response(JSON.stringify({ error: 'Valor do plano inválido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const origin = appUrl ? appUrl.replace(/\/$/, '') : '';

    const body = toFormBody({
      mode: 'subscription',
      success_url: `${origin}/?checkout=sucesso`,
      cancel_url: `${origin}/?checkout=cancelado`,
      customer_email: email,
      client_reference_id: uid,
      metadata: { uid },
      subscription_data: { metadata: { uid } },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'brl',
            unit_amount: Math.round(value * 100),
            recurring: { interval: 'month' },
            product_data: { name: `Agro Gestão — Plano ${plan}` },
          },
        },
      ],
    });

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.join('&'),
    });

    const data = (await res.json()) as any;

    if (!res.ok) {
      console.error('Stripe checkout session error:', data);
      return new Response(JSON.stringify({ error: data.error?.message || 'Falha ao criar sessão de pagamento no Stripe.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ checkoutUrl: data.url, sessionId: data.id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('create-subscription-stripe error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao criar assinatura: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
