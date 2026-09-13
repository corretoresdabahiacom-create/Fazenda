// Série histórica REAL de preços agropecuários via IPEADATA — API
// pública do Ipea (governo federal), gratuita, sem chave, em JSON.
//
// VERSÃO 2 — a primeira versão devolvia zero pontos em produção. Causas
// prováveis identificadas e tratadas aqui:
//   1. Usava http:// (não seguro) — Cloudflare Workers pode recusar.
//      Agora usa https:// com http:// só como último recurso.
//   2. Dependia de UMA consulta OData com filtro composto
//      (contains + SERSTATUS + PERNOME). Se qualquer parte do filtro
//      não casar com o formato real do catálogo, volta vazio sem
//      explicação. Agora tenta várias estratégias, da mais restrita
//      pra mais ampla, e filtra no próprio código em vez de confiar só
//      no servidor.
//   3. Validação exigia nome E unidade monetária ao mesmo tempo. Se o
//      catálogo escrever a unidade de outro jeito (ex: "R$ de 2024"),
//      a série boa era descartada. Agora aceita evidência forte de
//      qualquer um dos dois lados, mas continua REJEITANDO
//      explicitamente séries de produção/área/quantidade.
//
// Tudo que acontece fica registrado em "diagnostico" e volta na
// resposta — assim dá pra ver exatamente onde parou, em vez de só
// receber um gráfico vazio.

const HOSTS = [
  'https://www.ipeadata.gov.br/api/odata4',
  'http://www.ipeadata.gov.br/api/odata4',
];

export interface SerieDescoberta {
  codigo: string;
  nome: string;
  unidade: string;
  fonte: string;
  periodicidade: string;
}

export interface PontoHistoricoIpea { data: string; preco: number }

export interface ResultadoIpea {
  pontos: PontoHistoricoIpea[];
  serie: SerieDescoberta | null;
  aviso?: string;
  diagnostico: string[];
}

const TERMOS_BUSCA: Record<string, string[]> = {
  boi_gordo: ['boi', 'bovino'],
  vaca: ['boi', 'bovino'],
  novilho: ['boi', 'bovino'],
  novilha: ['boi', 'bovino'],
  bezerro: ['bezerro', 'boi'],
  bezerra: ['bezerro', 'boi'],
  soja: ['soja'],
  milho: ['milho'],
  cafe: ['caf'],
  algodao: ['algod'],
  arroz: ['arroz'],
  trigo: ['trigo'],
  feijao: ['feij'],
  acucar: ['úcar', 'ucar'],
  suinos: ['su\u00edno', 'suino'],
  frango: ['frango', 'ave'],
  leite: ['leite'],
};

// Rejeita explicitamente o que NÃO é preço. Essa é a trava de
// segurança que impede plotar "toneladas produzidas" como se fosse
// preço da arroba — testada contra casos reais do catálogo.
function ehSerieProibida(nome: string): boolean {
  return /produ[çc][ãa]o|\b[áa]rea\b|quantidade|exporta|importa|abate|rebanho|estoque|consumo|rendimento|safra|plantada|colhida|efetivo/i.test(nome || '');
}

function ehIndicioDePreco(nome: string, unidade: string): boolean {
  const nomeIndica = /pre[çc]o|cota[çc][ãa]o|indicador|valor/i.test(nome || '');
  const unidadeIndica = /r\$|reais|real|us\$|d[óo]lar/i.test(unidade || '');
  // Basta um lado indicar preço, desde que o outro não contradiga.
  return nomeIndica || unidadeIndica;
}

