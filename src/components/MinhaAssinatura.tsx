/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Subscription, SubscriptionStatus, PlanTier, PLAN_PRICES } from '../types';
import {
  CreditCard, CheckCircle2, AlertTriangle, XCircle, Gift, Bell, Wallet, Beef, CloudSun, Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';

const statusInfo: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  [SubscriptionStatus.ATIVA]: { color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle2, label: 'Sua assinatura está ativa.' },
  [SubscriptionStatus.ATRASADA]: { color: 'text-red-600 bg-red-50 border-red-200', icon: AlertTriangle, label: 'Seu pagamento está atrasado.' },
  [SubscriptionStatus.CANCELADA]: { color: 'text-gray-600 bg-gray-100 border-gray-200', icon: XCircle, label: 'Sua assinatura foi cancelada.' },
  [SubscriptionStatus.SUSPENSA]: { color: 'text-orange-600 bg-orange-50 border-orange-200', icon: AlertTriangle, label: 'Sua conta está suspensa temporariamente.' },
  [SubscriptionStatus.BLOQUEADA]: { color: 'text-red-700 bg-red-100 border-red-300', icon: XCircle, label: 'Sua conta está bloqueada.' },
};

const MINI_BENEFITS = [
  { icon: Bell, text: 'Nunca mais esqueça vacina, remanejo ou conta a pagar' },
  { icon: Wallet, text: 'Financeiro claro: contas, centro de custo e fluxo de caixa' },
  { icon: Beef, text: 'Rebanho do lote ao indivíduo, com reprodução e leite' },
  { icon: CloudSun, text: 'Clima entra na decisão de pulverizar e manejar' },
  { icon: Sparkles, text: 'Consultor Rural incluso, sem custo extra' },
];

