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
, Building2 , Stethoscope , Wheat , Wallet, Tractor, UserCog , FileText , Sparkles, CloudSun, HelpCircle, ShieldAlert, CreditCard, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  EmployeePayment, 
  Expense, 
  InventoryItem, 
  Animal, 
  Pasture, 
  FarmTask,
  TransactionHistory,
  FarmSettings,
  AccountStatus,
  Subscription,
  SubscriptionStatus,
  PlanTier,
  PLAN_PRICES
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
import HelpScreen from './components/HelpScreen';
import AdminPanel from './components/AdminPanel';
import Logo from './components/Logo';
import Cotacoes from './components/Cotacoes';
import MinhaAssinatura from './components/MinhaAssinatura';
import SalesPage from './components/SalesPage';
import { db } from './lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
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
    breedingSeasons,
    saveBreedingSeason,
    deleteBreedingSeason,
    scheduledSprays,
    saveScheduledSpray,
    deleteScheduledSpray,
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const [mySubscription, setMySubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setMySubscription(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'subscriptions', user.uid), (snap) => {
      setMySubscription(snap.exists() ? (snap.data() as Subscription) : null);
    }, () => setMySubscription(null));
    return unsub;
  }, [user?.uid]);
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
  const activeAlerts = computeObligations(
    tasks || [], expenses || [], fixedExpenses || [], settings || { farmName: '', city: '' }, animals || [],
    healthEvents || [], cropPlans || [], accountsPayable || [], accountsReceivable || [], reproductionEvents || [], pastures || [],
    breedingSeasons || [], scheduledSprays || []
  );
  const activeAlertsCount = activeAlerts.length;
  const hasOverdue = activeAlerts.some(a => a.daysRemaining < 0);
  const overdueCount = activeAlerts.filter(a => a.daysRemaining < 0).length;
  const dueTodayCount = activeAlerts.filter(a => a.daysRemaining === 0).length;

  const handleMarkObligationConcluded = async (alert: ObligationAlert) => {
    if (alert.type === 'task') {
      await saveTask({ ...alert.originalItem, completed: true });
    } else if (alert.type === 'variable_expense') {
      await saveExpense({ ...alert.originalItem, status: 'paid' });
    } else if (alert.type === 'fixed_expense' || alert.type === 'animal_rent') {
      const key = alert.originalItem.monthKey;
      const currentConcluded = settings.concludedObligations || [];
      if (!currentConcluded.includes(key)) {
        await updateSettings({
          ...settings,
          concludedObligations: [...currentConcluded, key]
        });
      }
    } else if (alert.type === 'account_payable') {
      await saveAccountPayable({ ...alert.originalItem, status: AccountStatus.PAGO, paidDate: new Date().toISOString().split('T')[0] });
    } else if (alert.type === 'account_receivable') {
      await saveAccountReceivable({ ...alert.originalItem, status: AccountStatus.PAGO, receivedDate: new Date().toISOString().split('T')[0] });
    } else if (
      alert.type === 'vaccine' || alert.type === 'crop_planting' ||
      alert.type === 'crop_harvest' || alert.type === 'weaning' || alert.type === 'pasture_rotation' ||
      alert.type === 'breeding_season' || alert.type === 'scheduled_spray'
    ) {
      // Eventos de ocorrência única (não recorrentes todo mês) — usa o
      // próprio id do alerta como chave de conclusão.
      const currentConcluded = settings.concludedObligations || [];
      if (!currentConcluded.includes(alert.id)) {
        await updateSettings({
          ...settings,
          concludedObligations: [...currentConcluded, alert.id]
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
      <div className="h-screen w-full flex items-center justify-center bg-theme-card">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#2d6a4f]/20 border-t-[#2d6a4f] rounded-full animate-spin" />
          <p className="text-[var(--primary)] font-bold">Carregando Fazenda...</p>
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
      <div className="min-h-screen w-full flex items-center justify-center bg-theme-card p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-theme-card p-8 rounded-3xl border border-theme shadow-xl max-w-md w-full my-8"
        >
          <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <Logo size={80} />
          </div>
          
          <h1 className="font-serif italic font-bold text-3xl text-[var(--primary)] mb-2 text-center">
            {isRegistering ? 'Criar Nova Conta' : 'Agro Gestão'}
          </h1>
          <p className="text-theme-secondary mb-6 text-sm text-center">
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
              <label className="block text-xs font-bold text-theme-secondary mb-1.5 uppercase tracking-wider">E-MAIL</label>
              <input
                type="email"
                required
                placeholder="seu-email@fazenda.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-theme focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent bg-theme-card text-theme-primary text-sm"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-theme-secondary uppercase tracking-wider">SENHA</label>
                {!isRegistering && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotSuccess(null);
                      setForgotError(null);
                      setForgotEmail(email);
                      setIsForgotPasswordOpen(true);
                    }}
                    className="text-xs text-[var(--primary)] hover:underline font-bold"
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
                  className="w-full px-4 py-3 rounded-xl border border-theme focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent bg-theme-card text-theme-primary text-sm pr-16"
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--primary)] hover:text-[#1b4d3e]"
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
                className="mt-1 h-4 w-4 rounded border-theme text-[var(--primary)] focus:ring-[#2d6a4f] cursor-pointer"
              />
              <label htmlFor="terms-checkbox" className="text-xs text-theme-secondary leading-tight cursor-pointer select-none">
                Li e aceito expressamente os{' '}
                <button
                  type="button"
                  onClick={() => setIsTermsOpen(true)}
                  className="text-[var(--primary)] hover:underline font-bold"
                >
                  Termos e Condições de Uso
                </button>
              </label>
            </div>

            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 text-white py-3.5 px-6 mt-4 rounded-xl font-bold transition-all shadow-md active:scale-95 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-60"
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
              className="text-xs text-[var(--primary)] hover:underline font-bold"
            >
              {isRegistering 
                ? 'Já possui uma conta? Toque para Entrar' 
                : 'Ainda não possui conta? Toque para Criar uma'}
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-theme"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-theme-card px-2 text-theme-secondary font-semibold">Ou conecte por</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLoginClick}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-theme-card border border-theme hover:bg-theme-secondary text-theme-primary py-3.5 px-6 rounded-xl font-bold transition-all shadow-sm active:scale-95 text-sm"
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
                <div className="w-full border-t border-dashed border-theme"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-theme-card px-2 text-theme-secondary font-semibold">Ainda não decidiu?</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPlansOpen(true)}
              className="w-full flex items-center justify-center gap-3 bg-[var(--primary)]/10 border border-dashed border-[#2d6a4f]/50 hover:bg-[var(--primary)]/20 text-[var(--primary)] py-3.5 px-6 rounded-xl font-bold transition-all shadow-sm active:scale-95 text-xs cursor-pointer"
            >
              Grátis por 3 dias — Ver Planos e Assinar
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
                  className="bg-theme-card rounded-3xl border border-theme shadow-2xl p-6 max-w-lg w-full max-h-[80vh] flex flex-col"
                >
                  <h2 className="font-serif italic font-bold text-2xl text-[var(--primary)] mb-4">Termos e Condições de Uso</h2>
                  <div className="overflow-y-auto pr-2 space-y-4 text-xs text-theme-secondary leading-relaxed flex-1">
                    <p className="font-bold text-sm text-theme-primary">TERMOS DE USO — FAZENDA ONLINE</p>

                    <p><strong>1. Aceitação dos Termos.</strong> Ao criar uma conta, marcar a caixa de aceite ou simplesmente usar o Agro Gestão, você concorda integralmente com estes Termos. Se você não concorda com algum ponto, a orientação é simples: não use o aplicativo, e caso já tenha instalado, desinstale-o. O uso continuado do aplicativo, a partir de agora, é considerado como sua concordância expressa com estes Termos.</p>

                    <p><strong>2. O que é o serviço.</strong> O Agro Gestão é um sistema de gestão rural (rebanho, agricultura, financeiro, clima e módulos correlatos) oferecido "como está" e "conforme disponível", sem garantia de disponibilidade ininterrupta, ausência de erros, ou adequação a uma finalidade específica.</p>

                    <p><strong>3. Cadastro e responsabilidade pela conta.</strong> Você é responsável por manter a confidencialidade da sua senha e por todas as atividades realizadas na sua conta. Informações incorretas, desatualizadas ou incompletas cadastradas por você são de sua exclusiva responsabilidade.</p>

                    <p><strong>4. Teste grátis e assinatura.</strong> Toda nova conta tem 3 dias de acesso completo e gratuito, sem necessidade de cadastrar qualquer forma de pagamento. Após esse período, você será convidado a assinar um plano para continuar testando por mais 7 dias (10 dias no total) — durante esses 7 dias, você pode cancelar a qualquer momento sem que nenhum valor seja cobrado. Se você não cancelar até o fim desse prazo, a primeira mensalidade é debitada automaticamente. Encerrado o prazo de 10 dias sem uma assinatura ativa, o acesso ao aplicativo é bloqueado até a regularização. A cobrança é recorrente, através de gateways de pagamento parceiros (como Mercado Pago, Stripe ou PayPal). O acesso pode ser suspenso ou bloqueado em caso de inadimplência, sem prejuízo da cobrança dos valores já devidos. Você pode cancelar sua assinatura a qualquer momento pela própria tela do aplicativo; o administrador também pode suspender, bloquear ou cancelar contas a seu critério, inclusive por uso indevido, fraude ou violação destes Termos.</p>

                    <p><strong>5. Localização (GPS).</strong> Algumas funções (como alertas climáticos e o Consultor Rural) precisam saber onde fica sua propriedade, e por isso podem solicitar acesso à sua localização ou pedir que você a cadastre manualmente. Esse acesso é sempre opcional e usado exclusivamente para o funcionamento dessas funções — se você não permitir o acesso, apenas essas funções específicas ficam indisponíveis; o restante do aplicativo continua funcionando normalmente.</p>

                    <p><strong>6. Privacidade e LGPD.</strong> Tratamos seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Coletamos apenas os dados necessários para o funcionamento do aplicativo (como e-mail, nome da propriedade, cidade e, se você informar, data de aniversário). Você pode solicitar a qualquer momento a exclusão da sua conta e dos seus dados, entrando em contato pelo e-mail de suporte abaixo.</p>

                    <p><strong>7. O que NÃO coletamos nem guardamos.</strong> O Agro Gestão não solicita, não processa e não armazena dados bancários, número de cartão de crédito, CVV, senhas de banco ou qualquer dado sensível de pagamento — essas informações, quando aplicável, são digitadas diretamente nas telas seguras dos gateways de pagamento parceiros (Mercado Pago, PayPal, processadoras de cartão), nunca dentro do nosso próprio sistema. Também não coletamos dados sensíveis (como origem racial, convicção religiosa, opinião política, dado de saúde ou biometria) além do estritamente necessário ao uso do aplicativo.</p>

                    <p><strong>8. Publicidade.</strong> O aplicativo pode exibir conteúdo publicitário de terceiros em espaço próprio na tela inicial. Não nos responsabilizamos pelo conteúdo, veracidade ou pelas transações realizadas com anunciantes — qualquer negociação com um anunciante é de responsabilidade exclusiva das partes envolvidas.</p>

                    <p><strong>9. Limitação de responsabilidade.</strong> Cabe única e exclusivamente ao usuário e produtor rural a conferência, validação e decisão final sobre qualquer informação, cálculo, sugestão ou conselho gerado pelo aplicativo (incluindo previsões climáticas, cálculos financeiros, sugestões de manejo ou respostas do Consultor Rural) antes de qualquer tomada de decisão prática na sua atividade rural. Na máxima extensão permitida pela legislação aplicável, o Agro Gestão, seus desenvolvedores, administradores, sócios e parceiros não se responsabilizam civilmente por perdas, danos diretos, indiretos, lucros cessantes ou prejuízos patrimoniais decorrentes do uso ou da impossibilidade de uso do aplicativo. Esta cláusula limita responsabilidade civil na forma da lei — ela não afasta, e não tem o poder de afastar, eventual responsabilidade criminal, que é sempre apurada e determinada exclusivamente pelas autoridades e pelo Poder Judiciário competentes, conforme a legislação vigente.</p>

                    <p><strong>10. Manutenção e disponibilidade.</strong> O Agro Gestão pode sair do ar temporariamente para manutenção, atualizações ou correções, sem aviso prévio, sempre que necessário para o bom funcionamento do serviço. Em caso de encerramento definitivo do aplicativo, você será avisado com a maior antecedência possível e receberá de volta o valor proporcional aos dias não utilizados do mês já pago da sua assinatura.</p>

                    <p><strong>11. Alterações destes Termos.</strong> Podemos atualizar estes Termos periodicamente para refletir mudanças no aplicativo ou na legislação. Mudanças relevantes serão comunicadas dentro do próprio aplicativo.</p>

                    <p><strong>12. Suporte e contato.</strong> Dúvidas, solicitações relacionadas a dados pessoais (LGPD) ou suporte geral podem ser enviadas para: <strong className="text-theme-primary">admmeuarmazem@gmail.com</strong>.</p>

                    <p className="italic">Ao aceitar estes Termos, você confirma que leu, entendeu e concorda com todo o conteúdo acima. Se, a qualquer momento, você discordar de qualquer parte, o uso do aplicativo deve ser interrompido e ele deve ser desinstalado — continuar usando significa que você permitiu e aceitou.</p>
                  </div>
                  <div className="mt-6 flex gap-3 pt-3 border-t border-theme">
                    <button onClick={() => { setAcceptedTerms(true); setIsTermsOpen(false); }} className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white py-2.5 px-4 rounded-xl font-bold transition-all text-xs">Aceitar Termos</button>
                    <button onClick={() => setIsTermsOpen(false)} className="flex-1 border border-theme hover:bg-theme-secondary text-theme-primary py-2.5 px-4 rounded-xl font-semibold transition-all text-xs">Fechar</button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Sales Page (full-screen funnel) */}
          {isPlansOpen && (
            <SalesPage
              onClose={() => setIsPlansOpen(false)}
              onStartTrial={() => { setIsPlansOpen(false); setIsRegistering(true); }}
            />
          )}

          {/* Forgot Password Modal */}
          <AnimatePresence>
            {isForgotPasswordOpen && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-theme-card rounded-3xl border border-theme shadow-2xl p-6 max-w-sm w-full"
                >
                  <h2 className="font-serif italic font-bold text-xl text-[var(--primary)] mb-2">Recuperar Senha</h2>
                  <p className="text-theme-secondary text-xs mb-4">Escreva o seu endereço de e-mail cadastrado. Enviaremos as instruções de redefinição de senha para você.</p>
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
                      <label className="block text-[10px] font-bold text-theme-secondary mb-1 uppercase tracking-wider">E-mail Cadastrado</label>
                      <input type="email" required placeholder="seu-email@fazenda.com.br" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-theme focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent bg-theme-card text-theme-primary text-xs" />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button type="submit" disabled={isSendingReset} className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white py-2 px-4 rounded-xl font-bold transition-all text-xs disabled:opacity-50">{isSendingReset ? 'Enviando...' : 'Enviar Link'}</button>
                      <button type="button" onClick={() => { setIsForgotPasswordOpen(false); setForgotSuccess(null); setForgotError(null); }} className="flex-1 border border-theme hover:bg-theme-secondary text-theme-primary py-2 px-4 rounded-xl font-semibold transition-all text-xs">Cancelar</button>
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
    { id: 'cotacoes', label: 'Cotações', icon: DollarSign },
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
    { id: 'minha-assinatura', label: 'Minha Assinatura', icon: CreditCard },
  ];

  const BOOTSTRAP_ADMIN_EMAILS_CLIENT = ['admin@fazenda.com.br', 'admmeuarmazem@gmail.com', 'arnaldolima.adv79@gmail.com'];
  const isBootstrapAdmin = !!user?.email && BOOTSTRAP_ADMIN_EMAILS_CLIENT.includes(user.email.toLowerCase());
  if (isBootstrapAdmin) {
    navItems.push({ id: 'admin-panel', label: 'Painel Admin', icon: ShieldAlert });
  }

  const renderView = () => {
    switch (activeView) {
      case 'cotacoes':
        return <Cotacoes defaultRegion={settings.city} />;
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
      case 'admin-panel':
        if (!isBootstrapAdmin) return <div className="p-6 text-sm text-theme-secondary">Acesso restrito.</div>;
        return <AdminPanel adminEmail={user?.email || ''} />;
      case 'minha-assinatura':
        return <MinhaAssinatura uid={user?.uid || ''} />;
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
            uid={user?.uid}
            onSaveSettings={updateSettings}
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
      case 'settings': return <FarmSettingsComp settings={settings} setSettings={updateSettings} uid={user?.uid} />;
      case 'properties': return <Properties properties={properties} activePropertyId={activePropertyId} onSetActive={setActivePropertyId} onSave={saveProperty} onDelete={deleteProperty} />;
      case 'pecuaria-pro': return <PecuariaProfissional individualAnimals={individualAnimals} saveIndividualAnimal={saveIndividualAnimal} deleteIndividualAnimal={deleteIndividualAnimal} reproductionEvents={reproductionEvents} saveReproductionEvent={saveReproductionEvent} deleteReproductionEvent={deleteReproductionEvent} healthEvents={healthEvents} saveHealthEvent={saveHealthEvent} deleteHealthEvent={deleteHealthEvent} milkRecords={milkRecords} saveMilkRecord={saveMilkRecord} deleteMilkRecord={deleteMilkRecord} breedingSeasons={breedingSeasons} saveBreedingSeason={saveBreedingSeason} deleteBreedingSeason={deleteBreedingSeason} animals={animals} saveAnimal={saveAnimal} deleteAnimal={deleteAnimal} pastures={pastures} transactions={transactions} saveTransaction={saveTransaction} />;
      case 'agricultura': return <Agricultura talhoes={talhoes} saveTalhao={saveTalhao} deleteTalhao={deleteTalhao} cropPlans={cropPlans} saveCropPlan={saveCropPlan} deleteCropPlan={deleteCropPlan} fieldLogEntries={fieldLogEntries} saveFieldLogEntry={saveFieldLogEntry} deleteFieldLogEntry={deleteFieldLogEntry} pestRecords={pestRecords} savePestRecord={savePestRecord} deletePestRecord={deletePestRecord} irrigationRecords={irrigationRecords} saveIrrigationRecord={saveIrrigationRecord} deleteIrrigationRecord={deleteIrrigationRecord} scheduledSprays={scheduledSprays} saveScheduledSpray={saveScheduledSpray} deleteScheduledSpray={deleteScheduledSpray} activeProperty={activeProperty} />;
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
            uid={user?.uid}
            onSaveSettings={updateSettings}
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

  // Bloqueio de acesso por assinatura — nunca bloqueia o próprio admin
  // (ele precisa entrar mesmo assim pra poder corrigir qualquer coisa).
  // Contas "Atrasada" continuam entrando normalmente, só com um aviso —
  // bloquear de cara por atraso seria punitivo demais pra uma falha
  // pontual de pagamento.
  const blockingStatuses = [SubscriptionStatus.BLOQUEADA, SubscriptionStatus.CANCELADA, SubscriptionStatus.SUSPENSA];
  if (!isBootstrapAdmin && mySubscription && blockingStatuses.includes(mySubscription.status)) {
    const reasonText: Record<string, string> = {
      [SubscriptionStatus.BLOQUEADA]: 'Sua conta foi bloqueada pelo administrador.',
      [SubscriptionStatus.CANCELADA]: 'Sua assinatura foi cancelada.',
      [SubscriptionStatus.SUSPENSA]: 'Sua conta está suspensa temporariamente.',
    };
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-theme-card p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <ShieldAlert size={48} className="text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-theme-primary">Acesso indisponível</h1>
          <p className="text-sm text-theme-secondary">{reasonText[mySubscription.status]}</p>
          {mySubscription.suspendedReason && (
            <p className="text-xs text-theme-secondary bg-theme-secondary rounded-xl p-3">{mySubscription.suspendedReason}</p>
          )}
          <p className="text-xs text-theme-secondary">
            Dúvidas ou para regularizar, entre em contato: <strong>admmeuarmazem@gmail.com</strong>
          </p>
          <button onClick={handleLogout} className="text-xs font-semibold text-theme-secondary underline">
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  // Novo fluxo de teste: 3 dias grátis sem precisar de cartão, depois um
  // convite pra cadastrar pagamento e testar por mais 7 dias (10 no
  // total). Se um meio de pagamento já foi cadastrado (externalSubscriptionId
  // existe), o próprio gateway cuida do período de teste dele e cobra
  // sozinho depois — o app só respeita o status que o webhook define.
  const trialDaysUsed = mySubscription?.status === SubscriptionStatus.TRIAL
    ? Math.floor((Date.now() - new Date(mySubscription.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const hasPaymentMethodOnFile = !!mySubscription?.externalSubscriptionId;
  const inFreePhase = trialDaysUsed < 3;
  const inExtendedTrialWindow = trialDaysUsed >= 3 && trialDaysUsed < 10 && !hasPaymentMethodOnFile;
  const trialExpired = mySubscription?.status === SubscriptionStatus.TRIAL && trialDaysUsed >= 10 && !hasPaymentMethodOnFile;

  if (!isBootstrapAdmin && trialExpired) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-theme-card p-4 overflow-y-auto">
        <div className="max-w-sm w-full text-center space-y-4 py-8">
          <CreditCard size={48} className="text-[var(--primary)] mx-auto" />
          <h1 className="text-xl font-bold text-theme-primary">Seu período de teste terminou</h1>
          <p className="text-sm text-theme-secondary">Assine um plano para continuar usando o Agro Gestão.</p>
          <MinhaAssinatura uid={user?.uid || ''} />
          <button onClick={handleLogout} className="text-xs font-semibold text-theme-secondary underline">
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-theme-card overflow-hidden">
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
            <motion.div
              initial={false}
              animate={{ opacity: isSidebarOpen ? 1 : 0 }}
              className="flex items-center gap-2 whitespace-nowrap overflow-hidden"
            >
              <Logo size={28} />
              <h1 className="font-serif italic font-bold text-xl" style={{ color: 'var(--primary)' }}>
                Agro Gestão
              </h1>
            </motion.div>
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

              {/* Help Button */}
              <button
                onClick={() => setIsHelpOpen(true)}
                className="p-2 rounded-full bg-theme-secondary text-theme-secondary transition-colors"
                title="Ajuda — como usar o aplicativo"
              >
                <HelpCircle size={20} />
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

        {isHelpOpen && <HelpScreen onClose={() => setIsHelpOpen(false)} />}

        {/* Permission Restriction Banner */}
        {userRole === 'user' && (
          <div className="mx-4 md:mx-6 mt-3 mb-2">
            <div className="relative overflow-hidden rounded-xl bg-theme-card border border-amber-200 shadow-sm">
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
                      <span className="hidden sm:inline text-theme-secondary text-xs">•</span>
                      <span className="text-[11px] text-theme-secondary">Modo de visualização ativo</span>
                    </div>
                    <p className="text-xs text-theme-secondary mt-0.5 leading-relaxed">
                      Edições, adições e exclusões de registros estão desativadas neste perfil.
                    </p>
                  </div>
                </div>
                
                <div className="flex-shrink-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-theme-secondary rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]"></div>
                    <span className="text-[9px] font-semibold text-theme-secondary uppercase tracking-wider">
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
                  <div className="p-0.5 bg-theme-card/20 rounded-lg animate-pulse">
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
                  <div className="p-0.5 bg-theme-card/30 rounded-lg">
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

        <div className={activeView === 'clima' ? '' : 'p-4 md:p-6 max-w-[1600px] mx-auto w-full'}>
          {mySubscription?.status === SubscriptionStatus.ATRASADA && activeView !== 'minha-assinatura' && activeView !== 'clima' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-red-700 font-semibold">⚠️ Seu pagamento está atrasado — regularize para evitar a suspensão do acesso.</p>
              <button onClick={() => setActiveView('minha-assinatura')} className="text-xs font-bold text-red-700 underline shrink-0">
                Ver assinatura
              </button>
            </div>
          )}
          {!isBootstrapAdmin && inExtendedTrialWindow && activeView !== 'minha-assinatura' && activeView !== 'clima' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-amber-800 font-semibold">
                🎁 Seus 3 dias grátis acabaram — assine um plano para ganhar mais 7 dias de teste, podendo cancelar a qualquer momento sem cobrança. Faltam {10 - trialDaysUsed} dia(s) antes do acesso ser bloqueado.
              </p>
              <button onClick={() => setActiveView('minha-assinatura')} className="text-xs font-bold text-amber-800 underline shrink-0">
                Assinar plano
              </button>
            </div>
          )}
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