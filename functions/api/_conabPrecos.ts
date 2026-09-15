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
// NOMENCLATURA REAL DA CONAB — descoberta pelo diagnóstico, não
// chutada. O arquivo usa nomes curtos e em MAIÚSCULAS ("BOI", não "BOI
// GORDO"), e mistura produtos agrícolas com INSUMOS (adubos como
// "10-10-10", defensivos como "ABAMECTIN", mão de obra como
// "ADMINISTRADOR RURAL"). Por isso os padrões abaixo são ANCORADOS
// (^...$): um padrão frouxo como /boi/ casaria com insumos que
// contenham essas letras, e plotaríamos preço de adubo como se fosse
// preço de boi.
const TERMOS_PRODUTO: Record<string, RegExp> = {
  boi_gordo: /^boi$/i,
  vaca: /^vaca$/i,
  novilho: /^(novilho|garrote)$/i,
  novilha: /^novilha$/i,
  bezerro: /^bezerro$/i,
  bezerra: /^bezerra$/i,
  soja: /^soja$/i,
  milho: /^milho$/i,
  // PADRÕES FECHADOS: antes eram abertos no fim (/^arroz/, /^feijao/,
  // /^cafe/) e casavam com VÁRIAS variedades ao mesmo tempo — "ARROZ EM
  // CASCA" (grão do produtor) somado com "ARROZ BENEFICIADO"
  // (empacotado), que têm preços 4x diferentes. O resultado eram
  // variações absurdas entre estados (Ceará R$1,31 vs Paraíba R$5,99),
  // que pareciam diferença regional mas eram produtos distintos
  // misturados. Fechados até sabermos o nome exato de cada variedade
  // (use /api/diagnostico-conab-variantes pra descobrir).
  cafe: /^cafe$/i,
  algodao: /^algodao em pluma$/i,
  arroz: /^arroz$/i,
  feijao: /^feijao$/i,
  trigo: /^trigo$/i,
  sorgo: /^sorgo$/i,
  leite: /^leite$/i,
  acucar: /^acucar$/i,
};

// O arquivo dá o preço em R$/KG (coluna "valor_produto_kg"), mas o
// mercado de bovinos negocia em R$/ARROBA. Sem converter, o gráfico
// misturaria ~R$23 (histórico) com ~R$350 (preço atual) e ficaria
// ilegível. 1 arroba = 15 kg — a mesma conversão que a Planilha de
// Pesagem do app já usa.
const PRODUTOS_EM_ARROBA = new Set(['boi_gordo', 'vaca', 'novilho', 'novilha']);
const KG_POR_ARROBA = 15;