export default function MinhaAssinatura({ uid }: { uid: string }) {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(PlanTier.UMA_FAZENDA);
  const [selectedGateway, setSelectedGateway] = useState<'mercadopago' | 'stripe' | 'paypal'>('mercadopago');
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'subscriptions', uid), (snap) => {
      setSub(snap.exists() ? (snap.data() as Subscription) : null);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [uid]);

  async function handleSubscribe() {
    if (!sub) return;
    setCheckingOut(true);
    setCheckoutError(null);
    const endpoints: Record<string, string> = {
      mercadopago: '/api/create-subscription',
      stripe: '/api/create-subscription-stripe',
      paypal: '/api/create-subscription-paypal',
    };
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(endpoints[selectedGateway], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          uid,
          email: sub.email,
          plan: selectedPlan,
          appUrl: window.location.origin,
        }),
      });
      const data = await res.json();
      const redirectUrl = data.initPoint || data.checkoutUrl || data.approvalLink;
      if (!res.ok || !redirectUrl) {
        setCheckoutError(data.error || 'Não foi possível iniciar o pagamento agora.');
        return;
      }
      window.location.href = redirectUrl;
    } catch {
      setCheckoutError('Falha de conexão ao iniciar o pagamento. Tente novamente.');
    } finally {
      setCheckingOut(false);
    }
  }

  async function handleCancel() {
    if (!sub) return;
    if (!confirm('Tem certeza que deseja cancelar sua assinatura? Você perde o acesso ao final do período já pago.')) return;
    try {
      await setDoc(doc(db, 'subscriptions', uid), {
        ...sub,
        status: SubscriptionStatus.CANCELADA,
        canceledAt: new Date().toISOString(),
        canceledBy: 'user',
      }, { merge: true });
    } catch {
      alert('Não foi possível cancelar agora. Tente novamente em instantes.');
    }
  }

  if (loading) return <div className="p-6 text-sm text-theme-secondary">Carregando...</div>;

  if (!sub) {
    return <div className="p-6 text-sm text-theme-secondary">Nenhuma informação de assinatura encontrada ainda.</div>;
  }

  const price = sub.customPrice ?? (sub.plan ? PLAN_PRICES[sub.plan as PlanTier] : null);
  const isTrial = sub.status === SubscriptionStatus.TRIAL;
  const trialDaysUsed = isTrial
    ? Math.floor((Date.now() - new Date(sub.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const hasPaymentMethodOnFile = !!sub.externalSubscriptionId;
  const inFreePhase = isTrial && trialDaysUsed < 3 && !hasPaymentMethodOnFile;
  const inExtendedTrial = isTrial && trialDaysUsed >= 3 && !hasPaymentMethodOnFile;
  const daysLeftFree = Math.max(0, 3 - trialDaysUsed);
  const daysLeftExtended = Math.max(0, 10 - trialDaysUsed);

  let info = statusInfo[sub.status] || statusInfo[SubscriptionStatus.ATIVA];
  if (inFreePhase) {
    info = { color: 'text-[var(--primary)] bg-[var(--primary-soft)] border-[var(--primary)]/30', icon: Gift, label: `Você está no seu teste grátis de 3 dias — restam ${daysLeftFree} dia(s), sem precisar de cartão.` };
  } else if (inExtendedTrial) {
    info = { color: 'text-amber-700 bg-amber-50 border-amber-200', icon: AlertTriangle, label: `Assine um plano para ganhar mais 7 dias de teste grátis, podendo cancelar a qualquer momento sem cobrança — restam ${daysLeftExtended} dia(s) antes do acesso ser bloqueado.` };
  }

  const showUpsell = sub.status !== SubscriptionStatus.ATIVA;

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-theme-primary flex items-center gap-2">
          <CreditCard className="text-primary" size={20} /> Minha Assinatura
        </h1>
      </div>

      <div className={`rounded-2xl border p-4 flex items-start gap-3 ${info.color}`}>
        <info.icon size={20} className="shrink-0 mt-0.5" />
        <p className="font-semibold text-sm">{info.label}</p>
      </div>

      <div className="bg-theme-card rounded-2xl border border-theme p-5 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-theme-secondary">Plano atual</span>
          <span className="font-bold text-theme-primary">{sub.plan}</span>
        </div>
        {price != null && (
          <div className="flex justify-between text-sm">
            <span className="text-theme-secondary">Valor mensal</span>
            <span className="font-bold text-theme-primary">R$ {price.toFixed(2)}</span>
          </div>
        )}
        {sub.currentPeriodEnd && (
          <div className="flex justify-between text-sm">
            <span className="text-theme-secondary">Válido até</span>
            <span className="font-bold text-theme-primary">{format(new Date(sub.currentPeriodEnd), 'dd/MM/yyyy')}</span>
          </div>
        )}
        {sub.lastPaymentDate && (
          <div className="flex justify-between text-sm">
            <span className="text-theme-secondary">Último pagamento</span>
            <span className="font-bold text-theme-primary">{format(new Date(sub.lastPaymentDate), 'dd/MM/yyyy')}{sub.lastPaymentValue ? ` — R$ ${sub.lastPaymentValue.toFixed(2)}` : ''}</span>
          </div>
        )}
      </div>

      {sub.plan === PlanTier.AGRO_TOTAL && (
        <p className="text-xs text-theme-secondary bg-theme-secondary rounded-xl p-3">
          O plano Agro Total tem valor combinado diretamente com nossa equipe — entre em contato pelo e-mail de suporte para qualquer ajuste.
        </p>
      )}

      {showUpsell && (
        <div className="bg-theme-card rounded-2xl border border-theme p-5 space-y-3">
          <h2 className="font-bold text-theme-primary text-sm">O que você continua tendo ao assinar</h2>
          <div className="space-y-2">
            {MINI_BENEFITS.map((b, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <b.icon size={16} className="text-[var(--primary)] shrink-0" />
                <p className="text-xs text-theme-secondary">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showUpsell && (
        <div className="bg-theme-card rounded-2xl border border-theme p-5 space-y-3">
          <h2 className="font-bold text-theme-primary text-sm">Escolha o plano do tamanho da sua operação</h2>
          <div className="space-y-2">
            {([PlanTier.UMA_FAZENDA, PlanTier.TRES_FAZENDAS, PlanTier.CINCO_FAZENDAS] as PlanTier[]).map((plan) => (
              <label key={plan} className={`flex items-center justify-between border rounded-xl p-3 cursor-pointer ${selectedPlan === plan ? 'border-[var(--primary)] bg-[var(--primary-soft)]' : 'border-theme'}`}>
                <span className="flex items-center gap-2 text-sm font-semibold text-theme-primary">
                  <input type="radio" name="plan" checked={selectedPlan === plan} onChange={() => setSelectedPlan(plan)} />
                  {plan}
                </span>
                <span className="text-sm font-bold text-[var(--primary)]">R$ {PLAN_PRICES[plan]?.toFixed(2)}/mês</span>
              </label>
            ))}
          </div>
          {checkoutError && <p className="text-xs text-red-500">{checkoutError}</p>}
          <div>
            <p className="text-xs font-semibold text-theme-secondary mb-1.5">Forma de pagamento</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                { id: 'mercadopago', label: 'Mercado Pago' },
                { id: 'stripe', label: 'Cartão (Stripe)' },
                { id: 'paypal', label: 'PayPal' },
              ] as const).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGateway(g.id)}
                  className={`text-xs font-bold py-2 rounded-xl border ${selectedGateway === g.id ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]' : 'border-theme text-theme-secondary'}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleSubscribe} disabled={checkingOut} className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white py-3 rounded-xl font-bold text-sm disabled:opacity-60">
            {checkingOut ? 'Abrindo pagamento seguro...' : inFreePhase || inExtendedTrial ? 'Assinar plano (mais 7 dias grátis)' : 'Assinar agora'}
          </button>
          <p className="text-[10px] text-theme-secondary text-center">
            Você será redirecionado para a página segura do provedor escolhido — nunca guardamos dados do seu cartão neste aplicativo.
            {inFreePhase || inExtendedTrial ? ' Você tem 7 dias para cancelar sem que nenhum valor seja cobrado — a primeira mensalidade só sai automaticamente se você não cancelar até lá.' : ''}
          </p>
        </div>
      )}

      {sub.status !== SubscriptionStatus.CANCELADA && sub.status !== SubscriptionStatus.BLOQUEADA && (
        <button onClick={handleCancel} className="w-full border border-red-300 text-red-600 py-2.5 rounded-xl font-semibold text-sm hover:bg-red-50">
          Cancelar assinatura
        </button>
      )}

      <p className="text-[11px] text-theme-secondary text-center">
        Dúvidas sobre cobrança? Fale com o suporte: admmeuarmazem@gmail.com
      </p>
    </div>
  );
}
