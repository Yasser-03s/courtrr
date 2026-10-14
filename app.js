'use strict';
(()=>{
 const {exercises,ranks,levels}=window.MISSION_DATA;
 const KEY='court_rr_v1',DAY_MS=86400000;
 const categories={morning:['🌅','Morning routine'],upper:['💪','Upper body · push/pull'],lower:['⚡','Lower body · force'],match:['🏀','Thursday · match'],recovery:['🌿','Friday · recovery'],saturday:['🎯','Saturday · shooting & defence'],sunday:['⛹️','Sunday · finishing & handles']};
 const dow=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
 const localDate=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 const epochDate=s=>Date.parse(s+'T00:00:00Z')/DAY_MS;
 const isoAt=n=>new Date((n*DAY_MS)+12*3600000).toISOString().slice(0,10);
 const jsDay=s=>new Date(s+'T12:00:00').getDay();
 const dayIndex=s=>(jsDay(s)+6)%7; // data.js uses Monday=0 … Sunday=6
 const FIX_FROM='2026-10-15',ONE_OFF={'2026-10-14':[1,2,3,4,5,6,7,8]}; // one-time catch-up: Wed 14 Oct = morning + upper only
 // Days before state.legacyBefore were logged under the old (shifted) schedule; keep them as they were so history/streak stay intact.
 function migrate(x){if(!x||x.scheduleFixed)return x;x.scheduleFixed=true;const t=today();x.legacyBefore=t>FIX_FROM?t:FIX_FROM;if(t<=FIX_FROM&&ONE_OFF[t]){x.overrides=Object.assign({},x.overrides,{[t]:ONE_OFF[t]})}return x}
 const today=()=>localDate();
 const clean=(v)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const initial=()=>({version:1,scheduleFixed:true,started:today(),days:{},settings:{defaultWeather:'dry'},lastSeen:today()});
 let state;let activeTab='mission';let expanded=new Set();let showDone=false,rankOpen=-1,cmpEx=1;
 let timer=null,timerTick=null,audioCtx=null,wake=null;
 const fmt=sec=>{sec=Math.max(0,Math.ceil(sec));return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')};
 function primeAudio(){try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume()}catch{}}
 function ring(){
  try{primeAudio();const c=audioCtx,t0=c.currentTime;
   for(let i=0;i<8;i++){const o=c.createOscillator(),g=c.createGain(),s=t0+i*0.45;o.type='sine';o.frequency.value=i%2?1175:880;o.connect(g);g.connect(c.destination);g.gain.setValueAtTime(0.0001,s);g.gain.exponentialRampToValueAtTime(0.6,s+0.02);g.gain.exponentialRampToValueAtTime(0.0001,s+0.4);o.start(s);o.stop(s+0.42)}
  }catch{}
  try{navigator.vibrate&&navigator.vibrate([300,150,300,150,300])}catch{}
 }
 async function keepAwake(on){try{if(on&&navigator.wakeLock){wake=await navigator.wakeLock.request('screen')}else if(wake){await wake.release();wake=null}}catch{}}
 function stopTimer(){clearInterval(timerTick);timerTick=null;timer=null;keepAwake(false)}
 function timerLen(ex,day){const t=targetFor(specFor(ex,day)),left=Math.max(1,t.target-(Number(progressFor(ex,day).count)||0));return Math.min(left,t.perSet||left)}
 function finishTimer(){
  const t=timer;if(!t)return;stopTimer();ring();
  const ex=exercises.find(e=>e.id===t.exId),day=ensureDay();
  if(ex&&keyFor(ex,day)===t.key){const target=targetFor(specFor(ex,day)).target;update(ex,p=>({...p,count:Math.min(target,(Number(p.count)||0)+t.len)}));toast('⏰ Time! +'+t.len+'s logged. Tap ✓ when the whole drill is finished.')}
  else render();
 }
 function runTimer(){clearInterval(timerTick);timerTick=setInterval(()=>{if(!timer||!timer.running)return;const left=timer.endAt-Date.now();if(left<=0){finishTimer();return}const el=document.getElementById('timerRead');if(el)el.textContent=fmt(left/1000)},250)}
 function toggleTimer(ex,day){
  primeAudio();
  const key=keyFor(ex,day);
  if(!timer||timer.key!==key){stopTimer();const len=timerLen(ex,day);timer={key,exId:ex.id,len,remaining:len*1000,endAt:0,running:false}}
  if(timer.running){timer.remaining=Math.max(0,timer.endAt-Date.now());timer.running=false;keepAwake(false)}
  else{timer.endAt=Date.now()+timer.remaining;timer.running=true;keepAwake(true);runTimer()}
  render();
 }
 function timerHtml(ex,key,target,count,done){
  const t=timer&&timer.key===key?timer:null,len=t?t.len:(target.perSet?Math.min(target.perSet,Math.max(1,target.target-count)):Math.max(1,target.target-count));
  const left=t?(t.running?Math.max(0,t.endAt-Date.now()):t.remaining)/1000:len,running=!!(t&&t.running);
  return `<div class="timer-box"><div class="timer-read" id="timerRead">${fmt(left)}</div><div class="micro">${running?'Counting down… rings at zero':t?'Paused':'Next block: '+len+'s · rings when finished'}</div></div><div class="counter-buttons"><button class="primary" data-action="timer-toggle" data-id="${ex.id}" ${done||count>=target.target?'disabled':''}>${running?'⏸ Pause':t?'▶ Resume':'▶ Start timer'}</button><button data-action="timer-reset" data-id="${ex.id}" ${t?'':'disabled'}>Reset</button><button data-action="increment" data-id="${ex.id}" data-amt="-${target.perSet||30}" ${count===0||done?'disabled':''} aria-label="Remove last block">−${target.perSet||30}s</button></div>`;
 }
 function load(){try{const x=JSON.parse(localStorage.getItem(KEY));if(x&&x.version===1&&typeof x.started==='string'&&x.days&&typeof x.days==='object')return migrate(x)}catch{}return initial()}
 state=load();persist();
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));return true}catch{toast('Storage is full or unavailable. Export your progress.');return false}}
 function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2600)}
 function ensureDay(date=today()){
  if(!state.days[date]){
   const score=stats(date).rr;
   const rank=rankOf(score);
   state.days[date]={tier:rank.tier,weather:state.settings.defaultWeather==='rain'?'rain':'dry',progress:{},created:Date.now()};
   persist();
  }
  return state.days[date];
 }
 function specFor(ex,day){
  let s=ex.specs[day.tier]||ex.specs.Iron;
  if(day.weather==='rain'){
   if(ex.id===13)return 'Indoor weather-safe replacement: 45 min low-impact shadow ball-handling, footwork and vision + 15 min walking/mobility. No lifting; this is NOT a competitive match.';
   if(ex.id===15)return 'Indoor ghost-steps on a non-slip mat, using the speed and sets below. '+s;
   if(ex.id===16)return 'Indoor low-noise shadow-dribble / air-handling at the rank-prescribed sets and cadence. '+s;
   if(ex.id===17){const n=levels.indexOf(day.tier);return `Indoor: controlled overhead press-flick ${3+Math.floor(n/2)} sets x ${15+3*n} reps, light weight up to 1.5 kg; protect shoulders, ensure ceiling clearance. This substitutes technique practice, not shots made.`;}
   if(ex.id===18)return 'Indoor retreat footwork in place and controlled wall-vision passes (or air passes). '+s;
   if(ex.id===19){const m=s.split(/\s*\/\s*Rain:\s*/i);return 'Indoor defensive slide: '+(m[1]||s)+'; ensure space and avoid slippery surfaces.'}
   if(ex.id===20)return 'Indoor alternate: high wall-target reach/touch, or imaginary rim Mikan footwork. '+s;
   if(ex.id===21)return 'Indoor shadow in-and-out and crossover footwork, no bouncing required. '+s;
   if(ex.id===22)return 'Indoor controlled layup footwork and reach, no jump/ball required. '+s;
   if(ex.id===23)return 'Indoor low-impact landing mechanics on a non-slip mat; skip elevated depth drops when space is limited. '+s;
  }
  return s;
 }
 function targetFor(s){
  // A primary counter is a practical workload tracker. For complex combined drills, the written prescription remains authoritative.
  let m=s.match(/(\d+)\s*(?:sets?\s*[x×]|[x×])\s*(\d+)\s*(?:sec|s\b|seconds?)/i);if(m)return {target:+m[1]*+m[2],perSet:+m[2],unit:'sec',detail:'Tracked hold/time; finish the full written prescription.'};
  m=s.match(/(\d+)\s*(min|sec|s)\s*\/\s*leg/i);if(m){const per=+m[1]*(/^min/i.test(m[2])?60:1);return {target:per*2,perSet:per,unit:'sec',detail:'Timer = one leg per block (do both legs). Also do the catches as written, then tap ✓ when the whole drill is finished.'}}
  m=s.match(/(\d+)\s*(?:sets?\s*[x×]|[x×])\s*(\d+)\s*(?:reps?)?\s*(?:\/\s*(?:leg|side))?/i);if(m)return {target:+m[1]*+m[2]*(/\/\s*(leg|side)/i.test(s.slice(m.index,m.index+m[0].length+12))?2:1),unit:'reps',detail:'Primary movement counter; complete every prescribed component.'};
  m=s.match(/(\d+)\s*sets?\s*[x×]\s*(\d+)/i);if(m)return {target:+m[1]*+m[2],unit:'reps',detail:'Primary movement counter; complete every prescribed component.'};
  m=s.match(/(\d+)\s*(?:reps?|makes?|catches?|touches?)(?:\s*\/\s*(?:side|leg))?/i);if(m)return {target:+m[1]*(/\/\s*(side|leg)/i.test(s.slice(m.index,m.index+m[0].length+12))?2:1),unit:'reps',detail:'Primary movement counter; complete every prescribed component.'};
  m=s.match(/(\d+)\s*(?:min(?:ute)?s?)/i);if(m)return {target:+m[1]*60,unit:'sec',detail:'Track seconds; fulfil the full session.'};
  m=s.match(/(\d+)\s*(?:sec|seconds?)/i);if(m)return {target:+m[1],unit:'sec',detail:'Track seconds; complete the full written prescription.'};
  if(/1 hour|1h\b/i.test(s))return {target:3600,unit:'sec',detail:'Track full session time and cool-down separately.'};
  m=s.match(/\b(\d+)\s*(?:[+]|\b)/);if(m)return {target:Math.min(500,+m[1]),unit:'reps',detail:'Primary action tracked; check full prescription before marking done.'};
  return {target:1,unit:'set',detail:'Mark complete after the full written drill.'};
 }
 function dayExercises(date){const ov=state.overrides&&state.overrides[date];if(Array.isArray(ov))return exercises.filter(ex=>ov.includes(ex.id));const idx=(state.legacyBefore&&date<state.legacyBefore)?jsDay(date):dayIndex(date);return exercises.filter(ex=>ex.days.includes(idx))}
 function keyFor(ex,day){return ex.id+'_'+(day.weather==='rain'&&ex.id>=13?'rain':'dry')}
 function progressFor(ex,day){return day.progress?.[keyFor(ex,day)]||{count:0,done:false}}
 function complete(ex,day){return !!progressFor(ex,day).done}
 function getCompleted(date,day){const es=dayExercises(date);return es.filter(ex=>complete(ex,day)).length}
 function reward(ex){const bonuses={morning:7,upper:15,lower:13,match:20,recovery:12,saturday:14,sunday:14};return bonuses[ex.category]}
 function dateRange(end){const a=epochDate(state.started),b=epochDate(end);const out=[];if(!Number.isFinite(a)||a>b)return out;for(let d=a;d<=b&&d<a+36525;d++)out.push(isoAt(d));return out}
 function stats(before){
  let rr=0,streak=0,best=0,misses=0,fullDays=0,loss=0,earn=0;const end=today();
  for(const date of dateRange(end)){
   if(before&&date>=before)break;
   const day=state.days[date];const all=dayExercises(date);const done=day?all.filter(ex=>complete(ex,day)):[];
   const gained=done.reduce((s,e)=>s+reward(e),0);
   rr+=gained;earn+=gained;
   if(done.length===all.length){streak++;misses=0;fullDays++;const bonus=18+Math.min(streak,14)*2;rr+=bonus;earn+=bonus;best=Math.max(best,streak)}
   else if(date<end){streak=0;misses++;const penalty=10*Math.pow(2,Math.min(24,misses-1));rr-=penalty;loss+=penalty}
   else{/* Today's partial mission does not break yesterday's streak until midnight. */}
  }
  return {rr:Math.round(rr),streak,best,misses,fullDays,loss,earn};
 }
 function rankOf(rr){let i=0;while(i<ranks.length-1&&rr>=ranks[i+1].threshold)i++;return {...ranks[i],index:i,next:ranks[i+1]||null}}
 function rankSources(r){
  const u=String(r.image||'').split(']')[0];
  const m=String(r.name).match(/^(\w+)\s*(\d)?$/);
  const slug=m?m[1].toLowerCase()+(m[2]||''):'radiant';
  return [u.replace('wiki.playvalorant.com','wiki.valorant.com'),u,'https://xpulz.com/img/game/valorant/tiers/'+slug+'.png','assets/ranks/'+r.file].filter((x,i,arr)=>x&&arr.indexOf(x)===i);
 }

