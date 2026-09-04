/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, Sprout, CalendarRange, NotebookPen, Bug, Droplets, AlertTriangle } from 'lucide-react';
import {
  Talhao, TalhaoStatus, AreaUnit,
  CropPlan, Cultura, CropPlanStatus,
  FieldLogEntry, FieldLogType,
  PestRecord, PestType, InfestationLevel,
  IrrigationRecord, IrrigationMethod,
  Property,
} from '../types';
import { format } from 'date-fns';
import { fetchWeatherSnapshot, WeatherSnapshot } from '../lib/weatherRules';

interface Props {
  talhoes: Talhao[];
  saveTalhao: (t: Talhao) => Promise<void>;
  deleteTalhao: (id: string) => Promise<void>;
  cropPlans: CropPlan[];
  saveCropPlan: (c: CropPlan) => Promise<void>;
  deleteCropPlan: (id: string) => Promise<void>;
  fieldLogEntries: FieldLogEntry[];
  saveFieldLogEntry: (e: FieldLogEntry) => Promise<void>;
  deleteFieldLogEntry: (id: string) => Promise<void>;
  pestRecords: PestRecord[];
  savePestRecord: (r: PestRecord) => Promise<void>;
  deletePestRecord: (id: string) => Promise<void>;
  irrigationRecords: IrrigationRecord[];
  saveIrrigationRecord: (r: IrrigationRecord) => Promise<void>;
  deleteIrrigationRecord: (id: string) => Promise<void>;
  activeProperty?: Property | null;
}

type Tab = 'talhoes' | 'planejamento' | 'caderno' | 'pragas' | 'irrigacao';

const TABS: { id: Tab; label: string; icon: typeof Sprout }[] = [
  { id: 'talhoes', label: 'Talhões', icon: Sprout },
  { id: 'planejamento', label: 'Planejamento Agrícola', icon: CalendarRange },
  { id: 'caderno', label: 'Caderno de Campo', icon: NotebookPen },
  { id: 'pragas', label: 'Manejo de Pragas', icon: Bug },
  { id: 'irrigacao', label: 'Irrigação', icon: Droplets },
];

export default function Agricultura(props: Props) {
  const [tab, setTab] = useState<Tab>('talhoes');

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Agricultura</h1>
        <p className="text-sm text-gray-500">Talhões, planejamento, caderno de campo, pragas e irrigação.</p>
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

      {tab === 'talhoes' && (
        <TalhoesTab talhoes={props.talhoes} onSave={props.saveTalhao} onDelete={props.deleteTalhao} />
      )}
      {tab === 'planejamento' && (
        <PlanejamentoTab
          cropPlans={props.cropPlans}
          talhoes={props.talhoes}
          onSave={props.saveCropPlan}
          onDelete={props.deleteCropPlan}
        />
      )}
      {tab === 'caderno' && (
        <CadernoTab
          entries={props.fieldLogEntries}
          talhoes={props.talhoes}
          onSave={props.saveFieldLogEntry}
          onDelete={props.deleteFieldLogEntry}
          activeProperty={props.activeProperty}
        />
      )}
      {tab === 'pragas' && (
        <PragasTab
          records={props.pestRecords}
          talhoes={props.talhoes}
          onSave={props.savePestRecord}
          onDelete={props.deletePestRecord}
        />
      )}
      {tab === 'irrigacao' && (
        <IrrigacaoTab
          records={props.irrigationRecords}
          talhoes={props.talhoes}
          onSave={props.saveIrrigationRecord}
          onDelete={props.deleteIrrigationRecord}
        />
      )}
    </div>
  );
}

// ---------- Talhões ----------

