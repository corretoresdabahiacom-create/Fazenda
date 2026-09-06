// Service Worker do Fazenda Online — cuida de duas coisas:
// 1) Cache básico para o app funcionar como PWA instalável.
// 2) Recebimento de notificações push (Firebase Cloud Messaging) mesmo
//    com o app fechado.

const CACHE_NAME = 'fazenda-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estratégia "network-first": tenta buscar da rede primeiro (pra nunca
// mostrar conteúdo desatualizado), e só usa o cache se estiver realmente
// offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// -----------------------------------------------------------------------
// FIREBASE CLOUD MESSAGING — notificações push
//
// IMPORTANTE: preencha os valores abaixo com a MESMA configuração do
// Firebase já usada no resto do app (as mesmas variáveis VITE_FIREBASE_*
// que você já tem no Cloudflare Pages). Esses valores são públicos por
// natureza no Firebase — não são segredo — mas o service worker não
// consegue ler variáveis de ambiente do Vite, por isso precisam ser
// colados aqui manualmente.
// -----------------------------------------------------------------------
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

try {
  firebase.initializeApp({
    apiKey: 'COLE_AQUI_SEU_VITE_FIREBASE_API_KEY',
    authDomain: 'COLE_AQUI_SEU_VITE_FIREBASE_AUTH_DOMAIN',
    projectId: 'COLE_AQUI_SEU_VITE_FIREBASE_PROJECT_ID',
    storageBucket: 'COLE_AQUI_SEU_VITE_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'COLE_AQUI_SEU_VITE_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'COLE_AQUI_SEU_VITE_FIREBASE_APP_ID',
  });

  const messaging = firebase.messaging();

  // Chamado quando chega uma notificação push com o app FECHADO ou em
  // segundo plano.
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || 'Fazenda Online';
    const options = {
      body: payload.notification?.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: payload.data,
    };
    self.registration.showNotification(title, options);
  });
} catch (e) {
  // Se a configuração ainda não foi preenchida, o app continua
  // funcionando normalmente — só as notificações push não vão chegar.
  console.warn('Firebase Messaging não configurado no service worker ainda:', e);
}

// Ao clicar na notificação, abre (ou foca) o app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