async function buscarJson(caminho: string, diagnostico: string[]): Promise<any | null> {
  for (const host of HOSTS) {
    const url = `${host}${caminho}`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        diagnostico.push(`${host}: HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      diagnostico.push(`${host}: OK`);
      return json;
    } catch (e: any) {
      diagnostico.push(`${host}: falhou (${e?.message || String(e)})`);
    }
  }
  return null;
}

async function descobrirSerie(produto: string, diagnostico: string[]): Promise<SerieDescoberta | null> {
  const termos = TERMOS_BUSCA[produto];
  if (!termos) {
    diagnostico.push(`Produto "${produto}" não tem termo de busca configurado.`);
    return null;
  }

  for (const termo of termos) {
    // CAUSA DO HTTP 400 IDENTIFICADA PELO DIAGNÓSTICO: a v2 usava
    // encodeURIComponent no filtro inteiro, o que transforma a vírgula
    // de contains(SERNOME,'boi') em %2C — e o servidor OData do
    // IPEADATA rejeita a consulta com 400. Vírgula e parênteses são
    // caracteres LEGAIS numa query string, então a forma certa é
    // montar a URL crua. Tentamos as duas formas, na ordem, e também
    // uma terceira via $select (payload pequeno, filtro feito aqui no
    // código) — se qualquer uma responder, seguimos com ela.
    const tentativas = [
      { nome: 'filtro cru', caminho: `/Metadados?$filter=contains(SERNOME,'${termo}')` },
      { nome: 'filtro codificado', caminho: `/Metadados?$filter=${encodeURIComponent(`contains(SERNOME,'${termo}')`)}` },
      { nome: 'catálogo enxuto (filtro no código)', caminho: `/Metadados?$select=SERCODIGO,SERNOME,UNINOME,PERNOME,FNTSIGLA,SERSTATUS` },
    ];

    let json: any = null;
    for (const t of tentativas) {
      diagnostico.push(`Tentando estratégia "${t.nome}" para o termo "${termo}"...`);
      json = await buscarJson(t.caminho, diagnostico);
      if (json?.value?.length > 0) {
        diagnostico.push(`  -> estratégia "${t.nome}" funcionou.`);
        break;
      }
      json = null;
    }

    const candidatas: any[] = json?.value || [];
    diagnostico.push(`Termo "${termo}": ${candidatas.length} séries retornadas pelo catálogo.`);
    if (candidatas.length === 0) continue;

    // Filtra no próprio código — não confia no servidor ter aplicado
    // nada. Se o filtro do servidor foi ignorado (já vimos isso
    // acontecer), esse passo salva a operação.
    const doTermo = candidatas.filter(c => (c.SERNOME || '').toLowerCase().includes(termo.toLowerCase()));
    const naoProibidas = doTermo.filter(c => !ehSerieProibida(c.SERNOME));
    const comIndicioPreco = naoProibidas.filter(c => ehIndicioDePreco(c.SERNOME, c.UNINOME));
    const ativas = comIndicioPreco.filter(c => !c.SERSTATUS || c.SERSTATUS === 'A');

    diagnostico.push(`  -> ${doTermo.length} contêm o termo, ${naoProibidas.length} não são produção/área, ${comIndicioPreco.length} indicam preço, ${ativas.length} ativas.`);

    const pool = ativas.length > 0 ? ativas : comIndicioPreco;
    if (pool.length === 0) continue;

    // Ordem de preferência: mensal > qualquer; CEPEA > outras fontes.
    const mensais = pool.filter(c => /mensal/i.test(c.PERNOME || ''));
    const preferenciaPeriodo = mensais.length > 0 ? mensais : pool;
    const escolhida = preferenciaPeriodo.find(c => /cepea|esalq/i.test(c.FNTSIGLA || '')) || preferenciaPeriodo[0];

    diagnostico.push(`  -> escolhida: ${escolhida.SERCODIGO} "${escolhida.SERNOME}" (${escolhida.UNINOME || 's/unidade'}, ${escolhida.PERNOME || 's/periodicidade'}, ${escolhida.FNTSIGLA || 's/fonte'})`);

    return {
      codigo: escolhida.SERCODIGO,
      nome: escolhida.SERNOME,
      unidade: escolhida.UNINOME || '',
      fonte: escolhida.FNTSIGLA || 'IPEADATA',
      periodicidade: escolhida.PERNOME || '',
    };
  }

  diagnostico.push('Nenhuma série passou nas validações pra nenhum dos termos.');
  return null;
}

export async function buscarHistoricoIpea(produto: string, dataInicio: string, dataFim: string): Promise<ResultadoIpea> {
  const diagnostico: string[] = [];

  const serie = await descobrirSerie(produto, diagnostico);
  if (!serie) {
    return { pontos: [], serie: null, diagnostico, aviso: 'Não foi encontrada série histórica de preço publicada no IPEADATA pra esse produto.' };
  }

  const json = await buscarJson(`/ValoresSerie(SERCODIGO='${encodeURIComponent(serie.codigo)}')`, diagnostico);
  const valores: any[] = json?.value || [];
  diagnostico.push(`Série ${serie.codigo}: ${valores.length} valores no total (antes do recorte de período).`);

  if (valores.length === 0) {
    return { pontos: [], serie, diagnostico, aviso: `A série "${serie.nome}" foi localizada, mas a consulta de valores não devolveu nada.` };
  }

  const pontos: PontoHistoricoIpea[] = [];
  let foraDoPeriodo = 0;
  let invalidos = 0;
  let primeira = '', ultima = '';

  for (const v of valores) {
    const dataIso = String(v.VALDATA || '').slice(0, 10);
    const preco = Number(v.VALVALOR);
    if (!dataIso || isNaN(preco) || preco <= 0) { invalidos++; continue; }
    if (!primeira || dataIso < primeira) primeira = dataIso;
    if (!ultima || dataIso > ultima) ultima = dataIso;
    if (dataIso < dataInicio || dataIso > dataFim) { foraDoPeriodo++; continue; }
    pontos.push({ data: dataIso, preco });
  }

  pontos.sort((a, b) => a.data.localeCompare(b.data));
  diagnostico.push(`Cobertura da série: ${primeira || '?'} até ${ultima || '?'}. Pedido: ${dataInicio} a ${dataFim}. Dentro do período: ${pontos.length}; fora: ${foraDoPeriodo}; inválidos: ${invalidos}.`);

  if (pontos.length === 0) {
    return {
      pontos: [], serie, diagnostico,
      aviso: `A série "${serie.nome}" (${serie.fonte}) cobre de ${primeira} a ${ultima}, mas não tem valores dentro do período que você escolheu (${dataInicio} a ${dataFim}). Tente um período dentro dessa faixa.`,
    };
  }

  return { pontos, serie, diagnostico };
}