function TalhoesTab({ talhoes, onSave, onDelete }: {
  talhoes: Talhao[];
  onSave: (t: Talhao) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Talhao | null>(null);
  const [form, setForm] = useState<Partial<Talhao>>({ status: TalhaoStatus.ATIVO, areaUnit: AreaUnit.HECTARE });

  function openNew() {
    setEditing(null);
    setForm({ status: TalhaoStatus.ATIVO, areaUnit: AreaUnit.HECTARE });
    setIsOpen(true);
  }

  function openEdit(t: Talhao) {
    setEditing(t);
    setForm(t);
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const item: Talhao = {
      id: editing?.id ?? `talhao_${Date.now()}`,
      name: form.name || `Talhão ${talhoes.length + 1}`,
      area: form.area,
      areaUnit: form.areaUnit,
      currentCrop: form.currentCrop,
      status: form.status ?? TalhaoStatus.ATIVO,
      soilType: form.soilType,
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
          <Plus size={18} /> Novo Talhão
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {talhoes.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">
            <div className="flex items-start justify-between">
              <h3 className="font-bold text-gray-800">{t.name}</h3>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500">{t.status}</span>
            </div>
            {t.currentCrop && <p className="text-sm text-gray-600">Cultura atual: {t.currentCrop}</p>}
            {t.area != null && <p className="text-xs text-gray-500">{t.area} {t.areaUnit ?? AreaUnit.HECTARE}</p>}
            {t.soilType && <p className="text-xs text-gray-500">Solo: {t.soilType}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={() => openEdit(t)} className="text-xs font-semibold text-gray-500">Editar</button>
              <button onClick={() => confirm('Excluir?') && onDelete(t.id)} className="text-xs font-semibold text-red-400 ml-auto flex items-center gap-1"><Trash2 size={12} /> Excluir</button>
            </div>
          </div>
        ))}
        {talhoes.length === 0 && (
          <p className="text-sm text-gray-400 col-span-full text-center py-8">Nenhum talhão cadastrado ainda.</p>
        )}
      </div>

      {isOpen && (
        <Modal title={editing ? 'Editar Talhão' : 'Novo Talhão'} onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Nome">
              <input value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder={`Talhão ${talhoes.length + 1}`} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Área">
                <input type="number" step="0.01" value={form.area ?? ''} onChange={e => setForm({ ...form, area: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
              </Field>
              <Field label="Unidade">
                <select value={form.areaUnit ?? AreaUnit.HECTARE} onChange={e => setForm({ ...form, areaUnit: e.target.value as AreaUnit })} className={inputCls}>
                  {Object.values(AreaUnit).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Cultura atual">
              <input value={form.currentCrop ?? ''} onChange={e => setForm({ ...form, currentCrop: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as TalhaoStatus })} className={inputCls}>
                {Object.values(TalhaoStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Tipo de solo">
              <input value={form.soilType ?? ''} onChange={e => setForm({ ...form, soilType: e.target.value })} className={inputCls} />
            </Field>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- Planejamento Agrícola ----------

function PlanejamentoTab({ cropPlans, talhoes, onSave, onDelete }: {
  cropPlans: CropPlan[];
  talhoes: Talhao[];
  onSave: (c: CropPlan) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<CropPlan>>({ cultura: Cultura.SOJA, status: CropPlanStatus.PLANEJADO });

  function openNew() {
    setForm({ cultura: Cultura.SOJA, status: CropPlanStatus.PLANEJADO });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const item: CropPlan = {
      id: `plan_${Date.now()}`,
      talhaoId: form.talhaoId,
      cultura: form.cultura ?? Cultura.SOJA,
      safra: form.safra,
      plantingDateEstimate: form.plantingDateEstimate,
      harvestDateEstimate: form.harvestDateEstimate,
      areaPlanejada: form.areaPlanejada,
      status: form.status ?? CropPlanStatus.PLANEJADO,
      notes: form.notes,
      createdAt: new Date().toISOString(),
    };
    await onSave(item);
    setIsOpen(false);
  }

  function talhaoName(id?: string) {
    return talhoes.find(t => t.id === id)?.name ?? '—';
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-2 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Novo Planejamento
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Cultura</th>
              <th className="text-left p-3">Talhão</th>
              <th className="text-left p-3">Safra</th>
              <th className="text-left p-3">Plantio previsto</th>
              <th className="text-left p-3">Colheita prevista</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cropPlans.map((c) => (
              <tr key={c.id}>
                <td className="p-3 font-bold text-gray-700">{c.cultura}</td>
                <td className="p-3 text-gray-600">{talhaoName(c.talhaoId)}</td>
                <td className="p-3 text-gray-600">{c.safra || '—'}</td>
                <td className="p-3 text-gray-500">{c.plantingDateEstimate ? format(new Date(c.plantingDateEstimate), 'dd/MM/yyyy') : '—'}</td>
                <td className="p-3 text-gray-500">{c.harvestDateEstimate ? format(new Date(c.harvestDateEstimate), 'dd/MM/yyyy') : '—'}</td>
                <td className="p-3"><span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600">{c.status}</span></td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(c.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {cropPlans.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-400 text-sm">Nenhum planejamento cadastrado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <Modal title="Novo Planejamento Agrícola" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Cultura">
              <select value={form.cultura} onChange={e => setForm({ ...form, cultura: e.target.value as Cultura })} className={inputCls}>
                {Object.values(Cultura).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Talhão">
              <select value={form.talhaoId ?? ''} onChange={e => setForm({ ...form, talhaoId: e.target.value || undefined })} className={inputCls}>
                <option value="">Nenhum específico</option>
                {talhoes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Safra">
              <input value={form.safra ?? ''} onChange={e => setForm({ ...form, safra: e.target.value })} className={inputCls} placeholder="Ex: 2026/2027" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Plantio previsto">
                <input type="date" value={form.plantingDateEstimate ?? ''} onChange={e => setForm({ ...form, plantingDateEstimate: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Colheita prevista">
                <input type="date" value={form.harvestDateEstimate ?? ''} onChange={e => setForm({ ...form, harvestDateEstimate: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <Field label="Área planejada">
              <input type="number" step="0.01" value={form.areaPlanejada ?? ''} onChange={e => setForm({ ...form, areaPlanejada: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as CropPlanStatus })} className={inputCls}>
                {Object.values(CropPlanStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- Caderno de Campo ----------

function CadernoTab({ entries, talhoes, onSave, onDelete, activeProperty }: {
  entries: FieldLogEntry[];
  talhoes: Talhao[];
  onSave: (e: FieldLogEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  activeProperty?: Property | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<FieldLogEntry>>({ type: FieldLogType.PLANTIO });
  const [weatherWarning, setWeatherWarning] = useState<WeatherSnapshot | null>(null);
  const [checkingWeather, setCheckingWeather] = useState(false);

  // Tipos de registro onde o clima do dia realmente importa — pulverização,
  // aplicação foliar e controle de pragas ficam prejudicados ou perigosos
  // com chuva forte ou vento forte. Isso é só um AVISO: nunca impede o
  // usuário de salvar, como já foi pedido antes para todos os formulários.
  const weatherSensitiveTypes = [FieldLogType.PULVERIZACAO, FieldLogType.APLICACAO_FOLIAR, FieldLogType.CONTROLE_PRAGAS];

  useEffect(() => {
    if (!isOpen || !form.type || !weatherSensitiveTypes.includes(form.type) || !activeProperty?.location) {
      setWeatherWarning(null);
      return;
    }
    setCheckingWeather(true);
    fetchWeatherSnapshot(activeProperty.location.lat, activeProperty.location.lng)
      .then(setWeatherWarning)
      .catch(() => setWeatherWarning(null))
      .finally(() => setCheckingWeather(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, form.type, activeProperty?.location?.lat, activeProperty?.location?.lng]);

  const relevantAlerts = weatherWarning?.alerts.filter(
    a => a.type === 'chuva_pulverizacao' || a.type === 'vento_aplicacao_aerea',
  ) ?? [];

  function openNew() {
    setForm({ type: FieldLogType.PLANTIO, date: format(new Date(), 'yyyy-MM-dd') });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const item: FieldLogEntry = {
      id: `log_${Date.now()}`,
      talhaoId: form.talhaoId,
      type: form.type ?? FieldLogType.PLANTIO,
      date: form.date || format(new Date(), 'yyyy-MM-dd'),
      responsavel: form.responsavel,
      product: form.product,
      quantity: form.quantity,
      gpsLat: form.gpsLat,
      gpsLng: form.gpsLng,
      notes: form.notes,
      createdAt: new Date().toISOString(),
    };
    await onSave(item);
    setIsOpen(false);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm(f => ({ ...f, gpsLat: pos.coords.latitude, gpsLng: pos.coords.longitude })),
      () => { /* silencioso: GPS é só um extra, não bloqueia o registro */ },
    );
  }

  function talhaoName(id?: string) {
    return talhoes.find(t => t.id === id)?.name ?? '—';
  }

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
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Talhão</th>
              <th className="text-left p-3">Responsável</th>
              <th className="text-left p-3">Produto</th>
              <th className="text-left p-3">GPS</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...entries].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
              <tr key={e.id}>
                <td className="p-3 text-gray-600">{format(new Date(e.date), 'dd/MM/yyyy')}</td>
                <td className="p-3 font-bold text-gray-700">{e.type}</td>
                <td className="p-3 text-gray-600">{talhaoName(e.talhaoId)}</td>
                <td className="p-3 text-gray-500">{e.responsavel || '—'}</td>
                <td className="p-3 text-gray-500">{e.product || '—'}{e.quantity ? ` (${e.quantity})` : ''}</td>
                <td className="p-3 text-gray-400 text-xs">{e.gpsLat != null ? `${e.gpsLat.toFixed(4)}, ${e.gpsLng!.toFixed(4)}` : '—'}</td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(e.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-400 text-sm">Nenhum registro no caderno de campo ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <Modal title="Novo Registro de Campo" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Tipo">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as FieldLogType })} className={inputCls}>
                {Object.values(FieldLogType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            {checkingWeather && (
              <p className="text-xs text-gray-400">Checando o clima de hoje para esse tipo de atividade...</p>
            )}
            {relevantAlerts.map((a) => (
              <div key={a.type} className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-700">{a.title}</p>
                  <p className="text-xs text-amber-600">{a.message} Você ainda pode registrar normalmente — é só um alerta.</p>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Data">
                <input type="date" value={form.date ?? ''} onChange={e => setForm({ ...form, date: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Talhão">
                <select value={form.talhaoId ?? ''} onChange={e => setForm({ ...form, talhaoId: e.target.value || undefined })} className={inputCls}>
                  <option value="">Nenhum específico</option>
                  {talhoes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Responsável">
              <input value={form.responsavel ?? ''} onChange={e => setForm({ ...form, responsavel: e.target.value })} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Produto/Insumo">
                <input value={form.product ?? ''} onChange={e => setForm({ ...form, product: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Quantidade">
                <input value={form.quantity ?? ''} onChange={e => setForm({ ...form, quantity: e.target.value })} className={inputCls} placeholder="Ex: 20L, 5 sacas" />
              </Field>
            </div>
            <div>
              <button type="button" onClick={useMyLocation} className="text-xs font-semibold text-[#2d6a4f] underline">
                Usar minha localização atual (GPS)
              </button>
              {form.gpsLat != null && (
                <p className="text-xs text-gray-400 mt-1">{form.gpsLat.toFixed(5)}, {form.gpsLng!.toFixed(5)}</p>
              )}
            </div>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- Manejo de Pragas ----------

function PragasTab({ records, talhoes, onSave, onDelete }: {
  records: PestRecord[];
  talhoes: Talhao[];
  onSave: (r: PestRecord) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<PestRecord>>({ pestType: PestType.LAGARTA, infestationLevel: InfestationLevel.BAIXO });

  function openNew() {
    setForm({ pestType: PestType.LAGARTA, infestationLevel: InfestationLevel.BAIXO, date: format(new Date(), 'yyyy-MM-dd') });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const item: PestRecord = {
      id: `pest_${Date.now()}`,
      talhaoId: form.talhaoId,
      pestType: form.pestType ?? PestType.LAGARTA,
      date: form.date || format(new Date(), 'yyyy-MM-dd'),
      infestationLevel: form.infestationLevel ?? InfestationLevel.BAIXO,
      affectedArea: form.affectedArea,
      controlAction: form.controlAction,
      notes: form.notes,
      createdAt: new Date().toISOString(),
    };
    await onSave(item);
    setIsOpen(false);
  }

  function talhaoName(id?: string) {
    return talhoes.find(t => t.id === id)?.name ?? '—';
  }

  const levelColor: Record<string, string> = {
    [InfestationLevel.BAIXO]: 'bg-green-100 text-green-700',
    [InfestationLevel.MEDIO]: 'bg-amber-100 text-amber-700',
    [InfestationLevel.ALTO]: 'bg-orange-100 text-orange-700',
    [InfestationLevel.CRITICO]: 'bg-red-100 text-red-700',
  };

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
              <th className="text-left p-3">Praga</th>
              <th className="text-left p-3">Talhão</th>
              <th className="text-left p-3">Nível</th>
              <th className="text-left p-3">Ação de controle</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...records].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
              <tr key={r.id}>
                <td className="p-3 text-gray-600">{format(new Date(r.date), 'dd/MM/yyyy')}</td>
                <td className="p-3 font-bold text-gray-700">{r.pestType}</td>
                <td className="p-3 text-gray-600">{talhaoName(r.talhaoId)}</td>
                <td className="p-3"><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${levelColor[r.infestationLevel]}`}>{r.infestationLevel}</span></td>
                <td className="p-3 text-gray-500">{r.controlAction || '—'}</td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(r.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400 text-sm">Nenhum registro de pragas ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <Modal title="Novo Registro de Praga" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Tipo de praga">
              <select value={form.pestType} onChange={e => setForm({ ...form, pestType: e.target.value as PestType })} className={inputCls}>
                {Object.values(PestType).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data">
                <input type="date" value={form.date ?? ''} onChange={e => setForm({ ...form, date: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Talhão">
                <select value={form.talhaoId ?? ''} onChange={e => setForm({ ...form, talhaoId: e.target.value || undefined })} className={inputCls}>
                  <option value="">Nenhum específico</option>
                  {talhoes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Nível de infestação">
              <select value={form.infestationLevel} onChange={e => setForm({ ...form, infestationLevel: e.target.value as InfestationLevel })} className={inputCls}>
                {Object.values(InfestationLevel).map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Área afetada">
              <input type="number" step="0.01" value={form.affectedArea ?? ''} onChange={e => setForm({ ...form, affectedArea: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
            </Field>
            <Field label="Ação de controle">
              <input value={form.controlAction ?? ''} onChange={e => setForm({ ...form, controlAction: e.target.value })} className={inputCls} />
            </Field>
            <SubmitRow onCancel={() => setIsOpen(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- Irrigação ----------

function IrrigacaoTab({ records, talhoes, onSave, onDelete }: {
  records: IrrigationRecord[];
  talhoes: Talhao[];
  onSave: (r: IrrigationRecord) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<IrrigationRecord>>({ method: IrrigationMethod.ASPERSAO });

  function openNew() {
    setForm({ method: IrrigationMethod.ASPERSAO, date: format(new Date(), 'yyyy-MM-dd') });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const item: IrrigationRecord = {
      id: `irrig_${Date.now()}`,
      talhaoId: form.talhaoId,
      method: form.method ?? IrrigationMethod.ASPERSAO,
      date: form.date || format(new Date(), 'yyyy-MM-dd'),
      durationHours: form.durationHours,
      waterVolume: form.waterVolume,
      notes: form.notes,
      createdAt: new Date().toISOString(),
    };
    await onSave(item);
    setIsOpen(false);
  }

  function talhaoName(id?: string) {
    return talhoes.find(t => t.id === id)?.name ?? '—';
  }

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
              <th className="text-left p-3">Método</th>
              <th className="text-left p-3">Talhão</th>
              <th className="text-left p-3">Duração</th>
              <th className="text-left p-3">Volume de água</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...records].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
              <tr key={r.id}>
                <td className="p-3 text-gray-600">{format(new Date(r.date), 'dd/MM/yyyy')}</td>
                <td className="p-3 font-bold text-gray-700">{r.method}</td>
                <td className="p-3 text-gray-600">{talhaoName(r.talhaoId)}</td>
                <td className="p-3 text-gray-500">{r.durationHours != null ? `${r.durationHours}h` : '—'}</td>
                <td className="p-3 text-gray-500">{r.waterVolume != null ? `${r.waterVolume} L` : '—'}</td>
                <td className="p-3 text-right"><button onClick={() => confirm('Excluir?') && onDelete(r.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400 text-sm">Nenhum registro de irrigação ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <Modal title="Novo Registro de Irrigação" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Método">
              <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value as IrrigationMethod })} className={inputCls}>
                {Object.values(IrrigationMethod).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data">
                <input type="date" value={form.date ?? ''} onChange={e => setForm({ ...form, date: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Talhão">
                <select value={form.talhaoId ?? ''} onChange={e => setForm({ ...form, talhaoId: e.target.value || undefined })} className={inputCls}>
                  <option value="">Nenhum específico</option>
                  {talhoes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duração (horas)">
                <input type="number" step="0.1" value={form.durationHours ?? ''} onChange={e => setForm({ ...form, durationHours: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
              </Field>
              <Field label="Volume de água (L)">
                <input type="number" step="1" value={form.waterVolume ?? ''} onChange={e => setForm({ ...form, waterVolume: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
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
