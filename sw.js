/* タスク管理ボード — Service Worker
 *
 * 目的は2つだけ:
 *   1. ホーム画面に追加したあと、電波がなくても起動できるようにする
 *   2. こちらが再デプロイしたとき、各メンバーの端末に更新を届ける
 *
 * 更新手順: index.html の APP_VERSION と、下の CACHE を同じ値に上げる。
 */
var CACHE = 'task-board-v1.3.0';

var PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function(e){
  // waiting のまま留まる。切り替えはページ側の「更新」タップを待つ
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      // 1件失敗しても install ごと失敗させない
      return Promise.all(PRECACHE.map(function(u){
        return c.add(new Request(u, { cache:'reload' })).catch(function(){});
      }));
    })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var url = new URL(req.url);
  // 別オリジン（Google Fonts など）は cache-first。取れなければ何もしない
  var sameOrigin = url.origin === self.location.origin;

  if(req.mode === 'navigate'){
    // HTML は network-first。オフライン時のみキャッシュに落とす
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put('./index.html', copy); });
        return res;
      }).catch(function(){
        return caches.match('./index.html').then(function(r){
          return r || caches.match('./');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && (res.ok || res.type === 'opaque')){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){
        return hit || Response.error();
      });
    })
  );

  void sameOrigin;
});
