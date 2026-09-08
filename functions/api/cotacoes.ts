// Busca cotações reais de produtos agropecuários (à vista/CEPEA, futuro/B3
// e preços regionais) a partir do noticiasagricolas.com.br — que consolida
// dados de CEPEA/ESALQ, B3, Scot Consultoria, Datagro e IMEA em tabelas
// públicas na própria página.
//
// Técnica: busca o HTML bruto (texto, não streaming) e usa expressões
// regulares testadas para achar cada <table> e, olhando pro texto logo
// antes dela, capturar o título mais próximo (h1-h6, <strong> ou <b>) —
// sem presumir uma tag fixa, o que se mostrou frágil numa tentativa
// anterior. A lógica foi validada previamente contra um HTML de exemplo.

const PRODUCT_SLUGS: Record<string, string> = {
  boi_gordo: 'boi-gordo',
  cafe: 'cafe',
  algodao: 'algodao',
  soja: 'soja',
  milho: 'milho',
  trigo: 'trigo',
  laranja: 'laranja',
  acucar: 'sucroenergetico',
  suinos: 'suinos',
  frango: 'frango',
  leite: 'leite',
  arroz: 'arroz',
  feijao: 'feijao',
  cacau: 'cacau',
  amendoim: 'amendoim',
  sorgo: 'sorgo',
  ovos: 'ovos',
  mandioca: 'mandioca',
  frutas: 'frutas',
};

const OTHER_PRODUCT_KEYWORDS: Record<string, RegExp> = {
  boi_gordo: /\b(algodão|soja|milho|trigo|café|arroz|feijão|cacau|amendoim|sorgo|laranja)\b/i,
  cafe: /\b(algodão|soja|milho|trigo|boi gordo|arroz|feijão|cacau|amendoim|sorgo|laranja)\b/i,
};

interface ParsedTable {
  heading: string;
  source: string;
  rows: string[][];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ordm;/g, 'º');
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

const TABLE_RE = /<table[^>]*>([\s\S]*?)<\/table>/gi;
const HEADING_RE = /<(h[1-6]|strong|b)[^>]*>([\s\S]*?)<\/\1>/gi;
const SOURCE_RE = /fonte:\s*([^<\n]{2,60})/i;
const ROW_RE = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
const CELL_RE = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

function parseTables(html: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  let lastEnd = 0;
  let match: RegExpExecArray | null;

  TABLE_RE.lastIndex = 0;
  while ((match = TABLE_RE.exec(html)) !== null) {
    const gap = html.slice(lastEnd, match.index);
    const tableHtml = match[1];

    let heading = '';
    let headingMatch: RegExpExecArray | null;
    HEADING_RE.lastIndex = 0;
    let lastHeadingMatch: RegExpExecArray | null = null;
    while ((headingMatch = HEADING_RE.exec(gap)) !== null) {
      lastHeadingMatch = headingMatch;
    }
    if (lastHeadingMatch) heading = stripTags(lastHeadingMatch[2]);

    const sourceMatch = gap.match(SOURCE_RE);
    const source = sourceMatch ? stripTags(sourceMatch[1]) : '';

    const rows: string[][] = [];
    let rowMatch: RegExpExecArray | null;
    ROW_RE.lastIndex = 0;
    while ((rowMatch = ROW_RE.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];
      const cells: string[] = [];
      let cellMatch: RegExpExecArray | null;
      CELL_RE.lastIndex = 0;
      while ((cellMatch = CELL_RE.exec(rowHtml)) !== null) {
        cells.push(stripTags(cellMatch[1]));
      }
      if (cells.length > 0) rows.push(cells);
    }

    if (rows.length > 0 && (rows[0]?.length || 0) >= 2) {
      tables.push({ heading, source, rows });
    }

    lastEnd = match.index + match[0].length;
  }

  return tables;
}

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const productKey = url.searchParams.get('produto') || 'boi_gordo';
    const showDebug = url.searchParams.has('debug');
    const slug = PRODUCT_SLUGS[productKey];

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Produto não reconhecido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sourceUrl = `https://www.noticiasagricolas.com.br/cotacoes/${slug}`;
    const res = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      return new Response(JSON.stringify({ error: `Falha ao buscar cotações (status ${res.status}): ${bodyText.slice(0, 200)}`, sourceUrl }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = await res.text();
    let tables = parseTables(html);

    const otherProductPattern = OTHER_PRODUCT_KEYWORDS[productKey];
    const excludedCount = otherProductPattern ? tables.filter(t => otherProductPattern.test(t.heading)).length : 0;
    if (otherProductPattern) {
      tables = tables.filter(t => !otherProductPattern.test(t.heading));
    }

    return new Response(JSON.stringify({
      produto: productKey,
      sourceUrl,
      tables,
      fetchedAt: new Date().toISOString(),
      debug: showDebug ? {
        htmlLength: html.length,
        totalTablesFound: tables.length + excludedCount,
        excludedAsOtherProduct: excludedCount,
        headings: tables.map(t => t.heading || '(sem título)'),
      } : undefined,
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': showDebug ? 'no-store' : 'public, max-age=900' },
    });
  } catch (error: any) {
    console.error('cotacoes error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao buscar cotações: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
