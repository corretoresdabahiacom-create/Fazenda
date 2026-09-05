/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Receipt, 
  Package, 
  Beef, 
  Map as MapIcon, 
  MapPin,
  CalendarCheck, 
  BarChart3,
  Menu,
  X,
  ArrowLeft,
  ChevronRight,
  LogOut,
  Settings,
  Bell,
  Scale,
  UserPlus,
  Sun,
  Moon,
  Leaf,
  LogIn
, Building2 , Stethoscope , Wheat , Wallet, Tractor, UserCog , FileText , Sparkles, CloudSun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  EmployeePayment, 
  Expense, 
  InventoryItem, 
  Animal, 
  Pasture, 
  FarmTask,
  TransactionHistory,
  FarmSettings
} from './types';

import ThemeToggle from './components/ThemeToggle';

// Utils
import { computeObligations, ObligationAlert } from './utils/obligations';

// Components
import Dashboard from './components/Dashboard';
import EmployeePayments from './components/EmployeePayments';
import Expenses from './components/Expenses';
import Inventory from './components/Inventory';
import Animals from './components/Animals';
import Pastures from './components/Pastures';
import Properties from './components/Properties';
import PecuariaProfissional from './components/PecuariaProfissional';
import Agricultura from './components/Agricultura';
import Financeiro from './components/Financeiro';
import Maquinas from './components/Maquinas';
import RHRural from './components/RHRural';
import Documentos from './components/Documentos';
import ConsultorRuralIA from './components/ConsultorRuralIA';
import Tasks from './components/Tasks';
import Reports from './components/Reports';
import FarmSettingsComp from './components/FarmSettings';
import FarmMap from './components/FarmMap';
import ObligationsDrawer from './components/ObligationsDrawer';
import WeighingWorksheet from './components/WeighingWorksheet';
import NutritionCalculator from './components/NutritionCalculator';
import { NotificationService } from './utils/notificationService';
import { useFirebase } from './contexts/FirebaseContext';

type View = 'dashboard' | 'payments' | 'expenses' | 'inventory' | 'animals' | 'pastures' | 'map' | 'tasks' | 'reports' | 'settings' | 'weighing' | 'nutrition';

