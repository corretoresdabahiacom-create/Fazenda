// Recebe os avisos do PayPal sobre assinaturas e pagamentos.
//
// Configuração no PayPal Developer Dashboard: Apps & Credentials > sua
// app > Add Webhook > URL = https://SEU-DOMINIO/api/paypal-webhook
// Eventos: BILLING.SUBSCRIPTION.ACTIVATED, PAYMENT.SALE.COMPLETED,
// BILLING.SUBSCRIPTION.CANCELLED, PAYMENT.SALE.REFUSED
//
// Variáveis de ambiente (mesmas do create-subscription-paypal, mais):
//   PAYPAL_WEBHOOK_ID (mostrado ao criar o webhook no painel)

import { firestoreMergeDoc, GoogleServiceAccountEnv } from './_googleAuth';

interface Env extends GoogleServiceAccountEnv {
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_API_BASE?: string;
  PAYPAL_WEBHOOK_ID?: string;
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const rawBody = await request.text();
    const event = JSON.parse(rawBody);
    const apiBase = env.PAYPAL_API_BASE || 'https://api-m.paypal.com';

    // Validação de autenticidade usando o próprio endpoint do PayPal — mais
    // simples e confiável do que reimplementar a verificação RSA manualmente.
    // Obrigatória: sem as credenciais configuradas, a notificação é recusada.
    if (!env.PAYPAL_WEBHOOK_ID || !env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
      console.warn('Credenciais de webhook do PayPal não configuradas — notificação recusada por segurança.');
      return new Response('ok', { status: 200 });
    }
    const accessToken = await getPaypalAccessToken(env, apiBase);
    const verifyRes = await fetch(`${apiBase}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: request.headers.get('paypal-auth-algo'),
        cert_url: request.headers.get('paypal-cert-url'),
        transmission_id: request.headers.get('paypal-transmission-id'),
        transmission_sig: request.headers.get('paypal-transmission-sig'),
        transmission_time: request.headers.get('paypal-transmission-time'),
        webhook_id: env.PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      }),
    });
    const verifyData = (await verifyRes.json()) as { verification_status?: string };
    if (verifyData.verification_status !== 'SUCCESS') {
      console.warn('Assinatura de webhook do PayPal inválida — notificação ignorada.');
      return new Response('ok', { status: 200 });
    }

    const resource = event.resource;

    if (event.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const uid = resource.custom_id;
      if (uid) {
        await firestoreMergeDoc(env, 'subscriptions', uid, {
          status: 'Ativa',
          gateway: 'paypal',
          externalSubscriptionId: resource.id,
        });
      }
    }

    if (event.event_type === 'PAYMENT.SALE.COMPLETED') {
      const uid = resource.custom || resource.custom_id;
      if (uid) {
        await firestoreMergeDoc(env, 'subscriptions', uid, {
          status: 'Ativa',
          gateway: 'paypal',
          lastPaymentDate: resource.create_time,
          lastPaymentValue: resource.amount?.total ? Number(resource.amount.total) : undefined,
        });
      }
    }

    if (event.event_type === 'PAYMENT.SALE.REFUSED') {
      const uid = resource.custom || resource.custom_id;
      if (uid) {
        await firestoreMergeDoc(env, 'subscriptions', uid, { status: 'Atrasada', gateway: 'paypal' });
      }
    }

    if (event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED') {
      const uid = resource.custom_id;
      if (uid) {
        await firestoreMergeDoc(env, 'subscriptions', uid, { status: 'Cancelada', gateway: 'paypal' });
      }
    }

    return new Response('ok', { status: 200 });
  } catch (error: any) {
    console.error('paypal-webhook error:', error);
    return new Response('ok', { status: 200 });
  }
};
