/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Wallet, Sprout, Beef, Tractor, FileText } from 'lucide-react';
import { AccountPayable, AccountReceivable, Talhao, IndividualAnimal, Machine, FarmDocument, AccountStatus } from '../types';
import { differenceInCalendarDays } from 'date-fns';

interface Props {
  accountsPayable: AccountPayable[];
  accountsReceivable: AccountReceivable[];
  talhoes: Talhao[];
  individualAnimals: IndividualAnimal[];
  machines: Machine[];
  documents: FarmDocument[];
  onNavigate?: (view: string) => void;
}

// Painel adicional e independente: só lê dados já carregados pelo contexto
// e resume os módulos novos (Financeiro, Agricultura, Pecuária
// Profissional, Máquinas, Documentos) — não altera nada do painel
// original, só é inserido logo abaixo dele.
export default function ModulosResumo({
  accountsPayable, accountsReceivable, talhoes, individualAnimals, machines, documents, onNavigate,
}: Props) {
  const totalPagar = accountsPayable
    .filter(a => a.status !== AccountStatus.PAGO)
    .reduce((s, a) => s + (a.value ?? 0), 0);
  const totalReceber = accountsReceivable
    .filter(a => a.status !== AccountStatus.PAGO)
    .reduce((s, a) => s + (a.value ?? 0), 0);

  const talhoesAtivos = talhoes.filter(t => t.status === 'Ativo').length;
  const animaisIndividuais = individualAnimals.filter(a => a.status === 'active').length;
  const totalMaquinas = machines.length;

  const today = new Date();
  const docsVencendo = documents.filter(d => {
    if (!d.expirationDate) return false;
    return differenceInCalendarDays(new Date(d.expirationDate), today) <= 30;
  }).length;

  const cards = [
    {
      icon: Wallet, label: 'Financeiro', color: 'text-emerald-600 bg-emerald-50',
      value: `R$ ${(totalReceber - totalPagar).toFixed(2)}`, sub: 'saldo projetado (a pagar - a receber)',
      view: 'financeiro-completo',
    },
    {
      icon: Sprout, label: 'Agricultura', color: 'text-lime-600 bg-lime-50',
      value: String(talhoesAtivos), sub: 'talhões ativos', view: 'agricultura',
    },
    {
      icon: Beef, label: 'Pecuária Profissional', color: 'text-orange-600 bg-orange-50',
      value: String(animaisIndividuais), sub: 'animais cadastrados individualmente', view: 'pecuaria-pro',
    },
    {
      icon: Tractor, label: 'Máquinas', color: 'text-blue-600 bg-blue-50',
      value: String(totalMaquinas), sub: 'máquinas cadastradas', view: 'maquinas',
    },
    {
      icon: FileText, label: 'Documentos', color: 'text-amber-600 bg-amber-50',
      value: String(docsVencendo), sub: 'vencendo em até 30 dias', view: 'documentos',
    },
  ];

  return (
    <div className="mt-6">
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Outros módulos</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => onNavigate?.(c.view)}
            className="bg-white rounded-2xl border border-gray-200 p-4 text-left hover:border-gray-300 transition-colors"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${c.color}`}>
              <c.icon size={16} />
            </div>
            <p className="text-lg font-bold text-gray-800">{c.value}</p>
            <p className="text-[11px] text-gray-500">{c.sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
