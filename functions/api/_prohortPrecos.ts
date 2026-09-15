// PREÇOS DE HORTIGRANJEIROS (frutas, legumes, verduras) via
// PROHORT/CONAB — Programa Brasileiro de Modernização do Mercado
// Hortigranjeiro, instituído por portaria do Ministério da Agricultura.
// Reúne preços diários de dezenas de produtos nas principais CEASAs do
// país. Fonte oficial e gratuita.
//
// POR QUE ESSA FONTE: o app não tinha nenhum preço de fruta ou
// hortaliça. A CONAB (arquivo PrecosMensalUF) cobre grãos e boi, mas
// não hortifrúti — esse dado vive no PROHORT.
//
// ESTRATÉGIA DE DESCOBERTA: a pasta /downloads/arquivos/ da CONAB já é
// conhecida e funciona (foi de lá que veio o PrecosMensalUF.txt). Em
// vez de chutar um endereço só, tentamos vários candidatos plausíveis e
// registramos o que cada um devolveu — mesma abordagem que resolveu as
// integrações anteriores deste projeto.
//
// ATENÇÃO AO SIGNIFICADO DO PREÇO: o preço da CEASA é de ATACADO no
// entreposto. Não é o que o produtor recebe (dele ainda se descontam
// comissão, frete e embalagem) nem o preço de supermercado. Isso vai
// explicitado no rótulo, pra ninguém confundir.

// CANDIDATOS AGORA BEM FUNDAMENTADOS: a própria página de downloads da
// CONAB lista os arquivos disponíveis, e entre eles estão "Prohort
// Diário" e "Prohort Mensal". Aplicando a mesma convenção de nome do
// arquivo que JÁ funciona (PrecosMensalUF.txt — sem espaços, sem
// acento, cada palavra capitalizada), estes viram os candidatos mais
// prováveis. Os antigos ficam no fim como reserva.
const CANDIDATOS_PROHORT = [
  'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/ProhortDiario.txt',
  'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/ProhortMensal.txt',
  'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/ProhortDiário.txt',
  'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/prohort-diario.txt',
  'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/ProhortDiario.csv',
  // Reserva: nomes que chutei antes de conhecer a lista oficial.
  'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/PrecosDiariosCeasa.txt',
  'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/PrecosCeasa.txt',
];

export interface PrecoHortifruti {
  produto: string;
  ceasa: string;
  uf: string;
  data: string;
  preco: number;
  unidade: string;
}

export interface ResultadoProhort {
  precos: PrecoHortifruti[];
  urlUsada: string | null;
  produtosDisponiveis: string[];
  diagnostico: string[];
  aviso?: string;
}

// LEITURA EM FLUXO — o diagnóstico provou que ProhortDiario.txt e
// ProhortMensal.txt EXISTEM (os outros candidatos deram 404), mas
// estouram a memória do Worker: "Memory limit exceeded before EOF".
// São preços diários de 40 CEASAs acumulados, então o arquivo é grande
// demais pra carregar inteiro.
//
// Solução: ler o corpo da resposta como fluxo e processar LINHA A
// LINHA, guardando só o que interessa e descartando o resto na hora.
// Assim a memória usada não depende do tamanho do arquivo. Também não
// cacheamos o arquivo (era o que estourava antes) — cacheamos só o
// resultado já filtrado.

const CANDIDATOS_VALIDOS = [
  'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/ProhortDiario.txt',
  'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/ProhortMensal.txt',
];

// Teto de linhas casadas — evita que uma busca ampla (ex: termo vazio)
// acumule memória de novo pelo outro lado.
const MAXIMO_DE_LINHAS = 4000;

interface ResultadoStream {
  cabecalho: string[];
  separador: string;
  linhasCasadas: string[][];
  nomesVistos: Set<string>;
  totalLidas: number;
  url: string;
}

