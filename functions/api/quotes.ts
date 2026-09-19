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
  normalizeEpagriSc, normalizeAiba, normalizeTradingEconomics, normalizeBoiMundo,
  unidadeCanonica,
} from './_marketQuote';
import { firestoreGetDoc, firestoreMergeDoc, GoogleServiceAccountEnv } from './_googleAuth';

// SEÇÃO 23 do documento original: histórico. Decisão de custo tomada
// aqui: em vez de gravar a CADA consulta de usuário, grava no máximo 1
// vez por DIA por combinação produto+estado (não por hora — o gráfico
// de preço x clima por mês/dia que vamos construir não precisa de mais
// granularidade que isso, e economiza ainda mais escrita). Guarda até
// 730 pontos (2 anos de pontos diários) por combinação, depois descarta
// os mais antigos — 2 anos é mais que suficiente pro gráfico pedido
// (ano atual + comparação com o ano anterior).
const HISTORY_THROTTLE_MS = 24 * 60 * 60 * 1000; // 1 dia
const HISTORY_MAX_POINTS = 730; // 2 anos de pontos diários

async function talvezGravarHistorico(env: GoogleServiceAccountEnv, produto: string, estado: string, quotes: MarketQuote[]) {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    // Log alto de propósito: sem essas 3 variáveis configuradas no
    // Cloudflare Pages, o histórico de preço nunca grava, mas isso
    // ficava completamente silencioso antes — deixando o gráfico
    // Preço x Clima sempre vazio sem nenhuma pista do motivo.
    console.error('HISTÓRICO DE PREÇO NÃO GRAVADO: faltam variáveis FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY no ambiente do Cloudflare Pages.');
    return;
  }
  const disponiveis = quotes.filter(q => q.isAvailable && q.price != null);
  if (disponiveis.length === 0) return;

  const docId = `${produto}_${estado || 'geral'}`;
  try {
    const existente = await firestoreGetDoc(env, 'priceHistory', docId);
    const ultimaGravacao = existente?.ultimaGravacao ? new Date(existente.ultimaGravacao).getTime() : 0;
    if (Date.now() - ultimaGravacao < HISTORY_THROTTLE_MS) return; // já gravou hoje, não grava de novo

    const pontos: any[] = Array.isArray(existente?.pontos) ? existente.pontos : [];

    // Escolha da cotação que entra no histórico. ANTES: a primeira fonte
    // disponível do dia — se a fonte de ontem (ex: AIBA, R$/saca) caísse
    // e hoje respondesse outra (ex: em R$/kg ou US$), a série "despencava"
    // dezenas de vezes sem nenhuma mudança real de preço. AGORA:
    //  1) mantém a MESMA unidade canônica da série já gravada;
    //  2) dentro dela, prefere a mesma fonte do último ponto;
    //  3) série nova: prefere BRL com unidade identificada.
    // Se nenhuma cotação de hoje estiver na unidade da série, não grava.
    const ultimo = [...pontos].reverse().find(p => p?.unidade);
    let principal: MarketQuote | undefined;
    if (ultimo) {
      const mesmaUnidade = disponiveis.filter(q => unidadeCanonica(q.unit, q.currency) === ultimo.unidade);
      principal = mesmaUnidade.find(q => q.source === ultimo.fonte) || mesmaUnidade[0];
    }
    // Se a unidade da série sumiu de todas as fontes há mais de 14 dias,
    // começa um trecho novo na unidade disponível (a leitura mostra só a
    // unidade mais recente, então os trechos nunca se misturam no gráfico).
    const ultimoMs = ultimo ? new Date(ultimo.data).getTime() : 0;
    if (ultimo && !principal && Date.now() - ultimoMs < 14 * 86400000) return;
    if (!principal) {
      principal = disponiveis.find(q => q.currency === 'BRL' && !unidadeCanonica(q.unit, q.currency).endsWith('/?'))
        || disponiveis.find(q => q.currency === 'BRL')
        || disponiveis[0];
    }

    pontos.push({
      preco: principal.price,
      fonte: principal.source,
      unidade: unidadeCanonica(principal.unit, principal.currency),
      unidadeOriginal: principal.unit,
      data: new Date().toISOString(),
    });
    // Mantém só os últimos 2 anos de pontos (evita o documento crescer sem limite).
    const pontosLimitados = pontos.slice(-HISTORY_MAX_POINTS);

    await firestoreMergeDoc(env, 'priceHistory', docId, {
      produto, estado: estado || null,
      ultimaGravacao: new Date().toISOString(),
      pontos: pontosLimitados,
    });
  } catch (e) {
    // Falha ao gravar histórico nunca deve quebrar a resposta principal
    // de cotações — só loga.
    console.error('Falha ao gravar histórico:', e);
  }
}

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

interface Env extends GoogleServiceAccountEnv {}

export const onRequestGet: PagesFunction<Env> = async (context) => {
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
      fetches.push(fetchJson(origin, '/api/scot-boi-mundo'));
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
      const boiMundoData = rest[restIdx++];
      if (boiMundoData) quotes = quotes.concat(normalizeBoiMundo(boiMundoData, produto, productLabel));
    }

    // Separa cotações REGIONAIS (bateram no estado pedido) de NACIONAIS
    // (sem estado, servem de referência independente da região) em
    // grupos distintos — antes elas ficavam misturadas na mesma lista
    // quando um estado era pedido, o que contaminava qualquer tentativa
    // de montar um filtro de localização a partir da resposta (uma
    // cotação nacional não deve virar uma opção de "cidade" ou
    // "estado" no seletor).
    let quotesRegionais = quotes;
    let quotesNacionais: MarketQuote[] = [];
    if (state) {
      quotesNacionais = quotes.filter(q => !q.state);
      quotesRegionais = quotes.filter(q => q.state === state);
    }

    // Nunca deixa um preço null se disfarçar de zero — remove
    // completamente da lista quotes sem preço disponível, e informa
    // quantas foram descartadas por esse motivo (transparência).
    const todasAntes = [...quotesRegionais, ...quotesNacionais];
    const semPreco = todasAntes.filter(q => !q.isAvailable).length;
    quotesRegionais = quotesRegionais.filter(q => q.isAvailable);
    quotesNacionais = quotesNacionais.filter(q => q.isAvailable);
    quotes = [...quotesRegionais, ...quotesNacionais]; // mantém compatibilidade pra quem já lê "quotes" direto

    // Gravação de histórico em segundo plano (não atrasa a resposta pro
    // usuário) — limitada a 1x/hora por produto+estado, ver comentário
    // no topo do arquivo.
    context.waitUntil(talvezGravarHistorico(context.env, produto, state, quotes));

    return new Response(JSON.stringify({
      product: produto,
      state: state || null,
      quotes, // mantido por compatibilidade — regionais primeiro, depois nacionais
      quotesRegionais, // só cotações que realmente batem no estado pedido — use isso pra montar filtro de localização
      quotesNacionais, // referência nacional/internacional (sem estado) — mostrar separado, nunca usar pra montar dropdown de local
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
