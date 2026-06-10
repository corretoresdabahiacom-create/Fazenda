/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, Search, Edit3, Trash2, Calendar, User, Briefcase, Banknote, X, 
  ArrowLeft, Clock, ShieldAlert, BadgeInfo, CheckCircle, HelpCircle, UserX, AlertTriangle, FileText
} from 'lucide-react';
import { EmployeePayment, PaymentType, EmployeeRole, Employee } from '../types';
import { EMPLOYEE_ROLES, PAYMENT_TYPES } from '../constants';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useFirebase } from '../contexts/FirebaseContext';

interface Props {
  payments: EmployeePayment[];
  onAdd: (payment: EmployeePayment) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function EmployeePayments({ payments, onAdd, onDelete }: Props) {
  const { employees, saveEmployee, deleteEmployee } = useFirebase();
  const [activeTab, setActiveTab] = useState<'colaboradores' | 'pagamentos'>('colaboradores');
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<EmployeePayment | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Selected employee for detail view sheet
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Form states
  const [paymentFormData, setPaymentFormData] = useState<Partial<EmployeePayment>>({
    date: new Date().toISOString().split('T')[0],
    paymentType: PaymentType.SALARY,
    role: EmployeeRole.COWBOY,
  });

  const [employeeFormData, setEmployeeFormData] = useState<Partial<Employee>>({
    name: '',
    role: EmployeeRole.COWBOY,
    admissionDate: new Date().toISOString().split('T')[0],
    status: 'active',
    noticeDate: '',
    vacationDate: '',
  });

  // Filters & Calculations
  const filteredPayments = payments.filter(p => 
    p.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Submits
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalValue = paymentFormData.paymentType === PaymentType.DAILY 
      ? (paymentFormData.dailyQuantity || 0) * (paymentFormData.dailyValue || 0)
      : (paymentFormData.totalValue || 0);

    const newPayment: EmployeePayment = {
      id: editingPayment?.id || Date.now().toString(),
      employeeName: paymentFormData.employeeName || '',
      role: paymentFormData.role as EmployeeRole,
      paymentType: paymentFormData.paymentType as PaymentType,
      date: paymentFormData.date || new Date().toISOString().split('T')[0],
      dailyQuantity: paymentFormData.dailyQuantity,
      dailyValue: paymentFormData.dailyValue,
      totalValue: totalValue,
      observation: paymentFormData.observation,
    };

    await onAdd(newPayment);

    // Save check list to history of employee's own record as well!
    const matchingEmployee = employees.find(emp => emp.name === newPayment.employeeName);
    if (matchingEmployee) {
      const history = matchingEmployee.paymentHistory || [];
      const updatedHistory = [...history, { date: newPayment.date, type: newPayment.paymentType, value: newPayment.totalValue }];
      await saveEmployee({
        ...matchingEmployee,
        paymentHistory: updatedHistory,
      });
    }

    setIsPaymentFormOpen(false);
    setEditingPayment(null);
    setPaymentFormData({
      date: new Date().toISOString().split('T')[0],
      paymentType: PaymentType.SALARY,
      role: EmployeeRole.COWBOY,
    });
  };

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeFormData.name) return;

    // Build lists for history if modified
    let vacationHistory = editingEmployee?.vacationHistory || [];
    let noticeHistory = editingEmployee?.noticeHistory || [];

    // If change vacation date and it's new, we append to history
    if (employeeFormData.vacationDate && employeeFormData.vacationDate !== editingEmployee?.vacationDate) {
      // Just simulate holiday history
      vacationHistory = [...vacationHistory, { start: employeeFormData.vacationDate, end: '' }];
    }
    if (employeeFormData.noticeDate && employeeFormData.noticeDate !== editingEmployee?.noticeDate) {
      noticeHistory = [...noticeHistory, employeeFormData.noticeDate];
    }

