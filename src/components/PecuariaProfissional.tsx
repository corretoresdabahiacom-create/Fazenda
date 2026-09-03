/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Edit3, Trash2, X, Tag, Heart, Syringe, Milk } from 'lucide-react';
import {
  IndividualAnimal, AnimalSex, LotGroup,
  ReproductionEvent, ReproductionEventType, GESTACAO_BOVINA_DIAS,
  HealthEvent, HealthEventType,
  MilkProductionRecord,
  AnimalCategory,
} from '../types';
import { format, addDays } from 'date-fns';

interface Props {
  individualAnimals: IndividualAnimal[];
  saveIndividualAnimal: (a: IndividualAnimal) => Promise<void>;
  deleteIndividualAnimal: (id: string) => Promise<void>;
  reproductionEvents: ReproductionEvent[];
  saveReproductionEvent: (e: ReproductionEvent) => Promise<void>;
  deleteReproductionEvent: (id: string) => Promise<void>;
  healthEvents: HealthEvent[];
  saveHealthEvent: (e: HealthEvent) => Promise<void>;
  deleteHealthEvent: (id: string) => Promise<void>;
  milkRecords: MilkProductionRecord[];
  saveMilkRecord: (r: MilkProductionRecord) => Promise<void>;
  deleteMilkRecord: (id: string) => Promise<void>;
}

type Tab = 'animais' | 'reproducao' | 'sanidade' | 'leite';

const TABS: { id: Tab; label: string; icon: typeof Tag }[] = [
  { id: 'animais', label: 'Cadastro Individual', icon: Tag },
  { id: 'reproducao', label: 'Reprodução', icon: Heart },
  { id: 'sanidade', label: 'Sanidade', icon: Syringe },
  { id: 'leite', label: 'Produção Leiteira', icon: Milk },
];

export default function PecuariaProfissional(props: Props) {
  const [tab, setTab] = useState<Tab>('animais');

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Pecuária Profissional</h1>
        <p className="text-sm text-gray-500">Cadastro individual, reprodução, sanidade e produção leiteira.</p>
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

      {tab === 'animais' && (
        <AnimaisTab
          animals={props.individualAnimals}
          onSave={props.saveIndividualAnimal}
          onDelete={props.deleteIndividualAnimal}
        />
      )}
      {tab === 'reproducao' && (
        <ReproducaoTab
          events={props.reproductionEvents}
          animals={props.individualAnimals}
          onSave={props.saveReproductionEvent}
          onDelete={props.deleteReproductionEvent}
        />
      )}
      {tab === 'sanidade' && (
        <SanidadeTab
          events={props.healthEvents}
          animals={props.individualAnimals}
          onSave={props.saveHealthEvent}
          onDelete={props.deleteHealthEvent}
        />
      )}
      {tab === 'leite' && (
        <LeiteTab
          records={props.milkRecords}
          animals={props.individualAnimals}
          onSave={props.saveMilkRecord}
          onDelete={props.deleteMilkRecord}
        />
      )}
    </div>
  );
}

// ---------- Cadastro Individual ----------

