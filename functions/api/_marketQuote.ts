// FASE 4 do motor de cotações: schema normalizado + camada de
// normalização. O Firestore é um banco NoSQL (não relacional), então
// "banco normalizado" aqui significa: um formato de dado único e
// consistente que qualquer fonte precisa virar antes de ser exibida ou
// (futuramente) guardada — em vez de cada tela ter que saber o formato
// específico de cada uma das 10 fontes diferentes.
//
// IMPORTANTE — o que este arquivo NÃO faz: não persiste nada no
// Firestore ainda. Persistir histórico de cada consulta traria custo de
// escrita real (cada requisição de usuário viraria uma escrita), e essa
// é uma decisão de produto (quanto vale guardar histórico vs. custo)
// que precisa ser conversada antes de implementar — não é algo pra
// decidir sozinho. O que existe aqui é a normalização em si, usada pelo
// endpoint /api/quotes (Fase 4/5) na hora de responder.

export type PriceType = 'a_vista' | 'a_prazo' | 'futuro' | 'indicador' | 'desconhecido';
export type SourceKind = 'oficial' | 'mercado' | 'internacional';

// Regra da seção 16 do documento original: preço 0 ou negativo nunca
// deve ser tratado como um dado disponível — geralmente significa erro
// de leitura ou campo vazio disfarçado de número. Centralizado aqui e
// usado em TODOS os normalizadores, coberto por teste automatizado.
export function isValidPrice(price: unknown): price is number {
  return typeof price === 'number' && !isNaN(price) && isFinite(price) && price > 0;
}

// Campos do documento de spec original que NÃO incluímos aqui, e por
// quê: preco_bruto/preco_liquido/funrural/senar (nenhuma fonte ativa
// hoje fornece essa quebra); confidence_score numérico preciso (não
// temos uma metodologia real de cálculo — em vez disso usamos
// isOfficial como sinal binário, mais honesto que inventar um número de
// 0-100); raw_response completo (armazenaria HTML/JSON bruto de cada
// fonte sem necessidade prática agora).
export interface MarketQuote {
  productId: string;          // chave interna (ex: "boi_gordo")
  productLabel: string;       // nome pra exibição (ex: "Boi Gordo")
  state: string | null;       // nome do estado, quando a fonte for regional/estadual
  stateCode: string | null;   // sigla (ex: "SP")
  region: string | null;      // região dentro do estado, quando existir (ex: "Oeste da Bahia")
  municipality: string | null;
  marketPlace: string | null; // praça específica citada pela fonte, se houver
  price: number | null;       // null = sem cotação disponível (nunca 0 por padrão ausente)
  currency: 'BRL' | 'USD';
  unit: string;               // unidade tal como a fonte informou (ex: "R$/@", "Saca 60kg")
  priceType: PriceType;
  date: string | null;        // data da cotação em si (quando a fonte informar)
  fetchedAt: string;          // quando o app buscou o dado (sempre presente)
  source: string;             // nome da fonte
  sourceUrl: string;          // URL de onde veio
  sourceKind: SourceKind;
  isOfficial: boolean;
  isEstimated: false;         // sempre false — o app nunca estima/preenche lacuna
  isAvailable: boolean;       // false quando price é null
}

// ---- Normalizadores: um por fonte, cada um sabendo ler o formato
// específico daquela API e devolver MarketQuote[] ----

// Acha a célula de preço numa linha — prioriza formato "123,45" (preço
// de verdade), e só cai pro critério largo (qualquer célula com dígito)
// se não achar nenhuma assim. Sem essa prioridade, rótulos de contrato
// como "Out/2026" (que tem dígito, mas não é preço) eram confundidos
// com o valor real — bug encontrado testando com dado sintético antes
// de usar em produção.
export function findPriceCell(row: string[]): string | undefined {
  const decimalPrice = row.find(c => /\d+,\d{2}\b/.test(c));
  if (decimalPrice) return decimalPrice;
  return row.find(c => /\d/.test(c) && !/^[a-zà-ú]+$/i.test(c) && !/^\d{1,2}\/\d{2,4}$/.test(c.trim()));
}

