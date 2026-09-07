// Busca câmbio comercial (Dólar, Euro, Iene) direto do Banco Central do
// Brasil — API PTAX oficial (olinda.bcb.gov.br), sem limite de uso, sem
// necessidade de chave, e muito mais confiável que APIs de terceiros.
// Ouro e Bitcoin (que o Banco Central não cobre) continuam vindo da
// AwesomeAPI, como informação extra — se falhar, só esses dois ficam
// indisponíveis, sem derrubar dólar/euro/iene. O Dólar Futuro (B3) vem
// do mesmo Notícias Agrícolas usado nas cotações agropecuárias.

interface Env {
  AWESOMEAPI_TOKEN?: string;
}

interface CambioEntry {
  compra: number;
  venda: number;
  variacaoPct: number;
  atualizadoEm: string;
}

function toMMDDYYYY(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
}

// PTAX não tem cotação em fins de semana/feriados — tenta hoje e vai
// voltando dia a dia até achar (no máximo 7 tentativas).
async function fetchPtax(moeda: 'USD' | 'EUR' | 'JPY'): Promise<CambioEntry | null> {
  const endpoint = moeda === 'USD'
    ? (dateStr: string) => `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao='${dateStr}')?$top=10&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao,tipoBoletim`
    : (dateStr: string) => `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda='${moeda}',dataCotacao='${dateStr}')?$top=10&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao,tipoBoletim`;

  let previousDayCompra: number | null = null;

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = toMMDDYYYY(d);

    try {
      const res = await fetch(endpoint(dateStr));
      if (!res.ok) continue;
      const data = (await res.json()) as { value?: any[] };
      const values = data.value || [];
      if (values.length === 0) continue;

      // Prioriza o boletim de "Fechamento" (fim do dia); se não tiver
      // ainda hoje, usa o último disponível.
      const fechamento = values.find(v => v.tipoBoletim === 'Fechamento') || values[values.length - 1];
      const compra = Number(fechamento.cotacaoCompra);
      const venda = Number(fechamento.cotacaoVenda);

      const variacaoPct = previousDayCompra
        ? Number((((compra - previousDayCompra) / previousDayCompra) * 100).toFixed(2))
        : 0;

      return {
        compra,
        venda,
        variacaoPct,
        atualizadoEm: fechamento.dataHoraCotacao,
      };
    } catch {
      continue;
    }
  }
  return null;
}

// Busca o Dólar Futuro negociado na B3, a partir da mesma fonte usada
// para as cotações agropecuárias (tabela "BRASIL (B3)" da página inicial
// de cotações do Notícias Agrícolas).
async function fetchDolarFuturoB3(): Promise<{ valor: string; vencimento: string } | null> {
  try {
    const res = await fetch('https://www.noticiasagricolas.com.br/cotacoes', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Procura a linha da tabela que menciona "Dólar" perto de "B3" — o
    // HTML da tabela resumo tem o padrão <td>Dólar Fut</td>...<td>valor</td>
    const match = html.match(/D[oó]lar\s*Fut[^<]*<\/t[dh]>\s*<t[dh][^>]*>([^<]+)<\/t[dh]>\s*<t[dh][^>]*>([^<]*)<\/t[dh]>/i);
    if (!match) return null;
    return { valor: match[1].trim(), vencimento: match[2]?.trim() || '' };
  } catch {
    return null;
  }
}

async function fetchAwesomeApiExtra(env: Env): Promise<{ xau: CambioEntry | null; btc: CambioEntry | null }> {
  try {
    const tokenParam = env.AWESOMEAPI_TOKEN ? `&token=${env.AWESOMEAPI_TOKEN}` : '';
    const res = await fetch(`https://economia.awesomeapi.com.br/json/last/XAU-BRL,BTC-BRL${tokenParam}`);
    if (!res.ok) return { xau: null, btc: null };
    const data = (await res.json()) as Record<string, any>;
    const format = (entry: any): CambioEntry | null => entry ? {
      compra: Number(entry.bid),
      venda: Number(entry.ask),
      variacaoPct: Number(entry.pctChange),
      atualizadoEm: entry.create_date,
    } : null;
    return { xau: format(data.XAUBRL), btc: format(data.BTCBRL) };
  } catch {
    return { xau: null, btc: null };
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cache = (caches as any).default;
  const cacheKey = new Request('https://cache.internal/cambio-v2', context.request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const [usd, eur, jpy, extra, dolarFuturo] = await Promise.all([
      fetchPtax('USD'),
      fetchPtax('EUR'),
      fetchPtax('JPY'),
      fetchAwesomeApiExtra(context.env),
      fetchDolarFuturoB3(),
    ]);

    if (!usd && !eur && !jpy) {
      return new Response(JSON.stringify({ error: 'Não foi possível buscar o câmbio no Banco Central agora. Tente novamente em instantes.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = new Response(JSON.stringify({
      usd, eur, jpy,
      xau: extra.xau,
      btc: extra.btc,
      dolarFuturoB3: dolarFuturo,
      fonte: 'Banco Central do Brasil (PTAX) — Ouro/Bitcoin via AwesomeAPI, Dólar Futuro via B3/Notícias Agrícolas',
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=180' },
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
