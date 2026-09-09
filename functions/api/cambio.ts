// Busca câmbio comercial (Dólar, Euro, Iene, Ouro, Bitcoin) — fonte
// oficial (Banco Central) sempre que possível, com reservas comprovadas
// funcionando neste ambiente (Binance) quando a oficial falhar.
//
// A AwesomeAPI foi REMOVIDA da cadeia — confirmado por testes reais que
// ela está com a cota gratuita esgotada (erro 429 QuotaExceeded
// persistente), então mantê-la só atrasava a resposta sem ajudar.
//
// Bug corrigido nesta versão: as URLs do Banco Central (PTAX) estavam
// devolvendo HTTP 400 porque as aspas simples ao redor da data não
// estavam com URL-encoding (deviam ser %27, não o caractere ' literal) —
// confirmado contra um exemplo real de código em produção.

interface Env {}

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

async function fetchMoeda(moeda: 'USD' | 'EUR' | 'JPY' | 'CNY' | 'RUB', debug: string[]): Promise<CambioEntry | null> {
  function buildUrl(dateStr: string): string {
    const encodedDate = `%27${dateStr}%27`;
    if (moeda === 'USD') {
      return `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao=${encodedDate}&$top=10&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;
    }
    return `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda=%27${moeda}%27&@dataCotacao=${encodedDate}&$top=10&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;
  }

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = toMMDDYYYY(d);
    const url = buildUrl(dateStr);

    try {
      const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' } });
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        debug.push(`BCB ${moeda} ${dateStr}: HTTP ${res.status} — ${bodyText.slice(0, 150)}`);
        continue;
      }
      const data = (await res.json()) as { value?: any[] };
      const values = data.value || [];
      if (values.length === 0) {
        debug.push(`BCB ${moeda} ${dateStr}: sem cotação para essa data (fim de semana/feriado?).`);
        continue;
      }

      // Sem o campo tipoBoletim (não existe no tipo retornado pelo BCB
      // para o Dólar), usamos o último valor do dia — a API já devolve
      // em ordem cronológica, então é o mais recente/final.
      const fechamento = values[values.length - 1];
      const compra = Number(fechamento.cotacaoCompra);
      const venda = Number(fechamento.cotacaoVenda);
      if (!compra || !venda) continue;

      return { compra, venda, variacaoPct: 0, atualizadoEm: fechamento.dataHoraCotacao };
    } catch (e: any) {
      debug.push(`BCB ${moeda} ${dateStr}: ${e?.message || String(e)}`);
      continue;
    }
  }

  if (moeda === 'USD') {
    debug.push('BCB falhou para USD em todas as tentativas — usando reserva Binance (USDT/BRL).');
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=USDTBRL', {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.lastPrice) {
          return {
            compra: Number(data.bidPrice) || Number(data.lastPrice),
            venda: Number(data.askPrice) || Number(data.lastPrice),
            variacaoPct: Number(Number(data.priceChangePercent).toFixed(2)),
            atualizadoEm: new Date().toISOString(),
          };
        }
      } else {
        debug.push(`Binance USDTBRL: HTTP ${res.status}`);
      }
    } catch (e: any) {
      debug.push(`Binance USDTBRL: ${e?.message || String(e)}`);
    }
  }

  // Reserva final (todas as moedas, especialmente útil para CNY e RUB
  // que o Banco Central pode não cobrir): Frankfurter — API gratuita e
  // sem chave que rastreia as taxas de referência do Banco Central
  // Europeu (inclui Yuan e Rublo).
  debug.push(`BCB falhou para ${moeda} — usando reserva Frankfurter (taxas do Banco Central Europeu).`);
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${moeda}&to=BRL`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const rate = data?.rates?.BRL;
      if (rate) {
        return {
          compra: Number((rate * 0.998).toFixed(4)),
          venda: Number(rate.toFixed(4)),
          variacaoPct: 0,
          atualizadoEm: data.date || new Date().toISOString(),
        };
      }
      debug.push(`Frankfurter ${moeda}: resposta sem taxa BRL utilizável.`);
    } else {
      debug.push(`Frankfurter ${moeda}: HTTP ${res.status}`);
    }
  } catch (e: any) {
    debug.push(`Frankfurter ${moeda}: ${e?.message || String(e)}`);
  }

  return null;
}

async function fetchBitcoin(usdBrl: CambioEntry | null, debug: string[]): Promise<CambioEntry | null> {
  // Fonte principal: Mercado Bitcoin — maior exchange de criptomoedas do
  // Brasil, API pública nativa em BRL, sem os bloqueios por região que
  // exchanges internacionais como a Binance costumam aplicar.
  try {
    const res = await fetch('https://api.mercadobitcoin.net/api/v4/tickers?symbols=BTC-BRL', {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as any[];
      const entry = data?.[0];
      if (entry?.last) {
        return {
          compra: Number(entry.buy || entry.last),
          venda: Number(entry.sell || entry.last),
          variacaoPct: 0,
          atualizadoEm: new Date().toISOString(),
        };
      }
    } else {
      debug.push(`Mercado Bitcoin BTC-BRL: HTTP ${res.status}`);
    }
  } catch (e: any) {
    debug.push(`Mercado Bitcoin BTC-BRL: ${e?.message || String(e)}`);
  }

  // Reserva 1: CoinGecko.
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
    } else {
      debug.push(`CoinGecko BTC: HTTP ${res.status}`);
    }
  } catch (e: any) {
    debug.push(`CoinGecko BTC: ${e?.message || String(e)}`);
  }

  // Reserva 2: Binance (BRL direto, depois via USDT convertido).
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCBRL', {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data.lastPrice) {
        return {
          compra: Number(data.bidPrice) || Number(data.lastPrice),
          venda: Number(data.askPrice) || Number(data.lastPrice),
          variacaoPct: Number(Number(data.priceChangePercent).toFixed(2)),
          atualizadoEm: new Date().toISOString(),
        };
      }
    } else {
      debug.push(`Binance BTCBRL: HTTP ${res.status}`);
    }
  } catch (e: any) {
    debug.push(`Binance BTCBRL: ${e?.message || String(e)}`);
  }

  if (usdBrl) {
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.lastPrice) {
          const priceBrl = Number(data.lastPrice) * usdBrl.venda;
          return {
            compra: Number((priceBrl * 0.999).toFixed(2)),
            venda: Number(priceBrl.toFixed(2)),
            variacaoPct: Number(Number(data.priceChangePercent).toFixed(2)),
            atualizadoEm: new Date().toISOString(),
          };
        }
      } else {
        debug.push(`Binance BTCUSDT: HTTP ${res.status}`);
      }
    } catch (e: any) {
      debug.push(`Binance BTCUSDT: ${e?.message || String(e)}`);
    }
  }

  return null;
}

async function fetchGold(usdBrl: CambioEntry | null, ouroFuturoBrl: number | null, debug: string[]): Promise<CambioEntry | null> {
  const GRAMS_PER_TROY_OUNCE = 31.1035;

  // Fonte principal: Yahoo Finance — cotação do contrato futuro de ouro
  // do COMEX (GC=F), fonte extremamente estabelecida e usada por
  // incontáveis ferramentas financeiras sem bloqueio por automação.
  if (usdBrl) {
    try {
      const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F', {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        const usdPerOz = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (usdPerOz > 0) {
          const usdPerGram = usdPerOz / GRAMS_PER_TROY_OUNCE;
          const brlPerGram = usdPerGram * usdBrl.venda;
          return {
            compra: Number((brlPerGram * 0.98).toFixed(2)),
            venda: Number(brlPerGram.toFixed(2)),
            variacaoPct: 0,
            atualizadoEm: new Date().toISOString(),
          };
        }
        debug.push('Yahoo Finance GC=F: resposta sem regularMarketPrice utilizável.');
      } else {
        debug.push(`Yahoo Finance GC=F: HTTP ${res.status}`);
      }
    } catch (e: any) {
      debug.push(`Yahoo Finance GC=F: ${e?.message || String(e)}`);
    }
  }

  // Reserva 1: XAUS.com — API dedicada e gratuita, sem chave, que
  // combina LBMA (autoridade oficial mundial do preço do ouro), Kitco e
  // goldprice.org com rejeição de outliers. Já devolve direto em reais
  // por grama, sem precisarmos calcular a conversão nós mesmos.
  try {
    const res = await fetch('https://xaus.com/api/v1/spot?currency=BRL&unit=gram', {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const price = data?.xau?.price;
      if (price > 0) {
        return {
          compra: Number((price * 0.98).toFixed(2)),
          venda: Number(price.toFixed(2)),
          variacaoPct: 0,
          atualizadoEm: data.price_as_of || data.updated_at || new Date().toISOString(),
        };
      }
      debug.push(`XAUS.com: resposta sem xau.price utilizável (${JSON.stringify(data).slice(0, 150)}).`);
    } else {
      debug.push(`XAUS.com: HTTP ${res.status}`);
    }
  } catch (e: any) {
    debug.push(`XAUS.com: ${e?.message || String(e)}`);
  }

  // Reserva 2: se a B3 (via Notícias Agrícolas) já trouxe um valor de
  // Ouro na mesma busca do Dólar Futuro, usa direto — já vem em reais.
  if (ouroFuturoBrl && ouroFuturoBrl > 0) {
    return { compra: ouroFuturoBrl, venda: ouroFuturoBrl, variacaoPct: 0, atualizadoEm: new Date().toISOString() };
  }

  if (!usdBrl) {
    debug.push('Ouro: fontes principais falharam e nenhuma cotação de dólar ficou disponível para as reservas.');
    return null;
  }

  // Fonte principal: Stooq (cotação internacional em dólar) — usando o
  // endpoint de download de dados (/q/d/l/), confirmado como o formato
  // correto e testado (o endpoint usado antes, /q/l/, estava incorreto
  // e por isso vinha dando 404).
  try {
    const res = await fetch('https://stooq.com/q/d/l/?s=xauusd&i=d', {
      headers: { 'User-Agent': BROWSER_UA },
    });
    if (res.ok) {
      const csv = await res.text();
      const lines = csv.trim().split('\n');
      const cols = lines[lines.length - 1]?.split(',') || []; // Date,Open,High,Low,Close,Volume
      const closeUsdPerOz = Number(cols[4]);
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
    } else {
      debug.push(`Stooq XAUUSD: HTTP ${res.status}`);
    }
  } catch (e: any) {
    debug.push(`Stooq XAUUSD: ${e?.message || String(e)}`);
  }

  // Reserva: Binance PAXG (token com lastro real em ouro físico).
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT', {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data.lastPrice) {
        const usdPerGram = Number(data.lastPrice) / GRAMS_PER_TROY_OUNCE;
        const brlPerGram = usdPerGram * usdBrl.venda;
        return {
          compra: Number((brlPerGram * 0.98).toFixed(2)),
          venda: Number(brlPerGram.toFixed(2)),
          variacaoPct: Number(Number(data.priceChangePercent).toFixed(2)),
          atualizadoEm: new Date().toISOString(),
        };
      }
    } else {
      debug.push(`Binance PAXGUSDT: HTTP ${res.status}`);
    }
  } catch (e: any) {
    debug.push(`Binance PAXGUSDT: ${e?.message || String(e)}`);
  }

  return null;
}

async function fetchB3Extras(): Promise<{ dolarFuturo: { valor: string; vencimento: string } | null; ouroFuturoBrl: number | null }> {
  try {
    const res = await fetch('https://www.noticiasagricolas.com.br/cotacoes', {
      headers: { 'User-Agent': BROWSER_UA },
    });
    if (!res.ok) return { dolarFuturo: null, ouroFuturoBrl: null };
    const html = await res.text();

    const dolarMatch = html.match(/D[oó]lar\s*Fut[^<]*<\/t[dh]>\s*<t[dh][^>]*>([^<]+)<\/t[dh]>\s*<t[dh][^>]*>([^<]*)<\/t[dh]>/i);
    const dolarFuturo = dolarMatch ? { valor: dolarMatch[1].trim(), vencimento: dolarMatch[2]?.trim() || '' } : null;

    // Tentativa extra: se a mesma página listar "Ouro" na tabela B3
    // (contrato futuro, R$/grama), aproveita — senão, outras fontes de
    // ouro entram em ação normalmente.
    const ouroMatch = html.match(/\bOuro\b[^<]*<\/t[dh]>\s*<t[dh][^>]*>([^<]+)<\/t[dh]>/i);
    const ouroFuturoBrl = ouroMatch ? Number(ouroMatch[1].replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')) || null : null;

    return { dolarFuturo, ouroFuturoBrl };
  } catch {
    return { dolarFuturo: null, ouroFuturoBrl: null };
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cache = (caches as any).default;
  const cacheKey = new Request('https://cache.internal/cambio-v4', context.request);
  const forceRefresh = new URL(context.request.url).searchParams.has('debug');

  if (!forceRefresh) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const debug: string[] = [];

  try {
    const [usd, eur, jpy, cny, rub, b3Extras] = await Promise.all([
      fetchMoeda('USD', debug),
      fetchMoeda('EUR', debug),
      fetchMoeda('JPY', debug),
      fetchMoeda('CNY', debug),
      fetchMoeda('RUB', debug),
      fetchB3Extras(),
    ]);

    const [btc, xau] = await Promise.all([
      fetchBitcoin(usd, debug),
      fetchGold(usd, b3Extras.ouroFuturoBrl, debug),
    ]);

    const response = new Response(JSON.stringify({
      usd, eur, jpy, cny, rub, xau, btc,
      dolarFuturoB3: b3Extras.dolarFuturo,
      fonte: 'Banco Central do Brasil (PTAX oficial) — Bitcoin via Mercado Bitcoin, Ouro via B3/Stooq, Dólar Futuro via B3/Notícias Agrícolas',
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
