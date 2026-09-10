// FASE 4/5: endpoint interno unificado — GET /api/quotes
//
// Chama as fontes ativas relevantes pro produto pedido, normaliza cada
// resposta pro formato MarketQuote (ver _marketQuote.ts), e devolve tudo
// junto. Isso é o que a seção 32 do documento original pede:
//   GET /quotes
//   GET /quotes?state=BA
//   GET /quotes?product=boi_gordo
//   GET /quotes?state=BA&product=boi_gordo
//
// Nenhuma fonte aqui é inventada — todas já existem e já foram testadas
// nas outras funções deste projeto; este endpoint só orquestra e
// normaliza, não adiciona nenhum dado novo.

import {
  MarketQuote,
  normalizeNoticiasAgricolas, normalizeIeaSp, normalizeIncaperEs,
  normalizeEpagriSc, normalizeAiba, normalizeTradingEconomics,
} from './_marketQuote';

const PRODUCT_LABELS: Record<string, string> = {
  boi_gordo: 'Boi Gordo', vaca: 'Vaca', novilho: 'Novilho/Garrote', novilha: 'Novilha',
  cafe: 'Café', algodao: 'Algodão', soja: 'Soja', milho: 'Milho', trigo: 'Trigo',
  laranja: 'Laranja', acucar: 'Açúcar', suinos: 'Suínos', frango: 'Frango', leite: 'Leite',
  arroz: 'Arroz', feijao: 'Feijão', cacau: 'Cacau', amendoim: 'Amendoim', sorgo: 'Sorgo',
  ovos: 'Ovos', mandioca: 'Mandioca', frutas: 'Frutas',
};

const STATE_TO_ADAPTERS: Record<string, string[]> = {
  'São Paulo': ['iea-sp'],
  'Espírito Santo': ['incaper-es'],
  'Santa Catarina': ['epagri-sc'],
  'Bahia': ['aiba-ba'],
};

async function fetchJson(origin: string, path: string): Promise<any | null> {
  try {
    const res = await fetch(`${origin}${path}`);
    if (!res.ok) return null;
    const json: any = await res.json();
    return json?.error ? null : json;
  } catch {
    return null;
  }
}

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const origin = url.origin;
    const produto = url.searchParams.get('product') || url.searchParams.get('produto') || 'boi_gordo';
    const state = url.searchParams.get('state') || url.searchParams.get('estado') || '';
    const productLabel = PRODUCT_LABELS[produto] || produto;

    const backendKey = ['vaca', 'novilho', 'novilha'].includes(produto) ? 'boi_gordo'
      : ['cafe_arabica', 'cafe_conilon'].includes(produto) ? 'cafe'
      : produto;

    const fetches: Promise<any>[] = [fetchJson(origin, `/api/cotacoes?produto=${backendKey}`)];

    // Só chama os adapters oficiais relevantes pro estado pedido (ou
    // todos, se nenhum estado foi especificado) — evita chamadas
    // desnecessárias a fontes que nem se aplicam.
    const relevantAdapters = state && STATE_TO_ADAPTERS[state] ? STATE_TO_ADAPTERS[state]
      : Object.values(STATE_TO_ADAPTERS).flat();
    for (const adapter of relevantAdapters) {
      fetches.push(fetchJson(origin, `/api/${adapter}`));
    }
    if (backendKey === 'boi_gordo') {
      fetches.push(fetchJson(origin, '/api/tradingeconomics?produto=boi_gordo'));
    }

    const [naData, ...rest] = await Promise.all(fetches);

    let quotes: MarketQuote[] = [];
    if (naData) quotes = quotes.concat(normalizeNoticiasAgricolas(naData, produto, productLabel));

    let restIdx = 0;
    for (const adapter of relevantAdapters) {
      const adapterData = rest[restIdx++];
      if (!adapterData) continue;
      if (adapter === 'iea-sp') quotes = quotes.concat(normalizeIeaSp(adapterData, produto, productLabel));
      if (adapter === 'incaper-es') quotes = quotes.concat(normalizeIncaperEs(adapterData, produto, productLabel));
      if (adapter === 'epagri-sc') quotes = quotes.concat(normalizeEpagriSc(adapterData, produto, productLabel));
      if (adapter === 'aiba-ba') quotes = quotes.concat(normalizeAiba(adapterData, produto, productLabel));
    }
    if (backendKey === 'boi_gordo') {
      const teData = rest[restIdx++];
      if (teData) quotes = quotes.concat(normalizeTradingEconomics(teData, produto, productLabel));
    }

    // Filtra por estado, se pedido (mantém as internacionais/nacionais
    // sem estado, já que elas servem de referência independente da
    // região escolhida).
    if (state) {
      quotes = quotes.filter(q => !q.state || q.state === state);
    }

    // Nunca deixa um preço null se disfarçar de zero — remove
    // completamente da lista quotes sem preço disponível, e informa
    // quantas foram descartadas por esse motivo (transparência).
    const semPreco = quotes.filter(q => !q.isAvailable).length;
    quotes = quotes.filter(q => q.isAvailable);

    return new Response(JSON.stringify({
      product: produto,
      state: state || null,
      quotes,
      totalEncontradas: quotes.length,
      semCotacaoDisponivel: semPreco,
      geradoEm: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    });
  } catch (error: any) {
    console.error('quotes error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao consolidar cotações: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
