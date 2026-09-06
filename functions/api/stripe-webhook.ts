// Recebe os avisos do Stripe quando uma assinatura é criada, um
// pagamento é confirmado, ou uma assinatura é cancelada.
//
// Configuração no Dashboard do Stripe: Developers > Webhooks > Add
// endpoint > URL = https://SEU-DOMINIO/api/stripe-webhook
// Eventos: checkout.session.completed, invoice.paid, invoice.payment_failed,
// customer.subscription.deleted
//
// Variáveis de ambiente no Cloudflare Pages:
//   STRIPE_SECRET_KEY (mesma do create-subscription-stripe)
//   STRIPE_WEBHOOK_SECRET (gerado ao criar o endpoint no Dashboard, começa com whsec_)
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import { firestoreMergeDoc, GoogleServiceAccountEnv } from './_googleAuth';

interface Env extends GoogleServiceAccountEnv {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = header.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const computed = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const computedHex = Array.from(new Uint8Array(computed)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return computedHex === signature;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const rawBody = await request.text();
    const sigHeader = request.headers.get('stripe-signature');

    if (!env.STRIPE_WEBHOOK_SECRET) {
      console.warn('STRIPE_WEBHOOK_SECRET não configurado — notificação recusada por segurança.');
      return new Response('ok', { status: 200 });
    }
    const valid = sigHeader ? await verifyStripeSignature(rawBody, sigHeader, env.STRIPE_WEBHOOK_SECRET) : false;
    if (!valid) {
      console.warn('Assinatura de webhook do Stripe inválida — notificação ignorada.');
      return new Response('ok', { status: 200 });
    }

    const event = JSON.parse(rawBody);
    const obj = event.data?.object;

    if (event.type === 'checkout.session.completed') {
      const uid = obj.client_reference_id || obj.metadata?.uid;
      if (uid) {
        await firestoreMergeDoc(env, 'subscriptions', uid, {
          status: 'Ativa',
          gateway: 'stripe',
          externalSubscriptionId: obj.subscription,
          externalCustomerId: obj.customer,
        });
      }
    }

    if (event.type === 'invoice.paid') {
      const uid = obj.subscription_details?.metadata?.uid;
      if (uid) {
        await firestoreMergeDoc(env, 'subscriptions', uid, {
          status: 'Ativa',
          gateway: 'stripe',
          lastPaymentDate: new Date(obj.status_transitions?.paid_at ? obj.status_transitions.paid_at * 1000 : Date.now()).toISOString(),
          lastPaymentValue: obj.amount_paid ? obj.amount_paid / 100 : undefined,
          currentPeriodEnd: obj.lines?.data?.[0]?.period?.end
            ? new Date(obj.lines.data[0].period.end * 1000).toISOString()
            : undefined,
        });
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const uid = obj.subscription_details?.metadata?.uid;
      if (uid) {
        await firestoreMergeDoc(env, 'subscriptions', uid, { status: 'Atrasada', gateway: 'stripe' });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const uid = obj.metadata?.uid;
      if (uid) {
        await firestoreMergeDoc(env, 'subscriptions', uid, { status: 'Cancelada', gateway: 'stripe' });
      }
    }

    return new Response('ok', { status: 200 });
  } catch (error: any) {
    console.error('stripe-webhook error:', error);
    return new Response('ok', { status: 200 });
  }
};
