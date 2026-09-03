/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlertTriangle } from 'lucide-react';
import { InventoryItem } from '../types';
import { format, differenceInCalendarDays } from 'date-fns';

// Componente independente e aditivo: só lê o estoque já carregado pelo
// contexto e calcula os alertas — não mexe em nada da tela de Estoque que
// já existia e funcionava, só é inserido no topo dela.
export default function StockAlerts({ items }: { items: InventoryItem[] }) {
  const critical = items.filter(i => i.criticalStock != null && i.quantity <= i.criticalStock);
  const low = items.filter(i => i.minStock != null && i.quantity <= i.minStock && !critical.includes(i));
  const today = new Date();
  const expiringSoon = items.filter(i => {
    if (!i.expirationDate) return false;
    const days = differenceInCalendarDays(new Date(i.expirationDate), today);
    return days <= 30;
  });

  if (critical.length === 0 && low.length === 0 && expiringSoon.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {critical.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-xs font-bold text-red-700 flex items-center gap-1.5 mb-1">
            <AlertTriangle size={14} /> Estoque crítico
          </p>
          {critical.map(i => (
            <p key={i.id} className="text-xs text-red-700">{i.name}: {i.quantity} {i.unit} (mínimo crítico: {i.criticalStock} {i.unit})</p>
          ))}
        </div>
      )}
      {low.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5 mb-1">
            <AlertTriangle size={14} /> Estoque baixo
          </p>
          {low.map(i => (
            <p key={i.id} className="text-xs text-amber-700">{i.name}: {i.quantity} {i.unit} (mínimo: {i.minStock} {i.unit})</p>
          ))}
        </div>
      )}
      {expiringSoon.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
          <p className="text-xs font-bold text-orange-700 flex items-center gap-1.5 mb-1">
            <AlertTriangle size={14} /> Vencendo em até 30 dias
          </p>
          {expiringSoon.map(i => (
            <p key={i.id} className="text-xs text-orange-700">{i.name}: vence em {format(new Date(i.expirationDate!), 'dd/MM/yyyy')}</p>
          ))}
        </div>
      )}
    </div>
  );
}
