// Endpoint de dados pro gráfico Preço x Clima pedido em Cotações.
//
// Busca clima REAL de duas fontes: INMET (estação terrestre mais
// próxima, dado observado de verdade — usado com prioridade pra
// qualquer dia já passado) e Open-Meteo (modelo numérico — cobre onde
// não há estação INMET por perto, e todo o período futuro, já que
// estação não prevê o que ainda vai acontecer). Cruza com o histórico
// de preço já gravado no Firestore (ver quotes.ts).
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

// Busca precipitação diária real. BUG REAL ENCONTRADO E CORRIGIDO: a
// API de arquivo histórico (archive-api) do Open-Meteo tem um atraso
// documentado de 2 a 5 dias pra disponibilizar dado (usa o modelo
// ERA5, que precisa de tempo de processamento) — pedir dados de
// "ontem" ou "anteontem" nela frequentemente vinha vazio. A própria
// documentação oficial recomenda usar a API de previsão com o
// parâmetro "past_days" pra cobrir justamente esse intervalo recente
// (ela também guarda o que já aconteceu, não só o que vai acontecer).
// Nova estratégia: arquivo histórico pros dias mais antigos que 6 dias
// atrás (dado já consolidado e confiável); API de previsão (com
// past_days + forecast_days juntos, numa chamada só) pra tudo de 6
// dias atrás em diante, incluindo o futuro.
async function buscarChuvaDiaria(lat: number, lon: number, dataInicio: string, dataFim: string): Promise<Record<string, number>> {
  const hoje = new Date();
  const hojeStr = hoje.toISOString().slice(0, 10);
  const limiteArquivoConfiavel = new Date(hoje.getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const resultado: Record<string, number> = {};

  const precisaArquivoAntigo = dataInicio < limiteArquivoConfiavel;
  const precisaRecenteOuFuturo = dataFim >= limiteArquivoConfiavel;

  if (precisaArquivoAntigo) {
    const fimArquivo = dataFim < limiteArquivoConfiavel ? dataFim : new Date(new Date(limiteArquivoConfiavel).getTime() - 86400000).toISOString().slice(0, 10);
    try {
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dataInicio}&end_date=${fimArquivo}&daily=precipitation_sum&timezone=auto`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as any;
        const datas: string[] = data?.daily?.time || [];
        const chuva: number[] = data?.daily?.precipitation_sum || [];
        datas.forEach((d, i) => { resultado[d] = chuva[i] ?? 0; });
      }
    } catch { /* segue sem esse trecho se falhar */ }
  }

  if (precisaRecenteOuFuturo) {
    // past_days cobre os últimos dias (incluindo os que o arquivo
    // histórico ainda não processou), forecast_days cobre o futuro —
    // pedidos juntos numa única chamada, já que a mesma API atende as
    // duas pontas.
    const diasPassadosNecessarios = Math.min(92, Math.max(0, Math.ceil((hoje.getTime() - new Date(dataInicio).getTime()) / 86400000)));
    const diasFuturosNecessarios = dataFim > hojeStr
      ? Math.min(16, Math.ceil((new Date(dataFim).getTime() - hoje.getTime()) / 86400000) + 1)
      : 1;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&timezone=auto&past_days=${diasPassadosNecessarios}&forecast_days=${diasFuturosNecessarios}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as any;
        const datas: string[] = data?.daily?.time || [];
        const chuva: number[] = data?.daily?.precipitation_sum || [];
        datas.forEach((d, i) => {
          if (d >= dataInicio && d <= dataFim) resultado[d] = chuva[i] ?? 0;
        });
      }
    } catch { /* segue sem esse trecho se falhar */ }
  }

  return resultado;
}

// ============================================================
// INMET — Instituto Nacional de Meteorologia. Dados REAIS de estação
// terrestre (não modelo numérico como o Open-Meteo), preferíveis pra
// datas passadas quando uma estação próxima tiver leitura válida.
//
// Descoberto por pesquisa (a API não tem documentação oficial em
// formato OpenAPI): endpoint /estacoes/T lista as estações automáticas
// (código, nome, UF, latitude, longitude); /estacao/{inicio}/{fim}/
// {codigo} devolve leituras HORÁRIAS (campo CHUVA em mm, "9999" ou
// null quando o sensor falhou). A API RECUSA período maior que 6
// meses numa chamada só — por isso quebramos em janelas de 180 dias.
// ============================================================

interface EstacaoInmet { codigo: string; nome: string; lat: number; lon: number }

let cacheEstacoesInmet: EstacaoInmet[] | null = null;

async function listarEstacoesInmet(): Promise<EstacaoInmet[]> {
  if (cacheEstacoesInmet) return cacheEstacoesInmet;
  try {
    const res = await fetch('https://apitempo.inmet.gov.br/estacoes/T');
    if (!res.ok) return [];
    const data = (await res.json()) as any[];
    cacheEstacoesInmet = data
      .map(e => ({
        codigo: String(e.CD_ESTACAO || '').trim(),
        nome: String(e.DC_NOME || ''),
        lat: Number(e.VL_LATITUDE),
        lon: Number(e.VL_LONGITUDE),
      }))
      .filter(e => e.codigo && !isNaN(e.lat) && !isNaN(e.lon));
    return cacheEstacoesInmet;
  } catch {
    return [];
  }
}

function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function estacaoInmetMaisProxima(lat: number, lon: number): Promise<{ codigo: string; nome: string; distanciaKm: number } | null> {
  const estacoes = await listarEstacoesInmet();
  if (estacoes.length === 0) return null;
  let melhor: EstacaoInmet | null = null;
  let menorDist = Infinity;
  for (const e of estacoes) {
    const d = distanciaKm(lat, lon, e.lat, e.lon);
    if (d < menorDist) { menorDist = d; melhor = e; }
  }
  // Estação a mais de 150km não é confiável como representante do
  // clima local — melhor não usar do que usar uma referência distante
  // demais sem avisar.
  if (!melhor || menorDist > 150) return null;
  return { codigo: melhor.codigo, nome: melhor.nome, distanciaKm: Math.round(menorDist) };
}

function partirEmJanelasDe180Dias(inicio: string, fim: string): { inicio: string; fim: string }[] {
  const janelas: { inicio: string; fim: string }[] = [];
  let cursor = new Date(inicio + 'T00:00:00');
  const fimData = new Date(fim + 'T00:00:00');
  while (cursor <= fimData) {
    const fimJanela = new Date(Math.min(cursor.getTime() + 179 * 86400000, fimData.getTime()));
    janelas.push({ inicio: cursor.toISOString().slice(0, 10), fim: fimJanela.toISOString().slice(0, 10) });
    cursor = new Date(fimJanela.getTime() + 86400000);
  }
  return janelas;
}

// Busca chuva REAL de estação INMET, agregando as leituras horárias em
// total diário. Só cobre PASSADO (estação não "prevê" o futuro) — só
// vale a pena chamar pra parte do período que já aconteceu.
async function buscarChuvaInmet(lat: number, lon: number, dataInicio: string, dataFimPassado: string): Promise<{ porDia: Record<string, number>; estacaoUsada: string | null }> {
  if (dataFimPassado < dataInicio) return { porDia: {}, estacaoUsada: null };
  const estacao = await estacaoInmetMaisProxima(lat, lon);
  if (!estacao) return { porDia: {}, estacaoUsada: null };

  const porDia: Record<string, number> = {};
  const janelas = partirEmJanelasDe180Dias(dataInicio, dataFimPassado);

  for (const janela of janelas) {
    try {
      const url = `https://apitempo.inmet.gov.br/estacao/${janela.inicio}/${janela.fim}/${estacao.codigo}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const leituras = (await res.json()) as any[];
      if (!Array.isArray(leituras)) continue;
      for (const leitura of leituras) {
        const dia = String(leitura.DT_MEDICAO || '').slice(0, 10);
        const chuvaTexto = leitura.CHUVA;
        // "9999", null ou vazio marcam falha de sensor — nunca soma
        // isso como se fosse chuva real (documentado pelo próprio INMET).
        if (!dia || chuvaTexto == null || chuvaTexto === '9999' || chuvaTexto === '') continue;
        const chuva = Number(chuvaTexto);
        if (isNaN(chuva) || chuva < 0) continue;
        porDia[dia] = (porDia[dia] || 0) + chuva;
      }
    } catch { /* essa janela falhou, segue pras outras */ }
  }

  return { porDia, estacaoUsada: `${estacao.nome} (INMET, a ${estacao.distanciaKm}km)` };
}

