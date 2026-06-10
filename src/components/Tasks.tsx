/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, CheckCircle2, Circle, Clock, Trash2, Calendar, AlertCircle, X, 
  ArrowLeft, UserCheck, MapPin, Tag, ShieldCheck, Flag, Edit3
} from 'lucide-react';
import { FarmTask } from '../types';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useFirebase } from '../contexts/FirebaseContext';

interface Props {
  tasks: FarmTask[];
  onSave: (task: FarmTask) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function Tasks({ tasks, onSave, onDelete }: Props) {
  const { employees } = useFirebase();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<FarmTask | null>(null);

  const [formData, setFormData] = useState<Partial<FarmTask>>({
    title: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    priority: 'Medium',
    completed: false,
    assignedTo: '',
    executionLocation: ''
  });

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      await onSave({ ...task, completed: !task.completed });
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (confirm('Deseja realmente excluir esta tarefa?')) {
      await onDelete(id);
    }
  };

  const handleEditTask = (task: FarmTask) => {
    setEditingTask(task);
    setFormData(task);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newTask: FarmTask = {
      id: editingTask?.id || Date.now().toString(),
      title: formData.title || '',
      description: formData.description || '',
      dueDate: formData.dueDate || new Date().toISOString().split('T')[0],
      priority: formData.priority || 'Medium',
      completed: formData.completed || false,
      assignedTo: formData.assignedTo || undefined,
      executionLocation: formData.executionLocation || undefined
    };

    await onSave(newTask);
    setIsFormOpen(false);
    setEditingTask(null);
    setFormData({ 
      title: '', 
      description: '', 
      dueDate: new Date().toISOString().split('T')[0], 
      priority: 'Medium',
      completed: false,
      assignedTo: '',
      executionLocation: ''
    });
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-[#2d2a26]">Painel de Tarefas Fazenda</h2>
          <p className="text-sm text-[#8d8a86]">Acompanhe o que precisa ser feito pelo pessoal.</p>
        </div>
        <button 
          onClick={() => {
            setEditingTask(null);
            setFormData({
              title: '',
              description: '',
              dueDate: new Date().toISOString().split('T')[0],
              priority: 'Medium',
              completed: false,
              assignedTo: '',
              executionLocation: ''
            });
            setIsFormOpen(true);
          }}
          className="flex items-center gap-2 bg-[#3d5a45] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#2d4233] transition-colors shadow-sm text-sm"
        >
          <Plus size={18} />
          Criar Nova Tarefa
        </button>
      </div>

      <div className="space-y-4">
        {sortedTasks.map((task) => {
          const taskDate = new Date(task.dueDate + 'T12:00:00');
          const isOverdue = !task.completed && isPast(taskDate) && !isToday(taskDate);
          
          return (
            <motion.div 
              key={task.id}
              layout
              className={`bg-white p-5 rounded-3xl border transition-all flex items-start gap-4 hover:border-[#3d5a45]/30 group relative ${
                task.completed ? 'opacity-55 border-transparent shadow-none bg-neutral-50/50' : 'border-[#e5e0d8] shadow-sm'
              }`}
            >
              <button 
                onClick={() => toggleTask(task.id)}
                className={`mt-1.5 transition-colors ${task.completed ? 'text-green-600' : 'text-[#8d8a86] hover:text-[#3d5a45]'}`}
              >
                {task.completed ? <CheckCircle2 size={24} className="stroke-2" /> : <Circle size={24} className="stroke-2" />}
              </button>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className={`font-black text-base ${task.completed ? 'line-through text-neutral-500' : 'text-[#2d2a26]'}`}>
                    {task.title}
                  </h3>
                  <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      task.priority === 'High' ? 'bg-red-50 text-red-600 border border-red-100' : 
                      task.priority === 'Medium' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 
                      'bg-blue-50 text-blue-600 border border-blue-100'
                    }`}>
                      Prioridade: {task.priority}
                    </span>
                    <button onClick={() => handleEditTask(task)} className="p-1 hover:bg-[#f5f2ed] rounded-lg text-[#6d6a66]">
                      <Edit3 size={15} />
                    </button>
                    <button onClick={() => handleDeleteTask(task.id)} className="p-1 hover:bg-red-50 text-red-500 rounded-lg">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                
                <p className={`text-sm mb-3.5 leading-relaxed font-medium ${task.completed ? 'text-neutral-400 font-normal line-through' : 'text-[#64615d]'}`}>
                  {task.description}
                </p>

                {/* Highly finished assignee, location, deadline details block */}
                <div className="flex flex-wrap gap-4 items-center text-xs font-bold uppercase text-[#8d8a86] tracking-wider pt-2.5 border-t border-[#fcfaf7]">
                  <div className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-500' : 'text-[#3d5a45]'}`}>
                    <Calendar size={14} />
                    Prazo: {format(taskDate, "dd 'de' MMMM", { locale: ptBR })}
                  </div>

                  {task.assignedTo && (
                    <div className="flex items-center gap-1.5 text-slate-800 bg-neutral-100/70 px-2.5 py-0.5 rounded-full border border-neutral-200">
                      <UserCheck size={13} className="text-[#3d5a45]" />
                      Designado: <span className="font-extrabold">{task.assignedTo}</span>
                    </div>
                  )}

                  {task.executionLocation && (
                    <div className="flex items-center gap-1.5 text-neutral-800 bg-neutral-100/70 px-2.5 py-0.5 rounded-full border border-neutral-200">
                      <MapPin size={13} className="text-[#3d5a45]" />
                      Local: <span className="font-extrabold">{task.executionLocation}</span>
                    </div>
                  )}

                  {isOverdue && (
                    <div className="flex items-center gap-1.5 text-red-500">
                      <AlertCircle size={14} />
                      Atrasada
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {tasks.length === 0 && (
          <div className="text-center py-20 bg-[#fcfaf7] border-2 border-dashed border-[#e5e0d8] rounded-3xl">
            <Clock size={48} className="mx-auto mb-4 text-[#e5e0d8]" />
            <p className="text-[#8d8a86] font-bold">Nenhuma tarefa agendada. Tudo em dia por aqui!</p>
          </div>
        )}
      </div>

      {/* Task form modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-[#e5e0d8] bg-[#fcfaf7] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { setIsFormOpen(false); setEditingTask(null); }}
                  className="p-2 -ml-2 text-[#8d8a86] hover:text-[#3d5a45] hover:bg-[#e5e0d8] rounded-full transition-colors md:hidden"
                  title="Voltar"
                >
                  <ArrowLeft size={18} />
                </button>
                <h3 className="text-base font-black text-[#3d5a45] flex items-center gap-2">
                  <Flag size={18} />
                  {editingTask ? 'Editar Detalhes da Tarefa' : 'Criar Nova Tarefa'}
                </h3>
              </div>
              <button 
                onClick={() => { setIsFormOpen(false); setEditingTask(null); }}
                className="p-1.5 hover:bg-[#e5e0d8] rounded-full transition-colors"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Título da Atividade</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-bold"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Ex: Vacinar gado do Pasto 03..."
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Descrição do Trabalho</label>
                <textarea 
                  required
                  className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none text-sm min-h-[70px]"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Instruções claras..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Prazo Final (Limite)</label>
                  <input 
                    required
                    type="date" 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none text-sm font-bold text-[#3d5a45]"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Prioridade</label>
                  <select 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none bg-white font-medium"
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                  >
                    <option value="Low">Baixa</option>
                    <option value="Medium">Média</option>
                    <option value="High">Alta</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#f2ece4]">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#8d8a86] mb-1 block">Designar Colaborador</label>
                  {employees && employees.length > 0 ? (
                    <select 
                      className="w-full px-3 py-1.5 border border-[#e5e0d8] rounded-xl text-xs bg-white font-semibold text-slate-800 focus:outline-none"
                      value={formData.assignedTo || ''}
                      onChange={(e) => setFormData({...formData, assignedTo: e.target.value})}
                    >
                      <option value="">Selecione...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.name}>{emp.name} ({emp.role})</option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      className="w-full px-3 py-1.5 border border-[#e5e0d8] rounded-xl text-xs"
                      value={formData.assignedTo || ''}
                      onChange={(e) => setFormData({...formData, assignedTo: e.target.value})}
                      placeholder="Nome do executor..."
                    />
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[#8d8a86] mb-1 block">Local para Execução</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-1.5 border border-[#e5e0d8] rounded-xl text-xs font-semibold focus:outline-none"
                    value={formData.executionLocation || ''}
                    onChange={(e) => setFormData({...formData, executionLocation: e.target.value})}
                    placeholder="Ex: Pasto 02, Curral, Sede..."
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
                  Salvar Tarefa
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
