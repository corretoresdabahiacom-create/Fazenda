// Busca a tabela "Boi no Mundo" direto do site oficial da Scot
// Consultoria — comparação internacional real do preço do boi gordo em
// US$/@ entre Brasil, Argentina, Uruguai, Paraguai, Austrália, Irlanda,
// Estados Unidos e CHINA. Diferente da maioria do site (que usa listas,
// não tabelas HTML), essa seção específica vem em <table> de verdade,
// então usamos o mesmo parser testado já usado no Notícias Agrícolas.

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

interface PaisPreco { pais: string; atual: string; haUmAno: string }

function parseBoiNoMundo(html: string): PaisPreco[] {
  const rows: PaisPreco[] = [];
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
    // Linha esperada: [bandeira/país, valor atual, valor há 1 ano]
    if (cells.length >= 3 && cells[0] && /\d/.test(cells[1]) && !/^pa[ií]s$/i.test(cells[0])) {
      rows.push({ pais: cells[0], atual: cells[1], haUmAno: cells[2] });
    }
  }
  return rows;
}

export const onRequestGet: PagesFunction = async () => {
  try {
    const sourceUrl = 'https://www.scotconsultoria.com.br/';
    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Falha ao buscar Scot Consultoria (status ${res.status}).`, sourceUrl }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = await res.text();
    const paises = parseBoiNoMundo(html);

    if (paises.length === 0) {
      return new Response(JSON.stringify({ error: 'Tabela "Boi no Mundo" não encontrada na página no momento.', sourceUrl }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      paises,
      unidade: 'US$/@ (15kg)',
      sourceUrl,
      fetchedAt: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800' },
    });
  } catch (error: any) {
    console.error('scot-boi-mundo error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao buscar Boi no Mundo: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
