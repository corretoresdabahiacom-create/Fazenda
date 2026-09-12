/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, Search, Edit3, Trash2, Beef, Tag, Calendar, 
  ChevronRight, ArrowRightLeft, DollarSign, History, X, Camera, Scan, ArrowLeft, 
  ShoppingCart, Landmark, TrendingUp, Sparkles, User, Percent, HelpCircle
} from 'lucide-react';
import { Animal, AnimalType, Pasture, TransactionHistory, AnimalCategory } from '../types';
import { ANIMAL_CATEGORIES } from '../constants';
import { format, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import AIAnalyzer from './AIAnalyzer';
import WeightHistoryPanel from './WeightHistoryPanel';

interface Props {
  animals: Animal[];
  onAdd: (animal: Animal) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  pastures: Pasture[];
  transactions: TransactionHistory[];
  onAddTransaction: (t: TransactionHistory) => Promise<void>;
  scanMode?: boolean;
}

export default function Animals({ animals, onAdd, onDelete, pastures, transactions, onAddTransaction, scanMode = false }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAIScanning, setIsAIScanning] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [expandedWeightLotId, setExpandedWeightLotId] = useState<string | null>(null);

  // Auto scan when accessed via scanMode
  React.useEffect(() => {
    if (scanMode) {
      setIsAIScanning(true);
    }
  }, [scanMode]);
  
  // Selected lot for triggering the sales dialog
  const [sellingAnimal, setSellingAnimal] = useState<Animal | null>(null);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);

  // States for Quick Lote and Pasture Transfer panel
  const [selectedTransferAnimalId, setSelectedTransferAnimalId] = useState<string>('');
  const [newTransferPastureId, setNewTransferPastureId] = useState<string>('');
  const [showQuickTransferPanel, setShowQuickTransferPanel] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<AnimalType | 'History'>(AnimalType.OWN);

  // Advanced sale form state
  const [saleFormData, setSaleFormData] = useState({
    saleDate: new Date().toISOString().split('T')[0],
    arrobaPrice: 0,
    averageWeight: 0,
    buyerName: '',
    shippingCost: 0,
    funruralCost: 0,
    taxesCost: 0,
    otherSaleCosts: 0,
    partnershipFarmShare: 50,
  });

  const [formData, setFormData] = useState<Partial<Animal>>({
    type: AnimalType.OWN,
    category: AnimalCategory.BULL,
    breed: '',
    quantity: 0,
    lotName: '',
    entryDate: new Date().toISOString().split('T')[0],
    currentPastryId: '',
    averageWeight: 0,
    purchasePrice: 0,
    costs: 0
  });

  // Filter out sold lots for standard cattle categories, and only display sold in 'History'
  const filteredAnimals = animals.filter(a => {
    const matchesSearch = a.lotName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (a.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'History') {
      return matchesSearch && a.isSold === true;
    } else {
      return matchesSearch && (a.isSold !== true) && a.type === activeTab;
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newPastureId = formData.currentPastureId || '';
    let updatedHistory = [...(editingAnimal?.pastureHistory || [])];

    if (!editingAnimal) {
       if (newPastureId) {
        updatedHistory = [{ pastureId: newPastureId, date: new Date().toISOString() }];
      }
    } else if (editingAnimal.currentPastureId !== newPastureId && newPastureId) {
      updatedHistory.push({ pastureId: newPastureId, date: new Date().toISOString() });
    }

    const newAnimal: Animal = {
      id: editingAnimal?.id || Date.now().toString(),
      type: formData.type || AnimalType.OWN,
      category: formData.category || AnimalCategory.BULL,
      breed: formData.breed || '',
      ownerName: formData.ownerName,
      quantity: formData.quantity || 0,
      lotName: formData.lotName || '',
      entryDate: formData.entryDate || new Date().toISOString().split('T')[0],
      currentPastureId: newPastureId,
      pastureHistory: updatedHistory,
      pastureForecast: formData.pastureForecast,
      averageWeight: formData.averageWeight || 0,
      aiTechnicalNote: formData.aiTechnicalNote,
      aiConfidence: formData.aiConfidence,
      purchasePrice: formData.purchasePrice || 0,
      costs: formData.costs || 0,
      rentValue: formData.rentValue,
      rentDueDay: formData.rentDueDay,
      partnershipFarmShare: formData.partnershipFarmShare,
      partnershipExitWeight: formData.partnershipExitWeight,
      formerOwnerName: formData.formerOwnerName,
      formerOwnerCity: formData.formerOwnerCity,
      formerOwnerPhone: formData.formerOwnerPhone,
      revenue: formData.rentValue && formData.quantity ? formData.rentValue * formData.quantity : 0,
      isSold: editingAnimal?.isSold || false,
      saleDetails: editingAnimal?.saleDetails || undefined,
    };

    await onAdd(newAnimal);
    setIsFormOpen(false);
    setEditingAnimal(null);
    setFormData({ 
      type: AnimalType.OWN, 
      category: AnimalCategory.BULL, 
      breed: '',
      quantity: 0, 
      lotName: '', 
      entryDate: new Date().toISOString().split('T')[0], 
      currentPastureId: '', 
      averageWeight: 0, 
      purchasePrice: 0,
      costs: 0,
      rentValue: 0,
      partnershipFarmShare: 50,
      partnershipExitWeight: 0
    });
  };

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellingAnimal) return;

    const quantity = sellingAnimal.quantity || 0;
    const avgWeight = saleFormData.averageWeight || sellingAnimal.averageWeight || 0;
    
    let totalSaleValue = 0;
    let purchaseCost = 0;
    let grossProfit = 0;

    if (sellingAnimal.type === AnimalType.PARTIAL) {
      // Meia - partnership weight gain calculation
      const weightGain = Math.max(0, avgWeight - (sellingAnimal.averageWeight || 0));
      const totalArrobasGain = (weightGain / 30) * quantity;
      const farmSharePercentage = saleFormData.partnershipFarmShare !== undefined && saleFormData.partnershipFarmShare !== 0 
        ? saleFormData.partnershipFarmShare 
        : (sellingAnimal.partnershipFarmShare || 50);
      totalSaleValue = totalArrobasGain * (saleFormData.arrobaPrice || 0) * (farmSharePercentage / 100);
      purchaseCost = 0;
      grossProfit = totalSaleValue;
    } else if (sellingAnimal.type === AnimalType.RENT) {
      // Aluguel - monthly rate duration calculation
      const rentValueRate = sellingAnimal.rentValue || 0;
      const durationDays = differenceInDays(new Date(saleFormData.saleDate), new Date(sellingAnimal.entryDate));
      const durationMonths = Math.max(0.1, durationDays / 30);
      totalSaleValue = rentValueRate * quantity * durationMonths;
      purchaseCost = 0;
      grossProfit = totalSaleValue;
    } else {
      // Próprio - standard purchases and sales of own cattle
      const totalArrobas = (avgWeight / 30) * quantity;
      totalSaleValue = totalArrobas * (saleFormData.arrobaPrice || 0);
      purchaseCost = (sellingAnimal.purchasePrice || 0) * quantity;
      grossProfit = totalSaleValue - purchaseCost;
    }

    const totalSaleCosts = (saleFormData.shippingCost || 0) + 
                           (saleFormData.funruralCost || 0) + 
                           (saleFormData.taxesCost || 0) + 
                           (saleFormData.otherSaleCosts || 0);

    const netProfit = grossProfit - totalSaleCosts;

    const updatedAnimal: Animal = {
      ...sellingAnimal,
      isSold: true,
      saleDetails: {
        saleDate: saleFormData.saleDate,
        arrobaPrice: saleFormData.arrobaPrice,
        averageWeight: avgWeight,
        buyerName: saleFormData.buyerName || undefined,
        shippingCost: saleFormData.shippingCost,
        funruralCost: saleFormData.funruralCost,
        taxesCost: saleFormData.taxesCost,
        otherSaleCosts: saleFormData.otherSaleCosts,
        totalSaleValue,
        grossProfit,
        netProfit,
        partnershipFarmShare: sellingAnimal.type === AnimalType.PARTIAL ? (saleFormData.partnershipFarmShare || sellingAnimal.partnershipFarmShare || 50) : undefined,
        partnershipExitWeight: sellingAnimal.type === AnimalType.PARTIAL ? avgWeight : undefined,
      }
    };

    // Save update in database
    await onAdd(updatedAnimal);

    // Also register a sales transaction log in our history
    await onAddTransaction({
      id: Date.now().toString(),
      animalId: sellingAnimal.id,
      date: saleFormData.saleDate,
      type: 'Sell',
      quantity,
      price: totalSaleValue
    });

    setIsSellModalOpen(false);
    setSellingAnimal(null);
    setSaleFormData({
      saleDate: new Date().toISOString().split('T')[0],
      arrobaPrice: 0,
      averageWeight: 0,
      buyerName: '',
      shippingCost: 0,
      funruralCost: 0,
      taxesCost: 0,
      otherSaleCosts: 0,
      partnershipFarmShare: 50,
    });
  };

  const handleEdit = (animal: Animal) => {
    setEditingAnimal(animal);
    setFormData(animal);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este lote?')) {
      await onDelete(id);
    }
  };

  const handleAIResult = (result: any) => {
    setFormData({
      ...formData,
      quantity: result.quantity,
      lotName: result.type,
      averageWeight: result.estimatedWeight,
      aiTechnicalNote: result.technicalDetails,
      aiConfidence: result.confidence
    });
    setIsFormOpen(true);
  };

  const calculateMonths = (start: string, end: string) => {
    const days = differenceInDays(new Date(end), new Date(start));
    return Math.max(1, Math.round(days / 30));
  };

  return (
    <div className="space-y-6 legacy-light">
      <AnimatePresence>
        {isAIScanning && (
          <AIAnalyzer 
            type="animals" 
            title="Contador de Gado IA" 
            onResult={handleAIResult}
            onClose={() => setIsAIScanning(false)}
          />
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide animate-fade-in">
        <div className="flex gap-2 bg-theme-card p-1 rounded-2xl border border-theme w-fit shadow-sm min-w-max text-theme-primary">
          {[AnimalType.OWN, AnimalType.RENT, AnimalType.PARTIAL, AnimalType.THIRD_PARTY, AnimalType.OTHER, 'History'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all whitespace-nowrap ${
                activeTab === tab ? 'btn-primary' : 'text-theme-secondary hover:bg-theme-card'
              }`}
            >
              {tab === 'History' ? '📁 Arquivo de Vendas (Histórico)' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Action area */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar por lote ou proprietário..." 
            className="w-full pl-10 pr-4 py-2 bg-theme-card border border-theme rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 font-medium text-sm text-theme-primary placeholder:text-theme-secondary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto flex-wrap sm:flex-nowrap">
          {activeTab !== 'History' && (
            <>
              {!scanMode && (
                <button 
                  onClick={() => {
                    setShowQuickTransferPanel(!showQuickTransferPanel);
                    if (!showQuickTransferPanel) {
                      setTimeout(() => {
                        const element = document.getElementById('quick-transfer-panel');
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth' });
                        }
                      }, 100);
                    }
                  }}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 border px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm text-xs uppercase tracking-wider cursor-pointer ${
                    showQuickTransferPanel 
                      ? 'btn-primary scale-[0.98]' 
                      : 'btn-outline'
                  }`}
                >
                  <ArrowRightLeft size={15} className={`${showQuickTransferPanel ? 'animate-spin' : ''}`} />
                  Trocar Pasto / Lote
                </button>
              )}
              <button 
                onClick={() => setIsAIScanning(true)}
                className="btn-outline flex-1 md:flex-none flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer group"
              >
                <Scan size={16} className="group-hover:scale-110 transition-transform" />
                Contagem IA
              </button>
              <button 
                onClick={() => { 
                  setFormData({
                    type: activeTab as AnimalType,
                    category: AnimalCategory.BULL,
                    breed: '',
                    quantity: 0,
                    lotName: '',
                    entryDate: new Date().toISOString().split('T')[0],
                    currentPastureId: '',
                    averageWeight: 0,
                    purchasePrice: 0,
                    costs: 0
                  }); 
                  setIsFormOpen(true); 
                }}
                className="btn-primary flex-1 md:flex-none flex items-center justify-center gap-2 text-sm"
              >
                <Plus size={18} />
                Adicionar Gado
              </button>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showQuickTransferPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-theme-card border-2 border-[var(--primary)]/20 rounded-3xl p-6 md:p-8 shadow-xl space-y-5 relative overflow-hidden" id="quick-transfer-panel">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[var(--primary)] via-[#4d6e56] to-[#d4a373]"></div>

              <div className="absolute top-5 right-5 z-10">
                <button onClick={() => setShowQuickTransferPanel(false)} className="p-2 hover:bg-theme-secondary rounded-xl transition-colors text-theme-secondary cursor-pointer border border-theme bg-theme-card shadow-sm flex items-center justify-center text-theme-primary">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2.5 text-theme-primary">
                  <div className="w-8 h-8 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
                    <ArrowRightLeft size={16} className="text-theme-primary animate-pulse" />
                  </div>
                  <h3 className="text-base font-black tracking-wider uppercase text-theme-primary font-sans">Manejo Rotativo • Transferência Rápida de Pasto</h3>
                </div>
                <p className="text-xs text-theme-secondary max-w-2xl leading-relaxed pl-10">
                  Selecione o lote desejado para analisar seu histórico técnico e movimentá-lo instantaneamente de pastagem. Essa transição recalculará automaticamente a taxa de lotação da fazenda em tempo real.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Lot selection */}
                <div className="space-y-4">
                  <div className="bg-theme-card p-4 rounded-2xl border border-theme shadow-sm text-theme-primary">
                    <label className="text-[10px] font-black uppercase text-theme-primary mb-2 block tracking-wider">1. Selecionar Lotes Ativos</label>
                    <select
                      className="w-full px-4 py-2.5 bg-theme-card border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none font-bold text-sm bg-theme-card text-theme-primary"
                      value={selectedTransferAnimalId}
                      onChange={(e) => {
                        setSelectedTransferAnimalId(e.target.value);
                        setNewTransferPastureId('');
                      }}
                    >
                      <option value="" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>-- Escolha um Lote de Gado --</option>
                      {animals.filter(a => !a.isSold).map(a => (
                        <option key={a.id} value={a.id} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                          {a.lotName} ({a.category} • {a.quantity} Cab.)
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedTransferAnimalId && (() => {
                    const selected = animals.find(a => a.id === selectedTransferAnimalId);
                    if (!selected) return null;
                    const curPasture = pastures.find(p => p.id === selected.currentPastureId);
                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-theme-card p-5 rounded-2xl border-l-4 border-l-[var(--primary)] border-y border-r border-theme space-y-3 text-xs shadow-inner text-theme-primary"
                      >
                        <div className="flex justify-between items-center pb-2 border-b border-theme mb-1 bg-theme-card text-theme-primary">
                          <span className="font-bold text-theme-secondary uppercase tracking-wider text-[10px]">Diagnóstico Clínico / Técnico</span>
                          <span className="px-2 py-0.5 bg-[var(--primary)]/10 text-theme-primary text-[9.5px] font-black rounded-md uppercase border border-[var(--primary)]/25">{selected.type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-theme-secondary">Categoria & Raça:</span>
                          <span className="font-bold text-theme-primary">{selected.category} {selected.breed && `• ${selected.breed}`}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-theme-secondary">Saldo Total do Lote:</span>
                          <span className="font-bold text-theme-primary text-sm">{selected.quantity} Cabeças</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-theme-secondary">Pastagem de Origem:</span>
                          <span className="font-bold text-theme-primary bg-[var(--primary)]/10 px-2.5 py-1 rounded-lg border border-[var(--primary)]/25/60">
                            {curPasture ? `${curPasture.name} (Pasto ${curPasture.number})` : 'Aguardando Alocação'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-theme-secondary">Pesagem Média (Arroba aprox.):</span>
                          <span className="font-bold text-theme-primary">{selected.averageWeight} kg (~{(selected.averageWeight / 30).toFixed(1)} @)</span>
                        </div>
                      </motion.div>
                    );
                  })()}
                </div>

                {/* Pasture transition selection */}
                <div className="space-y-4 flex flex-col justify-between">
                  {selectedTransferAnimalId ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4 animate-fade-in bg-theme-card p-4 rounded-2xl border border-theme shadow-sm flex-1 flex flex-col justify-between text-theme-primary"
                    >
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-theme-primary mb-2 block tracking-wider">2. Destinar ao Pasto de Destino</label>
                        <select
                          className="w-full px-4 py-2.5 bg-theme-card border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none font-bold text-sm bg-theme-card text-theme-primary"
                          value={newTransferPastureId}
                          onChange={(e) => setNewTransferPastureId(e.target.value)}
                        >
                          <option value="" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>-- Selecionar Pasto de Destino --</option>
                          {pastures
                            .filter(p => p.id !== animals.find(a => a.id === selectedTransferAnimalId)?.currentPastureId)
                            .map(p => (
                              <option key={p.id} value={p.id} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                {p.name} (Pasto {p.number})
                              </option>
                            ))
                          }
                        </select>
                        <p className="text-[10px] text-theme-secondary leading-relaxed italic">
                          * Nota de manejo: Ao confirmar, o gado será translocado de imediato e o espaço ocupado no pasto anterior será liberado para novos lotes.
                        </p>
                      </div>

                      <button
                        onClick={async () => {
                          if (!newTransferPastureId) {
                            alert('Por favor, selecione o novo pasto.');
                            return;
                          }
                          const lotToMove = animals.find(a => a.id === selectedTransferAnimalId);
                          if (!lotToMove) return;

                          const updatedHistory = [...(lotToMove.pastureHistory || [])];
                          updatedHistory.push({
                            pastureId: newTransferPastureId,
                            date: new Date().toISOString()
                          });

                          const updatedLot = {
                            ...lotToMove,
                            currentPastureId: newTransferPastureId,
                            pastureHistory: updatedHistory
                          };

                          await onAdd(updatedLot);
                          
                          setNewTransferPastureId('');
                          alert(`Sucesso! Lote "${lotToMove.lotName}" transferido com sucesso para o novo pasto.`);
                        }}
                        disabled={!newTransferPastureId}
                        className="w-full flex items-center justify-center gap-2 btn-primary disabled:opacity-40 text-xs uppercase tracking-wider"
                      >
                        <ArrowRightLeft size={14} /> Registrar Movimentação Pasto / Manejo
                      </button>
                    </motion.div>
                  ) : (
                    <div className="h-full min-h-[160px] flex flex-col items-center justify-center border border-dashed border-theme rounded-2xl bg-theme-card p-8 text-center text-theme-secondary text-xs text-theme-primary">
                      <div className="w-12 h-12 rounded-full bg-theme-card border border-theme flex items-center justify-center mb-3 text-theme-primary">
                        <Beef size={20} className="text-theme-primary" />
                      </div>
                      <p className="font-bold text-theme-secondary mb-1">Painel Aguardando Seleção</p>
                      <p className="max-w-[280px] leading-relaxed text-theme-secondary">Escolha ao lado um lote de gado para carregar sua ficha zootécnica e liberar os comandos de transferência rápida.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
        <AnimatePresence>
          {filteredAnimals.map((animal) => (
            <motion.div 
              key={animal.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-theme-card p-6 rounded-3xl border border-theme shadow-sm hover:border-[var(--primary)]/30 hover:shadow-md transition-all relative overflow-hidden text-theme-primary"
            >
              <div className="absolute top-0 right-0 p-4">
                {animal.isSold ? (
                  <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[10px] font-black rounded-full uppercase border border-red-200 dark:border-red-800">Lote Vendido</span>
                ) : (
                  <span className="px-3 py-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 text-[10px] font-black rounded-full uppercase border border-green-200 dark:border-green-800">{animal.type}</span>
                )}
              </div>

              <div className="flex items-center gap-4 mb-5">
                <div className="p-3.5 bg-theme-card rounded-full text-theme-primary">
                  <Beef size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-theme-primary leading-tight">{animal.lotName}</h3>
                  <div className="text-xs text-theme-secondary font-bold uppercase mt-0.5">
                    {animal.category} {animal.breed && `• ${animal.breed}`} • {animal.quantity} Cab.
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 mb-5 text-sm font-medium text-theme-secondary border-t border-theme pt-3.5 bg-theme-card text-theme-primary">
                {animal.ownerName && (
                  <div className="flex justify-between">
                    <span className="text-theme-secondary">Proprietário</span>
                    <span className="font-bold text-theme-primary">{animal.ownerName}</span>
                  </div>
                )}
                {!animal.isSold && (
                  <div className="flex justify-between">
                    <span className="text-theme-secondary">Pasto Atual</span>
                    <span className="font-bold text-theme-primary">{pastures.find(p => p.id === animal.currentPastureId)?.name || 'Nenhum'}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-theme-secondary">{animal.isSold ? 'Peso de Saída' : 'Peso Médio'}</span>
                  <span className="font-bold text-theme-primary">{animal.isSold ? animal.saleDetails?.averageWeight : animal.averageWeight} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-theme-secondary">Data Entrada</span>
                  <span className="font-bold text-theme-primary">{format(new Date(animal.entryDate), 'dd/MM/yyyy')}</span>
                </div>

                {/* Sell metrics info block if Sold! */}
                {animal.isSold && animal.saleDetails && (
                  <div className="bg-red-50 dark:bg-red-950/30/50 dark:bg-red-950/30 p-4 rounded-2xl border border-red-100 dark:border-red-800 space-y-2.5 text-xs text-red-950 font-medium">
                    <div className="flex justify-between border-b pb-1.5 border-red-100 dark:border-red-800">
                      <span>Comprador:</span>
                      <span className="font-bold">{animal.saleDetails.buyerName || 'Não Informado'}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5 border-red-100 dark:border-red-800">
                      <span>Preço Arroba (@):</span>
                      <span className="font-bold">R$ {animal.saleDetails.arrobaPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5 border-red-100 dark:border-red-800">
                      <span>Faturamento Total Bruto:</span>
                      <span className="font-extrabold text-theme-primary">R$ {animal.saleDetails.totalSaleValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5 border-red-100 dark:border-red-800 font-bold text-red-900 dark:text-red-200">
                      <span>Custos Comercialização:</span>
                      <span>R$ {((animal.saleDetails.shippingCost || 0) + (animal.saleDetails.funruralCost || 0) + (animal.saleDetails.taxesCost || 0) + (animal.saleDetails.otherSaleCosts || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="p-2.5 bg-theme-card border border-red-200 dark:border-red-800 rounded-xl space-y-1 mt-1 text-[11px]">
                      <div className="flex justify-between text-theme-primary font-bold">
                        <span>Lucro Bruto Ciclo:</span>
                        <span className="text-theme-primary">R$ {animal.saleDetails.grossProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-theme-primary font-bold">
                        <span>Lucro Líquido Ciclo:</span>
                        <span className="text-theme-primary">R$ {animal.saleDetails.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between border-t border-dashed border-neutral-200 pt-1 text-[10px] text-theme-secondary font-bold uppercase mt-1">
                        <span>Líq. p/ Mês ({calculateMonths(animal.entryDate, animal.saleDetails.saleDate)}m):</span>
                        <span className="text-theme-primary">R$ {(animal.saleDetails.netProfit / calculateMonths(animal.entryDate, animal.saleDetails.saleDate)).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} / mês</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Purchase stats if not sold */}
                {!animal.isSold && animal.type === AnimalType.OWN && (
                  <div className="pt-2 border-t border-theme bg-theme-card text-theme-primary">
                    <div className="flex justify-between">
                      <span className="text-theme-secondary">Preço Proposto Compra:</span>
                      <span className="font-bold text-theme-primary">R$ {(animal.purchasePrice || 0).toLocaleString()} / cab.</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-theme-secondary">Custo de Aquisição:</span>
                      <span className="font-bold text-red-600 dark:text-red-400">R$ {((animal.purchasePrice || 0) * animal.quantity).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                {!animal.isSold ? (
                  <>
                    <button 
                      onClick={() => {
                        setSellingAnimal(animal);
                        setSaleFormData({
                          saleDate: new Date().toISOString().split('T')[0],
                          arrobaPrice: 320,
                          averageWeight: animal.averageWeight || 450,
                          buyerName: '',
                          shippingCost: 200,
                          funruralCost: 0,
                          taxesCost: 0,
                          otherSaleCosts: 0,
                          partnershipFarmShare: animal.partnershipFarmShare || 50,
                        });
                        setIsSellModalOpen(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 btn-outline py-2 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      <ShoppingCart size={13} /> Comercializar
                    </button>
                    {!scanMode && (
                      <button 
                        onClick={() => {
                          setSelectedTransferAnimalId(animal.id);
                          setNewTransferPastureId('');
                          setShowQuickTransferPanel(true);
                          setTimeout(() => {
                            const element = document.getElementById('quick-transfer-panel');
                            if (element) {
                              element.scrollIntoView({ behavior: 'smooth' });
                            }
                          }, 100);
                        }}
                        className="flex-1 flex items-center justify-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 hover:bg-blue-600 hover:text-white py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
                      >
                        <ArrowRightLeft size={13} /> Mudar Pasto
                      </button>
                    )}
                    <button onClick={() => handleEdit(animal)} className="p-2 hover:bg-theme-secondary border border-theme rounded-xl text-xs font-bold text-theme-secondary cursor-pointer text-theme-primary" title="Editar Lote">
                      <Edit3 size={15} />
                    </button>
                    <button 
                      onClick={() => setExpandedWeightLotId(expandedWeightLotId === animal.id ? null : animal.id)} 
                      className={`p-2 border rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                        expandedWeightLotId === animal.id
                          ? 'btn-primary' 
                          : 'btn-outline'
                      }`}
                      title="Evolução de Peso (Gráfico Line)"
                    >
                      <TrendingUp size={15} />
                    </button>
                  </>
                ) : null}
                <button onClick={() => handleDelete(animal.id)} className="px-3 py-2 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 rounded-xl transition-colors cursor-pointer" title="Excluir Lote">
                  <Trash2 size={15} />
                </button>
              </div>

              {expandedWeightLotId === animal.id && (
                <WeightHistoryPanel 
                  animal={animal} 
                  onUpdateAnimal={onAdd} 
                />
              )}
            </motion.div>
          ))}
          {filteredAnimals.length === 0 && (
            <div className="col-span-full py-20 text-center text-theme-secondary italic bg-theme-card rounded-3xl border border-theme text-theme-primary">
              Nenhum lote de gado para este filtro.
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* --- FORMS AND DIALOGS --- */}

      {/* 1. Transaction Sale Modal */}
      {isSellModalOpen && sellingAnimal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-theme-card w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-theme flex items-center justify-between bg-theme-card text-theme-primary">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsSellModalOpen(false)}
                  className="p-2 -ml-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary rounded-full transition-colors"
                  title="Voltar"
                >
                  <ArrowLeft size={20} />
                </button>
                <h3 className="text-base font-black flex items-center gap-2 text-theme-primary">
                  <ShoppingCart size={18} />
                  Fechar Venda do Lote: {sellingAnimal.lotName} ({sellingAnimal.quantity} cab.)
                </h3>
              </div>
              <button 
                onClick={() => setIsSellModalOpen(false)}
                className="p-1.5 hover:bg-theme-secondary rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
              <div className="p-4 bg-theme-card border border-theme rounded-2xl flex items-center justify-between text-theme-primary">
                <div>
                  <span className="text-[10px] text-theme-secondary uppercase font-bold block">Adquirido por:</span>
                  <span className="font-extrabold text-theme-primary">R$ {((sellingAnimal.purchasePrice || 0) * sellingAnimal.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-theme-secondary uppercase font-bold block">Entrada na Fazenda:</span>
                  <span className="font-bold text-theme-primary">{format(new Date(sellingAnimal.entryDate), 'dd/MM/yyyy')}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-theme-secondary mb-1.5 block">Nome do Comprador / Frigorífico</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" size={16} />
                    <input 
                      required
                      type="text" 
                      className="w-full pl-10 pr-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none text-sm font-semibold bg-theme-card text-theme-primary placeholder:text-theme-secondary"
                      placeholder="Ex: JBS S/A, Sr. Antunes..."
                      value={saleFormData.buyerName}
                      onChange={(e) => setSaleFormData({...saleFormData, buyerName: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-theme-secondary mb-1.5 block">Data da Saída (Venda)</label>
                  <input 
                    required
                    type="date" 
                    className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none text-sm font-semibold bg-theme-card text-theme-primary"
                    value={saleFormData.saleDate}
                    onChange={(e) => setSaleFormData({...saleFormData, saleDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-theme-secondary mb-1.5 block flex items-center gap-1">
                    {sellingAnimal.type === AnimalType.PARTIAL ? 'Regime de Meia - Peso de Saída (Kg)' : 'Peso Médio Saída (Kg/cab)'}
                    <span className="text-[9px] bg-[var(--primary)]/10 text-theme-primary px-1 py-0.2 rounded">Estimado</span>
                  </label>
                  <input 
                    required={sellingAnimal.type !== AnimalType.RENT}
                    type="number" 
                    step="0.1"
                    className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none text-sm font-black text-theme-primary bg-theme-card"
                    value={saleFormData.averageWeight || ''}
                    disabled={sellingAnimal.type === AnimalType.RENT}
                    onChange={(e) => setSaleFormData({...saleFormData, averageWeight: Number(e.target.value)})}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-theme-secondary mb-1.5 block">Valor Líquido da Arroba (R$ / @)</label>
                  <input 
                    required={sellingAnimal.type !== AnimalType.RENT}
                    type="number" 
                    step="0.01"
                    className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none text-sm font-black text-theme-primary bg-theme-card placeholder:text-theme-secondary"
                    placeholder="Ex: 320"
                    disabled={sellingAnimal.type === AnimalType.RENT}
                    value={saleFormData.arrobaPrice || ''}
                    onChange={(e) => setSaleFormData({...saleFormData, arrobaPrice: Number(e.target.value)})}
                  />
                </div>
              </div>

              {sellingAnimal.type === AnimalType.PARTIAL && (
                <div className="p-4 bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-2xl space-y-2">
                  <span className="text-[10px] font-black uppercase text-theme-primary block">Dados da Parceria (Meia-A-Meia)</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-semibold text-theme-secondary block">Peso de Entrada Declarado:</span>
                      <span className="text-sm font-black text-theme-primary">{sellingAnimal.averageWeight} kg / cabeça</span>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-theme-primary mb-1 block">Porcentagem que Fica p/ Fazenda (%)</label>
                      <input 
                        required
                        type="number" 
                        className="w-full px-3 py-1.5 border border-theme rounded-xl focus:outline-none text-xs font-extrabold text-theme-primary bg-theme-card"
                        value={saleFormData.partnershipFarmShare}
                        onChange={(e) => setSaleFormData({...saleFormData, partnershipFarmShare: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>
              )}

              {sellingAnimal.type === AnimalType.RENT && (
                <div className="p-4 bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-2xl space-y-2">
                  <span className="text-[10px] font-black uppercase text-theme-primary block">Cálculo de Estadia do Aluguel de Pasto</span>
                  <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                    <div>
                      <span className="text-theme-secondary block">Dias de Estadia Decorridos:</span>
                      <span className="font-extrabold text-theme-primary">
                        {differenceInDays(new Date(saleFormData.saleDate), new Date(sellingAnimal.entryDate))} dias 
                        <span className="text-theme-secondary font-normal"> (~ {(differenceInDays(new Date(saleFormData.saleDate), new Date(sellingAnimal.entryDate)) / 30).toFixed(1)} meses)</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-theme-secondary block">Taxa Mensal p/ Cabeça Acertada:</span>
                      <span className="font-extrabold text-theme-primary">
                        R$ {(sellingAnimal.rentValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / mês
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* sales cost list */}
              <div className="p-4 bg-orange-50 dark:bg-orange-950/30/40 border border-orange-100 dark:border-orange-800 rounded-2xl space-y-3">
                <h4 className="text-xs font-black text-orange-700 dark:text-orange-300 uppercase block">Custos e Deduções do Lote na Comercialização</h4>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-orange-800 dark:text-orange-300 mb-1 block">Frete (Contratado)</label>
                    <input 
                      type="number"
                      className="w-full px-3 py-1.5 border border-orange-200 dark:border-orange-800 rounded-lg bg-theme-card text-xs font-bold"
                      value={saleFormData.shippingCost || ''}
                      onChange={(e) => setSaleFormData({...saleFormData, shippingCost: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-orange-800 dark:text-orange-300 mb-1 block">Funrural (%)</label>
                    <input 
                      type="number"
                      step="0.01"
                      className="w-full px-3 py-1.5 border border-orange-200 dark:border-orange-800 rounded-lg bg-theme-card text-xs font-bold"
                      value={saleFormData.funruralCost || ''}
                      onChange={(e) => setSaleFormData({...saleFormData, funruralCost: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-orange-800 dark:text-orange-300 mb-1 block">Encargos/Tributos</label>
                    <input 
                      type="number"
                      className="w-full px-3 py-1.5 border border-orange-200 dark:border-orange-800 rounded-lg bg-theme-card text-xs font-bold"
                      value={saleFormData.taxesCost || ''}
                      onChange={(e) => setSaleFormData({...saleFormData, taxesCost: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-orange-800 dark:text-orange-300 mb-1 block">Outras Despesas</label>
                    <input 
                      type="number"
                      className="w-full px-3 py-1.5 border border-orange-200 dark:border-orange-800 rounded-lg bg-theme-card text-xs font-bold"
                      value={saleFormData.otherSaleCosts || ''}
                      onChange={(e) => setSaleFormData({...saleFormData, otherSaleCosts: Number(e.target.value)})}
                    />
                  </div>
                </div>
              </div>

              {/* Live mathematical ledger feedback */}
              {((saleFormData.arrobaPrice > 0 && saleFormData.averageWeight > 0) || sellingAnimal.type === AnimalType.RENT) && (
                <div className="bg-[var(--primary)] text-white p-5 rounded-2xl space-y-3 shadow-md">
                  {sellingAnimal.type === AnimalType.PARTIAL ? (
                    <>
                      <div className="flex justify-between items-baseline border-b border-white/10 pb-2">
                        <span className="text-xs uppercase font-medium text-white/80">Ganho de Peso Total:</span>
                        <span className="font-bold text-sm">
                          {Math.max(0, saleFormData.averageWeight - (sellingAnimal.averageWeight || 0))} Kg / cab.
                          <span className="text-[10px] text-theme-secondary font-normal ml-2">
                            ({sellingAnimal.averageWeight} kg entrada ➔ {saleFormData.averageWeight} kg saída)
                          </span>
                        </span>
                      </div>

                      <div className="flex justify-between items-baseline border-b border-white/10 pb-2">
                        <span className="text-xs uppercase font-medium text-white/80">Rendimento de Carcaça Ganha:</span>
                        <span className="font-bold text-sm">
                          {((Math.max(0, saleFormData.averageWeight - (sellingAnimal.averageWeight || 0)) / 30) * sellingAnimal.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })} @ Totais
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs font-semibold pt-1">
                        <div>
                          <span className="text-white/80 uppercase text-[9px] block">Receita Bruto Meia ({saleFormData.partnershipFarmShare !== undefined ? saleFormData.partnershipFarmShare : 50}% Fazenda):</span>
                          <span className="text-base font-black">
                            R$ {(((Math.max(0, saleFormData.averageWeight - (sellingAnimal.averageWeight || 0)) / 30) * sellingAnimal.quantity * (saleFormData.arrobaPrice || 0)) * ((saleFormData.partnershipFarmShare !== undefined ? saleFormData.partnershipFarmShare : 50) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/80 uppercase text-[9px] block">Deduções Venda (Frete, etc):</span>
                          <span className="text-base font-black text-orange-200">
                            R$ {((saleFormData.shippingCost || 0) + (saleFormData.funruralCost || 0) + (saleFormData.taxesCost || 0) + (saleFormData.otherSaleCosts || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-3">
                        <div>
                          <span className="text-white/80 uppercase text-[9px] font-bold block">Faturamento Parceiro Meia:</span>
                          <span className="text-sm font-bold text-theme-secondary">
                            R$ {(((Math.max(0, saleFormData.averageWeight - (sellingAnimal.averageWeight || 0)) / 30) * sellingAnimal.quantity * (saleFormData.arrobaPrice || 0)) * (1 - ((saleFormData.partnershipFarmShare !== undefined ? saleFormData.partnershipFarmShare : 50) / 100))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/80 uppercase text-[9px] font-bold block">Lucro Líquido Ciclo Fazenda:</span>
                          <span className="text-base font-black text-theme-secondary">
                            R$ {((((Math.max(0, saleFormData.averageWeight - (sellingAnimal.averageWeight || 0)) / 30) * sellingAnimal.quantity * (saleFormData.arrobaPrice || 0)) * ((saleFormData.partnershipFarmShare !== undefined ? saleFormData.partnershipFarmShare : 50) / 100)) - ((saleFormData.shippingCost || 0) + (saleFormData.funruralCost || 0) + (saleFormData.taxesCost || 0) + (saleFormData.otherSaleCosts || 0))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : sellingAnimal.type === AnimalType.RENT ? (
                    <>
                      <div className="flex justify-between items-baseline border-b border-white/10 pb-2">
                        <span className="text-xs uppercase font-medium text-white/80">Tempo Sob Gestão:</span>
                        <span className="font-bold text-sm">
                          {Math.max(1, differenceInDays(new Date(saleFormData.saleDate), new Date(sellingAnimal.entryDate)))} dias
                          <span className="text-[10px] text-theme-secondary font-normal ml-2">
                            (~ {(differenceInDays(new Date(saleFormData.saleDate), new Date(sellingAnimal.entryDate)) / 30).toFixed(1)} meses)
                          </span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs font-semibold pt-1">
                        <div>
                          <span className="text-white/80 uppercase text-[9px] block">Faturamento Aluguel Acumulado:</span>
                          <span className="text-base font-black">
                            R$ {((sellingAnimal.rentValue || 0) * sellingAnimal.quantity * Math.max(0.1, differenceInDays(new Date(saleFormData.saleDate), new Date(sellingAnimal.entryDate)) / 30)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/80 uppercase text-[9px] block">Deduções Despesas Aluguel:</span>
                          <span className="text-base font-black text-orange-200">
                            R$ {((saleFormData.shippingCost || 0) + (saleFormData.funruralCost || 0) + (saleFormData.taxesCost || 0) + (saleFormData.otherSaleCosts || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-3 flex justify-between items-center">
                        <div>
                          <span className="text-white/80 uppercase text-[9px] font-bold block">Taxa Diária Faturada:</span>
                          <span className="text-xs">
                            R$ {(((sellingAnimal.rentValue || 0) * sellingAnimal.quantity) / 30).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} / dia total Lote
                          </span>
                        </div>
                        <div>
                          <span className="text-white/80 uppercase text-[9px] font-bold block">Lucro Líquido Ciclo Fazenda:</span>
                          <span className="text-base font-black text-theme-secondary">
                            R$ {(((sellingAnimal.rentValue || 0) * sellingAnimal.quantity * Math.max(0.1, differenceInDays(new Date(saleFormData.saleDate), new Date(sellingAnimal.entryDate)) / 30)) - ((saleFormData.shippingCost || 0) + (saleFormData.funruralCost || 0) + (saleFormData.taxesCost || 0) + (saleFormData.otherSaleCosts || 0))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-baseline border-b border-white/10 pb-2">
                        <span className="text-xs uppercase font-medium text-white/80">Representação em @:</span>
                        <span className="font-bold text-sm">
                          {(((saleFormData.averageWeight || 0) / 30) * sellingAnimal.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })} @ Totais
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs font-semibold pt-1">
                        <div>
                          <span className="text-white/80 uppercase text-[9px] block">Receita Bruta Venda:</span>
                          <span className="text-base font-black">R$ {((((saleFormData.averageWeight || 0) / 30) * sellingAnimal.quantity) * (saleFormData.arrobaPrice || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="text-white/80 uppercase text-[9px] block">Deduções Totais Venda:</span>
                          <span className="text-base font-black text-orange-200">R$ {((saleFormData.shippingCost || 0) + (saleFormData.funruralCost || 0) + (saleFormData.taxesCost || 0) + (saleFormData.otherSaleCosts || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-3">
                        <div>
                          <span className="text-white/80 uppercase text-[9px] font-bold block">Lucro Bruto do Lote:</span>
                          <span className="text-base font-black text-theme-secondary">
                            R$ {((((((saleFormData.averageWeight || 0) / 30) * sellingAnimal.quantity) * (saleFormData.arrobaPrice || 0))) - ((sellingAnimal.purchasePrice || 0) * sellingAnimal.quantity)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/80 uppercase text-[9px] font-bold block">Lucro Líquido Ciclo:</span>
                          <span className="text-base font-black text-theme-secondary">
                            R$ {((((((saleFormData.averageWeight || 0) / 30) * sellingAnimal.quantity) * (saleFormData.arrobaPrice || 0))) - ((sellingAnimal.purchasePrice || 0) * sellingAnimal.quantity) - ((saleFormData.shippingCost || 0) + (saleFormData.funruralCost || 0) + (saleFormData.taxesCost || 0) + (saleFormData.otherSaleCosts || 0))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsSellModalOpen(false)}
                  className="btn-outline flex-1"
                >
                  Regressar
                </button>
                <button 
                  type="submit"
                  className="btn-primary flex-1"
                >
                  Concluir Venda
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 2. New Animal Setup Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-theme-card w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-theme flex items-center justify-between bg-theme-card text-theme-primary">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { setIsFormOpen(false); setEditingAnimal(null); }}
                  className="p-2 -ml-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary rounded-full transition-colors"
                  title="Voltar"
                >
                  <ArrowLeft size={20} />
                </button>
                <h3 className="text-base font-black flex items-center gap-2">
                  <Beef size={18} className="text-theme-primary" />
                  {editingAnimal ? 'Editar Lote de Animais' : 'Novo Lajeado / Entrada de Gado'}
                </h3>
              </div>
              <button 
                onClick={() => { setIsFormOpen(false); setEditingAnimal(null); }}
                className="p-1.5 hover:bg-theme-secondary rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[80vh] space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-theme-secondary mb-1 block">Espécie / Categoria</label>
                  <select 
                    className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none bg-theme-card font-bold text-sm text-theme-primary"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value as AnimalCategory})}
                  >
                    {ANIMAL_CATEGORIES.map(cat => <option key={cat} value={cat} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>{cat}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-theme-secondary mb-1 block">Raça</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none font-medium bg-theme-card text-theme-primary placeholder:text-theme-secondary"
                    value={formData.breed || ''}
                    onChange={(e) => setFormData({...formData, breed: e.target.value})}
                    placeholder="Ex: Nelore, Caracu, Angus, Tabapuã..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-theme-secondary mb-1 block">Regime de Posse (Tipo)</label>
                  <select 
                    className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none bg-theme-card font-medium text-theme-primary"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as AnimalType})}
                  >
                    {Object.values(AnimalType).map(type => <option key={type} value={type} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>{type}</option>)}
                  </select>
                </div>

                {formData.type !== AnimalType.OWN && (
                  <div>
                    <label className="text-xs font-bold uppercase text-theme-secondary mb-1 block">Proprietário / Parceiro</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none font-medium text-sm bg-theme-card text-theme-primary placeholder:text-theme-secondary"
                      value={formData.ownerName || ''}
                      onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
                      placeholder="Nome do dono"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold uppercase text-theme-secondary mb-1 block">Rastreamento do Lote (Nome/Número)</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none font-extrabold text-sm text-theme-primary bg-theme-card placeholder:text-theme-secondary"
                    value={formData.lotName || ''}
                    onChange={(e) => setFormData({...formData, lotName: e.target.value})}
                    placeholder="Ex: Lote Nelore 2026, S03..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-theme-secondary mb-1 block">Quantidade Inteira (Cabeças)</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none font-black bg-theme-card text-theme-primary"
                    value={formData.quantity || ''}
                    onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-theme-secondary mb-1 block">Data de Entrada</label>
                  <input 
                    required
                    type="date" 
                    className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none bg-theme-card text-theme-primary"
                    value={formData.entryDate}
                    onChange={(e) => setFormData({...formData, entryDate: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-theme-secondary mb-1 block">Alocação de Pasto</label>
                  <select 
                    required
                    className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none bg-theme-card font-medium text-sm text-theme-primary"
                    value={formData.currentPastureId}
                    onChange={(e) => setFormData({...formData, currentPastureId: e.target.value})}
                  >
                    <option value="" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>-- Selecione o Pasto --</option>
                    {pastures.map(p => <option key={p.id} value={p.id} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>{p.name} (Pasto {p.number})</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-theme-secondary mb-1 block">Peso Médio de Entrada (Kg)</label>
                  <input 
                    type="number" step="0.1"
                    className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none font-bold bg-theme-card text-theme-primary"
                    value={formData.averageWeight || ''}
                    onChange={(e) => setFormData({...formData, averageWeight: Number(e.target.value)})}
                  />
                </div>

                {formData.type === AnimalType.OWN && (
                  <>
                    <div>
                      <label className="text-xs font-bold uppercase text-theme-primary mb-1 block">Preço de Compra p/ Cabeça (R$)</label>
                      <input 
                        type="number" step="0.01"
                        className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none font-bold text-theme-primary bg-theme-card"
                        value={formData.purchasePrice || ''}
                        onChange={(e) => setFormData({...formData, purchasePrice: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-theme-primary mb-1 block">Custo de Aquisição Total</label>
                      <div className="w-full px-4 py-2.5 bg-theme-card border border-theme rounded-xl font-black text-theme-primary text-sm">
                        R$ {((formData.purchasePrice || 0) * (formData.quantity || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </>
                )}

                {formData.type === AnimalType.RENT && (
                  <div className="col-span-2 space-y-3">
                    <div>
                      <label className="text-xs font-bold uppercase text-theme-primary mb-1 block">Valor do Aluguel (R$/mês por Cabeça)</label>
                      <input 
                        type="number" step="0.01"
                        className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none font-bold bg-theme-card text-theme-primary placeholder:text-theme-secondary"
                        value={formData.rentValue || ''}
                        onChange={(e) => setFormData({...formData, rentValue: Number(e.target.value)})}
                        placeholder="Ex: 65"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-theme-primary mb-1 block">Dia de Vencimento do Aluguel (todo mês)</label>
                      <input 
                        type="number" min="1" max="31"
                        className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none font-bold bg-theme-card text-theme-primary placeholder:text-theme-secondary"
                        value={formData.rentDueDay || ''}
                        onChange={(e) => setFormData({...formData, rentDueDay: e.target.value ? Math.min(31, Math.max(1, Number(e.target.value))) : undefined})}
                        placeholder="Ex: 10"
                      />
                      <p className="text-[10px] text-theme-secondary mt-1">
                        Você será avisado na Central de Obrigações 2 dias antes, no dia (a partir das 8h), e com destaque vermelho se passar do vencimento sem marcar como pago.
                      </p>
                    </div>
                  </div>
                )}

                {formData.type === AnimalType.PARTIAL && (
                  <>
                    <div>
                      <label className="text-xs font-bold uppercase text-theme-primary mb-1 block">Proporção Fazenda (%)</label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" size={16} />
                        <input 
                          type="number" 
                          className="w-full pl-10 pr-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none font-bold bg-theme-card text-theme-primary placeholder:text-theme-secondary"
                          placeholder="Ex: 50"
                          value={formData.partnershipFarmShare || ''}
                          onChange={(e) => setFormData({...formData, partnershipFarmShare: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-theme-primary mb-1 block">Peso Final de Saída (kg)</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-2 border border-theme rounded-xl focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none font-bold bg-theme-card text-theme-primary"
                        value={formData.partnershipExitWeight || ''}
                        onChange={(e) => setFormData({...formData, partnershipExitWeight: Number(e.target.value)})}
                      />
                    </div>
                  </>
                )}
              </div>

              {formData.type !== AnimalType.OWN && (
                <div className="p-4 bg-[var(--primary)]/5 rounded-2xl border border-[var(--primary)]/10">
                  <p className="text-[10px] font-bold text-theme-primary uppercase tracking-wide flex items-center gap-1 mb-2">
                    <HelpCircle size={12} /> Nota sobre Automação de Receita
                  </p>
                  <p className="text-[10px] text-theme-secondary leading-relaxed">
                    O sistema calculará automaticamente a <strong>Receita Prevista</strong> baseada no valor do contrato quando registrada a venda deste lote.
                  </p>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsFormOpen(false)}
                  className="btn-outline flex-1"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="btn-primary flex-1"
                >
                  {editingAnimal ? 'Atualizar Lote' : 'Cadastrar Entrada'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}