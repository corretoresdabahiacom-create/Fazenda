/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Trash2, X, Users2, CalendarClock, GraduationCap, HardHat, Award } from 'lucide-react';
import { Team, WorkSchedule, Training, PPEItem, Certification } from '../types';
import { format } from 'date-fns';

interface Props {
  teams: Team[];
  saveTeam: (t: Team) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  workSchedules: WorkSchedule[];
  saveWorkSchedule: (s: WorkSchedule) => Promise<void>;
  deleteWorkSchedule: (id: string) => Promise<void>;
  trainings: Training[];
  saveTraining: (t: Training) => Promise<void>;
  deleteTraining: (id: string) => Promise<void>;
  ppeItems: PPEItem[];
  savePPEItem: (p: PPEItem) => Promise<void>;
  deletePPEItem: (id: string) => Promise<void>;
  certifications: Certification[];
  saveCertification: (c: Certification) => Promise<void>;
  deleteCertification: (id: string) => Promise<void>;
}

type Tab = 'equipes' | 'escalas' | 'treinamentos' | 'epis' | 'certificacoes';

const TABS: { id: Tab; label: string; icon: typeof Users2 }[] = [
  { id: 'equipes', label: 'Equipes', icon: Users2 },
  { id: 'escalas', label: 'Escalas', icon: CalendarClock },
  { id: 'treinamentos', label: 'Treinamentos', icon: GraduationCap },
  { id: 'epis', label: 'EPIs', icon: HardHat },
  { id: 'certificacoes', label: 'Certificações', icon: Award },
];

export default function RHRural(props: Props) {
  const [tab, setTab] = useState<Tab>('equipes');

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">RH Rural</h1>
        <p className="text-sm text-gray-500">Equipes, escalas, treinamentos, EPIs e certificações. (Pagamentos continuam na tela "Funcionários".)</p>
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

      {tab === 'equipes' && <EquipesTab items={props.teams} onSave={props.saveTeam} onDelete={props.deleteTeam} />}
      {tab === 'escalas' && <EscalasTab items={props.workSchedules} teams={props.teams} onSave={props.saveWorkSchedule} onDelete={props.deleteWorkSchedule} />}
      {tab === 'treinamentos' && <TreinamentosTab items={props.trainings} onSave={props.saveTraining} onDelete={props.deleteTraining} />}
      {tab === 'epis' && <EpisTab items={props.ppeItems} onSave={props.savePPEItem} onDelete={props.deletePPEItem} />}
      {tab === 'certificacoes' && <CertificacoesTab items={props.certifications} onSave={props.saveCertification} onDelete={props.deleteCertification} />}
    </div>
  );
}

