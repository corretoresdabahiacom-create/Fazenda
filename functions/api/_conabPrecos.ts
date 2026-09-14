// Série histórica de preços agropecuários da CONAB — POR ESTADO.
//
// POR QUE ISSO EXISTE: a série do IPEADATA que conseguimos usar é do
// Paraná ("Preço médio - boi gordo - arroba - PR"), e não existe
// equivalente nacional lá. Mostrar preço paranaense pra quem consultou
// a Bahia é enganoso. A CONAB pesquisa preços há mais de 30 anos, em
// mais de 130 produtos, com séries distribuídas em TODAS as unidades da
// federação — é a fonte certa pra resolver isso de vez.
//
// DESAFIO: o Portal de Informações da CONAB é uma aplicação
// JavaScript; o endereço do arquivo de download não aparece no HTML,
// então não deu pra descobrir por leitura da página. Em vez de gravar
// um endereço chutado (erro que já cometi antes neste projeto),
// tentamos vários candidatos plausíveis em sequência e registramos
// exatamente o que aconteceu com cada um. O endpoint
// /api/diagnostico-conab mostra esse relatório.

const CANDIDATOS_URL = [
  'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/PrecosMensalUF.txt',
  'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/PrecosMensalUf.txt',
  'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/PrecosMensalUF.csv',
  'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/precos-mensal-uf.csv',
  'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/PrecoMensalUF.txt',
];

export interface PontoConab { data: string; preco: number }

export interface ResultadoConab {
  pontos: PontoConab[];
  urlUsada: string | null;
  produtoEncontrado: string | null;
  unidade: string | null;
  diagnostico: string[];
  aviso?: string;
  /** Nomes de produto que existem no arquivo — usado pra descobrir a
   *  nomenclatura real da CONAB quando a busca não casa. */
  produtosNoArquivo?: string[];
  /** Nomes que lembram o produto procurado (busca frouxa). */
  produtosParecidos?: string[];
}

// Termos que identificam o produto no arquivo da CONAB. O arquivo tem
// 130+ produtos, então precisamos casar pelo nome.
const TERMOS_PRODUTO: Record<string, RegExp> = {
  boi_gordo: /boi\s*gordo/i,
  vaca: /vaca\s*gorda/i,
  novilho: /novilh|garrote/i,
  novilha: /novilha/i,
  bezerro: /bezerro/i,
  bezerra: /bezerra/i,
  soja: /\bsoja\b/i,
  milho: /\bmilho\b/i,
  cafe: /\bcaf[eé]\b/i,
  algodao: /algod[ãa]o/i,
  arroz: /\barroz\b/i,
  feijao: /feij[ãa]o/i,
  trigo: /\btrigo\b/i,
  sorgo: /\bsorgo\b/i,
  leite: /\bleite\b/i,
};

const UF_POR_NOME: Record<string, string> = {
  'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM', 'Bahia': 'BA',
  'Ceará': 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES', 'Goiás': 'GO',
  'Maranhão': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG',
  'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR', 'Pernambuco': 'PE', 'Piauí': 'PI',
  'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN', 'Rio Grande do Sul': 'RS',
  'Rondônia': 'RO', 'Roraima': 'RR', 'Santa Catarina': 'SC', 'São Paulo': 'SP',
  'Sergipe': 'SE', 'Tocantins': 'TO',
};

// Cache no módulo: o arquivo é grande e muda no máximo uma vez por mês.
let cacheArquivo: { texto: string; url: string } | null = null;

async function baixarArquivo(diagnostico: string[]): Promise<{ texto: string; url: string } | null> {
  if (cacheArquivo) {
    diagnostico.push(`Arquivo já em cache (${cacheArquivo.texto.length} caracteres, de ${cacheArquivo.url}).`);
    return cacheArquivo;
  }
  for (const url of CANDIDATOS_URL) {
    try {
      const res = await fetch(url, { headers: { Accept: 'text/csv,text/plain,*/*' } });
      if (!res.ok) {
        diagnostico.push(`${url}: HTTP ${res.status}`);
        continue;
      }
      const texto = await res.text();
      // Uma página de erro HTML também volta com 200 em alguns portais —
      // conferimos que o conteúdo parece mesmo dado tabular.
      if (/^\s*<(!doctype|html)/i.test(texto)) {
        diagnostico.push(`${url}: respondeu HTML (página de erro), não um arquivo de dados.`);
        continue;
      }
      if (texto.length < 100) {
        diagnostico.push(`${url}: resposta curta demais (${texto.length} caracteres).`);
        continue;
      }
      diagnostico.push(`${url}: OK — ${texto.length} caracteres baixados.`);
      cacheArquivo = { texto, url };
      return cacheArquivo;
    } catch (e: any) {
      diagnostico.push(`${url}: falhou (${e?.message || String(e)}).`);
    }
  }
  return null;
}

