// Busca cotações reais e diárias da AIBA — Associação de Agricultores e
// Irrigantes da Bahia, entidade de produtores do Oeste Baiano (sede em
// Barreiras-BA). Confirmado por teste direto: a página é renderizada no
// servidor (WordPress), com preços reais e atualizados diariamente —
// não requer JavaScript para ver os valores atuais.
//
// ESCOPO GEOGRÁFICO: Oeste da Bahia especificamente (não é indicador
// nacional) — cobre Soja Disponível, Soja Balcão, Arroz em Casca,
// Sorgo, Milho, Café, Feijão Carioca, Milheto, Algodão Pluma e Caroço
// de Algodão.
//
// TÉCNICA: a página não usa tabelas HTML tradicionais — cada produto é
// um bloco de texto (nome, unidade, preço, variação+data em sequência).
// Extraímos removendo todas as tags e procurando esse padrão repetido
// no texto puro resultante — testado contra uma estrutura sintética
// equivalente à real antes de implementar.

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

interface AibaRow { produto: string; unidade: string; preco: string; variacaoPct: string; data: string }

function extractLines(html: string): string[] {
  // Remove scripts/estilos inteiros primeiro (não queremos texto de JS/CSS misturado).
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  return cleaned
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#9660;|&#9650;|&#8226;|▼|▲|•/g, '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

function parseCotacoes(html: string): AibaRow[] {
  const lines = extractLines(html);
  const rows: AibaRow[] = [];
  const unidadeRe = /^(saca\s*60kg|arroba\s*\(@\)|tonelada|@|kg|ton)$/i;
  const precoRe = /^R\$\s*[\d.,]+$/i;
  const dataRe = /(\d{2}\/\d{2}\/\d{4})/;
  const pctRe = /([+-]?\d+[.,]\d+)%/;

  for (let i = 0; i < lines.length; i++) {
    if (precoRe.test(lines[i]) && i >= 2 && unidadeRe.test(lines[i - 1])) {
      const preco = lines[i].replace(/R\$\s*/i, '').trim();
      const unidade = lines[i - 1];
      const nome = lines[i - 2];
      const nextLine = lines[i + 1] || '';
      const dataMatch = nextLine.match(dataRe);
      const pctMatch = nextLine.match(pctRe);
      if (nome && preco) {
        rows.push({
          produto: nome,
          unidade,
          preco,
          variacaoPct: pctMatch ? pctMatch[1] : '0,00',
          data: dataMatch ? dataMatch[1] : '',
        });
      }
    }
  }
  return rows;
}

export const onRequestGet: PagesFunction = async () => {
  try {
    const sourceUrl = 'https://aiba.org.br/cotacoes/';
    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Falha ao buscar AIBA (status ${res.status}).`, sourceUrl }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = await res.text();
    const rows = parseCotacoes(html);

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Cotações da AIBA não encontradas na página no momento — estrutura pode ter mudado.', sourceUrl }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      rows,
      regiao: 'Oeste da Bahia',
      sourceUrl,
      fetchedAt: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900' },
    });
  } catch (error: any) {
    console.error('aiba-ba error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao buscar cotações da AIBA: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