// Faixa plausível DEPOIS da conversão. Serve de rede de segurança
// contra premissa errada de unidade — mesma ideia já usada em
// _marketQuote.ts.
const FAIXAS_PLAUSIVEIS: Record<string, [number, number]> = {
  boi_gordo: [100, 700], vaca: [80, 650], novilho: [80, 650], novilha: [80, 650],
  soja: [40, 300], milho: [10, 150], cafe: [200, 4000], algodao: [1, 40],
  arroz: [20, 200], feijao: [1, 30], trigo: [15, 200], sorgo: [10, 120],
  leite: [0.5, 8], acucar: [0.5, 10],
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
  const colNivel = acharColuna('nivel_comercializacao', 'nivel', 'comercializacao');

  diagnostico.push(`Índices: produto=${colProduto}, uf=${colUf}, valor=${colValor}, ano=${colAno}, mes=${colMes}, data=${colData}, unidade=${colUnidade}, nivel=${colNivel}`);

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
  const amostraBruta: string[] = [];
  let forasDaFaixa = 0;
  let descartadosPorNivel = 0;
  const niveisVistos = new Set<string>();
  // Cesta alternativa: se NENHUMA linha for do nível "produtor",
  // preferimos mostrar outro nível (avisando) do que deixar o gráfico
  // vazio. Zerar o dado por excesso de rigor seria pior que mostrar
  // preço de atacado identificado como tal.
  const pontosOutroNivel: PontoConab[] = [];
  let nivelAlternativoUsado: string | null = null;
  let nivelDaLinhaAtual: string | null = null;
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

    // CAUSA RAIZ DAS VARIAÇÕES ABSURDAS ENTRE ESTADOS: o mesmo produto
    // aparece em NÍVEIS DE COMERCIALIZAÇÃO diferentes (produtor,
    // atacado, varejo). Arroz a R$1,31/kg no produtor e R$5,99/kg no
    // varejo não é diferença regional — é a margem da cadeia. Somar os
    // dois dava spreads de 4x que pareciam erro de dado.
    //
    // O usuário deste app é PRODUTOR: o preço que importa é o que ele
    // recebe. Filtramos por esse nível; se a linha não disser o nível,
    // aceitamos (melhor ter o dado do que descartar por omissão).
    const nivelLinha = colNivel >= 0 ? (campos[colNivel] || '').trim() : '';
    if (nivelLinha) {
      niveisVistos.add(nivelLinha);
      const ehProdutor = /produtor|produ[çc][ãa]o|lavoura|porta.?da.?fazenda/i.test(nivelLinha);
      if (!ehProdutor) {
        descartadosPorNivel++;
        nivelDaLinhaAtual = nivelLinha; // guarda pra cesta alternativa
      } else {
        nivelDaLinhaAtual = null;
      }
    } else {
      nivelDaLinhaAtual = null;
    }

    if (!produtoEncontrado) produtoEncontrado = nomeProduto;
    if (!unidade) unidade = PRODUTOS_EM_ARROBA.has(produto) ? 'R$/@ (convertido de R$/kg)' : 'R$/kg';

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

    const precoBruto = normalizarNumero(campos[colValor]);
    if (isNaN(precoBruto) || precoBruto <= 0) continue;

    if (amostraBruta.length < 3) amostraBruta.push(`${dataIso}: ${precoBruto}`);

    // Converte kg -> arroba nos bovinos. NÃO confio cegamente na
    // conversão: o arquivo não diz se o peso é vivo ou de carcaça, e
    // essa diferença daria quase o dobro. Por isso validamos contra a
    // faixa plausível do produto — se o resultado cair fora, é sinal de
    // que a premissa está errada, e preferimos descartar a mostrar um
    // número que parece certo mas não é.
    const preco = PRODUTOS_EM_ARROBA.has(produto) ? precoBruto * KG_POR_ARROBA : precoBruto;
    const faixa = FAIXAS_PLAUSIVEIS[produto];
    if (faixa && (preco < faixa[0] || preco > faixa[1])) {
      forasDaFaixa++;
      continue;
    }

    if (nivelDaLinhaAtual) {
      pontosOutroNivel.push({ data: dataIso, preco });
      if (!nivelAlternativoUsado) nivelAlternativoUsado = nivelDaLinhaAtual;
    } else {
      pontos.push({ data: dataIso, preco });
    }
  }

  pontos.sort((a, b) => a.data.localeCompare(b.data));
  diagnostico.push(`Linhas do produto: ${linhasDoProduto}; dessas, na UF ${uf}: ${linhasDaUf}; dentro do período: ${pontos.length}; descartadas por ficarem fora da faixa plausível após conversão: ${forasDaFaixa}.`);
  if (niveisVistos.size > 0) {
    diagnostico.push(`Níveis de comercialização encontrados para esse produto/UF: ${Array.from(niveisVistos).join(' | ')}. Descartados por não serem do produtor: ${descartadosPorNivel}.`);
  }
  if (amostraBruta.length > 0) {
    diagnostico.push(`Valores BRUTOS do arquivo (antes de qualquer conversão): ${amostraBruta.join(' | ')}${PRODUTOS_EM_ARROBA.has(produto) ? ` — multiplicados por ${KG_POR_ARROBA} para virar R$/arroba` : ''}.`);
  }

  // Se não houve nenhum preço de produtor, cai pra outro nível avisando.
  let avisoNivel: string | undefined;
  if (pontos.length === 0 && pontosOutroNivel.length > 0) {
    pontos.push(...pontosOutroNivel);
    avisoNivel = `A CONAB não publica preço de produtor pra esse produto em ${estado} — os valores mostrados são do nível "${nivelAlternativoUsado}", que costuma ser mais alto que o recebido pelo produtor.`;
    diagnostico.push(`Sem preço de produtor; usando nível "${nivelAlternativoUsado}" (${pontosOutroNivel.length} pontos).`);
  }

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

  return { pontos, urlUsada: arquivo.url, produtoEncontrado, unidade, diagnostico, aviso: avisoNivel };
}


