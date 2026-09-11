// Busca a tabela "Mercado Físico - Scot Consultoria" publicada
// gratuitamente pelo Notícias Agrícolas. Esta é a fonte mais completa
// por PRAÇA que encontramos: uma tabela HTML real (não JavaScript) com
// ~33 praças cobrindo 20 estados, trazendo Boi Gordo à vista, Boi Gordo
// a prazo 30 dias E Vaca Gorda — resolvendo a lacuna de cobertura das
// categorias que antes só tinham dado pra um ou dois estados.
//
// Praças cobertas (confirmado por leitura real): SP Barretos, SP
// Araçatuba, MG Triângulo/B.Horizonte/Norte/Sul, GO Goiânia/Reg.Sul,
// MS Dourados/C.Grande/Três Lagoas, RS Oeste/Pelotas (em R$/kg, não
// arroba), BA Sul/Oeste, MT Norte/Sudoeste/Cuiabá/Sudeste, PR Noroeste,
// SC, MA Oeste, Alagoas, PA Marabá/Redenção/Paragominas, RO Sudeste,
// TO Sul/Norte, Acre, ES, RJ, Roraima.
//
// ATENÇÃO À UNIDADE: as praças do Rio Grande do Sul são cotadas em
// R$/kg (não R$/@) — detectamos isso pelo "(kg)" no nome da praça e
// marcamos a unidade corretamente, nunca convertendo sem avisar.

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Prefixo de sigla usado no nome da praça -> nome do estado.
const PREFIXO_UF: Record<string, string> = {
  'SP': 'São Paulo', 'MG': 'Minas Gerais', 'GO': 'Goiás', 'MS': 'Mato Grosso do Sul',
  'MT': 'Mato Grosso', 'RS': 'Rio Grande do Sul', 'BA': 'Bahia', 'PR': 'Paraná',
  'SC': 'Santa Catarina', 'MA': 'Maranhão', 'PA': 'Pará', 'RO': 'Rondônia',
  'TO': 'Tocantins', 'ES': 'Espírito Santo', 'RJ': 'Rio de Janeiro', 'AC': 'Acre',
  'RR': 'Roraima', 'AL': 'Alagoas', 'CE': 'Ceará', 'PE': 'Pernambuco',
};

// Praças cujo nome já é o estado inteiro, sem prefixo de sigla.
const NOME_ESTADO_DIRETO: Record<string, string> = {
  'acre': 'Acre', 'alagoas': 'Alagoas', 'roraima': 'Roraima', 'sc': 'Santa Catarina',
  'es': 'Espírito Santo', 'rj': 'Rio de Janeiro', 'rondônia': 'Rondônia', 'rondonia': 'Rondônia',
};

interface PracaRow {
  praca: string;
  estado: string | null;
  regiao: string | null;
  unidade: string;
  boiGordoVista: string | null;
  boiGordoPrazo: string | null;
  vacaGorda: string | null;
}

function resolverLocal(praca: string): { estado: string | null; regiao: string | null } {
  const limpo = praca.replace(/\s*\(kg\)/i, '').replace(/\*/g, '').trim();
  // Formato "XX Resto" (ex: "SP Barretos", "MG Triângulo")
  const comPrefixo = limpo.match(/^([A-Za-z]{2})\s+(.+)$/);
  if (comPrefixo && PREFIXO_UF[comPrefixo[1].toUpperCase()]) {
    return { estado: PREFIXO_UF[comPrefixo[1].toUpperCase()], regiao: comPrefixo[2].trim() };
  }
  // Nome de estado direto (ex: "Acre", "SC", "ES")
  const direto = NOME_ESTADO_DIRETO[limpo.toLowerCase()];
  if (direto) return { estado: direto, regiao: null };
  const soSigla = PREFIXO_UF[limpo.toUpperCase()];
  if (soSigla) return { estado: soSigla, regiao: null };
  return { estado: null, regiao: null };
}

function parseTabela(html: string): PracaRow[] {
  const rows: PracaRow[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) cells.push(stripTags(cellMatch[1]));

    // Linha válida: nome da praça + pelo menos um valor numérico no
    // formato de preço. Ignora cabeçalho (que contém "R$" no texto).
    if (cells.length >= 4 && cells[0] && /^\d{1,3},\d{2}$/.test(cells[1] || '')) {
      const { estado, regiao } = resolverLocal(cells[0]);
      const emKg = /\(kg\)/i.test(cells[0]);
      rows.push({
        praca: cells[0].replace(/\*/g, '').trim(),
        estado, regiao,
        unidade: emKg ? 'R$/kg' : 'R$/@',
        boiGordoVista: cells[1] || null,
        boiGordoPrazo: cells[2] || null,
        vacaGorda: cells[3] || null,
      });
    }
  }
  return rows;
}

export const onRequestGet: PagesFunction = async () => {
  try {
    const sourceUrl = 'https://www.noticiasagricolas.com.br/cotacoes/boi-gordo/boi-gordo-scot-consultoria';
    const res = await fetch(sourceUrl, { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' } });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Falha ao buscar a tabela da Scot (status ${res.status}).`, sourceUrl }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = await res.text();
    const pracas = parseTabela(html);

    if (pracas.length === 0) {
      return new Response(JSON.stringify({ error: 'Tabela de praças da Scot não encontrada — a estrutura pode ter mudado.', sourceUrl }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Data de fechamento informada pela própria página, quando disponível.
    const fechamentoMatch = html.match(/Fechamento:\s*(\d{2}\/\d{2}\/\d{4})/i);

    const estadosCobertos = Array.from(new Set(pracas.map(p => p.estado).filter(Boolean)));

    return new Response(JSON.stringify({
      pracas,
      estadosCobertos,
      totalPracas: pracas.length,
      fechamento: fechamentoMatch?.[1] || null,
      sourceUrl,
      fonteOriginal: 'Scot Consultoria (via Notícias Agrícolas)',
      fetchedAt: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800' },
    });
  } catch (error: any) {
    console.error('scot-pracas error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao buscar praças da Scot: ' + (error.message || String(error)) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
