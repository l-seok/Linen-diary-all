
// 최소한의 서비스 워커 설정
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // 네트워크 우선 전략 (또는 필요에 따라 캐싱 전략 추가 가능)
  event.respondWith(fetch(event.request));
});
