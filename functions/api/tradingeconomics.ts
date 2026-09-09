// Busca cotações reais e gratuitas na TradingEconomics.com — site
// americano que disponibiliza de graça, na própria página pública, o
// preço do contrato de referência do "Beef" (Boi Gordo, negociado na B3,
// em R$/@ = R$/15kg), além de Feeder Cattle (aproximação de
// Novilho/Garrote), Lean Hogs (Suínos) e Poultry (Frango). O produto
// pago da TradingEconomics é a API/exportação em massa — a página
// pública com o valor atual é livre.

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// Mapeia nosso produto interno pro slug da página da TradingEconomics —
// só Boi Gordo por enquanto, já que confirmamos a unidade exata (R$/@)
// nessa página; Suínos/Frango aparecem lá também mas sem confirmação
// clara da moeda usada, então preferimos não arriscar mostrar errado.
const TE_SLUGS: Record<string, { slug: string; nomeExibido: string; unidade: string }> = {
  boi_gordo: { slug: 'beef', nomeExibido: 'Boi Gordo (indicador B3 via TradingEconomics)', unidade: 'R$/@ (15kg)' },
};

function parseActualPrice(html: string): number | null {
  // A página mostra "Actual" seguido do valor logo depois, e também uma
  // meta-description com o valor por extenso — tenta os dois formatos.
  const metaMatch = html.match(/(?:rose to|fell to)\s+([\d.,]+)\s*BRL/i) || html.match(/(?:rose to|fell to)\s+([\d.,]+)/i);
  if (metaMatch) {
    const num = Number(metaMatch[1].replace(/,/g, ''));
    if (num > 0) return num;
  }
  return null;
}

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const produto = url.searchParams.get('produto') || '';
    const config = TE_SLUGS[produto];

    if (!config) {
      return new Response(JSON.stringify({ error: 'Produto sem mapeamento na TradingEconomics.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sourceUrl = `https://tradingeconomics.com/commodity/${config.slug}`;
    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Falha ao buscar TradingEconomics (status ${res.status}).`, sourceUrl }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = await res.text();
    const preco = parseActualPrice(html);

    if (!preco) {
      return new Response(JSON.stringify({ error: 'Preço não encontrado na página da TradingEconomics.', sourceUrl }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      produto,
      nomeExibido: config.nomeExibido,
      preco,
      unidade: config.unidade,
      sourceUrl,
      fetchedAt: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900' },
    });
  } catch (error: any) {
    console.error('tradingeconomics error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao buscar TradingEconomics: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
