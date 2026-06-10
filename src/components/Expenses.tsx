/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, Search, Edit3, Trash2, Calendar, FileText, Banknote, Tag, X, 
  ArrowLeft, Clock, User, ShieldAlert, Check, TrendingUp, Info
} from 'lucide-react';
import { Expense, ExpenseType, FixedExpense } from '../types';
import { EXPENSE_TYPES } from '../constants';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useFirebase } from '../contexts/FirebaseContext';

interface Props {
  expenses: Expense[];
  onAdd: (expense: Expense) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function Expenses({ expenses, onAdd, onDelete }: Props) {
  const { settings, updateSettings, fixedExpenses, saveFixedExpense, deleteFixedExpense, animals } = useFirebase();
  const [activeTab, setActiveTab] = useState<'variaveis' | 'fixas'>('variaveis');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFixedFormOpen, setIsFixedFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingFixed, setEditingFixed] = useState<FixedExpense | null>(null);

  // Custom Expense Type state
  const [isAddingCustomType, setIsAddingCustomType] = useState(false);
  const [newCustomType, setNewCustomType] = useState('');

  // Form states
  const [formData, setFormData] = useState<Partial<Expense>>({
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    type: ExpenseType.OTHER,
    description: '',
    provider: '',
    value: 0,
    observation: ''
  });

  const [fixedFormData, setFixedFormData] = useState<Partial<FixedExpense>>({
    description: '',
    dueDate: '5', // day of month (e.g. 5)
    value: 0,
    expenseType: 'Energia',
  });

  // Expand standard types with database custom ones
  const customTypes = settings.customExpenseTypes || [];
  const allExpenseTypes = [...EXPENSE_TYPES, ...customTypes];

