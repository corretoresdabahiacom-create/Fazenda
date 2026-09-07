// Busca as cotações comerciais de dólar, euro, iene, ouro e bitcoin em
// tempo real, via AwesomeAPI (economia.awesomeapi.com.br) — API pública
// brasileira, gratuita, sem necessidade de chave.
//
// IMPORTANTE sobre o erro 429 (QuotaExceeded): a AwesomeAPI limita o uso
// gratuito por IP, e como o Cloudflare Workers compartilha um conjunto de
// IPs de saída entre MUITOS projetos diferentes, essa cota compartilhada
// pode ser consumida por outros aplicativos, não só pelo nosso. Duas
// correções abaixo:
//   1) Cache de borda: guardamos a resposta por alguns minutos, então,
//      mesmo com muitos usuários abrindo a tela de Cotações ao mesmo
//      tempo, só fazemos UMA chamada real à AwesomeAPI por período —
//      isso já deve resolver o 429 na prática.
//   2) Suporte opcional a uma chave própria: se quiser eliminar de vez o
//      risco de cota compartilhada, crie uma conta grátis em
//      awesomeapi.com.br (até 100.000 requisições/mês sem custo) e cole
//      a chave na variável de ambiente AWESOMEAPI_TOKEN no Cloudflare
//      Pages — o código já usa automaticamente se estiver presente.

interface Env {
  AWESOMEAPI_TOKEN?: string;
}

const CACHE_TTL_SECONDS = 180; // 3 minutos

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cache = (caches as any).default;
  const cacheKey = new Request('https://cache.internal/cambio', context.request);

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const tokenParam = context.env.AWESOMEAPI_TOKEN ? `&token=${context.env.AWESOMEAPI_TOKEN}` : '';
    const res = await fetch(
      `https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,JPY-BRL,XAU-BRL,BTC-BRL?_=1${tokenParam}`,
    );

    const bodyText = await res.text();

    if (!res.ok) {
      const errorResponse = new Response(
        JSON.stringify({ error: `Falha ao buscar câmbio (status ${res.status}): ${bodyText.slice(0, 300)}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
      return errorResponse; // erros não ficam em cache, pra tentar de novo na próxima chamada
    }

    let data: Record<string, any>;
    try {
      data = JSON.parse(bodyText);
    } catch {
      return new Response(JSON.stringify({ error: 'Resposta inesperada do serviço de câmbio (não veio em JSON).' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const format = (entry: any) => entry ? {
      compra: Number(entry.bid),
      venda: Number(entry.ask),
      variacaoPct: Number(entry.pctChange),
      atualizadoEm: entry.create_date,
    } : null;

    const response = new Response(JSON.stringify({
      usd: format(data.USDBRL),
      eur: format(data.EURBRL),
      jpy: format(data.JPYBRL),
      xau: format(data.XAUBRL),
      btc: format(data.BTCBRL),
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
      },
    });

    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error: any) {
    console.error('cambio error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao buscar câmbio: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
