// Busca preços reais e oficiais da Epagri/Cepa — Centro de Socioeconomia
// e Planejamento Agrícola, órgão do Governo de Santa Catarina (site
// .gov.br). Diferente das outras fontes (que são páginas HTML), esta é
// uma planilha Excel (.xlsx) de dados abertos, publicada oficialmente:
// https://docweb.epagri.sc.gov.br/website_cepa/precos/Historico_precos_diario.xlsx
//
// ESCOPO GEOGRÁFICO: cobre exclusivamente o Estado de Santa Catarina,
// com levantamento em 8 a 10 praças (Canoinhas, Florianópolis, Jaraguá
// do Sul, Joaçaba, Lages, Rio do Sul, Sul Catarinense, São Miguel
// D'Oeste), atualizado diariamente a partir das 14h.
//
// AVISO TÉCNICO: como não conseguimos testar contra o arquivo real
// (rede da sandbox de desenvolvimento não tem acesso a esse domínio),
// esta implementação foi feita com o máximo de flexibilidade possível
// (tenta formato "longo" — uma linha por produto/praça/data — e
// "largo" — uma coluna por produto), e devolve informação de
// diagnóstico detalhada (nomes de abas, cabeçalhos, linhas de exemplo)
// para ajuste fino caso a estrutura real seja diferente do esperado.

import { lerXlsx } from './_xlsxLite';

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const XLSX_URL = 'https://docweb.epagri.sc.gov.br/website_cepa/precos/Historico_precos_diario.xlsx';

interface PrecoRow { data: string; produto: string; praca?: string; preco: number }

function findColumn(headers: string[], patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex(h => pattern.test(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseWorkbook(buffer: ArrayBuffer, debug: string[]): { rows: PrecoRow[]; sheetNames: string[]; headers: string[] } {
  const planilha = lerXlsx(buffer);
  const sheetNames = planilha.abas;
  debug.push(`Abas encontradas: ${sheetNames.join(', ')}`);

  // Usa a primeira aba, ou uma que tenha "diari" no nome (mais provável
  // de ser a planilha certa em "Historico_precos_diario.xlsx").
  const sheetName = sheetNames.find(n => /diari/i.test(n)) || sheetNames[0];
  const json = planilha.lerAba(sheetName).filter(l => l.some(c => c !== ''));

  if (json.length === 0) return { rows: [], sheetNames, headers: [] };

  const headers = (json[0] || []).map(h => String(h || '').trim());
  debug.push(`Cabeçalhos da aba "${sheetName}": ${headers.join(' | ')}`);
  debug.push(`Total de linhas de dados: ${json.length - 1}`);

  const rows: PrecoRow[] = [];

  // Formato "longo": uma coluna Data, uma Produto, uma Praça (opcional),
  // uma Preço/Valor — cada linha é um ponto de dado.
  const colData = findColumn(headers, [/^data$/i]);
  const colProduto = findColumn(headers, [/produto/i]);
  const colPraca = findColumn(headers, [/pra[çc]a|munic[ií]pio|regi[ãa]o/i]);
  const colPreco = findColumn(headers, [/pre[çc]o|valor/i]);

  if (colData !== -1 && colProduto !== -1 && colPreco !== -1) {
    debug.push(`Formato detectado: "longo" (data=${colData}, produto=${colProduto}, praça=${colPraca}, preço=${colPreco})`);
    for (const row of json.slice(1)) {
      const precoStr = row[colPreco];
      const preco = Number(String(precoStr || '').replace(',', '.'));
      if (row[colProduto] && preco > 0) {
        rows.push({
          data: String(row[colData] || ''),
          produto: String(row[colProduto] || '').trim(),
          praca: colPraca !== -1 ? String(row[colPraca] || '').trim() : undefined,
          preco,
        });
      }
    }
  } else if (colData !== -1) {
    // Formato "largo": uma coluna por produto — pega a ÚLTIMA linha
    // (data mais recente) e usa cada outra coluna como um produto.
    debug.push(`Formato detectado: "largo" (uma coluna por produto, data=${colData})`);
    const lastRow = json[json.length - 1];
    const dataStr = String(lastRow[colData] || '');
    headers.forEach((header, i) => {
      if (i === colData || !header) return;
      const preco = Number(String(lastRow[i] || '').replace(',', '.'));
      if (preco > 0) rows.push({ data: dataStr, produto: header, preco });
    });
  } else {
    debug.push('Não foi possível identificar as colunas esperadas (Data/Produto/Preço) — estrutura da planilha pode ser diferente do previsto.');
  }

  return { rows, sheetNames, headers };
}

export const onRequestGet: PagesFunction = async (context) => {
  const debug: string[] = [];
  try {
    const url = new URL(context.request.url);
    const showDebug = url.searchParams.has('debug');

    const res = await fetch(XLSX_URL, {
      headers: { 'User-Agent': BROWSER_UA },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Falha ao baixar a planilha da Epagri/Cepa (status ${res.status}).`, sourceUrl: XLSX_URL }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const buffer = await res.arrayBuffer();
    debug.push(`Arquivo baixado: ${(buffer.byteLength / 1024).toFixed(0)} KB`);

    const { rows, sheetNames, headers } = parseWorkbook(buffer, debug);

    if (rows.length === 0) {
      return new Response(JSON.stringify({
        error: 'Não foi possível extrair preços da planilha — a estrutura pode ser diferente do esperado. Veja "debug" para ajuste.',
        sourceUrl: XLSX_URL,
        debug,
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Filtra só Boi Gordo e Vaca Gorda, pegando a linha mais recente de
    // cada uma (última data disponível na planilha).
    const boiRows = rows.filter(r => /boi gordo/i.test(r.produto));
    const vacaRows = rows.filter(r => /vaca gorda/i.test(r.produto));
    const boiGordo = boiRows[boiRows.length - 1] || null;
    const vacaGorda = vacaRows[vacaRows.length - 1] || null;

    return new Response(JSON.stringify({
      boiGordo,
      vacaGorda,
      totalLinhasEncontradas: rows.length,
      sourceUrl: XLSX_URL,
      fetchedAt: new Date().toISOString(),
      debug: showDebug ? { sheetNames, headers, debugLog: debug, amostra: rows.slice(0, 5) } : undefined,
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': showDebug ? 'no-store' : 'public, max-age=1800' },
    });
  } catch (error: any) {
    console.error('epagri-sc error:', error);
    return new Response(JSON.stringify({
      error: 'Falha ao processar a planilha da Epagri/Cepa: ' + (error.message || String(error)),
      debug,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