function EquipesTab({ items, onSave, onDelete }: { items: Team[]; onSave: (t: Team) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<Team>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({ id: `team_${Date.now()}`, name: form.name || 'Equipe', memberNames: form.memberNames, notes: form.notes, createdAt: new Date().toISOString() });
    setIsOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => { setForm({}); setIsOpen(true); }} className="flex items-center gap-2 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Nova Equipe
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="font-bold text-gray-800">{t.name}</h3>
            {t.memberNames && <p className="text-xs text-gray-500 mt-1">{t.memberNames}</p>}
            <button onClick={() => confirm('Excluir?') && onDelete(t.id)} className="text-xs font-semibold text-red-400 mt-2 flex items-center gap-1"><Trash2 size={12} /> Excluir</button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400 col-span-full text-center py-8">Nenhuma equipe cadastrada ainda.</p>}
      </div>
      {isOpen && (
        <Modal title="Nova Equipe" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Nome da equipe"><input value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
            <Field label="Integrantes (nomes, separados por vírgula)"><input value={form.memberNames ?? ''} onChange={e => setForm({ ...form, memberNames: e.target.value })} className={inputCls} /></Field>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

function EscalasTab({ items, teams, onSave, onDelete }: { items: WorkSchedule[]; teams: Team[]; onSave: (s: WorkSchedule) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<WorkSchedule>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({
      id: `sched_${Date.now()}`, employeeName: form.employeeName, teamId: form.teamId,
      daysOfWeek: form.daysOfWeek, startTime: form.startTime, endTime: form.endTime,
      notes: form.notes, createdAt: new Date().toISOString(),
    });
    setIsOpen(false);
  }

  function teamName(id?: string) { return teams.find(t => t.id === id)?.name ?? '—'; }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => { setForm({}); setIsOpen(true); }} className="flex items-center gap-2 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Nova Escala
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr><th className="text-left p-3">Funcionário</th><th className="text-left p-3">Equipe</th><th className="text-left p-3">Dias</th><th className="text-left p-3">Horário</th><th className="p-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((s) => (
              <tr key={s.id}>
                <td className="p-3 font-bold text-gray-700">{s.employeeName || '—'}</td>
                <td className="p-3 text-gray-600">{teamName(s.teamId)}</td>
                <td className="p-3 text-gray-600">{s.daysOfWeek || '—'}</td>
                <td className="p-3 text-gray-500">{s.startTime && s.endTime ? `${s.startTime} - ${s.endTime}` : '—'}</td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(s.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400 text-sm">Nenhuma escala cadastrada ainda.</td></tr>}
          </tbody>
        </table>
      </div>
      {isOpen && (
        <Modal title="Nova Escala" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Funcionário"><input value={form.employeeName ?? ''} onChange={e => setForm({ ...form, employeeName: e.target.value })} className={inputCls} /></Field>
            <Field label="Equipe">
              <select value={form.teamId ?? ''} onChange={e => setForm({ ...form, teamId: e.target.value || undefined })} className={inputCls}>
                <option value="">Nenhuma</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Dias da semana"><input value={form.daysOfWeek ?? ''} onChange={e => setForm({ ...form, daysOfWeek: e.target.value })} className={inputCls} placeholder="Ex: Segunda a Sexta" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início"><input type="time" value={form.startTime ?? ''} onChange={e => setForm({ ...form, startTime: e.target.value })} className={inputCls} /></Field>
              <Field label="Fim"><input type="time" value={form.endTime ?? ''} onChange={e => setForm({ ...form, endTime: e.target.value })} className={inputCls} /></Field>
            </div>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

function TreinamentosTab({ items, onSave, onDelete }: { items: Training[]; onSave: (t: Training) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<Training>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({ id: `train_${Date.now()}`, employeeName: form.employeeName, title: form.title || 'Treinamento', date: form.date, provider: form.provider, notes: form.notes, createdAt: new Date().toISOString() });
    setIsOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => { setForm({ date: format(new Date(), 'yyyy-MM-dd') }); setIsOpen(true); }} className="flex items-center gap-2 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Novo Treinamento
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr><th className="text-left p-3">Data</th><th className="text-left p-3">Funcionário</th><th className="text-left p-3">Treinamento</th><th className="text-left p-3">Fornecedor</th><th className="p-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((t) => (
              <tr key={t.id}>
                <td className="p-3 text-gray-600">{t.date ? format(new Date(t.date), 'dd/MM/yyyy') : '—'}</td>
                <td className="p-3 text-gray-600">{t.employeeName || '—'}</td>
                <td className="p-3 font-bold text-gray-700">{t.title}</td>
                <td className="p-3 text-gray-500">{t.provider || '—'}</td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(t.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400 text-sm">Nenhum treinamento cadastrado ainda.</td></tr>}
          </tbody>
        </table>
      </div>
      {isOpen && (
        <Modal title="Novo Treinamento" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Funcionário"><input value={form.employeeName ?? ''} onChange={e => setForm({ ...form, employeeName: e.target.value })} className={inputCls} /></Field>
            <Field label="Título do treinamento"><input value={form.title ?? ''} onChange={e => setForm({ ...form, title: e.target.value })} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data"><input type="date" value={form.date ?? ''} onChange={e => setForm({ ...form, date: e.target.value })} className={inputCls} /></Field>
              <Field label="Fornecedor/Instrutor"><input value={form.provider ?? ''} onChange={e => setForm({ ...form, provider: e.target.value })} className={inputCls} /></Field>
            </div>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

function EpisTab({ items, onSave, onDelete }: { items: PPEItem[]; onSave: (p: PPEItem) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<PPEItem>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({ id: `ppe_${Date.now()}`, employeeName: form.employeeName, itemName: form.itemName || 'EPI', deliveryDate: form.deliveryDate, expirationDate: form.expirationDate, notes: form.notes, createdAt: new Date().toISOString() });
    setIsOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => { setForm({ deliveryDate: format(new Date(), 'yyyy-MM-dd') }); setIsOpen(true); }} className="flex items-center gap-2 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Novo EPI
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr><th className="text-left p-3">Funcionário</th><th className="text-left p-3">Item</th><th className="text-left p-3">Entrega</th><th className="text-left p-3">Validade</th><th className="p-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((p) => (
              <tr key={p.id}>
                <td className="p-3 text-gray-600">{p.employeeName || '—'}</td>
                <td className="p-3 font-bold text-gray-700">{p.itemName}</td>
                <td className="p-3 text-gray-500">{p.deliveryDate ? format(new Date(p.deliveryDate), 'dd/MM/yyyy') : '—'}</td>
                <td className="p-3 text-gray-500">{p.expirationDate ? format(new Date(p.expirationDate), 'dd/MM/yyyy') : '—'}</td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(p.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400 text-sm">Nenhum EPI cadastrado ainda.</td></tr>}
          </tbody>
        </table>
      </div>
      {isOpen && (
        <Modal title="Novo EPI" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Funcionário"><input value={form.employeeName ?? ''} onChange={e => setForm({ ...form, employeeName: e.target.value })} className={inputCls} /></Field>
            <Field label="Item (ex: Bota, Luva, Óculos)"><input value={form.itemName ?? ''} onChange={e => setForm({ ...form, itemName: e.target.value })} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data de entrega"><input type="date" value={form.deliveryDate ?? ''} onChange={e => setForm({ ...form, deliveryDate: e.target.value })} className={inputCls} /></Field>
              <Field label="Validade"><input type="date" value={form.expirationDate ?? ''} onChange={e => setForm({ ...form, expirationDate: e.target.value })} className={inputCls} /></Field>
            </div>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

function CertificacoesTab({ items, onSave, onDelete }: { items: Certification[]; onSave: (c: Certification) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<Certification>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({ id: `cert_${Date.now()}`, employeeName: form.employeeName, name: form.name || 'Certificação', issueDate: form.issueDate, expirationDate: form.expirationDate, notes: form.notes, createdAt: new Date().toISOString() });
    setIsOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => { setForm({}); setIsOpen(true); }} className="flex items-center gap-2 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Nova Certificação
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr><th className="text-left p-3">Funcionário</th><th className="text-left p-3">Certificação</th><th className="text-left p-3">Emissão</th><th className="text-left p-3">Validade</th><th className="p-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((c) => (
              <tr key={c.id}>
                <td className="p-3 text-gray-600">{c.employeeName || '—'}</td>
                <td className="p-3 font-bold text-gray-700">{c.name}</td>
                <td className="p-3 text-gray-500">{c.issueDate ? format(new Date(c.issueDate), 'dd/MM/yyyy') : '—'}</td>
                <td className="p-3 text-gray-500">{c.expirationDate ? format(new Date(c.expirationDate), 'dd/MM/yyyy') : '—'}</td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(c.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400 text-sm">Nenhuma certificação cadastrada ainda.</td></tr>}
          </tbody>
        </table>
      </div>
      {isOpen && (
        <Modal title="Nova Certificação" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Funcionário"><input value={form.employeeName ?? ''} onChange={e => setForm({ ...form, employeeName: e.target.value })} className={inputCls} /></Field>
            <Field label="Nome da certificação"><input value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data de emissão"><input type="date" value={form.issueDate ?? ''} onChange={e => setForm({ ...form, issueDate: e.target.value })} className={inputCls} /></Field>
              <Field label="Validade"><input type="date" value={form.expirationDate ?? ''} onChange={e => setForm({ ...form, expirationDate: e.target.value })} className={inputCls} /></Field>
            </div>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

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