export function normalizeNoticiasAgricolas(data: any, productId: string, productLabel: string): MarketQuote[] {
  if (!data?.tables?.length) return [];
  const quotes: MarketQuote[] = [];
  for (const table of data.tables) {
    const isFuturo = /pregão|futuro|vencimento/i.test(table.heading || '');
    for (const row of (table.rows || []).slice(1)) {
      const priceCell = findPriceCell(row);
      const price = priceCell ? Number(priceCell.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.')) : null;
      quotes.push({
        productId, productLabel,
        state: null, stateCode: null, region: null, municipality: row[0] || null, marketPlace: row[0] || null,
        price: isValidPrice(price) ? price : null,
        currency: 'BRL',
        unit: (table.rows?.[0] || []).find((h: string) => /r\$|us\$/i.test(h)) || 'R$',
        priceType: isFuturo ? 'futuro' : 'indicador',
        date: data.fetchedAt || null,
        fetchedAt: data.fetchedAt || new Date().toISOString(),
        source: table.source || 'Notícias Agrícolas',
        sourceUrl: data.sourceUrl,
        sourceKind: 'mercado',
        isOfficial: false,
        isEstimated: false,
        isAvailable: isValidPrice(price),
      });
    }
  }
  return quotes;
}

export function normalizeIeaSp(data: any, productId: string, productLabel: string): MarketQuote[] {
  if (!data?.recebidosPelosProdutores) return [];
  return data.recebidosPelosProdutores.map((row: any) => {
    const price = Number(String(row.preco).replace(',', '.'));
    return {
      productId, productLabel,
      state: 'São Paulo', stateCode: 'SP', region: null, municipality: null, marketPlace: null,
      price: isValidPrice(price) ? price : null,
      currency: 'BRL', unit: row.unidade || '@',
      priceType: 'a_vista' as PriceType,
      date: null, fetchedAt: data.fetchedAt || new Date().toISOString(),
      source: 'IEA-SP', sourceUrl: data.sourceUrl, sourceKind: 'oficial' as SourceKind,
      isOfficial: true, isEstimated: false, isAvailable: isValidPrice(price),
    };
  });
}

export function normalizeIncaperEs(data: any, productId: string, productLabel: string): MarketQuote[] {
  if (!data?.precos) return [];
  return data.precos.map((row: any) => {
    const price = Number(String(row.medio).replace('R$', '').replace(',', '.').trim());
    return {
      productId, productLabel,
      state: 'Espírito Santo', stateCode: 'ES', region: null, municipality: null, marketPlace: row.produto || null,
      price: isValidPrice(price) ? price : null,
      currency: 'BRL', unit: '@',
      priceType: 'a_vista' as PriceType,
      date: null, fetchedAt: data.fetchedAt || new Date().toISOString(),
      source: 'Incaper', sourceUrl: data.sourceUrl, sourceKind: 'oficial' as SourceKind,
      isOfficial: true, isEstimated: false, isAvailable: isValidPrice(price),
    };
  });
}

export function normalizeEpagriSc(data: any, productId: string, productLabel: string): MarketQuote[] {
  const quotes: MarketQuote[] = [];
  for (const key of ['boiGordo', 'vacaGorda'] as const) {
    const row = data?.[key];
    if (!row) continue;
    quotes.push({
      productId, productLabel,
      state: 'Santa Catarina', stateCode: 'SC', region: null, municipality: null, marketPlace: row.praca || null,
      price: isValidPrice(row.preco) ? row.preco : null,
      currency: 'BRL', unit: '@',
      priceType: 'a_vista', date: row.data || null, fetchedAt: data.fetchedAt || new Date().toISOString(),
      source: 'Epagri/Cepa', sourceUrl: data.sourceUrl, sourceKind: 'oficial',
      isOfficial: true, isEstimated: false, isAvailable: isValidPrice(row.preco),
    });
  }
  return quotes;
}

export function normalizeAiba(data: any, productId: string, productLabel: string): MarketQuote[] {
  if (!data?.rows) return [];
  return data.rows.map((row: any) => {
    const price = Number(String(row.preco).replace(',', '.'));
    return {
      productId, productLabel,
      state: 'Bahia', stateCode: 'BA', region: 'Oeste da Bahia', municipality: null, marketPlace: null,
      price: isValidPrice(price) ? price : null,
      currency: 'BRL', unit: row.unidade || 'Saca 60kg',
      priceType: 'a_vista' as PriceType,
      date: row.data || null, fetchedAt: data.fetchedAt || new Date().toISOString(),
      source: 'AIBA', sourceUrl: data.sourceUrl, sourceKind: 'mercado' as SourceKind,
      isOfficial: false, isEstimated: false, isAvailable: isValidPrice(price),
    };
  });
}

export function normalizeTradingEconomics(data: any, productId: string, productLabel: string): MarketQuote[] {
  if (!isValidPrice(data?.preco)) return [];
  return [{
    productId, productLabel,
    state: null, stateCode: null, region: null, municipality: null, marketPlace: 'Estados Unidos',
    price: data.preco,
    currency: 'BRL', unit: data.unidade || 'R$/@',
    priceType: 'indicador',
    date: null, fetchedAt: data.fetchedAt || new Date().toISOString(),
    source: 'TradingEconomics', sourceUrl: data.sourceUrl, sourceKind: 'internacional',
    isOfficial: false, isEstimated: false, isAvailable: true,
  }];
}

// Scot Consultoria "Boi no Mundo" — comparativo internacional real
// (Brasil, Argentina, Uruguai, Paraguai, Austrália, Irlanda, EUA,
// China) em US$/@. Cada país vira um MarketQuote com moeda USD (a
// fonte já publica em dólar, não convertemos pra não introduzir erro
// de câmbio sem necessidade).
export function normalizeBoiMundo(data: any, productId: string, productLabel: string): MarketQuote[] {
  if (!data?.paises?.length) return [];
  return data.paises.map((p: any): MarketQuote => {
    const price = Number(String(p.atual).replace(',', '.'));
    return {
      productId, productLabel,
      state: null, stateCode: null, region: null, municipality: null, marketPlace: p.pais,
      price: isValidPrice(price) ? price : null,
      currency: 'USD', unit: data.unidade || 'US$/@',
      priceType: 'indicador',
      date: null, fetchedAt: data.fetchedAt || new Date().toISOString(),
      source: 'Scot Consultoria (Boi no Mundo)', sourceUrl: data.sourceUrl, sourceKind: 'internacional',
      isOfficial: false, isEstimated: false, isAvailable: isValidPrice(price),
    };
  });
}
