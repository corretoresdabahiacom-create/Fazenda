/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Plus, Search, Edit3, Trash2, Map as MapIcon, Users, Activity, X, Camera, Scan, 
  Info, CheckCircle2, AlertTriangle, ThermometerSun, Leaf, ArrowLeft, Beef, Sparkles, AlertCircle
} from 'lucide-react';
import { Pasture, Animal, FarmSettings } from '../types';
import { PASTURE_TYPES } from '../constants';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { CloudSun, Wind, Droplets } from 'lucide-react';
import AIAnalyzer from './AIAnalyzer';

interface Props {
  pastures: Pasture[];
  onAdd: (pasture: Pasture) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  animals: Animal[];
  settings: FarmSettings;
}

export default function Pastures({ pastures, onAdd, onDelete, animals, settings }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAIScanning, setIsAIScanning] = useState(false);
  const [selectedPastureForAnalysis, setSelectedPastureForAnalysis] = useState<Pasture | null>(null);
  const [editingPasture, setEditingPasture] = useState<Pasture | null>(null);
  const [season, setSeason] = useState<'aguas' | 'seca'>('aguas');

  // AI Capacity Estimator state inside Form
  const [isEstimatingCapacity, setIsEstimatingCapacity] = useState(false);
  const [capacityJustification, setCapacityJustification] = useState('');
  const [estimatorParams, setEstimatorParams] = useState({
    animalCategory: 'Bois Adultos (Engorda)',
    objective: 'Pastejo Rotacionado Intensivo',
  });

  const [formData, setFormData] = useState<Partial<Pasture>>({
    number: '',
    name: '',
    grassTypes: [],
    capacityAguas: 0,
    capacitySeca: 0,
    size: 0,
    purpose: 'engorda'
  });

  const getStockingRate = (pastureId: string) => {
    return animals
      .filter(a => a.currentPastureId === pastureId && !a.isSold)
      .reduce((acc, curr) => acc + curr.quantity, 0);
  };

  const filteredPastures = pastures.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.grassTypes?.length === 0) {
      alert('Selecione pelo menos um tipo de capim.');
      return;
    }

    const newPasture: Pasture = {
      id: editingPasture?.id || Date.now().toString(),
      number: formData.number || '',
      name: formData.name || '',
      grassTypes: formData.grassTypes || [],
      capacityAguas: formData.capacityAguas || 0,
      capacitySeca: formData.capacitySeca || 0,
      size: formData.size || 0,
      purpose: formData.purpose || 'engorda',
      mapX: editingPasture?.mapX,
      mapY: editingPasture?.mapY,
      stockingHistory: editingPasture?.stockingHistory || []
    };

    onAdd(newPasture);
    setIsFormOpen(false);
    setEditingPasture(null);
    setCapacityJustification('');
    setFormData({ number: '', name: '', grassTypes: [], capacityAguas: 0, capacitySeca: 0, size: 0, purpose: 'engorda' });
  };

  // Triggers the POST call to search carrying capacity suggestions
  const handleEstimatePastureCapacity = async () => {
    const size = formData.size || 0;
    const grassTypes = formData.grassTypes || [];

    if (size <= 0) {
      alert('Por favor, informe a área em hectares para simular a capacidade.');
      return;
    }
    if (grassTypes.length === 0) {
      alert('Por favor, marque pelo menos 1 tipo de capim.');
      return;
    }

    setIsEstimatingCapacity(true);
    setCapacityJustification('Processando cálculos agronômicos baseados nas diretrizes brasileiras de pastoreio...');

    try {
      const response = await fetch('/api/calculate-pasture-capacity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          size,
          grassTypes,
          animalTypes: estimatorParams.animalCategory,
          objective: estimatorParams.objective,
        }),
      });

      if (!response.ok) throw new Error('Falha na resposta do servidor.');
      
      const data = await response.json() as any;
      setFormData({
        ...formData,
        capacityAguas: data.capacityAguas || 0,
        capacitySeca: data.capacitySeca || 0,
      });
      setCapacityJustification(data.justification || '');
    } catch (err) {
      console.error(err);
      setCapacityJustification('Incapaz de computar usando a IA no momento. Por favor insira manualmente.');
    } finally {
      setIsEstimatingCapacity(false);
    }
  };

  const handleEdit = (pasture: Pasture) => {
    setEditingPasture(pasture);
    setFormData(pasture);
    setCapacityJustification('');
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    const hasAnimals = animals.some(a => a.currentPastureId === id && !a.isSold);
    if (hasAnimals) {
      alert('Não é possível excluir um pasto que contém animais ativos.');
      return;
    }
    if (confirm('Deseja excluir este pasto?')) {
      await onDelete(id);
    }
  };

  const handleAIResult = (result: any) => {
    if (selectedPastureForAnalysis) {
      onAdd({
        ...selectedPastureForAnalysis,
        aiAnalysis: { ...result, timestamp: new Date().toISOString() }
      });
    } else {
      setFormData({
        ...formData,
        grassTypes: [result.grassType],
        name: `Pasto ${result.grassType}`
      });
      setIsFormOpen(true);
    }
    setSelectedPastureForAnalysis(null);
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {isAIScanning && (
          <AIAnalyzer 
            type="pasture" 
            title="Análise de Pasto IA" 
            onResult={handleAIResult}
            onClose={() => {
              setIsAIScanning(false);
              setSelectedPastureForAnalysis(null);
            }}
          />
        )}
      </AnimatePresence>

      {settings.farmName && (
        <div className="bg-white p-4 rounded-3xl border border-[#e5e0d8] shadow-sm flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3 pr-6 border-r border-[#e5e0d8]">
            <div className="bg-green-50 p-2 rounded-xl">
              <MapIcon className="text-[#3d5a45]" size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase text-[#8d8a86]">Área Total Fazenda</div>
              <div className="text-sm font-bold text-[#3d5a45]">
                {pastures.reduce((acc, p) => acc + (p.size || 0), 0).toLocaleString()} <span className="text-[10px]">ha em {pastures.length} pastos</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#3d5a45]/5 p-2 rounded-xl text-[#3d5a45]">
              <Users size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase text-[#8d8a86]">Capacidade Total ({season === 'aguas' ? 'Águas' : 'Seca'})</div>
              <div className="text-sm font-extrabold text-[#2d2a26]">
                {pastures.reduce((acc, p) => acc + (season === 'aguas' ? p.capacityAguas : p.capacitySeca), 0)} cabeças
              </div>
            </div>
          </div>

          {/* Toggle Season */}
          <div className="ml-auto flex bg-[#f5f2ed] border p-0.5 rounded-xl text-xs font-bold text-[#8d8a86]">
            <button 
              onClick={() => setSeason('aguas')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${season === 'aguas' ? 'bg-[#3d5a45] text-white shadow-sm' : ''}`}
            >
              <Droplets size={14} /> Águas
            </button>
            <button 
              onClick={() => setSeason('seca')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${season === 'seca' ? 'bg-orange-600 text-white shadow-sm' : ''}`}
            >
              <ThermometerSun size={14} /> Seca
            </button>
          </div>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d8a86]" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar pastos..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#e5e0d8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3d5a45]/20 font-medium text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            type="button"
            onClick={() => setIsAIScanning(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#fcfaf7] text-[#3d5a45] border border-[#3d5a45] px-6 py-2.5 rounded-xl font-bold hover:bg-[#3d5a45] hover:text-white transition-all shadow-sm text-sm"
          >
            <Camera size={18} />
            Escanear Pasto
          </button>
          <button 
            onClick={() => {
              setEditingPasture(null);
              setFormData({ number: '', name: '', grassTypes: [], capacityAguas: 0, capacitySeca: 0, size: 0 });
              setIsFormOpen(true);
            }}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#3d5a45] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#2d4233] transition-colors shadow-sm text-sm"
          >
            <Plus size={18} />
            Cadastrar Pasto
          </button>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPastures.map((pasture) => {
          const count = getStockingRate(pasture.id);
          const limit = season === 'aguas' ? pasture.capacityAguas : pasture.capacitySeca;
          const pct = limit > 0 ? (count / limit) * 100 : 0;
          
          return (
            <motion.div 
              key={pasture.id}
              layout
              className="bg-white rounded-3xl border border-[#e5e0d8] shadow-sm hover:border-[#3d5a45]/40 transition-colors flex flex-col justify-between overflow-hidden"
            >
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#fcfaf7] rounded-xl flex items-center justify-center text-[#3d5a45] border border-[#e5e0d8] font-bold text-sm">
                      {pasture.number}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-[#2d2a26] text-base">{pasture.name}</h3>
                      <p className="text-[10px] text-[#8d8a86] font-bold uppercase">{pasture.size} Hectares</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => {
                        setSelectedPastureForAnalysis(pasture);
                        setIsAIScanning(true);
                      }}
                      className="p-1.5 hover:bg-[#f5f2ed] border text-[#3d5a45] bg-[#3d5a45]/5 border-[#3d5a45]/15 rounded-lg transition-transform hover:scale-105"
                      title="AI Scan"
                    >
                      <Sparkles size={14} />
                    </button>
                    <button onClick={() => handleEdit(pasture)} className="p-1.5 hover:bg-[#fcfaf7] border border-[#e5e0d8] rounded-lg text-[#6d6a66]">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => handleDelete(pasture.id)} className="p-1.5 hover:bg-red-50 border border-red-100 rounded-lg text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Grass types bullets */}
                <div className="flex flex-wrap gap-1">
                  {pasture.grassTypes.map(t => (
                    <span key={t} className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-green-50 text-green-800 border border-green-200">
                      🌿 {t}
                    </span>
                  ))}
                  {pasture.purpose && (
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                      pasture.purpose === 'engorda' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                      pasture.purpose === 'manutenção' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                      'bg-purple-50 text-purple-800 border-purple-200'
                    }`}>
                      {pasture.purpose === 'engorda' ? '🐂 Engorda' :
                       pasture.purpose === 'manutenção' ? '🌾 Manutenção' :
                       '🌟 Finalização'}
                    </span>
                  )}
                </div>

                {/* stocking rate progress bar */}
                <div className="space-y-1 pt-2 border-t border-[#f5f2ed]">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[#8d8a86]">Lotação Atual ({season === 'aguas' ? 'Águas' : 'Seca'})</span>
                    <span className={pct > 100 ? 'text-red-500' : 'text-[#3d5a45]'}>
                      {count} / {limit} cab. ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#fcfaf7] border rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${pct > 100 ? 'bg-red-500' : pct > 85 ? 'bg-amber-500' : 'bg-[#3d5a45]'}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>

                {/* AI technical insights if scanned */}
                {pasture.aiAnalysis && (
                  <div className="bg-[#3d5a45]/5 p-3.5 rounded-2xl border border-[#3d5a45]/10 space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[#3d5a45]">
                        <Sparkles size={12} />
                        <span className="text-[10px] font-bold uppercase">Análise Agronômica IA</span>
                      </div>
                      <span className="text-[8px] font-black uppercase text-grey-500">
                        {format(new Date(pasture.aiAnalysis.timestamp), 'dd/MM/yyyy')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <div className={`p-2 rounded-xl flex items-center gap-2 border ${pasture.aiAnalysis.isTimeToTakeOutCattle ? 'bg-orange-50 border-orange-100 text-orange-700' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                        <span className="text-[10px] font-bold">{pasture.aiAnalysis.isTimeToTakeOutCattle ? '🚨 Saída Urgente (Pastejo Limite)' : '✅ Em Pastoreio'}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[#3d5a45]/5 border border-[#3d5a45]/10 text-[#3d5a45] flex items-center gap-2">
                        <Activity size={12} />
                        <span className="text-[10px] font-bold">{pasture.aiAnalysis.heightCm}cm | {pasture.aiAnalysis.crudeProtein} PB | {pasture.aiAnalysis.ndt} NDT</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#6d6a66] italic leading-tight"><strong>Laudo Técnico:</strong> {pasture.aiAnalysis.technicalJustification}</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        {filteredPastures.length === 0 && (
          <div className="col-span-full py-20 text-center text-[#8d8a86] bg-[#fcfaf7] rounded-3xl border border-[#e5e0d8] italic text-sm">
            Nenhum pasto cadastrado correspondente aos termos de pesquisa.
          </div>
        )}
      </div>

      {/* Creation/Editing Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-[#e5e0d8] flex items-center justify-between bg-[#fcfaf7]">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { setIsFormOpen(false); setEditingPasture(null); }}
                  className="p-2 -ml-2 text-[#8d8a86] hover:text-[#3d5a45] hover:bg-[#e5e0d8] rounded-full transition-colors md:hidden"
                  title="Voltar"
                >
                  <ArrowLeft size={18} />
                </button>
                <h3 className="text-base font-black flex items-center gap-2 text-[#3d5a45]">
                  <MapIcon size={18} />
                  {editingPasture ? 'Editar Cadastro de Pasto' : 'Novo Cadastro de Pasto'}
                </h3>
              </div>
              <button 
                onClick={() => { setIsFormOpen(false); setEditingPasture(null); }}
                className="p-1.5 hover:bg-[#e5e0d8] rounded-full transition-colors"
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[85vh] space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1">
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Nº Pasto</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-black text-center text-[#3d5a45]"
                    value={formData.number || ''}
                    onChange={(e) => setFormData({...formData, number: e.target.value})}
                    placeholder="01"
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Nome do Setor / Pasto</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-bold"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: Baixada do Rio, Morro Alto..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-1">
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Tamanho (Hectares - ha)</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-black"
                    value={formData.size || ''}
                    onChange={(e) => setFormData({...formData, size: Number(e.target.value)})}
                    placeholder="Ex: 15.5"
                  />
                </div>

                <div className="col-span-1">
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Finalidade do Pasto</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-white border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-bold"
                    value={formData.purpose || 'engorda'}
                    onChange={(e) => setFormData({...formData, purpose: e.target.value as any})}
                  >
                    <option value="engorda">🐂 Engorda</option>
                    <option value="manutenção">🌾 Manutenção</option>
                    <option value="finalização">🌟 Finalização</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1.5 block">Gramíneas (Marque)</label>
                <div className="grid grid-cols-3 gap-2">
                  {PASTURE_TYPES.map(type => (
                    <label key={type} className={`flex items-center gap-2 p-2 rounded-xl border border-[#e5e0d8] hover:bg-[#fcfaf7] cursor-pointer transition-colors ${formData.grassTypes?.includes(type) ? 'bg-green-50/50 border-green-200' : ''}`}>
                      <input 
                        type="checkbox"
                        className="rounded text-[#3d5a45] focus:ring-[#3d5a45]"
                        checked={formData.grassTypes?.includes(type)}
                        onChange={(e) => {
                          const types = formData.grassTypes || [];
                          if (e.target.checked) {
                            setFormData({...formData, grassTypes: [...types, type]});
                          } else {
                            setFormData({...formData, grassTypes: types.filter(t => t !== type)});
                          }
                        }}
                      />
                      <span className="text-[10px] font-bold text-[#6d6a66]">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* AUTOMATIC AI SIMULATOR CARD COMPONENT */}
              <div className="p-4 bg-[#3d5a45]/5 border border-[#3d5a45]/15 rounded-2xl space-y-3.5">
                <div className="flex items-center gap-2 text-[#3d5a45]">
                  <Sparkles size={16} />
                  <h4 className="text-xs font-black uppercase">Simulador IA Agronômico de Capacidade</h4>
                </div>
                
                <p className="text-[10px] text-[#6d6a66] leading-normal font-medium">Divida e calcule as capacidades estimadas de "Águas" e "Seca" cientificamente segundo recomendações da Embrapa, baseando-se nas espécies de gramíneas e dimensão do pasto.</p>

                <div className="grid grid-cols-2 gap-3.5 pt-1">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-[#8d8a86] mb-1 block">Loteamento Previsto</label>
                    <select 
                      className="w-full px-3 py-1.5 border border-[#e5e0d8] rounded-xl text-xs bg-white font-bold text-slate-800"
                      value={estimatorParams.animalCategory}
                      onChange={(e) => setEstimatorParams({...estimatorParams, animalCategory: e.target.value})}
                    >
                      <option value="Bois Adultos (Engorda)">Bois Adultos (Engorda ~0.9 UA)</option>
                      <option value="Bezerras / Bezerros (Recria)">Bezerras / Bezerros (Recria ~0.4 UA)</option>
                      <option value="Vacas Prenhes / Amamentando">Vacas Prenhes/Amamentando (~1.0 UA)</option>
                      <option value="Garrotes / Novilhas">Garrotes e Novilhas (~0.7 UA)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-[#8d8a86] mb-1 block">Objetivo Produtivo</label>
                    <select 
                      className="w-full px-3 py-1.5 border border-[#e5e0d8] rounded-xl text-xs bg-white font-bold text-slate-800"
                      value={estimatorParams.objective}
                      onChange={(e) => setEstimatorParams({...estimatorParams, objective: e.target.value})}
                    >
                      <option value="Pastejo Rotacionado Intensivo">Rotacionado Intensivo</option>
                      <option value="Pastejo Rotacionado Tradicional">Rotacionado Comercial</option>
                      <option value="Engorda Rápida no Limite">Engorda Rápida (Fator Calibrado)</option>
                      <option value="Pastejo Contínuo Extensivo">Contínuo Extensivo</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button 
                    type="button" 
                    disabled={isEstimatingCapacity}
                    onClick={handleEstimatePastureCapacity}
                    className="flex items-center gap-1.5 bg-[#3d5a45] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#2c4031] disabled:opacity-50 transition-all active:scale-95 shadow-sm"
                  >
                    <Activity size={12} /> {isEstimatingCapacity ? 'Analisando Embrapa...' : 'Simular Capacidades com IA'}
                  </button>
                </div>

                {capacityJustification && (
                  <div className="p-3 bg-white border border-[#e5e0d8] rounded-xl text-[10px] text-emerald-950 font-medium leading-tight select-none">
                    <p className="flex items-start gap-1"><AlertCircle size={12} className="text-[#3d5a45] shrink-0 mt-0.5" /> {capacityJustification}</p>
                  </div>
                )}
              </div>

              {/* Core Limits values */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block font-bold text-[#3d5a45]">Capacidade Máxima Águas</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-black text-sm text-[#3d5a45]"
                    value={formData.capacityAguas || ''}
                    onChange={(e) => setFormData({...formData, capacityAguas: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block font-bold text-orange-600">Capacidade Máxima Seca</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-black text-sm text-orange-600"
                    value={formData.capacitySeca || ''}
                    onChange={(e) => setFormData({...formData, capacitySeca: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 px-6 py-2.5 rounded-xl border border-[#e5e0d8] font-bold text-[#6d6a66] hover:bg-[#fcfaf7] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-2.5 rounded-xl bg-[#3d5a45] font-bold text-white hover:bg-[#2d4233] transition-colors shadow-md"
                >
                  Salvar Pasto
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
