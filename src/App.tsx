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
} from 'lucide-react';
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

// Utils
import { computeObligations, ObligationAlert } from './utils/obligations';

// Components
import Dashboard from './components/Dashboard';
import EmployeePayments from './components/EmployeePayments';
import Expenses from './components/Expenses';
import Inventory from './components/Inventory';
import Animals from './components/Animals';
import Pastures from './components/Pastures';
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
    weighingSheets
  } = useFirebase();

  const [activeView, setActiveView] = useState<View>('dashboard');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });

  // Apply theme to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

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
      <div className="h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-emerald-700 dark:text-emerald-400 font-bold">Carregando Fazenda...</p>
        </div>
      </div>
    );
  }

  // Login Screen - Tema consistente
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
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-zinc-900 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-950 p-8 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-xl max-w-md w-full my-8"
        >
          <div className="w-20 h-20 bg-gray-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Beef size={40} className="text-emerald-600 dark:text-emerald-500" />
          </div>
          
          <h1 className="font-serif italic font-bold text-3xl text-emerald-700 dark:text-emerald-500 mb-2 text-balance text-center leading-tight">
            {isRegistering ? 'Criar Nova Conta' : 'Fazenda Online'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm text-center leading-relaxed">
            {isRegistering 
              ? 'Cadastre o seu e-mail para ter um espaço exclusivo de gestão inteligente de rebanhos e finanças.'
              : 'Gestão inteligente de rebanho e finanças para o produtor rural moderno.'}
          </p>

          {loginError && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs rounded-xl text-left leading-relaxed">
              <p className="font-bold mb-1">Aviso de Acesso:</p>
              <p>{loginError}</p>
              <p className="mt-1 font-medium text-orange-800 dark:text-orange-400">
                Dica: Se o provedor de autenticação estiver inoperante, utilize o Modo Convidado offline.
              </p>
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
            className="space-y-4 text-left"
          >
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">E-mail</label>
              <input
                type="email"
                required
                placeholder="seu-email@fazenda.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Senha</label>
                {!isRegistering && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotSuccess(null);
                      setForgotError(null);
                      setForgotEmail(email);
                      setIsForgotPasswordOpen(true);
                    }}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
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
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 text-sm pr-16"
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                >
                  {isPasswordVisible ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-2.5 pt-1">
              <input
                id="terms-checkbox"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="terms-checkbox" className="text-xs text-gray-600 dark:text-gray-400 leading-tight cursor-pointer select-none">
                Li e aceito expressamente os{' '}
                <button
                  type="button"
                  onClick={() => setIsTermsOpen(true)}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                >
                  Termos e Condições de Uso
                </button>
              </label>
            </div>

            <button 
               type="submit"
               disabled={isLoggingIn}
               className={`w-full flex items-center justify-center gap-3 text-white py-3.5 px-6 mt-4 rounded-xl font-bold transition-all shadow-md active:scale-95 ${
                 isLoggingIn 
                   ? 'bg-emerald-600/60 cursor-not-allowed' 
                   : 'bg-emerald-600 hover:bg-emerald-700'
               }`}
            >
              {isLoggingIn ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                isRegistering ? (
                  <>
                    <UserPlus size={18} /> Criar Conta e Entrar
                  </>
                ) : (
                  <>
                    <LogIn size={18} /> Entrar com E-mail
                  </>
                )
              )}
            </button>
          </form>

          {/* Toggle between login and registration */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setLoginError(null);
              }}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
            >
              {isRegistering 
                ? 'Já possui uma conta? Toque para Entrar' 
                : 'Ainda não possui conta? Toque para Criar uma'}
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-zinc-950 px-2 text-gray-500 dark:text-gray-400 font-semibold">Ou conecte por</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLoginClick}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 py-3.5 px-6 rounded-xl font-bold transition-all shadow-sm active:scale-95 text-sm"
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
                <div className="w-full border-t border-dashed border-gray-200 dark:border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-white dark:bg-zinc-950 px-2 text-gray-500 dark:text-gray-400 font-semibold">Sem Internet ou Testando?</span>
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
              className="w-full flex items-center justify-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-dashed border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 py-3.5 px-6 rounded-xl font-bold transition-all shadow-sm active:scale-95 text-xs cursor-pointer"
            >
              Entrar no Modo Convidado (Offline / Teste)
            </button>
          </div>

          {/* Terms and Conditions Modal */}
          <AnimatePresence>
            {isTermsOpen && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-2xl p-6 max-w-lg w-full max-h-[80vh] flex flex-col text-left"
                >
                  <h2 className="font-serif italic font-bold text-2xl text-emerald-700 dark:text-emerald-500 mb-4">Termos e Condições de Uso</h2>
                  
                  <div className="overflow-y-auto pr-2 space-y-4 text-xs text-gray-600 dark:text-gray-400 leading-relaxed flex-1">
                    <p className="font-bold text-sm text-gray-900 dark:text-gray-100">CONTRATO DE ISENÇÃO DE RESPONSABILIDADE - FAZENDA ONLINE</p>
                    
                    <p>
                      <strong>1. Isenção Geral de Responsabilidade:</strong> O Fazenda Online é oferecido aos usuários "como está" e "conforme disponível", sem garantias explícitas ou implícitas de qualquer natureza operacional.
                    </p>
                    
                    <p>
                      <strong>2. Exclusão Total de Responsabilidade por Perdas e Danos:</strong> Sob nenhuma hipótese os desenvolvedores serão responsabilizados perante o usuário ou terceiros por perdas operacionais, prejuízos de qualquer espécie ou lucros cessantes.
                    </p>

                    <p>
                      <strong>3. Responsabilidade do Produtor:</strong> Cabe única e exclusivamente ao usuário e produtor rural a conferência de todos os valores gerados e a realização de backups adicionais.
                    </p>
                    
                    <p>
                      <strong>4. Aceitação Vinculativa:</strong> Ao concordar eletronicamente com estes termos, você dá plena e irrevogável quitação sob qualquer pleito judicial, isentando permanentemente o software de qualquer dever indenizatório.
                    </p>
                  </div>

                  <div className="mt-6 flex gap-3 pt-3 border-t border-gray-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => {
                        setAcceptedTerms(true);
                        setIsTermsOpen(false);
                      }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl font-bold transition-all text-xs text-center"
                    >
                      Aceitar Termos
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsTermsOpen(false)}
                      className="flex-1 border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 py-2.5 px-4 rounded-xl font-semibold transition-all text-xs text-center"
                    >
                      Fechar
                    </button>
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
                  className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-2xl p-6 max-w-sm w-full text-left"
                >
                  <h2 className="font-serif italic font-bold text-xl text-emerald-700 dark:text-emerald-500 mb-2">Recuperar Senha</h2>
                  <p className="text-gray-600 dark:text-gray-400 text-xs mb-4 leading-relaxed">
                    Escreva o seu endereço de e-mail cadastrado. Enviaremos as instruções de redefinição de senha para você.
                  </p>

                  {forgotError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs rounded-xl">
                      {forgotError}
                    </div>
                  )}

                  {forgotSuccess && (
                    <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 text-xs rounded-xl font-medium">
                      {forgotSuccess}
                    </div>
                  )}

                  <form
                    onSubmit={async (e) => {
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
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">E-mail Cadastrado</label>
                      <input
                        type="email"
                        required
                        placeholder="seu-email@fazenda.com.br"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 text-xs"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={isSendingReset}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-xl font-bold transition-all text-xs disabled:opacity-50"
                      >
                        {isSendingReset ? 'Enviando...' : 'Enviar Link'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPasswordOpen(false);
                          setForgotSuccess(null);
                          setForgotError(null);
                        }}
                        className="flex-1 border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-xl font-semibold transition-all text-xs text-center"
                      >
                        Cancelar
                      </button>
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
  ];

  const renderView = () => {
    switch (activeView) {
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
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Sidebar Overlay for Mobile */}
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
        className={`bg-white dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 flex flex-col z-40 shadow-sm ${
          isMobile ? 'fixed inset-y-0 left-0' : 'relative'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          {(isSidebarOpen || !isMobile) && (
            <motion.h1 
              initial={false}
              animate={{ opacity: isSidebarOpen ? 1 : 0 }}
              className="font-serif italic font-bold text-xl text-emerald-700 dark:text-emerald-500 whitespace-nowrap"
            >
              Fazenda Online
            </motion.h1>
          )}
          {!isMobile && (
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
          {isMobile && isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleViewChange(item.id as View)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                activeView === item.id 
                  ? 'bg-emerald-600 dark:bg-emerald-700 text-white shadow-md' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
              }`}
            >
              <item.icon size={20} />
              {(isSidebarOpen || isMobile) && (
                <span className="font-medium text-sm">{item.label}</span>
              )}
              {activeView === item.id && isSidebarOpen && !isMobile && (
                <ChevronRight size={14} className="ml-auto opacity-50" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-zinc-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition-colors"
          >
            <LogOut size={20} />
            {(isSidebarOpen || isMobile) && <span className="font-medium text-sm">Sair</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative bg-gray-50 dark:bg-zinc-900">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
              >
                <Menu size={20} />
              </button>
            )}
            
            {activeView !== 'dashboard' && (
              <button 
                onClick={() => setActiveView('dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-xs font-bold hidden sm:inline">Voltar</span>
              </button>
            )}

            <h2 className="text-lg font-bold text-gray-800 dark:text-white capitalize truncate max-w-[150px] md:max-w-none">
              {navItems.find(n => n.id === activeView)?.label}
            </h2>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden lg:block bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full text-xs font-mono text-gray-600 dark:text-gray-400 font-medium">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            
            <button 
              onClick={() => setIsObligationsOpen(true)}
              className={`p-2 rounded-full transition-colors relative hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400`}
              title="Central de Obrigações"
            >
              <Bell size={20} />
              {activeAlertsCount > 0 && (
                <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${hasOverdue ? 'bg-red-500 animate-pulse' : 'bg-amber-500'} text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-zinc-900`}>
                  {activeAlertsCount}
                </span>
              )}
            </button>

            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400"
              title={darkMode ? "Modo Claro" : "Modo Escuro"}
            >
              {darkMode ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} />}
            </button>
            
            <button 
              onClick={() => setActiveView('settings')}
              className={`p-2 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 ${activeView === 'settings' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : ''}`}
              title="Configurações"
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        {/* Permission restriction Banner */}
        {userRole === 'user' && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs py-2.5 px-4 md:px-6 flex items-center gap-2">
            <span>⚠️</span>
            <span><strong>Acesso Limitado:</strong> Você está conectado com um perfil de acesso limitado. Adições, edições e exclusões de registros estão desativadas.</span>
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
                className="bg-red-600 text-white font-bold text-xs py-3 px-4 md:px-6 flex items-center justify-between shadow-sm cursor-pointer hover:bg-red-700 transition-colors gap-2"
                onClick={() => setIsObligationsOpen(true)}
              >
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-white/20 rounded-lg animate-pulse">
                    <Bell size={14} className="text-white" />
                  </div>
                  <span>
                    Atenção: Você tem <strong>{overdueCount} {overdueCount === 1 ? 'obrigação' : 'obrigações'}</strong> com o prazo ultrapassado!
                  </span>
                </div>
                <span className="underline uppercase tracking-wider text-[10px] font-bold hover:opacity-80">Ver e Regularizar</span>
              </motion.div>
            ) : (activeAlerts.some(a => a.daysRemaining === 0)) ? (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-amber-500 text-amber-950 font-bold text-xs py-3 px-4 md:px-6 flex items-center justify-between shadow-sm cursor-pointer hover:bg-amber-600 transition-colors gap-2"
                onClick={() => setIsObligationsOpen(true)}
              >
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-white/30 rounded-lg">
                    <Bell size={14} className="text-amber-950" />
                  </div>
                  <span>
                    Aviso: Você tem <strong>{dueTodayCount} {dueTodayCount === 1 ? 'obrigação que vence' : 'obrigações que vencem'}</strong> hoje!
                  </span>
                </div>
                <span className="underline uppercase tracking-wider text-[10px] font-bold hover:opacity-80">Ver obrigações</span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        )}

        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
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