/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// FASE 5 do motor de cotações: Dashboard Bahia — mostra todos os
// produtos prioritários da Bahia de uma vez, reaproveitando o endpoint
// unificado /api/quotes (Fase 4). Produtos sem nenhuma fonte real
// coberta hoje aparecem como "Sem cotação disponível" — nunca com um
// número inventado.

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// Lista exata da seção 25 do documento original — inclui produtos que
// ainda não têm fonte real pra Bahia (Ovelha, Peixe, Mamão, Manga,
// Limão), marcados honestamente como indisponíveis em vez de omitidos
// silenciosamente, pra deixar claro o que falta.
const BAHIA_PRIORITY_PRODUCTS: { emoji: string; label: string; backendKey: string | null }[] = [
  { emoji: '🐂', label: 'Boi Gordo', backendKey: 'boi_gordo' },
  { emoji: '🐄', label: 'Vaca', backendKey: 'vaca' },
  { emoji: '🐂', label: 'Novilho', backendKey: 'novilho' },
  { emoji: '🐂', label: 'Novilha', backendKey: 'novilha' },
  { emoji: '🐑', label: 'Ovelha', backendKey: null },
  { emoji: '🐖', label: 'Suíno', backendKey: 'suinos' },
  { emoji: '🐓', label: 'Frango', backendKey: 'frango' },
  { emoji: '🐟', label: 'Peixe', backendKey: null },
  { emoji: '🌽', label: 'Milho', backendKey: 'milho' },
  { emoji: '🌱', label: 'Soja', backendKey: 'soja' },
  { emoji: '🌾', label: 'Sorgo', backendKey: 'sorgo' },
  { emoji: '🌾', label: 'Arroz', backendKey: 'arroz' },
  { emoji: '🫘', label: 'Feijão', backendKey: 'feijao' },
  { emoji: '☕', label: 'Café', backendKey: 'cafe' },
  { emoji: '🌿', label: 'Algodão', backendKey: 'algodao' },
  { emoji: '🥭', label: 'Mamão', backendKey: null },
  { emoji: '🥭', label: 'Manga', backendKey: null },
  { emoji: '🍊', label: 'Laranja', backendKey: 'laranja' },
  { emoji: '🍋', label: 'Limão', backendKey: null },
];

interface DashboardRow {
  emoji: string;
  label: string;
  preco: number | null;
  unidade: string | null;
  local: string | null;
  data: string | null;
  fonte: string | null;
  sourceUrl: string | null;
  confiabilidade: 'Oficial' | 'Mercado' | 'Internacional' | null;
}

export default function DashboardBahia() {
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    const results = await Promise.all(
      BAHIA_PRIORITY_PRODUCTS.map(async (p): Promise<DashboardRow> => {
        if (!p.backendKey) {
          return { emoji: p.emoji, label: p.label, preco: null, unidade: null, local: null, data: null, fonte: null, sourceUrl: null, confiabilidade: null };
        }
        try {
          const res = await fetch(`/api/quotes?product=${p.backendKey}&state=Bahia`);
          const json = await res.json();
          const best = json.quotes?.[0]; // já vem filtrado pra Bahia; primeiro = mais relevante
          if (!best) {
            return { emoji: p.emoji, label: p.label, preco: null, unidade: null, local: null, data: null, fonte: null, sourceUrl: null, confiabilidade: null };
          }
          return {
            emoji: p.emoji, label: p.label,
            preco: best.price, unidade: best.unit,
            local: best.region || best.municipality || best.state || 'Bahia',
            data: best.date || (best.fetchedAt ? new Date(best.fetchedAt).toLocaleDateString('pt-BR') : null),
            fonte: best.source, sourceUrl: best.sourceUrl,
            confiabilidade: best.sourceKind === 'oficial' ? 'Oficial' : best.sourceKind === 'internacional' ? 'Internacional' : 'Mercado',
          };
        } catch {
          return { emoji: p.emoji, label: p.label, preco: null, unidade: null, local: null, data: null, fonte: null, sourceUrl: null, confiabilidade: null };
        }
      })
    );
    setRows(results);
    setLastUpdate(new Date().toLocaleString('pt-BR'));
    setLoading(false);
  }

  useEffect(() => { loadDashboard(); }, []);

  const disponiveis = rows.filter(r => r.preco != null).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold text-theme-primary">🗺️ Dashboard Bahia — Produtos Prioritários</h2>
          <p className="text-[10px] text-theme-secondary">
            {loading ? 'Buscando...' : `${disponiveis} de ${BAHIA_PRIORITY_PRODUCTS.length} produtos com cotação disponível para a Bahia. Atualizado em ${lastUpdate}.`}
          </p>
        </div>
        <button onClick={loadDashboard} disabled={loading} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-theme text-theme-secondary disabled:opacity-60">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      <div className="bg-theme-card rounded-2xl border border-theme overflow-hidden overflow-x-auto shadow-theme">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-theme-secondary">
              <th className="text-left p-2.5 text-xs font-bold text-theme-primary">Produto</th>
              <th className="text-left p-2.5 text-xs font-bold text-theme-primary">Preço</th>
              <th className="text-left p-2.5 text-xs font-bold text-theme-primary">Local</th>
              <th className="text-left p-2.5 text-xs font-bold text-theme-primary">Data</th>
              <th className="text-left p-2.5 text-xs font-bold text-theme-primary">Fonte</th>
              <th className="text-left p-2.5 text-xs font-bold text-theme-primary">Confiabilidade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="p-2.5 text-xs font-semibold text-theme-primary whitespace-nowrap">{r.emoji} {r.label}</td>
                <td className="p-2.5 text-xs">
                  {r.preco != null ? (
                    <span className="font-bold text-theme-primary">R$ {r.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="font-normal text-theme-secondary">/{r.unidade}</span></span>
                  ) : (
                    <span className="text-theme-secondary italic">Sem cotação disponível</span>
                  )}
                </td>
                <td className="p-2.5 text-xs text-theme-secondary">{r.local || '—'}</td>
                <td className="p-2.5 text-xs text-theme-secondary whitespace-nowrap">{r.data || '—'}</td>
                <td className="p-2.5 text-xs text-theme-secondary">
                  {r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline">{r.fonte}</a> : '—'}
                </td>
                <td className="p-2.5 text-xs">
                  {r.confiabilidade ? (
                    <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                      r.confiabilidade === 'Oficial' ? 'bg-green-50 text-green-700' :
                      r.confiabilidade === 'Internacional' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'bg-theme-secondary text-theme-secondary'
                    }`}>{r.confiabilidade}</span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-theme-secondary">
        Ovelha, Peixe, Mamão, Manga e Limão ainda não têm nenhuma fonte real de cotação pra Bahia mapeada — aparecem aqui pra deixar claro o que falta, não porque encontramos e escondemos.
      </p>
    </div>
  );
}
