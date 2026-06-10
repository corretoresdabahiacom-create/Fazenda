/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { WeighingSheet, WeighingRow } from '../types';
import { 
  Plus, 
  Trash2, 
  Save, 
  FileText, 
  TrendingUp, 
  ArrowLeftRight, 
  ChevronRight, 
  FileDown, 
  Edit, 
  Check, 
  Calendar,
  Layers,
  Sparkles,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const colStyles = [
  { width: '140px', minWidth: '140px', maxWidth: '140px' },
  { width: '165px', minWidth: '165px', maxWidth: '165px' },
  { width: '150px', minWidth: '150px', maxWidth: '150px' }, // Peso (kg)/ Animal
  { width: '165px', minWidth: '165px', maxWidth: '165px' }, // Divisão por 15
  { width: '175px', minWidth: '175px', maxWidth: '175px' }, // Média @/Animal
  { width: '165px', minWidth: '165px', maxWidth: '165px' }, // Valor da Arroba
  { width: '190px', minWidth: '190px', maxWidth: '190px' }, // Valor parcial/ animal
  { width: '200px', minWidth: '200px', maxWidth: '200px' }, // Total Geral
  { width: '60px', minWidth: '60px', maxWidth: '60px' },    // Ações
];

export default function WeighingWorksheet() {
  const { weighingSheets, saveWeighingSheet, deleteWeighingSheet, animals, pastures } = useFirebase();
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  
  // Sheet state
  const [sheetName, setSheetName] = useState('Planilha de Pesagem');
  const [sheetRows, setSheetRows] = useState<WeighingRow[]>([
    { id: '1', quantity: 0, weight: 0, arrobaValue: 0 },
  ]);
  const [sheetNotes, setSheetNotes] = useState('');
  
  // Modals/Ui state
  const [isEditingName, setIsEditingName] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activeTab, setActiveTab] = useState<'sheets' | 'editor'>('sheets');

  // Load selected sheet
  useEffect(() => {
    if (activeSheetId) {
      const selected = weighingSheets.find(s => s.id === activeSheetId);
      if (selected) {
        setSheetName(selected.name);
        setSheetRows(selected.rows || []);
        setSheetNotes(selected.notes || '');
      }
    }
  }, [activeSheetId, weighingSheets]);

  // Create new blank sheet
  const handleCreateNewSheet = () => {
    const newId = `sheet_${Date.now()}`;
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const newSheet: WeighingSheet = {
      id: newId,
      name: `Pesagem de Bovinos - ${todayStr}`,
      date: new Date().toISOString(),
      rows: [
        { id: '1', quantity: 0, weight: 0, arrobaValue: 0 }
      ],
      notes: ''
    };
    
    // We instantly save it to firebase
    saveWeighingSheet(newSheet);
    setActiveSheetId(newId);
    setSheetName(newSheet.name);
    setSheetRows(newSheet.rows);
    setSheetNotes('');
    setActiveTab('editor');
  };

  // Auto-populate from animal lots
  const handlePopulateFromLots = (pastureId: string) => {
    const lotAnimals = animals.filter(a => a.currentPastureId === pastureId);
    if (lotAnimals.length === 0) {
      alert("Nenhum animal cadastrado atualmente neste pasto!");
      return;
    }

    const newRows: WeighingRow[] = lotAnimals.map((animal, idx) => ({
      id: `anim_${idx}_${Date.now()}`,
      quantity: animal.quantity || 1,
      weight: animal.averageWeight || 400,
      arrobaValue: animal.arrobaValue || 310
    }));

    setSheetRows(newRows);
  };

  const handleAddRow = () => {
    const newRow: WeighingRow = {
      id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      quantity: 1,
      weight: 300,
      arrobaValue: sheetRows.length > 0 ? sheetRows[sheetRows.length - 1].arrobaValue : 310
    };
    setSheetRows([...sheetRows, newRow]);
  };

  const handleUpdateRowField = (rowId: string, field: keyof WeighingRow, value: number) => {
    setSheetRows(prevRows => 
      prevRows.map(row => {
        if (row.id === rowId) {
          const updated = { ...row, [field]: value };
          if (field === 'weight') {
            updated.divisionBy15 = value / 15;
          }
          return updated;
        }
        return row;
      })
    );
  };

  const handleDeleteRow = (rowId: string) => {
    if (sheetRows.length <= 1) {
      alert("A planilha precisa ter pelo menos 1 linha!");
      return;
    }
    setSheetRows(sheetRows.filter(r => r.id !== rowId));
  };

  const handleSaveSheet = async () => {
    setSaveStatus('saving');
    const id = activeSheetId || `sheet_${Date.now()}`;
    const targetSheet: WeighingSheet = {
      id,
      name: sheetName,
      date: activeSheetId ? (weighingSheets.find(s => s.id === activeSheetId)?.date || new Date().toISOString()) : new Date().toISOString(),
      rows: sheetRows,
      notes: sheetNotes
    };

    try {
      await saveWeighingSheet(targetSheet);
      if (!activeSheetId) {
        setActiveSheetId(id);
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error("Erro ao salvar planilha:", err);
      setSaveStatus('idle');
      alert("Erro ao persistir os dados.");
    }
  };

  const [deletingSheetId, setDeletingSheetId] = useState<string | null>(null);

  const handleDeleteSheet = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeletingSheetId(id);
  };

  const handleConfirmDeleteSheet = async () => {
    if (deletingSheetId) {
      await deleteWeighingSheet(deletingSheetId);
      if (activeSheetId === deletingSheetId) {
        setActiveSheetId(null);
        setActiveTab('sheets');
      }
      setDeletingSheetId(null);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Find all number inputs inside the table
      const inputs = Array.from(document.querySelectorAll('table input[type="number"]')) as HTMLInputElement[];
      const currentIndex = inputs.indexOf(e.currentTarget);
      
      if (currentIndex !== -1) {
        if (currentIndex < inputs.length - 1) {
          inputs[currentIndex + 1].focus();
          inputs[currentIndex + 1].select();
        } else {
          // If we are on the last input of the last row, add a new row
          handleAddRow();
          // Focus the first input of the new row after state update
          setTimeout(() => {
            const freshInputs = Array.from(document.querySelectorAll('table input[type="number"]')) as HTMLInputElement[];
            if (freshInputs.length > inputs.length) {
              const nextIndex = inputs.length; // Index of first input of the new row
              freshInputs[nextIndex].focus();
              freshInputs[nextIndex].select();
            }
          }, 80);
        }
      }
    }
  };

  // Formulas for calculations per row
  const calculateRowValues = (row: WeighingRow) => {
    // divisionBy15 is peso em arrobas = weight / 15
    const divisionBy15 = row.divisionBy15 !== undefined ? row.divisionBy15 : (row.weight / 15);
    // parcialArrobaAnimal is "Média @/Animal" = divisionBy15 / quantity
    const parcialArrobaAnimal = row.quantity > 0 ? (divisionBy15 / row.quantity) : 0;
    // valorParcialAnimal is "Valor parcial/ animal" = ( (divisionBy15 * row.arrobaValue) / quantity ) / 2
    const valorParcialAnimal = row.quantity > 0 ? (((divisionBy15 * row.arrobaValue) / row.quantity) / 2) : 0;
    // parcialTotal is "Total Geral" of the row = valorParcialAnimal * row.quantity
    const parcialTotal = valorParcialAnimal * row.quantity;
    const averageWeight = row.quantity > 0 ? (row.weight / row.quantity) : 0;

    return {
      averageWeight,
      divisionBy15,
      parcialArrobaAnimal,
      valorParcialAnimal,
      parcialTotal,
    };
  };

  // Overall calculations
  const calculateTotals = () => {
    let qTotal = 0;
    let weightSum = 0;               // Sum of total weight in kg
    let totalDivisionBy15 = 0;       // Total @ = Sum of divisionBy15 of all rows
    let totalQuantityValue = 0;      // Sum of parcial total of each row (Total Geral no final)

    sheetRows.forEach(row => {
      const q = row.quantity || 0;
      const w = row.weight || 0;
      const { divisionBy15, parcialTotal } = calculateRowValues(row);
      
      qTotal += q;
      weightSum += w;
      totalDivisionBy15 += divisionBy15; // Sum of row level @ weight
      totalQuantityValue += parcialTotal; // Sum of total geral of each row
    });

    // Average weight per head (in kg)
    const averageWeight = qTotal > 0 ? (weightSum / qTotal) : 0;
    
    // Average Arroba value is weighted: Sum (arrobaValue_i * divisionBy15_i) / Total @
    let totalArrobaWeightedSum = 0;
    sheetRows.forEach(row => {
      const { divisionBy15 } = calculateRowValues(row);
      totalArrobaWeightedSum += (row.arrobaValue * divisionBy15);
    });
    const weightedArrobaValue = totalDivisionBy15 > 0 ? (totalArrobaWeightedSum / totalDivisionBy15) : 310;

    // As requested: No valor parcial pega o valor do resultado final (totalQuantityValue) dividido pela quantidade total de animais (qTotal)
    const averageValuePerHead = qTotal > 0 ? (totalQuantityValue / qTotal) : 0;

    // Average Arrobas per head
    const averageArrobas = qTotal > 0 ? (totalDivisionBy15 / qTotal) : 0;

    return {
      qTotal,
      weightSum,
      averageWeight,
      totalDivisionBy15,
      averageArrobas,
      weightedArrobaValue,
      averageValuePerHead,
      totalQuantityValue
    };
  };

  const totals = calculateTotals();

  // Export spreadsheet as CSV standard text file
  const handleExportCSV = () => {
    const csvRows = [];
    // Headers
    csvRows.push("Quantidade,Peso (kg),Peso (kg)/ Animal,Divisão por 15 (@),Média @/Animal (@),Valor da Arroba (R$),Valor parcial/ animal (R$),Total Geral (R$)");
    
    sheetRows.forEach(row => {
      const { divisionBy15, parcialArrobaAnimal, valorParcialAnimal, parcialTotal, averageWeight } = calculateRowValues(row);
      csvRows.push([
        row.quantity,
        row.weight.toFixed(5),
        averageWeight.toFixed(5),
        divisionBy15.toFixed(5),
        parcialArrobaAnimal.toFixed(5),
        row.arrobaValue.toFixed(5),
        valorParcialAnimal.toFixed(5),
        parcialTotal.toFixed(5)
      ].join(','));
    });

    // Pule uma linha
    csvRows.push("");

    // Totals row in order
    csvRows.push([
      totals.qTotal,
      totals.weightSum.toFixed(5),
      totals.averageWeight.toFixed(5),
      totals.totalDivisionBy15.toFixed(5),
      totals.averageArrobas.toFixed(5),
      totals.weightedArrobaValue.toFixed(5),
      totals.averageValuePerHead.toFixed(5),
      totals.totalQuantityValue.toFixed(5)
    ].join(','));

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${sheetName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* View Selector Headers */}
      <div className="flex border-b border-[#e5e0d8] gap-4 mb-4">
        <button 
          onClick={() => setActiveTab('sheets')}
          className={`pb-3 font-semibold text-sm transition-all relative ${
            activeTab === 'sheets' ? 'text-[#3d5a45] font-bold border-b-2 border-[#3d5a45]' : 'text-[#8d8a86] hover:text-[#2d2a26]'
          }`}
        >
          <span className="flex items-center gap-1.5 px-1">
            <ClipboardList size={16} /> Minhas Planilhas ({weighingSheets.length})
          </span>
        </button>
        <button 
          onClick={() => {
            if (!activeSheetId) {
              // Create default unsaved state
              setActiveSheetId('temp');
              setSheetName('Nova Planilha de Pesagem');
              setSheetRows([
                { id: '1', quantity: 0, weight: 0, arrobaValue: 0 }
              ]);
              setSheetNotes('');
            }
            setActiveTab('editor');
          }}
          className={`pb-3 font-semibold text-sm transition-all relative ${
            activeTab === 'editor' ? 'text-[#3d5a45] font-bold border-b-2 border-[#3d5a45]' : 'text-[#8d8a86] hover:text-[#2d2a26]'
          }`}
        >
          <span className="flex items-center gap-1.5 px-1">
            <FileText size={16} /> Planilha Ativa: {sheetName}
          </span>
        </button>
      </div>

      {activeTab === 'sheets' ? (
        /* Saved sheets index view */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div 
            onClick={handleCreateNewSheet}
            className="border-2 border-dashed border-[#e5e0d8] hover:border-[#3d5a45] bg-white p-8 rounded-3xl cursor-pointer flex flex-col items-center justify-center text-center gap-4 transition-all hover:shadow-md hover:scale-101 active:scale-99 group"
          >
            <div className="w-16 h-16 bg-[#fcfaf7] rounded-full flex items-center justify-center border border-[#e5e0d8] group-hover:bg-[#3d5a45]/5 group-hover:border-[#3d5a45]/20 group-hover:scale-110 transition-all">
              <Plus size={28} className="text-[#3d5a45]" />
            </div>
            <div>
              <h3 className="font-bold text-[#3d5a45] text-lg group-hover:underline">Criar Nova Planilha</h3>
              <p className="text-[#8d8a86] text-xs mt-1">Insira e calcule as médias de pesagens de gado instantaneamente.</p>
            </div>
          </div>

          <AnimatePresence>
            {weighingSheets.map((sheet) => {
              const rowCount = sheet.rows?.length || 0;
              const heads = sheet.rows?.reduce((acc, current) => acc + (current.quantity || 0), 0) || 0;
              const totalKg = sheet.rows?.reduce((acc, current) => acc + (current.weight || 0), 0) || 0;
              const totalAt = sheet.rows?.reduce((acc, current) => acc + (current.divisionBy15 !== undefined ? current.divisionBy15 : ((current.weight || 0) / 15)), 0) || 0;

              return (
                <motion.div
                  key={sheet.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => {
                    setActiveSheetId(sheet.id);
                    setSheetName(sheet.name);
                    setSheetRows(sheet.rows || []);
                    setSheetNotes(sheet.notes || '');
                    setActiveTab('editor');
                  }}
                  className="bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-xs cursor-pointer hover:shadow-md hover:border-[#3d5a45]/40 transition-all flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="p-2 bg-[#fcfaf7] rounded-xl border border-[#e5e0d8]">
                        <FileText size={20} className="text-[#3d5a45]" />
                      </div>
                      <button
                        onClick={(e) => handleDeleteSheet(sheet.id, e)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Deletar Planilha"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div>
                      <h4 className="font-serif italic text-base font-bold text-[#3d5a45] truncate group-hover:underline">
                        {sheet.name}
                      </h4>
                      <p className="text-[10px] uppercase font-black text-[#8d8a86] mt-1 flex items-center gap-1">
                        <Calendar size={10} /> {new Date(sheet.date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#e5e0d8] text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-[#8d8a86] block">Total de Gado</span>
                        <strong className="text-sm font-black text-[#3d5a45]">{heads} cab.</strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-[#8d8a86] block">Arrobas Totais</span>
                        <strong className="text-sm font-black text-orange-600">
                          {totalAt.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 5 })} @
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 flex items-center justify-between text-xs font-semibold text-[#8d8a86] group-hover:text-[#3d5a45]">
                    <span>{rowCount} {rowCount === 1 ? 'linha' : 'linhas'} cadastradas</span>
                    <ChevronRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        /* active spreadsheet workbench */
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white p-6 rounded-3xl border border-[#e5e0d8] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#f5f2ed] text-[#3d5a45] rounded-2xl">
                <FileText size={24} />
              </div>
              <div className="space-y-1">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={sheetName} 
                      onChange={(e) => setSheetName(e.target.value)}
                      className="border border-[#e5e0d8] px-3 py-1 text-lg font-bold rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                      autoFocus
                    />
                    <button 
                      onClick={() => setIsEditingName(false)}
                      className="p-1 px-2.5 bg-[#3d5a45] text-white text-xs font-black rounded-lg hover:bg-opacity-90 flex items-center gap-1"
                    >
                      <Check size={14} /> OK
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <h2 className="text-xl font-bold text-[#3d5a45] break-all">
                      {sheetName}
                    </h2>
                    <button 
                      onClick={() => setIsEditingName(true)}
                      className="p-1 text-[#8d8a86] hover:text-[#3d5a45] hover:bg-[#fcfaf7] rounded-lg transition-all"
                      title="Editar nome"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-[#8d8a86] font-medium">
                  <span>Modo de edição ativo</span>
                  <span>•</span>
                  <span>Calculado em tempo real</span>
                </div>
              </div>
            </div>

            {/* Practical Lot Selector Shortcut to accelerate entry */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <select 
                  onChange={(e) => {
                    if (e.target.value) {
                      handlePopulateFromLots(e.target.value);
                      e.target.value = ''; // Reset selection
                    }
                  }}
                  className="bg-[#fcfaf7] border border-[#e5e0d8] hover:border-[#3d5a45]/40 text-xs font-black text-[#3d5a45] pl-8 pr-12 py-2.5 rounded-xl cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3d5a45]/10 appearance-none flex items-center"
                >
                  <option value="">Carregar de Lotes de Animais...</option>
                  {pastures.map(p => {
                    const countInPasture = animals.filter(a => a.currentPastureId === p.id).reduce((sum, a) => sum + (a.quantity || 0), 0);
                    if (countInPasture === 0) return null;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.number} - {p.name} ({countInPasture} cab.)
                      </option>
                    );
                  })}
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3d5a45]">
                  <Layers size={14} />
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold pointer-events-none text-[#8d8a86]">
                  ▼
                </div>
              </div>

              <button 
                onClick={handleExportCSV}
                className="bg-[#f5f2ed] text-[#8d8a86] hover:text-[#3d5a45] border border-[#e5e0d8] hover:border-[#3d5a45]/30 px-3 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 active:scale-95 transition-all"
                title="Exportar planilha"
              >
                <FileDown size={14} /> Exportar
              </button>

              <button 
                onClick={handleSaveSheet}
                disabled={saveStatus === 'saving'}
                className="bg-[#3d5a45] text-white hover:bg-[#2d4333] px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
              >
                <Save size={14} />
                {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo!' : 'Salvar no Servidor'}
              </button>
            </div>
          </div>

          {/* Excel Spreadsheet Table Interface */}
          <div className="bg-white rounded-3xl border border-[#e5e0d8] overflow-hidden shadow-sm">
            <div className="overflow-x-auto w-full scrollbar-thin">
              <table style={{ width: '1410px', minWidth: '1410px', tableLayout: 'fixed' }} className="text-left border-collapse">
                <colgroup>
                  <col style={colStyles[0]} />
                  <col style={colStyles[1]} />
                  <col style={colStyles[2]} />
                  <col style={colStyles[3]} />
                  <col style={colStyles[4]} />
                  <col style={colStyles[5]} />
                  <col style={colStyles[6]} />
                  <col style={colStyles[7]} />
                  <col style={colStyles[8]} />
                </colgroup>
                <thead>
                  <tr className="bg-[#fcfaf7] border-b border-[#e5e0d8] h-14">
                    <th style={colStyles[0]} className="p-4 text-[10px] font-black uppercase text-[#8d8a86] text-center overflow-hidden text-ellipsis whitespace-nowrap">Quantidade (Cab.)</th>
                    <th style={colStyles[1]} className="p-4 text-[10px] font-black uppercase text-[#8d8a86] text-center overflow-hidden text-ellipsis whitespace-nowrap">Peso (kg)</th>
                    <th style={colStyles[2]} className="p-4 text-[10px] font-black uppercase text-[#8d8a86] text-center overflow-hidden text-ellipsis whitespace-nowrap">Peso (kg)/ Animal</th>
                    <th style={colStyles[3]} className="p-4 text-[10px] font-black uppercase text-[#8d8a86] text-center overflow-hidden text-ellipsis whitespace-nowrap">
                      <div>Divisão por 15</div>
                      <div className="text-[8px] font-bold text-[#8d8a86]/80 mt-0.5 lowercase">(total @)</div>
                    </th>
                    <th style={colStyles[4]} className="p-4 text-[10px] font-black uppercase text-[#8d8a86] text-center overflow-hidden text-ellipsis whitespace-nowrap">Média @/Animal</th>
                    <th style={colStyles[5]} className="p-4 text-[10px] font-black uppercase text-[#8d8a86] text-center overflow-hidden text-ellipsis whitespace-nowrap">Valor da Arroba (R$)</th>
                    <th style={colStyles[6]} className="p-4 text-[10px] font-black uppercase text-[#8d8a86] text-center overflow-hidden text-ellipsis whitespace-nowrap">Valor parcial/ animal</th>
                    <th style={colStyles[7]} className="p-4 text-[10px] font-black uppercase text-[#8d8a86] text-center overflow-hidden text-ellipsis whitespace-nowrap">Total Geral</th>
                    <th style={colStyles[8]} className="p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {sheetRows.map((row, idx) => {
                      const { averageWeight, divisionBy15, parcialArrobaAnimal, valorParcialAnimal, parcialTotal } = calculateRowValues(row);

                      return (
                        <motion.tr 
                           key={row.id}
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           exit={{ opacity: 0 }}
                           style={{ display: 'table-row' }}
                           className="border-b border-[#f5f2ed] hover:bg-[#fcfaf7]/50"
                        >
                           {/* Quantidade */}
                           <td style={colStyles[0]} className="p-3 text-center align-middle">
                             <div className="inline-flex items-center gap-1 border border-[#e5e0d8] focus-within:border-[#3d5a45] rounded-xl px-2 py-1.5 bg-[#fafafa]/50 focus-within:bg-white w-28 justify-center mx-auto">
                               <input 
                                 type="number" 
                                 min="0"
                                 className="w-12 text-center font-bold text-sm bg-transparent border-0 p-0 focus:ring-0 focus:outline-none"
                                 value={row.quantity || ''}
                                 onChange={(e) => handleUpdateRowField(row.id, 'quantity', Math.max(0, parseInt(e.target.value) || 0))}
                                 onKeyDown={handleInputKeyDown}
                               />
                               <span className="text-[10px] uppercase font-black text-[#8d8a86]">cab.</span>
                             </div>
                           </td>

                           {/* Peso kg */}
                           <td style={colStyles[1]} className="p-3 text-center align-middle">
                             <div className="inline-flex items-center gap-1 border border-[#e5e0d8] focus-within:border-[#3d5a45] rounded-xl px-2 py-1.5 bg-[#fafafa]/50 focus-within:bg-white w-32 justify-center mx-auto">
                               <input 
                                 type="number" 
                                 min="0"
                                 step="any"
                                 className="w-16 text-center font-bold text-sm bg-transparent border-0 p-0 focus:ring-0 focus:outline-none"
                                 value={row.weight || ''}
                                 onChange={(e) => handleUpdateRowField(row.id, 'weight', Math.max(0, parseFloat(e.target.value) || 0))}
                                 onKeyDown={handleInputKeyDown}
                               />
                               <span className="text-[10px] uppercase font-black text-[#8d8a86]">kg</span>
                             </div>
                           </td>

                           {/* Peso (kg)/ Animal */}
                           <td style={colStyles[2]} className="p-3 text-center font-mono text-sm text-[#3d5a45] font-semibold whitespace-nowrap align-middle">
                             {averageWeight.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 5 })} kg
                           </td>

                           {/* Divisão por 15 (Calculado gado @ - NÃO EDITÁVEL AS REQUESTED!) */}
                           <td style={colStyles[3]} className="p-3 text-center font-mono text-sm text-[#3d5a45] font-semibold whitespace-nowrap align-middle">
                             {divisionBy15.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 5 })} @
                           </td>

                           {/* Parcial de Arroba por Animal */}
                           <td style={colStyles[4]} className="p-3 text-center font-mono text-sm text-[#3d5a45] font-semibold whitespace-nowrap align-middle">
                             {parcialArrobaAnimal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 5 })} @
                           </td>

                           {/* Valor Arroba R$ */}
                           <td style={colStyles[5]} className="p-3 text-center align-middle">
                             <div className="inline-flex items-center gap-1 border border-[#e5e0d8] focus-within:border-[#3d5a45] rounded-xl px-2 py-1.5 bg-[#fafafa]/50 focus-within:bg-white w-32 justify-center mx-auto">
                               <span className="text-[10px] font-black text-[#8d8a86]">R$</span>
                               <input 
                                 type="number" 
                                 step="any"
                                 min="0"
                                 className="w-16 text-center font-bold text-sm bg-transparent border-0 p-0 focus:ring-0 focus:outline-none"
                                 value={row.arrobaValue || ''}
                                 onChange={(e) => handleUpdateRowField(row.id, 'arrobaValue', Math.max(0, parseFloat(e.target.value) || 0))}
                                 onKeyDown={handleInputKeyDown}
                               />
                             </div>
                           </td>

                           {/* Valor parcial/ animal - CENTER ALIGNED! */}
                           <td style={colStyles[6]} className="p-3 text-center font-mono text-sm text-[#3d5a45] font-bold whitespace-nowrap align-middle">
                             {valorParcialAnimal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                           </td>

                           {/* Parcial Total - CENTER ALIGNED! */}
                           <td style={colStyles[7]} className="p-3 text-center font-mono text-sm text-[#2d2a26] font-black whitespace-nowrap align-middle">
                             {parcialTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                           </td>

                           {/* Excluir linha */}
                           <td style={colStyles[8]} className="p-3 text-center align-middle">
                             <button 
                               onClick={() => handleDeleteRow(row.id)}
                               className="p-1 px-1.5 text-[#8d8a86] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mx-auto block"
                               title="Deletar linha"
                             >
                               <Trash2 size={14} />
                             </button>
                           </td>
                         </motion.tr>
                       );
                     })}
                  </AnimatePresence>

                  {/* !!! AS REQUESTED: Pule sempre uma linha !!! */}
                  <tr className="bg-[#fefdfc] border-b border-[#e5e0d8]">
                    <td style={{ ...colStyles[0], height: '40px' }} />
                    <td style={{ ...colStyles[1], height: '40px' }} />
                    <td style={{ ...colStyles[2], height: '40px' }} />
                    <td style={{ ...colStyles[3], height: '40px' }} />
                    <td style={{ ...colStyles[4], height: '40px' }} />
                    <td style={{ ...colStyles[5], height: '40px' }} />
                    <td style={{ ...colStyles[6], height: '40px' }} />
                    <td style={{ ...colStyles[7], height: '40px' }} />
                    <td style={{ ...colStyles[8], height: '40px' }} />
                  </tr>

                  {/* !!! AS REQUESTED: Totais Row in order: 
                     "Quantidade total, peso total, divisão por 15, valor da arroba, total por unidade e total por quantidade" 
                  !!! */}
                  <tr className="bg-[#fcfaf7] font-black border-t-2 border-[#e5e0d8]">
                    {/* Quantidade total */}
                    <td style={colStyles[0]} className="p-4 px-2 text-center">
                      <div className="text-[9px] uppercase font-bold text-[#8d8a86] tracking-wider mb-1">Qtd Total</div>
                      <span className="text-xs font-black text-[#3d5a45] block whitespace-nowrap">
                        {totals.qTotal} <span className="text-[10px] font-medium text-[#8d8a86]">cab.</span>
                      </span>
                    </td>

                    {/* Peso total sum */}
                    <td style={colStyles[1]} className="p-4 px-2 text-center">
                      <div className="text-[9px] uppercase font-bold text-[#8d8a86] tracking-wider mb-1">Peso Total</div>
                      <span className="text-xs font-black text-[#2d2a26] block whitespace-nowrap">
                        {totals.weightSum.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 5 })} kg
                      </span>
                    </td>

                    {/* Peso (kg)/ Animal (Average Weight per head) */}
                    <td style={colStyles[2]} className="p-4 text-center">
                      <div className="text-[9px] uppercase font-bold text-[#8d8a86] tracking-wider mb-1">Média kg/Animal</div>
                      <span className="text-xs font-black text-[#3d5a45] block whitespace-nowrap">
                        {totals.averageWeight.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 5 })} kg
                      </span>
                    </td>

                    {/* Divisão por 15 (Total @) */}
                    <td style={colStyles[3]} className="p-4 text-center">
                      <div className="text-[9px] uppercase font-bold text-[#8d8a86] tracking-wider mb-1">Divisão por 15</div>
                      <span className="text-xs font-black text-[#3d5a45] font-mono whitespace-nowrap block">
                        {totals.totalDivisionBy15.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 5 })} @
                      </span>
                    </td>

                    {/* Parcial de Arroba por Animal (Sum/Avg) */}
                    <td style={colStyles[4]} className="p-4 text-center">
                      <div className="text-[9px] uppercase font-bold text-[#8d8a86] tracking-wider mb-1">Média @/Animal</div>
                      <span className="text-xs font-black text-[#3d5a45] font-mono whitespace-nowrap block">
                        {totals.averageArrobas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 5 })} @
                      </span>
                    </td>

                    {/* Valor da Arroba (Weighted Price Average) */}
                    <td style={colStyles[5]} className="p-4 text-center">
                      <div className="text-[9px] uppercase font-bold text-[#8d8a86] tracking-wider mb-1">Valor da Arroba</div>
                      <span className="text-xs font-bold text-orange-600 font-mono whitespace-nowrap">
                        {totals.weightedArrobaValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                       </span>
                    </td>

                    {/* Valor parcial/ animal (Average Value per Head) - CENTER ALIGNED! */}
                    <td style={colStyles[6]} className="p-4 text-center">
                      <div className="text-[9px] uppercase font-bold text-[#8d8a86] tracking-wider mb-1">Valor parcial/ animal</div>
                      <span className="text-sm font-black text-[#3d5a45] font-mono whitespace-nowrap">
                        {totals.averageValuePerHead.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                      </span>
                    </td>

                    {/* Total por quantidade - CENTER ALIGNED! */}
                    <td style={colStyles[7]} className="p-4 text-center">
                      <div className="text-[9px] uppercase font-bold text-[#8d8a86] tracking-wider mb-1 text-orange-600">Total Geral</div>
                      <span className="text-base font-black text-[#2d2a26] font-mono bg-orange-100/30 px-3 py-1.5 rounded-xl border border-orange-200 whitespace-nowrap inline-block">
                        {totals.totalQuantityValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                      </span>
                    </td>

                    {/* Empty cell for column matching delete actions */}
                    <td style={colStyles[8]} className="p-4"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Quick action footer */}
            <div className="p-5 bg-[#fcfaf7] border-t border-[#e5e0d8] flex items-center justify-between">
              <button 
                onClick={handleAddRow}
                className="bg-white hover:bg-[#3d5a45]/5 text-[#3d5a45] border border-[#3d5a45]/20 hover:border-[#3d5a45] px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 hover:shadow-xs active:scale-95 transition-all"
              >
                <Plus size={14} /> Adicionar Nova Linha
              </button>
              
              <div className="text-[10px] text-[#8d8a86] uppercase font-bold flex items-center gap-1">
                <Sparkles size={12} className="text-orange-500 animate-spin" /> Digite diretamente nas celulas para recalcular
              </div>
            </div>
          </div>

          {/* Notes and description */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#fcfaf7] p-6 rounded-3xl border border-[#e5e0d8]">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase text-[#8d8a86]">Observações de Lote / Observações Gerais</label>
              <textarea 
                value={sheetNotes}
                onChange={(e) => setSheetNotes(e.target.value)}
                placeholder="Exemplo: Vacina aplicada, condições climáticas do dia, destino do lote..."
                className="w-full bg-white border border-[#e5e0d8] focus:border-[#3d5a45] focus:ring-1 focus:ring-[#3d5a45]/20 focus:outline-none p-4 rounded-2xl text-xs font-semibold leading-relaxed h-20"
              />
            </div>
            
            <div className="p-4 bg-white rounded-2xl border border-[#e5e0d8] space-y-3 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#3d5a45]">
                <TrendingUp size={16} /> Resumo Prático
              </div>
              <ul className="text-[11px] text-[#6d6a66] space-y-1.5 leading-snug font-medium list-disc list-inside">
                <li>O peso total em <strong>@ (Arroba)</strong> é a divisão do peso total por 15.</li>
                <li>A coluna <strong>Média @/Animal</strong> é obtida dividindo-se o total de @ pela quantidade de animais da linha/lote.</li>
                <li><strong>Total Geral</strong> é o resultado da multiplicação da Divisão por 15 pelo valor da arroba.</li>
                <li><strong>Valor parcial/ animal</strong> é calculado dividindo o Total Geral pela quantidade de animais (nas linhas e no rodapé) e depois dividindo por 2.</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white border border-[#e5e0d8] rounded-3xl p-4 px-6 shadow-xs">
            <button 
              onClick={() => setActiveTab('sheets')}
              className="text-[#6d6a66] hover:text-[#3d5a45] hover:bg-[#f5f2ed] border border-[#e5e0d8] rounded-xl px-4 py-2 font-black text-xs active:scale-95 transition-all"
            >
              ← Voltar para Minhas Planilhas
            </button>

            {activeSheetId && activeSheetId !== 'temp' && (
              <button 
                onClick={() => handleDeleteSheet(activeSheetId)}
                className="text-red-500 hover:bg-red-50 hover:text-red-650 border border-red-200 hover:border-red-300 rounded-xl px-4 py-2 font-black text-xs active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Excluir Planilha
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <AnimatePresence>
        {deletingSheetId && (
          <div className="fixed inset-0 bg-[#2d2a26]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-3xl border border-[#e5e0d8] shadow-xl p-6 max-w-sm w-full space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-red-500">
                <div className="p-3 bg-red-50 rounded-2xl border border-red-100">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 className="font-serif italic font-bold text-lg text-[#2d2a26]">Deletar Planilha</h3>
                  <p className="text-[10px] uppercase font-black tracking-wider text-red-500/80">Ação irreversível</p>
                </div>
              </div>

              <p className="text-xs text-[#6d6a66] leading-relaxed font-semibold">
                Deseja realmente deletar esta planilha? Todos os dados de pesagem salvos nela serão excluídos permanentemente.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingSheetId(null)}
                  className="px-4 py-2 text-xs font-black text-[#6d6a66] hover:bg-[#f5f2ed] border border-[#e5e0d8] rounded-xl active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteSheet}
                  className="px-4 py-2 text-xs font-black text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-sm active:scale-95 transition-all"
                >
                  Excluir Planilha
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