  // Filters
  const filteredExpenses = expenses.filter(e => 
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.provider || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFixed = fixedExpenses.filter(f =>
    f.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.expenseType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculations
  const totalActiveHeads = animals
    .filter(a => !a.isSold)
    .reduce((sum, a) => sum + (a.quantity || 0), 0);

  const totalFixedExpensesCurrentMonth = fixedExpenses.reduce((sum, f) => sum + (f.value || 0), 0);
  const fixedCostPerHead = totalActiveHeads > 0 ? (totalFixedExpensesCurrentMonth / totalActiveHeads) : 0;

  // Handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newExpense: Expense = {
      id: editingExpense?.id || Date.now().toString(),
      date: formData.date || new Date().toISOString().split('T')[0],
      dueDate: formData.dueDate,
      type: formData.type as any,
      description: formData.description || '',
      provider: formData.provider,
      value: formData.value || 0,
      observation: formData.observation
    };

    await onAdd(newExpense);
    setIsFormOpen(false);
    setEditingExpense(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      dueDate: '',
      type: ExpenseType.OTHER,
      description: '',
      provider: '',
      value: 0,
      observation: ''
    });
  };

  const handleFixedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newFixed: FixedExpense = {
      id: editingFixed?.id || Date.now().toString(),
      description: fixedFormData.description || '',
      dueDate: fixedFormData.dueDate || '5',
      value: fixedFormData.value || 0,
      expenseType: fixedFormData.expenseType || 'Energia'
    };

    await saveFixedExpense(newFixed);
    setIsFixedFormOpen(false);
    setEditingFixed(null);
    setFixedFormData({
      description: '',
      dueDate: '5',
      value: 0,
      expenseType: 'Energia'
    });
  };

  const handleCreateCustomType = async () => {
    if (!newCustomType.trim()) return;
    const cleanType = newCustomType.trim();
    if (allExpenseTypes.includes(cleanType)) {
      alert('Este tipo de despesa já existe!');
      return;
    }

    const updatedTypes = [...customTypes, cleanType];
    await updateSettings({
      ...settings,
      customExpenseTypes: updatedTypes
    });

    setFormData({ ...formData, type: cleanType as any });
    setNewCustomType('');
    setIsAddingCustomType(false);
  };

  const handleDeleteFixed = async (id: string) => {
    if (confirm('Deseja excluir esta despesa fixa?')) {
      await deleteFixedExpense(id);
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData(expense);
    setIsFormOpen(true);
  };

  const handleEditFixed = (fixed: FixedExpense) => {
    setEditingFixed(fixed);
    setFixedFormData(fixed);
    setIsFixedFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-[#e5e0d8] gap-4">
        <button 
          onClick={() => { setActiveTab('variaveis'); setSearchTerm(''); }}
          className={`pb-3 font-bold text-sm transition-all relative ${activeTab === 'variaveis' ? 'text-red-650 font-black text-[#2d2a26]' : 'text-[#8d8a86] hover:text-[#2d2a26]'}`}
        >
          🧾 Lançamentos de Despesas (Variáveis)
          {activeTab === 'variaveis' && <motion.div layoutId="expense_tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />}
        </button>
        <button 
          onClick={() => { setActiveTab('fixas'); setSearchTerm(''); }}
          className={`pb-3 font-bold text-sm transition-all relative ${activeTab === 'fixas' ? 'text-red-650 font-black text-[#2d2a26]' : 'text-[#8d8a86] hover:text-[#2d2a26]'}`}
        >
          📌 Custos & Despesas Fixas da Fazenda
          {activeTab === 'fixas' && <motion.div layoutId="expense_tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />}
        </button>
      </div>

      {/* Header filter actions */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d8a86]" size={18} />
          <input 
            type="text" 
            placeholder={activeTab === 'variaveis' ? "Pesquisar despesa..." : "Pesquisar custo fixo..."}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#e5e0d8] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-650/20 font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {activeTab === 'variaveis' ? (
          <button 
            onClick={() => {
              setEditingExpense(null);
              setIsFormOpen(true);
            }}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-sm animate-fade-in"
          >
            <Plus size={20} />
            Lançar Despesa
          </button>
        ) : (
          <button 
            onClick={() => {
              setEditingFixed(null);
              setIsFixedFormOpen(true);
            }}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-sm animate-fade-in"
          >
            <Plus size={20} />
            Adicionar Despesa Fixa
          </button>
        )}
      </div>

      {activeTab === 'fixas' && (
        /* Fixed Cost Proportional Cards Dashboard */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#fcfaf7] p-5 rounded-3xl border border-[#e5e0d8]">
          <div className="bg-white p-5 rounded-2xl border border-[#e5e0d8] flex items-center gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <Banknote size={24} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#8d8a86] uppercase block">Custo Fixo Total Mensal</span>
              <span className="text-xl font-black text-[#2d2a26]">R$ {totalFixedExpensesCurrentMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#e5e0d8] flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#8d8a86] uppercase block">Animais Ativos</span>
              <span className="text-xl font-black text-[#2d2a26]">{totalActiveHeads} cabeças</span>
            </div>
          </div>

          <div className="bg-[#3d5a45] text-white p-5 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-white/10 text-white rounded-xl">
              <Info size={24} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-white/80 uppercase block">Custo Fixo por Cabeça (Mês)</span>
              <span className="text-xl font-black">R$ {fixedCostPerHead.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / animal</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'variaveis' ? (
        /* Variable Expenses Table */
        <div className="bg-white rounded-3xl border border-[#e5e0d8] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#fcfaf7] border-bottom border-[#e5e0d8]">
                  <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86]">Lançamento</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86]">Vencimento</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86]">Tipo</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86]">Descrição</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86]">Fornecedor</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86]">Valor</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86] text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-[#fcfaf7] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-xs text-[#8d8a86]">
                        {format(new Date(e.date + 'T12:00:00'), 'dd/MM/yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`font-bold text-xs ${e.dueDate && new Date(e.dueDate) < new Date() ? 'text-orange-600' : 'text-[#3d5a45]'}`}>
                        {e.dueDate ? format(new Date(e.dueDate + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-[#f5f2ed] text-red-650">
                        {e.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 underline decoration-[#e5e0d8] underline-offset-4 decoration-dotted">
                      <div className="font-medium text-[#2d2a26] text-sm">{e.description}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#3d5a45] text-xs uppercase tracking-tight">{e.provider || '-'}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-red-600">
                      R$ {e.value.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEditExpense(e)} className="p-2 hover:bg-[#f5f2ed] rounded-lg transition-colors text-[#6d6a66]">
                          <Edit3 size={18} />
                        </button>
                        <button onClick={() => onDelete(e.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-400">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-[#8d8a86] italic text-sm">
                      Nenhuma despesa operacional cadastrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Fixed Expenses list */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredFixed.map((f) => (
            <div key={f.id} className="bg-white p-6 rounded-3xl border border-[#e5e0d8] space-y-4 hover:border-red-200 transition-colors relative shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <span className="px-3 py-0.5 bg-red-50 text-red-700 text-[10px] font-bold rounded-full uppercase block w-fit mb-1 border border-red-100">{f.expenseType}</span>
                  <h4 className="text-base font-black text-[#2d2a26]">{f.description}</h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#8d8a86] font-bold uppercase block">Valor Mensal</span>
                  <span className="text-lg font-black text-red-600">R$ {f.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#f0f0f0] flex justify-between items-center text-xs text-[#6d6a66] font-bold">
                <span className="flex items-center gap-1"><Clock size={14} className="text-red-500" /> Dia Vencimento: {f.dueDate}</span>
                <span className="bg-[#fcfaf7] px-2 py-1 rounded text-[10px] text-[#3d5a45] font-extrabold uppercase border border-[#e5e0d8]">Suporta R$ {(totalActiveHeads > 0 ? f.value / totalActiveHeads : 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}/animal</span>
              </div>

              <div className="absolute bottom-4 right-4 flex gap-1.5 opacity-80 hover:opacity-100">
                <button onClick={() => handleEditFixed(f)} className="p-2 hover:bg-[#f5f2ed] text-[#6d6a66] rounded-xl transition-colors">
                  <Edit3 size={16} />
                </button>
                <button onClick={() => handleDeleteFixed(f.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {filteredFixed.length === 0 && (
            <div className="col-span-2 text-center py-12 text-[#8d8a86] italic text-sm">
              Nenhuma despesa fixa cadastrada ainda. Adicione itens como Energia, Arrendamento ou salários fixos.
            </div>
          )}
        </div>
      )}

      {/* --- FORM MODALS --- */}

      {/* 1. Variable Expense Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-[#e5e0d8] flex items-center justify-between bg-[#fcfaf7]">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { setIsFormOpen(false); setEditingExpense(null); }}
                  className="p-2 -ml-2 text-[#6d6a66] hover:text-red-600 hover:bg-[#f5f2ed] rounded-full transition-colors"
                  title="Voltar"
                >
                  <ArrowLeft size={18} />
                </button>
                <h3 className="text-base font-bold flex items-center gap-2 text-red-600">
                  <FileText size={18} />
                  {editingExpense ? 'Editar Despesa Lançada' : 'Lançar Nova Despesa'}
                </h3>
              </div>
              <button 
                onClick={() => { setIsFormOpen(false); setEditingExpense(null); }}
                className="p-1.5 hover:bg-[#e5e0d8] rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Tipo de Despesa</label>
                  {!isAddingCustomType ? (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d8a86]" size={16} />
                        <select 
                          className="w-full pl-10 pr-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-red-500/20 focus:outline-none appearance-none bg-white font-bold"
                          value={formData.type}
                          onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                        >
                          {allExpenseTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setIsAddingCustomType(true)}
                        className="px-3.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold rounded-xl text-xs transition-colors"
                      >
                        + Novo Tipo
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 bg-red-50/50 p-4 border border-red-200 rounded-xl animate-fade-in">
                      <div className="flex-1">
                        <input 
                          type="text" 
                          placeholder="Ex: Energia, Ferramenta..." 
                          className="w-full px-3 py-1.5 border border-[#e5e0d8] rounded-lg bg-white text-sm"
                          value={newCustomType}
                          onChange={(e) => setNewCustomType(e.target.value)}
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={handleCreateCustomType}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700"
                      >
                        Salvar
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIsAddingCustomType(false)}
                        className="px-2 py-1.5 bg-gray-100 text-[#6d6a66] border rounded-lg text-xs"
                      >
                        Voltar
                      </button>
                    </div>
                  )}
                </div>

                <div className="col-span-1">
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Data Lançamento</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d8a86]" size={16} />
                    <input 
                      required
                      type="date" 
                      className="w-full pl-10 pr-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="col-span-1">
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Vencimento</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d8a86]" size={16} />
                    <input 
                      type="date" 
                      className="w-full pl-10 pr-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                      value={formData.dueDate || ''}
                      onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                    />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Descrição do Lançamento</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Ex: Nota fiscal Nº 453"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Vendedor ou Fornecedor</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                    value={formData.provider || ''}
                    onChange={(e) => setFormData({...formData, provider: e.target.value})}
                    placeholder="Nome da empresa ou revenda..."
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Valor Gasto (R$)</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-red-500/20 focus:outline-none font-bold text-red-600 text-base"
                    value={formData.value || ''}
                    onChange={(e) => setFormData({...formData, value: Number(e.target.value)})}
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Observações adicionais</label>
                  <textarea 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-red-500/20 focus:outline-none text-sm min-h-[70px]"
                    value={formData.observation || ''}
                    onChange={(e) => setFormData({...formData, observation: e.target.value})}
                    placeholder="Qualquer detalhe extra..."
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
                  className="flex-1 px-6 py-2.5 rounded-xl bg-red-600 font-bold text-white hover:bg-red-700 transition-colors shadow-md"
                >
                  Salvar Despesa
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 2. Fixed Expense Form Modal */}
      {isFixedFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-[#e5e0d8] flex items-center justify-between bg-[#fcfaf7]">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsFixedFormOpen(false)}
                  className="p-2 -ml-2 text-[#6d6a66] hover:text-red-600 hover:bg-[#f5f2ed] rounded-full transition-colors"
                  title="Voltar"
                >
                  <ArrowLeft size={18} />
                </button>
                <h3 className="text-base font-bold flex items-center gap-2 text-red-600">
                  <Tag size={18} />
                  {editingFixed ? 'Editar Despesa Fixa' : 'Cadastrar Custo Fixo da Fazenda'}
                </h3>
              </div>
              <button 
                onClick={() => setIsFixedFormOpen(false)}
                className="p-1.5 hover:bg-[#e5e0d8] rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFixedSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Nome do Custo Fixo (Descrição)</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-red-500/25 focus:outline-none"
                  value={fixedFormData.description || ''}
                  onChange={(e) => setFixedFormData({...fixedFormData, description: e.target.value})}
                  placeholder="Ex: Arrendamento da Sede, Energia Elétrica Cemig, Pro-Labore..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Categoria</label>
                  <select 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-red-500/25 focus:outline-none bg-white font-medium"
                    value={fixedFormData.expenseType}
                    onChange={(e) => setFixedFormData({...fixedFormData, expenseType: e.target.value})}
                  >
                    <option value="Energia">⚡ Energia</option>
                    <option value="Internet">🌐 Internet/Comunicação</option>
                    <option value="Pro-Labore">💼 Pró-labore</option>
                    <option value="Arrendamento">🌾 Arrendamento de Terra</option>
                    <option value="Seguros">🛡️ Seguros</option>
                    <option value="Taxas">📉 Taxas & Impostos</option>
                    <option value="Manutencao_Fixa">🔧 Manutenção Sistemática</option>
                    <option value="Outros">📌 Outros</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Dia de Vencimento (Fixo)</label>
                  <input 
                    required
                    type="number" 
                    min="1" 
                    max="31" 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-red-500/25 focus:outline-none"
                    value={fixedFormData.dueDate || ''}
                    onChange={(e) => setFixedFormData({...fixedFormData, dueDate: e.target.value})}
                    placeholder="Ex: 10"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Valor Mensal (R$)</label>
                <input 
                  required
                  type="number" 
                  step="0.01" 
                  className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-red-500/25 focus:outline-none font-bold text-red-600 text-lg"
                  value={fixedFormData.value || ''}
                  onChange={(e) => setFixedFormData({...fixedFormData, value: Number(e.target.value)})}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsFixedFormOpen(false)}
                  className="flex-1 px-6 py-2.5 rounded-xl border border-[#e5e0d8] font-bold text-[#6d6a66] hover:bg-[#fcfaf7] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-2.5 rounded-xl bg-red-600 font-bold text-white hover:bg-red-700 transition-colors shadow-md"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
