// Recebe os avisos do Mercado Pago quando uma assinatura é criada, um
// pagamento é aprovado/recusado, ou uma assinatura é cancelada — e
// atualiza o status real da assinatura no Firestore.
//
// Configuração necessária no painel do Mercado Pago (Suas integrações >
// Webhooks > Configurar notificações): URL = https://SEU-DOMINIO/api/mercadopago-webhook
// Eventos: "Assinaturas" (subscription_preapproval) e "Pagamentos" (payment)
//
// Variáveis de ambiente no Cloudflare Pages:
//   MERCADOPAGO_ACCESS_TOKEN   (mesma do create-subscription)
//   MERCADOPAGO_WEBHOOK_SECRET (gerada ao configurar o webhook no painel)
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (mesmas do push)

import { firestoreMergeDoc, GoogleServiceAccountEnv } from './_googleAuth';

interface Env extends GoogleServiceAccountEnv {
  MERCADOPAGO_ACCESS_TOKEN?: string;
  MERCADOPAGO_WEBHOOK_SECRET?: string;
}

async function verifyMpSignature(
  xSignature: string,
  xRequestId: string | null,
  dataId: string | null,
  secret: string,
): Promise<boolean> {
  let ts: string | null = null;
  let v1: string | null = null;
  for (const part of xSignature.split(',')) {
    const [k, v] = part.trim().split('=');
    if (k === 'ts') ts = v;
    else if (k === 'v1') v1 = v;
  }
  if (!ts || !v1) return false;

  const parts: string[] = [];
  if (dataId) parts.push(`id:${dataId.toLowerCase()}`);
  if (xRequestId) parts.push(`request-id:${xRequestId}`);
  parts.push(`ts:${ts}`);
  const manifest = parts.join(';') + ';';

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest));
  const hex = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === v1;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const bodyText = await request.text();
    const body = bodyText ? JSON.parse(bodyText) : {};

    const dataId = body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
    const type = body?.type || url.searchParams.get('type') || url.searchParams.get('topic');

    // Validação de autenticidade — se a chave secreta estiver configurada,
    // qualquer notificação sem assinatura válida é descartada.
    if (env.MERCADOPAGO_WEBHOOK_SECRET) {
      const xSignature = request.headers.get('x-signature');
      const xRequestId = request.headers.get('x-request-id');
      const valid = xSignature ? await verifyMpSignature(xSignature, xRequestId, dataId, env.MERCADOPAGO_WEBHOOK_SECRET) : false;
      if (!valid) {
        console.warn('Assinatura de webhook do Mercado Pago inválida — notificação ignorada.');
        return new Response('ok', { status: 200 }); // 200 para o MP não ficar retentando um payload malicioso
      }
    }

    if (!dataId || !type) {
      return new Response('ok', { status: 200 });
    }

    if (!env.MERCADOPAGO_ACCESS_TOKEN) {
      console.warn('MERCADOPAGO_ACCESS_TOKEN não configurado — não é possível consultar detalhes do evento.');
      return new Response('ok', { status: 200 });
    }

    if (type === 'subscription_preapproval' || type === 'preapproval') {
      const res = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
        headers: { Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}` },
      });
      const preapproval = (await res.json()) as any;
      const uid = preapproval.external_reference;
      if (uid) {
        const statusMap: Record<string, string> = {
          authorized: 'Ativa',
          paused: 'Suspensa',
          cancelled: 'Cancelada',
          pending: 'Teste',
        };
        await firestoreMergeDoc(env, 'subscriptions', uid, {
          status: statusMap[preapproval.status] || 'Teste',
          gateway: 'mercadopago',
          externalSubscriptionId: preapproval.id,
          currentPeriodStart: preapproval.auto_recurring?.start_date,
          currentPeriodEnd: preapproval.auto_recurring?.end_date,
        });
      }
    }

    if (type === 'payment') {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}` },
      });
      const payment = (await res.json()) as any;
      const uid = payment.external_reference;
      if (uid) {
        const isApproved = payment.status === 'approved';
        await firestoreMergeDoc(env, 'subscriptions', uid, {
          status: isApproved ? 'Ativa' : 'Atrasada',
          gateway: 'mercadopago',
          lastPaymentDate: payment.date_approved || payment.date_created,
          lastPaymentValue: payment.transaction_amount,
        });
      }
    }

    return new Response('ok', { status: 200 });
  } catch (error: any) {
    console.error('mercadopago-webhook error:', error);
    // Mesmo em erro, responde 200 para o Mercado Pago não ficar retentando
    // indefinidamente um payload que sempre vai falhar da mesma forma —
    // o erro já foi registrado no log para investigação manual.
    return new Response('ok', { status: 200 });
  }
};
