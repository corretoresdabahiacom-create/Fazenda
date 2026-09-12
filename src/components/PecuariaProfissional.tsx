/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Edit3, Trash2, X, Tag, Heart, Syringe, Milk, Users, CalendarRange } from 'lucide-react';
import {
  IndividualAnimal, AnimalSex, LotGroup,
  ReproductionEvent, ReproductionEventType, GESTACAO_BOVINA_DIAS,
  HealthEvent, HealthEventType,
  MilkProductionRecord,
  AnimalCategory,
  Animal, Pasture, TransactionHistory,
  BreedingSeason, BreedingMethod, BreedingSeasonStatus,
} from '../types';
import { format, addDays } from 'date-fns';
import Animals from './Animals';

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
  breedingSeasons: BreedingSeason[];
  saveBreedingSeason: (b: BreedingSeason) => Promise<void>;
  deleteBreedingSeason: (id: string) => Promise<void>;
  // Cadastro por Lote (reaproveita a tela "Animais" já existente, sem
  // duplicar código — os dois lugares mostram e editam os mesmos dados)
  animals: Animal[];
  saveAnimal: (a: Animal) => Promise<void>;
  deleteAnimal: (id: string) => Promise<void>;
  pastures: Pasture[];
  transactions: TransactionHistory[];
  saveTransaction: (t: TransactionHistory) => Promise<void>;
}

type Tab = 'lotes' | 'animais' | 'reproducao' | 'estacao-monta' | 'sanidade' | 'leite';

const TABS: { id: Tab; label: string; icon: typeof Tag }[] = [
  { id: 'lotes', label: 'Cadastro por Lote', icon: Users },
  { id: 'animais', label: 'Cadastro Individual', icon: Tag },
  { id: 'reproducao', label: 'Reprodução', icon: Heart },
  { id: 'estacao-monta', label: 'Estação de Monta', icon: CalendarRange },
  { id: 'sanidade', label: 'Sanidade', icon: Syringe },
  { id: 'leite', label: 'Produção Leiteira', icon: Milk },
];

