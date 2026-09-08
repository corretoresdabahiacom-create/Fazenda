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

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function toMMDDYYYY(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
}

// PTAX não tem cotação em fins de semana/feriados — tenta hoje e vai
// voltando dia a dia até achar (no máximo 7 tentativas). Tenta também 2
// variações de sintaxe OData da URL, já que a documentação do Banco
// Central mostra exemplos inconsistentes entre si.
async function fetchPtax(moeda: 'USD' | 'EUR' | 'JPY'): Promise<CambioEntry | null> {
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

  let previousDayCompra: number | null = null;
  let lastErrorDetail = '';

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = toMMDDYYYY(d);

    for (const url of buildUrls(dateStr)) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
        });
        if (!res.ok) {
          lastErrorDetail = `HTTP ${res.status} em ${url}`;
          continue;
        }
        const data = (await res.json()) as { value?: any[] };
        const values = data.value || [];
        if (values.length === 0) continue;

        const fechamento = values.find(v => v.tipoBoletim === 'Fechamento') || values[values.length - 1];
        const compra = Number(fechamento.cotacaoCompra);
        const venda = Number(fechamento.cotacaoVenda);
        if (!compra || !venda) continue;

        const variacaoPct = previousDayCompra
          ? Number((((compra - previousDayCompra) / previousDayCompra) * 100).toFixed(2))
          : 0;

        return { compra, venda, variacaoPct, atualizadoEm: fechamento.dataHoraCotacao };
      } catch (e: any) {
        lastErrorDetail = e?.message || String(e);
        continue;
      }
    }
  }
  console.warn(`fetchPtax(${moeda}) falhou após todas as tentativas. Último erro: ${lastErrorDetail}`);
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

async function fetchBitcoin(env: Env): Promise<CambioEntry | null> {
  // Fonte principal: CoinGecko, gratuita, sem chave, nativa em BRL.
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
    }
  } catch {
    // segue para a reserva
  }

  // Reserva: AwesomeAPI.
  try {
    const tokenParam = env.AWESOMEAPI_TOKEN ? `&token=${env.AWESOMEAPI_TOKEN}` : '';
    const res = await fetch(`https://economia.awesomeapi.com.br/json/last/BTC-BRL${tokenParam}`);
    if (res.ok) {
      const data = (await res.json()) as any;
      const entry = data?.BTCBRL;
      if (entry) {
        return {
          compra: Number(entry.bid),
          venda: Number(entry.ask),
          variacaoPct: Number(entry.pctChange),
          atualizadoEm: entry.create_date,
        };
      }
    }
  } catch {
    // ambas as fontes falharam
  }
  return null;
}

async function fetchGold(env: Env, usdBrl: CambioEntry | null): Promise<CambioEntry | null> {
  const GRAMS_PER_TROY_OUNCE = 31.1035;

  // Fonte principal: cotação internacional do ouro em dólar (Stooq,
  // gratuita e sem chave), convertida para reais usando nosso próprio
  // câmbio (já confiável, vindo do Banco Central) — assim não dependemos
  // de nenhum provedor terceiro já sobrecarregado para o valor em BRL.
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
            compra: Number((brlPerGram * 0.98).toFixed(2)), // aproximação de spread compra/venda
            venda: Number(brlPerGram.toFixed(2)),
            variacaoPct: 0,
            atualizadoEm: new Date().toISOString(),
          };
        }
      }
    } catch {
      // segue para a reserva
    }
  }

  // Reserva: AwesomeAPI (XAU-BRL, cotado por onça — convertemos pra grama).
  try {
    const tokenParam = env.AWESOMEAPI_TOKEN ? `&token=${env.AWESOMEAPI_TOKEN}` : '';
    const res = await fetch(`https://economia.awesomeapi.com.br/json/last/XAU-BRL${tokenParam}`);
    if (res.ok) {
      const data = (await res.json()) as any;
      const entry = data?.XAUBRL;
      if (entry) {
        return {
          compra: Number((Number(entry.bid) / GRAMS_PER_TROY_OUNCE).toFixed(2)),
          venda: Number((Number(entry.ask) / GRAMS_PER_TROY_OUNCE).toFixed(2)),
          variacaoPct: Number(entry.pctChange),
          atualizadoEm: entry.create_date,
        };
      }
    }
  } catch {
    // ambas as fontes falharam
  }
  return null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cache = (caches as any).default;
  const cacheKey = new Request('https://cache.internal/cambio-v2', context.request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const [usd, eur, jpy, dolarFuturo] = await Promise.all([
      fetchPtax('USD'),
      fetchPtax('EUR'),
      fetchPtax('JPY'),
      fetchDolarFuturoB3(),
    ]);

    // Ouro depende do dólar já calculado (convertemos USD -> BRL usando
    // nosso próprio câmbio confiável), por isso roda depois.
    const [btc, xau] = await Promise.all([
      fetchBitcoin(context.env),
      fetchGold(context.env, usd),
    ]);

    if (!usd && !eur && !jpy) {
      return new Response(JSON.stringify({ error: 'Não foi possível buscar o câmbio no Banco Central agora. Tente novamente em instantes.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = new Response(JSON.stringify({
      usd, eur, jpy, xau, btc,
      dolarFuturoB3: dolarFuturo,
      fonte: 'Banco Central do Brasil (PTAX) — Bitcoin via CoinGecko, Ouro calculado via Stooq + câmbio BCB, Dólar Futuro via B3/Notícias Agrícolas',
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
