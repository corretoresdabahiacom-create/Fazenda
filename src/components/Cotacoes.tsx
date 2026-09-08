/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Search, RefreshCw, ExternalLink, AlertTriangle, MapPin, Navigation,
} from 'lucide-react';

const PRODUCTS: { id: string; label: string }[] = [
  { id: 'boi_gordo', label: 'Boi Gordo, Vaca, Novilho e Novilha' },
  { id: 'cafe', label: 'Café (Arábica/Conilon)' },
  { id: 'algodao', label: 'Algodão' },
  { id: 'soja', label: 'Soja' },
  { id: 'milho', label: 'Milho' },
  { id: 'trigo', label: 'Trigo' },
  { id: 'laranja', label: 'Laranja' },
  { id: 'acucar', label: 'Açúcar' },
  { id: 'suinos', label: 'Suínos' },
  { id: 'frango', label: 'Frango' },
  { id: 'leite', label: 'Leite' },
  { id: 'arroz', label: 'Arroz' },
  { id: 'feijao', label: 'Feijão' },
  { id: 'cacau', label: 'Cacau' },
  { id: 'amendoim', label: 'Amendoim' },
  { id: 'sorgo', label: 'Sorgo' },
  { id: 'ovos', label: 'Ovos' },
  { id: 'mandioca', label: 'Mandioca' },
  { id: 'frutas', label: 'Frutas (Manga, Limão e outras)' },
];

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

const CATEGORY_MATCHERS: Record<string, { label: string; pattern: RegExp }[]> = {
  boi_gordo: [
    { label: 'Boi Gordo', pattern: /indicador do boi\b/i },
    { label: 'Vaca', pattern: /indicador da vaca\b/i },
    { label: 'Novilha', pattern: /indicador da novilha\b/i },
    { label: 'Garrote (jovem/≈ Novilho)', pattern: /garrote/i },
    { label: 'Bezerro', pattern: /bezerr/i },
  ],
  cafe: [
    { label: 'Café Arábica', pattern: /ar[aá]bica/i },
    { label: 'Café Conilon (Robusta)', pattern: /conilon|robusta/i },
  ],
};

const FUTURES_PATTERN = /pregão|futuro|vencimento/i;

interface CambioEntry {
  compra: number;
  venda: number;
  variacaoPct: number;
  atualizadoEm: string;
}

interface CambioData {
  usd: CambioEntry | null;
  eur: CambioEntry | null;
  jpy: CambioEntry | null;
  xau: CambioEntry | null;
  btc: CambioEntry | null;
  dolarFuturoB3: { valor: string; vencimento: string } | null;
  fonte?: string;
  debug?: string[];
}

interface ParsedTable {
  heading: string;
  source: string;
  rows: string[][];
}

