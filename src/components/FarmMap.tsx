/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, X, Check, Plus, Edit3, Map as MapIcon, Sun, CloudRain, Sparkles, Beef, 
  ChevronRight, Info, Layers, Settings2, Maximize2, FileText, Move, Trash2, HelpCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Pasture, Animal } from '../types';

interface Props {
  pastures: Pasture[];
  animals: Animal[];
  onUpdatePasture: (pasture: Pasture) => Promise<void>;
  farmSettings: any;
  onUpdateSettings: (settings: any) => Promise<void>;
}

export default function FarmMap({ pastures, animals, onUpdatePasture, farmSettings, onUpdateSettings }: Props) {
  const [activeSeason, setActiveSeason] = useState<'aguas' | 'seca'>('aguas');
  const [selectedPasture, setSelectedPasture] = useState<Pasture | null>(null);
  const [positioningPastureId, setPositioningPastureId] = useState<string | null>(null);
  const [draggedPastureId, setDraggedPastureId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // States for direct pasture creation and numbering on the Map
  const [directPastureFormOpen, setDirectPastureFormOpen] = useState(false);
  const [newDirectNumber, setNewDirectNumber] = useState('');
  const [newDirectName, setNewDirectName] = useState('');
  const [isWaitingForDirectMapClick, setIsWaitingForDirectMapClick] = useState(false);

  // States for occurrence pins
  const [occurrenceFormOpen, setOccurrenceFormOpen] = useState(false);
  const [occType, setOccType] = useState<'nascente' | 'cerca' | 'recuperacao' | 'outro'>('nascente');
  const [occTitle, setOccTitle] = useState('');
  const [occDescription, setOccDescription] = useState('');
  const [isWaitingForOccurrenceClick, setIsWaitingForOccurrenceClick] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState<any | null>(null);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Map background selection
  // Fallback to our stunning vector-designed farm SVG if none uploaded
  const mapUrl = farmSettings?.farmMapUrl || '';
  const mapFileName = farmSettings?.farmMapFileName || '';

  // Calculate stocking rates
  const getPastureAnimals = (pastureId: string) => {
    return animals.filter(a => a.currentPastureId === pastureId && !a.isSold);
  };

  const getPastureStockingCount = (pastureId: string) => {
    return getPastureAnimals(pastureId).reduce((acc, curr) => acc + curr.quantity, 0);
  };

  // Convert map click to coordinate positioning
  const handleMapClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapContainerRef.current) return;

    if (isWaitingForOccurrenceClick) {
      if (!occTitle.trim()) {
        alert('Por favor, insira o título da ocorrência primeiro.');
        return;
      }

      const rect = mapContainerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const newOcc = {
        id: Date.now().toString(),
        type: occType,
        title: occTitle.trim(),
        description: occDescription.trim(),
        x: parseFloat(x.toFixed(2)),
        y: parseFloat(y.toFixed(2)),
        createdAt: new Date().toISOString()
      };

      const existingOccurrences = farmSettings?.occurrences || [];
      const updatedSettings = {
        ...farmSettings,
        occurrences: [...existingOccurrences, newOcc]
      };

      await onUpdateSettings(updatedSettings);
      setIsWaitingForOccurrenceClick(false);
      setOccTitle('');
      setOccDescription('');
      setOccurrenceFormOpen(false);
      return;
    }

    if (isWaitingForDirectMapClick) {
      if (!newDirectNumber.trim()) {
        alert('Por favor, insira o número do pasto primeiro.');
        return;
      }
      
      // Check for duplicate number
      const trimmedNumber = newDirectNumber.trim();
      const duplicate = pastures.find(p => p.number.toLowerCase() === trimmedNumber.toLowerCase());
      if (duplicate) {
        alert(`O Pasto com número ${trimmedNumber} já existe! Use outro número ou gerencie-o nas opções.`);
        return;
      }

      const rect = mapContainerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const newPasture: Pasture = {
        id: Date.now().toString(),
        number: trimmedNumber,
        name: newDirectName.trim() || `Pasto ${trimmedNumber}`,
        grassTypes: [],
        capacityAguas: 0,
        capacitySeca: 0,
        size: 0,
        purpose: 'engorda',
        mapX: parseFloat(x.toFixed(2)),
        mapY: parseFloat(y.toFixed(2)),
        stockingHistory: []
      };

      await onUpdatePasture(newPasture);
      setIsWaitingForDirectMapClick(false);
      setNewDirectNumber('');
      setNewDirectName('');
      setDirectPastureFormOpen(false);
      return;
    }

    if (!positioningPastureId) return;

    const rect = mapContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const pastureToUpdate = pastures.find(p => p.id === positioningPastureId);
    if (pastureToUpdate) {
      await onUpdatePasture({
        ...pastureToUpdate,
        mapX: parseFloat(x.toFixed(2)),
        mapY: parseFloat(y.toFixed(2))
      });
      setPositioningPastureId(null);
    }
  };

  // Remove an occurrence from settings
  const handleRemoveOccurrence = async (occId: string) => {
    const existingOccurrences = farmSettings?.occurrences || [];
    const updatedOccurrences = existingOccurrences.filter((o: any) => o.id !== occId);

    await onUpdateSettings({
      ...farmSettings,
      occurrences: updatedOccurrences
    });

    if (selectedOccurrence?.id === occId) {
      setSelectedOccurrence(null);
    }
  };

  // Delete pasture pins from map
  const handleRemovePin = async (pastureId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const pasture = pastures.find(p => p.id === pastureId);
    if (pasture) {
      await onUpdatePasture({
        ...pasture,
        mapX: undefined,
        mapY: undefined
      });
      if (selectedPasture?.id === pastureId) {
        setSelectedPasture(null);
      }
    }
  };

  // Handle local image file uploads and compress them under 250KB properties
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    // Support PDF or Images
    if (file.type !== 'image/png' && file.type !== 'image/jpeg' && file.type !== 'image/jpg' && file.type !== 'application/pdf') {
      setUploadError('Formato de arquivo não suportado. Use PNG, JPG ou PDF.');
      setIsUploading(false);
      return;
    }

    if (file.type === 'application/pdf') {
      // PDF storage fallback simulation: We store its representation
      // For real interactive coordinates, we prompt image but also simulate visual placeholder
      const reader = new FileReader();
      reader.onload = async () => {
        await onUpdateSettings({
          ...farmSettings,
          farmMapUrl: 'pdf-placeholder',
          farmMapFileName: file.name
        });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
      return;
    }

    // Compress image client side using Canvas inside browser to fit Firestore limits
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Max resolution bound to 900px
        const maxDim = 900;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64Str = canvas.toDataURL('image/jpeg', 0.7); // compress to 70% quality JPEG
          
          await onUpdateSettings({
            ...farmSettings,
            farmMapUrl: base64Str,
            farmMapFileName: file.name
          });
        }
        setIsUploading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setUploadError('Falha ao ler o arquivo.');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleClearMapBackground = async () => {
    await onUpdateSettings({
      ...farmSettings,
      farmMapUrl: '',
      farmMapFileName: ''
    });
  };

  const mappedPastures = pastures.filter(p => typeof p.mapX === 'number' && typeof p.mapY === 'number');
  const unmappedPastures = pastures.filter(p => typeof p.mapX !== 'number' || typeof p.mapY !== 'number');

  return (
    <div className="space-y-6">
      {/* Upper controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white border border-[#e5e0d8] rounded-3xl shadow-sm">
        <div>
          <h1 className="font-serif italic font-bold text-3xl text-[#3d5a45] flex items-center gap-2">
            <MapIcon size={28} className="text-[#3d5a45] shrink-0" /> Mapa Interativo da Fazenda
          </h1>
          <p className="text-xs text-[#8d8a86] uppercase font-black tracking-wider mt-1">
            Configure e gerencie geometricamente a lotação das pastagens
          </p>
        </div>

        {/* Season Selector with visuals */}
        <div className="flex items-center gap-3 bg-[#f5f2ed] p-1 rounded-2xl border border-[#e5e0d8] self-start md:self-auto">
          <button 
            onClick={() => setActiveSeason('aguas')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeSeason === 'aguas' 
                ? 'bg-white text-emerald-800 shadow-sm border border-[#e5e0d8]' 
                : 'text-[#6c6964] hover:bg-[#ebe8e2]'
            }`}
          >
            <CloudRain size={15} className={activeSeason === 'aguas' ? 'text-emerald-600' : ''} />
            Estação das Águas
          </button>
          
          <button 
            onClick={() => setActiveSeason('seca')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeSeason === 'seca' 
                ? 'bg-white text-orange-800 shadow-sm border border-[#e5e0d8]' 
                : 'text-[#6c6964] hover:bg-[#ebe8e2]'
            }`}
          >
            <Sun size={15} className={activeSeason === 'seca' ? 'text-orange-600' : ''} />
            Estação da Seca
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Side menu - pastures positioning queue & quick stats */}
        <div className="xl:col-span-1 space-y-6 flex flex-col">
          {/* Quick pasture creator/numeration directly on map */}
          <div className="bg-white border border-[#e5e0d8] rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-[#3d5a45] uppercase tracking-wider flex items-center gap-1.5">
              <Plus size={18} className="text-[#3d5a45]" /> Numerar Pasto no Mapa
            </h2>
            <p className="text-[11px] text-[#6d6a66] leading-relaxed">
              Marque o número do pasto diretamente na maquete e salve. Depois, termine o cadastro com as informações no menu <b className="text-[#3d5a45]">Pastos</b>.
            </p>
            
            {!directPastureFormOpen ? (
              <button
                onClick={() => {
                  setDirectPastureFormOpen(true);
                  setIsWaitingForDirectMapClick(false);
                }}
                className="w-full flex items-center justify-center gap-2 bg-[#fcfaf7] text-[#3d5a45] border border-[#3d5a45] py-2 rounded-xl font-bold hover:bg-[#3d5a45] hover:text-white transition-all text-xs cursor-pointer"
              >
                <Plus size={14} /> Numerar Novo Pasto
              </button>
            ) : (
              <div className="space-y-3 bg-[#fcfaf7] p-3.5 rounded-2xl border border-[#e5e0d8]">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#8d8a86] mb-1 block">Número do Pasto *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 5, P-10..."
                    className="w-full px-3 py-1.5 border border-[#e5e0d8] rounded-lg text-xs font-bold focus:ring-1 focus:ring-[#3d5a45] focus:outline-none bg-white"
                    value={newDirectNumber}
                    onChange={(e) => setNewDirectNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#8d8a86] mb-1 block">Nome do Pasto (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Reserva, Beira-Rio..."
                    className="w-full px-3 py-1.5 border border-[#e5e0d8] rounded-lg text-xs focus:ring-1 focus:ring-[#3d5a45] focus:outline-none bg-white"
                    value={newDirectName}
                    onChange={(e) => setNewDirectName(e.target.value)}
                  />
                </div>
                
                {isWaitingForDirectMapClick ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-950 text-[10px] p-2 rounded-xl text-center font-bold animate-pulse">
                    📍 CLIQUE NO MAPA PARA FIXAR O PIN
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!newDirectNumber.trim()}
                    onClick={() => setIsWaitingForDirectMapClick(true)}
                    className="w-full bg-[#3d5a45] text-white py-2 rounded-xl font-bold hover:bg-[#2c4031] transition-all text-xs disabled:opacity-50 cursor-pointer"
                  >
                    📍 Escolher Local no Mapa
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setDirectPastureFormOpen(false);
                    setIsWaitingForDirectMapClick(false);
                    setNewDirectNumber('');
                    setNewDirectName('');
                  }}
                  className="w-full text-center text-[10px] text-red-600 font-bold hover:underline cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* Occurrence Registration Card */}
          <div className="bg-white border border-[#e5e0d8] rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-[#3d5a45] uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-emerald-700">📍</span> Pin de Ocorrência
            </h2>
            <p className="text-[11px] text-[#6d6a66] leading-relaxed">
              Marque pontos de interesse no mapa, como nascentes, cercas danificadas ou pastos em recuperação.
            </p>

            {!occurrenceFormOpen ? (
              <button
                onClick={() => {
                  setOccurrenceFormOpen(true);
                  setIsWaitingForOccurrenceClick(false);
                }}
                className="w-full flex items-center justify-center gap-2 bg-[#fcfaf7] text-[#3d5a45] border border-[#3d5a45] py-2 rounded-xl font-bold hover:bg-[#3d5a45] hover:text-white transition-all text-xs cursor-pointer"
              >
                <Plus size={14} /> Nova Ocorrência
              </button>
            ) : (
              <div className="space-y-3 bg-[#fcfaf7] p-3.5 rounded-2xl border border-[#e5e0d8]">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#8d8a86] mb-1 block">Tipo de Ocorrência</label>
                  <select
                    className="w-full px-3 py-1.5 border border-[#e5e0d8] rounded-lg text-xs font-bold focus:ring-1 focus:ring-[#3d5a45] focus:outline-none bg-white"
                    value={occType}
                    onChange={(e) => setOccType(e.target.value as any)}
                  >
                    <option value="nascente">💧 Nascente / Rec. Hídricos</option>
                    <option value="cerca">🚧 Cerca Danificada</option>
                    <option value="recuperacao">🌱 Pasto em Recuperação</option>
                    <option value="outro">📍 Outro Ponto de Interesse</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[#8d8a86] mb-1 block">Título/Ocorrência *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Cerca caída, Nascente assoreada..."
                    className="w-full px-3 py-1.5 border border-[#e5e0d8] rounded-lg text-xs font-bold focus:ring-1 focus:ring-[#3d5a45] focus:outline-none bg-white"
                    value={occTitle}
                    onChange={(e) => setOccTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[#8d8a86] mb-1 block">Descrição Detalhada</label>
                  <textarea
                    placeholder="Descreva o que precisa ser feito..."
                    rows={2}
                    className="w-full px-3 py-1.5 border border-[#e5e0d8] rounded-lg text-xs focus:ring-1 focus:ring-[#3d5a45] focus:outline-none bg-white font-sans"
                    value={occDescription}
                    onChange={(e) => setOccDescription(e.target.value)}
                  />
                </div>

                {isWaitingForOccurrenceClick ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-950 text-[10px] p-2 rounded-xl text-center font-bold animate-pulse">
                    📍 CLIQUE NO MAPA PARA MARCAR A OCORRÊNCIA
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!occTitle.trim()}
                    onClick={() => setIsWaitingForOccurrenceClick(true)}
                    className="w-full bg-[#3d5a45] text-white py-2 rounded-xl font-bold hover:bg-[#2c4031] transition-all text-xs disabled:opacity-50 cursor-pointer"
                  >
                    📍 Escolher Local no Mapa
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setOccurrenceFormOpen(false);
                    setIsWaitingForOccurrenceClick(false);
                    setOccTitle('');
                    setOccDescription('');
                  }}
                  className="w-full text-center text-[10px] text-red-600 font-bold hover:underline cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* Unmapped list */}
          <div className="bg-white border border-[#e5e0d8] rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#f5f2ed]">
              <h2 className="text-sm font-bold text-[#3d5a45] uppercase tracking-wider flex items-center gap-2">
                <Layers size={16} /> Pastos Pendentes ({unmappedPastures.length})
              </h2>
              <span className="text-[10px] uppercase font-black text-[#8d8a86] bg-[#f5f2ed] px-2 py-0.5 rounded-md">
                Sem Pin
              </span>
            </div>

            {unmappedPastures.length === 0 ? (
              <div className="text-center py-6 bg-[#fcfaf7] rounded-2xl border border-dashed border-[#e5e0d8]">
                <Check className="mx-auto text-emerald-500 mb-1" size={18} />
                <p className="text-xs font-bold text-[#3d5a45]">Tudo Posicionado!</p>
                <p className="text-[10px] text-[#8d8a86] mt-0.5">Todos os pastos estão mapeados.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {unmappedPastures.map(pasture => (
                  <div 
                    key={pasture.id} 
                    className={`p-3 rounded-2xl border transition-all text-left flex items-center justify-between ${
                      positioningPastureId === pasture.id 
                        ? 'bg-[#3d5a45] text-white border-[#3d5a45] shadow-md ring-2 ring-emerald-600/30' 
                        : 'bg-[#fcfaf7] hover:bg-[#f5f2ed] border-[#e5e0d8]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                          positioningPastureId === pasture.id 
                            ? 'bg-white/20 text-white' 
                            : 'bg-[#e5e0d8] text-[#5e5a56]'
                        }`}>
                          {pasture.number}
                        </span>
                        <h3 className="text-xs font-black truncate max-w-[124px]">{pasture.name}</h3>
                      </div>
                      <p className={`text-[10px] mt-0.5 ${positioningPastureId === pasture.id ? 'text-emerald-100' : 'text-[#8d8a86]'}`}>
                        Capim: {(pasture.grassTypes || []).slice(0, 2).join(', ')}
                      </p>
                    </div>

                    <button
                      onClick={() => setPositioningPastureId(positioningPastureId === pasture.id ? null : pasture.id)}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                        positioningPastureId === pasture.id
                          ? 'bg-white text-[#3d5a45] border-white font-black'
                          : 'bg-white text-[#3d5a45] border-[#e5e0d8] hover:bg-[#fcfaf7]'
                      }`}
                    >
                      {positioningPastureId === pasture.id ? 'Fixando...' : 'Mapear'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Farm Map Settings Card */}
          <div className="bg-white border border-[#e5e0d8] rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-[#3d5a45] uppercase tracking-wider flex items-center gap-2">
              <Settings2 size={16} /> Fundo do Mapa
            </h2>

            <div className="space-y-3">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/jpg, application/pdf"
                className="hidden"
              />

              {mapFileName ? (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="text-emerald-600 shrink-0" size={16} />
                    <span className="text-xs font-bold text-emerald-800 truncate">{mapFileName}</span>
                  </div>
                  <button 
                    onClick={handleClearMapBackground}
                    className="p-1 hover:bg-emerald-100 text-emerald-800 rounded-lg"
                    title="Remover fundo do mapa"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 border-2 border-dashed border-[#e5e0d8] hover:border-[#3d5a45] rounded-2xl text-center cursor-pointer hover:bg-[#fcfaf7] transition-all group"
                >
                  <Upload className="mx-auto text-[#8d8a86] group-hover:text-[#3d5a45] mb-2 transition-colors" size={24} />
                  <p className="text-xs font-bold text-[#3d5a45]">Fazer Upload do Mapa</p>
                  <p className="text-[10px] text-[#8d8a86] mt-1 uppercase tracking-wider font-black">PNG, JPG ou PDF</p>
                </div>
              )}

              <div className="p-4 bg-[#fcfaf7] rounded-2xl border border-[#e5e0d8] text-[11px] leading-relaxed text-[#6d6a66] space-y-2">
                <div className="flex gap-2 text-[#3d5a45] font-bold">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  <span>Dica de Navegação</span>
                </div>
                <p>
                  Criamos um **Mapa Vetorial Demonstrativo inteligente** automático para você começar a brincar na hora!
                </p>
                <p>
                  Se preferir, envie o arquivo de imagem real dos seus pastos. Ative o modo "Mapear" para furar e fixar pins de cada pasto!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Center/Right Map View container */}
        <div className="xl:col-span-3 bg-white border border-[#e5e0d8] rounded-3xl p-4 shadow-sm flex flex-col justify-between min-h-[600px] relative overflow-hidden">
          {/* Header instructions for state machines */}
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#f5f2ed]">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-[#5e5a56]">
                {isWaitingForOccurrenceClick
                  ? `Registrando Ocorrência: Clique no mapa para marcar a localização de "${occTitle}"`
                  : isWaitingForDirectMapClick
                  ? `Fixando Número de Pasto: Clique no mapa para posicionar o Pasto #${newDirectNumber}`
                  : positioningPastureId 
                  ? 'Modo de Mapeamento: Clique no mapa para posicionar o pasto' 
                  : 'Navegação Livre: Clique nos pinos dos pastos ou de ocorrências para abrir detalhes'}
              </span>
            </div>

            {(positioningPastureId || isWaitingForDirectMapClick || isWaitingForOccurrenceClick) && (
              <button 
                onClick={() => {
                  setPositioningPastureId(null);
                  setIsWaitingForDirectMapClick(false);
                  setIsWaitingForOccurrenceClick(false);
                }}
                className="flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-700 font-bold px-3 py-1 text-[10px] rounded-lg border border-red-200 transition-colors uppercase"
              >
                Cancelar <X size={12} />
              </button>
            )}
          </div>

          {/* Interactive Board Box */}
          <div 
            ref={mapContainerRef}
            onClick={handleMapClick}
            className={`relative flex-1 rounded-2xl border border-[#e5e0d8] shadow-inner overflow-hidden select-none bg-[#f5f2ed] ${
              (positioningPastureId || isWaitingForDirectMapClick) ? 'cursor-crosshair ring-2 ring-emerald-500/20' : 'cursor-pointer'
            }`}
            style={{
              backgroundImage: mapUrl && mapUrl !== 'pdf-placeholder' ? `url(${mapUrl})` : 'none',
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              minHeight: '480px'
            }}
          >
            {/* If no map uploaded, render a gorgeous vector pastoral farm illustration */}
            {(!mapUrl || mapUrl === 'pdf-placeholder') && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-90 select-none">
                <svg viewBox="0 0 800 500" className="w-full h-full object-cover">
                  {/* Grass fields gradients */}
                  <rect width="800" height="500" fill="#fcfaf7" />
                  
                  {/* Decorative pastures borders */}
                  <rect x="30" y="30" width="340" height="200" rx="30" fill="#eff8f2" stroke="#e1f3e6" strokeWidth="3" />
                  <rect x="420" y="30" width="350" height="200" rx="30" fill="#e8f3ee" stroke="#d5ebd6" strokeWidth="3" />
                  <rect x="30" y="270" width="340" height="200" rx="30" fill="#f4f7f2" stroke="#e3edd7" strokeWidth="3" />
                  <rect x="420" y="270" width="350" height="200" rx="30" fill="#f5fdf7" stroke="#e3edd7" strokeWidth="3" />
                  
                  {/* Estreito de Rio (River) */}
                  <path d="M 390 0 C 410 150, 390 300, 410 500" fill="none" stroke="#e0effd" strokeWidth="35" strokeLinecap="round" />
                  <path d="M 390 0 C 410 150, 390 300, 410 500" fill="none" stroke="#cbdefb" strokeWidth="15" strokeLinecap="round" />

                  {/* Curral central (Central corral) */}
                  <circle cx="395" cy="220" r="45" fill="#fcfaf7" stroke="#e5e0d8" strokeWidth="4" />
                  <circle cx="395" cy="220" r="35" fill="#f5f2ed" stroke="#e5e0d8" strokeWidth="2" strokeDasharray="5,5" />
                  
                  {/* Barn symbol */}
                  <g transform="translate(382, 208) scale(1.1)">
                    <polygon points="12,2 2,10 5,10 5,20 19,20 19,10 22,10" fill="#e0dace" stroke="#bfb6a7" strokeWidth="1.5" />
                    <rect x="9" y="12" width="6" height="8" fill="#c3bab0" />
                  </g>

                  {/* Text tags vector model */}
                  <text x="180" y="110" fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="#8d8a86" textAnchor="middle">Setor de Engorda Norte</text>
                  <text x="180" y="350" fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="#8d8a86" textAnchor="middle">Sub-setor de Recria Sul</text>
                  <text x="600" y="110" fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="#8d8a86" textAnchor="middle">Mombaça Piquete Alto</text>
                  <text x="600" y="350" fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="#8d8a86" textAnchor="middle">Área de Proteção / Reserva</text>
                  
                  {/* Map grid lines */}
                  <line x1="0" y1="250" x2="800" y2="250" stroke="#f1ece5" strokeWidth="1" strokeDasharray="4,8" />
                  <line x1="400" y1="0" x2="400" y2="500" stroke="#f1ece5" strokeWidth="1" strokeDasharray="4,8" />
                  
                  {/* PDF Notification label */}
                  {mapUrl === 'pdf-placeholder' && (
                    <g transform="translate(400, 470)">
                      <rect x="-180" y="-15" width="360" height="30" rx="10" fill="#1e293b" opacity="0.9" />
                      <text x="0" y="5" fontFamily="sans-serif" fontSize="10" fontWeight="bold" fill="#ffffff" textAnchor="middle">PDF SUPORTADO: Exibindo malha e pinos sobre maquete</text>
                    </g>
                  )}
                </svg>
              </div>
            )}

            {/* Pins of mapped pastures */}
            {mappedPastures.map(pasture => {
              const count = getPastureStockingCount(pasture.id);
              const limit = activeSeason === 'aguas' ? pasture.capacityAguas : pasture.capacitySeca;
              const isOverstocked = count > limit;
              
              // Purpose color selection
              let pinBg = 'bg-[#3d5a45]';
              let pinBorder = 'border-emerald-200';
              if (pasture.purpose === 'manutenção') {
                pinBg = 'bg-blue-600';
                pinBorder = 'border-blue-200';
              } else if (pasture.purpose === 'finalização') {
                pinBg = 'bg-purple-600';
                pinBorder = 'border-purple-200';
              }

              if (isOverstocked) {
                pinBg = 'bg-red-600 animate-pulse';
                pinBorder = 'border-red-300';
              }

              return (
                <motion.div
                  key={pasture.id}
                  className="absolute z-10"
                  style={{ left: `${pasture.mapX}%`, top: `${pasture.mapY}%` }}
                  initial={{ scale: 0, x: '-50%', y: '-100%' }}
                  animate={{ scale: 1, x: '-50%', y: '-100%' }}
                  whileHover={{ scale: 1.1, zIndex: 30 }}
                >
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPasture(pasture);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg border-2 ${pinBg} ${pinBorder} cursor-pointer text-white text-xs font-black select-none whitespace-nowrap`}
                  >
                    <span className="flex h-2 w-2 rounded-full bg-white relative">
                      {!isOverstocked && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      )}
                    </span>
                    <span>Pasto {pasture.number}</span>
                    <span className="bg-black/25 text-[10px] px-1.5 py-0.2 rounded font-black whitespace-nowrap">
                      {count} cab.
                    </span>
                  </div>

                  {/* Coordinate connection visual pin-leg */}
                  <div className="w-[2px] h-[10px] bg-white opacity-90 mx-auto -mt-[2px] shadow-sm" />
                  <div className="w-1.5 h-1.5 rounded-full bg-black/40 mx-auto -mt-[3px]" />
                </motion.div>
              );
            })}

            {/* Pins of occurrences */}
            {(farmSettings?.occurrences || []).map((occ: any) => {
              let pinBg = 'bg-blue-650 border-blue-200';
              if (occ.type === 'cerca') {
                pinBg = 'bg-amber-600 border-amber-200';
              } else if (occ.type === 'recuperacao') {
                pinBg = 'bg-emerald-650 border-emerald-250';
              } else if (occ.type === 'outro') {
                pinBg = 'bg-zinc-650 border-zinc-200';
              }

              return (
                <motion.div
                  key={occ.id}
                  className="absolute z-15"
                  style={{ left: `${occ.x}%`, top: `${occ.y}%` }}
                  initial={{ scale: 0, x: '-50%', y: '-100%' }}
                  animate={{ scale: 1, x: '-50%', y: '-100%' }}
                  whileHover={{ scale: 1.1, zIndex: 40 }}
                >
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOccurrence(occ);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full shadow-lg border-2 ${pinBg} cursor-pointer text-white text-[11px] font-bold select-none whitespace-nowrap`}
                  >
                    <span>
                      {occ.type === 'nascente' ? '💧' : occ.type === 'cerca' ? '🚧' : occ.type === 'recuperacao' ? '🌱' : '📍'}
                    </span>
                    <span className="max-w-[100px] truncate">{occ.title}</span>
                  </div>
                  {/* Pin leg */}
                  <div className="w-[1.5px] h-[8px] bg-white opacity-90 mx-auto -mt-[1px] shadow-sm" />
                  <div className="w-1 h-1 rounded-full bg-black/40 mx-auto -mt-[2px]" />
                </motion.div>
              );
            })}
          </div>

          {/* Bottom map status summary bar */}
          <div className="mt-4 flex items-center justify-between text-xs text-[#6d6a66] p-2 hover:bg-[#fcfaf7] rounded-xl">
            <div className="flex flex-wrap gap-4 items-center">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Pasto de Engorda
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Pasto de Manutenção
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600" /> Pasto de Finalização
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" /> Superlotação Crítica
              </span>
            </div>
            
            <span className="font-bold text-[#3d5a45]">
              {mappedPastures.length} / {pastures.length} Pastos Mapeados
            </span>
          </div>
        </div>
      </div>

      {/* PopUp Detail Modal of clicked pasture */}
      <AnimatePresence>
        {selectedPasture && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-[#e5e0d8] shadow-2xl max-w-lg w-full overflow-hidden text-left"
            >
              {/* Header Colored based on purpose */}
              <div className={`p-6 text-white relative ${
                selectedPasture.purpose === 'manutenção' 
                  ? 'bg-gradient-to-r from-blue-700 to-blue-600' 
                  : selectedPasture.purpose === 'finalização'
                  ? 'bg-gradient-to-r from-purple-700 to-purple-600'
                  : 'bg-gradient-to-r from-emerald-800 to-emerald-700'
              }`}>
                <button
                  onClick={() => setSelectedPasture(null)}
                  className="absolute right-4 top-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>

                <div className="flex items-center gap-2">
                  <span className="bg-white/20 text-[11px] font-black tracking-widest px-2 py-0.5 rounded uppercase">
                    Pasto {selectedPasture.number}
                  </span>
                  <span className="text-[11.5px] uppercase font-bold tracking-wider bg-white/20 px-2 py-0.5 rounded">
                    {selectedPasture.purpose === 'manutenção' ? '🌾 Manutenção' :
                     selectedPasture.purpose === 'finalização' ? '🌟 Finalização' : '🐂 Engorda'}
                  </span>
                </div>

                <h3 className="font-serif italic font-bold text-2xl mt-2 leading-tight">
                  {selectedPasture.name}
                </h3>
                
                <p className="text-xs text-white/80 mt-1 uppercase font-black tracking-wide">
                  Tamanho: <span className="font-bold">{selectedPasture.size} ha</span>
                </p>
              </div>

              {/* Popup Core Content body */}
              <div className="p-6 space-y-5 max-h-[450px] overflow-y-auto">
                {/* Visual Stocking progression card */}
                {(() => {
                  const count = getPastureStockingCount(selectedPasture.id);
                  const limit = activeSeason === 'aguas' ? selectedPasture.capacityAguas : selectedPasture.capacitySeca;
                  const pct = limit > 0 ? (count / limit) * 100 : 0;
                  const isExceeded = count > limit;

                  return (
                    <div className="p-4 bg-[#fcfaf7] rounded-2xl border border-[#e5e0d8] space-y-3">
                      <div className="flex justify-between items-center text-xs text-[#8d8a86]">
                        <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                          Taxa de Stocking ({activeSeason === 'aguas' ? 'Estação Águas' : 'Estação Seca'})
                        </span>
                        <span className={`font-black uppercase px-2 py-0.5 rounded text-[10px] ${
                          isExceeded ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-850'
                        }`}>
                          {isExceeded ? 'Superlotado' : 'Estável'}
                        </span>
                      </div>

                      {/* Stock capacity visual numbers */}
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-serif text-[#3d5a45] font-black">
                          {count} <span className="text-xs text-[#8d8a86] font-sans">animais presentes</span>
                        </span>
                        <span className="text-xs font-bold text-[#8d8a86]">
                          Capacidade Ideal: <span className="text-[#3d5a45] font-black">{limit} cab.</span>
                        </span>
                      </div>

                      {/* Progress line indicator */}
                      <div className="space-y-1">
                        <div className="w-full h-3 bg-[#e5e0d8] rounded-full overflow-hidden flex">
                          <motion.div 
                            className={`h-full rounded-full ${isExceeded ? 'bg-gradient-to-r from-red-500 to-red-650' : 'bg-emerald-600'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(pct, 100)}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black text-[#8d8a86]">
                          <span>0%</span>
                          <span>{pct.toFixed(0)}% Lotação</span>
                          <span>100% Capacidade ({limit} cab.)</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Season limits comparison side by side */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                    <span className="text-[10px] text-[#8d8a86] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <CloudRain size={13} className="text-emerald-600" /> Máx. Cap. (Águas)
                    </span>
                    <p className="text-xl font-serif text-emerald-800 font-bold mt-1">
                      {selectedPasture.capacityAguas} <span className="text-xs font-sans text-emerald-600">animais</span>
                    </p>
                  </div>

                  <div className="p-3 bg-orange-50/50 border border-orange-100 rounded-2xl">
                    <span className="text-[10px] text-[#8d8a86] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Sun size={13} className="text-orange-600" /> Máx. Cap. (Seca)
                    </span>
                    <p className="text-xl font-serif text-orange-850 font-bold mt-1">
                      {selectedPasture.capacitySeca} <span className="text-xs font-sans text-orange-600">animais</span>
                    </p>
                  </div>
                </div>

                {/* Grass types attributes inside sub lists */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-serif text-[#8d8a86] font-bold tracking-widest block">
                    Gramíneas Dominantes
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedPasture.grassTypes || []).map(t => (
                      <span key={t} className="px-3 py-1 bg-[#fcfaf7] border border-[#e5e0d8] text-xs font-bold rounded-xl text-[#3d5a45] flex items-center gap-1">
                        🌿 {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Animals details list currently in paddock */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-serif text-[#8d8a86] font-bold tracking-widest block pb-1 border-b border-[#f5f2ed]">
                    Inventário de Lotes Presentes
                  </span>
                  
                  {getPastureAnimals(selectedPasture.id).length === 0 ? (
                    <div className="text-center py-4 text-xs text-[#8d8a86] font-medium italic">
                      Nenhum animal nesta pastagem de momento.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {getPastureAnimals(selectedPasture.id).map(lot => {
                        let badgeColor = 'bg-[#fcfaf7] text-gray-800 border-gray-200';
                        let ownerDesc = 'Próprio';
                        if (lot.ownerName && lot.ownerName.toLowerCase() !== 'próprio' && lot.ownerName.toLowerCase() !== 'proprio') {
                          // Meia or Aluguel
                          ownerDesc = `Dono: ${lot.ownerName}`;
                          badgeColor = 'bg-[#fef9c3] text-[#713f12] border-[#fde047]';
                        }
                        return (
                          <div key={lot.id} className="p-3 bg-white border border-[#e5e0d8] rounded-2xl flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#3d5a45]" />
                                <h4 className="text-xs font-black text-[#3d5a45]">{lot.lotName || 'Lote Sem Nome'}</h4>
                                <span className={`text-[9px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded border ${badgeColor}`}>
                                  {ownerDesc}
                                </span>
                              </div>
                              <p className="text-[10px] text-[#8d8a86] mt-0.5 font-bold">
                                Categoria: {lot.category} ({lot.breed || 'Misto'}) | Peso Médio: {lot.averageWeight} kg
                              </p>
                            </div>
                            
                            <span className="text-xs font-black text-[#3d5a45] bg-[#f5f2ed] px-2.5 py-1 rounded-xl">
                              {lot.quantity} cabeças
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* PopUp buttons section */}
              <div className="p-6 bg-[#fcfaf7] border-t border-[#e5e0d8] flex justify-between gap-3 items-center">
                <button
                  onClick={() => handleRemovePin(selectedPasture!.id)}
                  className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 font-bold uppercase transition-colors"
                >
                  <Trash2 size={14} /> Remover do Mapa
                </button>

                <button
                  onClick={() => setSelectedPasture(null)}
                  className="bg-[#3d5a45] text-white hover:bg-[#2d4234] text-xs font-black tracking-wide uppercase px-6 py-2.5 rounded-xl transition-all shadow"
                >
                  Fechar Painel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {selectedOccurrence && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-[#e5e0d8] shadow-2xl max-w-md w-full overflow-hidden text-left"
            >
              <div className={`p-6 text-white relative ${
                selectedOccurrence.type === 'nascente'
                  ? 'bg-gradient-to-r from-blue-700 to-blue-600'
                  : selectedOccurrence.type === 'cerca'
                  ? 'bg-gradient-to-r from-amber-700 to-amber-600'
                  : selectedOccurrence.type === 'recuperacao'
                  ? 'bg-gradient-to-r from-emerald-800 to-emerald-700'
                  : 'bg-gradient-to-r from-zinc-700 to-zinc-650'
              }`}>
                <button
                  onClick={() => setSelectedOccurrence(null)}
                  className="absolute right-4 top-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>

                <div className="flex items-center gap-2">
                  <span className="bg-white/20 text-[10px] font-black tracking-widest px-2.5 py-0.5 rounded uppercase">
                    {selectedOccurrence.type === 'nascente' ? '💧 Nascente' :
                     selectedOccurrence.type === 'cerca' ? '🚧 Cerca Danificada' :
                     selectedOccurrence.type === 'recuperacao' ? '🌱 Em Recuperação' : '📍 Outra Ocorrência'}
                  </span>
                </div>

                <h3 className="font-serif italic font-bold text-2xl mt-2 leading-tight">
                  {selectedOccurrence.title}
                </h3>
                
                {selectedOccurrence.createdAt && (
                  <p className="text-[10px] text-white/80 mt-1 uppercase font-bold tracking-wide">
                    Registrado em: {new Date(selectedOccurrence.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>

              <div className="p-6">
                <label className="text-[10px] font-black uppercase text-[#8d8a86] tracking-wider mb-1 block">
                  Descrição / Detalhes
                </label>
                <p className="text-sm text-[#4d4a46] leading-relaxed bg-[#fcfaf7] border border-[#e5e0d8] p-4 rounded-2xl whitespace-pre-line font-medium min-h-[80px]">
                  {selectedOccurrence.description || 'Nenhuma descrição fornecida.'}
                </p>
              </div>

              <div className="p-6 bg-[#fcfaf7] border-t border-[#e5e0d8] flex justify-between gap-3 items-center">
                <button
                  onClick={() => handleRemoveOccurrence(selectedOccurrence.id)}
                  className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 font-bold uppercase transition-colors"
                >
                  <Trash2 size={14} /> Excluir Ponto
                </button>

                <button
                  onClick={() => setSelectedOccurrence(null)}
                  className="bg-[#3d5a45] text-white hover:bg-[#2d4234] text-xs font-black tracking-wide uppercase px-6 py-2.5 rounded-xl transition-all shadow-sm"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
