// Busca preços reais e oficiais do IEA-SP — Instituto de Economia
// Agrícola, órgão da Secretaria de Agricultura do Governo de São Paulo
// (site .gov.br).
//
// IMPORTANTE — ESCOPO GEOGRÁFICO: esta fonte cobre EXCLUSIVAMENTE o
// Estado de São Paulo na tabela "Recebidos pelos Produtores" (Boi Gordo,
// Boi Gordo China, Vaca Gorda, Novilha, Garrote, Bezerro/Bezerra por
// idade, grãos, frutas). A segunda tabela ("Mercado Interno e
// Internacional") traz o Indicador ESALQ/BM&F (nacional) e futuros de
// Chicago/Nova York/Londres (internacionais) — não é dado de outro
// estado brasileiro, é referência nacional/internacional publicada por
// eles. Ainda faltam fontes oficiais equivalentes para os outros 26
// estados + DF — sendo adicionadas uma a uma.

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

interface IeaRow { produto: string; unidade: string; preco: string }
interface IeaInternacionalRow { produto: string; mercado: string; unidade: string; preco: string }

function parseTableGeneric(html: string, startMarker: RegExp): string[][] {
  const startIdx = html.search(startMarker);
  if (startIdx === -1) return [];
  const slice = html.slice(startIdx, startIdx + 20000);
  const tableMatch = slice.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [];

  const rows: string[][] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(tableMatch[1])) !== null) {
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length >= 3 && cells[0] && !/^produto$/i.test(cells[0])) rows.push(cells);
  }
  return rows;
}

// Tabela "Recebidos pelos Produtores": Produto | Unidade | Preço do dia | ...
function parseRecebidos(html: string): IeaRow[] {
  return parseTableGeneric(html, /Recebidos pelos Produtores/i)
    .filter(cells => /\d/.test(cells[2] || ''))
    .map(cells => ({ produto: cells[0], unidade: cells[1], preco: cells[2] }));
}

// Tabela "Mercado Interno e Internacional": Produto | Mercado | Entrada | Unidade | Preço do dia | ...
function parseInternacional(html: string): IeaInternacionalRow[] {
  return parseTableGeneric(html, /Mercado Interno e Internacional/i)
    .filter(cells => cells.length >= 5 && /\d/.test(cells[4] || ''))
    .map(cells => ({ produto: cells[0], mercado: `${cells[1]} ${cells[2]}`.trim(), unidade: cells[3], preco: cells[4] }));
}

export const onRequestGet: PagesFunction = async () => {
  try {
    const sourceUrl = 'http://ciagri.iea.agricultura.sp.gov.br/precosdiarios/Variacoes.aspx';
    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Falha ao buscar IEA-SP (status ${res.status}).`, sourceUrl }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = await res.text();

    const recebidosPelosProdutores = parseRecebidos(html);
    const mercadoInternoInternacional = parseInternacional(html);

    if (recebidosPelosProdutores.length === 0 && mercadoInternoInternacional.length === 0) {
      return new Response(JSON.stringify({ error: 'Tabelas do IEA-SP não encontradas na página no momento.', sourceUrl }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      recebidosPelosProdutores,
      mercadoInternoInternacional,
      sourceUrl,
      fetchedAt: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900' },
    });
  } catch (error: any) {
    console.error('iea-sp error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao buscar IEA-SP: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
