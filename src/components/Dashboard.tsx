/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { TrendingUp, Users, Beef, AlertCircle, MapPin, CloudSun, Scan, Clock, ChevronRight as ChevronRightIcon, Coins, Scale, Sparkles, RefreshCw } from 'lucide-react';
import { EmployeePayment, Expense, Animal, FarmTask, ExpenseType, FarmSettings, WeighingSheet, InventoryItem } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ObligationAlert } from '../utils/obligations';

interface DashboardProps {
  payments: EmployeePayment[];
  expenses: Expense[];
  animals: Animal[];
  tasks: FarmTask[];
  settings: FarmSettings;
  inventory: InventoryItem[];
  weighingSheets?: WeighingSheet[];
  onNavigate?: (view: any) => void;
  activeAlerts?: ObligationAlert[];
  onOpenObligations?: () => void;
  onToggleTaskCompletion?: (task: FarmTask) => Promise<void>;
}

export default function Dashboard({ 
  payments, 
  expenses, 
  animals, 
  tasks, 
  settings, 
  inventory = [],
  weighingSheets = [],
  onNavigate,
  activeAlerts,
  onOpenObligations,
  onToggleTaskCompletion
}: DashboardProps) {
  const totalExpenses = useMemo(() => {
    const expensesTotal = expenses.reduce((acc, curr) => acc + curr.value, 0);
    const paymentsTotal = payments.reduce((acc, curr) => acc + curr.totalValue, 0);
    return expensesTotal + paymentsTotal;
  }, [expenses, payments]);

  const totalAnimals = useMemo(() => {
    return animals.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [animals]);

  const pendingTasks = useMemo(() => {
    return tasks.filter(t => !t.completed).length;
  }, [tasks]);

  const expenseByCategory = useMemo(() => {
    const data: Record<string, number> = {};
    expenses.forEach(e => {
      if (!e) return;
      const categoryName = e.type || "Outras";
      data[categoryName] = (data[categoryName] || 0) + (e.value || 0);
    });
    // Add salaries as a category
    const salariesTotal = payments.reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
    if (salariesTotal > 0) data['Salários'] = salariesTotal;

    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [expenses, payments]);

  const monthlyEvolution = useMemo(() => {
    const data: Record<string, { despesas: number; pagamentos: number; total: number }> = {};
    
    expenses.forEach(e => {
      if (!e || !e.date) return;
      try {
        const d = new Date(e.date);
        if (isNaN(d.getTime())) return;
        const month = format(d, 'MMM', { locale: ptBR });
        if (!data[month]) data[month] = { despesas: 0, pagamentos: 0, total: 0 };
        data[month].despesas += e.value || 0;
        data[month].total += e.value || 0;
      } catch (err) {
        console.error("Error formatting expense date:", err);
      }
    });

    payments.forEach(p => {
      if (!p || !p.date) return;
      try {
        const d = new Date(p.date);
        if (isNaN(d.getTime())) return;
        const month = format(d, 'MMM', { locale: ptBR });
        if (!data[month]) data[month] = { despesas: 0, pagamentos: 0, total: 0 };
        data[month].pagamentos += p.totalValue || 0;
        data[month].total += p.totalValue || 0;
      } catch (err) {
        console.error("Error formatting payment date:", err);
      }
    });

    return Object.entries(data).map(([name, values]) => ({ name, ...values }));
  }, [expenses, payments]);

  // Intelligent Suggestion State
  const [suggestion, setSuggestion] = useState<{
    title: string;
    advice: string;
    priority: 'High' | 'Medium' | 'Low';
    category: string;
  } | null>(() => {
    const cached = localStorage.getItem('gestao_fazenda_ai_suggestion');
    return cached ? JSON.parse(cached) : null;
  });
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const fetchAISuggestion = useCallback(async (force = false) => {
    if (!force && suggestion) return;
    setLoadingSuggestion(true);
    setSuggestionError(null);
    try {
      const response = await fetch('/api/generate-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory, tasks })
      });
      if (!response.ok) {
        throw new Error(`Erro na API (${response.status})`);
      }
      const data = await response.json();
      setSuggestion(data);
      localStorage.setItem('gestao_fazenda_ai_suggestion', JSON.stringify(data));
    } catch (err: any) {
      console.error('Error generating AI technical advice:', err);
      setSuggestionError(err.message || 'Falha ao conectar ao servidor de IA.');
    } finally {
      setLoadingSuggestion(false);
    }
  }, [inventory, tasks, suggestion]);

  useEffect(() => {
    fetchAISuggestion();
  }, []);

  // Custo por Cabeça calculation (Operating cost per animal head)
  const costPerHeadMetrics = useMemo(() => {
    const activeAnimalsCount = animals.filter(a => !a.isSold).reduce((sum, a) => sum + (a.quantity || 0), 0);
    const totalExpenditures = totalExpenses;
    
    const overallCostPerHead = activeAnimalsCount > 0 ? (totalExpenditures / activeAnimalsCount) : 0;
    
    // Monthly operating cost per head calculation
    const today = new Date();
    const currentMonthPrefix = format(today, 'yyyy-MM');
    
    const curMonthExpenses = expenses
      .filter(e => e.date && e.date.startsWith(currentMonthPrefix))
      .reduce((sum, e) => sum + (e.value || 0), 0);
      
    const curMonthPayments = payments
      .filter(p => p.date && p.date.startsWith(currentMonthPrefix))
      .reduce((sum, p) => sum + (p.totalValue || 0), 0);
      
    const curMonthTotal = curMonthExpenses + curMonthPayments;
    const monthlyCostPerHead = activeAnimalsCount > 0 ? (curMonthTotal / activeAnimalsCount) : 0;
    
    return {
      activeAnimalsCount,
      overallCostPerHead,
      monthlyCostPerHead,
      curMonthTotal
    };
  }, [animals, expenses, payments, totalExpenses]);

  // Monthly Weight Gain Productivity calculation from chronological weighings
  const weightGainMetrics = useMemo(() => {
    let totalWeightedMonthlyGain = 0;
    let totalAnimalsWithHistory = 0;
    let hasRealHistory = false;

    // First scan individual animals/lots history
    animals.filter(a => !a.isSold).forEach(animal => {
      const history = animal.weightHistory || [];
      if (history.length > 1) {
        const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const first = sortedHistory[0];
        const last = sortedHistory[sortedHistory.length - 1];
        
        const weightDiff = last.weight - first.weight;
        const daysDiff = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff > 0) {
          const dailyGain = weightDiff / daysDiff; // kg/day
          const monthlyGain = dailyGain * 30.5; // kg/month
          
          totalWeightedMonthlyGain += monthlyGain * (animal.quantity || 1);
          totalAnimalsWithHistory += (animal.quantity || 1);
          hasRealHistory = true;
        }
      }
    });

    // Also look at custom WeighingSheets for cross validation or additions
    if (weighingSheets && weighingSheets.length > 1) {
      const sortedSheets = [...weighingSheets].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const firstSheet = sortedSheets[0];
      const lastSheet = sortedSheets[sortedSheets.length - 1];
      
      const firstAvgWeight = firstSheet.rows?.reduce((acc, r) => acc + (r.weight || 0), 0) / Math.max(1, firstSheet.rows?.reduce((acc, r) => acc + (r.quantity || 0), 0));
      const lastAvgWeight = lastSheet.rows?.reduce((acc, r) => acc + (r.weight || 0), 0) / Math.max(1, lastSheet.rows?.reduce((acc, r) => acc + (r.quantity || 0), 0));
      
      const sheetWeightDiff = lastAvgWeight - firstAvgWeight;
      const sheetDaysDiff = (new Date(lastSheet.date).getTime() - new Date(firstSheet.date).getTime()) / (1000 * 60 * 60 * 24);
      
      if (sheetDaysDiff > 0 && sheetWeightDiff > 0) {
        const sheetDailyGain = sheetWeightDiff / sheetDaysDiff;
        const sheetMonthlyGain = sheetDailyGain * 30.5;
        
        // If no animal individual history was populated, populate primarily with worksheet progress!
        if (!hasRealHistory) {
          totalWeightedMonthlyGain = sheetMonthlyGain * 100; // default representative base herd
          totalAnimalsWithHistory = 100;
          hasRealHistory = true;
        }
      }
    }

    let averageMonthlyGainKg = 0;
    if (totalAnimalsWithHistory > 0) {
      averageMonthlyGainKg = totalWeightedMonthlyGain / totalAnimalsWithHistory;
    } else {
      // High-validity farm average default simulation (14.5 kg / head / month representing 475g GMD)
      averageMonthlyGainKg = 14.8;
    }

    const averageMonthlyGainArrobas = averageMonthlyGainKg / 15;

    return {
      averageMonthlyGainKg,
      averageMonthlyGainArrobas,
      hasRealHistory,
      dailyGainGrams: (averageMonthlyGainKg / 30.5) * 1000
    };
  }, [animals, weighingSheets]);

  const COLORS = ['#3d5a45', '#5c8a67', '#8bb193', '#b8d8be', '#e2efe4', '#f0a500', '#cf7500', '#a13100'];

  return (
    <div className="space-y-8">
      {/* Farm Location Header */}
      <div className="bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-serif italic font-bold text-[#3d5a45] mb-2">{settings.farmName}</h2>
          <div className="flex items-center gap-4 text-[#6d6a66]">
            <div className="flex items-center gap-1.5 font-medium">
              <MapPin size={16} className="text-[#3d5a45]" />
              {settings.city || 'Cidade não informada'}
            </div>
          </div>
        </div>
        
        {/* Local Date/Time Header */}
        <div className="flex items-center gap-4 bg-[#fcfaf7] p-4 rounded-2xl border border-[#e5e0d8]">
          <div className="bg-white p-2.5 rounded-xl shadow-sm text-[#3d5a45]">
            <CloudSun size={24} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-[#8d8a86]">{new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}</div>
            <div className="text-sm font-bold text-[#3d5a45]">{new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</div>
          </div>
        </div>
      </div>

      {/* Sugestão Inteligente (AI Technical Advice) Card */}
      <div className="bg-[#fcfaf7] rounded-3xl border border-[#e5e0d8] p-6 shadow-xs relative overflow-hidden transition-all">
        {/* Subtle decorative background pattern elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#3d5a45]/5 rounded-bl-full -z-10" />
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3.5 rounded-2xl shrink-0 ${
              suggestion?.priority === 'High' ? 'bg-red-50 text-red-600' :
              suggestion?.priority === 'Medium' ? 'bg-amber-50 text-amber-600' :
              'bg-[#3d5a45]/10 text-[#3d5a45]'
            }`}>
              {loadingSuggestion ? (
                <RefreshCw size={24} className="animate-spin text-[#3d5a45]" />
              ) : (
                <Sparkles size={24} className="animate-pulse" />
              )}
            </div>
            
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] tracking-wider uppercase font-black px-2.5 py-1 rounded-full bg-[#3d5a45]/10 text-[#3d5a45]">
                  Sugestão Inteligente
                </span>
                {suggestion && (
                  <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    suggestion.priority === 'High' ? 'bg-red-100 text-red-800' :
                    suggestion.priority === 'Medium' ? 'bg-amber-100 text-amber-800' :
                    'bg-[#e2efe4] text-[#3d5a45]'
                  }`}>
                    Prioridade {suggestion.priority === 'High' ? 'Alta' : suggestion.priority === 'Medium' ? 'Média' : 'Baixa'}
                  </span>
                )}
                {suggestion?.category && (
                  <span className="text-[9px] uppercase bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                    {suggestion.category}
                  </span>
                )}
              </div>
              
              {loadingSuggestion ? (
                <div className="space-y-2 py-1">
                  <div className="h-4 bg-gray-200 rounded-md w-1/3 animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded-md w-full animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded-md w-3/4 animate-pulse" />
                </div>
              ) : suggestionError ? (
                <div>
                  <h4 className="font-bold text-[#2d2a26] text-sm">Não foi possível carregar o conselho</h4>
                  <p className="text-xs text-[#8d8a86] mt-1">Conecte-se à internet ou certifique-se de que a API está ativa. {suggestionError}</p>
                </div>
              ) : suggestion ? (
                <div>
                  <h4 className="font-bold text-[#2d2a26] text-base leading-tight">
                    {suggestion.title}
                  </h4>
                  <p className="text-xs text-[#5d5a56] mt-2 leading-relaxed whitespace-pre-line">
                    {suggestion.advice}
                  </p>
                </div>
              ) : (
                <div>
                  <h4 className="font-bold text-[#2d2a26] text-sm font-sans">Conselho diário ainda não gerado</h4>
                  <p className="text-xs text-[#8d8a86] mt-1">Clique em 'Gerar Conselho' para analisar o estoque e obter sugestões.</p>
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={() => fetchAISuggestion(true)}
            disabled={loadingSuggestion}
            className="text-xs font-bold text-[#3d5a45] hover:text-white border border-[#3d5a45]/20 hover:bg-[#3d5a45] shrink-0 py-2 px-4 rounded-full transition-all flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
            id="btn-refresh-suggestion"
          >
            <RefreshCw size={12} className={loadingSuggestion ? 'animate-spin' : ''} />
            {loadingSuggestion ? 'Gerando...' : 'Atualizar Conselho'}
          </button>
        </div>
      </div>

      {/* AI Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button 
          onClick={() => onNavigate?.('animals-scan')}
          className="flex items-center gap-4 bg-[#3d5a45] text-white p-6 rounded-3xl border border-[#3d5a45] shadow-sm hover:bg-[#2d4233] transition-all group"
        >
          <div className="bg-white/10 p-3 rounded-2xl group-hover:scale-110 transition-transform">
             <Scan size={24} />
          </div>
          <div className="text-left flex-1">
             <h3 className="font-bold">Animal Scan</h3>
             <p className="text-xs text-white/70">Identificação e contagem IA</p>
          </div>
          <ChevronRightIcon size={20} className="text-white/40 group-hover:translate-x-1 transition-transform" />
        </button>
        <button 
          onClick={() => onNavigate?.('pastures')}
          className="flex items-center gap-4 bg-white text-[#3d5a45] p-6 rounded-3xl border border-[#e5e0d8] shadow-sm hover:border-[#3d5a45] transition-all group"
        >
          <div className="bg-[#3d5a45]/5 p-3 rounded-2xl group-hover:scale-110 transition-transform">
             <Scan size={24} />
          </div>
          <div className="text-left flex-1">
             <h3 className="font-bold">Agro Scan</h3>
             <p className="text-xs text-[#6d6a66]">Análise agrostológica IA</p>
          </div>
          <ChevronRightIcon size={20} className="text-[#3d5a45]/20 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Dynamic Dashboard Obligations Alert Panel */}
      {activeAlerts && activeAlerts.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif italic font-bold text-lg text-[#3d5a45] flex items-center gap-2">
              <Clock size={18} className="text-[#3d5a45] animate-pulse" />
              Obrigações e Vencimentos Críticos
            </h3>
            <button 
              onClick={onOpenObligations}
              className="text-xs font-bold text-[#3d5a45] hover:underline flex items-center gap-1 bg-[#f5f2ed] hover:bg-[#e5e0d8] py-1.5 px-3 rounded-full transition-colors"
              id="dash-open-obligations-btn"
            >
              Ver todas ({activeAlerts.length}) <ChevronRightIcon size={12} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAlerts.slice(0, 4).map((alert) => {
              const isOverdue = alert.daysRemaining < 0;
              const isToday = alert.daysRemaining === 0;
              let bgStyle = "bg-[#fdfcfb] border-[#e5e0d8]";
              let textStyle = "text-[#6d6a66]";
              let alertBadge = "";

              if (isOverdue) {
                bgStyle = "bg-red-50/60 border-red-100 text-red-900";
                textStyle = "text-red-700 font-bold";
                alertBadge = `Atrasado ${Math.abs(alert.daysRemaining)}d!`;
              } else if (isToday) {
                bgStyle = "bg-amber-50 border-amber-200 text-amber-950";
                textStyle = "text-amber-800 font-bold";
                alertBadge = "Vence Hoje!";
              } else {
                alertBadge = `Faltam ${alert.daysRemaining}d`;
              }

              return (
                <div 
                  key={alert.id}
                  onClick={onOpenObligations}
                  className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer hover:shadow-xs hover:border-[#3d5a45]/30 transition-all gap-4 ${bgStyle}`}
                  title="Ver detalhes na Central"
                  id={`dash-alert-${alert.id}`}
                >
                  <div className="overflow-hidden min-w-0">
                    <h4 className="text-xs font-black truncate text-[#2d2a26]">{alert.title}</h4>
                    <p className="text-[10px] text-[#6d6a66] mt-0.5 truncate">{alert.description}</p>
                    <p className="text-[9px] text-[#8d8a86] font-mono mt-1 uppercase">Prazo: {alert.dueDate.split('-').reverse().join('/')}</p>
                  </div>
                  <span className={`text-[8px] uppercase font-black px-2 py-0.5 rounded-full bg-white border shrink-0 ${textStyle}`}>
                    {alertBadge}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <StatCard 
          title="Gasto Total" 
          value={`R$ ${totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          icon={<TrendingUp className="text-red-500" />}
          trend={`${expenses.length + payments.length} lançamentos` }
          onClick={() => onNavigate?.('expenses')}
        />
        <StatCard 
          title="Animais Totais" 
          value={totalAnimals.toString()} 
          icon={<Beef className="text-[#3d5a45]" />}
          trend={`${animals.length} lotes ativos`}
          onClick={() => onNavigate?.('animals')}
        />
        <StatCard 
          title="Custo por Cabeça" 
          value={`R$ ${costPerHeadMetrics.overallCostPerHead.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          icon={<Coins className="text-amber-600" />}
          trend={`Mês atual: R$ ${costPerHeadMetrics.monthlyCostPerHead.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          onClick={() => onNavigate?.('expenses')}
        />
        <StatCard 
          title="Ganho de Peso Mensal" 
          value={`+${weightGainMetrics.averageMonthlyGainKg.toFixed(1)} kg/cab`} 
          icon={<Scale className="text-emerald-600" />}
          trend={`GMD: ${weightGainMetrics.dailyGainGrams.toFixed(0)}g/dia • (${weightGainMetrics.hasRealHistory ? 'Real' : 'Projeção'})`}
          onClick={() => onNavigate?.('weighing')}
        />
        <StatCard 
          title="Tarefas Pendentes" 
          value={pendingTasks.toString()} 
          icon={<AlertCircle className="text-orange-500" />}
          trend="Ações agendadas"
          onClick={() => onNavigate?.('tasks')}
        />
        <StatCard 
          title="Funcionários" 
          value={payments.length.toString()} 
          icon={<Users className="text-blue-500" />}
          trend="Folha de pagamento"
          onClick={() => onNavigate?.('payments')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Charts */}
        <div className="bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-sm">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            Evolução Mensal (R$)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyEvolution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="despesas" fill="#5c8a67" radius={[4, 4, 0, 0]} name="Despesas" />
                <Bar dataKey="pagamentos" fill="#3d5a45" radius={[4, 4, 0, 0]} name="Pagamentos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-sm">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            Distribuição de Custos
          </h3>
          <div className="h-[300px] w-full flex flex-col sm:flex-row items-center gap-6">
            <div className="w-full sm:w-1/2 h-[200px] sm:h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expenseByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 space-y-2">
              {expenseByCategory.slice(0, 5).map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[#6d6a66] truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <span className="font-semibold">R$ {item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Tasks */}
      <div className="bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-sm">
        <h3 className="text-lg font-bold mb-4">Tarefas Próximas</h3>
        <div className="space-y-4">
          {tasks.slice(0, 3).map(task => (
            <div key={task.id} className="flex items-center justify-between p-4 bg-[#fcfaf7] rounded-2xl border border-[#ece7e0]">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-10 rounded-full ${
                  task.priority === 'High' ? 'bg-red-400' : task.priority === 'Medium' ? 'bg-orange-400' : 'bg-blue-400'
                }`} />
                <div>
                  <h4 className="font-semibold text-sm">{task.title}</h4>
                  <p className="text-xs text-[#8d8a86]">{format(new Date(task.dueDate), "dd 'de' MMMM", { locale: ptBR })}</p>
                </div>
              </div>
              <button 
                onClick={() => onToggleTaskCompletion?.(task)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer active:scale-95 transition-transform ${
                  task.completed ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-[#3d5a45] text-white hover:bg-[#2d4233]'
                }`}
              >
                {task.completed ? '✓ Concluída' : 'Marcar Concluída'}
              </button>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-center py-8 text-[#8d8a86] italic text-sm">Nenhuma tarefa agendada.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, onClick }: { title: string; value: string; icon: React.ReactNode; trend: string; onClick?: () => void }) {
  return (
    <div 
      onClick={onClick} 
      className={`bg-white p-6 rounded-3xl border border-[#e5e0d8] shadow-sm hover:shadow-md transition-all ${
        onClick ? 'cursor-pointer hover:border-[#3d5a45]/30 active:scale-[0.99]' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-[#fcfaf7] rounded-2xl">
          {icon}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium text-[#8d8a86] uppercase tracking-wider">{title}</h4>
        <div className="text-2xl font-bold mt-1">{value}</div>
        <p className="text-xs text-[#5c8a67] mt-2 font-medium">{trend}</p>
      </div>
    </div>
  );
}
