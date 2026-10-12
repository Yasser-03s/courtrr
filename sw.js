const CACHE='court-rr-static-v1';
const BASE=new URL('./',self.registration.scope);
const CORE=['./','./index.html','./style.css','./app.js','./data.js','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-180.png','./assets/icon-512.png'];
const RANKS=['Iron','Bronze','Silver','Gold','Platinum','Diamond','Ascendant','Immortal'].flatMap(t=>[1,2,3].map(n=>'./assets/ranks/'+t+'_'+n+'_Rank.png')).concat(['./assets/ranks/Radiant_Rank.png']);
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll([...CORE,...RANKS])));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return res})).catch(()=>caches.match('./index.html')))});
