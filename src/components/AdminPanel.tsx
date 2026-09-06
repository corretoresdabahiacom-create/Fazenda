/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  collection, onSnapshot, doc, setDoc, deleteDoc, query as fsQuery,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import {
  Users, DollarSign, TrendingDown, Bell, Image as ImageIcon, Receipt,
  Trash2, Plus, X, ShieldOff, ShieldAlert, Ban, CheckCircle2, Search,
} from 'lucide-react';
import {
  UserDirectoryEntry, Subscription, SubscriptionStatus, PlanTier, PLAN_PRICES,
  AdminNotification, Advertisement, AdContentType, AppExpense,
} from '../types';
import { format } from 'date-fns';
import { compressImageIfNeeded, fileToDataUrl } from '../lib/imageCompression';

type Tab = 'visao_geral' | 'usuarios' | 'notificacoes' | 'anuncios' | 'despesas';

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'visao_geral', label: 'Visão Geral', icon: TrendingDown },
  { id: 'usuarios', label: 'Usuários', icon: Users },
  { id: 'notificacoes', label: 'Notificações', icon: Bell },
  { id: 'anuncios', label: 'Publicidade', icon: ImageIcon },
  { id: 'despesas', label: 'Despesas do App', icon: Receipt },
];

export default function AdminPanel({ adminEmail }: { adminEmail: string }) {
  const [tab, setTab] = useState<Tab>('visao_geral');
  const [users, setUsers] = useState<UserDirectoryEntry[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [appExpenses, setAppExpenses] = useState<AppExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubs = [
      onSnapshot(fsQuery(collection(db, 'userDirectory')), (snap) => {
        setUsers(snap.docs.map(d => d.data() as UserDirectoryEntry));
        setLoading(false);
      }, (err) => setError('Não foi possível carregar usuários: ' + err.message)),
      onSnapshot(fsQuery(collection(db, 'subscriptions')), (snap) => {
        setSubscriptions(snap.docs.map(d => d.data() as Subscription));
      }, (err) => setError('Não foi possível carregar assinaturas: ' + err.message)),
      onSnapshot(fsQuery(collection(db, 'adminNotifications')), (snap) => {
        setNotifications(snap.docs.map(d => d.data() as AdminNotification));
      }),
      onSnapshot(fsQuery(collection(db, 'advertisements')), (snap) => {
        setAds(snap.docs.map(d => d.data() as Advertisement).sort((a, b) => a.order - b.order));
      }),
      onSnapshot(fsQuery(collection(db, 'appExpenses')), (snap) => {
        setAppExpenses(snap.docs.map(d => d.data() as AppExpense));
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-theme-secondary">Carregando painel administrativo...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-500 bg-red-50 rounded-xl m-4">{error}</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-theme-primary flex items-center gap-2">
          <ShieldAlert className="text-primary" size={20} /> Painel Admin
        </h1>
        <p className="text-sm text-theme-secondary">Logado como {adminEmail} — visível só para administradores do sistema.</p>
      </div>

      <div className="flex gap-1 bg-theme-secondary p-1 rounded-xl overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-theme-card text-primary shadow-sm' : 'text-theme-secondary'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'visao_geral' && <VisaoGeralTab users={users} subscriptions={subscriptions} appExpenses={appExpenses} />}
      {tab === 'usuarios' && <UsuariosTab users={users} subscriptions={subscriptions} adminEmail={adminEmail} />}
      {tab === 'notificacoes' && <NotificacoesTab notifications={notifications} users={users} adminEmail={adminEmail} />}
      {tab === 'anuncios' && <AnunciosTab ads={ads} adminEmail={adminEmail} />}
      {tab === 'despesas' && <DespesasTab expenses={appExpenses} />}
    </div>
  );
}

// ---------- Visão Geral ----------

function VisaoGeralTab({ users, subscriptions, appExpenses }: {
  users: UserDirectoryEntry[]; subscriptions: Subscription[]; appExpenses: AppExpense[];
}) {
  const totalUsers = users.filter(u => !u.deleted).length;
  const deletedUsers = users.filter(u => u.deleted).length;

  const countByStatus = (status: SubscriptionStatus) => subscriptions.filter(s => s.status === status).length;
  const active = countByStatus(SubscriptionStatus.ATIVA);
  const trial = countByStatus(SubscriptionStatus.TRIAL);
  const overdue = countByStatus(SubscriptionStatus.ATRASADA);
  const canceled = countByStatus(SubscriptionStatus.CANCELADA);
  const suspended = countByStatus(SubscriptionStatus.SUSPENSA);
  const blocked = countByStatus(SubscriptionStatus.BLOQUEADA);

  const currentMonth = format(new Date(), 'yyyy-MM');
  const revenueThisMonth = subscriptions.reduce((sum, s) => {
    const paidThisMonth = (s.paymentHistory || []).filter(p => p.date.startsWith(currentMonth) && p.status === 'approved');
    return sum + paidThisMonth.reduce((s2, p) => s2 + p.value, 0);
  }, 0);
  const expensesThisMonth = appExpenses.filter(e => e.date.startsWith(currentMonth)).reduce((s, e) => s + e.value, 0);

  const cards = [
    { label: 'Usuários ativos', value: totalUsers, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Assinaturas ativas', value: active, icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
    { label: 'Em teste grátis', value: trial, icon: ShieldAlert, color: 'text-amber-600 bg-amber-50' },
    { label: 'Inadimplentes (atrasados)', value: overdue, icon: TrendingDown, color: 'text-red-600 bg-red-50' },
    { label: 'Cancelados', value: canceled, icon: X, color: 'text-gray-600 bg-gray-100' },
    { label: 'Suspensos', value: suspended, icon: ShieldOff, color: 'text-orange-600 bg-orange-50' },
    { label: 'Bloqueados', value: blocked, icon: Ban, color: 'text-red-700 bg-red-100' },
    { label: 'Excluídos', value: deletedUsers, icon: Trash2, color: 'text-gray-600 bg-gray-100' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-theme-card rounded-2xl border border-theme p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${c.color}`}>
              <c.icon size={16} />
            </div>
            <p className="text-2xl font-bold text-theme-primary">{c.value}</p>
            <p className="text-[11px] text-theme-secondary">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-theme-card rounded-2xl border border-theme p-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 text-green-600 bg-green-50">
            <DollarSign size={16} />
          </div>
          <p className="text-2xl font-bold text-green-600">R$ {revenueThisMonth.toFixed(2)}</p>
          <p className="text-[11px] text-theme-secondary">Receita confirmada este mês</p>
        </div>
        <div className="bg-theme-card rounded-2xl border border-theme p-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 text-red-600 bg-red-50">
            <Receipt size={16} />
          </div>
          <p className="text-2xl font-bold text-red-500">R$ {expensesThisMonth.toFixed(2)}</p>
          <p className="text-[11px] text-theme-secondary">Despesas do app este mês</p>
        </div>
      </div>

      <p className="text-xs text-theme-secondary bg-theme-secondary rounded-xl p-3">
        A receita só fica real depois que um gateway de pagamento (Mercado Pago, Stripe ou PayPal) estiver conectado
        e processando cobranças de verdade — por enquanto, todo novo usuário começa automaticamente em "Teste".
      </p>
    </div>
  );
}

// ---------- Usuários ----------

function UsuariosTab({ users, subscriptions, adminEmail }: {
  users: UserDirectoryEntry[]; subscriptions: Subscription[]; adminEmail: string;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function handleSyncAll() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin-sync-users', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncMessage(data.error || 'Falha ao sincronizar.');
      } else {
        setSyncMessage(`${data.totalSynced} de ${data.totalSeen} conta(s) sincronizada(s) com sucesso.`);
      }
    } catch {
      setSyncMessage('Falha de conexão ao sincronizar.');
    } finally {
      setSyncing(false);
    }
  }

  const subByUser = (uid: string) => subscriptions.find(s => s.userId === uid);

  function daysSince(dateStr?: string): number | null {
    if (!dateStr) return null;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  }

  function trialPhase(sub?: Subscription): 'free' | 'extended' | null {
    if (!sub || sub.status !== SubscriptionStatus.TRIAL || sub.externalSubscriptionId) return null;
    const d = daysSince(sub.createdAt);
    if (d === null) return null;
    if (d < 3) return 'free';
    if (d < 10) return 'extended';
    return null;
  }

  const filtered = users.filter(u => {
    if (search && !u.email.toLowerCase().includes(search.toLowerCase()) && !(u.displayName || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'todos') {
      const sub = subByUser(u.userId);
      if (statusFilter === 'excluido') return !!u.deleted;
      if (statusFilter === 'teste_3d') return trialPhase(sub) === 'free';
      if (statusFilter === 'teste_7d') return trialPhase(sub) === 'extended';
      if (statusFilter === 'inativo_30') { const d = daysSince(u.lastLoginAt); return d !== null && d >= 30; }
      if (statusFilter === 'inativo_60') { const d = daysSince(u.lastLoginAt); return d !== null && d >= 60; }
      if (statusFilter === 'inativo_90') { const d = daysSince(u.lastLoginAt); return d !== null && d >= 90; }
      return sub?.status === statusFilter;
    }
    return true;
  });

  async function updateStatus(uid: string, status: SubscriptionStatus, reason?: string) {
    const existing = subByUser(uid);
    await setDoc(doc(db, 'subscriptions', uid), {
      ...(existing || { userId: uid, email: users.find(u => u.userId === uid)?.email || '', plan: PlanTier.AGRO_TOTAL, createdAt: new Date().toISOString() }),
      status,
      suspendedReason: reason,
      suspendedBy: adminEmail,
    }, { merge: true });
  }

  async function toggleDeleted(u: UserDirectoryEntry) {
    await setDoc(doc(db, 'userDirectory', u.userId), {
      ...u,
      deleted: !u.deleted,
      deletedAt: !u.deleted ? new Date().toISOString() : undefined,
    }, { merge: true });
  }

  const statusColor: Record<string, string> = {
    [SubscriptionStatus.ATIVA]: 'bg-green-100 text-green-700',
    [SubscriptionStatus.TRIAL]: 'bg-amber-100 text-amber-700',
    [SubscriptionStatus.ATRASADA]: 'bg-red-100 text-red-700',
    [SubscriptionStatus.CANCELADA]: 'bg-gray-100 text-gray-600',
    [SubscriptionStatus.SUSPENSA]: 'bg-orange-100 text-orange-700',
    [SubscriptionStatus.BLOQUEADA]: 'bg-red-200 text-red-800',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="flex items-center gap-2 bg-theme-secondary text-theme-primary px-4 py-2 rounded-xl font-semibold text-xs disabled:opacity-60"
        >
          {syncing ? 'Sincronizando...' : 'Sincronizar todos os usuários do Firebase'}
        </button>
      </div>
      {syncMessage && <p className="text-xs text-theme-secondary bg-theme-secondary rounded-xl p-2">{syncMessage}</p>}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por e-mail ou nome..."
            className="w-full pl-9 pr-3 py-2 bg-theme-card border border-theme rounded-xl text-sm"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-theme-card border border-theme rounded-xl px-3 py-2 text-sm">
          <option value="todos">Todos os status</option>
          {Object.values(SubscriptionStatus).map(s => <option key={s} value={s}>{s}</option>)}
          <option value="excluido">Excluídos</option>
          <option value="teste_3d">Em teste grátis (3 dias)</option>
          <option value="teste_7d">Em teste estendido (7 dias)</option>
          <option value="inativo_30">Inativo há 30+ dias</option>
          <option value="inativo_60">Inativo há 60+ dias</option>
          <option value="inativo_90">Inativo há 90+ dias</option>
        </select>
      </div>

      <div className="bg-theme-card rounded-2xl border border-theme overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-theme-secondary text-theme-secondary text-xs uppercase">
            <tr>
              <th className="text-left p-3">Usuário</th>
              <th className="text-left p-3">Cidade/Região</th>
              <th className="text-left p-3">Plano</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Última vez</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme">
            {filtered.map(u => {
              const sub = subByUser(u.userId);
              return (
                <tr key={u.userId} className={u.deleted ? 'opacity-50' : ''}>
                  <td className="p-3">
                    <p className="font-bold text-theme-primary">{u.displayName || u.email}</p>
                    <p className="text-xs text-theme-secondary">{u.email}</p>
                  </td>
                  <td className="p-3 text-theme-secondary">{[u.city, u.region].filter(Boolean).join(' / ') || '—'}</td>
                  <td className="p-3 text-theme-secondary">{sub?.plan || '—'}</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${statusColor[sub?.status || ''] || 'bg-gray-100 text-gray-500'}`}>
                      {u.deleted ? 'Excluído' : trialPhase(sub) === 'free' ? 'Teste 3 dias' : trialPhase(sub) === 'extended' ? 'Teste 7 dias' : sub?.status || '—'}
                    </span>
                  </td>
                  <td className="p-3">
                    {(() => {
                      const d = daysSince(u.lastLoginAt);
                      if (d === null) return <span className="text-theme-secondary text-xs">—</span>;
                      const color = d >= 90 ? 'text-red-600' : d >= 60 ? 'text-orange-600' : d >= 30 ? 'text-amber-600' : 'text-theme-secondary';
                      return <span className={`text-xs font-semibold ${color}`}>{d === 0 ? 'Hoje' : `há ${d} dia(s)`}</span>;
                    })()}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end flex-wrap">
                      <button title="Ativar" onClick={() => updateStatus(u.userId, SubscriptionStatus.ATIVA)} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"><CheckCircle2 size={14} /></button>
                      <button title="Suspender" onClick={() => updateStatus(u.userId, SubscriptionStatus.SUSPENSA, 'Suspenso pelo admin')} className="p-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100"><ShieldOff size={14} /></button>
                      <button title="Bloquear" onClick={() => updateStatus(u.userId, SubscriptionStatus.BLOQUEADA, 'Bloqueado pelo admin')} className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"><Ban size={14} /></button>
                      <button title="Cancelar" onClick={() => updateStatus(u.userId, SubscriptionStatus.CANCELADA)} className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"><X size={14} /></button>
                      <button title={u.deleted ? 'Restaurar' : 'Excluir'} onClick={() => toggleDeleted(u)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-theme-secondary text-sm">Nenhum usuário encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Notificações ----------

function NotificacoesTab({ notifications, users, adminEmail }: {
  notifications: AdminNotification[]; users: UserDirectoryEntry[]; adminEmail: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'individual' | 'filtered'>('all');
  const [targetUserId, setTargetUserId] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterBirthdayMonth, setFilterBirthdayMonth] = useState('');

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const item: AdminNotification = {
      id: `notif_${Date.now()}`,
      title: title || 'Aviso',
      message,
      targetType,
      targetUserId: targetType === 'individual' ? targetUserId : undefined,
      filter: targetType === 'filtered' ? {
        city: filterCity || undefined,
        region: filterRegion || undefined,
        birthdayMonth: filterBirthdayMonth ? Number(filterBirthdayMonth) : undefined,
      } : undefined,
      createdAt: new Date().toISOString(),
      createdBy: adminEmail,
    };
    await setDoc(doc(db, 'adminNotifications', item.id), item);

    // Além de salvar o aviso (que aparece dentro do app), tenta também
    // mandar um push de verdade pros celulares dos usuários alcançados —
    // silenciosamente ignorado se o push ainda não estiver configurado.
    const targetUsers = users.filter(u => {
      if (u.deleted) return false;
      if (targetType === 'all') return true;
      if (targetType === 'individual') return u.userId === targetUserId;
      if (targetType === 'filtered') {
        if (filterCity && u.city?.toLowerCase() !== filterCity.toLowerCase()) return false;
        if (filterRegion && u.region?.toLowerCase() !== filterRegion.toLowerCase()) return false;
        if (filterBirthdayMonth && Number(u.birthday?.split('-')[0]) !== Number(filterBirthdayMonth)) return false;
        return true;
      }
      return false;
    });
    const tokens = targetUsers.flatMap(u => u.fcmTokens || []);
    if (tokens.length > 0) {
      try {
        await fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokens, title: item.title, body: item.message }),
        });
      } catch {
        // silencioso — o aviso já foi salvo e vai aparecer dentro do app de qualquer forma
      }
    }

    setIsOpen(false);
    setTitle(''); setMessage(''); setTargetUserId(''); setFilterCity(''); setFilterRegion(''); setFilterBirthdayMonth('');
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setIsOpen(true)} className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Nova Notificação
        </button>
      </div>

      <div className="space-y-2">
        {[...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(n => (
          <div key={n.id} className="bg-theme-card rounded-2xl border border-theme p-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-theme-primary text-sm">{n.title}</p>
              <span className="text-[10px] text-theme-secondary">{format(new Date(n.createdAt), 'dd/MM/yyyy HH:mm')}</span>
            </div>
            <p className="text-xs text-theme-secondary mt-1">{n.message}</p>
            <p className="text-[10px] text-theme-secondary mt-2">
              Destino: {n.targetType === 'all' ? 'Todos os usuários' : n.targetType === 'individual' ? `Usuário específico` : `Filtrado (${Object.entries(n.filter || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')})`}
            </p>
          </div>
        ))}
        {notifications.length === 0 && <p className="text-sm text-theme-secondary text-center py-8">Nenhuma notificação enviada ainda.</p>}
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-theme-card rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-theme-primary">Nova Notificação</h2>
              <button onClick={() => setIsOpen(false)}><X size={20} className="text-theme-secondary" /></button>
            </div>
            <form onSubmit={handleSend} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-theme-secondary">Título</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-theme-secondary">Mensagem</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-theme-secondary">Enviar para</label>
                <select value={targetType} onChange={e => setTargetType(e.target.value as any)} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm">
                  <option value="all">Todos os usuários</option>
                  <option value="individual">Usuário específico</option>
                  <option value="filtered">Filtrado (cidade/região/aniversário)</option>
                </select>
              </div>
              {targetType === 'individual' && (
                <div>
                  <label className="text-xs font-semibold text-theme-secondary">Usuário</label>
                  <select value={targetUserId} onChange={e => setTargetUserId(e.target.value)} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm">
                    <option value="">Selecione</option>
                    {users.map(u => <option key={u.userId} value={u.userId}>{u.displayName || u.email}</option>)}
                  </select>
                </div>
              )}
              {targetType === 'filtered' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-theme-secondary">Cidade</label>
                    <input value={filterCity} onChange={e => setFilterCity(e.target.value)} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-theme-secondary">Região/UF</label>
                    <input value={filterRegion} onChange={e => setFilterRegion(e.target.value)} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-theme-secondary">Mês de aniversário</label>
                    <select value={filterBirthdayMonth} onChange={e => setFilterBirthdayMonth(e.target.value)} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm">
                      <option value="">Qualquer mês</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>{format(new Date(2000, m - 1, 1), 'MMMM')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white py-2.5 rounded-xl font-bold text-sm">Enviar</button>
                <button type="button" onClick={() => setIsOpen(false)} className="flex-1 border border-theme py-2.5 rounded-xl font-semibold text-sm text-theme-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Publicidade ----------

function AnunciosTab({ ads, adminEmail }: { ads: Advertisement[]; adminEmail: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<Advertisement>>({ type: AdContentType.TEXTO, active: true });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const MAX_AD_IMAGE_BYTES = 650_000;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setUploadError(null);
    setUploading(true);
    try {
      const compressed = await compressImageIfNeeded(picked, MAX_AD_IMAGE_BYTES);
      if (compressed.size > MAX_AD_IMAGE_BYTES) {
        setUploadError(`Imagem ainda grande demais (${(compressed.size / 1024).toFixed(0)}KB) mesmo após comprimir. Tente uma foto menor.`);
        return;
      }
      const dataUrl = await fileToDataUrl(compressed);
      setForm(f => ({ ...f, imageUrl: dataUrl }));
    } catch {
      setUploadError('Não foi possível processar essa imagem.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const item: Advertisement = {
      id: `ad_${Date.now()}`,
      type: form.type || AdContentType.TEXTO,
      title: form.title,
      text: form.text,
      imageUrl: form.imageUrl,
      videoUrl: form.videoUrl,
      linkUrl: form.linkUrl,
      active: form.active ?? true,
      order: ads.length,
      createdAt: new Date().toISOString(),
      createdBy: adminEmail,
    };
    await setDoc(doc(db, 'advertisements', item.id), item);
    setIsOpen(false);
    setForm({ type: AdContentType.TEXTO, active: true });
  }

  async function toggleActive(ad: Advertisement) {
    await setDoc(doc(db, 'advertisements', ad.id), { ...ad, active: !ad.active }, { merge: true });
  }

  async function handleDelete(id: string) {
    if (confirm('Excluir este anúncio?')) await deleteDoc(doc(db, 'advertisements', id));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-theme-secondary bg-theme-secondary rounded-xl p-3">
        Os anúncios ativos aparecem em um carrossel na tela inicial do app, logo acima do rodapé — trocando
        automaticamente a cada 5 segundos, com setas para o usuário navegar manualmente.
      </p>
      <div className="flex justify-end">
        <button onClick={() => setIsOpen(true)} className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Novo Anúncio
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ads.map(ad => (
          <div key={ad.id} className="bg-theme-card rounded-2xl border border-theme p-4 space-y-1">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-bold uppercase text-theme-secondary">{ad.type}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ad.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {ad.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            {ad.title && <h3 className="font-bold text-theme-primary">{ad.title}</h3>}
            {ad.text && <p className="text-xs text-theme-secondary">{ad.text}</p>}
            {ad.linkUrl && <p className="text-xs text-primary truncate">{ad.linkUrl}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={() => toggleActive(ad)} className="text-xs font-semibold text-theme-secondary">{ad.active ? 'Desativar' : 'Ativar'}</button>
              <button onClick={() => handleDelete(ad.id)} className="text-xs font-semibold text-red-500 ml-auto flex items-center gap-1"><Trash2 size={12} /> Excluir</button>
            </div>
          </div>
        ))}
        {ads.length === 0 && <p className="text-sm text-theme-secondary col-span-full text-center py-8">Nenhum anúncio cadastrado ainda.</p>}
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-theme-card rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-theme-primary">Novo Anúncio</h2>
              <button onClick={() => setIsOpen(false)}><X size={20} className="text-theme-secondary" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-theme-secondary">Tipo</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as AdContentType })} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm">
                  {Object.values(AdContentType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-theme-secondary">Título</label>
                <input value={form.title ?? ''} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-theme-secondary">Texto</label>
                <textarea value={form.text ?? ''} onChange={e => setForm({ ...form, text: e.target.value })} rows={2} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm" />
              </div>
              {(form.type === AdContentType.VIDEO) && (
                <div>
                  <label className="text-xs font-semibold text-theme-secondary">Link do vídeo (YouTube/Vimeo)</label>
                  <input value={form.videoUrl ?? ''} onChange={e => setForm({ ...form, videoUrl: e.target.value })} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm" />
                </div>
              )}
              {(form.type === AdContentType.BANNER_IMAGEM || form.type === AdContentType.IMAGEM_LINK) && (
                <div>
                  <label className="text-xs font-semibold text-theme-secondary">Imagem (até ~650KB, comprimida automaticamente)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full text-sm mt-1"
                  />
                  {uploading && <p className="text-[11px] text-theme-secondary mt-1">Processando imagem...</p>}
                  {uploadError && <p className="text-[11px] text-red-500 mt-1">{uploadError}</p>}
                  {form.imageUrl && !uploading && (
                    <img src={form.imageUrl} alt="Pré-visualização" className="w-full max-h-32 object-cover rounded-xl mt-2" />
                  )}
                </div>
              )}
              {(form.type === AdContentType.TEXTO_LINK || form.type === AdContentType.IMAGEM_LINK || form.type === AdContentType.BANNER_IMAGEM) && (
                <div>
                  <label className="text-xs font-semibold text-theme-secondary">Link de destino</label>
                  <input value={form.linkUrl ?? ''} onChange={e => setForm({ ...form, linkUrl: e.target.value })} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm" placeholder="https://..." />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={uploading} className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-60">Salvar</button>
                <button type="button" onClick={() => setIsOpen(false)} className="flex-1 border border-theme py-2.5 rounded-xl font-semibold text-sm text-theme-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Despesas do App ----------

function DespesasTab({ expenses }: { expenses: AppExpense[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<AppExpense>>({});

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const item: AppExpense = {
      id: `appexp_${Date.now()}`,
      description: form.description || 'Despesa',
      category: form.category || 'Geral',
      value: form.value || 0,
      date: form.date || format(new Date(), 'yyyy-MM-dd'),
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'appExpenses', item.id), item);
    setIsOpen(false);
    setForm({});
  }

  async function handleDelete(id: string) {
    if (confirm('Excluir esta despesa?')) await deleteDoc(doc(db, 'appExpenses', id));
  }

  const total = expenses.reduce((s, e) => s + e.value, 0);

  return (
    <div className="space-y-3">
      <div className="bg-theme-card rounded-2xl border border-theme p-4">
        <p className="text-xs text-theme-secondary uppercase font-bold">Total registrado</p>
        <p className="text-2xl font-bold text-red-500">R$ {total.toFixed(2)}</p>
      </div>

      <div className="flex justify-end">
        <button onClick={() => setIsOpen(true)} className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-xl font-semibold text-sm">
          <Plus size={18} /> Nova Despesa
        </button>
      </div>

      <div className="bg-theme-card rounded-2xl border border-theme overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-theme-secondary text-theme-secondary text-xs uppercase">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Descrição</th>
              <th className="text-left p-3">Categoria</th>
              <th className="text-left p-3">Valor</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme">
            {[...expenses].sort((a, b) => b.date.localeCompare(a.date)).map(e => (
              <tr key={e.id}>
                <td className="p-3 text-theme-secondary">{format(new Date(e.date), 'dd/MM/yyyy')}</td>
                <td className="p-3 font-bold text-theme-primary">{e.description}</td>
                <td className="p-3 text-theme-secondary">{e.category}</td>
                <td className="p-3 text-theme-secondary">R$ {e.value.toFixed(2)}</td>
                <td className="p-3 text-right"><button onClick={() => handleDelete(e.id)}><Trash2 size={14} className="text-red-400" /></button></td>
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-theme-secondary text-sm">Nenhuma despesa registrada ainda.</td></tr>}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-theme-card rounded-2xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-theme-primary">Nova Despesa do App</h2>
              <button onClick={() => setIsOpen(false)}><X size={20} className="text-theme-secondary" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-theme-secondary">Descrição</label>
                <input value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm" placeholder="Ex: Hospedagem Cloudflare" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-theme-secondary">Categoria</label>
                  <input value={form.category ?? ''} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm" placeholder="Ex: Infraestrutura" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-theme-secondary">Valor (R$)</label>
                  <input type="number" step="0.01" value={form.value ?? ''} onChange={e => setForm({ ...form, value: Number(e.target.value) })} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-theme-secondary">Data</label>
                <input type="date" value={form.date ?? ''} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full border border-theme bg-theme-card rounded-xl px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white py-2.5 rounded-xl font-bold text-sm">Salvar</button>
                <button type="button" onClick={() => setIsOpen(false)} className="flex-1 border border-theme py-2.5 rounded-xl font-semibold text-sm text-theme-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
