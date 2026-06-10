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
    let mineralRate = 0.0002; // defaults in % of body weight
    let proteinRate = 0.001; 

    // Adjustments based on animal category
    switch (currentCategory) {
      case AnimalCategory.COW:
        mineralRate = 0.00022; // 0.022% body weight
        proteinRate = season === 'dry' ? 0.0015 : 0.0008;
        break;
      case AnimalCategory.BULL:
        mineralRate = 0.00025; // 0.025% body weight
        proteinRate = season === 'dry' ? 0.0025 : 0.0012;
        break;
      case AnimalCategory.CALF:
        mineralRate = 0.00015; // 0.015% body weight
        proteinRate = season === 'dry' ? 0.0012 : 0.0006;
        break;
      case AnimalCategory.HEIFER:
        mineralRate = 0.0002;  // 0.02% body weight
        proteinRate = season === 'dry' ? 0.0018 : 0.0008;
        break;
      default:
        mineralRate = 0.0002;
        proteinRate = season === 'dry' ? 0.0015 : 0.001;
        break;
    }

    // Calculating individual intake gram sums
    const rawMineralGrams = Math.round(currentWeight * mineralRate * 1000);
    const rawProteinGrams = Math.round(currentWeight * proteinRate * 1000);

    // Hard clamps for security & realistic constraints (Ruminant health restrictions)
    const finalMineralGrams = Math.max(30, Math.min(200, rawMineralGrams));
    const finalProteinGrams = Math.max(50, Math.min(1500, rawProteinGrams));

    // Lot bulk demands multiplier
    const dailyMineralLotKg = (finalMineralGrams * currentQuantity) / 1000;
    const dailyProteinLotKg = (finalProteinGrams * currentQuantity) / 1000;

    // Sack metric estimates (Typically 30kg sacs in Brazilian livestock)
    const sacksPerMonthMineral = Math.ceil((dailyMineralLotKg * 30.5) / 30);
    const sacksPerMonthProtein = Math.ceil((dailyProteinLotKg * 30.5) / 30);

    // Nutrition explanations
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

  // Inventory matching checks
  const matchedInventoryStocks = useMemo(() => {
    const saltItems = inventory.filter(item => 
      item.name.toLowerCase().includes('sal') || 
      item.name.toLowerCase().includes('suplemento') ||
      item.name.toLowerCase().includes('mineral') ||
      item.name.toLowerCase().includes('prote')
    );
    return saltItems;
  }, [inventory]);

  return (
    <div className="space-y-6">
      {/* Introduction Card */}
      <div className="bg-white dark:bg-zinc-900 border border-[#e5e0d8] dark:border-zinc-800 p-6 md:p-8 rounded-3xl shadow-xs relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-[#5fa875]">
            <Leaf size={24} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-0.5 rounded-full">Inteligência Nutricional</span>
          </div>
          <h2 className="font-serif italic text-2xl font-black text-[#3d5a45] dark:text-[#5fa875]">Calculadora de Nutrição Animal</h2>
          <p className="text-xs text-[#8d8a86] dark:text-zinc-400 max-w-xl leading-relaxed">
            Efetue previsões científicas exatas de suprimento mineral e proteico. Monitore as pesagens dos lotes para sugerir de forma eficiente a nutrição ruminal preventiva.
          </p>
        </div>
        
        <div className="bg-[#fcfaf7] dark:bg-zinc-800/80 px-4 py-3 border border-[#e5e0d8] dark:border-zinc-700 rounded-2xl flex items-center gap-3 w-full md:w-auto">
          <Dumbbell className="text-emerald-700" size={20} />
          <div>
            <span className="text-[9px] font-black uppercase text-[#8d8a86] block">Estimativa GMD Gado</span>
            <span className="text-xs font-black text-[#2d2a26] dark:text-zinc-200">{nutritionParameters.estimatedGmdGrams}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Parameters Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-[#e5e0d8] dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
            <h3 className="font-serif italic font-bold text-[#3d5a45] dark:text-[#5fa875] text-base border-b pb-2">1. Seleção do Lote ou Parâmetros</h3>
            
            {/* Choose Preset vs Manual */}
            <div className="grid grid-cols-2 bg-[#fcfaf7] dark:bg-zinc-800/60 p-1 rounded-xl border">
              <button
                onClick={() => setUsePresetLot(true)}
                className={`py-2 text-xs font-black rounded-lg transition-all ${
                  usePresetLot 
                    ? 'bg-[#3d5a45] text-white shadow-sm' 
                    : 'text-[#8d8a86] hover:bg-neutral-50 dark:hover:bg-zinc-700/50'
                }`}
              >
                Conectar Lote Ativo
              </button>
              <button
                onClick={() => setUsePresetLot(false)}
                className={`py-2 text-xs font-black rounded-lg transition-all ${
                  !usePresetLot 
                    ? 'bg-[#3d5a45] text-white shadow-sm' 
                    : 'text-[#8d8a86] hover:bg-neutral-50 dark:hover:bg-zinc-700/50'
                }`}
              >
                Simulação Livre
              </button>
            </div>

            {usePresetLot ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-[#8d8a86] tracking-wider block mb-1">
                    Lote Cadastrado nos Pastos
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border rounded-xl font-bold text-xs"
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
                  <div className="p-4 bg-emerald-50/20 border border-emerald-100 rounded-2xl space-y-2">
                    <span className="text-[9px] font-black uppercase text-[#3d5a45] tracking-wider block">Metadados Recuperados do Lote</span>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] text-zinc-400 block">Categoria Zootécnica:</span>
                        <span className="font-extrabold text-neutral-800 dark:text-zinc-200">{activeLot.category}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-400 block">Regime de Criatório:</span>
                        <span className="font-extrabold text-neutral-800 dark:text-zinc-200">{activeLot.type}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-400 block">Número de Cabeças:</span>
                        <span className="font-extrabold text-neutral-800 dark:text-zinc-200">{activeLot.quantity} cab.</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-400 block">Peso Médio Atual (kg):</span>
                        <span className="font-extrabold text-emerald-800 dark:text-emerald-500">{activeLot.averageWeight} kg</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Manual parameters inputs */}
                <div>
                  <label className="text-[9px] font-black uppercase text-[#8d8a86] tracking-wider block mb-1">
                    Categoria Animal
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border rounded-xl font-bold text-xs"
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
                    <label className="text-[9px] font-black uppercase text-[#8d8a86] tracking-wider block mb-1">
                      Peso Médio Atual (kg)
                    </label>
                    <div className="relative">
                      <Scale className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                      <input
                        type="number"
                        className="w-full pl-8 pr-2 py-1.5 bg-white dark:bg-zinc-800 border rounded-xl font-bold text-xs"
                        value={manualWeight}
                        onChange={(e) => setManualWeight(Math.max(10, parseInt(e.target.value) || 0))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-[#8d8a86] tracking-wider block mb-1">
                      Quantidade Cabeças
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border rounded-xl font-bold text-xs"
                      value={manualQuantity}
                      onChange={(e) => setManualQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Weather / Season selection */}
            <div>
              <label className="text-[9px] font-black uppercase text-[#8d8a86] tracking-wider block mb-2">
                Época / Estação do Ano (Clima)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSeason('dry')}
                  className={`py-3 px-4 rounded-2xl border text-xs font-black transition-all text-center flex flex-col items-center justify-center gap-1 ${
                    season === 'dry' 
                      ? 'border-amber-400 bg-amber-50/40 text-amber-900 dark:bg-amber-950/20 dark:text-amber-400' 
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-500'
                  }`}
                >
                  <span className="text-sm">🔥 Seca</span>
                  <span className="text-[9px] font-bold text-zinc-400">Pasto fibroso, pouca proteína</span>
                </button>
                
                <button
                  onClick={() => setSeason('rainy')}
                  className={`py-3 px-4 rounded-2xl border text-xs font-black transition-all text-center flex flex-col items-center justify-center gap-1 ${
                    season === 'rainy' 
                      ? 'border-emerald-400 bg-emerald-50/40 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-400' 
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-500'
                  }`}
                >
                  <span className="text-sm">🌧️ Águas</span>
                  <span className="text-[9px] font-bold text-zinc-400">Pasto verde farto, falta mineral</span>
                </button>
              </div>
            </div>

            {/* Note text info */}
            <div className="p-4 bg-amber-50/40 border border-amber-100 rounded-2xl flex items-start gap-2.5">
              <Info className="text-amber-800 shrink-0 mt-0.5" size={16} />
              <p className="text-[10px] text-amber-900 leading-relaxed font-semibold">
                {nutritionParameters.recommendationGuide}
              </p>
            </div>
          </div>
        </div>

        {/* Results Columns */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Main Intake card indicators */}
          <div className="bg-white dark:bg-zinc-900 border border-[#e5e0d8] dark:border-zinc-800 p-6 md:p-8 rounded-3xl shadow-sm space-y-6">
            <h3 className="font-serif italic font-bold text-[#3d5a45] dark:text-[#5fa875] text-base border-b pb-2">2. Consumo Sugerido e Planejamento</h3>

            {/* Individual Consumo Head Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Mineral result */}
              <div className="p-5 bg-emerald-50/30 border border-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/10 rounded-2xl space-y-2 relative overflow-hidden">
                <span className="text-[9px] font-black uppercase text-emerald-800 dark:text-[#5fa875] block">Sal / Suplemento Mineral</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-[#3d5a45] dark:text-[#5fa875]">
                    {nutritionParameters.mineralPerDayHeadG}g
                  </span>
                  <span className="text-xs text-[#8d8a86] font-extrabold">/ animal / dia</span>
                </div>
                <p className="text-[10px] text-zinc-500 leading-normal font-medium pt-1">
                  Previne carências macro e microminerais (Fósforo, Cálcio, Zinco, Cobalto). Fornecer limpo à vontade no cocho.
                </p>
                <div className="absolute right-3 bottom-3 opacity-15">
                  <Leaf size={44} className="text-[#3d5a45]" />
                </div>
              </div>

              {/* Protein result */}
              <div className="p-5 bg-[#3d5a45]/5 dark:bg-[#3d5a45]/15 border border-emerald-100 dark:border-zinc-800 rounded-2xl space-y-2 relative overflow-hidden">
                <span className="text-[9px] font-black uppercase text-[#3d5a45] dark:text-[#5fa875] block">Suplementação Proteica</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-[#3d5a45] dark:text-[#5fa875]">
                    {nutritionParameters.proteinPerDayHeadG}g
                  </span>
                  <span className="text-xs text-[#8d8a86] font-extrabold">/ animal / dia</span>
                </div>
                <p className="text-[10px] text-zinc-500 leading-normal font-medium pt-1">
                  Sal proteico enriquecido com farelo de soja/milho e ureia. Essencial para elevar o ganho médio diário e a digestão.
                </p>
                <div className="absolute right-3 bottom-3 opacity-15">
                  <Dumbbell size={44} className="text-[#3d5a45]" />
                </div>
              </div>
            </div>

            {/* Total Herd Demands in Kg & Sacks */}
            <div className="border hover:border-emerald-100 p-5 rounded-2xl bg-[#fcfaf7] dark:bg-zinc-800/40 space-y-4">
              <span className="text-[9px] font-black uppercase text-[#8d8a86] tracking-wider block">Consumo Agregado p/ o Lote Inteiro ({currentQuantity} cab.)</span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 font-bold block">Demanda Mineral Diária:</span>
                  <span className="text-base font-black text-slate-800 dark:text-zinc-100">{nutritionParameters.dailyMineralLotKg.toFixed(1)} kg/dia</span>
                  <div className="flex items-center gap-1 bg-white/60 dark:bg-zinc-800 px-2 py-0.5 rounded-lg border w-fit text-[9px] font-black text-rose-800">
                    <ShoppingBag size={10} /> {nutritionParameters.sacksPerMonthMineral} sacas de 30kg / mês
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 font-bold block">Demanda Proteica Diária:</span>
                  <span className="text-base font-black text-slate-800 dark:text-zinc-100">{nutritionParameters.dailyProteinLotKg.toFixed(1)} kg/dia</span>
                  <div className="flex items-center gap-1 bg-white/60 dark:bg-zinc-800 px-2 py-0.5 rounded-lg border w-fit text-[9px] font-black text-rose-800">
                    <ShoppingBag size={10} /> {nutritionParameters.sacksPerMonthProtein} sacas de 30kg / mês
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Supply / Stock integration matching */}
          <div className="bg-white dark:bg-zinc-900 border border-[#e5e0d8] dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
            <h4 className="font-serif italic font-bold text-sm text-[#3d5a45] dark:text-[#5fa875] flex items-center gap-1.5">
              <Warehouse size={16} /> Verificação de Estoque Disp.
            </h4>
            <p className="text-xs text-[#8d8a86]">
              Suprimentos cruzados do estoque de ração e sais minerais no inventário rural central:
            </p>

            <div className="space-y-2">
              {matchedInventoryStocks.map(item => {
                // simple days of feed left forecast
                const isProtein = item.name.toLowerCase().includes('prote') || item.name.toLowerCase().includes('ra');
                const dailyRate = isProtein ? nutritionParameters.dailyProteinLotKg : nutritionParameters.dailyMineralLotKg;
                
                // Assuming inventory quantity is in bags of 30kg or total kg
                let balanceKg = item.quantity;
                if (item.unit.toLowerCase().includes('sac') || item.unit.toLowerCase().includes('pct')) {
                  balanceKg = item.quantity * 30; // 30kg sacs standard
                }
                
                const daysLeft = dailyRate > 0 ? Math.floor(balanceKg / dailyRate) : 0;

                return (
                  <div key={item.id} className="flex justify-between items-center bg-[#fcfaf7] dark:bg-zinc-800/50 p-3 rounded-xl border text-xs">
                    <div>
                      <span className="font-black text-neutral-800 dark:text-zinc-200 block">{item.name}</span>
                      <span className="text-[9px] text-[#8d8a86] uppercase font-bold">Saldo: {item.quantity} {item.unit} ({balanceKg} kg)</span>
                    </div>
                    <div className="text-right">
                      {daysLeft > 0 ? (
                        <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                          daysLeft < 7 ? 'bg-rose-100 text-rose-800' : 'bg-green-100 text-green-800'
                        }`}>
                          Dura {daysLeft} dias de trato
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full font-black text-[9px] uppercase">
                          Trato Indefinido
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {matchedInventoryStocks.length === 0 && (
                <div className="text-center py-6 text-xs italic text-[#8d8a86] bg-neutral-50/50 dark:bg-zinc-800/20 border rounded-2xl">
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
