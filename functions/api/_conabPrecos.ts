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

  // NOMES CONFERIDOS NO CATÁLOGO REAL DO ARQUIVO (1.173 produtos).
  // Bug encontrado: o padrão de leite era /^leite$/i, mas a CONAB
  // chama de "LEITE DE VACA" — nunca casava com nada, e o leite ficava
  // silenciosamente sem dado nenhum.
  leite: /^leite de vaca$/i,

  // Produtos novos, todos com preço de produtor confirmado e cobertura
  // ampla — os números entre parênteses são as UFs com amostra boa.
  banana: /^banana$/i,                          // 27 UF
  tomate: /^tomate$/i,                          // 27 UF
  mandioca_raiz: /^raiz de mandioca$/i,         // 22 UF
  mandioca_farinha: /^farinha de mandioca$/i,   // 21 UF

  // ACUCAR e os demais abaixo NÃO têm preço de produtor no arquivo —
  // são preços de atacado/varejo. Ficam disponíveis, mas o rótulo
  // precisa deixar claro que não é o que o produtor recebe (o aviso
  // automático de nível cuida disso).
  acucar: /^acucar$/i,

  // FERTILIZANTES — o arquivo da CONAB traz dezenas deles. As fórmulas
  // NPK têm formato inconfundível (três números de dois dígitos
  // separados por hífen: "10-10-10", "04-14-08"), o que permite um
  // padrão seguro, sem risco de casar com outra coisa. Os fertilizantes
  // simples entram por nome exato.
  //
  // ATENÇÃO À UNIDADE: fertilizante é insumo, não produto — o preço é
  // o que o produtor PAGA, não o que recebe. Por isso NÃO passam pelo
  // filtro de "preço recebido pelo produtor"; ver tratamento especial
  // em ehInsumo() abaixo.
  fert_npk_10_10_10: /^10-10-10$/,
  fert_npk_20_05_20: /^20-05-20$/,
  fert_npk_08_28_16: /^08-28-16$/,
  fert_npk_04_14_08: /^04-14-08$/,
  fert_npk_00_20_20: /^00-20-20$/,
  fert_ureia: /^ureia$/i,
  fert_superfosfato_simples: /^superfosfato simples$/i,
  fert_superfosfato_triplo: /^superfosfato triplo$/i,
  fert_cloreto_potassio: /^cloreto de pot[áa]ssio$/i,
  fert_map: /^map$/i,
  fert_calcario: /^calc[áa]rio$/i,
};

// Insumos (o produtor COMPRA) x produtos (o produtor VENDE). A
// distinção importa porque o filtro de "preço recebido pelo produtor"
// só faz sentido para o que ele vende — num insumo, o preço relevante
// é justamente o de venda ao produtor.
function ehInsumo(produto: string): boolean {
  return produto.startsWith('fert_');
}