const LOGO_KEY='court_rr_logos_v1';
let logoStore={};try{logoStore=JSON.parse(localStorage.getItem(LOGO_KEY))||{}}catch{}
const logoBusy=new Set();
function saveLogoStore(){try{localStorage.setItem(LOGO_KEY,JSON.stringify(logoStore))}catch{}}
function logoUrls(r){
  const division=(r.name.match(/ (\d+)$/)||[])[1]||null;
  const wikiFile=division?`${r.tier}_${division}_Rank.png`:'Radiant_Rank.png';
  const mirrorFile=division?`${r.tier.toLowerCase()}${division}.png`:'radiant.png';
  return {wiki:`https://wiki.valorant.com/en-us/images/thumb/${wikiFile}/120px-${wikiFile}`,mirror:`https://xpulz.com/img/game/valorant/tiers/${mirrorFile}`,local:`assets/ranks/${r.file}`};
}
// Download a logo once and keep it: as a data URL if the host allows it, otherwise in the browser cache (served by sw.js).
async function persistLogo(file,url){
  if(logoStore[file]||logoBusy.has(file)||!/^https?:/.test(url))return;
  logoBusy.add(file);
  try{
    try{
      const res=await fetch(url,{mode:'cors'});if(!res.ok)throw 0;
      const blob=await res.blob();if(blob.size<100||blob.size>400000||!/^image\//.test(blob.type))throw 0;
      const d=await new Promise((ok,no)=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=no;fr.readAsDataURL(blob)});
      logoStore[file]={d};saveLogoStore();return;
    }catch{}
    try{
      const res=await fetch(url,{mode:'no-cors'});const c=await caches.open('court-rr-logos');
      await c.put(url,res);logoStore[file]={u:url};saveLogoStore();
    }catch{}
  }finally{logoBusy.delete(file)}
}
window.rankLoaded=function(img){const f=img.dataset.file,u=img.currentSrc||img.src;if(f&&/^https?:/.test(u))persistLogo(f,u)};
function preloadLogos(){
  for(const r of ranks){
    if(logoStore[r.file])continue;
    const u=logoUrls(r),tryUrl=url=>{const im=new Image();im.onload=()=>persistLogo(r.file,url);im.onerror=()=>{if(url===u.wiki)tryUrl(u.mirror)};im.src=url};
    tryUrl(u.wiki);
  }
}
function badge(r, cls = 'rank-img') {
  const u=logoUrls(r),saved=logoStore[r.file];
  const src=saved&&saved.d?saved.d:saved&&saved.u?saved.u:u.wiki;
  // Saved copy first (instant, works offline); otherwise real artwork from the web, then mirror, then bundled placeholder.
  return `<img
    class="${clean(cls)}"
    src="${clean(src)}"
    alt="${clean(r.name)} emblem"
    data-file="${clean(r.file)}"
    data-mirror="${clean(u.mirror)}"
    data-local="${clean(u.local)}"
    onload="rankLoaded(this)"
    onerror="rankFallback(this)"
  >`;
}

