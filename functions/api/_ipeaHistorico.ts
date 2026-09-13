// Série histórica REAL de preços agropecuários via IPEADATA — API
// pública do governo federal (Ipea), gratuita, sem chave, retornando
// JSON. Confirmada funcionando: http://www.ipeadata.gov.br/api/odata4/
//
// POR QUE ISSO EXISTE: o gráfico Preço x Clima só tinha preço de hoje
// e do futuro B3, deixando meses inteiros vazios — um gráfico com uma
// barra solitária não passa confiança nenhuma. O IPEADATA republica
// séries mensais longas (várias com origem CEPEA/ESALQ, FGV, Conab),
// que é exatamente o que faltava.
//
// DECISÃO DE PROJETO IMPORTANTE: não gravamos códigos de série
// ("SERCODIGO") fixos no código. Eu não consegui verificar cada código
// um por um durante a implementação, e chutar código levaria a plotar
// a série ERRADA silenciosamente (ex: "toneladas produzidas" no lugar
// de "preço") — exatamente o tipo de erro que destrói a confiança no
// gráfico. Em vez disso, descobrimos a série em tempo de execução:
// busca no catálogo por palavra-chave, e SÓ aceita séries que passem
// em validações rígidas (nome indica preço, unidade é monetária,
// série ativa, periodicidade mensal). Se nada passar, devolve vazio e
// avisa — nunca inventa.

const IPEA_BASE = 'http://www.ipeadata.gov.br/api/odata4';

interface SerieDescoberta {
  codigo: string;
  nome: string;
  unidade: string;
  fonte: string;
}

// Palavras-chave por produto. A busca no catálogo do IPEADATA é por
// nome da série, então precisamos do termo que aparece no nome deles.
const TERMOS_BUSCA: Record<string, string[]> = {
  boi_gordo: ['boi'],
  vaca: ['boi'], // catálogo não separa vaca; boi serve de referência do mesmo mercado
  novilho: ['boi'],
  novilha: ['boi'],
  soja: ['soja'],
  milho: ['milho'],
  cafe: ['café', 'cafe'],
  algodao: ['algodão', 'algodao'],
  arroz: ['arroz'],
  trigo: ['trigo'],
  feijao: ['feijão', 'feijao'],
  acucar: ['açúcar', 'acucar'],
  suinos: ['suíno', 'suino'],
  frango: ['frango'],
  leite: ['leite'],
};

// Só aceita a série se o NOME indicar preço E a unidade for monetária.
// Sem isso, uma busca por "soja" traria "Produção - soja - quantidade"
// (toneladas) e o gráfico plotaria tonelagem como se fosse preço.
function pareceSerieDePreco(nome: string, unidade: string): boolean {
  const nomeMin = (nome || '').toLowerCase();
  const uniMin = (unidade || '').toLowerCase();

  const nomeIndicaPreco = /pre[çc]o|cota[çc][ãa]o|indicador/.test(nomeMin);
  const nomeIndicaOutraCoisa = /produ[çc][ãa]o|\b[áa]rea\b|quantidade|exporta|importa|abate|rebanho|estoque|consumo|rendimento/.test(nomeMin);
  const unidadeMonetaria = /r\$|real|reais|us\$|d[óo]lar/.test(uniMin);

  return nomeIndicaPreco && !nomeIndicaOutraCoisa && unidadeMonetaria;
}

async function descobrirSerie(produto: string): Promise<SerieDescoberta | null> {
  const termos = TERMOS_BUSCA[produto];
  if (!termos) return null;

  for (const termo of termos) {
    try {
      // SERSTATUS 'A' = série ativa (ainda atualizada). Periodicidade
      // mensal é a que faz sentido pro gráfico (diária não existe pra
      // maioria; anual é grossa demais).
      const filtro = encodeURIComponent(`contains(SERNOME,'${termo}') and SERSTATUS eq 'A' and PERNOME eq 'Mensal'`);
      const select = encodeURIComponent('SERCODIGO,SERNOME,UNINOME,FNTSIGLA');
      const url = `${IPEA_BASE}/Metadados?$filter=${filtro}&$select=${select}`;

      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const json = (await res.json()) as any;
      const candidatas: any[] = json?.value || [];

      const validas = candidatas.filter(c => pareceSerieDePreco(c.SERNOME, c.UNINOME));
      if (validas.length === 0) continue;

      // Preferência: série cuja fonte seja CEPEA (referência do setor),
      // senão a primeira válida.
      const preferida = validas.find(c => /cepea|esalq/i.test(c.FNTSIGLA || '')) || validas[0];
      return {
        codigo: preferida.SERCODIGO,
        nome: preferida.SERNOME,
        unidade: preferida.UNINOME,
        fonte: preferida.FNTSIGLA || 'IPEADATA',
      };
    } catch {
      // tenta o próximo termo
    }
  }
  return null;
}

export interface PontoHistoricoIpea { data: string; preco: number }

export interface ResultadoIpea {
  pontos: PontoHistoricoIpea[];
  serie: SerieDescoberta | null;
  aviso?: string;
}

// Busca a série histórica mensal de preço pro produto, no intervalo
// pedido. Devolve lista vazia + aviso quando não achar — nunca inventa
// ponto nenhum.
export async function buscarHistoricoIpea(produto: string, dataInicio: string, dataFim: string): Promise<ResultadoIpea> {
  const serie = await descobrirSerie(produto);
  if (!serie) {
    return { pontos: [], serie: null, aviso: `Não há série histórica de preço mensal publicada no IPEADATA pra ${produto} (ou a busca não encontrou uma série que passe nas validações de segurança).` };
  }

  try {
    const url = `${IPEA_BASE}/ValoresSerie(SERCODIGO='${encodeURIComponent(serie.codigo)}')`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      return { pontos: [], serie, aviso: `A série ${serie.codigo} foi encontrada, mas a consulta de valores falhou (HTTP ${res.status}).` };
    }
    const json = (await res.json()) as any;
    const valores: any[] = json?.value || [];

    const pontos: PontoHistoricoIpea[] = [];
    for (const v of valores) {
      const dataIso = String(v.VALDATA || '').slice(0, 10);
      const preco = Number(v.VALVALOR);
      if (!dataIso || isNaN(preco) || preco <= 0) continue;
      if (dataIso < dataInicio || dataIso > dataFim) continue;
      pontos.push({ data: dataIso, preco });
    }

    pontos.sort((a, b) => a.data.localeCompare(b.data));

    if (pontos.length === 0) {
      return { pontos: [], serie, aviso: `A série "${serie.nome}" existe, mas não tem valores publicados dentro do período pedido.` };
    }

    return { pontos, serie };
  } catch (e: any) {
    return { pontos: [], serie, aviso: `Falha ao consultar a série no IPEADATA: ${e?.message || String(e)}` };
  }
}
