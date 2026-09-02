/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Edit3, Trash2, X, MapPinned, Ruler, Leaf, ShieldCheck, FileText } from 'lucide-react';
import { Property, PropertyType } from '../types';

interface Props {
  properties: Property[];
  activePropertyId: string | null;
  onSetActive: (id: string) => void;
  onSave: (property: Property) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const emptyForm: Partial<Property> = {
  name: '',
  type: PropertyType.FAZENDA,
  areaTotal: undefined,
  areaProdutiva: undefined,
  areaPreservada: undefined,
  reservaLegal: undefined,
  car: '',
  partnerName: '',
};

export default function Properties({ properties, activePropertyId, onSetActive, onSave, onDelete }: Props) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [formData, setFormData] = useState<Partial<Property>>(emptyForm);

  function openNew() {
    setEditing(null);
    setFormData(emptyForm);
    setIsFormOpen(true);
  }

  function openEdit(p: Property) {
    setEditing(p);
    setFormData(p);
    setIsFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.type) return;
    const property: Property = {
      id: editing?.id ?? `prop_${Date.now()}`,
      name: formData.name!,
      type: formData.type as PropertyType,
      areaTotal: formData.areaTotal,
      areaProdutiva: formData.areaProdutiva,
      areaPreservada: formData.areaPreservada,
      reservaLegal: formData.reservaLegal,
      car: formData.car,
      partnerName: formData.partnerName,
      location: formData.location,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    await onSave(property);
    setIsFormOpen(false);
  }

  async function handleDelete(id: string) {
    if (properties.length <= 1) {
      alert('Não é possível excluir a única propriedade cadastrada. Cadastre outra antes de remover esta.');
      return;
    }
    if (confirm('Excluir esta propriedade? Os registros vinculados a ela (animais, pastos, despesas etc.) não serão apagados, mas deixarão de aparecer até serem migrados manualmente.')) {
      await onDelete(id);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Gestão de Propriedades</h1>
          <p className="text-sm text-gray-500">Fazendas, sítios, chácaras, arrendamentos e parcerias.</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all"
        >
          <Plus size={18} /> Nova Propriedade
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {properties.map((p) => {
          const isActive = p.id === activePropertyId;
          return (
            <div
              key={p.id}
              className={`rounded-2xl border p-4 space-y-2 transition-all ${
                isActive ? 'border-[#2d6a4f] ring-2 ring-[#2d6a4f]/20 bg-[#2d6a4f]/5' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{p.type}</span>
                  <h3 className="font-bold text-gray-800">{p.name}</h3>
                </div>
                {isActive && (
                  <span className="text-[10px] font-bold text-[#2d6a4f] bg-[#2d6a4f]/10 px-2 py-1 rounded-full">
                    Ativa
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                {p.areaTotal != null && (
                  <div className="flex items-center gap-1">
                    <Ruler size={12} className="text-gray-400" /> {p.areaTotal} ha total
                  </div>
                )}
                {p.areaProdutiva != null && (
                  <div className="flex items-center gap-1">
                    <Leaf size={12} className="text-gray-400" /> {p.areaProdutiva} ha produtiva
                  </div>
                )}
                {p.reservaLegal != null && (
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={12} className="text-gray-400" /> {p.reservaLegal} ha reserva legal
                  </div>
                )}
                {p.car && (
                  <div className="flex items-center gap-1 col-span-2">
                    <FileText size={12} className="text-gray-400" /> CAR: {p.car}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                {!isActive && (
                  <button
                    onClick={() => onSetActive(p.id)}
                    className="flex items-center gap-1 text-xs font-semibold text-[#2d6a4f] hover:underline"
                  >
                    <MapPinned size={14} /> Usar esta
                  </button>
                )}
                <button
                  onClick={() => openEdit(p)}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 ml-auto"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{editing ? 'Editar Propriedade' : 'Nova Propriedade'}</h2>
              <button onClick={() => setIsFormOpen(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500">Nome *</label>
                <input
                  required
                  value={formData.name ?? ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Ex: Fazenda Terra Rica"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500">Tipo *</label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as PropertyType })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                >
                  {Object.values(PropertyType).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {(formData.type === PropertyType.PARCEIRO || formData.type === PropertyType.ARRENDAMENTO) && (
                <div>
                  <label className="text-xs font-semibold text-gray-500">Nome do parceiro/arrendante</label>
                  <input
                    value={formData.partnerName ?? ''}
                    onChange={(e) => setFormData({ ...formData, partnerName: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">Área total (ha)</label>
                  <input
                    type="number" step="0.01"
                    value={formData.areaTotal ?? ''}
                    onChange={(e) => setFormData({ ...formData, areaTotal: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Área produtiva (ha)</label>
                  <input
                    type="number" step="0.01"
                    value={formData.areaProdutiva ?? ''}
                    onChange={(e) => setFormData({ ...formData, areaProdutiva: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Área preservada (ha)</label>
                  <input
                    type="number" step="0.01"
                    value={formData.areaPreservada ?? ''}
                    onChange={(e) => setFormData({ ...formData, areaPreservada: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Reserva legal (ha)</label>
                  <input
                    type="number" step="0.01"
                    value={formData.reservaLegal ?? ''}
                    onChange={(e) => setFormData({ ...formData, reservaLegal: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500">CAR (Cadastro Ambiental Rural)</label>
                <input
                  value={formData.car ?? ''}
                  onChange={(e) => setFormData({ ...formData, car: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="BA-0000000-XXXX.XXXX.XXXX.XXXX.XXXX"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white py-2.5 rounded-xl font-bold text-sm">
                  Salvar
                </button>
                <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 border border-gray-200 py-2.5 rounded-xl font-semibold text-sm text-gray-600">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
