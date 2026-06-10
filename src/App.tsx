/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  LogIn,
  Bell,
  Scale,
  UserPlus,
  Sun,
  Moon,
  Leaf
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
import { auth } from './lib/firebase';

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
    return localStorage.getItem('darkMode') === 'true';
  });

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

  // Trigger system push notification alerts on active obligations and tasks (conforming to FCM design patterns)
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
      <div className="h-screen w-full flex items-center justify-center bg-[#fcfaf7]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#3d5a45]/20 border-t-[#3d5a45] rounded-full animate-spin" />
          <p className="text-[#3d5a45] font-bold">Carregando Fazenda...</p>
        </div>
      </div>
    );
  }

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
        setLoginError(error.message || 'Houve um erro no login pelo Google. Verifique sua rede ou tente novamente sê-lo externo.');
      } finally {
        setIsLoggingIn(false);
      }
    };

    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#fcfaf7] p-4 overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl border border-[#e5e0d8] shadow-xl max-w-md w-full text-center my-8"
        >
          <div className="w-20 h-20 bg-[#f5f2ed] rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Beef size={40} className="text-[#3d5a45]" />
          </div>
          
          <h1 className="font-serif italic font-bold text-3xl text-[#3d5a45] mb-2 text-balance leading-tight">
            {isRegistering ? 'Criar Nova Conta' : 'Fazenda Online'}
          </h1>
          <p className="text-[#6d6a66] mb-6 text-sm leading-relaxed">
            {isRegistering 
              ? 'Cadastre o seu e-mail para ter um espaço exclusivo de gestão inteligente de rebanhos e finanças.'
              : 'Gestão inteligente de rebanho e finanças para o produtor rural moderno.'}
          </p>

          {loginError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl text-left leading-relaxed">
              <p className="font-bold mb-1">Aviso de Acesso:</p>
              <p>{loginError}</p>
              <p className="mt-1 font-medium text-orange-950">
                Dica técnica: Se o provedor de autenticação estiver inoperante ou não configurado no Firebase Console, você pode utilizar o Modo Convidado offline abaixo para usar o app livremente sem travar.
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
              <label className="block text-xs font-bold text-[#6d6a66] mb-1.5 uppercase tracking-wider">E-mail</label>
              <input
                type="email"
                required
                placeholder="seu-email@fazenda.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#e5e0d8] focus:outline-none focus:ring-2 focus:ring-[#3d5a45] focus:border-transparent bg-[#fcfaf7] text-sm text-[#2d2a26]"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-[#6d6a66] uppercase tracking-wider">Senha</label>
                {!isRegistering && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotSuccess(null);
                      setForgotError(null);
                      setForgotEmail(email);
                      setIsForgotPasswordOpen(true);
                    }}
                    className="text-xs text-[#3d5a45] hover:underline font-bold"
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
                  className="w-full px-4 py-3 rounded-xl border border-[#e5e0d8] focus:outline-none focus:ring-2 focus:ring-[#3d5a45] focus:border-transparent bg-[#fcfaf7] text-sm text-[#2d2a26] pr-16"
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#3d5a45] hover:text-[#2d4334]"
                >
                  {isPasswordVisible ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            {/* Checkbox de Termos e Condições */}
            <div className="flex items-start gap-2.5 pt-1">
              <input
                id="terms-checkbox"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#e5e0d8] text-[#3d5a45] focus:ring-[#3d5a45] cursor-pointer"
              />
              <label htmlFor="terms-checkbox" className="text-xs text-[#6d6a66] leading-tight cursor-pointer select-none">
                Li e aceito expressamente os{' '}
                <button
                  type="button"
                  onClick={() => setIsTermsOpen(true)}
                  className="text-[#3d5a45] hover:underline font-bold"
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
                   ? 'bg-[#3d5a45]/60 cursor-not-allowed' 
                   : 'bg-[#3d5a45] hover:bg-[#2d4334]'
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
              className="text-xs text-[#3d5a45] hover:underline font-bold"
            >
              {isRegistering 
                ? 'Já possui uma conta? Toque para Entrar' 
                : 'Ainda não possui conta? Toque para Criar uma'}
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e5e0d8]"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-[#8d8a86] font-semibold">Ou conecte por</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLoginClick}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-white border border-[#e5e0d8] hover:bg-[#fcfaf7] text-[#2d2a26] py-3.5 px-6 rounded-xl font-bold transition-all shadow-sm active:scale-95 text-sm"
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
                <div className="w-full border-t border-dashed border-[#e5e0d8]"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-white px-2 text-[#8d8a86] font-semibold">Sem Internet ou Testando?</span>
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
              className="w-full flex items-center justify-center gap-3 bg-[#3d5a45]/5 border border-dashed border-[#3d5a45]/40 hover:bg-[#3d5a45]/10 text-[#3d5a45] py-3.5 px-6 rounded-xl font-bold transition-all shadow-xs active:scale-95 text-xs cursor-pointer"
            >
              Entrar no Modo Convidado (Offline / Teste)
            </button>
          </div>

          {/* Termos e Condições Modal */}
          <AnimatePresence>
            {isTermsOpen && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl border border-[#e5e0d8] shadow-2xl p-6 max-w-lg w-full max-h-[80vh] flex flex-col text-left"
                >
                  <h2 className="font-serif italic font-bold text-2xl text-[#3d5a45] mb-4">Termos e Condições de Uso</h2>
                  
                  <div className="overflow-y-auto pr-2 space-y-4 text-xs text-[#6d6a66] leading-relaxed flex-1">
                    <p className="font-bold text-sm text-[#2d2a26]">CONTRATO DE ISENÇÃO DE RESPONSABILIDADE - FAZENDA ONLINE</p>
                    
                    <p>
                      <strong>1. Isenção Geral de Responsabilidade:</strong> O Fazenda Online é oferecido aos usuários "como está" e "conforme disponível", sem garantias explícitas ou implícitas de qualquer natureza operacional. Nós não assumimos nenhuma responsabilidade pela precisão, autenticidade, suficiência ou utilidade dos dados de animais, pesagens de lotes, controles de pastagens, registros de despesas funcionais e de controle de estoque.
                    </p>
                    
                    <p>
                      <strong>2. Exclusão Total de Responsabilidade por Perdas e Danos:</strong> Sob nenhuma hipótese os desenvolvedores, licenciadores, mantenedores ou parceiros do Fazenda Online serão responsabilizados perante o usuário ou terceiros por perdas operacionais, prejuízos de qualquer espécie ou lucros cessantes. Isso inclui danos diretos, indiretos ou consequentes decorrentes de:
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 font-medium text-[#4d4a46]">
                      <li>Eventuais imprecisões cíveis, erros de cálculo de folha, custos de medicamentos ou vacinas inválidas, ou divergências de inventários cadastrados;</li>
                      <li>Falhas, bugs de sistema, inconsistências operacionais ou exclusão desproposital de registros do banco de dados (Firebase);</li>
                      <li>Qualquer interrupção pontual de acesso provocada por manutenções, instabilidades do provedor ou bugs do ecossistema de infraestrutura;</li>
                      <li><strong>Vazamento de Dados e Ataques Cibernéticos:</strong> Quedas de proteção ou acessos desautorizados decorrentes das políticas de provedores parceiros terceirizados (Firebase/Google Auth, etc.) fora de nosso controle direto.</li>
                    </ul>

                    <p>
                      <strong>3. Responsabilidade do Produtor:</strong> Cabe única e exclusivamente ao usuário e produtor rural a conferência de todos os valores gerados e a realização de backups adicionais ou salvaguarda das suas próprias senhas de acesso aos módulos do sistema.
                    </p>
                    
                    <p>
                      <strong>4. Aceitação Vinculativa:</strong> Ao concordar eletronicamente com estes termos selecionando a caixa "Li e aceito expressamente" e conectando suas credenciais de login, você dá plena e irrevogável quitação sob qualquer pleito judicial, isentando permanentemente o software de qualquer dever indenizatório.
                    </p>
                  </div>

                  <div className="mt-6 flex gap-3 pt-3 border-t border-[#e5e0d8]">
                    <button
                      type="button"
                      onClick={() => {
                        setAcceptedTerms(true);
                        setIsTermsOpen(false);
                      }}
                      className="flex-1 bg-[#3d5a45] hover:bg-[#2d4334] text-white py-2.5 px-4 rounded-xl font-bold transition-all text-xs text-center"
                    >
                      Aceitar Termos
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsTermsOpen(false)}
                      className="flex-1 border border-[#e5e0d8] hover:bg-[#f5f2ed] text-[#3d5a45] py-2.5 px-4 rounded-xl font-semibold transition-all text-xs text-center"
                    >
                      Fechar
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Esqueci Minha Senha Modal */}
          <AnimatePresence>
            {isForgotPasswordOpen && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl border border-[#e5e0d8] shadow-2xl p-6 max-w-sm w-full text-left"
                >
                  <h2 className="font-serif italic font-bold text-xl text-[#3d5a45] mb-2">Recuperar Senha</h2>
                  <p className="text-[#6d6a66] text-xs mb-4 leading-relaxed">
                    Escreva o seu endereço de e-mail cadastrado. Enviaremos as instruções de redefinição de senha para você.
                  </p>

                  {forgotError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-800 text-xs rounded-xl">
                      {forgotError}
                    </div>
                  )}

                  {forgotSuccess && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-100 text-green-800 text-xs rounded-xl font-medium">
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
                      <label className="block text-[10px] font-bold text-[#6d6a66] mb-1 uppercase tracking-wider">E-mail Cadastrado</label>
                      <input
                        type="email"
                        required
                        placeholder="seu-email@fazenda.com.br"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-[#e5e0d8] focus:outline-none focus:ring-2 focus:ring-[#3d5a45] focus:border-transparent bg-[#fcfaf7] text-xs text-[#2d2a26]"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={isSendingReset}
                        className="flex-1 bg-[#3d5a45] hover:bg-[#2d4334] text-white py-2 px-4 rounded-xl font-bold transition-all text-xs disabled:opacity-50"
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
                        className="flex-1 border border-[#e5e0d8] hover:bg-[#f5f2ed] text-[#3d5a45] py-2 px-4 rounded-xl font-semibold transition-all text-xs text-center"
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
    <div className="flex h-screen bg-[#fcfaf7] dark:bg-[#121212] text-[#2d2a26] dark:text-zinc-100 font-sans overflow-hidden">
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
        className={`bg-white dark:bg-zinc-950 border-r border-[#e5e0d8] dark:border-zinc-800/80 flex flex-col z-40 shadow-sm ${
          isMobile ? 'fixed inset-y-0 left-0' : 'relative'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          {(isSidebarOpen || !isMobile) && (
            <motion.h1 
              initial={false}
              animate={{ opacity: isSidebarOpen ? 1 : 0 }}
              className="font-serif italic font-bold text-xl text-[#3d5a45] dark:text-[#5fa875] whitespace-nowrap"
            >
              Fazenda Online
            </motion.h1>
          )}
          {!isMobile && (
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 hover:bg-[#f5f2ed] dark:hover:bg-zinc-800 rounded-lg transition-colors text-[#6d6a66] dark:text-zinc-400"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
          {isMobile && isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 hover:bg-[#f5f2ed] dark:hover:bg-zinc-800 rounded-lg transition-colors text-[#6d6a66] dark:text-zinc-400"
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
              className={`w-full flex items-center p-3 rounded-xl transition-all ${
                activeView === item.id 
                  ? 'bg-[#3d5a45] dark:bg-[#3d5a45] text-white shadow-md' 
                  : 'text-[#6d6a66] dark:text-[#a1a1aa] hover:bg-[#f5f2ed] dark:hover:bg-zinc-800/60 hover:text-[#2d2a26]'
              }`}
            >
              <item.icon size={20} />
              {(isSidebarOpen || isMobile) && (
                <span className="ml-3 font-medium text-sm">{item.label}</span>
              )}
              {activeView === item.id && isSidebarOpen && !isMobile && (
                <ChevronRight size={14} className="ml-auto opacity-50" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#e5e0d8] dark:border-zinc-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center p-3 text-[#6d6a66] dark:text-[#a1a1aa] hover:bg-red-50 dark:hover:bg-red-950/25 hover:text-red-600 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            {(isSidebarOpen || isMobile) && <span className="ml-3 font-medium text-sm">Sair</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative bg-[#fcfaf7] dark:bg-zinc-950 text-[#2d2a26] dark:text-zinc-100">
        <header className="h-16 border-b border-[#e5e0d8] dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10 px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            {isMobile && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 hover:bg-[#f5f2ed] rounded-lg transition-colors text-[#2d2a26] dark:text-zinc-300"
              >
                <Menu size={20} />
              </button>
            )}
            
            {activeView !== 'dashboard' && (
              <button 
                onClick={() => setActiveView('dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f2ed] text-[#3d5a45] rounded-full hover:bg-[#e5e0d8] transition-all group"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-xs font-bold hidden sm:inline">Voltar</span>
              </button>
            )}

            <h2 className="text-lg font-bold text-[#1a1c1d] dark:text-white capitalize truncate max-w-[150px] md:max-w-none">
              {navItems.find(n => n.id === activeView)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden lg:block bg-[#f5f2ed] dark:bg-zinc-800 px-3 py-1.5 rounded-full text-xs font-mono text-[#4d4a46] dark:text-zinc-300 font-medium">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            
            {activeView !== 'dashboard' && (
              <button 
                onClick={() => setActiveView('dashboard')}
                className="p-2 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-full transition-colors order-first md:order-none"
                title="Fechar e ir para o Painel"
              >
                <X size={20} />
              </button>
            )}
            
            <button 
              onClick={() => setIsObligationsOpen(true)}
              className={`p-2 rounded-full transition-colors relative ${isObligationsOpen ? 'bg-[#3d5a45] text-white' : 'hover:bg-[#f5f2ed] dark:hover:bg-zinc-800 text-[#2d2a26] dark:text-zinc-200'}`}
              title="Central de Obrigações"
              id="obligations-bell-btn"
            >
              <Bell size={20} />
              {activeAlertsCount > 0 && (
                <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${hasOverdue ? 'bg-red-600 animate-pulse' : 'bg-amber-500'} text-white text-[10px] font-black flex items-center justify-center border-2 border-white`}>
                  {activeAlertsCount}
                </span>
              )}
            </button>

            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full transition-colors hover:bg-[#f5f2ed] dark:hover:bg-zinc-800 text-[#2d2a26] dark:text-zinc-200"
              title={darkMode ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
            >
              {darkMode ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} />}
            </button>
            
            <button 
              onClick={() => setActiveView('settings')}
              className={`p-2 rounded-full transition-colors ${activeView === 'settings' ? 'bg-[#3d5a45] text-white' : 'hover:bg-[#f5f2ed] dark:hover:bg-zinc-800 text-[#2d2a26] dark:text-zinc-200'}`}
              title="Configurações"
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        {/* Permission restriction Banner if User has Limited Access */}
        {userRole === 'user' && (
          <div className="bg-amber-50 border-b border-amber-200 text-[#8a5b00] text-xs py-2.5 px-4 md:px-8 flex items-center gap-2">
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
                className="bg-red-650 text-white font-bold text-xs py-3 px-4 md:px-8 flex items-center justify-between shadow-sm cursor-pointer hover:bg-red-700 transition-colors gap-2"
                onClick={() => setIsObligationsOpen(true)}
                id="warning-bar-overdue"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-white/20 rounded-lg animate-pulse">
                    <Bell size={14} className="text-white" />
                  </div>
                  <span>
                    Atenção: Você tem <strong>{overdueCount} {overdueCount === 1 ? 'obrigação' : 'obrigações'}</strong> com o prazo ultrapassado!
                  </span>
                </div>
                <span className="underline uppercase tracking-wider text-[10px] font-black hover:opacity-80">Ver e Regularizar</span>
              </motion.div>
            ) : (activeAlerts.some(a => a.daysRemaining === 0)) ? (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-amber-500 text-amber-950 font-bold text-xs py-3 px-4 md:px-8 flex items-center justify-between shadow-sm cursor-pointer hover:bg-amber-550 transition-colors gap-2"
                onClick={() => setIsObligationsOpen(true)}
                id="warning-bar-today"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-white/30 rounded-lg">
                    <Bell size={14} className="text-amber-950" />
                  </div>
                  <span>
                    Aviso: Você tem <strong>{dueTodayCount} {dueTodayCount === 1 ? 'obrigação que vence' : 'obrigações que vencem'}</strong> hoje!
                  </span>
                </div>
                <span className="underline uppercase tracking-wider text-[10px] font-black hover:opacity-80">Ver obrigações</span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        )}

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
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

