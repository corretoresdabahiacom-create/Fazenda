/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Animal } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Scale, Plus, Calendar, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  animal: Animal;
  onUpdateAnimal: (updated: Animal) => Promise<void>;
  userRole?: string;
}

export default function WeightHistoryPanel({ animal, onUpdateAnimal, userRole }: Props) {
  const [newWeight, setNewWeight] = useState<string>('');
  const [newWeightDate, setNewWeightDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isSeeding, setIsSeeding] = useState(false);

  // Parse chronological chart data — sem histórico real, o gráfico fica
  // vazio (nunca inventamos pontos fictícios de peso).
  const chartData = useMemo(() => {
    if (animal.weightHistory && animal.weightHistory.length > 0) {
      return [...animal.weightHistory]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(h => ({
          formattedDate: format(new Date(h.date), 'dd/MM/yy'),
          peso: h.weight,
          rawDate: h.date
        }));
    }
    return [];
  }, [animal]);

  // Handle logging a new weight
  const handleAddWeighing = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightVal = parseFloat(newWeight);
    if (!weightVal || weightVal <= 0) {
      alert('Por favor, informe um peso válido em kg.');
      return;
    }

    if (userRole === 'user') {
      alert('Acesso Limitado: Você não tem permissão para alterar registros.');
      return;
    }

    let updatedHistory = animal.weightHistory ? [...animal.weightHistory] : [];

    // Push new point (nunca inventamos um ponto de partida fictício —
    // se for a primeira pesagem, ela simplesmente começa o histórico
    // sozinha).
    updatedHistory.push({
      date: newWeightDate,
      weight: weightVal
    });

    // Chronological order sorting
    updatedHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Update lot with latest weight as current avg weight
    const latestRecord = updatedHistory[updatedHistory.length - 1];

    const updatedAnimal: Animal = {
      ...animal,
      averageWeight: latestRecord.weight,
      weightHistory: updatedHistory
    };

    try {
      setIsSeeding(true);
      await onUpdateAnimal(updatedAnimal);
      setNewWeight('');
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar pesagem.');
    } finally {
      setIsSeeding(false);
    }
  };

  const hasNoHistory = chartData.length === 0;

  return (
    <div className="mt-4 p-4 border border-[#3d5a45]/20 bg-[#f9faf8] dark:bg-zinc-900/60 dark:border-zinc-800 rounded-2xl animate-fade-in space-y-4 legacy-light">
      <div className="flex justify-between items-center pb-2 border-b border-[#3d5a45]/10 dark:border-zinc-800">
        <h4 className="text-xs font-black uppercase text-[#3d5a45] dark:text-[#5fa875] tracking-wider flex items-center gap-1.5">
          <TrendingUp size={15} /> Evolução Histórica de Peso
        </h4>
      </div>

      {hasNoHistory ? (
        <p className="text-xs text-theme-secondary text-center py-8">
          Nenhuma pesagem registrada ainda — registre abaixo para começar o histórico.
        </p>
      ) : (
      <div className="h-44 w-full text-xs font-semibold pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-10" />
            <XAxis 
              dataKey="formattedDate" 
              tick={{ fill: '#888888', fontSize: 9 }} 
              axisLine={{ stroke: '#e5e7eb', className: 'dark:opacity-10' }}
            />
            <YAxis 
              tick={{ fill: '#888888', fontSize: 9 }} 
              axisLine={{ stroke: '#e5e7eb', className: 'dark:opacity-10' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                borderColor: '#3d5a45', 
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#1f2937'
              }}
              formatter={(value, name) => [`${value} kg`, 'Peso Médio']}
              labelFormatter={(label) => `Data: ${label}`}
            />
            <Line 
              type="monotone" 
              dataKey="peso" 
              stroke="#3d5a45" 
              strokeWidth={3} 
              activeDot={{ r: 6 }} 
              dot={{ r: 3, stroke: '#3d5a45', strokeWidth: 1, fill: '#fff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      )}

      {userRole !== 'user' && (
        <form onSubmit={handleAddWeighing} className="pt-2 border-t border-[#3d5a45]/10 dark:border-zinc-800 space-y-2">
          <span className="text-[9px] font-black uppercase text-[#8d8a86] tracking-wider block">Registrar Nova Pesagem (Nivelamento Balança)</span>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex-1 min-w-[120px] relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8d8a86]" size={14} />
              <input 
                type="date"
                required
                className="w-full pl-8 pr-2 py-1.5 bg-white dark:bg-zinc-800 border border-[#e5e0d8] dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3d5a45]/20 font-bold text-xs text-[#2d2a26] dark:text-zinc-100"
                value={newWeightDate}
                onChange={(e) => setNewWeightDate(e.target.value)}
              />
            </div>
            
            <div className="flex-1 min-w-[100px] relative">
              <Scale className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8d8a86]" size={14} />
              <input 
                type="number"
                step="0.1"
                required
                placeholder="Ex: 420 kg"
                className="w-full pl-8 pr-2 py-1.5 bg-white dark:bg-zinc-800 border border-[#e5e0d8] dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3d5a45]/20 font-bold text-xs text-[#2d2a26] dark:text-zinc-100"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
              />
            </div>

            <button 
              type="submit"
              disabled={isSeeding}
              className="btn-primary px-4 py-1.5 text-xs flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Plus size={14} /> Lançar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}