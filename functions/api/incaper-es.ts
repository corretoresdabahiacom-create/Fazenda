// Busca preços reais e oficiais do Incaper — Instituto Capixaba de
// Pesquisa, Assistência Técnica e Extensão Rural, órgão do Governo do
// Espírito Santo (site .gov.br).
//
// ESCOPO GEOGRÁFICO: cobre exclusivamente o Estado do Espírito Santo.
// A tabela "Preço recebido pelo produtor" traz Boi Gordo Castrado, Boi
// Gordo Inteiro e Vaca Gorda, com valores mínimo/médio/máximo, coletados
// diariamente junto a frigoríficos com sede em Vitória/ES.

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

interface IncaperRow { produto: string; minimo: string; medio: string; maximo: string }

function parsePrecos(html: string): IncaperRow[] {
  const rows: IncaperRow[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length >= 4 && cells[0] && /\d/.test(cells[1] || '') && !/m[ií]nimo/i.test(cells[1])) {
      rows.push({ produto: cells[0], minimo: cells[1], medio: cells[2], maximo: cells[3] });
    }
  }
  return rows;
}

export const onRequestGet: PagesFunction = async () => {
  try {
    const sourceUrl = 'https://incaper.es.gov.br/mercado-agricola';
    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Falha ao buscar Incaper-ES (status ${res.status}).`, sourceUrl }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = await res.text();
    const precos = parsePrecos(html);

    if (precos.length === 0) {
      return new Response(JSON.stringify({ error: 'Tabela de preços do Incaper-ES não encontrada no momento.', sourceUrl }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      precos,
      sourceUrl,
      fetchedAt: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900' },
    });
  } catch (error: any) {
    console.error('incaper-es error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao buscar Incaper-ES: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
