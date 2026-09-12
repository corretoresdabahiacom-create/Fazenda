/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { isPriceAnomalous, extractNumber, findPriceCell } from '../lib/priceSanity';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DashboardBahia from './DashboardBahia';
import AlertasCotacoes from './AlertasCotacoes';
import GraficoPrecoClima from './GraficoPrecoClima';
import {
  TrendingUp, TrendingDown, Search, RefreshCw, ExternalLink, AlertTriangle, MapPin, Navigation, Globe,
} from 'lucide-react';

interface ProductDef { id: string; label: string; backendKey: string; filter?: RegExp }

// Palavras-chave para achar a linha certa na tabela oficial do IEA-SP
// (Governo de São Paulo) pra cada produto — usado pra mostrar o dado
// oficial ao lado do dado de mercado, quando os dois existirem.
const IEA_KEYWORDS: Record<string, RegExp> = {
  boi_gordo: /^boi gordo$/i,
  vaca: /vaca gorda/i,
  novilho: /garrote/i,
  novilha: /novilha/i,
  milho: /^milho$/i,
  soja: /^soja$/i,
  cafe_arabica: /café ar[aá]bico|café benef/i,
  cafe_conilon: /café robusta/i,
  arroz: /arroz/i,
  feijao: /feij[aã]o/i,
  laranja: /laranja/i,
  mandioca: /mandioca/i,
  amendoim: /amendoim/i,
  ovos: /ovo/i,
  suinos: /su[ií]no/i,
};

const INCAPER_KEYWORDS: Record<string, RegExp> = {
  boi_gordo: /boi gordo/i,
  vaca: /vaca gorda/i,
};

const AIBA_KEYWORDS: Record<string, RegExp> = {
  soja: /soja dispon[ií]vel/i,
  milho: /^milho$/i,
  sorgo: /sorgo/i,
  algodao: /algod[ãa]o pluma/i,
  cafe_arabica: /^café$/i,
  cafe_conilon: /^café$/i,
  feijao: /feij[ãa]o/i,
  arroz: /arroz/i,
};

const PRODUCTS: ProductDef[] = [
  { id: 'boi_gordo', label: 'Boi Gordo', backendKey: 'boi_gordo', filter: /indicador do boi\b|\bboi gordo\b/i },
  { id: 'vaca', label: 'Vaca', backendKey: 'boi_gordo', filter: /indicador da vaca\b|vaca gorda/i },
  { id: 'novilho', label: 'Novilho (Garrote)', backendKey: 'boi_gordo', filter: /garrote/i },
  { id: 'novilha', label: 'Novilha', backendKey: 'boi_gordo', filter: /indicador da novilha\b|novilha/i },
  { id: 'cafe_arabica', label: 'Café Arábica', backendKey: 'cafe', filter: /ar[aá]bica/i },
  { id: 'cafe_conilon', label: 'Café Conilon', backendKey: 'cafe', filter: /conilon|robusta/i },
  { id: 'algodao', label: 'Algodão', backendKey: 'algodao' },
  { id: 'soja', label: 'Soja', backendKey: 'soja' },
  { id: 'milho', label: 'Milho', backendKey: 'milho' },
  { id: 'trigo', label: 'Trigo', backendKey: 'trigo' },
  { id: 'laranja', label: 'Laranja', backendKey: 'laranja' },
  { id: 'acucar', label: 'Açúcar', backendKey: 'acucar' },
  { id: 'suinos', label: 'Suínos', backendKey: 'suinos' },
  { id: 'frango', label: 'Frango', backendKey: 'frango' },
  { id: 'leite', label: 'Leite', backendKey: 'leite' },
  { id: 'arroz', label: 'Arroz', backendKey: 'arroz' },
  { id: 'feijao', label: 'Feijão', backendKey: 'feijao' },
  { id: 'cacau', label: 'Cacau', backendKey: 'cacau' },
  { id: 'amendoim', label: 'Amendoim', backendKey: 'amendoim' },
  { id: 'sorgo', label: 'Sorgo', backendKey: 'sorgo' },
  { id: 'ovos', label: 'Ovos', backendKey: 'ovos' },
  { id: 'mandioca', label: 'Mandioca', backendKey: 'mandioca' },
  { id: 'frutas', label: 'Frutas (Manga, Limão e outras)', backendKey: 'frutas' },
];

const PAISES = ['Brasil'];

const ESTADOS = [
  'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal', 'Espírito Santo',
  'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba',
  'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul',
  'Rondônia', 'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins',
];

const UF_POR_ESTADO: Record<string, string> = {
  'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM', 'Bahia': 'BA', 'Ceará': 'CE',
  'Distrito Federal': 'DF', 'Espírito Santo': 'ES', 'Goiás': 'GO', 'Maranhão': 'MA',
  'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG', 'Pará': 'PA',
  'Paraíba': 'PB', 'Paraná': 'PR', 'Pernambuco': 'PE', 'Piauí': 'PI', 'Rio de Janeiro': 'RJ',
  'Rio Grande do Norte': 'RN', 'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR',
  'Santa Catarina': 'SC', 'São Paulo': 'SP', 'Sergipe': 'SE', 'Tocantins': 'TO',
};

// Capital + cidades de maior peso econômico/produtivo de cada estado —
// usado só para ORDENAR as cidades que já têm dado real confirmado
// (capital e praças importantes aparecem primeiro na lista), nunca para
// inventar uma cidade sem cotação de verdade.
const CIDADES_PRIORITARIAS: Record<string, string[]> = {
  'Acre': ['Rio Branco', 'Cruzeiro do Sul'],
  'Alagoas': ['Maceió', 'Arapiraca'],
  'Amapá': ['Macapá'],
  'Amazonas': ['Manaus', 'Parintins'],
  'Bahia': ['Salvador', 'Feira de Santana', 'Barreiras', 'Itaberaba', 'Ilhéus', 'Alagoinhas', 'Itabuna', 'Vitória da Conquista'],
  'Ceará': ['Fortaleza', 'Juazeiro do Norte'],
  'Distrito Federal': ['Brasília'],
  'Espírito Santo': ['Vitória', 'Cachoeiro de Itapemirim'],
  'Goiás': ['Goiânia', 'Rio Verde', 'Anápolis'],
  'Maranhão': ['São Luís', 'Imperatriz', 'Balsas'],
  'Mato Grosso': ['Cuiabá', 'Rondonópolis', 'Sorriso', 'Sinop'],
  'Mato Grosso do Sul': ['Campo Grande', 'Dourados'],
  'Minas Gerais': ['Belo Horizonte', 'Uberlândia', 'Uberaba', 'Triângulo Mineiro'],
  'Pará': ['Belém', 'Marabá', 'Santarém'],
  'Paraíba': ['João Pessoa', 'Campina Grande'],
  'Paraná': ['Curitiba', 'Londrina', 'Maringá', 'Cascavel'],
  'Pernambuco': ['Recife', 'Petrolina'],
  'Piauí': ['Teresina', 'Bom Jesus'],
  'Rio de Janeiro': ['Rio de Janeiro', 'Campos dos Goytacazes'],
  'Rio Grande do Norte': ['Natal', 'Mossoró'],
  'Rio Grande do Sul': ['Porto Alegre', 'Passo Fundo', 'Santa Maria'],
  'Rondônia': ['Porto Velho', 'Ji-Paraná'],
  'Roraima': ['Boa Vista'],
  'Santa Catarina': ['Florianópolis', 'Chapecó', 'Joaçaba'],
  'São Paulo': ['São Paulo', 'Ribeirão Preto', 'Bauru', 'Araçatuba', 'Barretos'],
  'Sergipe': ['Aracaju'],
  'Tocantins': ['Palmas', 'Araguaína'],
};

const FUTURES_PATTERN = /pregão|futuro|vencimento/i;

function checkPriceAnomaly(produto: string, row: string[] | undefined): { isAnomaly: boolean; value: number | null } {
  if (!row) return { isAnomaly: false, value: null };
  const priceCell = findPriceCell(row);
  if (!priceCell) return { isAnomaly: false, value: null };
  return { isAnomaly: isPriceAnomalous(produto, priceCell), value: extractNumber(priceCell) };
}

function checkSimplePriceAnomaly(produto: string, priceStr: string | undefined): boolean {
  return isPriceAnomalous(produto, priceStr);
}

interface CambioEntry { compra: number; venda: number; variacaoPct: number; atualizadoEm: string }

interface CambioData {
  usd: CambioEntry | null; eur: CambioEntry | null; jpy: CambioEntry | null;
  cny: CambioEntry | null; rub: CambioEntry | null;
  xau: CambioEntry | null; btc: CambioEntry | null;
  dolarFuturoB3: { valor: string; vencimento: string } | null;
  debug?: string[];
}

