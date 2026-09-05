/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Trash2, X, Tractor, Wrench } from 'lucide-react';
import { Machine, MachineType, MaintenanceRecord, MaintenanceType } from '../types';
import { format } from 'date-fns';

interface Props {
  machines: Machine[];
  saveMachine: (m: Machine) => Promise<void>;
  deleteMachine: (id: string) => Promise<void>;
  maintenanceRecords: MaintenanceRecord[];
  saveMaintenanceRecord: (r: MaintenanceRecord) => Promise<void>;
  deleteMaintenanceRecord: (id: string) => Promise<void>;
}

type Tab = 'cadastro' | 'manutencao';

export default function Maquinas(props: Props) {
  const [tab, setTab] = useState<Tab>('cadastro');

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-theme-primary">Máquinas Agrícolas</h1>
        <p className="text-sm text-theme-secondary">Tratores, colheitadeiras, pulverizadores, caminhões — cadastro e manutenção.</p>
      </div>

      <div className="flex gap-1 bg-theme-secondary p-1 rounded-xl overflow-x-auto">
        <button onClick={() => setTab('cadastro')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${tab === 'cadastro' ? 'bg-theme-card text-[var(--primary)] shadow-sm' : 'text-theme-secondary'}`}>
          <Tractor size={14} /> Cadastro
        </button>
        <button onClick={() => setTab('manutencao')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${tab === 'manutencao' ? 'bg-theme-card text-[var(--primary)] shadow-sm' : 'text-theme-secondary'}`}>
          <Wrench size={14} /> Manutenção
        </button>
      </div>

      {tab === 'cadastro' && (
        <CadastroTab machines={props.machines} onSave={props.saveMachine} onDelete={props.deleteMachine} />
      )}
      {tab === 'manutencao' && (
        <ManutencaoTab
          records={props.maintenanceRecords}
          machines={props.machines}
          onSave={props.saveMaintenanceRecord}
          onDelete={props.deleteMaintenanceRecord}
        />
      )}
    </div>
  );
}

