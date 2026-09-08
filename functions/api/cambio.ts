// Busca câmbio comercial (Dólar, Euro, Iene, Ouro, Bitcoin) com cadeia de
// fontes de reserva: se a fonte principal falhar, tenta automaticamente
// uma segunda fonte, para nunca depender de um único provedor instável.
// Também devolve detalhes de erro por moeda em "debug" (acrescente
// ?debug=1 na URL para forçar atualização sem cache e ver os detalhes),
// para facilitar diagnosticar se algo falhar de novo.

interface Env {
  AWESOMEAPI_TOKEN?: string;
}

interface CambioEntry {
  compra: number;
  venda: number;
  variacaoPct: number;
  atualizadoEm: string;
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function toMMDDYYYY(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
}

async function fetchAwesomeApi(env: Env, pairs: string): Promise<Record<string, any> | { __error: string }> {
  try {
    const tokenParam = env.AWESOMEAPI_TOKEN ? `&token=${env.AWESOMEAPI_TOKEN}` : '';
    const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${pairs}${tokenParam}`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    });
    const text = await res.text();
    if (!res.ok) return { __error: `AwesomeAPI HTTP ${res.status}: ${text.slice(0, 200)}` };
    return JSON.parse(text);
  } catch (e: any) {
    return { __error: `AwesomeAPI exception: ${e?.message || String(e)}` };
  }
}

function formatAwesome(entry: any): CambioEntry | null {
  if (!entry || entry.__error) return null;
  return {
    compra: Number(entry.bid),
    venda: Number(entry.ask),
    variacaoPct: Number(entry.pctChange),
    atualizadoEm: entry.create_date,
  };
}

async function fetchMoeda(env: Env, moeda: 'USD' | 'EUR' | 'JPY', debug: string[]): Promise<CambioEntry | null> {
  function buildUrls(dateStr: string): string[] {
    if (moeda === 'USD') {
      return [
        `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao='${dateStr}')?$top=10&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao,tipoBoletim`,
        `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dateStr}'&$top=10&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao,tipoBoletim`,
      ];
    }
    return [
      `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda='${moeda}',dataCotacao='${dateStr}')?$top=10&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao,tipoBoletim`,
      `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='${moeda}'&@dataCotacao='${dateStr}'&$top=10&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao,tipoBoletim`,
    ];
  }

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = toMMDDYYYY(d);

    for (const url of buildUrls(dateStr)) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' } });
        if (!res.ok) {
          debug.push(`BCB ${moeda} ${dateStr}: HTTP ${res.status}`);
          continue;
        }
        const data = (await res.json()) as { value?: any[] };
        const values = data.value || [];
        if (values.length === 0) continue;

        const fechamento = values.find(v => v.tipoBoletim === 'Fechamento') || values[values.length - 1];
        const compra = Number(fechamento.cotacaoCompra);
        const venda = Number(fechamento.cotacaoVenda);
        if (!compra || !venda) continue;

        return { compra, venda, variacaoPct: 0, atualizadoEm: fechamento.dataHoraCotacao };
      } catch (e: any) {
        debug.push(`BCB ${moeda} ${dateStr}: ${e?.message || String(e)}`);
        continue;
      }
    }
  }

  debug.push(`BCB falhou para ${moeda} em todas as tentativas — usando reserva AwesomeAPI.`);
  const awesome = await fetchAwesomeApi(env, `${moeda}-BRL`);
  if ('__error' in awesome) {
    debug.push(`Reserva AwesomeAPI para ${moeda}: ${awesome.__error}`);
    return null;
  }
  const entry = formatAwesome(awesome[`${moeda}BRL`]);
  if (!entry) debug.push(`Reserva AwesomeAPI para ${moeda}: resposta sem dados utilizáveis.`);
  return entry;
}

async function fetchBitcoin(env: Env, debug: string[]): Promise<CambioEntry | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_24hr_change=true',
      { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' } },
    );
    if (res.ok) {
      const data = (await res.json()) as any;
      const brl = data?.bitcoin?.brl;
      if (brl) {
        return {
          compra: Number(brl),
          venda: Number(brl),
          variacaoPct: Number((data.bitcoin.brl_24h_change || 0).toFixed(2)),
          atualizadoEm: new Date().toISOString(),
        };
      }
      debug.push('CoinGecko BTC: resposta sem campo bitcoin.brl.');
    } else {
      debug.push(`CoinGecko BTC: HTTP ${res.status}`);
    }
  } catch (e: any) {
    debug.push(`CoinGecko BTC: ${e?.message || String(e)}`);
  }

  const awesome = await fetchAwesomeApi(env, 'BTC-BRL');
  if ('__error' in awesome) {
    debug.push(`Reserva AwesomeAPI para BTC: ${awesome.__error}`);
    return null;
  }
  return formatAwesome(awesome.BTCBRL);
}

