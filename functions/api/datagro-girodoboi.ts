// Busca o Indicador do Boi Gordo DATAGRO (fonte PAGA) redistribuído de
// graça pelo Giro do Boi / Canal Rural, em notícias diárias que citam
// o valor da arroba por estado. Confirmado por observação real: o
// Datagro cobre 10 estados (SP, BA, GO, MG, MS, MT, PA, RO, TO, RS) e
// o Canal Rural publica esses valores em texto normal (não gráfico
// JavaScript) nas notícias do dia.
//
// COMO FUNCIONA (2 passos, pra sempre achar a notícia certa do dia):
// 1. Busca o feed RSS de pesquisa do Giro do Boi por "indicador boi
//    gordo datagro" — URL estável e previsível, sempre traz a notícia
//    mais recente primeiro.
// 2. Abre a notícia mais recente e extrai o valor de cada estado do
//    texto, procurando o nome do estado seguido de um valor "R$ XXX,XX"
//    dentro de uma janela de 150 caracteres.
//
// LIMITAÇÃO HONESTA: como é extração de texto corrido (não tabela),
// nem sempre a notícia do dia menciona TODOS os 10 estados — só entra
// no resultado o que for encontrado com confiança; nunca inventa valor
// pra um estado que a notícia não citou.

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const ESTADOS_REGEX: Record<string, RegExp> = {
  'São Paulo': /s[ãa]o paulo/i,
  'Bahia': /\bbahia\b/i,
  'Goiás': /goi[áa]s/i,
  'Minas Gerais': /minas gerais/i,
  'Mato Grosso do Sul': /mato grosso do sul/i,
  'Mato Grosso': /\bmato grosso\b(?! do sul)/i,
  'Pará': /\bpar[áa]\b(?! de|iso)/i,
  'Rondônia': /rond[ôo]nia/i,
  'Tocantins': /tocantins/i,
  'Rio Grande do Sul': /rio grande do sul/i,
};

function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function extrairPrecosPorEstado(texto: string): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const [estado, regex] of Object.entries(ESTADOS_REGEX)) {
    const match = regex.exec(texto);
    if (!match) continue;
    const janela = texto.slice(match.index, match.index + 150);
    const precoMatch = janela.match(/R\$\s*(\d{2,3},\d{2})/);
    if (precoMatch) resultado[estado] = precoMatch[1];
  }
  return resultado;
}

export const onRequestGet: PagesFunction = async () => {
  try {
    // Passo 1: RSS de busca pra achar a notícia mais recente.
    const rssUrl = 'https://girodoboi.canalrural.com.br/search/indicador+boi+gordo+datagro/feed/rss2/';
    const rssRes = await fetch(rssUrl, { headers: { 'User-Agent': BROWSER_UA } });
    if (!rssRes.ok) {
      return new Response(JSON.stringify({ error: `Falha ao buscar o feed do Giro do Boi (status ${rssRes.status}).`, sourceUrl: rssUrl }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }
    const rssXml = await rssRes.text();
    const primeiroItemMatch = rssXml.match(/<item>([\s\S]*?)<\/item>/i);
    if (!primeiroItemMatch) {
      return new Response(JSON.stringify({ error: 'Nenhuma notícia recente encontrada no feed do Giro do Boi.', sourceUrl: rssUrl }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }
    const linkMatch = primeiroItemMatch[1].match(/<link>(.*?)<\/link>/i);
    const tituloMatch = primeiroItemMatch[1].match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
    const artigoUrl = linkMatch?.[1]?.trim();
    if (!artigoUrl) {
      return new Response(JSON.stringify({ error: 'Não foi possível identificar a URL da notícia mais recente.', sourceUrl: rssUrl }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Passo 2: abre a notícia e extrai os valores por estado.
    const artigoRes = await fetch(artigoUrl, { headers: { 'User-Agent': BROWSER_UA } });
    if (!artigoRes.ok) {
      return new Response(JSON.stringify({ error: `Falha ao abrir a notícia (status ${artigoRes.status}).`, sourceUrl: artigoUrl }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }
    const artigoHtml = await artigoRes.text();
    const textoLimpo = stripTags(artigoHtml);
    const precos = extrairPrecosPorEstado(textoLimpo);

    if (Object.keys(precos).length === 0) {
      return new Response(JSON.stringify({ error: 'Notícia encontrada, mas não foi possível extrair valores por estado dela.', sourceUrl: artigoUrl, titulo: tituloMatch?.[1] }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      precos, // { "São Paulo": "310,59", "Bahia": "312,72", ... }
      titulo: tituloMatch?.[1] || null,
      sourceUrl: artigoUrl,
      fonteOriginal: 'Datagro (via redistribuição gratuita do Canal Rural/Giro do Boi)',
      avisoCobertura: `Encontrados ${Object.keys(precos).length} de até 10 estados possíveis — a notícia do dia nem sempre cita todos.`,
      fetchedAt: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800' },
    });
  } catch (error: any) {
    console.error('datagro-girodoboi error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao buscar Datagro via Giro do Boi: ' + (error.message || String(error)) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
