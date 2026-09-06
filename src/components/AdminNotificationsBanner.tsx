/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AdminNotification, UserDirectoryEntry } from '../types';
import { Megaphone, X } from 'lucide-react';

// Mostra os avisos enviados pelo admin (individual, geral ou filtrado) que
// realmente se aplicam a este usuário e que ele ainda não marcou como
// lidos. Some sozinho quando o usuário fecha.
export default function AdminNotificationsBanner({ uid }: { uid: string }) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [myEntry, setMyEntry] = useState<UserDirectoryEntry | null>(null);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'adminNotifications'), (snap) => {
      setNotifications(snap.docs.map(d => d.data() as AdminNotification));
    }, () => setNotifications([]));
    return unsub1;
  }, []);

  useEffect(() => {
    if (!uid) return;
    const unsub2 = onSnapshot(doc(db, 'userDirectory', uid), (snap) => {
      setMyEntry(snap.exists() ? (snap.data() as UserDirectoryEntry) : null);
    }, () => setMyEntry(null));
    return unsub2;
  }, [uid]);

  function appliesToMe(n: AdminNotification): boolean {
    if (n.readBy?.includes(uid)) return false;
    if (n.targetType === 'all') return true;
    if (n.targetType === 'individual') return n.targetUserId === uid;
    if (n.targetType === 'filtered' && n.filter) {
      if (n.filter.city && myEntry?.city?.toLowerCase() !== n.filter.city.toLowerCase()) return false;
      if (n.filter.region && myEntry?.region?.toLowerCase() !== n.filter.region.toLowerCase()) return false;
      if (n.filter.birthdayMonth && myEntry?.birthday) {
        const month = Number(myEntry.birthday.split('-')[0]);
        if (month !== n.filter.birthdayMonth) return false;
      } else if (n.filter.birthdayMonth) {
        return false;
      }
      return true;
    }
    return false;
  }

  const relevant = notifications.filter(appliesToMe).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function dismiss(n: AdminNotification) {
    try {
      await updateDoc(doc(db, 'adminNotifications', n.id), { readBy: arrayUnion(uid) });
    } catch {
      // silencioso — pior caso, o aviso aparece de novo na próxima visita
    }
  }

  if (relevant.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {relevant.map(n => (
        <div key={n.id} className="bg-[var(--primary-soft)] border border-primary/30 rounded-2xl p-4 flex items-start gap-3">
          <Megaphone size={18} className="text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-sm text-theme-primary">{n.title}</p>
            <p className="text-xs text-theme-secondary mt-0.5">{n.message}</p>
          </div>
          <button onClick={() => dismiss(n)} className="text-theme-secondary hover:opacity-70 shrink-0">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
