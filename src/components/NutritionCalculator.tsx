/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Animal, InventoryItem, AnimalCategory } from '../types';
import { 
  Leaf, Info, Scale, PieChart, HelpingHand, ListOrdered, 
  Warehouse, Calendar, ShoppingBag, ArrowRight, Table, HelpCircle, Dumbbell
} from 'lucide-react';

interface Props {
  animals: Animal[];
  inventory: InventoryItem[];
}

type Seasons = 'dry' | 'rainy';

export default function NutritionCalculator({ animals, inventory }: Props) {
  // Selector modes
  const [usePresetLot, setUsePresetLot] = useState<boolean>(true);
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  
  // Manual overrides or entry fields
  const [manualWeight, setManualWeight] = useState<number>(380);
  const [manualCategory, setManualCategory] = useState<AnimalCategory>(AnimalCategory.BULL);
  const [manualQuantity, setManualQuantity] = useState<number>(40);
  const [season, setSeason] = useState<Seasons>('dry');

  // Load selected lot parameters
  const activeLot = useMemo(() => {
    if (!usePresetLot || !selectedLotId) return null;
    return animals.find(a => a.id === selectedLotId) || null;
  }, [selectedLotId, usePresetLot, animals]);

  // Set default lot on mount or update
  React.useEffect(() => {
    const activeLots = animals.filter(a => !a.isSold);
    if (activeLots.length > 0 && !selectedLotId) {
      setSelectedLotId(activeLots[0].id);
    }
  }, [animals, selectedLotId]);

  // Derived calculations parameters
  const currentWeight = useMemo(() => {
    if (usePresetLot && activeLot) {
      return activeLot.averageWeight;
    }
    return manualWeight;
  }, [usePresetLot, activeLot, manualWeight]);

  const currentCategory = useMemo(() => {
    if (usePresetLot && activeLot) {
      return activeLot.category;
    }
    return manualCategory;
  }, [usePresetLot, activeLot, manualCategory]);

  const currentQuantity = useMemo(() => {
    if (usePresetLot && activeLot) {
      return activeLot.quantity;
    }
    return manualQuantity;
  }, [usePresetLot, activeLot, manualQuantity]);

  // Zootecnic coefficients based on Category and Season
  const nutritionParameters = useMemo(() => {
    let mineralRate = 0.0002;
    let proteinRate = 0.001;

    switch (currentCategory) {
      case AnimalCategory.COW:
        mineralRate = 0.00022;
        proteinRate = season === 'dry' ? 0.0015 : 0.0008;
        break;
      case AnimalCategory.BULL:
        mineralRate = 0.00025;
        proteinRate = season === 'dry' ? 0.0025 : 0.0012;
        break;
      case AnimalCategory.CALF:
        mineralRate = 0.00015;
        proteinRate = season === 'dry' ? 0.0012 : 0.0006;
        break;
      case AnimalCategory.HEIFER:
        mineralRate = 0.0002;
        proteinRate = season === 'dry' ? 0.0018 : 0.0008;
        break;
      default:
        mineralRate = 0.0002;
        proteinRate = season === 'dry' ? 0.0015 : 0.001;
        break;
    }

    const rawMineralGrams = Math.round(currentWeight * mineralRate * 1000);
    const rawProteinGrams = Math.round(currentWeight * proteinRate * 1000);
    const finalMineralGrams = Math.max(30, Math.min(200, rawMineralGrams));
    const finalProteinGrams = Math.max(50, Math.min(1500, rawProteinGrams));
    const dailyMineralLotKg = (finalMineralGrams * currentQuantity) / 1000;
    const dailyProteinLotKg = (finalProteinGrams * currentQuantity) / 1000;
    const sacksPerMonthMineral = Math.ceil((dailyMineralLotKg * 30.5) / 30);
    const sacksPerMonthProtein = Math.ceil((dailyProteinLotKg * 30.5) / 30);

    let recommendationGuide = '';
    if (season === 'dry') {
      recommendationGuide = 'Período de SECA: Pastagem de fibra grossa e baixo teor proteico. Suplementação proteica é CRÍTICA para alimentar a flora ruminal e manter o ganho de peso diário.';
    } else {
      recommendationGuide = 'Período de ÁGUAS: Pasto verde e farto, porém faltoso em nitrogênio e minerais essenciais. Suplementação mineral ou mineral aditivada é o foco para otimizar ganho de peso.';
    }

    return {
      mineralPerDayHeadG: finalMineralGrams,
      proteinPerDayHeadG: finalProteinGrams,
      dailyMineralLotKg,
      dailyProteinLotKg,
      sacksPerMonthMineral,
      sacksPerMonthProtein,
      recommendationGuide,
      estimatedGmdGrams: season === 'dry' ? '150 - 300g/dia' : '500 - 800g/dia'
    };
  }, [currentWeight, currentCategory, currentQuantity, season]);

  const matchedInventoryStocks = useMemo(() => {
    return inventory.filter(item => 
      item.name.toLowerCase().includes('sal') || 
      item.name.toLowerCase().includes('suplemento') ||
      item.name.toLowerCase().includes('mineral') ||
      item.name.toLowerCase().includes('prote')
    );
  }, [inventory]);

  return (
    <div className="space-y-6">
      {/* Introduction Card */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 p-6 md:p-8 rounded-3xl shadow-sm relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary dark:text-primary-light">
            <Leaf size={24} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-primary/10 dark:bg-primary/20 px-2 py-0.5 rounded-full text-primary dark:text-primary-light">Inteligência Nutricional</span>
          </div>
          <h2 className="font-serif italic text-2xl font-black text-primary dark:text-primary-light">Calculadora de Nutrição Animal</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400 max-w-xl leading-relaxed">
            Efetue previsões científicas exatas de suprimento mineral e proteico. Monitore as pesagens dos lotes para sugerir de forma eficiente a nutrição ruminal preventiva.
          </p>
        </div>
        
        <div className="bg-gray-100 dark:bg-zinc-800/80 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-2xl flex items-center gap-3 w-full md:w-auto">
          <Dumbbell className="text-primary" size={20} />
          <div>
            <span className="text-[9px] font-black uppercase text-gray-500 dark:text-gray-400 block">Estimativa GMD Gado</span>
            <span className="text-xs font-black text-gray-900 dark:text-white">{nutritionParameters.estimatedGmdGrams}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Parameters Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 p-6 rounded-3xl shadow-sm space-y-6">
            <h3 className="font-serif italic font-bold text-primary dark:text-primary-light text-base border-b pb-2">1. Seleção do Lote ou Parâmetros</h3>
            
            <div className="grid grid-cols-2 bg-gray-100 dark:bg-zinc-800/60 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setUsePresetLot(true)}
                className={`py-2 text-xs font-black rounded-lg transition-all ${
                  usePresetLot 
                    ? 'bg-primary text-white shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                }`}
              >
                Conectar Lote Ativo
              </button>
              <button
                onClick={() => setUsePresetLot(false)}
                className={`py-2 text-xs font-black rounded-lg transition-all ${
                  !usePresetLot 
                    ? 'bg-primary text-white shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                }`}
              >
                Simulação Livre
              </button>
            </div>

            {usePresetLot ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider block mb-1">
                    Lote Cadastrado nos Pastos
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none text-gray-900 dark:text-white"
                    value={selectedLotId}
                    onChange={(e) => setSelectedLotId(e.target.value)}
                  >
                    <option value="">-- Escolha um Lote --</option>
                    {animals.filter(a => !a.isSold).map(a => (
                      <option key={a.id} value={a.id}>
                        {a.lotName} • {a.category} ({a.quantity} cab.)
                      </option>
                    ))}
                  </select>
                </div>

                {activeLot && (
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl space-y-2">
                    <span className="text-[9px] font-black uppercase text-primary tracking-wider block">Metadados Recuperados do Lote</span>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] text-gray-500 dark:text-gray-400 block">Categoria Zootécnica:</span>
                        <span className="font-extrabold text-gray-900 dark:text-white">{activeLot.category}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-500 dark:text-gray-400 block">Regime de Criatório:</span>
                        <span className="font-extrabold text-gray-900 dark:text-white">{activeLot.type}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-500 dark:text-gray-400 block">Número de Cabeças:</span>
                        <span className="font-extrabold text-gray-900 dark:text-white">{activeLot.quantity} cab.</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-500 dark:text-gray-400 block">Peso Médio Atual (kg):</span>
                        <span className="font-extrabold text-primary dark:text-primary-light">{activeLot.averageWeight} kg</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider block mb-1">
                    Categoria Animal
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none text-gray-900 dark:text-white"
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value as any)}
                  >
                    <option value={AnimalCategory.BULL}>Boi / Novilho</option>
                    <option value={AnimalCategory.COW}>Vaca Adulta</option>
                    <option value={AnimalCategory.CALF}>Bezerro(a) Lactante</option>
                    <option value={AnimalCategory.HEIFER}>Novilha Recria</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider block mb-1">
                      Peso Médio Atual (kg)
                    </label>
                    <div className="relative">
                      <Scale className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={14} />
                      <input
                        type="number"
                        className="w-full pl-8 pr-2 py-1.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none text-gray-900 dark:text-white"
                        value={manualWeight}
                        onChange={(e) => setManualWeight(Math.max(10, parseInt(e.target.value) || 0))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider block mb-1">
                      Quantidade Cabeças
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none text-gray-900 dark:text-white"
                      value={manualQuantity}
                      onChange={(e) => setManualQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Weather / Season selection */}
            <div>
              <label className="text-[9px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider block mb-2">
                Época / Estação do Ano (Clima)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSeason('dry')}
                  className={`py-3 px-4 rounded-2xl border text-xs font-black transition-all text-center flex flex-col items-center justify-center gap-1 ${
                    season === 'dry' 
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300' 
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="text-sm">🔥 Seca</span>
                  <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400">Pasto fibroso, pouca proteína</span>
                </button>
                
                <button
                  onClick={() => setSeason('rainy')}
                  className={`py-3 px-4 rounded-2xl border text-xs font-black transition-all text-center flex flex-col items-center justify-center gap-1 ${
                    season === 'rainy' 
                      ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light' 
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="text-sm">🌧️ Águas</span>
                  <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400">Pasto verde farto, falta mineral</span>
                </button>
              </div>
            </div>

            {/* Note text info - CORRIGIDO COM FONTE MAIOR E MELHOR CONTRASTE */}
            <div className="p-5 bg-amber-50 dark:bg-amber-950/40 border-l-4 border-l-amber-500 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3">
              <Info className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={18} />
              <p className="text-sm md:text-base text-amber-900 dark:text-amber-200 leading-relaxed font-semibold">
                {nutritionParameters.recommendationGuide}
              </p>
            </div>
          </div>
        </div>

        {/* Results Columns */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Main Intake card indicators */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 p-6 md:p-8 rounded-3xl shadow-sm space-y-6">
            <h3 className="font-serif italic font-bold text-primary dark:text-primary-light text-base border-b pb-2">2. Consumo Sugerido e Planejamento</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Mineral result */}
              <div className="p-5 bg-primary/5 border border-primary/10 dark:border-primary/20 dark:bg-primary/5 rounded-2xl space-y-2 relative overflow-hidden">
                <span className="text-[9px] font-black uppercase text-primary dark:text-primary-light block">Sal / Suplemento Mineral</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-primary dark:text-primary-light">
                    {nutritionParameters.mineralPerDayHeadG}g
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-extrabold">/ animal / dia</span>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-normal font-medium pt-1">
                  Previne carências macro e microminerais (Fósforo, Cálcio, Zinco, Cobalto). Fornecer limpo à vontade no cocho.
                </p>
              </div>

              {/* Protein result */}
              <div className="p-5 bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-gray-700 rounded-2xl space-y-2 relative overflow-hidden">
                <span className="text-[9px] font-black uppercase text-primary dark:text-primary-light block">Suplementação Proteica</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-primary dark:text-primary-light">
                    {nutritionParameters.proteinPerDayHeadG}g
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-extrabold">/ animal / dia</span>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-normal font-medium pt-1">
                  Sal proteico enriquecido com farelo de soja/milho e ureia. Essencial para elevar o ganho médio diário e a digestão.
                </p>
              </div>
            </div>

            {/* Total Herd Demands */}
            <div className="border hover:border-primary/20 p-5 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 space-y-4">
              <span className="text-[9px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider block">Consumo Agregado p/ o Lote Inteiro ({currentQuantity} cab.)</span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold block">Demanda Mineral Diária:</span>
                  <span className="text-base font-black text-gray-900 dark:text-white">{nutritionParameters.dailyMineralLotKg.toFixed(1)} kg/dia</span>
                  <div className="flex items-center gap-1 bg-white/60 dark:bg-zinc-800 px-2 py-0.5 rounded-lg border w-fit text-[9px] font-black text-primary">
                    <ShoppingBag size={10} /> {nutritionParameters.sacksPerMonthMineral} sacas de 30kg / mês
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold block">Demanda Proteica Diária:</span>
                  <span className="text-base font-black text-gray-900 dark:text-white">{nutritionParameters.dailyProteinLotKg.toFixed(1)} kg/dia</span>
                  <div className="flex items-center gap-1 bg-white/60 dark:bg-zinc-800 px-2 py-0.5 rounded-lg border w-fit text-[9px] font-black text-primary">
                    <ShoppingBag size={10} /> {nutritionParameters.sacksPerMonthProtein} sacas de 30kg / mês
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Supply / Stock integration matching */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 p-6 rounded-3xl shadow-sm space-y-4">
            <h4 className="font-serif italic font-bold text-sm text-primary dark:text-primary-light flex items-center gap-1.5">
              <Warehouse size={16} /> Verificação de Estoque Disp.
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Suprimentos cruzados do estoque de ração e sais minerais no inventário rural central:
            </p>

            <div className="space-y-2">
              {matchedInventoryStocks.map(item => {
                const isProtein = item.name.toLowerCase().includes('prote') || item.name.toLowerCase().includes('ra');
                const dailyRate = isProtein ? nutritionParameters.dailyProteinLotKg : nutritionParameters.dailyMineralLotKg;
                let balanceKg = item.quantity;
                if (item.unit.toLowerCase().includes('sac') || item.unit.toLowerCase().includes('pct')) {
                  balanceKg = item.quantity * 30;
                }
                const daysLeft = dailyRate > 0 ? Math.floor(balanceKg / dailyRate) : 0;

                return (
                  <div key={item.id} className="flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
                    <div>
                      <span className="font-black text-gray-900 dark:text-white block">{item.name}</span>
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold">Saldo: {item.quantity} {item.unit} ({balanceKg} kg)</span>
                    </div>
                    <div className="text-right">
                      {daysLeft > 0 ? (
                        <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                          daysLeft < 7 ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'bg-primary/10 text-primary'
                        }`}>
                          Dura {daysLeft} dias de trato
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full font-black text-[9px] uppercase">
                          Trato Indefinido
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {matchedInventoryStocks.length === 0 && (
                <div className="text-center py-6 text-xs italic text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-zinc-800/20 border border-gray-200 dark:border-gray-700 rounded-2xl">
                  Nenhum sal mineral ou proteinado identificado no estoque rural ativo.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}