function CadastroTab({ machines, onSave, onDelete }: {
  machines: Machine[];
  onSave: (m: Machine) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [form, setForm] = useState<Partial<Machine>>({ type: MachineType.TRATOR });

  function openNew() {
    setEditing(null);
    setForm({ type: MachineType.TRATOR });
    setIsOpen(true);
  }

  function openEdit(m: Machine) {
    setEditing(m);
    setForm(m);
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const item: Machine = {
      id: editing?.id ?? `machine_${Date.now()}`,
      type: form.type ?? MachineType.TRATOR,
      name: form.name || (form.type ?? MachineType.TRATOR),
      plate: form.plate,
      hourMeter: form.hourMeter,
      fuelConsumption: form.fuelConsumption,
      notes: form.notes,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    await onSave(item);
    setIsOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Nova Máquina
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {machines.map((m) => (
          <div key={m.id} className="bg-theme-card rounded-2xl border border-theme p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase text-theme-secondary">{m.type}</span>
            <h3 className="font-bold text-theme-primary">{m.name}</h3>
            {m.plate && <p className="text-xs text-theme-secondary">Placa: {m.plate}</p>}
            {m.hourMeter != null && <p className="text-xs text-theme-secondary">Horímetro: {m.hourMeter}h</p>}
            {m.fuelConsumption != null && <p className="text-xs text-theme-secondary">Consumo: {m.fuelConsumption} L/h</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={() => openEdit(m)} className="text-xs font-semibold text-theme-secondary">Editar</button>
              <button onClick={() => confirm('Excluir?') && onDelete(m.id)} className="text-xs font-semibold text-red-400 ml-auto flex items-center gap-1"><Trash2 size={12} /> Excluir</button>
            </div>
          </div>
        ))}
        {machines.length === 0 && (
          <p className="text-sm text-theme-secondary col-span-full text-center py-8">Nenhuma máquina cadastrada ainda.</p>
        )}
      </div>

      {isOpen && (
        <Modal title={editing ? 'Editar Máquina' : 'Nova Máquina'} onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Tipo">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as MachineType })} className={inputCls}>
                {Object.values(MachineType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Nome/Modelo">
              <input value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Ex: Trator John Deere 6110J" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Placa">
                <input value={form.plate ?? ''} onChange={e => setForm({ ...form, plate: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Horímetro atual (h)">
                <input type="number" step="0.1" value={form.hourMeter ?? ''} onChange={e => setForm({ ...form, hourMeter: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
              </Field>
            </div>
            <Field label="Consumo médio (L/h)">
              <input type="number" step="0.1" value={form.fuelConsumption ?? ''} onChange={e => setForm({ ...form, fuelConsumption: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
            </Field>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

function ManutencaoTab({ records, machines, onSave, onDelete }: {
  records: MaintenanceRecord[];
  machines: Machine[];
  onSave: (r: MaintenanceRecord) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<MaintenanceRecord>>({ type: MaintenanceType.PREVENTIVA });

  function openNew() {
    setForm({ type: MaintenanceType.PREVENTIVA, date: format(new Date(), 'yyyy-MM-dd') });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const item: MaintenanceRecord = {
      id: `maint_${Date.now()}`,
      machineId: form.machineId,
      type: form.type ?? MaintenanceType.PREVENTIVA,
      date: form.date || format(new Date(), 'yyyy-MM-dd'),
      description: form.description,
      cost: form.cost,
      hourMeterAtService: form.hourMeterAtService,
      nextServiceHourMeter: form.nextServiceHourMeter,
      notes: form.notes,
      createdAt: new Date().toISOString(),
    };
    await onSave(item);
    setIsOpen(false);
  }

  function machineName(id?: string) {
    return machines.find(m => m.id === id)?.name ?? '—';
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Novo Registro
        </button>
      </div>

      <div className="bg-theme-card rounded-2xl border border-theme overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-theme-secondary text-theme-secondary text-xs uppercase">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Máquina</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Descrição</th>
              <th className="text-left p-3">Custo</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme">
            {[...records].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
              <tr key={r.id}>
                <td className="p-3 text-theme-secondary">{format(new Date(r.date), 'dd/MM/yyyy')}</td>
                <td className="p-3 font-bold text-theme-primary">{machineName(r.machineId)}</td>
                <td className="p-3 text-theme-secondary">{r.type}</td>
                <td className="p-3 text-theme-secondary">{r.description || '—'}</td>
                <td className="p-3 text-theme-secondary">{r.cost != null ? `R$ ${r.cost.toFixed(2)}` : '—'}</td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(r.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-theme-secondary text-sm">Nenhum registro de manutenção ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <Modal title="Novo Registro de Manutenção" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Máquina">
              <select value={form.machineId ?? ''} onChange={e => setForm({ ...form, machineId: e.target.value || undefined })} className={inputCls}>
                <option value="">Nenhuma específica</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as MaintenanceType })} className={inputCls}>
                  {Object.values(MaintenanceType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Data">
                <input type="date" value={form.date ?? ''} onChange={e => setForm({ ...form, date: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <Field label="Descrição do serviço">
              <input value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Custo (R$)">
                <input type="number" step="0.01" value={form.cost ?? ''} onChange={e => setForm({ ...form, cost: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
              </Field>
              <Field label="Horímetro no serviço">
                <input type="number" step="0.1" value={form.hourMeterAtService ?? ''} onChange={e => setForm({ ...form, hourMeterAtService: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
              </Field>
            </div>
            <Field label="Próxima revisão (horímetro)">
              <input type="number" step="0.1" value={form.nextServiceHourMeter ?? ''} onChange={e => setForm({ ...form, nextServiceHourMeter: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
            </Field>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

const inputCls = "w-full border border-theme rounded-xl px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-theme-secondary">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-card rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-theme-primary">{title}</h2>
          <button onClick={onClose}><X size={20} className="text-theme-secondary" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SubmitRow({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="submit" className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white py-2.5 rounded-xl font-bold text-sm">Salvar</button>
      <button type="button" onClick={onCancel} className="flex-1 border border-theme py-2.5 rounded-xl font-semibold text-sm text-theme-secondary">Cancelar</button>
    </div>
  );
}
