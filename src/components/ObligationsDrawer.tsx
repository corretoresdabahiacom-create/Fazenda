import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Calendar, 
  Receipt, 
  Clock, 
  Info,
  Check,
  BellRing
} from 'lucide-react';
import { ObligationAlert } from '../utils/obligations';
import { NotificationService } from '../utils/notificationService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  alerts: ObligationAlert[];
  onMarkConcluded: (alert: ObligationAlert) => Promise<void>;
}

export default function ObligationsDrawer({ isOpen, onClose, alerts, onMarkConcluded }: Props) {
  // Store session-level dismissed alert keys.
  // "Se o usuário fechar sem concluir a mensagem continuará aparecendo"
  // This complies: if they hide it temporarily, it is hidden in the current local state,
  // but continues to belong in the alerts count and reappears next session or toggle.
  const [softDismissedIds, setSoftDismissedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const [notificationState, setNotificationState] = useState(() => NotificationService.getState());

  const handleSubscribeNotifications = async () => {
    const newState = await NotificationService.requestPermission();
    setNotificationState(newState);
  };

  const handleTestNotification = () => {
    NotificationService.sendLocalNotification(
      '🔔 Teste de Notificação FCM',
      'Sucesso! As notificações do FCM estão funcionando e alertarão sobre tarefas expirando.'
    );
  };

  const visibleAlerts = alerts.filter(a => !softDismissedIds.includes(a.id));

  const handleConclude = async (alert: ObligationAlert) => {
    setIsProcessing(alert.id);
    try {
      await onMarkConcluded(alert);
    } catch (error) {
      console.error('Erro ao concluir obrigação:', error);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleSoftDismiss = (alertId: string) => {
    setSoftDismissedIds(prev => [...prev, alertId]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay mask */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 pointer-events-auto"
          />

          {/* Drawer container */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-[#e5e0d8] shadow-2xl z-50 flex flex-col pointer-events-auto"
          >
            {/* Header */}
            <div className="p-6 border-b border-[#e5e0d8] flex items-center justify-between bg-[#fcfaf7]">
              <div>
                <h3 className="font-serif italic font-bold text-xl text-[#3d5a45] flex items-center gap-2">
                  <Clock size={20} className="text-[#3d5a45]" />
                  Central de Obrigações
                </h3>
                <p className="text-[#8d8a86] text-xs mt-0.5 font-medium">
                  Acompanhamento de prazos e vencimentos
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-[#f5f2ed] rounded-xl text-[#6d6a66] hover:text-[#2d2a26] transition-colors"
                title="Fechar Painel"
                id="close-obligations-drawer-btn"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* FCM / Web Push Notification Manager Card */}
              <div className="p-4 bg-emerald-50/20 border border-emerald-100 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-800 dark:text-[#5fa875] font-extrabold text-[10px] uppercase">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Alertas Push (FCM / Browser)
                  </div>
                  <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-100/50 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded">
                    {notificationState.permission === 'granted' ? 'ATIVADO' : 'PENDENTE'}
                  </span>
                </div>
                
                <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 leading-normal font-medium">
                  Ative o serviço para receber alertas automáticos na sua área de trabalho sobre tarefas expirando hoje ou obrigações com prazo vencido.
                </p>
                
                <div className="flex flex-col gap-2 pt-1">
                  {notificationState.permission !== 'granted' ? (
                    <button
                      onClick={handleSubscribeNotifications}
                      className="text-xs font-black uppercase text-center bg-emerald-700 hover:bg-emerald-800 text-white py-2 rounded-xl shadow-sm transition-all cursor-pointer"
                    >
                      🔓 Permitir Notificações FCM
                    </button>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={handleTestNotification}
                        className="text-xs font-black uppercase text-center border border-emerald-600 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-50/50 py-1.5 rounded-xl transition-all cursor-pointer"
                      >
                        🔔 Enviar Notificação de Teste
                      </button>
                      {notificationState.fcmToken && (
                        <div className="bg-[#fcfaf7] dark:bg-zinc-800/50 px-2.5 py-1.5 rounded-lg border text-[8px] font-mono text-zinc-400 dark:text-zinc-550 break-all select-all">
                          FCM Token: {notificationState.fcmToken}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {alerts.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-green-600" />
                  </div>
                  <h4 className="font-bold text-[#2d2a26] text-sm">Nenhuma obrigação próxima!</h4>
                  <p className="text-xs text-[#8d8a86] mt-1 max-w-[240px] mx-auto leading-relaxed">
                    Parabéns! Todas as suas tarefas e contas a pagar estão em dia ou longe do vencimento.
                  </p>
                </div>
              ) : visibleAlerts.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 bg-[#f5f2ed] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Info size={32} className="text-[#8d8a86]" />
                  </div>
                  <h4 className="font-bold text-[#2d2a26] text-sm">Itens ocultados temporariamente</h4>
                  <p className="text-xs text-[#8d8a86] mt-1 max-w-[240px] mx-auto leading-relaxed">
                    Você ocultou as mensagens nesta visualização, mas as obrigações continuam ativas até serem concluídas.
                  </p>
                  <button 
                    onClick={() => setSoftDismissedIds([])}
                    className="mt-4 text-xs font-bold text-[#3d5a45] hover:underline"
                    id="reset-hidden-alerts-btn"
                  >
                    Mostrar todos ({alerts.length})
                  </button>
                </div>
              ) : (
                visibleAlerts.map((alert) => {
                  // Determine cards colors based on overdue rules
                  // daysRemaining < 0 -> Overdue (Red)
                  // daysRemaining === 0 -> Today (Yellow)
                  // daysRemaining > 0 -> Upcoming (White/Cream/Light Orange border)
                  const isOverdue = alert.daysRemaining < 0;
                  const isToday = alert.daysRemaining === 0;

                  let cardClasses = '';
                  let badgeClasses = '';
                  let badgeText = '';

                  if (isOverdue) {
                    cardClasses = 'border-l-4 border-l-red-500 border border-[#e5e0d8] bg-red-50/60 shadow-sm';
                    badgeClasses = 'bg-red-100 text-red-700 border border-red-200';
                    const absDays = Math.abs(alert.daysRemaining);
                    badgeText = `ATRASADO Há ${absDays} ${absDays === 1 ? 'dia' : 'dias'}!`;
                  } else if (isToday) {
                    cardClasses = 'border-l-4 border-l-amber-500 border border-[#e5e0d8] bg-amber-50 shadow-sm';
                    badgeClasses = 'bg-amber-100 text-amber-800 border border-amber-200';
                    badgeText = 'VENCE HOJE!';
                  } else {
                    cardClasses = 'border-l-4 border-l-emerald-600 border border-[#e5e0d8] bg-white hover:border-[#3d5a45]/30 transition-all shadow-sm';
                    badgeClasses = 'bg-emerald-50 text-emerald-800 border border-emerald-100';
                    badgeText = `Vence em ${alert.daysRemaining} ${alert.daysRemaining === 1 ? 'dia' : 'dias'}`;
                  }

                  return (
                    <motion.div
                      key={alert.id}
                      layout
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className={`p-5 rounded-2xl relative flex flex-col gap-3 ${cardClasses}`}
                    >
                      {/* Top Bar inside Card */}
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-full ${badgeClasses}`}>
                          {badgeText}
                        </span>
                        
                        {/* Soft Dismiss Item close button */}
                        <button
                          onClick={() => handleSoftDismiss(alert.id)}
                          className="p-1 hover:bg-black/5 rounded-lg text-[#8d8a86] hover:text-[#2d2a26] transition-colors"
                          title="Ocultar provisoriamente"
                          id={`dismiss-alert-${alert.id}`}
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Info layout */}
                      <div className="flex gap-3">
                        <div className="p-2.5 rounded-xl bg-white border border-[#e5e0d8] text-[#3d5a45] h-fit self-start shadow-inner">
                          {alert.type === 'task' ? (
                            <Calendar size={18} />
                          ) : (
                            <Receipt size={18} />
                          )}
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-[#2d2a26] leading-snug">
                            {alert.title}
                          </h4>
                          <p className="text-xs text-[#6d6a66] leading-relaxed">
                            {alert.description}
                          </p>
                          {alert.value !== undefined && (
                            <p className="text-sm font-black text-red-650 mt-1">
                              R$ {alert.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                          <p className="text-[10px] text-[#8d8a86] mt-1 font-mono uppercase">
                            Prazo: {alert.dueDate.split('-').reverse().join('/')}
                          </p>
                        </div>
                      </div>

                      {/* Card Action footer */}
                      <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-dashed border-[#e5e0d8]">
                        <button
                          onClick={() => handleSoftDismiss(alert.id)}
                          className="text-xs px-3 py-1.5 border border-[#e5e0d8] hover:bg-[#f5f2ed] rounded-lg font-bold text-[#6d6a66] transition-colors"
                          id={`soft-close-btn-${alert.id}`}
                        >
                          Fechar
                        </button>
                        <button
                          onClick={() => handleConclude(alert)}
                          disabled={isProcessing === alert.id}
                          className="flex items-center gap-1.5 text-xs px-4 py-1.5 bg-[#3d5a45] text-white hover:bg-[#2d4334] rounded-lg font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                          id={`conclude-btn-${alert.id}`}
                        >
                          {isProcessing === alert.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Check size={14} />
                          )}
                          Concluir
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Help/Disclaimer Footer banner */}
            {alerts.length > 0 && (
              <div className="p-4 bg-[#fcfaf7] border-t border-[#e5e0d8] flex gap-3 text-xs text-[#6d6a66] leading-relaxed">
                <Info size={16} className="text-[#3d5a45] shrink-0 mt-0.5" />
                <span className="font-medium">
                  <strong>Aviso:</strong> A opção <em>Fechar</em> apenas oculta a mensagem no seu navegador atual. Ela continuará atualizando o prazo diariamente e voltará a aparecer até que você selecione <strong>Concluir</strong>.
                </span>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
