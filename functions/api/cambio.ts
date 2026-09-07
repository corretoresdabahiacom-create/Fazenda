// Busca as cotações comerciais de dólar, euro e iene em tempo real, via
// AwesomeAPI (economia.awesomeapi.com.br) — API pública brasileira,
// gratuita, sem necessidade de chave.

export const onRequestGet: PagesFunction = async () => {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,JPY-BRL', {
      headers: { 'User-Agent': 'AgroGestao/1.0' },
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Falha ao buscar câmbio.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const data = (await res.json()) as Record<string, any>;

    const format = (entry: any) => entry ? {
      compra: Number(entry.bid),
      venda: Number(entry.ask),
      variacaoPct: Number(entry.pctChange),
      atualizadoEm: entry.create_date,
    } : null;

    return new Response(JSON.stringify({
      usd: format(data.USDBRL),
      eur: format(data.EURBRL),
      jpy: format(data.JPYBRL),
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Falha ao buscar câmbio: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