interface CotacoesResponse {
  produto: string;
  sourceUrl: string;
  tables: ParsedTable[];
  mercadoInternacional?: { pais: string; valor: number; unidade: string; fonte: string } | null;
  fetchedAt: string;
  error?: string;
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

interface RegionMatch {
  row: string[];
  exact: boolean; // true = achou a cidade/região exata; false = achou o local mais próximo (mesmo estado)
}

function detectCurrency(headerRow: string[] | undefined): string {
  if (!headerRow) return 'R$';
  const joined = headerRow.join(' ');
  if (/us\$/i.test(joined)) return 'US$';
  if (/r\$/i.test(joined)) return 'R$';
  return 'R$'; // dados brasileiros de CEPEA/B3/Scot/Datagro são quase sempre em reais
}

function findRegionRow(table: ParsedTable, region: string, uf?: string, estadoNome?: string): RegionMatch | null {
  if (!region) return null;
  const term = region.toLowerCase();

  const exactMatch = table.rows.slice(1).find(row => row.some(cell => cell.toLowerCase().includes(term)));
  if (exactMatch) return { row: exactMatch, exact: true };

  // Não achou a cidade/região exata — procura o local mais próximo,
  // usando o mesmo estado (por sigla OU nome completo, ex: fontes como a
  // Scot Consultoria usam "Bahia Sul"/"Bahia Oeste", não a sigla "BA").
  const nearestMatch = table.rows.slice(1).find(row => row.some(cell => {
    if (uf && new RegExp(`\\b${uf}\\b`, 'i').test(cell)) return true;
    if (estadoNome && cell.toLowerCase().includes(estadoNome.toLowerCase())) return true;
    return false;
  }));
  if (nearestMatch) return { row: nearestMatch, exact: false };

  return null;
}

// Extrai os nomes de cidade/região que realmente aparecem nos dados
// carregados para o produto atual — usado para popular a lista de
// sugestões do campo de busca, mostrando só o que existe de verdade.
// Se um estado for informado, filtra só as cidades daquele estado
// (reconhece tanto o nome completo quanto a sigla, ex: "SP Barretos").
function extractAvailableRegions(tables: ParsedTable[], estadoFiltro?: string): string[] {
  const found = new Set<string>();
  const uf = estadoFiltro ? UF_POR_ESTADO[estadoFiltro] : undefined;
  for (const table of tables) {
    for (const row of table.rows.slice(1)) {
      const cell = row[0]?.trim();
      if (!cell || cell.length < 2 || cell.length > 40 || /^\d/.test(cell) || /fechamento|r\$|us\$/i.test(cell)) continue;
      if (estadoFiltro) {
        const cellLower = cell.toLowerCase();
        const matchesUf = uf && new RegExp(`\\b${uf}\\b`, 'i').test(cell);
        const matchesNome = cellLower.includes(estadoFiltro.toLowerCase());
        if (!matchesUf && !matchesNome) continue;
      }
      found.add(cell);
    }
  }
  return Array.from(found).sort();
}

function CambioCard({ label, entry, flag, decimals = 4 }: { label: string; entry: CambioEntry | null; flag: string; decimals?: number }) {
  if (!entry) {
    return (
      <div className="bg-theme-card rounded-2xl border border-theme p-4">
        <p className="text-xs text-theme-secondary">{flag} {label}</p>
        <p className="text-sm text-theme-secondary mt-1">Indisponível</p>
      </div>
    );
  }
  const isUp = entry.variacaoPct >= 0;
  return (
    <div className="bg-theme-card rounded-2xl border border-theme p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-theme-secondary">{flag} {label}</p>
        <span className={`text-[10px] font-bold flex items-center gap-0.5 ${isUp ? 'text-green-600' : 'text-red-500'}`}>
          {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {entry.variacaoPct}%
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] uppercase text-theme-secondary">Compra</p>
          <p className="text-sm font-bold text-theme-primary">R$ {entry.compra.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-theme-secondary">Venda</p>
          <p className="text-sm font-bold text-theme-primary">R$ {entry.venda.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</p>
        </div>
      </div>
    </div>
  );
}

function Badge({ kind }: { kind: 'atual' | 'futuro' }) {
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
      kind === 'futuro' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
    }`}>
      {kind === 'futuro' ? 'Futuro B3' : 'Atual'}
    </span>
  );
}

export default function Cotacoes({ defaultRegion }: { defaultRegion?: string }) {
  const [cambio, setCambio] = useState<CambioData | null>(null);
  const [cambioError, setCambioError] = useState<string | null>(null);
  const [produto, setProduto] = useState('boi_gordo');
  const [produtoTemp, setProdutoTemp] = useState('boi_gordo');
  const [isProdutoModalOpen, setIsProdutoModalOpen] = useState(false);
  const [data, setData] = useState<CotacoesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState(defaultRegion || '');
  const [selectedState, setSelectedState] = useState('');
  const [detectingRegion, setDetectingRegion] = useState(false);

  useEffect(() => {
    fetch('/api/cambio')
      .then(res => res.json())
      .then(json => {
        if (json.error) setCambioError(json.error);
        else setCambio(json);
      })
      .catch(() => setCambioError('Não foi possível carregar o câmbio agora.'));
  }, []);

  function loadCotacoes(p: string) {
    setLoading(true);
    setError(null);
    fetch(`/api/cotacoes?produto=${p}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch(() => setError('Não foi possível carregar as cotações agora. Tente novamente em instantes.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCotacoes(produto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produto]);

  function handleDetectRegion() {
    if (!navigator.geolocation) return;
    setDetectingRegion(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/reverse-geocode?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
          const json = await res.json();
          // Prioriza a cidade (mais preciso, casa com tabelas por
          // município) — só cai pro estado se a cidade não vier.
          if (json.city) setRegion(json.city);
          else if (json.state) setRegion(json.state);
        } finally {
          setDetectingRegion(false);
        }
      },
      () => setDetectingRegion(false),
      { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false },
    );
  }

  const matchers = CATEGORY_MATCHERS[produto];
  const categorizedHeadings = new Set<string>();
  if (matchers && data) {
    for (const m of matchers) {
      const t = data.tables.find(t => m.pattern.test(t.heading) && !FUTURES_PATTERN.test(t.heading));
      if (t) categorizedHeadings.add(t.heading);
    }
  }
  const otherTables = data ? data.tables.filter(t => !categorizedHeadings.has(t.heading)) : [];
  const availableRegions = data ? extractAvailableRegions(data.tables, selectedState || undefined) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-theme-primary flex items-center gap-2">
          <DollarSign className="text-primary" size={20} /> Cotações
        </h1>
        <p className="text-xs text-theme-secondary">Preços de mercado agropecuário e câmbio, buscados em tempo real.</p>
      </div>

      <div>
        {cambioError && (
          <p className="text-xs text-red-500 bg-red-50 rounded-xl p-2 mb-2">{cambioError}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <CambioCard label="Dólar Comercial (USD)" entry={cambio?.usd ?? null} flag="🇺🇸" decimals={4} />
          <CambioCard label="Euro (EUR)" entry={cambio?.eur ?? null} flag="🇪🇺" decimals={4} />
          <CambioCard label="Iene Japonês (JPY)" entry={cambio?.jpy ?? null} flag="🇯🇵" decimals={4} />
          <CambioCard label="Ouro (grama)" entry={cambio?.xau ?? null} flag="🥇" decimals={2} />
          <CambioCard label="Bitcoin (BTC)" entry={cambio?.btc ?? null} flag="₿" decimals={2} />
        </div>
        {(!cambio?.usd || !cambio?.xau) && (
          <button
            onClick={() => {
              fetch('/api/cambio?debug=1')
                .then(res => res.json())
                .then(json => setCambio(json));
            }}
            className="mt-2 text-xs font-semibold text-theme-secondary underline flex items-center gap-1"
          >
            <RefreshCw size={12} /> Tentar buscar de novo agora (ignora o cache)
          </button>
        )}
        {cambio?.debug && cambio.debug.length > 0 && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-amber-800 uppercase mb-1">Detalhes técnicos (para diagnóstico)</p>
            {cambio.debug.map((line, i) => (
              <p key={i} className="text-[10px] text-amber-800 font-mono">{line}</p>
            ))}
          </div>
        )}
        {cambio?.dolarFuturoB3 && (
          <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-blue-800">
              📈 Dólar Futuro (B3){cambio.dolarFuturoB3.vencimento ? ` — vencimento ${cambio.dolarFuturoB3.vencimento}` : ''}
            </p>
            <p className="text-sm font-bold text-blue-800">{cambio.dolarFuturoB3.valor}</p>
          </div>
        )}
        {cambio?.fonte && <p className="text-[10px] text-theme-secondary mt-1.5">{cambio.fonte}</p>}
      </div>

      <div className="bg-theme-card rounded-2xl border border-theme p-4 space-y-3">
        <button
          onClick={() => { setProdutoTemp(produto); setIsProdutoModalOpen(true); }}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-theme bg-theme-secondary text-left"
        >
          <div>
            <p className="text-[10px] uppercase text-theme-secondary font-bold">Produto selecionado</p>
            <p className="text-sm font-bold text-theme-primary">{PRODUCTS.find(p => p.id === produto)?.label}</p>
          </div>
          <span className="text-xs font-bold text-[var(--primary)]">Trocar</span>
        </button>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" size={16} />
            <select
              value={ESTADOS.includes(region) ? region : ''}
              onChange={e => { setRegion(e.target.value); setSelectedState(e.target.value); }}
              className="w-full pl-9 pr-3 py-2 bg-theme-secondary border border-theme rounded-xl text-sm appearance-none"
            >
              <option value="">Todas as regiões</option>
              {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <button
            onClick={handleDetectRegion}
            disabled={detectingRegion}
            className="flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-theme text-theme-secondary disabled:opacity-60"
          >
            <Navigation size={14} /> {detectingRegion ? 'Detectando...' : 'Usar minha localização'}
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" size={16} />
            <input
              value={ESTADOS.includes(region) ? '' : region}
              onChange={e => setRegion(e.target.value)}
              placeholder="...ou digite cidade/região específica"
              list="cidades-disponiveis"
              className="w-full pl-9 pr-3 py-2 bg-theme-secondary border border-theme rounded-xl text-sm"
            />
            <datalist id="cidades-disponiveis">
              {availableRegions.map(r => <option key={r} value={r} />)}
            </datalist>
          </div>
        </div>
        {availableRegions.length > 0 && (
          <p className="text-[10px] text-theme-secondary">
            {availableRegions.length} região(ões)/cidade(s) disponível(is) para este produto — comece a digitar no campo de busca para ver a lista.
          </p>
        )}
      </div>

      {isProdutoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-theme-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-theme">
              <h3 className="font-bold text-theme-primary text-sm">Escolha o produto</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {PRODUCTS.map(p => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer ${produtoTemp === p.id ? 'bg-[var(--primary-soft)]' : ''}`}
                >
                  <input
                    type="radio"
                    name="produto-modal"
                    checked={produtoTemp === p.id}
                    onChange={() => setProdutoTemp(p.id)}
                    className="accent-[var(--primary)]"
                  />
                  <span className={`text-sm ${produtoTemp === p.id ? 'font-bold text-[var(--primary)]' : 'text-theme-primary'}`}>{p.label}</span>
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-theme flex gap-2">
              <button
                onClick={() => setIsProdutoModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-theme text-theme-secondary font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setProduto(produtoTemp); setIsProdutoModalOpen(false); }}
                className="flex-1 py-2.5 rounded-xl bg-[var(--primary)] text-white font-bold text-sm"
              >
                Ok
              </button>
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
            <button onClick={() => loadCotacoes(produto)} className="text-xs font-bold text-red-700 underline mt-2 flex items-center gap-1">
              <RefreshCw size={12} /> Tentar novamente
            </button>
          </div>
        </div>
      )}

      {!loading && !error && data && (() => {
        const uf = ESTADOS.includes(region) ? UF_POR_ESTADO[region] : selectedState ? UF_POR_ESTADO[selectedState] : undefined;
        const estadoNome = ESTADOS.includes(region) ? region : selectedState || undefined;

        // Renderiza um card de categoria (Boi Gordo, Vaca, Café Arábica
        // etc.), filtrando pelo tipo (atual ou futuro) pedido.
        function renderCategoryCard(m: { label: string; pattern: RegExp }, kind: 'atual' | 'futuro') {
          const table = data!.tables.find(t => m.pattern.test(t.heading) && classifyTable(t) === kind);
          if (!table) return null;
          const regionMatch = kind === 'atual' ? findRegionRow(table, region, uf, estadoNome) : null;
          const displayRow = regionMatch?.row || table.rows[1];
          if (!displayRow) return null;
          return (
            <div key={`${m.label}-${kind}`} className="bg-theme-card rounded-2xl border-2 border-[var(--primary)]/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-theme-primary text-sm">{m.label}</h3>
                <Badge kind={kind} />
                <span className="text-[9px] font-bold text-theme-secondary bg-theme-secondary px-1.5 py-0.5 rounded-full">{detectCurrency(table.rows[0])}</span>
                {kind === 'atual' && region && !regionMatch && <span className="text-[9px] text-theme-secondary">(região não encontrada, mostrando geral)</span>}
                {kind === 'atual' && region && regionMatch && !regionMatch.exact && <span className="text-[9px] text-amber-600">(local mais próximo, mesma UF)</span>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {displayRow.map((cell, i) => (
                  <span key={i} className="text-xs text-theme-secondary">{cell}</span>
                ))}
              </div>
              <p className="text-[10px] text-theme-secondary mt-1.5">Fonte: {table.source || 'Notícias Agrícolas'}</p>
            </div>
          );
        }

        // Renderiza uma tabela "solta" (produtos sem categorias
        // específicas), filtrando pelo tipo pedido.
        function renderRawTable(table: ParsedTable, key: number) {
          const kind = classifyTable(table);
          let rows = table.rows;
          let usedNearest = false;
          if (region && kind === 'atual') {
            const term = region.toLowerCase();
            let filtered = table.rows.slice(1).filter(r => r.some(c => c.toLowerCase().includes(term)));
            if (filtered.length === 0 && (uf || estadoNome)) {
              filtered = table.rows.slice(1).filter(r => r.some(c => {
                if (uf && new RegExp(`\\b${uf}\\b`, 'i').test(c)) return true;
                if (estadoNome && c.toLowerCase().includes(estadoNome.toLowerCase())) return true;
                return false;
              }));
              usedNearest = filtered.length > 0;
            }
            if (filtered.length === 0) return null;
            rows = [table.rows[0], ...filtered];
          }
          return (
            <div key={key} className="bg-theme-card rounded-2xl border border-theme overflow-hidden overflow-x-auto">
              <div className="p-4 pb-2 flex items-center gap-2">
                <h3 className="font-bold text-theme-primary text-sm">{table.heading || 'Cotação'}</h3>
                <Badge kind={kind} />
                <span className="text-[9px] font-bold text-theme-secondary bg-theme-secondary px-1.5 py-0.5 rounded-full">{detectCurrency(table.rows[0])}</span>
                {usedNearest && <span className="text-[9px] text-amber-600">(local mais próximo, mesma UF)</span>}
              </div>
              {table.source && <p className="text-[10px] text-theme-secondary px-4 -mt-1 pb-2">Fonte: {table.source}</p>}
              <table className="w-full text-sm">
                <tbody className="divide-y divide-theme">
                  {rows.slice(0, 20).map((row, ri) => (
                    <tr key={ri} className={ri === 0 ? 'bg-theme-secondary font-bold' : ''}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="p-2.5 text-xs text-theme-secondary whitespace-nowrap">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        const atualOtherTables = otherTables.filter(t => classifyTable(t) === 'atual');
        const futuroOtherTables = otherTables.filter(t => classifyTable(t) === 'futuro');

        const atualCards = matchers ? matchers.map(m => renderCategoryCard(m, 'atual')).filter(Boolean) : [];
        const futuroCards = matchers ? matchers.map(m => renderCategoryCard(m, 'futuro')).filter(Boolean) : [];

        const nadaEncontrado = atualCards.length === 0 && atualOtherTables.length === 0
          && futuroCards.length === 0 && futuroOtherTables.length === 0;

        return (
          <div className="space-y-4">
            {nadaEncontrado && (
              <p className="text-sm text-theme-secondary text-center py-8">Nenhuma cotação encontrada para este produto no momento.</p>
            )}

            {/* 1. Preço Atual — Brasil */}
            {(atualCards.length > 0 || atualOtherTables.length > 0) && (
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-theme-primary flex items-center gap-1.5">🇧🇷 Preço Atual — Brasil</h2>
                {atualCards.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{atualCards}</div>}
                {atualOtherTables.map((t, i) => renderRawTable(t, i))}
              </div>
            )}

            {/* 2. Futuro B3 */}
            {(futuroCards.length > 0 || futuroOtherTables.length > 0) && (
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-theme-primary flex items-center gap-1.5">📈 Futuro B3</h2>
                {futuroCards.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{futuroCards}</div>}
                {futuroOtherTables.map((t, i) => renderRawTable(t, i + 1000))}
              </div>
            )}

            {/* 3. Mercado Internacional */}
            {data.mercadoInternacional && (() => {
              const futuroTable = data.tables.find(t => classifyTable(t) === 'futuro');
              const brasilRow = futuroTable?.rows[1];
              const brasilPreco = brasilRow?.find(c => /\d/.test(c)) || brasilRow?.[brasilRow.length - 1];
              return (
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-theme-primary flex items-center gap-1.5">🌍 Mercado Internacional</h2>
                  <div className="bg-theme-card rounded-2xl border border-theme p-4">
                    <h3 className="font-bold text-theme-primary text-sm mb-2">{PRODUCTS.find(p => p.id === produto)?.label}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-theme-secondary rounded-xl p-3">
                        <p className="text-[10px] font-bold text-theme-secondary uppercase">🇧🇷 Brasil</p>
                        {brasilPreco ? (
                          <>
                            <p className="text-sm font-bold text-theme-primary mt-1">{brasilPreco}</p>
                            <p className="text-[9px] text-theme-secondary">R$ (B3)</p>
                          </>
                        ) : (
                          <p className="text-xs text-theme-secondary mt-1">Ver "Futuro B3" acima</p>
                        )}
                      </div>
                      <div className="bg-theme-secondary rounded-xl p-3">
                        <p className="text-[10px] font-bold text-theme-secondary uppercase">🇺🇸 Estados Unidos</p>
                        <p className="text-sm font-bold text-theme-primary mt-1">{data.mercadoInternacional.valor.toFixed(4)}</p>
                        <p className="text-[9px] text-theme-secondary">{data.mercadoInternacional.unidade}</p>
                      </div>
                      <div className="bg-theme-secondary rounded-xl p-3 opacity-60">
                        <p className="text-[10px] font-bold text-theme-secondary uppercase">🇪🇺 Europa</p>
                        <p className="text-xs text-theme-secondary mt-1">Sem fonte gratuita confiável encontrada</p>
                      </div>
                      <div className="bg-theme-secondary rounded-xl p-3 opacity-60">
                        <p className="text-[10px] font-bold text-theme-secondary uppercase">🇨🇳 China</p>
                        <p className="text-xs text-theme-secondary mt-1">Sem fonte gratuita confiável encontrada</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-theme-secondary mt-2">Fonte: B3/Notícias Agrícolas (Brasil) e {data.mercadoInternacional.fonte} (Estados Unidos) — contratos futuros de referência.</p>
                  </div>
                </div>
              );
            })()}

            <a
              href={data.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs font-semibold text-theme-secondary py-2"
            >
              Ver fonte completa em noticiasagricolas.com.br <ExternalLink size={12} />
            </a>
            <p className="text-[10px] text-theme-secondary text-center">
              Dados de mercado consolidados via Notícias Agrícolas (CEPEA/ESALQ, B3, Scot Consultoria, Datagro, IMEA). Atualizado em {new Date(data.fetchedAt).toLocaleString('pt-BR')}.
            </p>
          </div>
        );
      })()}
    </div>
  );
}
