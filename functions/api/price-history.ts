// GET /api/price-history?product=boi_gordo&state=Bahia
//
// Lê o histórico gravado pelo /api/quotes (limitado a 1 ponto por hora,
// no máximo 200 pontos guardados). Corresponde ao "GET /quotes/history"
// pedido na seção 32 do documento original — nome de arquivo diferente
// porque o roteamento de Cloudflare Pages Functions usa o caminho do
// arquivo como rota, e /quotes/history exigiria uma subpasta; optamos
// por um endpoint separado e explícito em vez disso.

import { firestoreGetDoc, GoogleServiceAccountEnv } from './_googleAuth';

interface Env extends GoogleServiceAccountEnv {}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const produto = url.searchParams.get('product') || url.searchParams.get('produto');
    const state = url.searchParams.get('state') || url.searchParams.get('estado') || '';

    if (!produto) {
      return new Response(JSON.stringify({ error: 'Parâmetro "product" é obrigatório.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!context.env.FIREBASE_PROJECT_ID) {
      return new Response(JSON.stringify({ error: 'Histórico não configurado (variáveis do Firebase ausentes).', pontos: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const docId = `${produto}_${state || 'geral'}`;
    const doc = await firestoreGetDoc(context.env, 'priceHistory', docId);

    return new Response(JSON.stringify({
      product: produto,
      state: state || null,
      pontos: doc?.pontos || [],
      ultimaGravacao: doc?.ultimaGravacao || null,
      aviso: !doc ? 'Ainda não há histórico gravado pra essa combinação — grava automaticamente com o uso, no máximo 1x por hora.' : undefined,
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' },
    });
  } catch (error: any) {
    console.error('price-history error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao ler histórico: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