interface ParsedTable { heading: string; source: string; rows: string[][] }

interface CotacoesResponse {
  produto: string; sourceUrl: string; tables: ParsedTable[];
  mercadoInternacional?: { pais: string; valor: number; unidade: string; fonte: string } | null;
  fetchedAt: string; error?: string;
}


function classifyTable(table: ParsedTable): 'futuro' | 'atual' {
  const heading = table.heading.toLowerCase();
  const firstRow = (table.rows[0] || []).join(' ').toLowerCase();
  const isFutures =
    FUTURES_PATTERN.test(heading) ||
    /contrato|vencimento|mês\s*\/\s*ano/.test(firstRow) ||
    /^(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/\d{2,4}/i.test((table.rows[1]?.[0] || ''));
  return isFutures ? 'futuro' : 'atual';
}

function detectCurrency(headerRow: string[] | undefined): string {
  if (!headerRow) return 'R$';
  const joined = headerRow.join(' ');
  if (/us\$/i.test(joined)) return 'US$';
  return 'R$';
}

interface RegionMatch { row: string[]; exact: boolean }

function findRegionRow(table: ParsedTable, region: string, uf?: string, estadoNome?: string): RegionMatch | null {
  if (!region) return null;
  const term = region.toLowerCase();
  const exactMatch = table.rows.slice(1).find(row => row.some(cell => cell.toLowerCase().includes(term)));
  if (exactMatch) return { row: exactMatch, exact: true };
  const nearestMatch = table.rows.slice(1).find(row => row.some(cell => {
    if (uf && new RegExp(`\\b${uf}\\b`, 'i').test(cell)) return true;
    if (estadoNome && cell.toLowerCase().includes(estadoNome.toLowerCase())) return true;
    return false;
  }));
  if (nearestMatch) return { row: nearestMatch, exact: false };
  return null;
}

function buildEstadosTable(tables: ParsedTable[]): { estado: string; valor: string }[] {
  const found = new Map<string, string>();
  for (const table of tables) {
    if (classifyTable(table) !== 'atual') continue;
    for (const row of table.rows.slice(1)) {
      for (const estado of ESTADOS) {
        if (found.has(estado)) continue;
        const uf = UF_POR_ESTADO[estado];
        const matches = row.some(cell => cell.toLowerCase().includes(estado.toLowerCase()) || new RegExp(`\\b${uf}\\b`).test(cell));
        if (matches) {
          const priceCell = findPriceCell(row);
          if (priceCell) found.set(estado, priceCell);
        }
      }
    }
  }
  return Array.from(found.entries()).map(([estado, valor]) => ({ estado, valor }));
}

function CambioCard({ label, entry, flag, decimals = 4 }: { label: string; entry: CambioEntry | null; flag: string; decimals?: number }) {
  if (!entry) {
    return (
      <div className="bg-theme-card rounded-2xl border border-theme p-3 min-w-0">
        <p className="text-[11px] text-theme-secondary truncate">{flag} {label}</p>
        <p className="text-xs text-theme-secondary mt-1">Indisponível</p>
      </div>
    );
  }
  const isUp = entry.variacaoPct >= 0;
  // Números grandes (Bitcoin, Ouro em contextos de alta) quebram o
  // layout de 2 colunas — nesse caso empilha Compra/Venda um embaixo do
  // outro em vez de lado a lado, e reduz a fonte.
  const formatted = entry.venda.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const isLongValue = formatted.length > 9;
  return (
    <div className="bg-theme-card rounded-2xl border border-theme p-3 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between mb-1.5 gap-1">
        <p className="text-[11px] font-bold text-theme-secondary truncate">{flag} {label}</p>
        {entry.variacaoPct !== 0 && (
          <span className={`text-[9px] font-bold flex items-center gap-0.5 shrink-0 ${isUp ? 'text-green-600' : 'text-red-500'}`}>
            {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {entry.variacaoPct}%
          </span>
        )}
      </div>
      <div className={isLongValue ? 'space-y-1' : 'grid grid-cols-2 gap-1.5'}>
        <div className="min-w-0">
          <p className="text-[9px] uppercase text-theme-secondary">Compra</p>
          <p className="text-xs font-bold text-theme-primary truncate">R$ {entry.compra.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[9px] uppercase text-theme-secondary">Venda</p>
          <p className="text-xs font-bold text-theme-primary truncate">R$ {formatted}</p>
        </div>
      </div>
    </div>
  );
}

// Botão "Ver fonte" — mostra de onde veio o dado (nome, data/hora
// exatas, e link pra fonte original) em qualquer cotação exibida.
// Implementado como <details> nativo, sem estado extra em React.
function VerFonte({ fonte, dataHora, url }: { fonte: string; dataHora?: string; url: string }) {
  return (
    <details className="mt-1.5 text-[10px]">
      <summary className="cursor-pointer font-semibold text-theme-secondary underline decoration-dotted select-none">Ver fonte</summary>
      <div className="mt-1 pl-2 border-l-2 border-theme space-y-0.5">
        <p className="text-theme-secondary"><span className="font-bold">Fonte:</span> {fonte}</p>
        {dataHora && <p className="text-theme-secondary"><span className="font-bold">Data/hora:</span> {dataHora}</p>}
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] font-semibold underline break-all">
            {url}
          </a>
        ) : (
          <p className="text-theme-secondary italic">Sem link externo — dado cadastrado manualmente.</p>
        )}
      </div>
    </details>
  );
}