    const newEmployee: Employee = {
      id: editingEmployee?.id || Date.now().toString(),
      name: employeeFormData.name,
      role: employeeFormData.role as EmployeeRole,
      admissionDate: employeeFormData.admissionDate || new Date().toISOString().split('T')[0],
      status: employeeFormData.status || 'active',
      noticeDate: employeeFormData.noticeDate || undefined,
      vacationDate: employeeFormData.vacationDate || undefined,
      vacationHistory,
      noticeHistory,
      paymentHistory: editingEmployee?.paymentHistory || [],
    };

    await saveEmployee(newEmployee);
    setIsEmployeeFormOpen(false);
    setEditingEmployee(null);
    setEmployeeFormData({
      name: '',
      role: EmployeeRole.COWBOY,
      admissionDate: new Date().toISOString().split('T')[0],
      status: 'active',
      noticeDate: '',
      vacationDate: '',
    });
  };

  const handleEditPayment = (payment: EmployeePayment) => {
    setEditingPayment(payment);
    setPaymentFormData(payment);
    setIsPaymentFormOpen(true);
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmployeeFormData(emp);
    setIsEmployeeFormOpen(true);
  };

  const handleDeletePayment = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este pagamento?')) {
      await onDelete(id);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este colaborador? Seus históricos de férias e aviso serão deletados.')) {
      await deleteEmployee(id);
      if (selectedEmployee?.id === id) {
        setSelectedEmployee(null);
      }
    }
  };

  const getStatusBadge = (status: Employee['status']) => {
    switch (status) {
      case 'active':
        return <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full font-bold text-[10px] uppercase border border-green-200">Ativo</span>;
      case 'notice':
        return <span className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full font-bold text-[10px] uppercase border border-orange-200">Aviso Prévio</span>;
      case 'vacation':
        return <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-bold text-[10px] uppercase border border-blue-200">Em Férias</span>;
      case 'inactive':
        return <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full font-bold text-[10px] uppercase border border-gray-200">Inativo</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Selectors */}
      <div className="flex border-b border-[#e5e0d8] gap-4">
        <button 
          onClick={() => { setActiveTab('colaboradores'); setSearchTerm(''); }}
          className={`pb-3 font-bold text-sm transition-all relative ${activeTab === 'colaboradores' ? 'text-[#3d5a45]' : 'text-[#8d8a86] hover:text-[#2d2a26]'}`}
        >
          📁 Cadastro de Colaboradores
          {activeTab === 'colaboradores' && <motion.div layoutId="employee_tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3d5a45]" />}
        </button>
        <button 
          onClick={() => { setActiveTab('pagamentos'); setSearchTerm(''); }}
          className={`pb-3 font-bold text-sm transition-all relative ${activeTab === 'pagamentos' ? 'text-[#3d5a45]' : 'text-[#8d8a86] hover:text-[#2d2a26]'}`}
        >
          💸 Lançamentos de Pagamento
          {activeTab === 'pagamentos' && <motion.div layoutId="employee_tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3d5a45]" />}
        </button>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d8a86]" size={18} />
          <input 
            type="text" 
            placeholder={activeTab === 'colaboradores' ? "Pesquisar por colaborador..." : "Pesquisar por pagamentos..."}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#e5e0d8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3d5a45]/20 font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {activeTab === 'colaboradores' ? (
          <button 
            onClick={() => {
              setEditingEmployee(null);
              setEmployeeFormData({
                name: '',
                role: EmployeeRole.COWBOY,
                admissionDate: new Date().toISOString().split('T')[0],
                status: 'active',
                noticeDate: '',
                vacationDate: '',
              });
              setIsEmployeeFormOpen(true);
            }}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#3d5a45] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#2d4233] transition-colors shadow-sm"
          >
            <Plus size={20} />
            Cadastrar Colaborador
          </button>
        ) : (
          <button 
            onClick={() => {
              setEditingPayment(null);
              setPaymentFormData({
                date: new Date().toISOString().split('T')[0],
                paymentType: PaymentType.SALARY,
                role: EmployeeRole.COWBOY,
                employeeName: employees.length > 0 ? employees[0].name : '',
              });
              setIsPaymentFormOpen(true);
            }}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#3d5a45] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#2d4233] transition-colors shadow-sm"
          >
            <Plus size={20} />
            Registrar Pagamento
          </button>
        )}
      </div>

      {activeTab === 'colaboradores' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee List Grid */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-3xl border border-[#e5e0d8] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#fcfaf7] border-b border-[#e5e0d8]">
                      <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86]">Nome / Função</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86]">Admissão</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86]">Status</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86] text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f0f0]">
                    {filteredEmployees.map((emp) => (
                      <tr 
                        key={emp.id} 
                        onClick={() => setSelectedEmployee(emp)}
                        className={`hover:bg-[#fcfaf7] transition-colors cursor-pointer ${selectedEmployee?.id === emp.id ? 'bg-[#fcfaf7] border-l-4 border-l-[#3d5a45]' : ''}`}
                      >
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-bold text-[#2d2a26] text-sm">{emp.name}</div>
                            <div className="text-xs text-[#8d8a86] font-medium uppercase">{emp.role}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-xs text-[#8d8a86]">
                            {emp.admissionDate ? format(new Date(emp.admissionDate + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(emp.status)}
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleEditEmployee(emp)} 
                              className="p-2 hover:bg-[#f5f2ed] rounded-lg transition-colors text-[#6d6a66]"
                              title="Editar Ficha"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteEmployee(emp.id)} 
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500"
                              title="Excluir Colaborador"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredEmployees.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-[#8d8a86] italic text-sm">
                          Nenhum colaborador cadastrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Details / History Column */}
          <div className="lg:col-span-1">
            {selectedEmployee ? (
              <div className="bg-white border border-[#e5e0d8] rounded-3xl p-6 space-y-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 h-2 w-full bg-[#3d5a45]"></div>
                
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-[#2d2a26]">{selectedEmployee.name}</h3>
                    <p className="text-xs text-[#8d8a86] font-semibold uppercase">{selectedEmployee.role}</p>
                  </div>
                  {getStatusBadge(selectedEmployee.status)}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#f0f0f0]">
                  <div>
                    <span className="text-[10px] font-bold text-[#8d8a86] uppercase block">Admissão</span>
                    <span className="font-medium text-sm text-[#2d2a26]">
                      {selectedEmployee.admissionDate ? format(new Date(selectedEmployee.admissionDate + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#8d8a86] uppercase block">Férias Agendada</span>
                    <span className="font-bold text-sm text-[#3d5a45]">
                      {selectedEmployee.vacationDate ? format(new Date(selectedEmployee.vacationDate + 'T12:00:00'), 'dd/MM/yyyy') : 'Sem previsão'}
                    </span>
                  </div>
                  {selectedEmployee.noticeDate && (
                    <div className="col-span-2 bg-orange-50 border border-orange-200 p-3 rounded-xl">
                      <span className="text-[10px] font-bold text-orange-800 uppercase block">Início Aviso Prévio</span>
                      <span className="font-bold text-sm text-orange-900">
                        {format(new Date(selectedEmployee.noticeDate + 'T12:00:00'), 'dd/MM/yyyy')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Sub History sections */}
                <div className="space-y-3.5 pt-4 border-t border-[#f0f0f0]">
                  <h4 className="text-xs font-bold uppercase text-[#8d8a86] flex items-center gap-1.5">
                    <Calendar size={14} className="text-[#3d5a45]" /> Histórico de Férias e Avisos
                  </h4>
                  <div className="text-xs space-y-1.5 max-h-32 overflow-y-auto pr-1 bg-[#fcfaf7] p-3 rounded-xl border border-[#e5e0d8]">
                    {selectedEmployee.vacationHistory && selectedEmployee.vacationHistory.length > 0 ? (
                      selectedEmployee.vacationHistory.map((vac, idx) => (
                        <div key={idx} className="flex justify-between text-[#6d6a66] font-medium border-b border-[#f0f0f0] pb-1 last:border-0 last:pb-0">
                          <span>🌴 Gozo de Férias:</span>
                          <span className="font-semibold text-blue-700">{format(new Date(vac.start + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-[#8d8a86] italic">Sem gozo de férias registrado.</div>
                    )}

                    {selectedEmployee.noticeHistory && selectedEmployee.noticeHistory.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[#e5e0d8] space-y-1">
                        {selectedEmployee.noticeHistory.map((not, idx) => (
                          <div key={idx} className="flex justify-between text-[#6d6a66] last:border-0 pb-1">
                            <span>⚠️ Notificação de Aviso:</span>
                            <span className="font-bold text-orange-700">{format(new Date(not + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment summary inside card */}
                <div className="space-y-3 pt-4 border-t border-[#f0f0f0]">
                  <h4 className="text-xs font-bold uppercase text-[#8d8a86] flex items-center gap-1.5">
                    <Banknote size={14} className="text-[#3d5a45]" /> Histórico de Pagamentos Recebidos
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {payments.filter(pay => pay.employeeName === selectedEmployee.name).length > 0 ? (
                      payments
                        .filter(pay => pay.employeeName === selectedEmployee.name)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((pay) => (
                          <div key={pay.id} className="flex justify-between items-center bg-[#fcfaf7] p-2.5 rounded-xl border border-[#e5e0d8] text-xs">
                            <div>
                              <div className="font-bold text-[#2d2a26]">{pay.paymentType}</div>
                              <div className="text-[#8d8a86]">{format(new Date(pay.date + 'T12:00:00'), 'dd/MM/yyyy')}</div>
                            </div>
                            <div className="font-bold text-[#3d5a45]">
                              R$ {pay.totalValue.toLocaleString()}
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-xs text-[#8d8a86] italic text-center py-4 bg-[#fcfaf7] rounded-xl border border-dashed border-[#e5e0d8]">
                        Nenhum pagamento efetuado para {selectedEmployee.name} ainda.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#fcfaf7] border border-dashed border-[#e5e0d8] rounded-3xl p-8 text-center text-[#8d8a86] italic text-sm">
                💡 Clique em um colaborador para visualizar o histórico completo de pagamentos, gozo de férias e notificações de aviso.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Payments Logs list */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#fcfaf7] border border-[#e5e0d8] p-5 rounded-2xl">
              <div className="text-xs text-[#8d8a86] uppercase font-bold tracking-wider mb-1">Mês Atual</div>
              <div className="text-2xl font-black text-[#3d5a45]">R$ {payments.reduce((acc, p) => acc + p.totalValue, 0).toLocaleString()}</div>
            </div>
            <div className="bg-[#fcfaf7] border border-[#e5e0d8] p-5 rounded-2xl">
              <div className="text-xs text-[#8d8a86] uppercase font-bold tracking-wider mb-1">Qtd. Diárias Pagas</div>
              <div className="text-2xl font-black text-blue-700">{payments.filter(p => p.paymentType === PaymentType.DAILY).length} diárias</div>
            </div>
            <div className="bg-[#fcfaf7] border border-[#e5e0d8] p-5 rounded-2xl">
              <div className="text-xs text-[#8d8a86] uppercase font-bold tracking-wider mb-1">Total Salários</div>
              <div className="text-2xl font-black text-[#6d6a66]">R$ {payments.filter(p => p.paymentType === PaymentType.SALARY).reduce((acc, p) => acc + p.totalValue, 0).toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#e5e0d8] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#fcfaf7] border-b border-[#e5e0d8]">
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86]">Data</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86]">Funcionário</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86]">Tipo</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86]">Valor</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#8d8a86] text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f0]">
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-[#fcfaf7] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-sm">
                          {format(new Date(p.date + 'T12:00:00'), 'dd/MM/yyyy')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-bold text-[#2d2a26] text-sm">{p.employeeName}</div>
                          <div className="text-xs text-[#8d8a86] font-semibold uppercase">{p.role}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                          p.paymentType === PaymentType.DAILY ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                        }`}>
                          {p.paymentType}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-extrabold text-[#3d5a45] text-sm">
                        R$ {p.totalValue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEditPayment(p)} className="p-2 hover:bg-[#f5f2ed] rounded-lg transition-colors text-[#6d6a66]">
                            <Edit3 size={17} />
                          </button>
                          <button onClick={() => handleDeletePayment(p.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500">
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-[#8d8a86] italic text-sm">
                        Nenhum pagamento efetuado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- FORM MODALS --- */}

      {/* 1. Employee Form Modal */}
      {isEmployeeFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-[#e5e0d8] flex items-center justify-between bg-[#fcfaf7]">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsEmployeeFormOpen(false)}
                  className="p-2 -ml-2 text-[#8d8a86] hover:text-[#3d5a45] hover:bg-[#f5f2ed] rounded-full transition-colors"
                  title="Voltar"
                >
                  <ArrowLeft size={18} />
                </button>
                <h3 className="text-base font-bold flex items-center gap-2 text-[#3d5a45]">
                  <Briefcase size={18} />
                  {editingEmployee ? 'Editar Ficha do Colaborador' : 'Novo Cadastro de Colaborador'}
                </h3>
              </div>
              <button 
                onClick={() => setIsEmployeeFormOpen(false)}
                className="p-1.5 hover:bg-[#e5e0d8] rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEmployeeSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Nome Completo</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/25 focus:outline-none"
                  value={employeeFormData.name || ''}
                  onChange={(e) => setEmployeeFormData({...employeeFormData, name: e.target.value})}
                  placeholder="Nome do colaborador..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Função / Cargo</label>
                  <select 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/25 focus:outline-none bg-white font-medium"
                    value={employeeFormData.role}
                    onChange={(e) => setEmployeeFormData({...employeeFormData, role: e.target.value as EmployeeRole})}
                  >
                    {EMPLOYEE_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Data de Admissão</label>
                  <input 
                    required
                    type="date" 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/25 focus:outline-none"
                    value={employeeFormData.admissionDate || ''}
                    onChange={(e) => setEmployeeFormData({...employeeFormData, admissionDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Status Atual</label>
                  <select 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/25 focus:outline-none bg-white font-medium"
                    value={employeeFormData.status}
                    onChange={(e) => setEmployeeFormData({...employeeFormData, status: e.target.value as Employee['status']})}
                  >
                    <option value="active">🟢 Ativo</option>
                    <option value="notice">🟠 Aviso Prévio</option>
                    <option value="vacation">🔵 Em Férias</option>
                    <option value="inactive">🔴 Inativo</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block text-blue-700">Previsão Férias (Gozo)</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/25 focus:outline-none"
                    value={employeeFormData.vacationDate || ''}
                    onChange={(e) => setEmployeeFormData({...employeeFormData, vacationDate: e.target.value})}
                  />
                </div>
              </div>

              {employeeFormData.status === 'notice' && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                  <label className="text-xs font-bold uppercase text-orange-850 mb-1 block">Data do Aviso Prévio</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2 border border-orange-300 rounded-xl focus:ring-2 focus:ring-orange-500/25 focus:outline-none bg-white"
                    value={employeeFormData.noticeDate || ''}
                    onChange={(e) => setEmployeeFormData({...employeeFormData, noticeDate: e.target.value})}
                  />
                  <p className="text-[10px] text-orange-700 mt-1.5 font-bold">⚠️ O histórico de aviso prévio será arquivado nesta ficha de colaborador.</p>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsEmployeeFormOpen(false)}
                  className="flex-1 px-6 py-2.5 rounded-xl border border-[#e5e0d8] font-bold text-[#6d6a66] hover:bg-[#fcfaf7] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-2.5 rounded-xl bg-[#3d5a45] font-bold text-white hover:bg-[#2d4233] transition-colors shadow-md"
                >
                  Salvar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 2. Payment Form Modal */}
      {isPaymentFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-[#e5e0d8] flex items-center justify-between bg-[#fcfaf7]">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsPaymentFormOpen(false)}
                  className="p-2 -ml-2 text-[#8d8a86] hover:text-[#3d5a45] hover:bg-[#f5f2ed] rounded-full transition-colors"
                  title="Voltar"
                >
                  <ArrowLeft size={18} />
                </button>
                <h3 className="text-base font-bold flex items-center gap-2 text-[#3d5a45]">
                  <Banknote size={18} />
                  {editingPayment ? 'Editar Lançamento de Pagamento' : 'Novo Lançamento de Pagamento'}
                </h3>
              </div>
              <button 
                onClick={() => setIsPaymentFormOpen(false)}
                className="p-1.5 hover:bg-[#e5e0d8] rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Colaborador</label>
                  {employees.length > 0 ? (
                    <select 
                      className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/25 focus:outline-none bg-white font-bold"
                      value={paymentFormData.employeeName}
                      onChange={(e) => {
                        const selectedEmp = employees.find(emp => emp.name === e.target.value);
                        setPaymentFormData({
                          ...paymentFormData,
                          employeeName: e.target.value,
                          role: selectedEmp ? selectedEmp.role : paymentFormData.role
                        });
                      }}
                    >
                      <option value="">Selecione um colaborador da lista...</option>
                      {employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name} ({emp.role})</option>)}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <input 
                        required
                        type="text" 
                        placeholder="Nome do funcionário..." 
                        className="w-full px-4 py-2 border border-red-300 rounded-xl focus:ring-2 focus:ring-red-300"
                        value={paymentFormData.employeeName || ''}
                        onChange={(e) => setPaymentFormData({...paymentFormData, employeeName: e.target.value})}
                      />
                      <p className="text-[10px] text-red-500 font-bold">⚠️ Cadastre primeiramente os Funcionários na primeira aba "Cadastro de Colaboradores" para sincronizar seus históricos automaticamente!</p>
                    </div>
                  )}
                </div>

                <div className="col-span-1">
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Data de Lançamento</label>
                  <input 
                    required
                    type="date" 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/25 focus:outline-none"
                    value={paymentFormData.date}
                    onChange={(e) => setPaymentFormData({...paymentFormData, date: e.target.value})}
                  />
                </div>

                <div className="col-span-1">
                  <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Tipo de Pagamento</label>
                  <select 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/25 focus:outline-none bg-white font-medium"
                    value={paymentFormData.paymentType}
                    onChange={(e) => setPaymentFormData({...paymentFormData, paymentType: e.target.value as PaymentType})}
                  >
                    {PAYMENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>

                {paymentFormData.paymentType === PaymentType.DAILY ? (
                  <>
                    <div className="col-span-1">
                      <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Qtd. Diárias</label>
                      <input 
                        type="number" 
                        step="1"
                        className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/25 focus:outline-none font-bold"
                        value={paymentFormData.dailyQuantity || ''}
                        onChange={(e) => setPaymentFormData({...paymentFormData, dailyQuantity: Number(e.target.value)})}
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Valor da Diária (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/25 focus:outline-none font-bold"
                        value={paymentFormData.dailyValue || ''}
                        onChange={(e) => setPaymentFormData({...paymentFormData, dailyValue: Number(e.target.value)})}
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="p-3 bg-[#fcfaf7] border border-[#e5e0d8] rounded-xl text-center">
                        <span className="text-[10px] font-bold text-[#8d8a86] uppercase block">Total Diária Calculado</span>
                        <span className="font-extrabold text-[#3d5a45] text-lg">R$ {((paymentFormData.dailyQuantity || 0) * (paymentFormData.dailyValue || 0)).toLocaleString()}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Valor Pago (R$)</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/25 focus:outline-none font-bold text-[#3d5a45]"
                      value={paymentFormData.totalValue || ''}
                      onChange={(e) => setPaymentFormData({...paymentFormData, totalValue: Number(e.target.value)})}
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <label className="text-[#8d8a86] text-xs font-bold uppercase mb-1 block">Observação</label>
                  <textarea 
                    className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/25 focus:outline-none text-sm min-h-[80px]"
                    placeholder="Ex: Pagamento referente a serviços de cerca em Maio..."
                    value={paymentFormData.observation || ''}
                    onChange={(e) => setPaymentFormData({...paymentFormData, observation: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsPaymentFormOpen(false)}
                  className="flex-1 px-6 py-2.5 rounded-xl border border-[#e5e0d8] font-bold text-[#6d6a66] hover:bg-[#fcfaf7] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-2.5 rounded-xl bg-[#3d5a45] font-bold text-white hover:bg-[#2d4233] transition-colors shadow-md"
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
