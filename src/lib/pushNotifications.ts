/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { app, db } from './firebase';

// Pede permissão de notificação ao navegador/celular e, se aceito, gera um
// "token" único deste aparelho — é esse token que o servidor usa depois
// pra mandar notificação push pra ele especificamente. Precisa de duas
// coisas configuradas no Firebase Console (gratuitas, mas manuais):
// 1) Cloud Messaging ativado no projeto
// 2) Uma "VAPID key" gerada em Configurações do projeto > Cloud Messaging
//    > Certificados push da Web — colada na variável de ambiente
//    VITE_FIREBASE_VAPID_KEY
export async function enablePushNotifications(uid: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (!(await isSupported())) {
      return { ok: false, reason: 'Este navegador não tem suporte a notificações push.' };
    }
    if (!('Notification' in window)) {
      return { ok: false, reason: 'Notificações não são suportadas neste dispositivo.' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'Permissão de notificação não concedida.' };
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      return { ok: false, reason: 'Notificação push ainda não configurada pelo administrador (falta a chave VAPID).' };
    }

    const registration = await navigator.serviceWorker.ready;
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });

    if (!token) {
      return { ok: false, reason: 'Não foi possível gerar o token de notificação.' };
    }

    await setDoc(doc(db, 'userDirectory', uid), { fcmTokens: arrayUnion(token) }, { merge: true });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err.message || 'Erro desconhecido ao ativar notificações.' };
  }
}