function Badge({ kind }: { kind: 'atual' | 'futuro' }) {
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
      kind === 'futuro' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
    }`}>
      {kind === 'futuro' ? 'Futuro B3' : 'Mercado Atual'}
    </span>
  );
}

export default function Cotacoes({ defaultRegion }: { defaultRegion?: string }) {
  const [cambio, setCambio] = useState<CambioData | null>(null);
  const [cambioError, setCambioError] = useState<string | null>(null);

  const [produto, setProduto] = useState('boi_gordo');
  const [produtoTemp, setProdutoTemp] = useState('boi_gordo');
  const [isProdutoModalOpen, setIsProdutoModalOpen] = useState(false);

  const [pais] = useState('Brasil');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState(defaultRegion || '');
  const [regiao, setRegiao] = useState('');
  const [detectingLocal, setDetectingLocal] = useState(false);
  const [showAllCities, setShowAllCities] = useState(false);
  const [showBahiaDashboard, setShowBahiaDashboard] = useState(false);
  const [showGrafico, setShowGrafico] = useState(false);
  const [locaisDisponiveis, setLocaisDisponiveis] = useState<any[]>([]);

  const [data, setData] = useState<CotacoesResponse | null>(null);
  const [teData, setTeData] = useState<{ nomeExibido: string; preco: number; unidade: string; sourceUrl?: string; fetchedAt?: string } | null>(null);
  const [boiMundoData, setBoiMundoData] = useState<{ paises: { pais: string; atual: string; haUmAno: string }[]; unidade: string; sourceUrl?: string; fetchedAt?: string } | null>(null);
  const [ieaData, setIeaData] = useState<{ recebidosPelosProdutores: { produto: string; unidade: string; preco: string }[]; mercadoInternoInternacional: { produto: string; mercado: string; unidade: string; preco: string }[]; sourceUrl?: string; fetchedAt?: string } | null>(null);
  const [incaperData, setIncaperData] = useState<{ precos: { produto: string; minimo: string; medio: string; maximo: string }[]; sourceUrl?: string; fetchedAt?: string } | null>(null);
  const [epagriData, setEpagriData] = useState<{ boiGordo: { data: string; preco: number; praca?: string } | null; vacaGorda: { data: string; preco: number; praca?: string } | null; sourceUrl?: string; fetchedAt?: string } | null>(null);
  const [aibaData, setAibaData] = useState<{ rows: { produto: string; unidade: string; preco: string; variacaoPct: string; data: string }[]; sourceUrl?: string; fetchedAt?: string } | null>(null);
  const [datagroData, setDatagroData] = useState<{ precos: Record<string, string>; titulo: string | null; sourceUrl: string; fetchedAt: string } | null>(null);
  const [scotPracasData, setScotPracasData] = useState<{ pracas: any[]; estadosCobertos: string[]; fechamento: string | null; sourceUrl: string; fetchedAt: string } | null>(null);
  const [cooperfeiraData, setCooperfeiraData] = useState<{ praca: string; estado: string; preco: string; unidade: string; sourceUrl: string; fetchedAt: string; aviso: string } | null>(null);
  const [precosManuais, setPrecosManuais] = useState<any[]>([]);
  const [produtosManuais, setProdutosManuais] = useState<any[]>([]);
  const [localizacoesManuais, setLocalizacoesManuais] = useState<any[]>([]);
  const [pecuariaData, setPecuariaData] = useState<{ rows: { data: string; SP: string; MS: string; MG: string; GO: string; MT: string; RJ: string }[]; unidade: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const produtoDef = PRODUCTS.find(p => p.id === produto)!;

  useEffect(() => {
    fetch('/api/cambio')
      .then(res => res.json())
      .then(json => { if (json.error) setCambioError(json.error); else setCambio(json); })
      .catch(() => setCambioError('Não foi possível carregar o câmbio agora.'));
  }, []);

  function loadCotacoes() {
    setLoading(true);
    setError(null);
    fetch(`/api/cotacoes?produto=${produtoDef.backendKey}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) {
          // Fonte principal (Notícias Agrícolas) falhou — tenta o
          // endpoint unificado /api/quotes como reserva geral, já que
          // ele mesmo tenta várias fontes secundárias (IEA-SP, Incaper,
          // Epagri, AIBA, TradingEconomics, Boi no Mundo) dependendo do
          // produto e estado. Generaliza o failover pra todos os
          // produtos, não só Boi Gordo.
          fetch(`/api/quotes?product=${produto}${estado ? `&state=${encodeURIComponent(estado)}` : ''}`)
            .then(r => r.json())
            .then(quotesData => {
              const melhor = quotesData?.quotes?.[0];
              if (!melhor) { setError(json.error); return; }
              setError(null);
              setData({
                produto: produtoDef.backendKey,
                sourceUrl: melhor.sourceUrl,
                tables: [{
                  heading: `${melhor.productLabel} (fonte de reserva)`,
                  source: `${melhor.source} (reserva — fonte principal indisponível)`,
                  rows: [['Local', 'Preço'], [melhor.marketPlace || melhor.state || melhor.region || 'Referência', `${melhor.price.toFixed(2)} ${melhor.unit}`]],
                }],
                fetchedAt: melhor.fetchedAt,
              });
            })
            .catch(() => setError(json.error));
        } else {
          setData(json);
        }
      })
      .catch(() => setError('Não foi possível carregar as cotações agora. Tente novamente em instantes.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCotacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produto]);

  // Busca SEM filtro de estado, pra descobrir de verdade quais estados
  // e locais têm cotação real pra esse produto — usado pra montar os
  // seletores de Estado/Cidade dinamicamente, em vez de mostrar os 27
  // estados sempre (auditoria externa apontou isso corretamente: antes
  // a lista de estados era fixa, independente de existir dado ou não).
  // Essa MESMA busca também alimenta os alertas (antes havia uma
  // chamada separada e redundante a /api/quotes só com filtro de
  // estado — removida, já que dá pra filtrar isso aqui mesmo no
  // navegador a partir do resultado já carregado).
  useEffect(() => {
    fetch(`/api/quotes?product=${produto}`)
      .then(res => res.json())
      .then(json => { if (!json.error) setLocaisDisponiveis(json.quotes || []); else setLocaisDisponiveis([]); })
      .catch(() => setLocaisDisponiveis([]));
  }, [produto]);

  useEffect(() => {
    if (produto !== 'boi_gordo') { setTeData(null); return; }
    fetch(`/api/tradingeconomics?produto=boi_gordo`)
      .then(res => res.json())
      .then(json => { if (!json.error) setTeData(json); else setTeData(null); })
      .catch(() => setTeData(null));
  }, [produto]);

  useEffect(() => {
    fetch('/api/iea-sp')
      .then(res => res.json())
      .then(json => { if (!json.error) setIeaData(json); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/incaper-es')
      .then(res => res.json())
      .then(json => { if (!json.error) setIncaperData(json); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/epagri-sc')
      .then(res => res.json())
      .then(json => { if (!json.error) setEpagriData(json); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/aiba-ba')
      .then(res => res.json())
      .then(json => { if (!json.error) setAibaData(json); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (produto !== 'boi_gordo') { setCooperfeiraData(null); return; }
    fetch('/api/cooperfeira-ba')
      .then(res => res.json())
      .then(json => { if (!json.error) setCooperfeiraData(json); else setCooperfeiraData(null); })
      .catch(() => setCooperfeiraData(null));
  }, [produto]);

  // Cotações lançadas manualmente no Painel Admin — cada uma sabe seu
  // produtoId/localizacaoId, resolvidos aqui pros nomes de verdade.
  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'cotacoesManuais_precos'), snap => setPrecosManuais(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'cotacoesManuais_produtos'), snap => setProdutosManuais(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'cotacoesManuais_localizacoes'), snap => setLocalizacoesManuais(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  useEffect(() => {
    if (!['boi_gordo', 'vaca', 'novilho', 'novilha'].includes(produto)) { setScotPracasData(null); return; }
    fetch('/api/scot-pracas')
      .then(res => res.json())
      .then(json => { if (!json.error) setScotPracasData(json); else setScotPracasData(null); })
      .catch(() => setScotPracasData(null));
  }, [produto]);

  useEffect(() => {
    if (produto !== 'boi_gordo') { setDatagroData(null); return; }
    fetch('/api/datagro-girodoboi')
      .then(res => res.json())
      .then(json => { if (!json.error) setDatagroData(json); else setDatagroData(null); })
      .catch(() => setDatagroData(null));
  }, [produto]);

  useEffect(() => {
    if (produto !== 'boi_gordo') { setPecuariaData(null); return; }
    fetch('/api/pecuaria-com-br')
      .then(res => res.json())
      .then(json => { if (!json.error) setPecuariaData(json); else setPecuariaData(null); })
      .catch(() => setPecuariaData(null));
  }, [produto]);

  useEffect(() => {
    if (!['boi_gordo', 'vaca', 'novilho', 'novilha'].includes(produto)) { setBoiMundoData(null); return; }
    fetch('/api/scot-boi-mundo')
      .then(res => res.json())
      .then(json => { if (!json.error) setBoiMundoData(json); else setBoiMundoData(null); })
      .catch(() => setBoiMundoData(null));
  }, [produto]);

  function handleDetectLocal() {
    if (!navigator.geolocation) return;
    setDetectingLocal(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/reverse-geocode?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
          const json = await res.json();
          if (json.state && ESTADOS.includes(json.state)) setEstado(json.state);
          if (json.city) setCidade(json.city);
        } finally {
          setDetectingLocal(false);
        }
      },
      () => setDetectingLocal(false),
      { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false },
    );
  }

  const filteredTables = data ? (() => {
    const matched = produtoDef.filter ? data.tables.filter(t => produtoDef.filter!.test(t.heading)) : data.tables;
    // Quando várias tabelas batem no mesmo filtro (ex: "Indicador do Boi
    // Gordo Esalq/B3" e "Boi Gordo - Média SP a prazo" são coisas
    // diferentes, mas ambas contêm "Boi Gordo"), prioriza a que tem
    // "Indicador" no título — é a referência oficial CEPEA/ESALQ, mais
    // confiável que variantes regionais/a prazo.
    return [...matched].sort((a, b) => {
      const aIndicador = /indicador/i.test(a.heading) ? 0 : 1;
      const bIndicador = /indicador/i.test(b.heading) ? 0 : 1;
      return aIndicador - bIndicador;
    });
  })() : [];
  const atualTables = filteredTables.filter(t => classifyTable(t) === 'atual');
  const futuroTables = filteredTables.filter(t => classifyTable(t) === 'futuro');

  const uf = estado ? UF_POR_ESTADO[estado] : undefined;
  const localBusca = cidade || regiao || estado;

  // Estados com dado REAL pra esse produto — derivado das cotações de
  // verdade, não de uma lista fixa (antes ESTADOS listava os 27 sempre,
  // mesmo sem nenhuma fonte pra maioria deles).
  const estadosComDado: string[] = Array.from(
    new Set<string>([
      ...locaisDisponiveis.filter(q => q.state).map(q => q.state as string),
      // Praças da Scot também contam como cobertura real de estado —
      // sem isso, o dropdown ficava quase vazio pra bovinos, mesmo
      // tendo dado de 20 estados disponível.
      ...(scotPracasData?.estadosCobertos || []),
    ])
  ).sort((a, b) => a.localeCompare(b));

  // Deriva o que os alertas precisam a partir do que JÁ foi buscado —
  // antes havia uma segunda chamada de API só pra isso, redundante com
  // locaisDisponiveis (que já tem tudo, sem filtro de estado).
  const quotesResponse = {
    quotes: estado ? locaisDisponiveis.filter(q => q.state === estado || !q.state) : locaisDisponiveis,
    semCotacaoDisponivel: 0, // já filtrado no backend antes de chegar aqui — nenhuma linha sem preço passa
  };

  // Locais (praça/região/município) dentro do estado selecionado que
  // realmente têm preço — usado no seletor de Cidade/Praça no lugar do
  // datalist antigo. Prioriza marketPlace > municipality > region,
  // usando o mais específico que a fonte tiver informado.
  // Regiões (praça ampla, ex: "Oeste da Bahia") dentro do estado
  // selecionado que realmente têm dado — nível distinto de "cidade",
  // porque a fonte às vezes só informa região sem detalhar município
  // (ex: AIBA), e forçar os dois no mesmo campo escondia essa diferença.
  const regioesNoEstado: string[] = estado
    ? Array.from(new Set<string>(
        locaisDisponiveis.filter(q => q.state === estado && q.region).map(q => q.region as string)
      )).sort((a, b) => a.localeCompare(b))
    : [];

  // Locais (praça/município) dentro do estado selecionado — se uma
  // região também foi escolhida, filtra só os locais daquela região;
  // senão, mostra todos os locais do estado, com ou sem região.
  const locaisNoEstado: string[] = estado
    ? Array.from(new Set<string>([
        ...locaisDisponiveis
          .filter(q => q.state === estado && (!regiao || q.region === regiao))
          .map(q => (q.marketPlace || q.municipality) as string)
          .filter(Boolean),
        // Praças da Scot naquele estado (ex: "SP Barretos", "BA Oeste")
        // — é o dado mais granular que temos pra bovinos.
        ...(scotPracasData?.pracas || [])
          .filter((p: any) => p.estado === estado)
          .map((p: any) => p.praca as string),
        // Feira de Santana entra como praça real quando a Cooperfeira
        // respondeu com dado de verdade (nunca aparece "vazia").
        ...(estado === 'Bahia' && cooperfeiraData ? ['Feira de Santana'] : []),
      ])).sort((a, b) => a.localeCompare(b))
    : [];

  const realCities = data ? (() => {
    const found = new Set<string>();
    const MESES_RE = /^(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/\d{2,4}$/i;
    // Só busca em tabelas "atuais" — tabelas de futuro têm mês/contrato
    // na primeira coluna (ex: "Dezembro/2026"), não cidade, e por isso
    // não devem entrar na lista de sugestão de local. Também exclui
    // siglas soltas de 2 letras (ex: "SP" sozinho, de uma tabela "por
    // estado") — não representam uma cidade específica pra essa busca,
    // e clicar nelas não batia com a tabela principal (bug real
    // encontrado: os botões apareciam mas não mudavam o preço mostrado).
    for (const t of filteredTables) {
      if (classifyTable(t) !== 'atual') continue;
      for (const row of t.rows.slice(1)) {
        const cell = row[0]?.trim();
        if (!cell || cell.length < 2 || cell.length > 40) continue;
        if (/^\d/.test(cell) || /r\$|us\$/i.test(cell)) continue;
        if (MESES_RE.test(cell)) continue;
        if (/^[a-z]{2}$/i.test(cell)) continue; // sigla de UF sozinha
        if (estado) {
          const matches = cell.toLowerCase().includes(estado.toLowerCase()) || (uf && new RegExp(`\\b${uf}\\b`, 'i').test(cell));
          if (!matches) continue;
        }
        found.add(cell);
      }
    }
    const all = Array.from(found);
    const prioridade = estado ? CIDADES_PRIORITARIAS[estado] || [] : [];
    // Ordena colocando primeiro as cidades prioritárias (capital e polos
    // importantes) que realmente têm dado, depois o restante em ordem
    // alfabética — nunca mostra cidade sem dado real por trás.
    return all.sort((a, b) => {
      const pa = prioridade.findIndex(p => a.toLowerCase().includes(p.toLowerCase()));
      const pb = prioridade.findIndex(p => b.toLowerCase().includes(p.toLowerCase()));
      if (pa !== -1 && pb === -1) return -1;
      if (pa === -1 && pb !== -1) return 1;
      if (pa !== -1 && pb !== -1) return pa - pb;
      return a.localeCompare(b);
    });
  })() : [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm text-theme-secondary">Preços de mercado agropecuário e câmbio, buscados em tempo real.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowBahiaDashboard(!showBahiaDashboard)}
            className={`text-xs font-bold px-3 py-2 rounded-xl border ${showBahiaDashboard ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-theme text-theme-secondary'}`}
          >
            🗺️ {showBahiaDashboard ? 'Esconder Dashboard Bahia' : 'Ver Dashboard Bahia'}
          </button>
          <button
            onClick={() => setShowGrafico(!showGrafico)}
            className={`text-xs font-bold px-3 py-2 rounded-xl border ${showGrafico ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-theme text-theme-secondary'}`}
          >
            📊 {showGrafico ? 'Esconder Gráfico Preço × Clima' : 'Ver Gráfico Preço × Clima'}
          </button>
        </div>
      </div>

      {showBahiaDashboard && <DashboardBahia />}
      {showGrafico && <GraficoPrecoClima produto={produto} produtoLabel={produtoDef.label} estado={estado} cidade={cidade} />}
      <div>
        {cambioError && <p className="text-xs text-red-500 bg-red-50 rounded-xl p-2 mb-2">{cambioError}</p>}
        <p className="text-[10px] font-bold text-theme-secondary uppercase mb-1.5">Moedas</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
          <CambioCard label="Dólar (USD)" entry={cambio?.usd ?? null} flag="🇺🇸" decimals={4} />
          <CambioCard label="Euro (EUR)" entry={cambio?.eur ?? null} flag="🇪🇺" decimals={4} />
          <CambioCard label="Iene (JPY)" entry={cambio?.jpy ?? null} flag="🇯🇵" decimals={4} />
          <CambioCard label="Yuan (CNY)" entry={cambio?.cny ?? null} flag="🇨🇳" decimals={4} />
          <CambioCard label="Rublo (RUB)" entry={cambio?.rub ?? null} flag="🇷🇺" decimals={4} />
        </div>
        <p className="text-[10px] font-bold text-theme-secondary uppercase mb-1.5">Outros ativos</p>
        <div className="grid grid-cols-2 gap-2">
          <CambioCard label="Ouro (grama)" entry={cambio?.xau ?? null} flag="🥇" decimals={2} />
          <CambioCard label="Bitcoin (BTC)" entry={cambio?.btc ?? null} flag="₿" decimals={0} />
        </div>
        {cambio?.dolarFuturoB3 && (
          <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-blue-800">
              📈 Dólar Futuro (B3){cambio.dolarFuturoB3.vencimento ? ` — vencimento ${cambio.dolarFuturoB3.vencimento}` : ''}
            </p>
            <p className="text-sm font-bold text-blue-800">{cambio.dolarFuturoB3.valor}</p>
          </div>
        )}
      </div>

      <div className="bg-theme-card rounded-2xl border border-theme p-4 space-y-3">
        <button
          onClick={() => { setProdutoTemp(produto); setIsProdutoModalOpen(true); }}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-theme bg-theme-secondary text-left"
        >
          <div>
            <p className="text-[10px] uppercase text-theme-secondary font-bold">Produto selecionado</p>
            <p className="text-sm font-bold text-theme-primary">{produtoDef.label}</p>
          </div>
          <span className="text-xs font-bold text-[var(--primary)]">Trocar</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-bold text-theme-secondary uppercase block mb-0.5 ml-1">País</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" size={16} />
              <select value={pais} disabled className="w-full pl-9 pr-3 py-2 bg-theme-secondary border border-theme rounded-xl text-sm appearance-none opacity-80 truncate">
                {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[9px] font-bold text-theme-secondary uppercase block mb-0.5 ml-1">Estado</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" size={16} />
              <select
                value={estado}
                onChange={e => { setEstado(e.target.value); setRegiao(''); setCidade(''); setShowAllCities(false); }}
                className="w-full pl-9 pr-3 py-2 bg-theme-secondary border border-theme rounded-xl text-sm appearance-none truncate"
              >
                <option value="">Todos os estados</option>
                {estadosComDado.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[9px] font-bold text-theme-secondary uppercase block mb-0.5 ml-1">Região/Praça</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" size={16} />
              <select
                value={regiao}
                onChange={e => { setRegiao(e.target.value); setCidade(''); }}
                disabled={!estado || regioesNoEstado.length === 0}
                className="w-full pl-9 pr-3 py-2 bg-theme-secondary border border-theme rounded-xl text-sm appearance-none disabled:opacity-60 truncate"
              >
                <option value="">{!estado ? 'Escolha estado' : regioesNoEstado.length === 0 ? 'Sem região' : 'Todas as regiões'}</option>
                {regioesNoEstado.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[9px] font-bold text-theme-secondary uppercase block mb-0.5 ml-1">Cidade</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" size={16} />
              <select
                value={cidade}
                onChange={e => setCidade(e.target.value)}
                disabled={!estado || locaisNoEstado.length === 0}
                className="w-full pl-9 pr-3 py-2 bg-theme-secondary border border-theme rounded-xl text-sm appearance-none disabled:opacity-60 truncate"
              >
                <option value="">{!estado ? 'Escolha estado' : locaisNoEstado.length === 0 ? 'Sem cidade/praça' : 'Todas as cidades'}</option>
                {locaisNoEstado.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        {estado && estadosComDado.length === 0 && (
          <p className="text-[10px] text-amber-600">Nenhum estado tem cotação específica pra {produtoDef.label} ainda — mostrando referência geral do Brasil.</p>
        )}
        {realCities.length > 0 && (
          <div>
            <p className="text-[10px] text-theme-secondary mb-1">
              Cidades com cotação disponível para {produtoDef.label}{estado ? ` em ${estado}` : ''} — capital e praças importantes primeiro:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(showAllCities ? realCities : realCities.slice(0, 8)).map(c => (
                <button
                  key={c}
                  onClick={() => {
                    // Se o valor clicado for na verdade um nome de
                    // estado (ex: vindo da tabela "Estados da
                    // Federação"), seleciona o estado certo também —
                    // sem isso, cliques como esse nunca ativavam a
                    // fonte oficial correspondente (bug real corrigido).
                    const estadoCorrespondente = ESTADOS.find(e => e.toLowerCase() === c.toLowerCase());
                    if (estadoCorrespondente) { setEstado(estadoCorrespondente); setCidade(''); }
                    else setCidade(c);
                  }}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${cidade === c ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-theme text-theme-secondary'}`}
                >
                  {c}
                </button>
              ))}
              {realCities.length > 8 && (
                <button onClick={() => setShowAllCities(!showAllCities)} className="text-[10px] font-bold px-2 py-1 rounded-full border border-dashed border-theme text-[var(--primary)]">
                  {showAllCities ? 'Ver menos' : `Ver todas (${realCities.length})`}
                </button>
              )}
            </div>
          </div>
        )}
        <button
          onClick={handleDetectLocal}
          disabled={detectingLocal}
          className="flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-theme text-theme-secondary disabled:opacity-60 w-full sm:w-auto"
        >
          <Navigation size={14} /> {detectingLocal ? 'Detectando...' : 'Usar minha localização'}
        </button>
        <p className="text-[10px] text-theme-secondary">
          Outros países além do Brasil ainda não têm fonte de dados integrada — em breve. A cobertura de cidades varia por produto: quando a cidade exata não tem dado, mostramos o local mais próximo do mesmo estado.
        </p>
        <p className="text-[10px] text-theme-secondary">
          Fontes oficiais/regionais em implementação gradual — hoje cobrimos <strong>São Paulo</strong> (IEA-SP), <strong>Espírito Santo</strong> (Incaper), <strong>Santa Catarina</strong> (Epagri/Cepa) e <strong>Bahia — grãos do Oeste</strong> (AIBA). Outros estados usam as fontes de mercado (Notícias Agrícolas/Scot Consultoria/Datagro).
        </p>
      </div>

      {isProdutoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-theme-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-theme">
              <h3 className="font-bold text-theme-primary text-sm">Escolha o produto</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {PRODUCTS.map(p => (
                <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer ${produtoTemp === p.id ? 'bg-[var(--primary-soft)]' : ''}`}>
                  <input type="radio" name="produto-modal" checked={produtoTemp === p.id} onChange={() => setProdutoTemp(p.id)} className="accent-[var(--primary)]" />
                  <span className={`text-sm ${produtoTemp === p.id ? 'font-bold text-[var(--primary)]' : 'text-theme-primary'}`}>{p.label}</span>
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-theme flex gap-2">
              <button onClick={() => setIsProdutoModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-theme text-theme-secondary font-semibold text-sm">Cancelar</button>
              <button onClick={() => { setProduto(produtoTemp); setEstado(''); setRegiao(''); setCidade(''); setShowAllCities(false); setIsProdutoModalOpen(false); }} className="flex-1 py-2.5 rounded-xl bg-[var(--primary)] text-white font-bold text-sm">Ok</button>
            </div>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-theme-secondary text-center py-8">Buscando cotações...</p>}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Não foi possível buscar as cotações agora</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
            <button onClick={loadCotacoes} className="text-xs font-bold text-red-700 underline mt-2 flex items-center gap-1">
              <RefreshCw size={12} /> Tentar novamente
            </button>
          </div>
        </div>
      )}

      {!loading && !error && data && (() => {
        const primaryAtual = atualTables[0];
        const regionMatch = primaryAtual ? findRegionRow(primaryAtual, localBusca, uf, estado) : null;
        const displayRow = regionMatch?.row || primaryAtual?.rows[1];
        const priceCheck = checkPriceAnomaly(produto, displayRow);

        // Quando o estado escolhido tem uma fonte OFICIAL real (SP, ES,
        // SC, Bahia), ela deve ser o valor PRINCIPAL mostrado — não a
        // referência nacional genérica (Cepea/Esalq), que é a mesma
        // pra qualquer estado e por isso "não muda" quando o usuário
        // troca de local.
        //
        // BUG REAL ENCONTRADO E CORRIGIDO: os botões de sugestão de
        // cidade só atualizavam "cidade", nunca o dropdown "estado" —
        // então clicar num botão como "Bahia" ou "SP" nunca ativava essa
        // verificação (que checava só o dropdown). Agora deriva o
        // estado efetivo tanto do dropdown quanto do texto livre digitado
        // ou clicado no campo de cidade, cobrindo os dois casos.
        const estadoEfetivo = estado || (() => {
          const termo = cidade.toLowerCase();
          if (/^sp$|são paulo/i.test(termo)) return 'São Paulo';
          if (/^es$|esp[ií]rito santo/i.test(termo)) return 'Espírito Santo';
          if (/^sc$|santa catarina/i.test(termo)) return 'Santa Catarina';
          if (/^ba$|bahia/i.test(termo)) return 'Bahia';
          if (/^go$|goi[áa]s/i.test(termo)) return 'Goiás';
          if (/^mg$|minas gerais/i.test(termo)) return 'Minas Gerais';
          if (/^ms$|mato grosso do sul/i.test(termo)) return 'Mato Grosso do Sul';
          if (/^mt$|^mato grosso$/i.test(termo)) return 'Mato Grosso';
          if (/^pa$|^par[áa]$/i.test(termo)) return 'Pará';
          if (/^ro$|rond[ôo]nia/i.test(termo)) return 'Rondônia';
          if (/^to$|tocantins/i.test(termo)) return 'Tocantins';
          if (/^rs$|rio grande do sul/i.test(termo)) return 'Rio Grande do Sul';
          return '';
        })();

        const officialOverride = (() => {
          // Cotação manual (cadastrada no Painel Admin) — prioridade
          // máxima, porque é um dado que você mesmo conferiu e lançou,
          // pensado justamente pra suprir a falta de fonte automática
          // num local/produto específico.
          if (estadoEfetivo) {
            const produtoManual = produtosManuais.find((p: any) => p.nome?.toLowerCase() === produtoDef.label.toLowerCase().split(' (')[0]);
            if (produtoManual) {
              const locaisDoEstado = localizacoesManuais.filter((l: any) => l.estado === estadoEfetivo);
              const idsLocaisDoEstado = new Set(locaisDoEstado.map((l: any) => l.id));
              let candidatos = precosManuais.filter((p: any) => p.produtoId === produtoManual.id && idsLocaisDoEstado.has(p.localizacaoId));
              if (cidade) {
                const termo = cidade.toLowerCase();
                const comCidade = candidatos.filter((p: any) => {
                  const loc = localizacoesManuais.find((l: any) => l.id === p.localizacaoId);
                  return loc?.local?.toLowerCase().includes(termo);
                });
                if (comCidade.length > 0) candidatos = comCidade;
              }
              if (candidatos.length > 0) {
                // Pega o mais recente lançado.
                const maisRecente = [...candidatos].sort((a, b) => (b.dataCotacao || '').localeCompare(a.dataCotacao || ''))[0];
                const local = localizacoesManuais.find((l: any) => l.id === maisRecente.localizacaoId);
                const prazoTexto = maisRecente.prazoDias > 0 ? `, ${maisRecente.prazoDias}d de prazo` : ', à vista';
                const tipoTexto = maisRecente.tipoNegocio !== 'nao_informado' ? `, ${maisRecente.tipoNegocio}` : '';
                return {
                  fonte: `Cadastro Manual — ${local?.local || estadoEfetivo}`,
                  preco: maisRecente.preco.toFixed(2),
                  unidade: `${maisRecente.unidade.replace('R$/', '')}${prazoTexto}${tipoTexto}`,
                  sourceUrl: '',
                  fetchedAt: maisRecente.atualizadoEm || maisRecente.dataCotacao,
                };
              }
            }
          }

          // Cooperfeira — cotação real da praça de Feira de Santana
          // (BA), baseada em negócios do frigorífico Frifeira. Vem
          // primeiro quando o usuário busca essa praça especificamente,
          // porque é o dado mais local que temos pra lá.
          if (produto === 'boi_gordo' && cooperfeiraData &&
              (/feira de santana/i.test(cidade) || (estadoEfetivo === 'Bahia' && /feira/i.test(cidade)))) {
            return {
              fonte: 'Cooperfeira / Frifeira — Feira de Santana',
              preco: cooperfeiraData.preco,
              unidade: cooperfeiraData.unidade,
              sourceUrl: cooperfeiraData.sourceUrl,
              fetchedAt: cooperfeiraData.fetchedAt,
            };
          }
          // Scot Consultoria por praça — a fonte mais granular que temos
          // pra bovinos (33 praças em 20 estados, com Boi Gordo à vista,
          // a prazo, e Vaca Gorda). Vem PRIMEIRO quando o usuário
          // escolheu uma praça/cidade específica, porque é o dado mais
          // próximo do local dele. Sem praça escolhida, entra depois das
          // fontes oficiais de governo.
          const buscarScotPraca = (exigirPracaExata: boolean) => {
            if (!scotPracasData || !['boi_gordo', 'vaca'].includes(produto)) return null;
            const candidatas = scotPracasData.pracas.filter((p: any) => !estadoEfetivo || p.estado === estadoEfetivo);
            if (candidatas.length === 0) return null;
            let escolhida = candidatas[0];
            if (cidade) {
              const termo = cidade.toLowerCase();
              const exata = candidatas.find((p: any) =>
                p.praca?.toLowerCase().includes(termo) || p.regiao?.toLowerCase().includes(termo));
              if (exata) escolhida = exata;
              else if (exigirPracaExata) return null;
            } else if (exigirPracaExata) return null;

            const valor = produto === 'vaca' ? escolhida.vacaGorda : escolhida.boiGordoVista;
            if (!valor) return null;
            return {
              fonte: `Scot Consultoria — ${escolhida.praca}`,
              preco: valor,
              unidade: escolhida.unidade.replace('R$/', ''),
              sourceUrl: scotPracasData.sourceUrl,
              fetchedAt: scotPracasData.fetchedAt,
            };
          };

          const scotExata = buscarScotPraca(true);
          if (scotExata) return scotExata;

          if (estadoEfetivo === 'São Paulo' && ieaData) {
            const keyword = IEA_KEYWORDS[produto];
            const row = keyword ? ieaData.recebidosPelosProdutores.find(r => keyword.test(r.produto)) : null;
            if (row) return { fonte: 'IEA-SP', preco: row.preco, unidade: row.unidade, sourceUrl: ieaData.sourceUrl, fetchedAt: ieaData.fetchedAt };
          }
          if (estadoEfetivo === 'Espírito Santo' && incaperData) {
            const keyword = INCAPER_KEYWORDS[produto];
            const row = keyword ? incaperData.precos.find(r => keyword.test(r.produto)) : null;
            if (row) return { fonte: 'Incaper', preco: row.medio, unidade: '@', sourceUrl: incaperData.sourceUrl, fetchedAt: incaperData.fetchedAt };
          }
          if (estadoEfetivo === 'Santa Catarina' && epagriData) {
            const row = produto === 'boi_gordo' ? epagriData.boiGordo : produto === 'vaca' ? epagriData.vacaGorda : null;
            if (row) return { fonte: 'Epagri/Cepa', preco: row.preco.toFixed(2), unidade: '@', sourceUrl: epagriData.sourceUrl, fetchedAt: epagriData.fetchedAt };
          }
          if (estadoEfetivo === 'Bahia' && produto !== 'boi_gordo' && aibaData) {
            const keyword = AIBA_KEYWORDS[produto];
            const row = keyword ? aibaData.rows.find(r => keyword.test(r.produto)) : null;
            if (row) return { fonte: 'AIBA (Oeste da Bahia)', preco: row.preco, unidade: row.unidade, sourceUrl: aibaData.sourceUrl, fetchedAt: aibaData.fetchedAt };
          }
          // Datagro (redistribuído de graça pelo Giro do Boi/Canal
          // Rural) cobre 10 estados pra Boi Gordo especificamente —
          // preenche o buraco que as fontes acima não cobrem (Bahia
          // pra boi, Goiás, Minas Gerais, MT, MS, Pará, Rondônia,
          // Tocantins, RS). Só usa como reserva onde não há fonte
          // acima já respondida, pra não substituir um dado de governo
          // por um de fonte comercial redistribuída.
          if (produto === 'boi_gordo' && datagroData?.precos[estadoEfetivo]) {
            return { fonte: 'Datagro (via Giro do Boi/Canal Rural)', preco: datagroData.precos[estadoEfetivo], unidade: '@', sourceUrl: datagroData.sourceUrl, fetchedAt: datagroData.fetchedAt };
          }
          // Última tentativa: Scot sem exigir praça exata (usa a primeira
          // praça do estado escolhido) — cobre Boi Gordo E Vaca em 20
          // estados, muito além do que as fontes de governo alcançam.
          return buscarScotPraca(false);
        })();

        // Se a cidade digitada não bateu exato, busca especificamente o
        // preço da CAPITAL do estado escolhido — referência mais útil e
        // concreta do que só dizer "mostrando geral".
        const capitalNome = estado ? CIDADES_PRIORITARIAS[estado]?.[0] : undefined;
        const buscouCidadeEspecifica = !!cidade && estado;
        const capitalMatch = (primaryAtual && capitalNome && buscouCidadeEspecifica && !regionMatch)
          ? findRegionRow(primaryAtual, capitalNome)
          : null;
        const capitalPreco = findPriceCell(capitalMatch?.row);

        const primaryFuturo = futuroTables[0];
        const estadosTable = buildEstadosTable(filteredTables);

        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-theme-primary">🇧🇷 Preço no Mercado Selecionado{localBusca ? ` — ${localBusca}` : ' — Geral (Brasil)'}</h2>
              <AlertasCotacoes produto={produto} produtoLabel={produtoDef.label} quotesResponse={quotesResponse} />
              {['novilho', 'novilha'].includes(produto) && !officialOverride && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Cobertura limitada:</strong> {produtoDef.label} tem bem menos fontes públicas que Boi Gordo e Vaca. Hoje só encontramos dado oficial em São Paulo (IEA-SP). Para as demais praças, use o Boi Gordo e a Vaca como referência de mercado da região.
                  </p>
                </div>
              )}
              {officialOverride && (
                <div className={`border-2 rounded-2xl p-4 ${officialOverride.sourceUrl ? 'bg-green-50 border-green-300' : 'bg-blue-50 border-blue-300'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${officialOverride.sourceUrl ? 'text-green-800 bg-green-100' : 'text-blue-800 bg-blue-100'}`}>
                      {officialOverride.sourceUrl ? '🏛️' : '✍️'} {officialOverride.sourceUrl ? 'Fonte Oficial' : 'Cadastro Manual'} — {officialOverride.fonte}
                    </span>
                  </div>
                  <p className={`text-2xl font-bold ${officialOverride.sourceUrl ? 'text-green-900' : 'text-blue-900'}`}>R$ {officialOverride.preco} <span className="text-sm font-normal">/{officialOverride.unidade}</span></p>
                  <p className={`text-[10px] mt-1 ${officialOverride.sourceUrl ? 'text-green-700' : 'text-blue-700'}`}>
                    {officialOverride.sourceUrl ? `Preço oficial específico de ${estado} — mais preciso que a referência nacional abaixo.` : 'Preço lançado manualmente no Painel Admin — confira a data antes de usar pra negociar.'}
                  </p>
                  <VerFonte fonte={officialOverride.fonte} dataHora={officialOverride.fetchedAt ? new Date(officialOverride.fetchedAt).toLocaleString('pt-BR') : undefined} url={officialOverride.sourceUrl || ''} />
                </div>
              )}
              {!primaryAtual && <p className="text-xs text-theme-secondary bg-theme-card border border-theme rounded-2xl p-4">Nenhum dado de mercado atual encontrado para {produtoDef.label} no momento.</p>}
              {buscouCidadeEspecifica && !regionMatch && !officialOverride && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                  <p className="text-xs font-semibold text-amber-800">
                    Não temos cotação específica para <strong>{cidade}</strong> no momento.
                    {capitalPreco ? <> Como referência mais próxima, a capital <strong>{capitalNome}</strong> está cotada em <strong>R$ {capitalPreco}</strong>.</> : ' Veja o preço geral do estado/Brasil abaixo.'}
                  </p>
                </div>
              )}
              {primaryAtual && displayRow && officialOverride && (
                <details className="bg-theme-secondary rounded-2xl p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-theme-secondary select-none">
                    Ver também: Indicador Nacional CEPEA/ESALQ — referência oficial usada na B3, mesmo valor pra qualquer estado
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                    {displayRow.map((cell, i) => (
                      <div key={i}>
                        <p className="text-[9px] uppercase font-bold text-theme-secondary">{primaryAtual.rows[0]?.[i] || ''}</p>
                        <span className="text-sm text-theme-primary font-semibold">{cell}</span>
                      </div>
                    ))}
                  </div>
                  <VerFonte fonte={primaryAtual.source || 'Notícias Agrícolas'} dataHora={new Date(data.fetchedAt).toLocaleString('pt-BR')} url={data.sourceUrl} />
                </details>
              )}
              {primaryAtual && displayRow && !officialOverride && (
                <div className={`bg-theme-card rounded-2xl border-2 p-4 ${priceCheck.isAnomaly ? 'border-red-300' : 'border-[var(--primary)]/20'}`}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge kind="atual" />
                    {localBusca && !regionMatch && <span className="text-[9px] text-theme-secondary">(local não encontrado, mostrando geral)</span>}
                    {localBusca && regionMatch && !regionMatch.exact && <span className="text-[9px] text-amber-600">(local mais próximo, mesma UF)</span>}
                  </div>
                  <p className="text-[10px] text-theme-secondary mb-3">
                    Indicador Nacional CEPEA/ESALQ — a referência oficial de preço à vista usada como base pros contratos futuros da B3. Não muda por estado porque é um número único, calculado pra todo o Brasil.
                  </p>
                  {priceCheck.isAnomaly && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 mb-3 flex items-start gap-2">
                      <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-red-700">
                        <strong>Atenção:</strong> este valor está fora da faixa normal esperada pra {produtoDef.label} — pode ser oscilação real de mercado, ou um erro de leitura da fonte. Confira em "Ver fonte" antes de usar pra negociar.
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {displayRow.map((cell, i) => (
                      <div key={i}>
                        <p className="text-[9px] uppercase font-bold text-theme-secondary">{primaryAtual.rows[0]?.[i] || ''}</p>
                        <span className="text-sm text-theme-primary font-semibold">{cell}</span>
                      </div>
                    ))}
                  </div>
                  <VerFonte fonte={primaryAtual.source || 'Notícias Agrícolas'} dataHora={new Date(data.fetchedAt).toLocaleString('pt-BR')} url={data.sourceUrl} />
                </div>
              )}
              {teData && (
                <div className="bg-theme-secondary rounded-2xl p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-theme-secondary">🌐 {teData.nomeExibido}</p>
                      <p className="text-[9px] text-theme-secondary">Fonte independente, para conferência</p>
                    </div>
                    <p className="text-sm font-bold text-theme-primary">{teData.preco.toFixed(2)} <span className="text-[10px] font-normal">{teData.unidade}</span></p>
                  </div>
                  {teData.sourceUrl && <VerFonte fonte="TradingEconomics" dataHora={teData.fetchedAt ? new Date(teData.fetchedAt).toLocaleString('pt-BR') : undefined} url={teData.sourceUrl} />}
                </div>
              )}
              {(() => {
                const keyword = IEA_KEYWORDS[produto];
                // O IEA-SP só cobre o Estado de São Paulo — nunca mostra
                // esse dado se o usuário estiver filtrando por outro
                // estado, pra não parecer que é da região pesquisada.
                const estadoCompativel = estado === 'São Paulo';
                if (!keyword || !ieaData || !estadoCompativel) return null;
                const ieaRow = ieaData.recebidosPelosProdutores.find(r => keyword.test(r.produto));
                if (!ieaRow) return null;
                const ieaAnomaly = checkSimplePriceAnomaly(produto, ieaRow.preco);
                return (
                  <div className={`bg-blue-50 border rounded-2xl p-3 ${ieaAnomaly ? 'border-red-300' : 'border-blue-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-blue-800">🏛️ IEA-SP (Oficial — só Estado de São Paulo)</p>
                        <p className="text-[9px] text-blue-700">{ieaRow.produto} — preço recebido pelo produtor, exclusivo de SP</p>
                      </div>
                      <p className="text-sm font-bold text-blue-800">R$ {ieaRow.preco} <span className="text-[10px] font-normal">/{ieaRow.unidade}</span></p>
                    </div>
                    {ieaAnomaly && <p className="text-[10px] text-red-600 font-semibold mt-1">⚠️ Valor fora da faixa esperada — confira a fonte.</p>}
                    {ieaData.sourceUrl && <VerFonte fonte="IEA-SP (Governo de São Paulo)" dataHora={ieaData.fetchedAt ? new Date(ieaData.fetchedAt).toLocaleString('pt-BR') : undefined} url={ieaData.sourceUrl} />}
                  </div>
                );
              })()}
              {produto === 'boi_gordo' && (!estado || estado === 'São Paulo') && ieaData?.recebidosPelosProdutores.find(r => /boi gordo \(china\)/i.test(r.produto)) && (() => {
                const chinaRow = ieaData.recebidosPelosProdutores.find(r => /boi gordo \(china\)/i.test(r.produto))!;
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-blue-800">🏛️ IEA-SP (Oficial, só SP) — Padrão China</p>
                      <p className="text-[9px] text-blue-700">Boi Gordo com padrão de exportação para a China, em São Paulo</p>
                    </div>
                    <p className="text-sm font-bold text-blue-800">R$ {chinaRow.preco} <span className="text-[10px] font-normal">/{chinaRow.unidade}</span></p>
                  </div>
                );
              })()}
              {(() => {
                // Incaper só cobre o Espírito Santo — mesma regra de
                // escopo: só mostra se nenhum estado ou "Espírito Santo"
                // estiver selecionado.
                const keyword = INCAPER_KEYWORDS[produto];
                const estadoCompativel = estado === 'Espírito Santo';
                if (!keyword || !incaperData || !estadoCompativel) return null;
                const row = incaperData.precos.find(r => keyword.test(r.produto));
                if (!row) return null;
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-blue-800">🏛️ Incaper (Oficial — só Espírito Santo)</p>
                        <p className="text-[9px] text-blue-700">{row.produto} — mín. {row.minimo} / máx. {row.maximo}</p>
                      </div>
                      <p className="text-sm font-bold text-blue-800">R$ {row.medio} <span className="text-[10px] font-normal">médio/@</span></p>
                    </div>
                    {incaperData.sourceUrl && <VerFonte fonte="Incaper (Governo do Espírito Santo)" dataHora={incaperData.fetchedAt ? new Date(incaperData.fetchedAt).toLocaleString('pt-BR') : undefined} url={incaperData.sourceUrl} />}
                  </div>
                );
              })()}
              {(() => {
                // Epagri/Cepa só cobre Santa Catarina.
                const estadoCompativel = estado === 'Santa Catarina';
                if (!epagriData || !estadoCompativel) return null;
                const row = produto === 'boi_gordo' ? epagriData.boiGordo : produto === 'vaca' ? epagriData.vacaGorda : null;
                if (!row) return null;
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-blue-800">🏛️ Epagri/Cepa (Oficial — só Santa Catarina)</p>
                        <p className="text-[9px] text-blue-700">{row.praca ? `${row.praca} — ` : ''}{row.data}</p>
                      </div>
                      <p className="text-sm font-bold text-blue-800">R$ {row.preco.toFixed(2)} <span className="text-[10px] font-normal">/@</span></p>
                    </div>
                    {epagriData.sourceUrl && <VerFonte fonte="Epagri/Cepa (Governo de Santa Catarina)" dataHora={epagriData.fetchedAt ? new Date(epagriData.fetchedAt).toLocaleString('pt-BR') : undefined} url={epagriData.sourceUrl} />}
                  </div>
                );
              })()}
              {(() => {
                // AIBA só cobre o Oeste da Bahia — não é indicador nacional.
                const keyword = AIBA_KEYWORDS[produto];
                const estadoCompativel = estado === 'Bahia';
                if (!keyword || !aibaData || !estadoCompativel) return null;
                const row = aibaData.rows.find(r => keyword.test(r.produto));
                if (!row) return null;
                const aibaAnomaly = checkSimplePriceAnomaly(produto, row.preco);
                return (
                  <div className={`bg-blue-50 border rounded-2xl p-3 ${aibaAnomaly ? 'border-red-300' : 'border-blue-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-blue-800">🏛️ AIBA (Oeste da Bahia) — {row.produto}</p>
                        <p className="text-[9px] text-blue-700">{row.data} · {row.variacaoPct}%</p>
                      </div>
                      <p className="text-sm font-bold text-blue-800">R$ {row.preco} <span className="text-[10px] font-normal">/{row.unidade}</span></p>
                    </div>
                    {aibaAnomaly && <p className="text-[10px] text-red-600 font-semibold mt-1">⚠️ Valor fora da faixa esperada — confira a fonte.</p>}
                    {aibaData.sourceUrl && <VerFonte fonte="AIBA (Associação de Agricultores e Irrigantes da Bahia)" dataHora={aibaData.fetchedAt ? new Date(aibaData.fetchedAt).toLocaleString('pt-BR') : undefined} url={aibaData.sourceUrl} />}
                  </div>
                );
              })()}
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-bold text-theme-primary">📈 Futuro B3 (b3.com.br)</h2>
              {!primaryFuturo && <p className="text-xs text-theme-secondary bg-theme-card border border-theme rounded-2xl p-4">Sem contrato futuro na B3 disponível para {produtoDef.label} no momento.</p>}
              {primaryFuturo && (
                <div className="bg-theme-card rounded-2xl border border-theme overflow-hidden overflow-x-auto">
                  <div className="p-3 pb-1 flex items-center gap-2">
                    <Badge kind="futuro" />
                    <span className="text-[9px] font-bold text-theme-secondary bg-theme-secondary px-1.5 py-0.5 rounded-full">{detectCurrency(primaryFuturo.rows[0])}</span>
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-theme">
                      {primaryFuturo.rows.slice(0, 12).map((row, ri) => (
                        <tr key={ri} className={ri === 0 ? 'bg-theme-secondary font-bold' : ''}>
                          {row.map((cell, ci) => <td key={ci} className="p-2.5 text-xs text-theme-secondary whitespace-nowrap">{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 pb-3">
                    <VerFonte fonte={primaryFuturo.source || 'B3 / Notícias Agrícolas'} dataHora={new Date(data.fetchedAt).toLocaleString('pt-BR')} url={data.sourceUrl} />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-bold text-theme-primary">🗺️ Preço por Estados da Federação</h2>
              {estadosTable.length === 0 && <p className="text-xs text-theme-secondary bg-theme-card border border-theme rounded-2xl p-4">Sem comparativo por estado disponível para {produtoDef.label} no momento.</p>}
              {estadosTable.length > 0 && (
                <div className="bg-theme-card rounded-2xl border border-theme overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-theme-secondary">
                        <th className="text-left p-2.5 text-xs font-bold text-theme-primary">Estado</th>
                        <th className="text-left p-2.5 text-xs font-bold text-theme-primary">Preço</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme">
                      {estadosTable.map((r, i) => (
                        <tr key={i} className={r.estado === estado ? 'bg-[var(--primary-soft)]' : ''}>
                          <td className="p-2.5 text-xs font-semibold text-theme-primary">{r.estado}</td>
                          <td className="p-2.5 text-xs text-theme-secondary">{r.valor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {pecuariaData && pecuariaData.rows[0] && (
                <div className="bg-theme-card rounded-2xl border border-theme overflow-hidden overflow-x-auto">
                  <div className="p-3 pb-1">
                    <p className="text-xs font-bold text-theme-primary">Pecuária.com.br — fonte de mercado (conferência)</p>
                    <p className="text-[9px] text-theme-secondary">{pecuariaData.unidade}</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-theme-secondary">
                        {(['SP', 'MS', 'MG', 'GO', 'MT', 'RJ'] as const).map(uf => (
                          <th key={uf} className="text-left p-2 text-xs font-bold text-theme-primary">{uf}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {(['SP', 'MS', 'MG', 'GO', 'MT', 'RJ'] as const).map(uf => (
                          <td key={uf} className="p-2 text-xs text-theme-secondary">R$ {pecuariaData.rows[0][uf]}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-bold text-theme-primary">🌍 Mercado Internacional</h2>
              {boiMundoData ? (
                <div className="bg-theme-card rounded-2xl border border-theme overflow-hidden overflow-x-auto">
                  <div className="p-3 pb-1">
                    <p className="text-xs font-bold text-theme-primary">Comparativo internacional — Boi Gordo</p>
                    <p className="text-[9px] text-theme-secondary">{boiMundoData.unidade}</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-theme-secondary">
                        <th className="text-left p-2.5 text-xs font-bold text-theme-primary">País</th>
                        <th className="text-left p-2.5 text-xs font-bold text-theme-primary">Atual</th>
                        <th className="text-left p-2.5 text-xs font-bold text-theme-primary">Há 1 ano</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme">
                      {boiMundoData.paises.map((p, i) => (
                        <tr key={i} className={/brasil/i.test(p.pais) ? 'bg-[var(--primary-soft)]' : ''}>
                          <td className="p-2.5 text-xs font-semibold text-theme-primary">{p.pais}</td>
                          <td className="p-2.5 text-xs text-theme-secondary">{p.atual}</td>
                          <td className="p-2.5 text-xs text-theme-secondary">{p.haUmAno}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {boiMundoData.sourceUrl && (
                    <div className="px-3 pb-3">
                      <VerFonte fonte="Scot Consultoria" dataHora={boiMundoData.fetchedAt ? new Date(boiMundoData.fetchedAt).toLocaleString('pt-BR') : undefined} url={boiMundoData.sourceUrl} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-theme-card rounded-2xl border border-theme p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-theme-secondary rounded-xl p-3">
                      <p className="text-[10px] font-bold text-theme-secondary uppercase">🇺🇸 Estados Unidos</p>
                      {data.mercadoInternacional ? (
                        <>
                          <p className="text-sm font-bold text-theme-primary mt-1">{data.mercadoInternacional.valor.toFixed(4)}</p>
                          <p className="text-[9px] text-theme-secondary">{data.mercadoInternacional.unidade}</p>
                        </>
                      ) : <p className="text-xs text-theme-secondary mt-1">Sem contrato de referência para este produto</p>}
                    </div>
                    <div className="bg-theme-secondary rounded-xl p-3 opacity-60">
                      <p className="text-[10px] font-bold text-theme-secondary uppercase">🇪🇺 Europa</p>
                      <p className="text-xs text-theme-secondary mt-1">Sem cotação no momento</p>
                    </div>
                    <div className="bg-theme-secondary rounded-xl p-3 opacity-60">
                      <p className="text-[10px] font-bold text-theme-secondary uppercase">🇨🇳 China</p>
                      <p className="text-xs text-theme-secondary mt-1">Sem cotação no momento</p>
                    </div>
                    <div className="bg-theme-secondary rounded-xl p-3 opacity-60">
                      <p className="text-[10px] font-bold text-theme-secondary uppercase">🇷🇺 Rússia</p>
                      <p className="text-xs text-theme-secondary mt-1">Sem cotação no momento</p>
                    </div>
                    <div className="bg-theme-secondary rounded-xl p-3 opacity-60">
                      <p className="text-[10px] font-bold text-theme-secondary uppercase">🇯🇵 Japão</p>
                      <p className="text-xs text-theme-secondary mt-1">Sem cotação no momento</p>
                    </div>
                    <div className="bg-theme-secondary rounded-xl p-3 opacity-60">
                      <p className="text-[10px] font-bold text-theme-secondary uppercase">🕌 Oriente Médio</p>
                      <p className="text-xs text-theme-secondary mt-1">Sem cotação no momento</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-theme-secondary py-2">
              Ver dados completos <ExternalLink size={12} />
            </a>
            <p className="text-[10px] text-theme-secondary text-center">
              Atualizado em {new Date(data.fetchedAt).toLocaleString('pt-BR')}.
            </p>
          </div>
        );
      })()}
    </div>
  );
}