async function lerEmFluxo(
  url: string,
  casaProduto: (nome: string) => boolean,
  indiceProdutoRef: { valor: number },
  diagnostico: string[],
): Promise<ResultadoStream | null> {
  const res = await fetch(url, { headers: { Accept: 'text/csv,text/plain,*/*' } });
  if (!res.ok) {
    diagnostico.push(`${url}: HTTP ${res.status}`);
    return null;
  }
  if (!res.body) {
    diagnostico.push(`${url}: resposta sem corpo legível.`);
    return null;
  }

  const leitor = res.body.getReader();
  // O arquivo da CONAB é Latin-1 (descoberto no outro arquivo deles);
  // stream:true mantém o estado entre pedaços, pra não cortar caractere
  // no meio.
  const decodificador = new TextDecoder('iso-8859-1');
  let sobra = '';
  let cabecalho: string[] = [];
  let separador = ';';
  const linhasCasadas: string[][] = [];
  const nomesVistos = new Set<string>();
  let totalLidas = 0;
  let primeira = true;

  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;

    sobra += decodificador.decode(value, { stream: true });
    const partes = sobra.split(/\r?\n/);
    // A última parte pode estar incompleta — guarda pro próximo pedaço.
    sobra = partes.pop() || '';

    for (const linha of partes) {
      if (!linha.trim()) continue;

      if (primeira) {
        separador = [';', '\t', ','].reduce((m, s) =>
          linha.split(s).length > linha.split(m).length ? s : m, ';');
        cabecalho = linha.split(separador).map(h => h.trim().toLowerCase());
        indiceProdutoRef.valor = cabecalho.findIndex(h => h.includes('produto') || h.includes('descricao'));
        primeira = false;
        continue;
      }

      totalLidas++;
      const campos = linha.split(separador);
      const nome = (campos[indiceProdutoRef.valor] || '').trim();
      if (!nome) continue;
      if (nomesVistos.size < 200) nomesVistos.add(nome);

      if (casaProduto(nome) && linhasCasadas.length < MAXIMO_DE_LINHAS) {
        linhasCasadas.push(campos);
      }
    }
  }

  // Processa o que sobrou sem quebra de linha no fim do arquivo.
  if (sobra.trim() && !primeira) {
    totalLidas++;
    const campos = sobra.split(separador);
    const nome = (campos[indiceProdutoRef.valor] || '').trim();
    if (nome && casaProduto(nome) && linhasCasadas.length < MAXIMO_DE_LINHAS) {
      linhasCasadas.push(campos);
    }
  }

  diagnostico.push(`${url}: OK em fluxo — ${totalLidas} linhas lidas, ${linhasCasadas.length} casaram.`);
  return { cabecalho, separador, linhasCasadas, nomesVistos, totalLidas, url };
}

export async function buscarHortifruti(termoProduto: string, uf?: string): Promise<ResultadoProhort> {
  const diagnostico: string[] = [];
  const termo = termoProduto.trim().toLowerCase();
  const casaProduto = (nome: string) => !termo || nome.toLowerCase().includes(termo);
  const indiceProdutoRef = { valor: -1 };

  let stream: ResultadoStream | null = null;
  for (const url of CANDIDATOS_VALIDOS) {
    try {
      stream = await lerEmFluxo(url, casaProduto, indiceProdutoRef, diagnostico);
      if (stream && stream.cabecalho.length > 1) break;
      stream = null;
    } catch (e: any) {
      diagnostico.push(`${url}: falhou (${e?.message || String(e)}).`);
    }
  }

  if (!stream) {
    return {
      precos: [], urlUsada: null, produtosDisponiveis: [], diagnostico,
      aviso: 'Não foi possível ler o arquivo do PROHORT. Veja o diagnóstico pra saber o que cada endereço devolveu.',
    };
  }

  const cab = stream.cabecalho;
  diagnostico.push(`Colunas: ${cab.join(' | ')}`);
  const achar = (...t: string[]) => cab.findIndex(h => t.some(x => h.includes(x)));

  const cProduto = indiceProdutoRef.valor;
  const cCeasa = achar('ceasa', 'central', 'entreposto', 'mercado');
  const cUf = achar('uf', 'estado', 'sigla');
  const cData = achar('data', 'dia');
  const cValor = achar('preco', 'preço', 'valor');
  const cUnidade = achar('unidade', 'embalagem', 'unid');

  if (cProduto < 0 || cValor < 0) {
    return {
      precos: [], urlUsada: stream.url,
      produtosDisponiveis: Array.from(stream.nomesVistos).sort().slice(0, 120),
      diagnostico,
      aviso: 'Arquivo lido, mas não encontrei as colunas de produto e preço. Veja as colunas no diagnóstico.',
    };
  }

  const precos: PrecoHortifruti[] = [];
  for (const campos of stream.linhasCasadas) {
    const ufLinha = cUf >= 0 ? (campos[cUf] || '').trim().toUpperCase() : '';
    if (uf && ufLinha && ufLinha !== uf.toUpperCase()) continue;

    const valor = Number((campos[cValor] || '').trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
    if (isNaN(valor) || valor <= 0) continue;

    precos.push({
      produto: (campos[cProduto] || '').trim(),
      ceasa: cCeasa >= 0 ? (campos[cCeasa] || '').trim() : '',
      uf: ufLinha,
      data: cData >= 0 ? (campos[cData] || '').trim() : '',
      preco: valor,
      unidade: cUnidade >= 0 ? (campos[cUnidade] || '').trim() : 'R$/kg',
    });
  }

  // Mais recente primeiro — o produtor quer o preço de hoje.
  precos.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  diagnostico.push(`Após filtro de UF e validação de preço: ${precos.length} registros.`);
  return {
    precos,
    urlUsada: stream.url,
    produtosDisponiveis: Array.from(stream.nomesVistos).sort().slice(0, 120),
    diagnostico,
  };
}