// ---------------------------------------------------------------------
// COBERTURA POR ESTADO — responde "quais estados a CONAB cobre para
// este produto?". Serve pra saber, sem adivinhar, onde o gráfico vai
// usar dado do estado certo e onde vai cair na fonte de reserva
// (IPEADATA/Paraná) com aviso.
// ---------------------------------------------------------------------

export interface CoberturaUf {
  uf: string;
  estado: string;
  pontos: number;
  primeiroMes: string;
  ultimoMes: string;
  precoMaisRecente: number;
}

export interface ResultadoCobertura {
  produtoBuscado: string;
  nomeNoArquivo: string | null;
  totalLinhas: number;
  estadosCobertos: CoberturaUf[];
  estadosSemDados: string[];
  diagnostico: string[];
}

const NOME_POR_UF: Record<string, string> = Object.fromEntries(
  Object.entries(UF_POR_NOME).map(([nome, uf]) => [uf, nome])
);

export async function coberturaPorEstado(produto: string): Promise<ResultadoCobertura> {
  const diagnostico: string[] = [];
  const termoProduto = TERMOS_PRODUTO[produto];

  if (!termoProduto) {
    return { produtoBuscado: produto, nomeNoArquivo: null, totalLinhas: 0, estadosCobertos: [], estadosSemDados: [], diagnostico: [`Produto "${produto}" não mapeado.`] };
  }

  const arquivo = await baixarArquivo(diagnostico);
  if (!arquivo) {
    return { produtoBuscado: produto, nomeNoArquivo: null, totalLinhas: 0, estadosCobertos: [], estadosSemDados: [], diagnostico };
  }

  const linhas = arquivo.texto.split(/\r?\n/).filter(l => l.trim());
  const sep = detectarSeparador(linhas[0]);
  const cabecalho = linhas[0].split(sep).map(h => h.trim().toLowerCase());
  const acharColuna = (...termos: string[]) => cabecalho.findIndex(h => termos.some(t => h.includes(t)));

  const colProduto = acharColuna('produto');
  const colUf = acharColuna('uf', 'estado', 'sigla');
  const colValor = acharColuna('preço', 'preco', 'valor');
  const colAno = acharColuna('ano');
  const colMes = acharColuna('mês', 'mes');

  if (colProduto < 0 || colUf < 0 || colValor < 0 || colAno < 0 || colMes < 0) {
    diagnostico.push('Não encontrei todas as colunas necessárias no cabeçalho.');
    return { produtoBuscado: produto, nomeNoArquivo: null, totalLinhas: 0, estadosCobertos: [], estadosSemDados: [], diagnostico };
  }

  const porUf = new Map<string, { meses: string[]; ultimoValor: number; ultimoMes: string }>();
  let nomeNoArquivo: string | null = null;
  let totalLinhas = 0;

  for (let i = 1; i < linhas.length; i++) {
    const campos = linhas[i].split(sep);
    if (campos.length <= Math.max(colProduto, colUf, colValor, colAno, colMes)) continue;

    const nome = (campos[colProduto] || '').trim();
    if (!termoProduto.test(nome)) continue;
    totalLinhas++;
    if (!nomeNoArquivo) nomeNoArquivo = nome;

    const uf = (campos[colUf] || '').trim().toUpperCase();
    if (!uf) continue;

    const ano = (campos[colAno] || '').trim();
    const mesBruto = (campos[colMes] || '').trim();
    const mes = /^\d+$/.test(mesBruto) ? String(Number(mesBruto)).padStart(2, '0') : '';
    if (!/^\d{4}$/.test(ano) || !mes) continue;
    const anoMes = `${ano}-${mes}`;

    const bruto = normalizarNumero(campos[colValor]);
    if (isNaN(bruto) || bruto <= 0) continue;
    const preco = PRODUTOS_EM_ARROBA.has(produto) ? bruto * KG_POR_ARROBA : bruto;

    if (!porUf.has(uf)) porUf.set(uf, { meses: [], ultimoValor: preco, ultimoMes: anoMes });
    const reg = porUf.get(uf)!;
    reg.meses.push(anoMes);
    if (anoMes > reg.ultimoMes) { reg.ultimoMes = anoMes; reg.ultimoValor = preco; }
  }

  const estadosCobertos: CoberturaUf[] = Array.from(porUf.entries())
    .map(([uf, reg]) => {
      const ordenados = reg.meses.slice().sort();
      return {
        uf,
        estado: NOME_POR_UF[uf] || uf,
        pontos: reg.meses.length,
        primeiroMes: ordenados[0],
        ultimoMes: ordenados[ordenados.length - 1],
        precoMaisRecente: Number(reg.ultimoValor.toFixed(2)),
      };
    })
    .sort((a, b) => a.estado.localeCompare(b.estado));

  const cobertos = new Set(estadosCobertos.map(e => e.estado));
  const estadosSemDados = Object.keys(UF_POR_NOME).filter(nome => !cobertos.has(nome)).sort();

  diagnostico.push(`Produto "${nomeNoArquivo}": ${totalLinhas} linhas, ${estadosCobertos.length} estado(s) com dado.`);

  return { produtoBuscado: produto, nomeNoArquivo, totalLinhas, estadosCobertos, estadosSemDados, diagnostico };
}


