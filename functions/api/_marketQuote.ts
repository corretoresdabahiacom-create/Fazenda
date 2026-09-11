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
//
// Faixas de sanidade por produto — bug real encontrado em produção:
// sem isso, um valor claramente errado de leitura (ex: 18.211.009,00 ou
// 0,60 pra Boi Gordo, que deveria estar entre 150 e 600) passava como
// "válido" e aparecia como se fosse uma fonte divergente de verdade,
// gerando alertas de "divergência entre fontes" com a mesma fonte
// comparada contra ela mesma. Mesma ideia de src/lib/priceSanity.ts,
// duplicada aqui de propósito (não importada) porque functions/ e src/
// podem ter resolução de caminho diferente na build da Cloudflare
// Function — mais seguro manter uma cópia pequena e local.
const FAIXAS_SANIDADE: Record<string, [number, number]> = {
  boi_gordo: [150, 600], vaca: [130, 550], novilho: [130, 550], novilha: [130, 550],
  soja: [60, 250], milho: [20, 130], cafe: [400, 3500], cafe_arabica: [400, 3500], cafe_conilon: [300, 2500],
  algodao: [60, 280], trigo: [30, 150], arroz: [40, 170], feijao: [100, 600], acucar: [50, 200],
  suinos: [2, 18], frango: [2, 15], leite: [0.8, 6], sorgo: [20, 100],
};

export function isValidPrice(price: unknown, produto?: string): price is number {
  if (typeof price !== 'number' || isNaN(price) || !isFinite(price) || price <= 0) return false;
  const faixa = produto ? FAIXAS_SANIDADE[produto] : undefined;
  if (faixa && (price < faixa[0] || price > faixa[1])) return false;
  return true;
}

// BUG CRÍTICO ENCONTRADO E CORRIGIDO: os normalizadores de AIBA, IEA-SP
// e Incaper percorriam TODAS as linhas devolvidas pela fonte (que trazem
// vários produtos por chamada — ex: AIBA devolve Soja, Milho, Sorgo,
// Café, Feijão, Arroz etc. numa única resposta) e atribuíam o produto
// PEDIDO pelo usuário a CADA linha, sem checar se a linha realmente
// representava aquele produto. Resultado: pedir "milho" podia devolver
// o preço da Soja, do Café etc., todos rotulados como "Milho" — o que
// também explica alertas de "divergência entre fontes" comparando
// produtos totalmente diferentes como se fossem o mesmo. Essa função
// filtra a linha ANTES de virar um MarketQuote; se não achar o nome do
// produto no texto da linha, descarta (nunca assume).
const PRODUTO_ALIASES: Record<string, RegExp> = {
  boi_gordo: /boi gordo(?!\s*\(china\))|indicador do boi\b/i,
  vaca: /vaca gorda|indicador da vaca/i,
  novilho: /\bgarrote\b|\bnovilho\b/i,
  novilha: /\bnovilha\b/i,
  soja: /\bsoja\b/i,
  milho: /\bmilho\b/i,
  sorgo: /\bsorgo\b/i,
  algodao: /algod[ãa]o/i,
  cafe: /\bcaf[ée]\b/i,
  cafe_arabica: /caf[ée].*ar[áa]bic[ao]/i,
  cafe_conilon: /caf[ée].*(conilon|robusta)/i,
  arroz: /\barroz\b/i,
  feijao: /feij[ãa]o/i,
  amendoim: /amendoim/i,
  trigo: /\btrigo\b/i,
  suinos: /su[íi]no/i,
  frango: /frango/i,
  leite: /\bleite\b/i,
  laranja: /laranja/i,
};

