// Leitor mínimo de planilhas .xlsx para os Workers.
//
// Substitui o pacote "xlsx" (SheetJS) do npm, que tem vulnerabilidades
// conhecidas SEM correção publicada no npm (prototype pollution e ReDoS —
// GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) e era usado para ler uma
// planilha baixada de um site externo (EPAGRI/SC).
//
// Escopo propositalmente pequeno: lê nomes de abas e devolve uma aba como
// matriz de strings (equivalente a sheet_to_json({ header: 1, raw: false })
// para o que o app usa). Números saem como texto simples ("320.5"); datas
// (células numéricas com formato de data) saem como "AAAA-MM-DD".
//
// Proteções: limite de tamanho do arquivo compactado e descompactado
// (contra "zip bomb"), limite de linhas/colunas, e só expressões
// regulares lineares (sem backtracking aninhado).

import { unzipSync, strFromU8 } from 'fflate';

const MAX_ARQUIVO = 30 * 1024 * 1024;        // 30 MB compactado
const MAX_DESCOMPACTADO = 150 * 1024 * 1024; // 150 MB somando as partes lidas
const MAX_LINHAS = 500_000;
const MAX_COLUNAS = 16_384; // limite do próprio Excel (XFD)

export interface PlanilhaLida {
  abas: string[];
  lerAba(nome: string): string[][];
}

function decodificarXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (_m, e: string) => {
    if (e === 'lt') return '<';
    if (e === 'gt') return '>';
    if (e === 'amp') return '&';
    if (e === 'quot') return '"';
    if (e === 'apos') return "'";
    const cp = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
  });
}

function atributo(tag: string, nome: string): string | undefined {
  const m = new RegExp(`\\s${nome}="([^"]*)"`).exec(tag);
  return m ? decodificarXml(m[1]) : undefined;
}

// Junta o texto de todos os <t>…</t> (rich text em sharedStrings tem vários).
function textoDosT(xml: string): string {
  let out = '';
  const re = /<t(?:\s[^>]*)?>([^<]*)<\/t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out += decodificarXml(m[1]);
  return out;
}

function colunaParaIndice(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

const FORMATOS_DATA_EMBUTIDOS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function ehFormatoDeData(codigo: string): boolean {
  // Remove trechos entre aspas, [cores/condições] e caracteres escapados.
  const limpo = codigo.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
  return /[dmyhs]/i.test(limpo) && !/^[#0.,%\s]*$/.test(limpo);
}

function serialParaData(serial: number): string {
  // Sistema de datas 1900 do Excel (com o "29/02/1900" fictício).
  const ms = Math.round((serial - 25569) * 86400000);
  const d = new Date(ms);
  return isNaN(d.getTime()) ? String(serial) : d.toISOString().slice(0, 10);
}

export function lerXlsx(buffer: ArrayBuffer | Uint8Array): PlanilhaLida {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength > MAX_ARQUIVO) throw new Error('Planilha grande demais.');

  let totalDescompactado = 0;
  const arquivos = unzipSync(bytes, {
    filter: (f) => {
      const interessa = f.name === 'xl/workbook.xml' || f.name === 'xl/_rels/workbook.xml.rels'
        || f.name === 'xl/sharedStrings.xml' || f.name === 'xl/styles.xml' || f.name.startsWith('xl/worksheets/');
      if (!interessa) return false;
      totalDescompactado += f.originalSize;
      if (totalDescompactado > MAX_DESCOMPACTADO) throw new Error('Planilha descompactada grande demais.');
      return true;
    },
  });
  const ler = (nome: string) => (arquivos[nome] ? strFromU8(arquivos[nome]) : '');

  const workbook = ler('xl/workbook.xml');
  if (!workbook) throw new Error('Arquivo não é uma planilha .xlsx válida.');

  // Abas → arquivo da aba (via relacionamentos).
  const rels = new Map<string, string>();
  for (const m of ler('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\s[^>]*>/g)) {
    const id = atributo(m[0], 'Id');
    let alvo = atributo(m[0], 'Target');
    if (!id || !alvo) continue;
    alvo = alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo}`;
    rels.set(id, alvo);
  }
  const abas = new Map<string, string>();
  for (const m of workbook.matchAll(/<sheet\s[^>]*>/g)) {
    const nome = atributo(m[0], 'name');
    const rid = atributo(m[0], 'r:id');
    const caminho = rid ? rels.get(rid) : undefined;
    if (nome && caminho) abas.set(nome, caminho);
  }

  // Textos compartilhados.
  const compartilhados: string[] = [];
  for (const m of ler('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)) compartilhados.push(textoDosT(m[1]));

  // Estilos: quais índices de estilo são datas.
  const estilosData = new Set<number>();
  const styles = ler('xl/styles.xml');
  const formatosCustom = new Map<number, string>();
  for (const m of styles.matchAll(/<numFmt\s[^>]*>/g)) {
    const id = Number(atributo(m[0], 'numFmtId'));
    const codigo = atributo(m[0], 'formatCode') || '';
    formatosCustom.set(id, codigo);
  }
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] || '';
  let idx = 0;
  for (const m of cellXfs.matchAll(/<xf\s[^>]*>/g)) {
    const fmt = Number(atributo(m[0], 'numFmtId') || 0);
    if (FORMATOS_DATA_EMBUTIDOS.has(fmt) || (formatosCustom.has(fmt) && ehFormatoDeData(formatosCustom.get(fmt)!))) estilosData.add(idx);
    idx++;
  }

  function lerAba(nome: string): string[][] {
    const caminho = abas.get(nome);
    if (!caminho) throw new Error(`Aba "${nome}" não encontrada.`);
    const xml = ler(caminho);
    const linhas: string[][] = [];
    for (const mLinha of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const numLinha = Number(atributo(mLinha[1], 'r')) || linhas.length + 1;
      if (numLinha > MAX_LINHAS) break;
      const linha: string[] = [];
      for (const mCel of mLinha[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = mCel[1];
        const corpo = mCel[2] || '';
        const ref = atributo(attrs, 'r') || '';
        const col = ref ? colunaParaIndice(ref) : linha.length;
        if (col < 0 || col >= MAX_COLUNAS) continue;
        const tipo = atributo(attrs, 't') || 'n';
        const estilo = Number(atributo(attrs, 's') || 0);
        const v = /<v>([^<]*)<\/v>/.exec(corpo)?.[1];
        let valor = '';
        if (tipo === 's') valor = compartilhados[Number(v)] ?? '';
        else if (tipo === 'inlineStr') valor = textoDosT(corpo);
        else if (tipo === 'b') valor = v === '1' ? 'TRUE' : 'FALSE';
        else if (tipo === 'str' || tipo === 'e' || tipo === 'd') valor = v != null ? decodificarXml(v) : '';
        else if (v != null) {
          const num = Number(v);
          valor = Number.isFinite(num) && estilosData.has(estilo) ? serialParaData(num) : v;
        }
        while (linha.length < col) linha.push('');
        linha[col] = valor;
      }
      while (linhas.length < numLinha - 1) linhas.push([]);
      linhas[numLinha - 1] = linha;
    }
    return linhas;
  }

  return { abas: [...abas.keys()], lerAba };
}