// ---------------------------------------------------------------------
// VARIEDADES DE UM PRODUTO — lista todos os nomes do arquivo que
// começam com um termo, com quantas linhas e a faixa de preço de cada
// um.
//
// POR QUE EXISTE: padrões abertos no fim (ex: /^arroz/) casam com
// "ARROZ EM CASCA" (grão bruto do produtor) E "ARROZ BENEFICIADO"
// (empacotado), que têm preços 4x diferentes. Somar os dois no mesmo
// gráfico produz números sem sentido — foi exatamente o que aconteceu
// com arroz, feijão e café. Este diagnóstico mostra as variedades pra
// escolher a certa em vez de adivinhar.
// ---------------------------------------------------------------------

export interface VarianteProduto {
  nome: string;
  linhas: number;
  precoMin: number;
  precoMax: number;
  ufs: number;
}

export async function listarVariantes(termo: string): Promise<{ variantes: VarianteProduto[]; diagnostico: string[] }> {
  const diagnostico: string[] = [];
  const arquivo = await baixarArquivo(diagnostico);
  if (!arquivo) return { variantes: [], diagnostico };

  const linhas = arquivo.texto.split(/\r?\n/).filter(l => l.trim());
  const sep = detectarSeparador(linhas[0]);
  const cab = linhas[0].split(sep).map(h => h.trim().toLowerCase());
  const achar = (...t: string[]) => cab.findIndex(h => t.some(x => h.includes(x)));
  const colProduto = achar('produto');
  const colUf = achar('uf', 'estado', 'sigla');
  const colValor = achar('preço', 'preco', 'valor');
  if (colProduto < 0 || colValor < 0) return { variantes: [], diagnostico: [...diagnostico, 'Colunas não encontradas.'] };

  const termoBaixo = termo.toLowerCase();
  const mapa = new Map<string, { linhas: number; min: number; max: number; ufs: Set<string> }>();

  for (let i = 1; i < linhas.length; i++) {
    const campos = linhas[i].split(sep);
    const nome = (campos[colProduto] || '').trim();
    if (!nome.toLowerCase().includes(termoBaixo)) continue;
    const valor = normalizarNumero(campos[colValor]);
    if (isNaN(valor) || valor <= 0) continue;
    const uf = (campos[colUf] || '').trim().toUpperCase();

    if (!mapa.has(nome)) mapa.set(nome, { linhas: 0, min: valor, max: valor, ufs: new Set() });
    const r = mapa.get(nome)!;
    r.linhas++;
    if (valor < r.min) r.min = valor;
    if (valor > r.max) r.max = valor;
    if (uf) r.ufs.add(uf);
  }

  const variantes = Array.from(mapa.entries())
    .map(([nome, r]) => ({
      nome, linhas: r.linhas,
      precoMin: Number(r.min.toFixed(2)),
      precoMax: Number(r.max.toFixed(2)),
      ufs: r.ufs.size,
    }))
    .sort((a, b) => b.linhas - a.linhas);

  diagnostico.push(`Termo "${termo}": ${variantes.length} variedade(s) distinta(s) no arquivo.`);
  return { variantes, diagnostico };
}