// O arquivo dá o preço em R$/KG (coluna "valor_produto_kg"), mas o
// mercado de bovinos negocia em R$/ARROBA. Sem converter, o gráfico
// misturaria ~R$23 (histórico) com ~R$350 (preço atual) e ficaria
// ilegível. 1 arroba = 15 kg — a mesma conversão que a Planilha de
// Pesagem do app já usa.
// Série com pouquíssimos pontos não é referência confiável: a Paraíba
// tinha arroz a R$0,76 com apenas 3 registros, e Sergipe feijão com 2.
// Um número frágil exibido com a mesma confiança de um robusto engana
// mais do que ajuda — melhor não mostrar e dizer por quê.
const MINIMO_DE_PONTOS = 6;

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
  // Faixas dos produtos novos, calibradas pelo que o catálogo mostrou.
  banana: [0.2, 15], tomate: [0.5, 16],
  mandioca_raiz: [0.1, 8], mandioca_farinha: [1, 22],
  // Fertilizante em R$/kg: adubo formulado costuma ficar entre R$1 e
  // R$10/kg; calcário é bem mais barato.
  fert_npk_10_10_10: [0.5, 15], fert_npk_20_05_20: [0.5, 15],
  fert_npk_08_28_16: [0.5, 15], fert_npk_04_14_08: [0.5, 15],
  fert_npk_00_20_20: [0.5, 15], fert_ureia: [0.5, 15],
  fert_superfosfato_simples: [0.2, 12], fert_superfosfato_triplo: [0.5, 15],
  fert_cloreto_potassio: [0.5, 15], fert_map: [0.5, 20],
  fert_calcario: [0.02, 3],
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
      // BUG REAL DE CODIFICAÇÃO: o arquivo da CONAB é Latin-1
      // (ISO-8859-1), não UTF-8. Lendo com res.text() os acentos viram
      // "�" — o diagnóstico mostrou "PRE�O RECEBIDO P/ PRODUTOR" em vez
      // de "PREÇO". Deu sorte de "PRODUTOR" não ter acento, senão o
      // filtro de nível teria falhado sem aviso. Com fertilizantes
      // ("POTÁSSIO", "SUPERFOSFATO") isso quebraria de verdade.
      // Solução: ler os bytes crus e decodificar como Latin-1.
      const bytes = await res.arrayBuffer();
      const texto = new TextDecoder('iso-8859-1').decode(bytes);
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
    if (nivelLinha && !ehInsumo(produto)) {
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

  // Corte por amostra insuficiente — ver MINIMO_DE_PONTOS.
  if (pontos.length > 0 && pontos.length < MINIMO_DE_PONTOS) {
    diagnostico.push(`Apenas ${pontos.length} ponto(s) — abaixo do mínimo de ${MINIMO_DE_PONTOS}. Série descartada por amostra insuficiente.`);
    return {
      pontos: [], urlUsada: arquivo.url, produtoEncontrado, unidade, diagnostico,
      aviso: `A CONAB tem só ${pontos.length} registro(s) desse produto em ${estado} no período — amostra pequena demais pra servir de referência, então preferimos não exibir.`,
    };
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
  // FALHA MINHA CORRIGIDA: o filtro de nível de comercialização foi
  // aplicado só na busca principal, não aqui. Como o diagnóstico de
  // cobertura usa ESTA função, ele mostrava dados não filtrados — e o
  // teste da correção deu falso negativo.
  const colNivel = acharColuna('nivel_comercializacao', 'nivel', 'comercializacao');

  if (colProduto < 0 || colUf < 0 || colValor < 0 || colAno < 0 || colMes < 0) {
    diagnostico.push('Não encontrei todas as colunas necessárias no cabeçalho.');
    return { produtoBuscado: produto, nomeNoArquivo: null, totalLinhas: 0, estadosCobertos: [], estadosSemDados: [], diagnostico };
  }

  const porUf = new Map<string, { meses: string[]; ultimoValor: number; ultimoMes: string }>();
  const niveisVistos = new Set<string>();
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

    // Mesmo critério da busca principal: só nível de produtor.
    const nivelLinha = colNivel >= 0 ? (campos[colNivel] || '').trim() : '';
    if (nivelLinha) {
      niveisVistos.add(nivelLinha);
      if (!/produtor|produ[çc][ãa]o|lavoura|porta.?da.?fazenda/i.test(nivelLinha)) continue;
    }

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
    .filter(([, reg]) => reg.meses.length >= MINIMO_DE_PONTOS)
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
  if (niveisVistos.size > 0) {
    diagnostico.push(`Níveis de comercialização no arquivo: ${Array.from(niveisVistos).join(' | ')} — só o de produtor foi contado.`);
  }

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


// ---------------------------------------------------------------------
// CATÁLOGO COMPLETO DO ARQUIVO — lista TODOS os produtos existentes,
// com cobertura por estado, faixa de preço e níveis de comercialização.
//
// POR QUE EXISTE: expandir o leque de produtos exige saber o nome EXATO
// que a CONAB usa. Adivinhar não funciona — "BOI GORDO" na verdade é
// "BOI", e padrões abertos misturaram variedades e níveis de mercado.
// Este catálogo devolve a lista real, com dados suficientes pra decidir
// o que vale incluir (e o que descartar por amostra insuficiente),
// numa única consulta.
// ---------------------------------------------------------------------

export interface ItemCatalogo {
  nome: string;
  classificacao: string;
  linhas: number;
  estados: number;
  estadosComAmostraBoa: number;
  precoMin: number;
  precoMax: number;
  niveis: string[];
  temNivelProdutor: boolean;
  ultimoMes: string;
}

export async function catalogoCompleto(filtroClassificacao?: string): Promise<{
  total: number;
  itens: ItemCatalogo[];
  classificacoesDisponiveis: string[];
  diagnostico: string[];
}> {
  const diagnostico: string[] = [];
  const arquivo = await baixarArquivo(diagnostico);
  if (!arquivo) return { total: 0, itens: [], classificacoesDisponiveis: [], diagnostico };

  const linhas = arquivo.texto.split(/\r?\n/).filter(l => l.trim());
  const sep = detectarSeparador(linhas[0]);
  const cab = linhas[0].split(sep).map(h => h.trim().toLowerCase());
  const achar = (...t: string[]) => cab.findIndex(h => t.some(x => h.includes(x)));

  const cProduto = achar('produto');
  const cClasse = achar('classificao', 'classifica');
  const cUf = achar('uf', 'estado', 'sigla');
  const cValor = achar('preço', 'preco', 'valor');
  const cAno = achar('ano');
  const cMes = achar('mês', 'mes');
  const cNivel = achar('nivel_comercializacao', 'nivel', 'comercializacao');

  if (cProduto < 0 || cValor < 0) {
    diagnostico.push('Colunas essenciais não encontradas.');
    return { total: 0, itens: [], classificacoesDisponiveis: [], diagnostico };
  }

  interface Acumulador {
    classificacao: string;
    linhas: number;
    porUf: Map<string, number>;
    min: number;
    max: number;
    niveis: Set<string>;
    ultimoMes: string;
  }
  const mapa = new Map<string, Acumulador>();
  const classes = new Set<string>();

  for (let i = 1; i < linhas.length; i++) {
    const campos = linhas[i].split(sep);
    const nome = (campos[cProduto] || '').trim();
    if (!nome) continue;

    const classe = cClasse >= 0 ? (campos[cClasse] || '').trim() : '';
    if (classe) classes.add(classe);
    if (filtroClassificacao && classe.toLowerCase() !== filtroClassificacao.toLowerCase()) continue;

    const valor = normalizarNumero(campos[cValor]);
    if (isNaN(valor) || valor <= 0) continue;

    const uf = cUf >= 0 ? (campos[cUf] || '').trim().toUpperCase() : '';
    const nivel = cNivel >= 0 ? (campos[cNivel] || '').trim() : '';
    const ano = cAno >= 0 ? (campos[cAno] || '').trim() : '';
    const mesBruto = cMes >= 0 ? (campos[cMes] || '').trim() : '';
    const mes = /^\d+$/.test(mesBruto) ? String(Number(mesBruto)).padStart(2, '0') : '';
    const anoMes = /^\d{4}$/.test(ano) && mes ? `${ano}-${mes}` : '';

    if (!mapa.has(nome)) {
      mapa.set(nome, { classificacao: classe, linhas: 0, porUf: new Map(), min: valor, max: valor, niveis: new Set(), ultimoMes: '' });
    }
    const a = mapa.get(nome)!;
    a.linhas++;
    if (valor < a.min) a.min = valor;
    if (valor > a.max) a.max = valor;
    if (nivel) a.niveis.add(nivel);
    if (uf) a.porUf.set(uf, (a.porUf.get(uf) || 0) + 1);
    if (anoMes > a.ultimoMes) a.ultimoMes = anoMes;
  }

  const itens: ItemCatalogo[] = Array.from(mapa.entries())
    .map(([nome, a]) => ({
      nome,
      classificacao: a.classificacao,
      linhas: a.linhas,
      estados: a.porUf.size,
      // Quantos estados têm amostra suficiente pra virar série confiável.
      estadosComAmostraBoa: Array.from(a.porUf.values()).filter(n => n >= MINIMO_DE_PONTOS).length,
      precoMin: Number(a.min.toFixed(2)),
      precoMax: Number(a.max.toFixed(2)),
      niveis: Array.from(a.niveis),
      temNivelProdutor: Array.from(a.niveis).some(n => /produtor|produ[çc][ãa]o|lavoura/i.test(n)),
      ultimoMes: a.ultimoMes,
    }))
    // Ordena pelo que é mais útil: cobertura ampla primeiro.
    .sort((a, b) => b.estadosComAmostraBoa - a.estadosComAmostraBoa || b.linhas - a.linhas);

  diagnostico.push(`Catálogo: ${itens.length} produtos distintos.`);
  return { total: itens.length, itens, classificacoesDisponiveis: Array.from(classes).sort(), diagnostico };
}


// ---------------------------------------------------------------------
// PRODUTOS DISPONÍVEIS EM UM ESTADO — responde "o que posso oferecer
// para quem está na Bahia?".
//
// POR QUE EXISTE: o catálogo geral filtra por número de estados, o que
// esconde produtos REGIONAIS. Um produto pesquisado só na Bahia e em
// Sergipe some de um filtro "20+ estados", mas é justamente o que
// interessa para o produtor baiano. Esta função olha por estado.
// ---------------------------------------------------------------------

export interface ProdutoNoEstado {
  nome: string;
  pontos: number;
  precoMin: number;
  precoMax: number;
  precoMaisRecente: number;
  ultimoMes: string;
  temNivelProdutor: boolean;
  niveis: string[];
}

export async function produtosDoEstado(uf: string): Promise<{
  uf: string;
  total: number;
  produtos: ProdutoNoEstado[];
  diagnostico: string[];
}> {
  const diagnostico: string[] = [];
  const arquivo = await baixarArquivo(diagnostico);
  if (!arquivo) return { uf, total: 0, produtos: [], diagnostico };

  const linhas = arquivo.texto.split(/\r?\n/).filter(l => l.trim());
  const sep = detectarSeparador(linhas[0]);
  const cab = linhas[0].split(sep).map(h => h.trim().toLowerCase());
  const achar = (...t: string[]) => cab.findIndex(h => t.some(x => h.includes(x)));

  const cProduto = achar('produto');
  const cUf = achar('uf', 'estado', 'sigla');
  const cValor = achar('preço', 'preco', 'valor');
  const cAno = achar('ano');
  const cMes = achar('mês', 'mes');
  const cNivel = achar('nivel_comercializacao', 'nivel', 'comercializacao');

  if (cProduto < 0 || cUf < 0 || cValor < 0) {
    diagnostico.push('Colunas essenciais não encontradas.');
    return { uf, total: 0, produtos: [], diagnostico };
  }

  const alvo = uf.trim().toUpperCase();
  interface Acc {
    pontos: number; min: number; max: number;
    ultimoMes: string; ultimoValor: number;
    niveis: Set<string>;
  }
  const mapa = new Map<string, Acc>();

  for (let i = 1; i < linhas.length; i++) {
    const campos = linhas[i].split(sep);
    if ((campos[cUf] || '').trim().toUpperCase() !== alvo) continue;

    const nome = (campos[cProduto] || '').trim();
    if (!nome) continue;

    const valor = normalizarNumero(campos[cValor]);
    if (isNaN(valor) || valor <= 0) continue;

    const nivel = cNivel >= 0 ? (campos[cNivel] || '').trim() : '';
    // Só conta o nível de produtor — é o preço que interessa a quem
    // vende. Sem esse recorte, atacado e varejo inflariam a contagem e
    // distorceriam a faixa de preço (foi o que gerou spreads de 4x).
    if (nivel && !/produtor|produ[çc][ãa]o|lavoura/i.test(nivel)) continue;

    const ano = cAno >= 0 ? (campos[cAno] || '').trim() : '';
    const mesBruto = cMes >= 0 ? (campos[cMes] || '').trim() : '';
    const mes = /^\d+$/.test(mesBruto) ? String(Number(mesBruto)).padStart(2, '0') : '';
    const anoMes = /^\d{4}$/.test(ano) && mes ? `${ano}-${mes}` : '';

    if (!mapa.has(nome)) {
      mapa.set(nome, { pontos: 0, min: valor, max: valor, ultimoMes: '', ultimoValor: valor, niveis: new Set() });
    }
    const a = mapa.get(nome)!;
    a.pontos++;
    if (valor < a.min) a.min = valor;
    if (valor > a.max) a.max = valor;
    if (nivel) a.niveis.add(nivel);
    if (anoMes > a.ultimoMes) { a.ultimoMes = anoMes; a.ultimoValor = valor; }
  }

  const produtos: ProdutoNoEstado[] = Array.from(mapa.entries())
    // Mesmo corte de amostra usado no resto: série curta demais não
    // vira referência confiável.
    .filter(([, a]) => a.pontos >= MINIMO_DE_PONTOS)
    .map(([nome, a]) => ({
      nome,
      pontos: a.pontos,
      precoMin: Number(a.min.toFixed(2)),
      precoMax: Number(a.max.toFixed(2)),
      precoMaisRecente: Number(a.ultimoValor.toFixed(2)),
      ultimoMes: a.ultimoMes,
      temNivelProdutor: a.niveis.size > 0,
      niveis: Array.from(a.niveis),
    }))
    .sort((a, b) => b.pontos - a.pontos);

  diagnostico.push(`${alvo}: ${produtos.length} produtos com preço de produtor e amostra de ${MINIMO_DE_PONTOS}+ pontos.`);
  return { uf: alvo, total: produtos.length, produtos, diagnostico };
}
