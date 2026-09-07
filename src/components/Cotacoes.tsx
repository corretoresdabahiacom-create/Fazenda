/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Search, RefreshCw, ExternalLink, AlertTriangle,
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
  fetchedAt: string;
  error?: string;
}

// Para Boi Gordo, o Datagro publica "Indicador do Boi", "Indicador da
// Vaca" e "Indicador da Novilha" como tabelas SEPARADAS, mas todas usam
// exatamente os mesmos estados como chave — dá pra juntar numa tabela só,
// lado a lado, sem misturar granularidades diferentes (a tabela por
// MUNICÍPIO da Scot Consultoria não tem Novilho/Novilha nessa mesma
// fonte, por isso não aparece combinada com ela).
function buildBoiVacaNovilhaTable(tables: ParsedTable[]): ParsedTable | null {
  const find = (match: RegExp) => tables.find(t => match.test(t.heading));
  const boi = find(/indicador do boi\b/i);
  const vaca = find(/indicador da vaca\b/i);
  const novilha = find(/indicador da novilha\b/i);
  if (!boi || !vaca || !novilha) return null;

  const toMap = (t: ParsedTable) => {
    const map: Record<string, string> = {};
    for (const row of t.rows.slice(1)) {
      if (row[0] && row[1]) map[row[0].trim()] = row[1].trim();
    }
    return map;
  };
  const boiMap = toMap(boi);
  const vacaMap = toMap(vaca);
  const novilhaMap = toMap(novilha);

  const estados = Object.keys(boiMap);
  const rows: string[][] = [['Estado', 'Boi (R$/@)', 'Vaca (R$/@)', 'Novilha (R$/@)']];
  for (const estado of estados) {
    rows.push([estado, boiMap[estado] || '—', vacaMap[estado] || '—', novilhaMap[estado] || '—']);
  }

  return {
    heading: 'Boi, Vaca e Novilha por Estado (comparativo)',
    source: 'Datagro',
    rows,
  };
}

// Identifica se uma tabela é de preço futuro (B3) ou preço atual/à vista
// — usa tanto o título quanto o cabeçalho da própria tabela, já que
// "B3" aparece em títulos de indicadores à vista também (o método CEPEA
// foi desenvolvido em parceria com a B3, mas o preço em si é à vista).
function classifyTable(table: ParsedTable): 'futuro' | 'atual' {
  const heading = table.heading.toLowerCase();
  const firstRow = (table.rows[0] || []).join(' ').toLowerCase();
  const isFutures =
    /pregão|futuro|vencimento/.test(heading) ||
    /contrato|vencimento|mês\s*\/\s*ano/.test(firstRow) ||
    /^(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/\d{2,4}/i.test((table.rows[1]?.[0] || ''));
  return isFutures ? 'futuro' : 'atual';
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

export default function Cotacoes() {
  const [cambio, setCambio] = useState<CambioData | null>(null);
  const [cambioError, setCambioError] = useState<string | null>(null);
  const [produto, setProduto] = useState('boi_gordo');
  const [data, setData] = useState<CotacoesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState('');

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

  function filterRows(rows: string[][]): string[][] {
    if (!regionFilter.trim()) return rows;
    const term = regionFilter.trim().toLowerCase();
    return rows.filter(row => row.some(cell => cell.toLowerCase().includes(term)));
  }

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
        <div className="flex flex-wrap gap-1.5">
          {PRODUCTS.map(p => (
            <button
              key={p.id}
              onClick={() => setProduto(p.id)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
                produto === p.id ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-theme text-theme-secondary'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" size={16} />
          <input
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            placeholder="Filtrar por região, estado ou cidade (ex: SP, Goiás, Barretos)..."
            className="w-full pl-9 pr-3 py-2 bg-theme-secondary border border-theme rounded-xl text-sm"
          />
        </div>
        {produto === 'boi_gordo' && (
          <p className="text-[10px] text-theme-secondary">
            Boi, Vaca e Novilha aparecem comparados por estado logo abaixo. A tabela por município (Scot Consultoria) só traz Boi e Vaca nessa granularidade na fonte original — Novilho/Novilha por município não existe na fonte consultada.
          </p>
        )}
      </div>

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

      {!loading && !error && data && (
        <div className="space-y-4">
          {data.tables.length === 0 && (
            <p className="text-sm text-theme-secondary text-center py-8">Nenhuma cotação encontrada para este produto no momento.</p>
          )}
          {produto === 'boi_gordo' && (() => {
            const combined = buildBoiVacaNovilhaTable(data.tables);
            if (!combined) return null;
            const filteredRows = filterRows(combined.rows);
            if (regionFilter.trim() && filteredRows.length <= 1) return null;
            return (
              <div className="bg-theme-card rounded-2xl border-2 border-[var(--primary)]/30 overflow-hidden overflow-x-auto">
                <div className="p-4 pb-2">
                  <h3 className="font-bold text-theme-primary text-sm">{combined.heading}</h3>
                  <p className="text-[10px] text-theme-secondary">Fonte: {combined.source} — Boi, Vaca e Novilha comparados lado a lado por estado.</p>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-theme">
                    {filteredRows.slice(0, 20).map((row, ri) => (
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
          })()}
          {data.tables.map((table, i) => {
            const filteredRows = filterRows(table.rows);
            if (regionFilter.trim() && filteredRows.length === 0) return null;
            const kind = classifyTable(table);
            return (
              <div key={i} className="bg-theme-card rounded-2xl border border-theme overflow-hidden overflow-x-auto">
                <div className="p-4 pb-2 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-theme-primary text-sm">{table.heading || 'Cotação'}</h3>
                    {table.source && <p className="text-[10px] text-theme-secondary">Fonte: {table.source}</p>}
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                    kind === 'futuro' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                  }`}>
                    {kind === 'futuro' ? 'Futuro B3' : 'Atual'}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-theme">
                    {filteredRows.slice(0, 20).map((row, ri) => (
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
          })}
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
      )}
    </div>
  );
}