function AnimaisTab({ animals, onSave, onDelete }: {
  animals: IndividualAnimal[];
  onSave: (a: IndividualAnimal) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<IndividualAnimal | null>(null);
  const [form, setForm] = useState<Partial<IndividualAnimal>>({ sex: AnimalSex.FEMALE, status: 'active' });

  function openNew() {
    setEditing(null);
    setForm({ sex: AnimalSex.FEMALE, status: 'active' });
    setIsOpen(true);
  }

  function openEdit(a: IndividualAnimal) {
    setEditing(a);
    setForm(a);
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const item: IndividualAnimal = {
      id: editing?.id ?? `ind_${Date.now()}`,
      earTag: form.earTag ?? '',
      rfid: form.rfid,
      name: form.name,
      breed: form.breed,
      sex: (form.sex as AnimalSex) ?? AnimalSex.FEMALE,
      category: (form.category as AnimalCategory) ?? AnimalCategory.COW,
      lotGroup: form.lotGroup,
      birthDate: form.birthDate,
      motherEarTag: form.motherEarTag,
      fatherEarTag: form.fatherEarTag,
      status: (form.status as 'active' | 'sold' | 'dead') ?? 'active',
      notes: form.notes,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    await onSave(item);
    setIsOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-2 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Novo Animal
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Brinco</th>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Categoria</th>
              <th className="text-left p-3">Sexo</th>
              <th className="text-left p-3">Lote</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {animals.map((a) => (
              <tr key={a.id}>
                <td className="p-3 font-bold text-gray-700">{a.earTag}</td>
                <td className="p-3 text-gray-600">{a.name || '—'}</td>
                <td className="p-3 text-gray-600">{a.category}</td>
                <td className="p-3 text-gray-600">{a.sex}</td>
                <td className="p-3 text-gray-600">{a.lotGroup || '—'}</td>
                <td className="p-3">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {a.status === 'active' ? 'Ativo' : a.status === 'sold' ? 'Vendido' : 'Morto'}
                  </span>
                </td>
                <td className="p-3 flex gap-2 justify-end">
                  <button onClick={() => openEdit(a)}><Edit3 size={14} className="text-gray-400" /></button>
                  <button onClick={() => confirm('Excluir?') && onDelete(a.id)}><Trash2 size={14} className="text-red-400" /></button>
                </td>
              </tr>
            ))}
            {animals.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-400 text-sm">Nenhum animal cadastrado individualmente ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <Modal title={editing ? 'Editar Animal' : 'Novo Animal'} onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Brinco *">
                <input value={form.earTag ?? ''} onChange={e => setForm({ ...form, earTag: e.target.value })} className={inputCls} />
              </Field>
              <Field label="RFID">
                <input value={form.rfid ?? ''} onChange={e => setForm({ ...form, rfid: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <Field label="Nome">
              <input value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Raça">
                <input value={form.breed ?? ''} onChange={e => setForm({ ...form, breed: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Data de nascimento">
                <input type="date" value={form.birthDate ?? ''} onChange={e => setForm({ ...form, birthDate: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sexo *">
                <select value={form.sex} onChange={e => setForm({ ...form, sex: e.target.value as AnimalSex })} className={inputCls}>
                  {Object.values(AnimalSex).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Categoria *">
                <select value={form.category ?? ''} onChange={e => setForm({ ...form, category: e.target.value as AnimalCategory })} className={inputCls}>
                  <option value="">Selecione</option>
                  {Object.values(AnimalCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Grupo/Lote">
              <select value={form.lotGroup ?? ''} onChange={e => setForm({ ...form, lotGroup: (e.target.value as LotGroup) || undefined })} className={inputCls}>
                <option value="">Nenhum</option>
                {Object.values(LotGroup).map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Brinco da mãe">
                <input value={form.motherEarTag ?? ''} onChange={e => setForm({ ...form, motherEarTag: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Brinco do pai">
                <input value={form.fatherEarTag ?? ''} onChange={e => setForm({ ...form, fatherEarTag: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <Field label="Status">
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })} className={inputCls}>
                <option value="active">Ativo</option>
                <option value="sold">Vendido</option>
                <option value="dead">Morto</option>
              </select>
            </Field>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- Reprodução ----------

function ReproducaoTab({ events, animals, onSave, onDelete }: {
  events: ReproductionEvent[];
  animals: IndividualAnimal[];
  onSave: (e: ReproductionEvent) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<ReproductionEvent>>({ type: ReproductionEventType.COBERTURA });

  function openNew() {
    setForm({ type: ReproductionEventType.COBERTURA, date: format(new Date(), 'yyyy-MM-dd') });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const item0date = form.date || format(new Date(), 'yyyy-MM-dd');
    let expectedBirthDate: string | undefined;
    if ([ReproductionEventType.COBERTURA, ReproductionEventType.INSEMINACAO, ReproductionEventType.IATF].includes(form.type)) {
      expectedBirthDate = format(addDays(new Date(item0date), GESTACAO_BOVINA_DIAS), 'yyyy-MM-dd');
    }

    const item: ReproductionEvent = {
      id: `repro_${Date.now()}`,
      animalEarTag: form.animalEarTag ?? '',
      type: (form.type as ReproductionEventType) ?? ReproductionEventType.COBERTURA,
      date: item0date,
      sireEarTag: form.sireEarTag,
      semenBatch: form.semenBatch,
      pregnancyResult: form.pregnancyResult,
      expectedBirthDate,
      offspringEarTag: form.offspringEarTag,
      weaningWeight: form.weaningWeight,
      notes: form.notes,
    };
    await onSave(item);
    setIsOpen(false);
  }

  const needsSire = [ReproductionEventType.COBERTURA, ReproductionEventType.INSEMINACAO, ReproductionEventType.IATF].includes(form.type as ReproductionEventType);
  const isDiagnostico = form.type === ReproductionEventType.DIAGNOSTICO_PRENHEZ;
  const isParto = form.type === ReproductionEventType.PARTO;
  const isDesmama = form.type === ReproductionEventType.DESMAMA;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-2 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Novo Registro
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Animal</th>
              <th className="text-left p-3">Evento</th>
              <th className="text-left p-3">Detalhe</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...events].sort((a, b) => b.date.localeCompare(a.date)).map((ev) => (
              <tr key={ev.id}>
                <td className="p-3 text-gray-600">{format(new Date(ev.date), 'dd/MM/yyyy')}</td>
                <td className="p-3 font-bold text-gray-700">{ev.animalEarTag}</td>
                <td className="p-3 text-gray-600">{ev.type}</td>
                <td className="p-3 text-gray-500 text-xs">
                  {ev.expectedBirthDate && `Previsão de parto: ${format(new Date(ev.expectedBirthDate), 'dd/MM/yyyy')}`}
                  {ev.pregnancyResult && `Resultado: ${ev.pregnancyResult}`}
                  {ev.offspringEarTag && `Cria: ${ev.offspringEarTag}`}
                </td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(ev.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400 text-sm">Nenhum evento reprodutivo registrado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <Modal title="Novo Evento Reprodutivo" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Tipo de evento *">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as ReproductionEventType })} className={inputCls}>
                {Object.values(ReproductionEventType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Brinco da fêmea *">
                <input list="animais-list" value={form.animalEarTag ?? ''} onChange={e => setForm({ ...form, animalEarTag: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Data *">
                <input type="date" value={form.date ?? ''} onChange={e => setForm({ ...form, date: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <datalist id="animais-list">
              {animals.map(a => <option key={a.id} value={a.earTag} />)}
            </datalist>

            {needsSire && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Brinco do touro/reprodutor">
                  <input value={form.sireEarTag ?? ''} onChange={e => setForm({ ...form, sireEarTag: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Partida de sêmen">
                  <input value={form.semenBatch ?? ''} onChange={e => setForm({ ...form, semenBatch: e.target.value })} className={inputCls} />
                </Field>
              </div>
            )}

            {isDiagnostico && (
              <Field label="Resultado">
                <select value={form.pregnancyResult ?? 'pendente'} onChange={e => setForm({ ...form, pregnancyResult: e.target.value as any })} className={inputCls}>
                  <option value="pendente">Pendente</option>
                  <option value="positivo">Positivo</option>
                  <option value="negativo">Negativo</option>
                </select>
              </Field>
            )}

            {isParto && (
              <Field label="Brinco da cria (se já identificada)">
                <input value={form.offspringEarTag ?? ''} onChange={e => setForm({ ...form, offspringEarTag: e.target.value })} className={inputCls} />
              </Field>
            )}

            {isDesmama && (
              <Field label="Peso à desmama (kg)">
                <input type="number" step="0.1" value={form.weaningWeight ?? ''} onChange={e => setForm({ ...form, weaningWeight: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
              </Field>
            )}

            {needsSire && (
              <p className="text-xs text-gray-400">A previsão de parto é calculada automaticamente ({GESTACAO_BOVINA_DIAS} dias de gestação bovina).</p>
            )}

            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- Sanidade ----------

function SanidadeTab({ events, animals, onSave, onDelete }: {
  events: HealthEvent[];
  animals: IndividualAnimal[];
  onSave: (e: HealthEvent) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<HealthEvent>>({ type: HealthEventType.VACINACAO });

  function openNew() {
    setForm({ type: HealthEventType.VACINACAO, date: format(new Date(), 'yyyy-MM-dd') });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const item: HealthEvent = {
      id: `health_${Date.now()}`,
      animalEarTag: form.animalEarTag ?? '',
      type: (form.type as HealthEventType) ?? HealthEventType.VACINACAO,
      productName: form.productName ?? '',
      date: form.date || format(new Date(), 'yyyy-MM-dd'),
      nextDoseDate: form.nextDoseDate,
      dosage: form.dosage,
      veterinarian: form.veterinarian,
      cost: form.cost,
      notes: form.notes,
    };
    await onSave(item);
    setIsOpen(false);
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const upcoming = events.filter(e => e.nextDoseDate && e.nextDoseDate >= today).sort((a, b) => (a.nextDoseDate! < b.nextDoseDate! ? -1 : 1));

  return (
    <div className="space-y-3">
      {upcoming.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs font-bold text-amber-700 mb-1">Próximos reforços/vencimentos</p>
          {upcoming.slice(0, 5).map(e => (
            <p key={e.id} className="text-xs text-amber-700">
              {e.animalEarTag} — {e.productName} em {format(new Date(e.nextDoseDate!), 'dd/MM/yyyy')}
            </p>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-2 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Novo Registro
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Animal</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Produto</th>
              <th className="text-left p-3">Próximo reforço</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...events].sort((a, b) => b.date.localeCompare(a.date)).map((ev) => (
              <tr key={ev.id}>
                <td className="p-3 text-gray-600">{format(new Date(ev.date), 'dd/MM/yyyy')}</td>
                <td className="p-3 font-bold text-gray-700">{ev.animalEarTag}</td>
                <td className="p-3 text-gray-600">{ev.type}</td>
                <td className="p-3 text-gray-600">{ev.productName}</td>
                <td className="p-3 text-gray-500">{ev.nextDoseDate ? format(new Date(ev.nextDoseDate), 'dd/MM/yyyy') : '—'}</td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(ev.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400 text-sm">Nenhum registro de sanidade ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <Modal title="Novo Registro de Sanidade" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Tipo *">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as HealthEventType })} className={inputCls}>
                {Object.values(HealthEventType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Brinco do animal *">
                <input list="animais-list-2" value={form.animalEarTag ?? ''} onChange={e => setForm({ ...form, animalEarTag: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Data *">
                <input type="date" value={form.date ?? ''} onChange={e => setForm({ ...form, date: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <datalist id="animais-list-2">
              {animals.map(a => <option key={a.id} value={a.earTag} />)}
            </datalist>
            <Field label="Produto/Nome *">
              <input value={form.productName ?? ''} onChange={e => setForm({ ...form, productName: e.target.value })} className={inputCls} placeholder="Ex: Vacina Aftosa, Ivermectina..." />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dosagem">
                <input value={form.dosage ?? ''} onChange={e => setForm({ ...form, dosage: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Próximo reforço/vencimento">
                <input type="date" value={form.nextDoseDate ?? ''} onChange={e => setForm({ ...form, nextDoseDate: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Veterinário responsável">
                <input value={form.veterinarian ?? ''} onChange={e => setForm({ ...form, veterinarian: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Custo (R$)">
                <input type="number" step="0.01" value={form.cost ?? ''} onChange={e => setForm({ ...form, cost: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
              </Field>
            </div>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- Produção Leiteira ----------

function LeiteTab({ records, animals, onSave, onDelete }: {
  records: MilkProductionRecord[];
  animals: IndividualAnimal[];
  onSave: (r: MilkProductionRecord) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<MilkProductionRecord>>({ period: 'dia' });

  function openNew() {
    setForm({ period: 'dia', date: format(new Date(), 'yyyy-MM-dd') });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const item: MilkProductionRecord = {
      id: `milk_${Date.now()}`,
      animalEarTag: form.animalEarTag,
      lotGroup: form.lotGroup,
      date: form.date || format(new Date(), 'yyyy-MM-dd'),
      period: (form.period as any) ?? 'dia',
      liters: form.liters ?? 0,
      ccs: form.ccs,
      cbt: form.cbt,
      notes: form.notes,
    };
    await onSave(item);
    setIsOpen(false);
  }

  const totalMes = records
    .filter(r => r.date.startsWith(format(new Date(), 'yyyy-MM')))
    .reduce((sum, r) => sum + r.liters, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase font-bold">Total no mês</p>
          <p className="text-2xl font-bold text-gray-800">{totalMes.toFixed(1)} L</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-2 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Novo Registro
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Animal/Lote</th>
              <th className="text-left p-3">Período</th>
              <th className="text-left p-3">Litros</th>
              <th className="text-left p-3">CCS</th>
              <th className="text-left p-3">CBT</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...records].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
              <tr key={r.id}>
                <td className="p-3 text-gray-600">{format(new Date(r.date), 'dd/MM/yyyy')}</td>
                <td className="p-3 font-bold text-gray-700">{r.animalEarTag || r.lotGroup || '—'}</td>
                <td className="p-3 text-gray-600 capitalize">{r.period}</td>
                <td className="p-3 text-gray-600">{r.liters} L</td>
                <td className="p-3 text-gray-500">{r.ccs ?? '—'}</td>
                <td className="p-3 text-gray-500">{r.cbt ?? '—'}</td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(r.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-400 text-sm">Nenhum registro de produção leiteira ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <Modal title="Novo Registro de Produção" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data *">
                <input type="date" value={form.date ?? ''} onChange={e => setForm({ ...form, date: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Período">
                <select value={form.period} onChange={e => setForm({ ...form, period: e.target.value as any })} className={inputCls}>
                  <option value="dia">Dia inteiro</option>
                  <option value="manha">Manhã</option>
                  <option value="tarde">Tarde</option>
                </select>
              </Field>
            </div>
            <Field label="Brinco do animal (opcional, se for por lote deixe em branco)">
              <input list="animais-list-3" value={form.animalEarTag ?? ''} onChange={e => setForm({ ...form, animalEarTag: e.target.value })} className={inputCls} />
            </Field>
            <datalist id="animais-list-3">
              {animals.map(a => <option key={a.id} value={a.earTag} />)}
            </datalist>
            <Field label="Litros *">
              <input type="number" step="0.1" value={form.liters ?? ''} onChange={e => setForm({ ...form, liters: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CCS (mil cél/mL)">
                <input type="number" value={form.ccs ?? ''} onChange={e => setForm({ ...form, ccs: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
              </Field>
              <Field label="CBT (UFC/mL)">
                <input type="number" value={form.cbt ?? ''} onChange={e => setForm({ ...form, cbt: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
              </Field>
            </div>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
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
