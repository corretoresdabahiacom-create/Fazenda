// Endpoint de dados pro gráfico Preço x Clima pedido em Cotações.
//
// Busca clima REAL (Open-Meteo — geocodificação, previsão de até 16
// dias, e histórico real de qualquer data passada) e cruza com o
// histórico de preço já gravado no Firestore (ver quotes.ts).
//
// LIMITAÇÃO HONESTA: o histórico de preço só começou a ser gravado
// agora — não existe dado de preço real anterior a quando essa função
// entrou no ar. Datas de preço anteriores a isso vêm com "preco: null"
// e um aviso explícito, nunca com número inventado ou estimado. O clima
// não tem essa limitação — o Open-Meteo tem histórico real de anos.

import { firestoreGetDoc, GoogleServiceAccountEnv } from './_googleAuth';

interface Env extends GoogleServiceAccountEnv {}

interface ChartPoint {
  label: string;       // "Jan/2026" ou "09/09"
  data: string;         // ISO da data (ou primeiro dia do mês, se agregado)
  chuvaMm: number | null;
  preco: number | null;
}

async function geocodificar(cidade: string, estado: string): Promise<{ lat: number; lon: number; nomeEncontrado: string } | null> {
  const query = cidade || estado;
  if (!query) return null;
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&country=BR&count=1&language=pt`);
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const first = data?.results?.[0];
    if (!first) return null;
    return { lat: first.latitude, lon: first.longitude, nomeEncontrado: `${first.name}${first.admin1 ? ', ' + first.admin1 : ''}` };
  } catch {
    return null;
  }
}

// Busca precipitação diária real — usa a API de previsão (até 16 dias à
// frente) pra datas futuras, e a API de arquivo histórico (dados reais
// de qualquer data passada) pra datas passadas. Combina as duas quando
// o período pedido cruza o "hoje".
async function buscarChuvaDiaria(lat: number, lon: number, dataInicio: string, dataFim: string): Promise<Record<string, number>> {
  const hoje = new Date().toISOString().slice(0, 10);
  const resultado: Record<string, number> = {};

  const precisaHistorico = dataInicio < hoje;
  const precisaPrevisao = dataFim >= hoje;

  if (precisaHistorico) {
    const fimHistorico = dataFim < hoje ? dataFim : new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    try {
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dataInicio}&end_date=${fimHistorico}&daily=precipitation_sum&timezone=auto`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as any;
        const datas: string[] = data?.daily?.time || [];
        const chuva: number[] = data?.daily?.precipitation_sum || [];
        datas.forEach((d, i) => { resultado[d] = chuva[i] ?? 0; });
      }
    } catch { /* segue sem histórico se falhar */ }
  }

  if (precisaPrevisao) {
    // Open-Meteo permite no máximo 16 dias de previsão à frente — corta
    // se o usuário pedir mais que isso, em vez de fingir que tem dado.
    const diasAFrente = Math.min(16, Math.ceil((new Date(dataFim).getTime() - Date.now()) / 86400000) + 1);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&timezone=auto&forecast_days=${Math.max(1, diasAFrente)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as any;
        const datas: string[] = data?.daily?.time || [];
        const chuva: number[] = data?.daily?.precipitation_sum || [];
        datas.forEach((d, i) => {
          if (d >= dataInicio && d <= dataFim) resultado[d] = chuva[i] ?? 0;
        });
      }
    } catch { /* segue sem previsão se falhar */ }
  }

  return resultado;
}

interface PricePoint { data: string; preco: number }

async function buscarHistoricoPreco(env: Env, produto: string, estado: string): Promise<PricePoint[]> {
  if (!env.FIREBASE_PROJECT_ID) return [];
  const docId = `${produto}_${estado || 'geral'}`;
  try {
    const doc = await firestoreGetDoc(env, 'priceHistory', docId);
    const pontos: any[] = Array.isArray(doc?.pontos) ? doc.pontos : [];
    return pontos.map(p => ({ data: String(p.data).slice(0, 10), preco: Number(p.preco) })).filter(p => !isNaN(p.preco));
  } catch {
    return [];
  }
}