async function fetchGold(env: Env, usdBrl: CambioEntry | null, debug: string[]): Promise<CambioEntry | null> {
  const GRAMS_PER_TROY_OUNCE = 31.1035;

  if (usdBrl) {
    try {
      const res = await fetch('https://stooq.com/q/l/?s=xauusd&f=sd2t2c&h&e=csv', {
        headers: { 'User-Agent': BROWSER_UA },
      });
      if (res.ok) {
        const csv = await res.text();
        const lines = csv.trim().split('\n');
        const cols = lines[1]?.split(',') || [];
        const closeUsdPerOz = Number(cols[3]);
        if (closeUsdPerOz > 0) {
          const usdPerGram = closeUsdPerOz / GRAMS_PER_TROY_OUNCE;
          const brlPerGram = usdPerGram * usdBrl.venda;
          return {
            compra: Number((brlPerGram * 0.98).toFixed(2)),
            venda: Number(brlPerGram.toFixed(2)),
            variacaoPct: 0,
            atualizadoEm: new Date().toISOString(),
          };
        }
        debug.push(`Stooq XAUUSD: valor inválido na resposta (${csv.slice(0, 100)}).`);
      } else {
        debug.push(`Stooq XAUUSD: HTTP ${res.status}`);
      }
    } catch (e: any) {
      debug.push(`Stooq XAUUSD: ${e?.message || String(e)}`);
    }
  } else {
    debug.push('Ouro: pulou cálculo via Stooq porque o dólar não foi obtido.');
  }

  const awesome = await fetchAwesomeApi(env, 'XAU-BRL');
  if ('__error' in awesome) {
    debug.push(`Reserva AwesomeAPI para XAU: ${awesome.__error}`);
    return null;
  }
  const entry = awesome.XAUBRL;
  if (!entry) {
    debug.push('Reserva AwesomeAPI para XAU: resposta sem dados utilizáveis.');
    return null;
  }
  return {
    compra: Number((Number(entry.bid) / GRAMS_PER_TROY_OUNCE).toFixed(2)),
    venda: Number((Number(entry.ask) / GRAMS_PER_TROY_OUNCE).toFixed(2)),
    variacaoPct: Number(entry.pctChange),
    atualizadoEm: entry.create_date,
  };
}

async function fetchDolarFuturoB3(): Promise<{ valor: string; vencimento: string } | null> {
  try {
    const res = await fetch('https://www.noticiasagricolas.com.br/cotacoes', {
      headers: { 'User-Agent': BROWSER_UA },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/D[oó]lar\s*Fut[^<]*<\/t[dh]>\s*<t[dh][^>]*>([^<]+)<\/t[dh]>\s*<t[dh][^>]*>([^<]*)<\/t[dh]>/i);
    if (!match) return null;
    return { valor: match[1].trim(), vencimento: match[2]?.trim() || '' };
  } catch {
    return null;
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cache = (caches as any).default;
  const cacheKey = new Request('https://cache.internal/cambio-v3', context.request);
  const forceRefresh = new URL(context.request.url).searchParams.has('debug');

  if (!forceRefresh) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const debug: string[] = [];

  try {
    const [usd, eur, jpy, dolarFuturo] = await Promise.all([
      fetchMoeda(context.env, 'USD', debug),
      fetchMoeda(context.env, 'EUR', debug),
      fetchMoeda(context.env, 'JPY', debug),
      fetchDolarFuturoB3(),
    ]);

    const [btc, xau] = await Promise.all([
      fetchBitcoin(context.env, debug),
      fetchGold(context.env, usd, debug),
    ]);

    const response = new Response(JSON.stringify({
      usd, eur, jpy, xau, btc,
      dolarFuturoB3: dolarFuturo,
      fonte: 'Banco Central (PTAX) + AwesomeAPI de reserva — Bitcoin via CoinGecko, Ouro via Stooq+câmbio BCB',
      debug: debug.length > 0 ? debug : undefined,
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': forceRefresh ? 'no-store' : 'public, max-age=180' },
    });

    if (!forceRefresh) context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error: any) {
    console.error('cambio error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao buscar câmbio: ' + (error.message || String(error)), debug }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
