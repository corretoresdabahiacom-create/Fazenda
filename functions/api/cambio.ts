// Busca as cotações comerciais de dólar, euro, iene, ouro e bitcoin em
// tempo real, via AwesomeAPI (economia.awesomeapi.com.br) — API pública
// brasileira, gratuita, sem necessidade de chave.

export const onRequestGet: PagesFunction = async () => {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,JPY-BRL,XAU-BRL,BTC-BRL');

    const bodyText = await res.text();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Falha ao buscar câmbio (status ${res.status}): ${bodyText.slice(0, 300)}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
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

    return new Response(JSON.stringify({
      usd: format(data.USDBRL),
      eur: format(data.EURBRL),
      jpy: format(data.JPYBRL),
      xau: format(data.XAUBRL),
      btc: format(data.BTCBRL),
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120' },
    });
  } catch (error: any) {
    console.error('cambio error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao buscar câmbio: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
