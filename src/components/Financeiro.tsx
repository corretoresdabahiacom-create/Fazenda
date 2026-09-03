/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Trash2, X, ArrowDownCircle, ArrowUpCircle, Tags, TrendingUp } from 'lucide-react';
import {
  AccountPayable, AccountReceivable, AccountStatus,
  CostCenter, CostCenterType,
} from '../types';
import { format } from 'date-fns';

interface Props {
  accountsPayable: AccountPayable[];
  saveAccountPayable: (a: AccountPayable) => Promise<void>;
  deleteAccountPayable: (id: string) => Promise<void>;
  accountsReceivable: AccountReceivable[];
  saveAccountReceivable: (a: AccountReceivable) => Promise<void>;
  deleteAccountReceivable: (id: string) => Promise<void>;
  costCenters: CostCenter[];
  saveCostCenter: (c: CostCenter) => Promise<void>;
  deleteCostCenter: (id: string) => Promise<void>;
}

type Tab = 'pagar' | 'receber' | 'centros' | 'fluxo';

const TABS: { id: Tab; label: string; icon: typeof ArrowDownCircle }[] = [
  { id: 'pagar', label: 'Contas a Pagar', icon: ArrowDownCircle },
  { id: 'receber', label: 'Contas a Receber', icon: ArrowUpCircle },
  { id: 'centros', label: 'Centros de Custo', icon: Tags },
  { id: 'fluxo', label: 'Fluxo de Caixa', icon: TrendingUp },
];

const statusColor: Record<string, string> = {
  [AccountStatus.PENDENTE]: 'bg-amber-100 text-amber-700',
  [AccountStatus.PAGO]: 'bg-green-100 text-green-700',
  [AccountStatus.ATRASADO]: 'bg-red-100 text-red-700',
};

export default function Financeiro(props: Props) {
  const [tab, setTab] = useState<Tab>('pagar');

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Financeiro</h1>
        <p className="text-sm text-gray-500">Contas a pagar, contas a receber, centros de custo e fluxo de caixa.</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-white text-[#2d6a4f] shadow-sm' : 'text-gray-500'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'pagar' && (
        <ContasTab
          kind="pagar"
          items={props.accountsPayable}
          costCenters={props.costCenters}
          onSave={props.saveAccountPayable}
          onDelete={props.deleteAccountPayable}
        />
      )}
      {tab === 'receber' && (
        <ContasTab
          kind="receber"
          items={props.accountsReceivable}
          costCenters={props.costCenters}
          onSave={props.saveAccountReceivable}
          onDelete={props.deleteAccountReceivable}
        />
      )}
      {tab === 'centros' && (
        <CentrosTab costCenters={props.costCenters} onSave={props.saveCostCenter} onDelete={props.deleteCostCenter} />
      )}
      {tab === 'fluxo' && (
        <FluxoTab payable={props.accountsPayable} receivable={props.accountsReceivable} />
      )}
    </div>
  );
}

// ---------- Contas a Pagar / Receber (componente compartilhado) ----------