function rankFallback(img) {
  // Saved/primary image failed: try the mirror, then the bundled local image.
  if (!img.dataset.stage) {
    img.dataset.stage = 'mirror';
    img.src = img.dataset.mirror;
    return;
  }
  if (img.dataset.stage === 'mirror') {
    img.dataset.stage = 'local';
    img.src = img.dataset.local;
    return;
  }
  // Last resort: show the app icon rather than a broken image.
  img.onerror = null;
  img.src = 'assets/icon-192.png';
  img.classList.add('rank-fallback');
}

window.rankFallback = rankFallback;

 function start(){const now=today();if(state.started>now){state.started=now;persist()};if(now!==state.lastSeen){state.lastSeen=now;persist();expanded.clear()}ensureDay(now);render()}
 function render(){document.querySelectorAll('.bottom button').forEach(b=>b.classList.toggle('active',b.dataset.tab===activeTab));let body='';if(activeTab==='mission')body=mission();else if(activeTab==='ranks')body=ranking();else if(activeTab==='history')body=history();else body=settings();document.getElementById('app').innerHTML=`<section class="content">${body}</section>`}
 function mission(){const date=today(),day=ensureDay(date),summary=stats(),rank=rankOf(summary.rr),list=dayExercises(date),done=getCompleted(date,day),pct=Math.round(100*done/list.length),next=rank.next,range=next?next.threshold-rank.threshold:1,progress=next?100*(summary.rr-rank.threshold)/range:100;
  const dateLabel=new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
  const groups=[...new Set(list.map(e=>e.category))];
  const nextDesc=next?`${Math.max(0,next.threshold-summary.rr).toLocaleString()} RR to ${next.name}`:'Maximum rank achieved';
  return `<div class="eyebrow">◈ DAILY OPERATIONS · ${clean(dateLabel)}</div><h1 class="heading">YOUR MISSION<span class="accent">.</span></h1><p class="sub">Every rep earns progress. Consistency earns rank.</p>
  <div class="card rank-card">${badge(rank)}<div class="rank-details"><div class="eyebrow">CURRENT RANK</div><h2>${clean(rank.name)}</h2><div class="micro">${summary.rr.toLocaleString()} RR · ${clean(nextDesc)}</div><div class="progress"><div style="width:${Math.max(0,Math.min(100,progress))}%"></div></div></div></div>
  <div class="stat-row"><div class="stat"><b>🔥 ${summary.streak}</b><small>Day streak</small></div><div class="stat"><b>${done}/${list.length}</b><small>Exercises</small></div><div class="stat"><b>${pct}%</b><small>Mission</small></div></div>
  <div class="split"><strong>CONDITIONS</strong><span class="micro">Today's mode only</span></div><div class="weather"><button data-action="weather" data-mode="dry" class="${day.weather==='dry'?'selected':''}">☀️ DRY / OUTDOOR</button><button data-action="weather" data-mode="rain" class="rain ${day.weather==='rain'?'selected':''}">🌧 RAIN / INDOOR</button></div>
  <div class="card"><div class="split"><div><div class="eyebrow">TODAY'S COMPLETION</div><h2 style="margin:4px 0 0">${done===list.length?'Mission accomplished':'Stay on target'}</h2></div><b class="${done===list.length?'success':''}">${pct}%</b></div><div class="progress"><div style="width:${pct}%"></div></div><p class="footnote">Full mission bonus: +${18+Math.min(summary.streak+(done===list.length?0:1),14)*2} RR on completion. Each exercise pays RR only once; group completion includes its exercises.</p></div>
  ${openGroupsHtml(list,day)}${doneSectionHtml(list,day)}
  <p class="footnote">A missed day incurs −10 RR, doubling on each consecutive miss (−20, −40, −80…). The first incomplete day isn't penalised until midnight. Partial exercise RR still counts, but only a full mission preserves the streak. Penalties are capped at 10 × 2^24 per day to avoid numeric overflow.</p>`;
 }
 function openGroupsHtml(list,day){
  const pending=list.filter(e=>!complete(e,day));
  if(!pending.length)return `<div class="card"><h2 style="margin:0">All missions cleared 🎉</h2><p class="footnote">Everything for today is in “Completed today” below.</p></div>`;
  return [...new Set(pending.map(e=>e.category))].map(cat=>groupHtml(cat,pending.filter(e=>e.category===cat),day,list.filter(e=>e.category===cat))).join('');
 }
 function doneSectionHtml(list,day){
  const fin=list.filter(e=>complete(e,day));if(!fin.length)return '';
  const rr=fin.reduce((s,e)=>s+reward(e),0);
  const body=showDone?[...new Set(fin.map(e=>e.category))].map(cat=>`<div class="micro" style="margin:10px 0 2px">${categories[cat][0]} ${clean(categories[cat][1])}</div>${fin.filter(e=>e.category===cat).map(ex=>exHtml(ex,day)).join('')}`).join(''):'';
  return `<div class="group done-group"><div class="group-head"><div><h3>✓ Completed today</h3><div class="micro">${fin.length}/${list.length} drills · +${rr} RR earned</div></div><button class="small-btn alt" data-action="toggledone">${showDone?'Hide':'Show'}</button></div>${body}</div>`;
 }
 function groupHtml(cat,items,day,full=items){const [ico,label]=categories[cat],done=full.filter(e=>complete(e,day)).length,all=done===full.length;
  return `<div class="group"><div class="group-head"><div><h3>${ico} ${clean(label)}</h3><div class="micro">${done}/${full.length} complete · ${items.reduce((s,e)=>s+reward(e),0)} RR available</div></div><button class="small-btn ${all?'alt':''}" data-action="group" data-cat="${cat}">${all?'↶ Undo group':'✓ Finish all'}</button></div>${items.map(ex=>exHtml(ex,day)).join('')}</div>`;
 }
 function exHtml(ex,day){const key=keyFor(ex,day),p=progressFor(ex,day),done=!!p.done,spec=specFor(ex,day),target=targetFor(spec),count=Math.max(0,Math.min(target.target,Number(p.count)||0)),percent=done?100:Math.round(100*count/target.target),wide=target.target>20,open=expanded.has(key);
  return `<div class="ex"><div class="ex-top"><button aria-label="${done?'Undo':'Complete'} ${clean(ex.title)}" class="check ${done?'checked':''}" data-action="toggle" data-id="${ex.id}">${done?'✓':'○'}</button><button class="ex-title" style="background:none;border:0;color:inherit;text-align:left;padding:2px 0" data-action="expand" data-id="${ex.id}" aria-expanded="${open}">${clean(ex.title)} <span style="color:var(--muted);font-size:12px">${open?'⌃':'⌄'}</span></button><span class="rr">+${reward(ex)} RR</span></div><div class="prescription">${clean(spec)}</div>
  ${open?`<div class="counter-panel"><div class="counter-label"><span>${done?'✓ Complete':`${target.unit==='sec'?'Timer':'Tap counter'} · ${target.unit}`}</span><b>${done?target.target:count} / ${target.target} ${target.unit}</b></div><div class="progress"><div style="width:${percent}%"></div></div>${target.unit==='sec'?timerHtml(ex,key,target,count,done):`<div class="counter-buttons"><button data-action="increment" data-id="${ex.id}" data-amt="-1" ${count===0||done?'disabled':''} aria-label="Subtract one">−1</button><button class="primary" data-action="increment" data-id="${ex.id}" data-amt="1" ${done?'disabled':''}>+1</button>${wide?`<button data-action="increment" data-id="${ex.id}" data-amt="5" ${done?'disabled':''}>+5</button><button data-action="increment" data-id="${ex.id}" data-amt="10" ${done?'disabled':''}>+10</button>`:''}${target.unit==='sec'?`<button data-action="increment" data-id="${ex.id}" data-amt="30" ${done?'disabled':''}>+30s</button>`:''}</div>`}<p class="footnote">${clean(target.detail)} Counters track a primary metric, not necessarily every movement in a compound prescription. Reaching the target does not auto-certify the whole drill: tap ✓ when all components are finished.</p></div>`:''}</div>`;
 }
 function comparePanel(rank,cur){
  const ex=exercises.find(e=>e.id===cmpEx)||exercises[0];
  const opts=Object.keys(categories).map(cat=>{const l=exercises.filter(e=>e.category===cat);return l.length?`<optgroup label="${clean(categories[cat][0]+' '+categories[cat][1])}">${l.map(e=>`<option value="${e.id}" ${e.id===ex.id?'selected':''}>${clean(e.title)}</option>`).join('')}</optgroup>`:''}).join('');
  const from=ex.specs[cur.tier]||ex.specs.Iron,to=ex.specs[rank.tier]||ex.specs.Iron;
  const ci=levels.indexOf(cur.tier),ni=levels.indexOf(rank.tier);
  const same=from===to;
  const verdict=ni===ci?'Same tier — subdivisions share one prescription':same?'No change at this rank — same prescription':ni>ci?'↑ Harder at '+rank.tier:'↓ Easier at '+rank.tier;
  return `<div class="counter-panel rank-compare"><div class="counter-label"><span>Compare a workout</span><b>${clean(cur.tier)} → ${clean(rank.tier)}</b></div><select class="field" id="cmpEx" aria-label="Choose a workout to compare">${opts}</select><div class="cmp-block"><div class="eyebrow">NOW · ${clean(cur.tier.toUpperCase())} (your rank)</div><div class="prescription">${clean(from)}</div></div><div class="cmp-arrow">${clean(verdict)}</div>${ni===ci||same?'':`<div class="cmp-block"><div class="eyebrow">AT ${clean(rank.name.toUpperCase())}</div><div class="prescription">${clean(to)}</div></div>`}</div>`;
 }
 function rankItemHtml(rank,i,cur){
  const open=rankOpen===i;
  return `<div class="rank-item ${i===cur.index?'current':''} ${open?'open':''}" data-action="rankopen" data-i="${i}" role="button" aria-expanded="${open}">${badge(rank)}<div><strong>${clean(rank.name)}</strong><span class="micro">Unlock at ${rank.threshold.toLocaleString()} RR${i>0?' · '+(rank.threshold-ranks[i-1].threshold).toLocaleString()+' RR step':''}</span></div><span class="tag">${i===cur.index?'CURRENT':i<cur.index?'✓':'LOCKED'} ${open?'⌃':'⌄'}</span></div>${open?comparePanel(rank,cur):''}`;
 }
 function ranking(){const s=stats(),r=rankOf(s.rr);return `<div class="eyebrow">◈ COMPETITIVE PROGRESSION</div><h1 class="heading">RANK LADDER<span class="accent">.</span></h1><p class="sub">25 ranks. RR can rise and fall. Exercise prescriptions scale by rank family, locked for each day.</p><div class="stat-row"><div class="stat"><b>${s.rr.toLocaleString()}</b><small>Net RR</small></div><div class="stat"><b>${s.fullDays}</b><small>Full days</small></div><div class="stat"><b>${s.best}</b><small>Best streak</small></div></div><div class="rank-list">${ranks.map((rank,i)=>rankItemHtml(rank,i,r)).join('')}</div><p class="footnote">Radiant requires ${ranks[ranks.length-1].threshold.toLocaleString()} net RR. Rank changes based on actual score. Each family has its own exercise difficulty; subdivisions share the family prescription. There are no artificial streak prerequisites.</p>`}
 function history(){const s=stats(),all=dateRange(today()).reverse(),last=all.slice(0,60);return `<div class="eyebrow">◈ PERFORMANCE LOG</div><h1 class="heading">HISTORY<span class="accent">.</span></h1><p class="sub">Automatically tracked from first use. Only today's workout can be edited.</p><div class="stat-row"><div class="stat"><b class="success">+${s.earn.toLocaleString()}</b><small>Earned</small></div><div class="stat"><b class="danger">−${s.loss.toLocaleString()}</b><small>Penalties</small></div><div class="stat"><b>${s.fullDays}</b><small>Cleared</small></div></div><div class="card">${last.map(date=>{const day=state.days[date],items=dayExercises(date),count=day?getCompleted(date,day):0,full=count===items.length,isNow=date===today(),earned=day?items.filter(x=>complete(x,day)).reduce((n,x)=>n+reward(x),0):0;return `<div class="history-row"><div><strong>${clean(date)}</strong><div class="micro">${count}/${items.length} drills · ${day?day.weather:'no workout'} · +${earned} base RR</div></div><span class="${full?'success':isNow?'muted':'danger'}">${full?'✓ CLEARED':isNow?'IN PROGRESS':'MISSED'}</span></div>`}).join('')}</div><p class="footnote">Most recent 60 days displayed; the full stored record is used for ranking. Missing-day penalties double across consecutive missed days.</p>`}
 function settings(){return `<div class="eyebrow">◈ PERSONAL CONTROL</div><h1 class="heading">SETTINGS<span class="accent">.</span></h1><p class="sub">Your data stays on this device and this browser. No accounts, no server.</p><div class="card"><div class="setting-row"><label for="defaultWeather">Default weather for future days</label><select class="field" id="defaultWeather"><option value="dry" ${state.settings.defaultWeather==='dry'?'selected':''}>☀ Dry / outdoor</option><option value="rain" ${state.settings.defaultWeather==='rain'?'selected':''}>🌧 Rain / indoor</option></select><p>You can change today's conditions from the mission screen.</p></div><div class="setting-row"><label>Backup progress</label><p>Export JSON and save it in Files/iCloud. Import restores scores, completed drills, and rank snapshots on this browser. Do this before switching phones or clearing Safari data.</p><button class="button" data-action="export">⬇ Export backup</button><label style="margin-top:13px" for="importFile">Import backup (.json)</label><input class="field" type="file" id="importFile" accept="application/json,.json"></div></div><div class="card"><strong>Training and scoring rules</strong><p class="footnote">Monday: morning + upper; Tuesday: morning + lower; Wednesday: morning + upper + lower; Thursday: morning + match; Friday: morning + recovery; Saturday: morning + shooting/defence; Sunday: morning + finishing/handles.</p><p class="footnote">Per exercise +7 RR morning, +12 recovery, +13 lower, +14 skills, +15 upper, +20 match. Full day +18 RR plus +2 per consecutive successful day (max +28 streak bonus). Incomplete past days: −10 × 2^(consecutive misses − 1), capped to avoid overflow. Net RR may be negative. Toggling exercises recalculates scores instead of adding duplicate rewards.</p><p class="footnote">Rain swaps court drills for indoor technique equivalents and changes Thursday's match into a safer practice session. Exact court/match performance is not implied.</p></div><div class="card"><strong>Reset</strong><p class="footnote">Deletes this installation's progress permanently. Export first.</p><button class="button danger-btn" data-action="reset">Delete all local progress</button></div><p class="footnote">For iPhone installation: open your GitHub Pages URL in Safari, tap Share → Add to Home Screen. LocalStorage can be cleared by iOS/browser; regular backups are recommended. No cross-device sync.</p>`}
 function update(ex,fn){const date=today(),day=ensureDay(date),key=keyFor(ex,day),p=progressFor(ex,day);day.progress[key]=fn({...p});persist();render()}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const act=b.dataset.action,id=Number(b.dataset.id),ex=exercises.find(e=>e.id===id),day=ensureDay();
  if(act==='weather'){if(day.weather!==b.dataset.mode){day.weather=b.dataset.mode;stopTimer();expanded.clear();persist();render();toast('Weather mode updated. Indoor and outdoor counters are separate.')}return}
  if(act==='expand'&&ex){const k=keyFor(ex,day);expanded.has(k)?expanded.delete(k):expanded.add(k);render();return}
  if(act==='rankopen'){const i=Number(b.dataset.i);rankOpen=rankOpen===i?-1:i;render();return}
  if(act==='toggledone'){showDone=!showDone;render();return}
  if(act==='toggle'&&ex){const was=complete(ex,day);update(ex,p=>({...p,done:!p.done,count:!p.done?targetFor(specFor(ex,day)).target:0}));toast(was?'Moved back to your list':'✓ Done — moved to Completed today');return}
  if(act==='timer-toggle'&&ex){toggleTimer(ex,day);return}
  if(act==='timer-reset'){stopTimer();render();return}
  if(act==='increment'&&ex){const target=targetFor(specFor(ex,day)).target;const amt=Number(b.dataset.amt);update(ex,p=>({...p,count:Math.max(0,Math.min(target,(Number(p.count)||0)+amt))}));return}
  if(act==='group'){const list=dayExercises(today()).filter(x=>x.category===b.dataset.cat);const all=list.every(ex=>complete(ex,day));for(const ex of list){const key=keyFor(ex,day);day.progress[key]={done:!all,count:!all?targetFor(specFor(ex,day)).target:0}}persist();render();toast(all?'Group unchecked':'Group completed');return}
  if(act==='export'){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='court-rr-backup-'+today()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),6000);return}
  if(act==='reset'){if(confirm('Delete ALL locally saved workout history and ranks? This cannot be undone.')){state=initial();persist();expanded.clear();activeTab='mission';start();toast('Local data reset')}return}
 });
 document.querySelectorAll('.bottom button').forEach(b=>b.addEventListener('click',()=>{activeTab=b.dataset.tab;window.scrollTo(0,0);render()}));
 document.getElementById('settingsShortcut').addEventListener('click',()=>{activeTab='settings';window.scrollTo(0,0);render()});
 document.addEventListener('change',async e=>{
  if(e.target.id==='cmpEx'){const v=Number(e.target.value);if(exercises.some(x=>x.id===v)){cmpEx=v;render()}return}
  if(e.target.id==='defaultWeather'){state.settings.defaultWeather=e.target.value;persist();toast('Default weather saved')}
  if(e.target.id==='importFile'&&e.target.files?.length){try{const text=await e.target.files[0].text(),data=JSON.parse(text);if(data.version!==1||!/^\d{4}-\d{2}-\d{2}$/.test(data.started)||!data.days||typeof data.days!=='object'||Array.isArray(data.days)||!data.settings)throw Error('Invalid backup format');if(!confirm('Replace ALL existing local workout data with this backup?'))return;state=migrate(data);state.settings.defaultWeather=state.settings.defaultWeather==='rain'?'rain':'dry';if(state.started>today())state.started=today();persist();expanded.clear();start();toast('Backup restored')}catch(err){toast('Import failed: '+err.message)}}
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&today()!==state.lastSeen)start()});
 window.addEventListener('focus',()=>{if(today()!==state.lastSeen)start()});
 if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
 start();
 setTimeout(preloadLogos,1200);
})();