function detectarSeparador(primeiraLinha: string): string {
  const candidatos = [';', '\t', ','];
  let melhor = ';';
  let maisColunas = 0;
  for (const sep of candidatos) {
    const n = primeiraLinha.split(sep).length;
    if (n > maisColunas) { maisColunas = n; melhor = sep; }
  }
  return melhor;
}

function normalizarNumero(bruto: string): number {
  // Formato brasileiro: 1.234,56 -> 1234.56
  const limpo = (bruto || '').trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  return Number(limpo);
}

export async function buscarHistoricoConab(
  produto: string,
  estado: string,
  dataInicio: string,
  dataFim: string,
): Promise<ResultadoConab> {
  const diagnostico: string[] = [];

  const termoProduto = TERMOS_PRODUTO[produto];
  if (!termoProduto) {
    return { pontos: [], urlUsada: null, produtoEncontrado: null, unidade: null, diagnostico, aviso: `Produto "${produto}" não está mapeado para a busca na CONAB.` };
  }

  const uf = UF_POR_NOME[estado];
  if (!uf) {
    return { pontos: [], urlUsada: null, produtoEncontrado: null, unidade: null, diagnostico, aviso: `Estado "${estado}" não reconhecido.` };
  }
  diagnostico.push(`Procurando produto ~"${produto}" na UF ${uf} (${estado}).`);

  const arquivo = await baixarArquivo(diagnostico);
  if (!arquivo) {
    return {
      pontos: [], urlUsada: null, produtoEncontrado: null, unidade: null, diagnostico,
      aviso: 'Nenhum dos endereços candidatos da CONAB respondeu com um arquivo de dados válido. Veja o diagnóstico pra saber o que cada um devolveu.',
    };
  }

  const linhas = arquivo.texto.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) {
    return { pontos: [], urlUsada: arquivo.url, produtoEncontrado: null, unidade: null, diagnostico, aviso: 'Arquivo baixado, mas sem linhas de dados.' };
  }

  const sep = detectarSeparador(linhas[0]);
  const cabecalho = linhas[0].split(sep).map(h => h.trim().toLowerCase());
  diagnostico.push(`Separador detectado: "${sep === '\t' ? 'TAB' : sep}". Colunas: ${cabecalho.join(' | ')}`);

  // Descobre as colunas pelo nome do cabeçalho, sem depender de posição
  // fixa (o layout pode mudar entre atualizações do arquivo).
  const acharColuna = (...termos: string[]) =>
    cabecalho.findIndex(h => termos.some(t => h.includes(t)));

  const colProduto = acharColuna('produto');
  const colUf = acharColuna('uf', 'estado', 'sigla');
  const colValor = acharColuna('preço', 'preco', 'valor');
  const colAno = acharColuna('ano');
  const colMes = acharColuna('mês', 'mes');
  const colData = acharColuna('data', 'período', 'periodo');
  const colUnidade = acharColuna('unidade', 'unid');

  diagnostico.push(`Índices: produto=${colProduto}, uf=${colUf}, valor=${colValor}, ano=${colAno}, mes=${colMes}, data=${colData}, unidade=${colUnidade}`);

  if (colProduto < 0 || colUf < 0 || colValor < 0) {
    return {
      pontos: [], urlUsada: arquivo.url, produtoEncontrado: null, unidade: null, diagnostico,
      aviso: 'O arquivo foi baixado, mas não achei as colunas de produto, UF e valor no cabeçalho. O layout pode ter mudado — veja as colunas no diagnóstico.',
    };
  }

  const MESES: Record<string, string> = {
    'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
    'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12',
  };

  const pontos: PontoConab[] = [];
  let produtoEncontrado: string | null = null;
  let unidade: string | null = null;
  let linhasDoProduto = 0;
  let linhasDaUf = 0;
  // Coleta a nomenclatura real do arquivo. Sem isso, quando a busca não
  // casa, o diagnóstico só diz "não achei" — sem dizer o que EXISTE,
  // deixando a correção no chute.
  const nomesDistintos = new Set<string>();
  // Busca frouxa: pega a primeira palavra significativa do termo pra
  // achar nomes parecidos (ex: "boi" acha "BOI GORDO VIVO").
  const palavraChave = (produto.split('_')[0] || '').toLowerCase();

  for (let i = 1; i < linhas.length; i++) {
    const campos = linhas[i].split(sep);
    if (campos.length <= Math.max(colProduto, colUf, colValor)) continue;

    const nomeProduto = (campos[colProduto] || '').trim();
    if (nomeProduto && nomesDistintos.size < 400) nomesDistintos.add(nomeProduto);
    if (!termoProduto.test(nomeProduto)) continue;
    linhasDoProduto++;

    const ufLinha = (campos[colUf] || '').trim().toUpperCase();
    if (ufLinha !== uf) continue;
    linhasDaUf++;

    if (!produtoEncontrado) produtoEncontrado = nomeProduto;
    if (!unidade && colUnidade >= 0) unidade = (campos[colUnidade] || '').trim();

    // Monta a data a partir de ano+mês ou de uma coluna de data.
    let dataIso: string | null = null;
    if (colAno >= 0 && colMes >= 0) {
      const ano = (campos[colAno] || '').trim();
      const mesBruto = (campos[colMes] || '').trim().toLowerCase();
      const mes = /^\d+$/.test(mesBruto)
        ? String(Number(mesBruto)).padStart(2, '0')
        : MESES[mesBruto.slice(0, 3)];
      if (/^\d{4}$/.test(ano) && mes) dataIso = `${ano}-${mes}-01`;
    } else if (colData >= 0) {
      const bruto = (campos[colData] || '').trim();
      const m1 = bruto.match(/^(\d{4})-(\d{2})/);
      const m2 = bruto.match(/^(\d{2})\/(\d{4})$/);
      const m3 = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m1) dataIso = `${m1[1]}-${m1[2]}-01`;
      else if (m2) dataIso = `${m2[2]}-${m2[1]}-01`;
      else if (m3) dataIso = `${m3[3]}-${m3[2]}-01`;
    }
    if (!dataIso) continue;
    if (dataIso < dataInicio || dataIso > dataFim) continue;

    const preco = normalizarNumero(campos[colValor]);
    if (isNaN(preco) || preco <= 0) continue;

    pontos.push({ data: dataIso, preco });
  }

  pontos.sort((a, b) => a.data.localeCompare(b.data));
  diagnostico.push(`Linhas do produto: ${linhasDoProduto}; dessas, na UF ${uf}: ${linhasDaUf}; dentro do período: ${pontos.length}.`);

  const todosNomes = Array.from(nomesDistintos).sort();
  const parecidos = palavraChave
    ? todosNomes.filter(n => n.toLowerCase().includes(palavraChave))
    : [];
  diagnostico.push(`Produtos distintos no arquivo: ${todosNomes.length}. Parecidos com "${palavraChave}": ${parecidos.length}.`);

  if (pontos.length === 0) {
    return {
      pontos: [], urlUsada: arquivo.url, produtoEncontrado, unidade, diagnostico,
      produtosNoArquivo: todosNomes.slice(0, 120),
      produtosParecidos: parecidos,
      aviso: linhasDoProduto === 0
        ? `O arquivo da CONAB não tem produto com esse nome. Veja "produtosParecidos" e "produtosNoArquivo" pra descobrir a nomenclatura usada pela CONAB.`
        : `A CONAB tem o produto, mas nenhum registro em ${estado} dentro do período pedido.`,
    };
  }

  return { pontos, urlUsada: arquivo.url, produtoEncontrado, unidade, diagnostico };
}
