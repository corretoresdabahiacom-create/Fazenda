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

let cacheProhort: { texto: string; url: string } | null = null;

async function baixar(diagnostico: string[]): Promise<{ texto: string; url: string } | null> {
  if (cacheProhort) {
    diagnostico.push(`Arquivo já em cache (${cacheProhort.texto.length} caracteres).`);
    return cacheProhort;
  }
  for (const url of CANDIDATOS_PROHORT) {
    try {
      const res = await fetch(url, { headers: { Accept: 'text/csv,text/plain,*/*' } });
      if (!res.ok) { diagnostico.push(`${url}: HTTP ${res.status}`); continue; }
      const bytes = await res.arrayBuffer();
      // Mesmo cuidado do outro arquivo da CONAB: é Latin-1, não UTF-8.
      const texto = new TextDecoder('iso-8859-1').decode(bytes);
      if (/^\s*<(!doctype|html)/i.test(texto)) {
        diagnostico.push(`${url}: devolveu HTML (página de erro), não dados.`);
        continue;
      }
      if (texto.length < 100) { diagnostico.push(`${url}: resposta curta demais.`); continue; }
      diagnostico.push(`${url}: OK — ${texto.length} caracteres.`);
      cacheProhort = { texto, url };
      return cacheProhort;
    } catch (e: any) {
      diagnostico.push(`${url}: falhou (${e?.message || String(e)}).`);
    }
  }
  return null;
}

export async function buscarHortifruti(termoProduto: string, uf?: string): Promise<ResultadoProhort> {
  const diagnostico: string[] = [];
  const arquivo = await baixar(diagnostico);
  if (!arquivo) {
    return {
      precos: [], urlUsada: null, produtosDisponiveis: [], diagnostico,
      aviso: 'Nenhum dos endereços candidatos do PROHORT respondeu com arquivo de dados. Veja o diagnóstico pra saber o que cada um devolveu.',
    };
  }

  const linhas = arquivo.texto.split(/\r?\n/).filter(l => l.trim());
  const sep = [';', '\t', ','].reduce((m, s) =>
    linhas[0].split(s).length > linhas[0].split(m).length ? s : m, ';');
  const cab = linhas[0].split(sep).map(h => h.trim().toLowerCase());
  diagnostico.push(`Separador: "${sep === '\t' ? 'TAB' : sep}". Colunas: ${cab.join(' | ')}`);

  const achar = (...t: string[]) => cab.findIndex(h => t.some(x => h.includes(x)));
  const cProduto = achar('produto', 'descricao');
  const cCeasa = achar('ceasa', 'central', 'entreposto', 'mercado');
  const cUf = achar('uf', 'estado', 'sigla');
  const cData = achar('data', 'dia');
  const cValor = achar('preco', 'preço', 'valor');
  const cUnidade = achar('unidade', 'embalagem', 'unid');

  if (cProduto < 0 || cValor < 0) {
    return {
      precos: [], urlUsada: arquivo.url, produtosDisponiveis: [], diagnostico,
      aviso: 'Arquivo baixado, mas não encontrei as colunas de produto e preço. Veja as colunas listadas no diagnóstico.',
    };
  }

  const termo = termoProduto.trim().toLowerCase();
  const precos: PrecoHortifruti[] = [];
  const disponiveis = new Set<string>();

  for (let i = 1; i < linhas.length; i++) {
    const c = linhas[i].split(sep);
    const nome = (c[cProduto] || '').trim();
    if (!nome) continue;
    if (disponiveis.size < 200) disponiveis.add(nome);
    if (termo && !nome.toLowerCase().includes(termo)) continue;

    const ufLinha = cUf >= 0 ? (c[cUf] || '').trim().toUpperCase() : '';
    if (uf && ufLinha && ufLinha !== uf.toUpperCase()) continue;

    const valor = Number((c[cValor] || '').trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
    if (isNaN(valor) || valor <= 0) continue;

    precos.push({
      produto: nome,
      ceasa: cCeasa >= 0 ? (c[cCeasa] || '').trim() : '',
      uf: ufLinha,
      data: cData >= 0 ? (c[cData] || '').trim() : '',
      preco: valor,
      unidade: cUnidade >= 0 ? (c[cUnidade] || '').trim() : 'R$/kg',
    });
  }

  diagnostico.push(`Produtos distintos no arquivo: ${disponiveis.size}. Casaram com "${termoProduto}": ${precos.length}.`);
  return { precos, urlUsada: arquivo.url, produtosDisponiveis: Array.from(disponiveis).sort().slice(0, 120), diagnostico };
}
