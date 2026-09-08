// Busca cotações reais por MUNICÍPIO (qualquer cidade do Brasil) no
// Agrolink — que mantém uma página de cotações própria por cidade, algo
// que o Notícias Agrícolas (nossa fonte principal) não tem no mesmo
// nível de detalhe regional. Serve tanto para os produtos agrícolas
// quanto pecuários (boi gordo, vaca, novilha) na cidade exata pedida.
//
// Preços "referenciais" — o próprio Agrolink avisa que não audita os
// dados coletados junto às fontes originais, e cidades menores podem não
// ter preço coletado em todos os dias (a tabela então vem com a coluna
// de preço em branco para aquele produto/data).

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const UF_SLUGS: Record<string, string> = {
  'Acre': 'ac', 'Alagoas': 'al', 'Amapá': 'ap', 'Amazonas': 'am', 'Bahia': 'ba', 'Ceará': 'ce',
  'Distrito Federal': 'df', 'Espírito Santo': 'es', 'Goiás': 'go', 'Maranhão': 'ma',
  'Mato Grosso': 'mt', 'Mato Grosso do Sul': 'ms', 'Minas Gerais': 'mg', 'Pará': 'pa',
  'Paraíba': 'pb', 'Paraná': 'pr', 'Pernambuco': 'pe', 'Piauí': 'pi', 'Rio de Janeiro': 'rj',
  'Rio Grande do Norte': 'rn', 'Rio Grande do Sul': 'rs', 'Rondônia': 'ro', 'Roraima': 'rr',
  'Santa Catarina': 'sc', 'São Paulo': 'sp', 'Sergipe': 'se', 'Tocantins': 'to',
};

function toSlug(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface AgrolinkRow {
  produto: string;
  preco: string;
  data: string;
}

function parsePriceTable(html: string): AgrolinkRow[] {
  const rows: AgrolinkRow[] = [];
  // A tabela vem como markdown-like no HTML real em formato de <table>
  // convencional — usamos o mesmo tipo de extração por regex já usado no
  // scraper do Notícias Agrícolas.
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
    }
    // Colunas esperadas: Produto | Local | Preço (R$) | Última Atualização | Freq. | Gráfico
    if (cells.length >= 4 && cells[0] && !/^produto$/i.test(cells[0])) {
      rows.push({ produto: cells[0], preco: cells[2] || '', data: cells[3] || '' });
    }
  }
  return rows;
}

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const cidade = url.searchParams.get('cidade');
    const estado = url.searchParams.get('estado'); // nome completo, ex: "Bahia"

    if (!cidade || !estado) {
      return new Response(JSON.stringify({ error: 'Faltam parâmetros cidade e estado.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const uf = UF_SLUGS[estado];
    if (!uf) {
      return new Response(JSON.stringify({ error: `Estado "${estado}" não reconhecido.` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const citySlug = toSlug(cidade);
    const sourceUrl = `https://www.agrolink.com.br/regional/${uf}/${citySlug}/cotacoes`;

    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Cidade não encontrada no Agrolink (status ${res.status}).`, sourceUrl }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = await res.text();
    const allRows = parsePriceTable(html);
    // Só mantém linhas com preço realmente preenchido — o Agrolink às
    // vezes lista o produto sem valor coletado naquele dia.
    const rowsWithPrice = allRows.filter(r => r.preco && /\d/.test(r.preco));

    return new Response(JSON.stringify({
      cidade,
      estado,
      sourceUrl,
      rows: rowsWithPrice,
      totalProdutosListados: allRows.length,
      fetchedAt: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900' },
    });
  } catch (error: any) {
    console.error('agrolink-regional error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao buscar cotação regional: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