function rowMatchesProduct(textoLinha: string, productId: string): boolean {
  const alias = PRODUTO_ALIASES[productId];
  // Se não temos um alias configurado pra esse produto, não bloqueia
  // (evita quebrar produtos novos que ainda não foram mapeados) — mas
  // todo produto usado nos normalizadores abaixo já está na lista.
  if (!alias) return true;
  return alias.test(textoLinha);
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

// Detecta se o texto da primeira célula de uma linha é literalmente um
// nome de estado ou sigla — usado pra preencher "state" corretamente
// (antes ficava sempre null, mesmo quando a linha já dizia "Bahia" ou
// "SP", o que impedia montar um seletor de localização de verdade a
// partir dessa fonte).
const ESTADOS_E_UF: Record<string, string> = {
  'acre': 'Acre', 'ac': 'Acre', 'alagoas': 'Alagoas', 'al': 'Alagoas',
  'amapá': 'Amapá', 'amapa': 'Amapá', 'ap': 'Amapá',
  'amazonas': 'Amazonas', 'am': 'Amazonas', 'bahia': 'Bahia', 'ba': 'Bahia',
  'ceará': 'Ceará', 'ceara': 'Ceará', 'ce': 'Ceará',
  'distrito federal': 'Distrito Federal', 'df': 'Distrito Federal',
  'espírito santo': 'Espírito Santo', 'espirito santo': 'Espírito Santo', 'es': 'Espírito Santo',
  'goiás': 'Goiás', 'goias': 'Goiás', 'go': 'Goiás',
  'maranhão': 'Maranhão', 'maranhao': 'Maranhão', 'ma': 'Maranhão',
  'mato grosso do sul': 'Mato Grosso do Sul', 'ms': 'Mato Grosso do Sul',
  'mato grosso': 'Mato Grosso', 'mt': 'Mato Grosso',
  'minas gerais': 'Minas Gerais', 'mg': 'Minas Gerais',
  'pará': 'Pará', 'para': 'Pará', 'pa': 'Pará', 'paraíba': 'Paraíba', 'paraiba': 'Paraíba', 'pb': 'Paraíba',
  'paraná': 'Paraná', 'parana': 'Paraná', 'pr': 'Paraná',
  'pernambuco': 'Pernambuco', 'pe': 'Pernambuco', 'piauí': 'Piauí', 'piaui': 'Piauí', 'pi': 'Piauí',
  'rio de janeiro': 'Rio de Janeiro', 'rj': 'Rio de Janeiro',
  'rio grande do norte': 'Rio Grande do Norte', 'rn': 'Rio Grande do Norte',
  'rio grande do sul': 'Rio Grande do Sul', 'rs': 'Rio Grande do Sul',
  'rondônia': 'Rondônia', 'rondonia': 'Rondônia', 'ro': 'Rondônia',
  'roraima': 'Roraima', 'rr': 'Roraima',
  'santa catarina': 'Santa Catarina', 'sc': 'Santa Catarina',
  'são paulo': 'São Paulo', 'sao paulo': 'São Paulo', 'sp': 'São Paulo',
  'sergipe': 'Sergipe', 'se': 'Sergipe', 'tocantins': 'Tocantins', 'to': 'Tocantins',
};

function detectarEstado(texto: string): string | null {
  const chave = texto.trim().toLowerCase();
  return ESTADOS_E_UF[chave] || null;
}

export function normalizeNoticiasAgricolas(data: any, productId: string, productLabel: string): MarketQuote[] {
  if (!data?.tables?.length) return [];
  const quotes: MarketQuote[] = [];
  for (const table of data.tables) {
    const isFuturo = /pregão|futuro|vencimento/i.test(table.heading || '');
    for (const row of (table.rows || []).slice(1)) {
      const priceCell = findPriceCell(row);
      const price = priceCell ? Number(priceCell.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.')) : null;
      const localTexto = row[0] || '';
      const estadoDetectado = detectarEstado(localTexto);
      quotes.push({
        productId, productLabel,
        state: estadoDetectado, stateCode: null, region: null,
        // Se a célula era literalmente um nome de estado, não faz
        // sentido repetir o mesmo texto como "município" — só preenche
        // município/praça quando for de fato um local mais específico.
        municipality: estadoDetectado ? null : (localTexto || null),
        marketPlace: estadoDetectado ? null : (localTexto || null),
        price: isValidPrice(price, productId) ? price : null,
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
        isAvailable: isValidPrice(price, productId),
      });
    }
  }
  return quotes;
}

export function normalizeIeaSp(data: any, productId: string, productLabel: string): MarketQuote[] {
  if (!data?.recebidosPelosProdutores) return [];
  return data.recebidosPelosProdutores
    .filter((row: any) => rowMatchesProduct(String(row.produto || ''), productId))
    .map((row: any) => {
    const price = Number(String(row.preco).replace(',', '.'));
    return {
      productId, productLabel,
      state: 'São Paulo', stateCode: 'SP', region: null, municipality: null, marketPlace: null,
      price: isValidPrice(price, productId) ? price : null,
      currency: 'BRL', unit: row.unidade || '@',
      priceType: 'a_vista' as PriceType,
      date: null, fetchedAt: data.fetchedAt || new Date().toISOString(),
      source: 'IEA-SP', sourceUrl: data.sourceUrl, sourceKind: 'oficial' as SourceKind,
      isOfficial: true, isEstimated: false, isAvailable: isValidPrice(price, productId),
    };
  });
}

export function normalizeIncaperEs(data: any, productId: string, productLabel: string): MarketQuote[] {
  if (!data?.precos) return [];
  return data.precos
    .filter((row: any) => rowMatchesProduct(String(row.produto || ''), productId))
    .map((row: any) => {
    const price = Number(String(row.medio).replace('R$', '').replace(',', '.').trim());
    return {
      productId, productLabel,
      state: 'Espírito Santo', stateCode: 'ES', region: null, municipality: null, marketPlace: row.produto || null,
      price: isValidPrice(price, productId) ? price : null,
      currency: 'BRL', unit: '@',
      priceType: 'a_vista' as PriceType,
      date: null, fetchedAt: data.fetchedAt || new Date().toISOString(),
      source: 'Incaper', sourceUrl: data.sourceUrl, sourceKind: 'oficial' as SourceKind,
      isOfficial: true, isEstimated: false, isAvailable: isValidPrice(price, productId),
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
      price: isValidPrice(row.preco, productId) ? row.preco : null,
      currency: 'BRL', unit: '@',
      priceType: 'a_vista', date: row.data || null, fetchedAt: data.fetchedAt || new Date().toISOString(),
      source: 'Epagri/Cepa', sourceUrl: data.sourceUrl, sourceKind: 'oficial',
      isOfficial: true, isEstimated: false, isAvailable: isValidPrice(row.preco, productId),
    });
  }
  return quotes;
}

export function normalizeAiba(data: any, productId: string, productLabel: string): MarketQuote[] {
  if (!data?.rows) return [];
  return data.rows
    .filter((row: any) => rowMatchesProduct(String(row.produto || ''), productId))
    .map((row: any) => {
    const price = Number(String(row.preco).replace(',', '.'));
    return {
      productId, productLabel,
      state: 'Bahia', stateCode: 'BA', region: 'Oeste da Bahia', municipality: null, marketPlace: null,
      price: isValidPrice(price, productId) ? price : null,
      currency: 'BRL', unit: row.unidade || 'Saca 60kg',
      priceType: 'a_vista' as PriceType,
      date: row.data || null, fetchedAt: data.fetchedAt || new Date().toISOString(),
      source: 'AIBA', sourceUrl: data.sourceUrl, sourceKind: 'mercado' as SourceKind,
      isOfficial: false, isEstimated: false, isAvailable: isValidPrice(price, productId),
    };
  });
}

export function normalizeTradingEconomics(data: any, productId: string, productLabel: string): MarketQuote[] {
  if (!isValidPrice(data?.preco, productId)) return [];
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
      price: isValidPrice(price, productId) ? price : null,
      currency: 'USD', unit: data.unidade || 'US$/@',
      priceType: 'indicador',
      date: null, fetchedAt: data.fetchedAt || new Date().toISOString(),
      source: 'Scot Consultoria (Boi no Mundo)', sourceUrl: data.sourceUrl, sourceKind: 'internacional',
      isOfficial: false, isEstimated: false, isAvailable: isValidPrice(price, productId),
    };
  });
}