interface PricePoint { data: string; preco: number }

// Busca o preço de HOJE (fonte ao vivo, mesma usada em Cotações) e o
// preço do contrato futuro B3 mais próximo do vencimento — que é o
// único dado de "preço futuro" que existe de verdade no mercado (B3 é
// bolsa de valores, não adivinhação). Usado pra preencher os próximos
// 16 dias do gráfico com uma referência real, já que não existe (e não
// deveria existir) "previsão de preço" fabricada, só o que o mercado
// futuro já precifica de fato.
async function buscarPrecoAtualEFuturo(origin: string, produto: string, estado: string): Promise<{ hoje: PricePoint | null; futuro: { preco: number; vencimento: string } | null }> {
  let hoje: PricePoint | null = null;
  let futuro: { preco: number; vencimento: string } | null = null;

  try {
    const params = new URLSearchParams({ product: produto });
    if (estado) params.set('state', estado);
    const res = await fetch(`${origin}/api/quotes?${params}`);
    if (res.ok) {
      const json = (await res.json()) as any;
      const melhor = (json.quotesRegionais?.[0] || json.quotes?.[0]);
      if (melhor?.price > 0) {
        hoje = { data: new Date().toISOString().slice(0, 10), preco: melhor.price };
      }
    }
  } catch { /* segue sem preço de hoje se falhar */ }

  try {
    const res = await fetch(`${origin}/api/cotacoes?produto=${produto}`);
    if (res.ok) {
      const json = (await res.json()) as any;
      const tabelaFuturo = (json.tables || []).find((t: any) => /futuro|pregão|vencimento/i.test(t.heading || ''));
      if (tabelaFuturo?.rows?.length > 1) {
        // Primeira linha de dado (depois do cabeçalho) é o contrato de
        // vencimento mais próximo — exatamente o que representa "os
        // próximos dias/semanas" pro mercado.
        const linha = tabelaFuturo.rows[1];
        const precoTexto = linha.find((c: string) => /\d{1,3}[.,]\d{2}/.test(c) && !/^\d{2}\/\d{2}/.test(c));
        if (precoTexto) {
          const preco = Number(precoTexto.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.'));
          if (preco > 0) futuro = { preco, vencimento: linha[0] || '' };
        }
      }
    }
  } catch { /* segue sem futuro se falhar */ }

  return { hoje, futuro };
}

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

    const hojeStr = new Date().toISOString().slice(0, 10);
    const fimParteJaPassada = dataFim < hojeStr ? dataFim : new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const [chuvaOpenMeteo, chuvaInmetResultado, precoHistorico, precoAtualEFuturo] = await Promise.all([
      buscarChuvaDiaria(local.lat, local.lon, dataInicio, dataFim),
      dataInicio <= fimParteJaPassada ? buscarChuvaInmet(local.lat, local.lon, dataInicio, fimParteJaPassada) : Promise.resolve({ porDia: {}, estacaoUsada: null }),
      buscarHistoricoPreco(context.env, produto, estado),
      buscarPrecoAtualEFuturo(url.origin, produto, estado),
    ]);

    // Funde as duas fontes de clima: INMET (estação real) tem
    // prioridade pros dias que ela cobriu, porque é observação de
    // verdade, não modelo numérico — Open-Meteo preenche o resto
    // (futuro, e qualquer dia sem estação próxima o suficiente).
    const chuvaPorDia: Record<string, number> = { ...chuvaOpenMeteo, ...chuvaInmetResultado.porDia };
    const fonteClimaUsada = chuvaInmetResultado.estacaoUsada
      ? `INMET (${chuvaInmetResultado.estacaoUsada}) + Open-Meteo`
      : 'Open-Meteo';

    const precoPorDia = new Map(precoHistorico.map(p => [p.data, p.preco]));

    // Preenche HOJE com o preço ao vivo, e os próximos 16 dias com o
    // preço do contrato futuro B3 mais próximo — a única referência de
    // "preço futuro" real que existe (mercado futuro de verdade, não
    // estimativa fabricada). Só preenche o que ainda não tinha vindo
    // do histórico gravado, e só dentro do período que o usuário pediu.
    if (precoAtualEFuturo.hoje && !precoPorDia.has(precoAtualEFuturo.hoje.data)) {
      precoPorDia.set(precoAtualEFuturo.hoje.data, precoAtualEFuturo.hoje.preco);
    }
    if (precoAtualEFuturo.futuro) {
      for (let i = 1; i <= 16; i++) {
        const dia = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
        if (dia >= dataInicio && dia <= dataFim && !precoPorDia.has(dia)) {
          precoPorDia.set(dia, precoAtualEFuturo.futuro.preco);
        }
      }
    }

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
    const fontePrecoUsada = [
      precoAtualEFuturo.hoje ? 'preço ao vivo (hoje)' : null,
      precoAtualEFuturo.futuro ? `contrato futuro B3 (${precoAtualEFuturo.futuro.vencimento}, próximos 16 dias)` : null,
    ].filter(Boolean).join(' + ') || undefined;

    return new Response(JSON.stringify({
      produto, estado, cidade, local: local.nomeEncontrado,
      fonteClima: fonteClimaUsada,
      fontePreco: fontePrecoUsada,
      granularidade: agruparPorMes ? 'mes' : 'dia',
      pontos,
      avisoPreco: totalComPreco === 0
        ? 'Ainda não há preço histórico real gravado pra esse período — o histórico de preço começou a ser gravado recentemente. Hoje e os próximos 16 dias usam o preço ao vivo e o contrato futuro B3, quando disponíveis.'
        : totalComPreco < pontos.length
        ? `Preço disponível em ${totalComPreco} de ${pontos.length} pontos do período — o restante ainda não tinha sido gravado no histórico (hoje e os próximos 16 dias usam preço ao vivo/futuro B3, quando disponíveis).`
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
