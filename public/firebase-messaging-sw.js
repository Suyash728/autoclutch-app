// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize Firebase inside Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyC81DBZ6FZsGDnQ__8cguxVDucRyEw8WT0",
  authDomain: "gen-lang-client-0322520339.firebaseapp.com",
  projectId: "gen-lang-client-0322520339",
  storageBucket: "gen-lang-client-0322520339.firebasestorage.app",
  messagingSenderId: "1085043462951",
  appId: "1:1085043462951:web:21405d94b69fd185698f02"
});

const messaging = firebase.messaging();

// Handle background messages via FCM
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'AutoClutch Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a proactive nudge!',
    icon: '/icon-light.svg',
    badge: '/icon-light.svg',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Native push listener (supports web-push)
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Native push event received.');
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'AutoClutch Notification', body: event.data.text() };
    }
  }

  const title = data.title || data.notification?.title || 'AutoClutch Reminder';
  const options = {
    body: data.body || data.notification?.body || 'Stay on track with your deadlines!',
    icon: '/icon-light.svg',
    badge: '/icon-light.svg',
    vibrate: [100, 50, 100],
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click to open page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