export default function App() {
  const { 
    user, 
    userRole,
    loading, 
    isDemoMode,
    loginAsGuest,
    logoutAsGuest,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    sendPasswordReset,
    logout,
    animals, 
    pastures, 
    expenses, 
    payments, 
    tasks, 
    transactions, 
    inventory,
    fixedExpenses,
    settings,
    saveAnimal,
    deleteAnimal,
    savePasture,
    deletePasture,
    saveExpense,
    deleteExpense,
    savePayment,
    deletePayment,
    saveTask,
    deleteTask,
    saveTransaction,
    saveInventory,
    deleteInventory,
    updateSettings,
    weighingSheets,
    properties,
    activePropertyId,
    activeProperty,
    setActivePropertyId,
    saveProperty,
    deleteProperty,
    individualAnimals,
    saveIndividualAnimal,
    deleteIndividualAnimal,
    reproductionEvents,
    saveReproductionEvent,
    deleteReproductionEvent,
    healthEvents,
    saveHealthEvent,
    deleteHealthEvent,
    milkRecords,
    saveMilkRecord,
    deleteMilkRecord,
    talhoes,
    saveTalhao,
    deleteTalhao,
    cropPlans,
    saveCropPlan,
    deleteCropPlan,
    fieldLogEntries,
    saveFieldLogEntry,
    deleteFieldLogEntry,
    pestRecords,
    savePestRecord,
    deletePestRecord,
    irrigationRecords,
    saveIrrigationRecord,
    deleteIrrigationRecord,
    costCenters,
    saveCostCenter,
    deleteCostCenter,
    accountsPayable,
    saveAccountPayable,
    deleteAccountPayable,
    accountsReceivable,
    saveAccountReceivable,
    deleteAccountReceivable,
    machines,
    saveMachine,
    deleteMachine,
    maintenanceRecords,
    saveMaintenanceRecord,
    deleteMaintenanceRecord,
    teams,
    saveTeam,
    deleteTeam,
    workSchedules,
    saveWorkSchedule,
    deleteWorkSchedule,
    trainings,
    saveTraining,
    deleteTraining,
    ppeItems,
    savePPEItem,
    deletePPEItem,
    certifications,
    saveCertification,
    deleteCertification,
    documents,
    saveDocument,
    deleteDocument
  } = useFirebase();

  const [activeView, setActiveView] = useState<View>('dashboard');
  const [scanMode, setScanMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isObligationsOpen, setIsObligationsOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // Terms and Forgot Password States
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Calculate obligations and state
  const activeAlerts = computeObligations(tasks || [], expenses || [], fixedExpenses || [], settings || { farmName: '', city: '' });
  const activeAlertsCount = activeAlerts.length;
  const hasOverdue = activeAlerts.some(a => a.daysRemaining < 0);
  const overdueCount = activeAlerts.filter(a => a.daysRemaining < 0).length;
  const dueTodayCount = activeAlerts.filter(a => a.daysRemaining === 0).length;

  const handleMarkObligationConcluded = async (alert: ObligationAlert) => {
    if (alert.type === 'task') {
      await saveTask({ ...alert.originalItem, completed: true });
    } else if (alert.type === 'variable_expense') {
      await saveExpense({ ...alert.originalItem, status: 'paid' });
    } else if (alert.type === 'fixed_expense') {
      const key = alert.originalItem.monthKey;
      const currentConcluded = settings.concludedObligations || [];
      if (!currentConcluded.includes(key)) {
        await updateSettings({
          ...settings,
          concludedObligations: [...currentConcluded, key]
        });
      }
    }
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Trigger system push notification alerts
  useEffect(() => {
    if (activeAlerts.length > 0) {
      const timer = setTimeout(() => {
        NotificationService.checkAndAlert(activeAlerts);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [activeAlerts]);

  const handleViewChange = (view: View) => {
    setActiveView(view);
    setScanMode(false);
    if (isMobile) setIsSidebarOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#2d6a4f]/20 border-t-[#2d6a4f] rounded-full animate-spin" />
          <p className="text-[#2d6a4f] font-bold">Carregando Fazenda...</p>
        </div>
      </div>
    );
  }

  // Login Screen
  if (!user) {
    const handleGoogleLoginClick = async () => {
      if (!acceptedTerms) {
        setLoginError('Você deve aceitar os Termos e Condições de Uso para entrar com Google.');
        return;
      }
      if (isLoggingIn) return;
      setIsLoggingIn(true);
      setLoginError(null);
      try {
        await loginWithGoogle();
      } catch (error: any) {
        console.error("Google login failed", error);
        setLoginError(error.message || 'Houve um erro no login pelo Google. Verifique sua rede ou tente novamente.');
      } finally {
        setIsLoggingIn(false);
      }
    };

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-white p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl border border-gray-200 shadow-xl max-w-md w-full my-8"
        >
          <div className="w-20 h-20 bg-[#2d6a4f]/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Beef size={40} className="text-[#2d6a4f]" />
          </div>
          
          <h1 className="font-serif italic font-bold text-3xl text-[#2d6a4f] mb-2 text-center">
            {isRegistering ? 'Criar Nova Conta' : 'Fazenda Online'}
          </h1>
          <p className="text-gray-600 mb-6 text-sm text-center">
            {isRegistering 
              ? 'Cadastre o seu e-mail para ter um espaço exclusivo de gestão inteligente de rebanhos e finanças.'
              : 'Gestão inteligente de rebanho e finanças para o produtor rural moderno.'}
          </p>

          {loginError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl">
              <p className="font-bold mb-1">Aviso de Acesso:</p>
              <p>{loginError}</p>
            </div>
          )}

          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              if (!acceptedTerms) {
                setLoginError('Você deve aceitar os Termos e Condições de Uso para prosseguir.');
                return;
              }
              if (isLoggingIn) return;
              setIsLoggingIn(true);
              setLoginError(null);
              try {
                if (isRegistering) {
                  await registerWithEmail(email, password);
                } else {
                  await loginWithEmail(email, password);
                }
              } catch (error: any) {
                console.error("Auth action failed", error);
                setLoginError(error.message || 'Erro ao realizar a operação de acesso.');
              } finally {
                setIsLoggingIn(false);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">E-MAIL</label>
              <input
                type="email"
                required
                placeholder="seu-email@fazenda.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent bg-white text-gray-900 text-sm"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">SENHA</label>
                {!isRegistering && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotSuccess(null);
                      setForgotError(null);
                      setForgotEmail(email);
                      setIsForgotPasswordOpen(true);
                    }}
                    className="text-xs text-[#2d6a4f] hover:underline font-bold"
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={isPasswordVisible ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent bg-white text-gray-900 text-sm pr-16"
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#2d6a4f] hover:text-[#1b4d3e]"
                >
                  {isPasswordVisible ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-1">
              <input
                id="terms-checkbox"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[#2d6a4f] focus:ring-[#2d6a4f] cursor-pointer"
              />
              <label htmlFor="terms-checkbox" className="text-xs text-gray-600 leading-tight cursor-pointer select-none">
                Li e aceito expressamente os{' '}
                <button
                  type="button"
                  onClick={() => setIsTermsOpen(true)}
                  className="text-[#2d6a4f] hover:underline font-bold"
                >
                  Termos e Condições de Uso
                </button>
              </label>
            </div>

            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 text-white py-3.5 px-6 mt-4 rounded-xl font-bold transition-all shadow-md active:scale-95 bg-[#2d6a4f] hover:bg-[#1b4d3e] disabled:opacity-60"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} /> Entrar com E-mail
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setLoginError(null);
              }}
              className="text-xs text-[#2d6a4f] hover:underline font-bold"
            >
              {isRegistering 
                ? 'Já possui uma conta? Toque para Entrar' 
                : 'Ainda não possui conta? Toque para Criar uma'}
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500 font-semibold">Ou conecte por</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLoginClick}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-3.5 px-6 rounded-xl font-bold transition-all shadow-sm active:scale-95 text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.03-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
              Entrar com Conta Google
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-dashed border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-white px-2 text-gray-500 font-semibold">Sem Internet ou Testando?</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!acceptedTerms) {
                  setLoginError('Você deve aceitar os Termos e Condições para acessar o Modo Convidado.');
                  return;
                }
                loginAsGuest();
              }}
              className="w-full flex items-center justify-center gap-3 bg-[#2d6a4f]/10 border border-dashed border-[#2d6a4f]/50 hover:bg-[#2d6a4f]/20 text-[#2d6a4f] py-3.5 px-6 rounded-xl font-bold transition-all shadow-sm active:scale-95 text-xs cursor-pointer"
            >
              Entrar no Modo Convidado (Offline / Teste)
            </button>
          </div>

          {/* Terms Modal */}
          <AnimatePresence>
            {isTermsOpen && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl border border-gray-200 shadow-2xl p-6 max-w-lg w-full max-h-[80vh] flex flex-col"
                >
                  <h2 className="font-serif italic font-bold text-2xl text-[#2d6a4f] mb-4">Termos e Condições de Uso</h2>
                  <div className="overflow-y-auto pr-2 space-y-4 text-xs text-gray-600 leading-relaxed flex-1">
                    <p className="font-bold text-sm text-gray-900">CONTRATO DE ISENÇÃO DE RESPONSABILIDADE - FAZENDA ONLINE</p>
                    <p><strong>1. Isenção Geral de Responsabilidade:</strong> O Fazenda Online é oferecido aos usuários "como está" e "conforme disponível"...</p>
                    <p><strong>2. Exclusão Total de Responsabilidade por Perdas e Danos:</strong> Sob nenhuma hipótese os desenvolvedores serão responsabilizados...</p>
                    <p><strong>3. Responsabilidade do Produtor:</strong> Cabe única e exclusivamente ao usuário e produtor rural a conferência...</p>
                    <p><strong>4. Aceitação Vinculativa:</strong> Ao concordar eletronicamente com estes termos, você dá plena e irrevogável quitação...</p>
                  </div>
                  <div className="mt-6 flex gap-3 pt-3 border-t border-gray-200">
                    <button onClick={() => { setAcceptedTerms(true); setIsTermsOpen(false); }} className="flex-1 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white py-2.5 px-4 rounded-xl font-bold transition-all text-xs">Aceitar Termos</button>
                    <button onClick={() => setIsTermsOpen(false)} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 py-2.5 px-4 rounded-xl font-semibold transition-all text-xs">Fechar</button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Forgot Password Modal */}
          <AnimatePresence>
            {isForgotPasswordOpen && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl border border-gray-200 shadow-2xl p-6 max-w-sm w-full"
                >
                  <h2 className="font-serif italic font-bold text-xl text-[#2d6a4f] mb-2">Recuperar Senha</h2>
                  <p className="text-gray-600 text-xs mb-4">Escreva o seu endereço de e-mail cadastrado. Enviaremos as instruções de redefinição de senha para você.</p>
                  {forgotError && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl">{forgotError}</div>}
                  {forgotSuccess && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-xl font-medium">{forgotSuccess}</div>}
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (isSendingReset) return;
                    setIsSendingReset(true);
                    setForgotError(null);
                    setForgotSuccess(null);
                    try {
                      await sendPasswordReset(forgotEmail);
                      setForgotSuccess('E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.');
                    } catch (err: any) {
                      setForgotError(err.message || 'Houve um erro ao enviar o e-mail.');
                    } finally {
                      setIsSendingReset(false);
                    }
                  }} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase tracking-wider">E-mail Cadastrado</label>
                      <input type="email" required placeholder="seu-email@fazenda.com.br" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent bg-white text-gray-900 text-xs" />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button type="submit" disabled={isSendingReset} className="flex-1 bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white py-2 px-4 rounded-xl font-bold transition-all text-xs disabled:opacity-50">{isSendingReset ? 'Enviando...' : 'Enviar Link'}</button>
                      <button type="button" onClick={() => { setIsForgotPasswordOpen(false); setForgotSuccess(null); setForgotError(null); }} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 py-2 px-4 rounded-xl font-semibold transition-all text-xs">Cancelar</button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { id: 'clima', label: 'Clima Agora', icon: CloudSun },
    { id: 'properties', label: 'Propriedades', icon: Building2 },
    { id: 'pecuaria-pro', label: 'Pecuária Profissional', icon: Stethoscope },
    { id: 'agricultura', label: 'Agricultura', icon: Wheat },
    { id: 'financeiro-completo', label: 'Financeiro', icon: Wallet },
    { id: 'maquinas', label: 'Máquinas', icon: Tractor },
    { id: 'rh-rural', label: 'RH Rural', icon: UserCog },
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'consultor-ia', label: 'Consultor Rural IA', icon: Sparkles },
    { id: 'payments', label: 'Funcionários', icon: Users },
    { id: 'expenses', label: 'Despesas', icon: Receipt },
    { id: 'inventory', label: 'Estoque Suprimentos', icon: Package },
    { id: 'animals', label: 'Animais', icon: Beef },
    { id: 'weighing', label: 'Planilha Pesagem', icon: Scale },
    { id: 'pastures', label: 'Pastos', icon: MapIcon },
    { id: 'map', label: 'Mapa', icon: MapPin },
    { id: 'tasks', label: 'Tarefas', icon: CalendarCheck },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'nutrition', label: 'Cálculo Nutrição', icon: Leaf },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  const renderView = () => {
    switch (activeView) {
      case 'clima':
        return (
          <iframe
            title="Clima Agora"
            src="https://climaagorav2.pages.dev"
            className="w-full h-full border-0"
            style={{ minHeight: 'calc(100vh - 64px)' }}
            // allow: geolocalização precisa exigir isso explicitamente dentro
            // de um iframe, senão o navegador bloqueia o pedido de
            // localização do ClimaAgora mesmo que o usuário autorize.
            allow="geolocation"
          />
        );
      case 'dashboard': 
        return (
          <Dashboard 
            payments={payments} 
            expenses={expenses} 
            animals={animals} 
            tasks={tasks} 
            settings={settings} 
            weighingSheets={weighingSheets}
            inventory={inventory}
            accountsPayable={accountsPayable}
            accountsReceivable={accountsReceivable}
            talhoes={talhoes}
            individualAnimals={individualAnimals}
            machines={machines}
            documents={documents}
            activeProperty={activeProperty}
            onNavigate={(view) => {
              if (view === 'animals-scan') {
                setScanMode(true);
                setActiveView('animals');
              } else {
                setScanMode(false);
                setActiveView(view);
               }
            }} 
            activeAlerts={activeAlerts}
            onOpenObligations={() => setIsObligationsOpen(true)}
            onToggleTaskCompletion={async (task) => {
              await saveTask({ ...task, completed: !task.completed });
            }}
          />
        );
      case 'payments': return <EmployeePayments payments={payments} onAdd={savePayment} onDelete={deletePayment} />;
      case 'expenses': return <Expenses expenses={expenses} onAdd={saveExpense} onDelete={deleteExpense} />;
      case 'inventory': return <Inventory inventory={inventory} onAdd={saveInventory} onDelete={deleteInventory} />;
      case 'animals': return <Animals animals={animals} onAdd={saveAnimal} onDelete={deleteAnimal} pastures={pastures} transactions={transactions} onAddTransaction={saveTransaction} scanMode={scanMode} />;
      case 'weighing': return <WeighingWorksheet />;
      case 'pastures': return <Pastures pastures={pastures} onAdd={savePasture} onDelete={deletePasture} animals={animals} settings={settings} />;
      case 'map': return <FarmMap pastures={pastures} animals={animals} onUpdatePasture={savePasture} farmSettings={settings} onUpdateSettings={updateSettings} />;
      case 'tasks': return <Tasks tasks={tasks} onSave={saveTask} onDelete={deleteTask} />;
      case 'reports': return <Reports payments={payments} expenses={expenses} animals={animals} transactions={transactions} pastures={pastures} />;
      case 'nutrition': return <NutritionCalculator animals={animals} inventory={inventory} />;
      case 'settings': return <FarmSettingsComp settings={settings} setSettings={updateSettings} />;
      case 'properties': return <Properties properties={properties} activePropertyId={activePropertyId} onSetActive={setActivePropertyId} onSave={saveProperty} onDelete={deleteProperty} />;
      case 'pecuaria-pro': return <PecuariaProfissional individualAnimals={individualAnimals} saveIndividualAnimal={saveIndividualAnimal} deleteIndividualAnimal={deleteIndividualAnimal} reproductionEvents={reproductionEvents} saveReproductionEvent={saveReproductionEvent} deleteReproductionEvent={deleteReproductionEvent} healthEvents={healthEvents} saveHealthEvent={saveHealthEvent} deleteHealthEvent={deleteHealthEvent} milkRecords={milkRecords} saveMilkRecord={saveMilkRecord} deleteMilkRecord={deleteMilkRecord} />;
      case 'agricultura': return <Agricultura talhoes={talhoes} saveTalhao={saveTalhao} deleteTalhao={deleteTalhao} cropPlans={cropPlans} saveCropPlan={saveCropPlan} deleteCropPlan={deleteCropPlan} fieldLogEntries={fieldLogEntries} saveFieldLogEntry={saveFieldLogEntry} deleteFieldLogEntry={deleteFieldLogEntry} pestRecords={pestRecords} savePestRecord={savePestRecord} deletePestRecord={deletePestRecord} irrigationRecords={irrigationRecords} saveIrrigationRecord={saveIrrigationRecord} deleteIrrigationRecord={deleteIrrigationRecord} activeProperty={activeProperty} />;
      case 'financeiro-completo': return <Financeiro accountsPayable={accountsPayable} saveAccountPayable={saveAccountPayable} deleteAccountPayable={deleteAccountPayable} accountsReceivable={accountsReceivable} saveAccountReceivable={saveAccountReceivable} deleteAccountReceivable={deleteAccountReceivable} costCenters={costCenters} saveCostCenter={saveCostCenter} deleteCostCenter={deleteCostCenter} />;
      case 'maquinas': return <Maquinas machines={machines} saveMachine={saveMachine} deleteMachine={deleteMachine} maintenanceRecords={maintenanceRecords} saveMaintenanceRecord={saveMaintenanceRecord} deleteMaintenanceRecord={deleteMaintenanceRecord} />;
      case 'rh-rural': return <RHRural teams={teams} saveTeam={saveTeam} deleteTeam={deleteTeam} workSchedules={workSchedules} saveWorkSchedule={saveWorkSchedule} deleteWorkSchedule={deleteWorkSchedule} trainings={trainings} saveTraining={saveTraining} deleteTraining={deleteTraining} ppeItems={ppeItems} savePPEItem={savePPEItem} deletePPEItem={deletePPEItem} certifications={certifications} saveCertification={saveCertification} deleteCertification={deleteCertification} />;
      case 'documentos': return <Documentos documents={documents} saveDocument={saveDocument} deleteDocument={deleteDocument} />;
      case 'consultor-ia': return <ConsultorRuralIA activeProperty={activeProperty} accountsPayable={accountsPayable} accountsReceivable={accountsReceivable} talhoes={talhoes} individualAnimals={individualAnimals} reproductionEvents={reproductionEvents} healthEvents={healthEvents} milkRecords={milkRecords} documents={documents} machines={machines} maintenanceRecords={maintenanceRecords} inventory={inventory} />;
      default: 
        return (
          <Dashboard 
            payments={payments} 
            expenses={expenses} 
            animals={animals} 
            tasks={tasks} 
            settings={settings} 
            weighingSheets={weighingSheets}
            inventory={inventory}
            accountsPayable={accountsPayable}
            accountsReceivable={accountsReceivable}
            talhoes={talhoes}
            individualAnimals={individualAnimals}
            machines={machines}
            documents={documents}
            activeProperty={activeProperty}
            onNavigate={(view) => {
              if (view === 'animals-scan') {
                setScanMode(true);
                setActiveView('animals');
              } else {
                setScanMode(false);
                setActiveView(view);
              }
            }} 
            activeAlerts={activeAlerts}
            onOpenObligations={() => setIsObligationsOpen(true)}
            onToggleTaskCompletion={async (task) => {
              await saveTask({ ...task, completed: !task.completed });
            }}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? (isMobile ? 280 : 260) : (isMobile ? 0 : 80),
          x: isMobile && !isSidebarOpen ? -280 : 0
        }}
        className={`bg-theme-card border-r border-theme flex flex-col z-40 shadow-theme ${
          isMobile ? 'fixed inset-y-0 left-0' : 'relative'
        }`}
      >
        <div className="p-5 flex items-center justify-between border-b border-theme">
          {(isSidebarOpen || !isMobile) && (
            <motion.h1 
              initial={false}
              animate={{ opacity: isSidebarOpen ? 1 : 0 }}
              className="font-serif italic font-bold text-xl whitespace-nowrap"
              style={{ color: 'var(--primary)' }}
            >
              Fazenda Online
            </motion.h1>
          )}
          {!isMobile && (
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 bg-theme-secondary rounded-lg transition-colors text-theme-secondary"
            >
              {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
          {isMobile && isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 bg-theme-secondary rounded-lg transition-colors text-theme-secondary"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleViewChange(item.id as View)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                activeView === item.id 
                  ? 'text-white shadow-md' 
                  : 'text-theme-secondary bg-theme-card hover:bg-theme-secondary'
              }`}
              style={activeView === item.id ? { background: 'var(--primary)' } : undefined}
            >
              <item.icon size={19} className={activeView === item.id ? 'text-white' : 'text-theme-secondary'} />
              {(isSidebarOpen || isMobile) && (
                <span className={`font-medium text-sm ${activeView === item.id ? 'text-white' : 'text-theme-secondary'}`}>
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-theme">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-theme-secondary hover:bg-red-950/30 hover:text-red-400 transition-colors"
          >
            <LogOut size={19} />
            {(isSidebarOpen || isMobile) && <span className="font-medium text-sm">Sair</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative" style={{ background: 'var(--bg-primary)' }}>
        {/* Header */}
        <header className="sticky top-0 z-10 bg-theme-card border-b border-theme shadow-theme">
          <div className="px-4 md:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isMobile && (
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 -ml-2 bg-theme-secondary rounded-lg transition-colors text-theme-secondary"
                >
                  <Menu size={20} />
                </button>
              )}
              
              {activeView !== 'dashboard' && (
                <button 
                  onClick={() => setActiveView('dashboard')}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all group"
                  style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
                >
                  <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                  <span className="text-xs font-bold">Voltar</span>
                </button>
              )}

              <h2 className="text-base md:text-lg font-bold text-theme-primary capitalize truncate max-w-[120px] sm:max-w-none">
                {navItems.find(n => n.id === activeView)?.label}
              </h2>

              {properties.length > 0 && (
                properties.length === 1 ? (
                  <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-theme-secondary text-theme-secondary rounded-full text-xs font-semibold">
                    <Building2 size={12} /> {properties[0].name}
                  </span>
                ) : (
                  <select
                    value={activePropertyId ?? ''}
                    onChange={(e) => setActivePropertyId(e.target.value)}
                    className="hidden sm:block bg-theme-secondary text-theme-secondary text-xs font-semibold rounded-full px-3 py-1.5 border-0"
                    title="Propriedade ativa"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )
              )}
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Date */}
              <div className="hidden lg:flex items-center bg-theme-secondary px-3 py-1.5 rounded-full">
                <span className="text-xs font-mono text-theme-secondary font-medium">
                  {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              </div>
              
              {/* Obligations Bell */}
              <button 
                onClick={() => setIsObligationsOpen(true)}
                className="relative p-2 rounded-full bg-theme-secondary transition-colors text-theme-secondary"
                title="Central de Obrigações"
              >
                <Bell size={20} />
                {activeAlertsCount > 0 && (
                  <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${hasOverdue ? 'bg-red-500 animate-pulse' : 'bg-amber-500'} text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white`}>
                    {activeAlertsCount > 9 ? '9+' : activeAlertsCount}
                  </span>
                )}
              </button>

              {/* Theme Toggle */}
              <ThemeToggle />
              
              {/* Settings Button */}
              <button 
                onClick={() => setActiveView('settings')}
                className={`p-2 rounded-full transition-colors bg-theme-secondary ${activeView === 'settings' ? '' : 'text-theme-secondary'}`}
                style={activeView === 'settings' ? { background: 'var(--primary-soft)', color: 'var(--primary)' } : undefined}
                title="Configurações"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </header>

        {/* Permission Restriction Banner */}
        {userRole === 'user' && (
          <div className="mx-4 md:mx-6 mt-3 mb-2">
            <div className="relative overflow-hidden rounded-xl bg-white border border-amber-200 shadow-sm">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 to-amber-500"></div>
              
              <div className="pl-4 pr-4 py-3 md:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-amber-700">Acesso Limitado</span>
                      <span className="hidden sm:inline text-gray-300 text-xs">•</span>
                      <span className="text-[11px] text-gray-500">Modo de visualização ativo</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                      Edições, adições e exclusões de registros estão desativadas neste perfil.
                    </p>
                  </div>
                </div>
                
                <div className="flex-shrink-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2d6a4f]"></div>
                    <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider">
                      Somente Leitura
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Warning Alert Bar */}
        {activeAlertsCount > 0 && (
          <AnimatePresence>
            {hasOverdue ? (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-red-600 text-white text-xs py-2.5 px-4 md:px-6 flex items-center justify-between shadow-sm cursor-pointer hover:bg-red-700 transition-colors gap-2"
                onClick={() => setIsObligationsOpen(true)}
              >
                <div className="flex items-center gap-2">
                  <div className="p-0.5 bg-white/20 rounded-lg animate-pulse">
                    <Bell size={12} className="text-white" />
                  </div>
                  <span className="text-[11px] sm:text-xs">
                    Atenção: Você tem <strong>{overdueCount} {overdueCount === 1 ? 'obrigação' : 'obrigações'}</strong> com o prazo ultrapassado!
                  </span>
                </div>
                <span className="underline uppercase tracking-wider text-[9px] sm:text-[10px] font-bold hover:opacity-80 whitespace-nowrap">Ver e Regularizar</span>
              </motion.div>
            ) : (activeAlerts.some(a => a.daysRemaining === 0)) ? (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-amber-500 text-amber-950 text-xs py-2.5 px-4 md:px-6 flex items-center justify-between shadow-sm cursor-pointer hover:bg-amber-600 transition-colors gap-2"
                onClick={() => setIsObligationsOpen(true)}
              >
                <div className="flex items-center gap-2">
                  <div className="p-0.5 bg-white/30 rounded-lg">
                    <Bell size={12} className="text-amber-950" />
                  </div>
                  <span className="text-[11px] sm:text-xs">
                    Aviso: Você tem <strong>{dueTodayCount} {dueTodayCount === 1 ? 'obrigação que vence' : 'obrigações que vencem'}</strong> hoje!
                  </span>
                </div>
                <span className="underline uppercase tracking-wider text-[9px] sm:text-[10px] font-bold hover:opacity-80 whitespace-nowrap">Ver obrigações</span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        )}

        <div className={activeView === 'clima' ? '' : 'p-4 md:p-6'}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={activeView === 'clima' ? 'h-full' : ''}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <ObligationsDrawer 
        isOpen={isObligationsOpen}
        onClose={() => setIsObligationsOpen(false)}
        alerts={activeAlerts}
        onMarkConcluded={handleMarkObligationConcluded}
      />
    </div>
  );
}