function gerarDatasNoIntervalo(inicio: string, fim: string): string[] {
  const datas: string[] = [];
  let atual = new Date(inicio + 'T00:00:00');
  const fimData = new Date(fim + 'T00:00:00');
  while (atual <= fimData) {
    datas.push(atual.toISOString().slice(0, 10));
    atual.setDate(atual.getDate() + 1);
  }
  return datas;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const produto = url.searchParams.get('produto') || 'boi_gordo';
    const estado = url.searchParams.get('estado') || '';
    const cidade = url.searchParams.get('cidade') || '';
    const dataInicio = url.searchParams.get('inicio') || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const dataFim = url.searchParams.get('fim') || new Date().toISOString().slice(0, 10);

    if (!estado && !cidade) {
      return new Response(JSON.stringify({ error: 'Informe ao menos um estado ou cidade.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const local = await geocodificar(cidade, estado);
    if (!local) {
      return new Response(JSON.stringify({ error: `Não foi possível localizar "${cidade || estado}" pra buscar o clima.` }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    const [chuvaPorDia, precoHistorico] = await Promise.all([
      buscarChuvaDiaria(local.lat, local.lon, dataInicio, dataFim),
      buscarHistoricoPreco(context.env, produto, estado),
    ]);

    const precoPorDia = new Map(precoHistorico.map(p => [p.data, p.preco]));
    const todasDatas = gerarDatasNoIntervalo(dataInicio, dataFim);

    // Decide granularidade: mais de 31 dias no período -> agrupa por
    // mês; senão, mostra dia a dia (exatamente como pedido: "se
    // selecionar só um mês, aparece por dia").
    const agruparPorMes = todasDatas.length > 31;
    const pontos: ChartPoint[] = [];

    if (agruparPorMes) {
      const porMes = new Map<string, { chuvas: number[]; precos: number[] }>();
      for (const d of todasDatas) {
        const chave = d.slice(0, 7); // "2026-01"
        if (!porMes.has(chave)) porMes.set(chave, { chuvas: [], precos: [] });
        const grupo = porMes.get(chave)!;
        if (chuvaPorDia[d] != null) grupo.chuvas.push(chuvaPorDia[d]);
        if (precoPorDia.has(d)) grupo.precos.push(precoPorDia.get(d)!);
      }
      const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      for (const [chave, grupo] of Array.from(porMes.entries()).sort()) {
        const [ano, mes] = chave.split('-');
        pontos.push({
          label: `${MESES[Number(mes) - 1]}/${ano}`,
          data: `${chave}-01`,
          chuvaMm: grupo.chuvas.length > 0 ? Number(grupo.chuvas.reduce((a, b) => a + b, 0).toFixed(1)) : null,
          preco: grupo.precos.length > 0 ? Number((grupo.precos.reduce((a, b) => a + b, 0) / grupo.precos.length).toFixed(2)) : null,
        });
      }
    } else {
      for (const d of todasDatas) {
        pontos.push({
          label: `${d.slice(8, 10)}/${d.slice(5, 7)}`,
          data: d,
          chuvaMm: chuvaPorDia[d] != null ? Number(chuvaPorDia[d].toFixed(1)) : null,
          preco: precoPorDia.has(d) ? precoPorDia.get(d)! : null,
        });
      }
    }

    const totalComPreco = pontos.filter(p => p.preco != null).length;

    return new Response(JSON.stringify({
      produto, estado, cidade, local: local.nomeEncontrado,
      granularidade: agruparPorMes ? 'mes' : 'dia',
      pontos,
      avisoPreco: totalComPreco === 0
        ? 'Ainda não há preço histórico real gravado pra esse período — o histórico de preço começou a ser gravado recentemente e só cobre a partir de então. O clima mostrado é real e completo.'
        : totalComPreco < pontos.length
        ? `Preço disponível em ${totalComPreco} de ${pontos.length} pontos do período — o restante ainda não tinha sido gravado no histórico.`
        : undefined,
      fetchedAt: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (error: any) {
    console.error('climate-price-chart error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao montar o gráfico: ' + (error.message || String(error)) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