function ContasTab({ kind, items, costCenters, onSave, onDelete }: {
  kind: 'pagar' | 'receber';
  items: (AccountPayable | AccountReceivable)[];
  costCenters: CostCenter[];
  onSave: (a: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<any>({ status: AccountStatus.PENDENTE });
  const dateLabel = kind === 'pagar' ? 'Vencimento' : 'Previsão de recebimento';

  function openNew() {
    setForm({ status: AccountStatus.PENDENTE, dueDate: format(new Date(), 'yyyy-MM-dd') });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const item = {
      id: `${kind === 'pagar' ? 'ap' : 'ar'}_${Date.now()}`,
      description: form.description || (kind === 'pagar' ? 'Conta a pagar' : 'Conta a receber'),
      dueDate: form.dueDate,
      value: form.value,
      status: form.status ?? AccountStatus.PENDENTE,
      costCenterId: form.costCenterId,
      notes: form.notes,
      createdAt: new Date().toISOString(),
    };
    await onSave(item);
    setIsOpen(false);
  }

  function costCenterName(id?: string) {
    return costCenters.find(c => c.id === id)?.name ?? '—';
  }

  const total = items.reduce((sum, i) => sum + (i.value ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs text-gray-400 uppercase font-bold">Total {kind === 'pagar' ? 'a pagar' : 'a receber'}</p>
        <p className="text-2xl font-bold text-gray-800">R$ {total.toFixed(2)}</p>
      </div>

      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-2 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Nova Conta
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left p-3">{dateLabel}</th>
              <th className="text-left p-3">Descrição</th>
              <th className="text-left p-3">Centro de custo</th>
              <th className="text-left p-3">Valor</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...items].sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || '')).map((i) => (
              <tr key={i.id}>
                <td className="p-3 text-gray-600">{i.dueDate ? format(new Date(i.dueDate), 'dd/MM/yyyy') : '—'}</td>
                <td className="p-3 font-bold text-gray-700">{i.description}</td>
                <td className="p-3 text-gray-600">{costCenterName(i.costCenterId)}</td>
                <td className="p-3 text-gray-600">{i.value != null ? `R$ ${i.value.toFixed(2)}` : '—'}</td>
                <td className="p-3"><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${statusColor[i.status]}`}>{i.status}</span></td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(i.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400 text-sm">Nenhuma conta cadastrada ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <Modal title={`Nova conta a ${kind}`} onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Descrição">
              <input value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={dateLabel}>
                <input type="date" value={form.dueDate ?? ''} onChange={e => setForm({ ...form, dueDate: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Valor (R$)">
                <input type="number" step="0.01" value={form.value ?? ''} onChange={e => setForm({ ...form, value: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
              </Field>
            </div>
            <Field label="Centro de custo">
              <select value={form.costCenterId ?? ''} onChange={e => setForm({ ...form, costCenterId: e.target.value || undefined })} className={inputCls}>
                <option value="">Nenhum</option>
                {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as AccountStatus })} className={inputCls}>
                {Object.values(AccountStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- Centros de Custo ----------

function CentrosTab({ costCenters, onSave, onDelete }: {
  costCenters: CostCenter[];
  onSave: (c: CostCenter) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<CostCenter>>({ type: CostCenterType.GERAL });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const item: CostCenter = {
      id: `cc_${Date.now()}`,
      name: form.name || 'Centro de custo',
      type: form.type ?? CostCenterType.GERAL,
      linkedRef: form.linkedRef,
      createdAt: new Date().toISOString(),
    };
    await onSave(item);
    setIsOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => { setForm({ type: CostCenterType.GERAL }); setIsOpen(true); }} className="flex items-center gap-2 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Novo Centro de Custo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {costCenters.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-200 p-4">
            <span className="text-[10px] font-bold uppercase text-gray-400">{c.type}</span>
            <h3 className="font-bold text-gray-800">{c.name}</h3>
            {c.linkedRef && <p className="text-xs text-gray-500">{c.linkedRef}</p>}
            <button onClick={() => confirm('Excluir?') && onDelete(c.id)} className="text-xs font-semibold text-red-400 mt-2 flex items-center gap-1"><Trash2 size={12} /> Excluir</button>
          </div>
        ))}
        {costCenters.length === 0 && (
          <p className="text-sm text-gray-400 col-span-full text-center py-8">Nenhum centro de custo cadastrado ainda.</p>
        )}
      </div>

      {isOpen && (
        <Modal title="Novo Centro de Custo" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Nome">
              <input value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Ex: Safra Soja 2026/27, Lote Confinamento A" />
            </Field>
            <Field label="Tipo">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as CostCenterType })} className={inputCls}>
                {Object.values(CostCenterType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Referência vinculada (opcional)">
              <input value={form.linkedRef ?? ''} onChange={e => setForm({ ...form, linkedRef: e.target.value })} className={inputCls} placeholder="Nome da safra ou do lote" />
            </Field>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- Fluxo de Caixa ----------

function FluxoTab({ payable, receivable }: { payable: AccountPayable[]; receivable: AccountReceivable[] }) {
  const totalPagar = payable.reduce((s, i) => s + (i.value ?? 0), 0);
  const totalReceber = receivable.reduce((s, i) => s + (i.value ?? 0), 0);
  const saldo = totalReceber - totalPagar;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs text-gray-400 uppercase font-bold">Total a receber</p>
        <p className="text-2xl font-bold text-green-600">R$ {totalReceber.toFixed(2)}</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs text-gray-400 uppercase font-bold">Total a pagar</p>
        <p className="text-2xl font-bold text-red-500">R$ {totalPagar.toFixed(2)}</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs text-gray-400 uppercase font-bold">Saldo projetado</p>
        <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-500'}`}>R$ {saldo.toFixed(2)}</p>
      </div>
      <p className="text-xs text-gray-400 col-span-full">
        Calculado a partir de todas as contas a pagar e a receber cadastradas (independente da data ou status) — é uma projeção simples, não um extrato bancário real.
      </p>
    </div>
  );
}

// ---------- Shared UI helpers ----------

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800">{title}</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SubmitRow({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="submit" className="flex-1 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white py-2.5 rounded-xl font-bold text-sm">Salvar</button>
      <button type="button" onClick={onCancel} className="flex-1 border border-gray-200 py-2.5 rounded-xl font-semibold text-sm text-gray-600">Cancelar</button>
    </div>
  );
}