export default function PecuariaProfissional(props: Props) {
  const [tab, setTab] = useState<Tab>('animais');

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-theme-primary">Pecuária Profissional</h1>
        <p className="text-sm text-theme-secondary">Cadastro individual, reprodução, sanidade e produção leiteira.</p>
      </div>

      <div className="flex gap-1 bg-theme-secondary p-1 rounded-xl overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-theme-card text-[var(--primary)] shadow-sm' : 'text-theme-secondary'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'lotes' && (
        <Animals
          animals={props.animals}
          onAdd={props.saveAnimal}
          onDelete={props.deleteAnimal}
          pastures={props.pastures}
          transactions={props.transactions}
          onAddTransaction={props.saveTransaction}
        />
      )}
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
      {tab === 'estacao-monta' && (
        <EstacaoMontaTab
          seasons={props.breedingSeasons}
          reproductionEvents={props.reproductionEvents}
          onSave={props.saveBreedingSeason}
          onDelete={props.deleteBreedingSeason}
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
        <button onClick={openNew} className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Novo Animal
        </button>
      </div>

      <div className="bg-theme-card rounded-2xl border border-theme overflow-hidden overflow-x-auto shadow-theme text-theme-primary">
        <table className="w-full text-sm">
          <thead className="bg-theme-secondary text-theme-secondary text-xs uppercase">
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
          <tbody className="divide-y divide-theme">
            {animals.map((a) => (
              <tr key={a.id}>
                <td className="p-3 font-bold text-theme-primary">{a.earTag}</td>
                <td className="p-3 text-theme-secondary">{a.name || '—'}</td>
                <td className="p-3 text-theme-secondary">{a.category}</td>
                <td className="p-3 text-theme-secondary">{a.sex}</td>
                <td className="p-3 text-theme-secondary">{a.lotGroup || '—'}</td>
                <td className="p-3">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    a.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-theme-secondary text-theme-secondary'
                  }`}>
                    {a.status === 'active' ? 'Ativo' : a.status === 'sold' ? 'Vendido' : 'Morto'}
                  </span>
                </td>
                <td className="p-3 flex gap-2 justify-end">
                  <button onClick={() => openEdit(a)}><Edit3 size={14} className="text-theme-secondary" /></button>
                  <button onClick={() => confirm('Excluir?') && onDelete(a.id)}><Trash2 size={14} className="text-red-400" /></button>
                </td>
              </tr>
            ))}
            {animals.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-theme-secondary text-sm">Nenhum animal cadastrado individualmente ainda.</td></tr>
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
        <button onClick={openNew} className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Novo Registro
        </button>
      </div>

      <div className="bg-theme-card rounded-2xl border border-theme overflow-hidden overflow-x-auto shadow-theme text-theme-primary">
        <table className="w-full text-sm">
          <thead className="bg-theme-secondary text-theme-secondary text-xs uppercase">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Animal</th>
              <th className="text-left p-3">Evento</th>
              <th className="text-left p-3">Detalhe</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme">
            {[...events].sort((a, b) => b.date.localeCompare(a.date)).map((ev) => (
              <tr key={ev.id}>
                <td className="p-3 text-theme-secondary">{format(new Date(ev.date), 'dd/MM/yyyy')}</td>
                <td className="p-3 font-bold text-theme-primary">{ev.animalEarTag}</td>
                <td className="p-3 text-theme-secondary">{ev.type}</td>
                <td className="p-3 text-theme-secondary text-xs">
                  {ev.expectedBirthDate && `Previsão de parto: ${format(new Date(ev.expectedBirthDate), 'dd/MM/yyyy')}`}
                  {ev.pregnancyResult && `Resultado: ${ev.pregnancyResult}`}
                  {ev.offspringEarTag && `Cria: ${ev.offspringEarTag}`}
                </td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(ev.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-theme-secondary text-sm">Nenhum evento reprodutivo registrado ainda.</td></tr>
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
              <p className="text-xs text-theme-secondary">A previsão de parto é calculada automaticamente ({GESTACAO_BOVINA_DIAS} dias de gestação bovina).</p>
            )}

            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- Estação de Monta ----------

function EstacaoMontaTab({ seasons, reproductionEvents, onSave, onDelete }: {
  seasons: BreedingSeason[];
  reproductionEvents: ReproductionEvent[];
  onSave: (b: BreedingSeason) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<BreedingSeason | null>(null);
  const [form, setForm] = useState<Partial<BreedingSeason>>({ method: BreedingMethod.MONTA_NATURAL, status: BreedingSeasonStatus.PLANEJADA, durationDays: 90 });

  function openNew() {
    setEditing(null);
    setForm({ method: BreedingMethod.MONTA_NATURAL, status: BreedingSeasonStatus.PLANEJADA, durationDays: 90, startDate: format(new Date(), 'yyyy-MM-dd') });
    setIsOpen(true);
  }

  function openEdit(b: BreedingSeason) {
    setEditing(b);
    setForm(b);
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const startDate = form.startDate || format(new Date(), 'yyyy-MM-dd');
    const durationDays = form.durationDays ?? 90;
    const endDate = format(addDays(new Date(startDate), durationDays), 'yyyy-MM-dd');
    const item: BreedingSeason = {
      id: editing?.id ?? `season_${Date.now()}`,
      name: form.name || `Estação de Monta ${new Date(startDate).getFullYear()}`,
      startDate,
      durationDays,
      endDate,
      method: form.method ?? BreedingMethod.MONTA_NATURAL,
      bullEarTags: form.bullEarTags,
      bullToCowRatio: form.bullToCowRatio,
      femaleLotGroup: form.femaleLotGroup,
      femaleCount: form.femaleCount,
      bullAndrologicalExamDone: form.bullAndrologicalExamDone,
      status: form.status ?? BreedingSeasonStatus.PLANEJADA,
      notes: form.notes,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    await onSave(item);
    setIsOpen(false);
  }

  // Taxa de prenhez calculada automaticamente: entre os diagnósticos de
  // prenhez registrados dentro da janela da estação (início até 30 dias
  // após o fim, tempo para o diagnóstico ser feito), qual % deu positivo.
  function pregnancyRate(season: BreedingSeason): { rate: number; total: number } | null {
    if (!season.endDate) return null;
    const windowEnd = format(addDays(new Date(season.endDate), 30), 'yyyy-MM-dd');
    const diagnostics = reproductionEvents.filter(
      e => e.type === ReproductionEventType.DIAGNOSTICO_PRENHEZ &&
        e.date >= season.startDate && e.date <= windowEnd &&
        e.pregnancyResult && e.pregnancyResult !== 'pendente'
    );
    if (diagnostics.length === 0) return null;
    const positive = diagnostics.filter(d => d.pregnancyResult === 'positivo').length;
    return { rate: (positive / diagnostics.length) * 100, total: diagnostics.length };
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-theme-secondary bg-theme-secondary rounded-xl p-3">
        Período concentrado de reprodução (monta natural ou IA/IATF), usado para agrupar nascimentos numa época
        favorável. Duração usual: 60 a 120 dias (mais comum 90), começando geralmente no início das águas.
      </p>
      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Nova Estação de Monta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {seasons.map((s) => {
          const preg = pregnancyRate(s);
          return (
            <div key={s.id} className="bg-theme-card rounded-2xl border border-theme p-4 space-y-1 shadow-theme text-theme-primary">
              <div className="flex items-start justify-between">
                <h3 className="font-bold text-theme-primary">{s.name}</h3>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-theme-secondary text-theme-secondary">{s.status}</span>
              </div>
              <p className="text-xs text-theme-secondary">{format(new Date(s.startDate), 'dd/MM/yyyy')} → {s.endDate ? format(new Date(s.endDate), 'dd/MM/yyyy') : '—'} ({s.durationDays} dias)</p>
              <p className="text-xs text-theme-secondary">Método: {s.method}</p>
              {s.bullEarTags && <p className="text-xs text-theme-secondary">Touro(s): {s.bullEarTags}{s.bullToCowRatio ? ` (${s.bullToCowRatio})` : ''}</p>}
              {s.femaleLotGroup && <p className="text-xs text-theme-secondary">Lote de fêmeas: {s.femaleLotGroup}{s.femaleCount ? ` (${s.femaleCount} cab.)` : ''}</p>}
              {preg && (
                <p className="text-xs font-bold text-[var(--primary)]">Taxa de prenhez: {preg.rate.toFixed(0)}% ({preg.total} diagnóstico(s))</p>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => openEdit(s)} className="text-xs font-semibold text-theme-secondary">Editar</button>
                <button onClick={() => confirm('Excluir?') && onDelete(s.id)} className="text-xs font-semibold text-red-400 ml-auto flex items-center gap-1"><Trash2 size={12} /> Excluir</button>
              </div>
            </div>
          );
        })}
        {seasons.length === 0 && (
          <p className="text-sm text-theme-secondary col-span-full text-center py-8">Nenhuma estação de monta cadastrada ainda.</p>
        )}
      </div>

      {isOpen && (
        <Modal title={editing ? 'Editar Estação de Monta' : 'Nova Estação de Monta'} onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Nome">
              <input value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Ex: Estação de Monta 2026/2027" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data de início">
                <input type="date" value={form.startDate ?? ''} onChange={e => setForm({ ...form, startDate: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Duração (dias)">
                <input type="number" value={form.durationDays ?? 90} onChange={e => setForm({ ...form, durationDays: Number(e.target.value) })} className={inputCls} />
              </Field>
            </div>
            <p className="text-[11px] text-theme-secondary">Usual entre 60 e 120 dias — 90 dias é o mais recomendado para maximizar resultados reprodutivos e produtivos.</p>
            <Field label="Método">
              <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value as BreedingMethod })} className={inputCls}>
                {Object.values(BreedingMethod).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            {(form.method === BreedingMethod.MONTA_NATURAL || form.method === BreedingMethod.MISTA) && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Brinco(s) do(s) touro(s)">
                  <input value={form.bullEarTags ?? ''} onChange={e => setForm({ ...form, bullEarTags: e.target.value })} className={inputCls} placeholder="Ex: T01, T02" />
                </Field>
                <Field label="Proporção touro:vaca">
                  <input value={form.bullToCowRatio ?? ''} onChange={e => setForm({ ...form, bullToCowRatio: e.target.value })} className={inputCls} placeholder="Ex: 1:25" />
                </Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lote/grupo de fêmeas">
                <input value={form.femaleLotGroup ?? ''} onChange={e => setForm({ ...form, femaleLotGroup: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Nº de fêmeas expostas">
                <input type="number" value={form.femaleCount ?? ''} onChange={e => setForm({ ...form, femaleCount: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-xs text-theme-secondary">
              <input type="checkbox" checked={form.bullAndrologicalExamDone ?? false} onChange={e => setForm({ ...form, bullAndrologicalExamDone: e.target.checked })} />
              Exame andrológico do(s) touro(s) realizado
            </label>
            <Field label="Status">
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as BreedingSeasonStatus })} className={inputCls}>
                {Object.values(BreedingSeasonStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
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
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">Próximos reforços/vencimentos</p>
          {upcoming.slice(0, 5).map(e => (
            <p key={e.id} className="text-xs text-amber-700 dark:text-amber-300">
              {e.animalEarTag} — {e.productName} em {format(new Date(e.nextDoseDate!), 'dd/MM/yyyy')}
            </p>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Novo Registro
        </button>
      </div>

      <div className="bg-theme-card rounded-2xl border border-theme overflow-hidden overflow-x-auto shadow-theme text-theme-primary">
        <table className="w-full text-sm">
          <thead className="bg-theme-secondary text-theme-secondary text-xs uppercase">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Animal</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Produto</th>
              <th className="text-left p-3">Próximo reforço</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme">
            {[...events].sort((a, b) => b.date.localeCompare(a.date)).map((ev) => (
              <tr key={ev.id}>
                <td className="p-3 text-theme-secondary">{format(new Date(ev.date), 'dd/MM/yyyy')}</td>
                <td className="p-3 font-bold text-theme-primary">{ev.animalEarTag}</td>
                <td className="p-3 text-theme-secondary">{ev.type}</td>
                <td className="p-3 text-theme-secondary">{ev.productName}</td>
                <td className="p-3 text-theme-secondary">{ev.nextDoseDate ? format(new Date(ev.nextDoseDate), 'dd/MM/yyyy') : '—'}</td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(ev.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-theme-secondary text-sm">Nenhum registro de sanidade ainda.</td></tr>
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
        <div className="bg-theme-card rounded-2xl border border-theme p-4 shadow-theme text-theme-primary">
          <p className="text-xs text-theme-secondary uppercase font-bold">Total no mês</p>
          <p className="text-2xl font-bold text-theme-primary">{totalMes.toFixed(1)} L</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Novo Registro
        </button>
      </div>

      <div className="bg-theme-card rounded-2xl border border-theme overflow-hidden overflow-x-auto shadow-theme text-theme-primary">
        <table className="w-full text-sm">
          <thead className="bg-theme-secondary text-theme-secondary text-xs uppercase">
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
          <tbody className="divide-y divide-theme">
            {[...records].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
              <tr key={r.id}>
                <td className="p-3 text-theme-secondary">{format(new Date(r.date), 'dd/MM/yyyy')}</td>
                <td className="p-3 font-bold text-theme-primary">{r.animalEarTag || r.lotGroup || '—'}</td>
                <td className="p-3 text-theme-secondary capitalize">{r.period}</td>
                <td className="p-3 text-theme-secondary">{r.liters} L</td>
                <td className="p-3 text-theme-secondary">{r.ccs ?? '—'}</td>
                <td className="p-3 text-theme-secondary">{r.cbt ?? '—'}</td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(r.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-theme-secondary text-sm">Nenhum registro de produção leiteira ainda.</td></tr>
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
      <div className="bg-theme-card rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto shadow-theme">
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
      <button type="button" onClick={onCancel} className="flex-1 border border-theme py-2.5 rounded-xl font-semibold text-sm text-theme-secondary bg-theme-card text-theme-primary">Cancelar</button>
    </div>
  );
}
