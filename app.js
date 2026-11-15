/* Reverse Raffle — single-file show app. Randomness: crypto.getRandomValues (rejection sampling, unbiased). */
(function(){
'use strict';
const IS_DISPLAY = /display/.test(location.hash);
const K_SET='rr_settings_v2', K_GAME='rr_game_v2', K_ASSET='rr_asset_';
const $ = id => document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const uid=()=>Math.random().toString(36).slice(2,9);
const FONT_STACK='"Inter","SF Pro Display","Segoe UI Variable","Segoe UI",system-ui,-apple-system,Roboto,"Helvetica Neue",Arial,"Noto Sans Hebrew","Arial Hebrew",sans-serif';

/* ---------- fair randomness ---------- */
const _rb=new Uint32Array(1);
function randInt(n){ // uniform integer in [0, n)
  if(!(n>1)) return 0;
  const lim=0x100000000 - (0x100000000 % n);
  let x; do{ crypto.getRandomValues(_rb); x=_rb[0]; }while(x>=lim);
  return x % n;
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=randInt(i+1); const t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

/* ---------- text measuring ---------- */
const _mc=document.createElement('canvas').getContext('2d'); const _mcache=new Map();
function textW(t, w){ const k=w+'|'+t; let v=_mcache.get(k); if(v==null){ _mc.font=w+' 100px '+FONT_STACK; v=_mc.measureText(String(t)).width||1; if(_mcache.size>6000) _mcache.clear(); _mcache.set(k,v);} return v; }
function fitPx(text, maxW, maxPx, weight){ return Math.max(8, Math.min(maxPx, maxW/(textW(text, weight||800)/100))); }

const ANIMS=[
 {id:'slot',name:'Slot machine',desc:'A reel of names spins and lands on the call',icon:'<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="22" height="24" rx="4"/><path d="M9 11h14M9 16h14M9 21h14" stroke-linecap="round"/><path d="M5 16H2M30 16h-3"/></svg>'},
 {id:'spotlight',name:'Spotlight sweep',desc:'A spotlight hunts across the board',icon:'<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="6"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l3 3M22 22l3 3M25 7l-3 3M10 22l-3 3" stroke-linecap="round"/></svg>'},
 {id:'flip',name:'Card flip',desc:'The call card flips to reveal the name',icon:'<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="5" width="20" height="22" rx="3"/><path d="M6 16h20" stroke-dasharray="2 2"/><path d="M12 11l4-3 4 3M12 21l4 3 4-3" stroke-linecap="round" stroke-linejoin="round"/></svg>'},
 {id:'zoom',name:'Zoom & pulse',desc:'The name zooms in with a pulse ring',icon:'<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="4"/><circle cx="16" cy="16" r="9" opacity=".6"/><circle cx="16" cy="16" r="13" opacity=".3"/></svg>'},
 {id:'shuffle',name:'Shuffle highlight',desc:'Lights flicker over the board, then settle',icon:'<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="7" height="6" rx="1.5"/><rect x="13" y="5" width="7" height="6" rx="1.5" fill="currentColor"/><rect x="22" y="5" width="7" height="6" rx="1.5"/><rect x="4" y="13" width="7" height="6" rx="1.5"/><rect x="13" y="13" width="7" height="6" rx="1.5"/><rect x="22" y="13" width="7" height="6" rx="1.5" fill="currentColor"/><rect x="4" y="21" width="7" height="6" rx="1.5" fill="currentColor"/><rect x="13" y="21" width="7" height="6" rx="1.5"/><rect x="22" y="21" width="7" height="6" rx="1.5"/></svg>'},
 {id:'mix',name:'Surprise mix',desc:'A different animation each call',icon:'<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h5c6 0 8 12 14 12h5M4 22h5c2.5 0 4-2 5.5-4.5M18 14c1.5-2.4 3-4 5-4h5M25 7l3 3-3 3M25 19l3 3-3 3"/></svg>'}
];
const ANIM_IDS=['slot','spotlight','flip','zoom','shuffle'];
const THEMES=[
 {id:'navy',name:'Navy & Gold',a:'#0b1638',b:'#132561',s:'#d8b14a'},
 {id:'emerald',name:'Black & Emerald',a:'#030605',b:'#0d2a1d',s:'#20c486'},
 {id:'royal',name:'White & Royal Blue',a:'#f3f6fd',b:'#d5e0fb',s:'#1f4fd8'},
 {id:'burgundy',name:'Burgundy & Champagne',a:'#16050b',b:'#46122a',s:'#e6bd72'},
 {id:'violet',name:'Midnight & Lilac',a:'#0a0820',b:'#251d5f',s:'#b7a4ff'}
];
const DEF={
 mode:'names', namesText:'', seqs:[{id:'s1',prefix:'A',from:1,to:150,digits:3,color:'#4b86ff',exclude:false}],
 gridOrder:'entered', showNumbers:false,
 lists:[{id:'main',name:'Main prize list',prizes:[]}], listId:'main',
 grandPrize:'$3,000', finalists:3, splitOn:true, splitPrompt:'Take the deal, or play for it all?', dealRunner:'$500', dealWinner:'$2,000',
 speed:4, finalOn:false, finalLast:20, finalSpeed:7,
 winPause:'space', winSec:6, suspense:true, countdown:3, cdPrize:false, animation:'slot',
 title:'', subtitle:'', theme:'navy', bgAnim:true, bgDim:0.55, logoPos:'left', logoWhite:false, namePos:'top',
 bigBoard:false, stageShare:21, winnersPanel:'side',
 welTitle:'', welSub:'The draw will begin shortly', welBefore:true, welPaused:false, welPausedSec:20, welAfter:true,
 sponsorPos:'off', sponsorSize:'small',
 tickOn:false, tickText:'', tickSize:2.6, tickSpeed:'med', tickFg:'#ffffff', tickBg:'#0b0b16',
 sound:true, volume:0.7, tts:false, ttsVoice:'', ttsRate:1, ttsOnlyWinners:false, view:'setup'
};
function loadJSON(k){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch(e){ return null; } }
let storageWarned=false;
function saveJSON(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ if(!storageWarned){ storageWarned=true; toast('Browser storage is full — try a smaller image','warn'); } return false; } }
let S=Object.assign(JSON.parse(JSON.stringify(DEF)), loadJSON(K_SET)||{});
if(!Array.isArray(S.lists)||!S.lists.length) S.lists=JSON.parse(JSON.stringify(DEF.lists));
if(!S.lists.find(l=>l.id===S.listId)) S.listId=S.lists[0].id;
if(S.splitPrompt==='Would our finalists like to split the grand prize?') S.splitPrompt=DEF.splitPrompt; // old default → Final Three Deal wording
if(!['top','center'].includes(S.namePos)) S.namePos='top';
let G = IS_DISPLAY ? null : loadJSON(K_GAME);
const A={};
['logo','bg','welcome','sponsor'].forEach(k=>{ try{ A[k]=localStorage.getItem(K_ASSET+k)||null; }catch(e){ A[k]=null; } });
let _st=0;
function saveSettings(){ if(IS_DISPLAY) return; clearTimeout(_st); _st=setTimeout(()=>saveJSON(K_SET,S),120); }
function saveGame(){ if(IS_DISPLAY) return; if(G) saveJSON(K_GAME,G); else { try{ localStorage.removeItem(K_GAME);}catch(e){} } }
addEventListener('beforeunload',()=>{ if(!IS_DISPLAY){ clearTimeout(_st); saveJSON(K_SET,S); saveGame(); } });

/* ---------- tickets ---------- */
function parseNameLines(text){
  const out=[];
  for(const raw of String(text||'').split(/\r?\n/)){
    const line=raw.replace(/\t+/g,' ').trim(); if(!line) continue;
    const m=line.match(/^([^|]{1,24}?)\s*\|\s*(.+)$/);
    if(m) out.push({n:m[2].trim(), no:m[1].trim()}); else out.push({n:line, no:null});
  }
  return out;
}
function buildSeqTickets(seqs){
  const inc=[], exc=new Set(), seen=new Set();
  for(const s of seqs||[]){
    const a=parseInt(s.from,10), b=parseInt(s.to,10); if(!isFinite(a)||!isFinite(b)) continue;
    const lo=Math.min(a,b), hi=Math.max(a,b); if(hi-lo>5000) continue;
    const d=clamp(parseInt(s.digits,10)||0,0,8);
    for(let i=lo;i<=hi;i++){ const lab=(s.prefix||'')+String(i).padStart(d,'0'); if(s.exclude) exc.add(lab); else inc.push({n:lab,no:lab,c:s.color||null,num:true}); }
  }
  return inc.filter(t=>!exc.has(t.n) && !seen.has(t.n) && seen.add(t.n));
}
function draftTickets(){
  if(S.mode==='numbers') return buildSeqTickets(S.seqs);
  return parseNameLines(S.namesText).map((t,i)=>({n:t.n, no:t.no||String(i+1), c:null}));
}
function curList(){ return S.lists.find(l=>l.id===S.listId)||S.lists[0]; }
function prizeText(p){ return String(p.text||'').trim()||'Prize'; }
function prizeAt(cn){ for(const p of curList().prizes){ if(parseInt(p.call,10)===cn) return p; } return null; }
/* ---------- Final Three Deal ---------- */
const NUMW=['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten'];
function dealName(n){ n=parseInt(n,10); if(!(n>=0)) n=0; return 'Final '+(NUMW[n]||n)+' Deal'; }
function ruText(ru,runner){ return ru===1?('1 runner-up gets '+runner):(ru+' runners-up get '+runner+' each'); }
// amounts for N finalists: the N-1 runners-up get `runner` each, the last one standing gets `winner`; "play for it all" = grand prize
function dealInfo(n){ n=parseInt(n,10)||0; const ru=Math.max(1,n-1); const runner=String(S.dealRunner||'').trim()||'$500', winner=String(S.dealWinner||'').trim()||'$2,000', full=String(S.grandPrize||'').trim()||'Grand Prize';
  return {name:dealName(n),n,ru,runner,winner,full,ruText:ruText(ru,runner)}; }

/* ---------- sound (WebAudio, generated) ---------- */
const Snd={ctx:null,master:null,nb:null,
 init(){ if(IS_DISPLAY) return; try{ if(!this.ctx){ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; this.ctx=new AC(); this.master=this.ctx.createGain(); this.master.connect(this.ctx.destination); const len=this.ctx.sampleRate*2, b=this.ctx.createBuffer(1,len,this.ctx.sampleRate), d=b.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1; this.nb=b; } if(this.ctx.state==='suspended') this.ctx.resume(); }catch(e){} },
 ok(){ if(!S.sound||!this.ctx||this.ctx.state!=='running') return false; this.master.gain.value=S.volume; return true; },
 tone(f,t0,dur,type,g,f2){ const c=this.ctx,o=c.createOscillator(),a=c.createGain(); o.type=type||'sine'; o.frequency.setValueAtTime(f,t0); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t0+dur); a.gain.setValueAtTime(0.0001,t0); a.gain.exponentialRampToValueAtTime(g||0.3,t0+0.012); a.gain.exponentialRampToValueAtTime(0.0001,t0+dur); o.connect(a); a.connect(this.master); o.start(t0); o.stop(t0+dur+0.03); },
 noise(t0,dur,g,type,freq,q){ const c=this.ctx,s=c.createBufferSource(); s.buffer=this.nb; const f=c.createBiquadFilter(); f.type=type||'bandpass'; f.frequency.value=freq||1000; f.Q.value=q||1; const a=c.createGain(); a.gain.setValueAtTime(g,t0); a.gain.exponentialRampToValueAtTime(0.0001,t0+dur); s.connect(f); f.connect(a); a.connect(this.master); s.start(t0,Math.random()); s.stop(t0+dur+0.05); },
 tick(){ if(!this.ok()) return; this.tone(2200,this.ctx.currentTime,0.03,'square',0.05); },
 ticksAt(times){ if(!this.ok()) return; const t0=this.ctx.currentTime; let last=-1; for(const ms of times){ if(ms-last<40) continue; last=ms; this.tone(2200,t0+ms/1000,0.03,'square',0.05); } },
 out(){ if(!this.ok()) return; const t=this.ctx.currentTime; this.tone(300,t,0.25,'sine',0.22,95); this.noise(t,0.09,0.05,'bandpass',1200,0.7); },
 drumroll(dur){ if(!this.ok()) return; const c=this.ctx,t0=c.currentTime; const s=c.createBufferSource(); s.buffer=this.nb; s.loop=true; const f=c.createBiquadFilter(); f.type='bandpass'; f.frequency.value=420; f.Q.value=0.7; const trem=c.createGain(); trem.gain.value=0.5; const lfo=c.createOscillator(); lfo.frequency.value=18; const lg=c.createGain(); lg.gain.value=0.5; lfo.connect(lg); lg.connect(trem.gain); const a=c.createGain(); a.gain.setValueAtTime(0.0001,t0); a.gain.linearRampToValueAtTime(0.22,t0+0.2); a.gain.linearRampToValueAtTime(0.65,t0+dur); a.gain.linearRampToValueAtTime(0.0001,t0+dur+0.06); s.connect(f); f.connect(trem); trem.connect(a); a.connect(this.master); s.start(t0); lfo.start(t0); s.stop(t0+dur+0.1); lfo.stop(t0+dur+0.1); this.noise(t0+dur,1.6,0.35,'highpass',5200,0.5); this.tone(110,t0+dur,0.6,'sine',0.5,45); },
 brass(f,t0,len,g){ const c=this.ctx,o=c.createOscillator(),o2=c.createOscillator(); o.type='sawtooth'; o2.type='sawtooth'; o.frequency.value=f; o2.frequency.value=f*1.005; const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.setValueAtTime(500,t0); lp.frequency.linearRampToValueAtTime(3400,t0+0.06); lp.frequency.linearRampToValueAtTime(1600,t0+len); const a=c.createGain(); a.gain.setValueAtTime(0.0001,t0); a.gain.linearRampToValueAtTime(g||0.12,t0+0.03); a.gain.setValueAtTime((g||0.12)*0.85,t0+len*0.7); a.gain.exponentialRampToValueAtTime(0.0001,t0+len+0.3); o.connect(lp); o2.connect(lp); lp.connect(a); a.connect(this.master); o.start(t0); o2.start(t0); o.stop(t0+len+0.35); o2.stop(t0+len+0.35); },
 fanfare(big){ if(!this.ok()) return; const t=this.ctx.currentTime+0.03; const ph=big?[[523.25,0,.17],[659.25,.17,.17],[783.99,.34,.17],[1046.5,.51,.85],[783.99,.51,.85],[659.25,.51,.85],[587.33,1.5,.15],[739.99,1.65,.15],[880,1.8,.15],[1174.66,1.95,1.6],[880,1.95,1.6],[587.33,1.95,1.6],[293.66,1.95,1.6]]:[[523.25,0,.13],[659.25,.13,.13],[783.99,.26,.55],[1046.5,.26,.55],[392,.26,.55]]; for(const [f,d,l] of ph) this.brass(f,t+d,l,big?0.1:0.11); if(big){ this.noise(t+0.51,1.4,0.18,'highpass',6000,0.4); this.noise(t+1.95,2.2,0.2,'highpass',6000,0.4); } },
 chime(){ if(!this.ok()) return; const t=this.ctx.currentTime; [659.25,783.99,987.77,1318.5].forEach((f,i)=>this.tone(f,t+i*0.12,1.1,'triangle',0.16)); },
 beep(hi){ if(!this.ok()) return; this.tone(hi?1318.5:880,this.ctx.currentTime,hi?0.6:0.2,'triangle',0.28); },
 clunk(){ if(!this.ok()) return; const t=this.ctx.currentTime; this.noise(t,0.14,0.22,'lowpass',520,0.8); this.tone(150,t,0.16,'square',0.06,55); this.noise(t+0.3,0.07,0.16,'bandpass',1100,1.4); }, // slot lever pull + spring back
 back(){ if(!this.ok()) return; const t=this.ctx.currentTime; this.tone(330,t,0.35,'triangle',0.2,990); this.tone(660,t+0.18,0.4,'sine',0.12); }
};
/* ---------- text to speech ---------- */
const TTS={voices:[],
 init(){ if(IS_DISPLAY||!('speechSynthesis' in window)) return; const load=()=>{ this.voices=speechSynthesis.getVoices()||[]; fillVoices(); }; load(); speechSynthesis.onvoiceschanged=load; },
 say(text, force){ if(IS_DISPLAY||!('speechSynthesis' in window)) return; if(!S.tts&&!force) return; try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); const v=this.voices.find(v=>v.voiceURI===S.ttsVoice); if(v){u.voice=v;u.lang=v.lang;} u.rate=S.ttsRate||1; speechSynthesis.speak(u);}catch(e){} }
};
/* ---------- confetti & fireworks ---------- */
const FX={cv:null,cx:null,P:[],raf:0,W:0,H:0,dpr:1,until:0,fw:0,
 init(cv){ this.cv=cv; this.cx=cv.getContext('2d'); addEventListener('resize',()=>this.size()); this.size(); },
 size(){ if(!this.cv) return; const r=this.cv.getBoundingClientRect(); this.dpr=Math.min(2,devicePixelRatio||1); this.W=r.width||innerWidth; this.H=r.height||innerHeight; this.cv.width=this.W*this.dpr; this.cv.height=this.H*this.dpr; },
 cols(){ const cs=getComputedStyle(document.body); return [cs.getPropertyValue('--accent').trim()||'#d8b14a',cs.getPropertyValue('--accent2').trim()||'#f8de8f','#ffffff','#ff6b8b','#5ad1ff','#a78bfa','#7cf0a4','#ffb347']; },
 confetti(x,y,n,spread,power){ const c=this.cols(); spread=spread||1; power=power||1; for(let i=0;i<n;i++) this.P.push({k:'c',x,y,vx:(Math.random()-0.5)*15*spread*power,vy:(-Math.random()*15-6)*power,g:0.36,dr:0.985,w:6+Math.random()*8,h:9+Math.random()*10,r:Math.random()*6.3,vr:(Math.random()-0.5)*0.35,fl:Math.random()*6.3,col:c[(Math.random()*c.length)|0],life:1,dec:0.003+Math.random()*0.003}); this.go(); },
 burst(big){ this.size(); const W=this.W,H=this.H; this.confetti(W*0.12,H*0.92,big?220:120,0.9,1.25); this.confetti(W*0.88,H*0.92,big?220:120,0.9,1.25); if(big) this.confetti(W*0.5,H*0.95,200,1.4,1.3); },
 rain(ms){ this.until=Math.max(this.until,performance.now()+ms); this.go(); },
 fireworks(ms){ this.fw=Math.max(this.fw,performance.now()+ms); this.go(); },
 stop(){ this.until=0; this.fw=0; this.P.length=0; },
 go(){ if(!this.raf&&this.cx) this.raf=requestAnimationFrame(()=>this.loop()); },
 loop(){ this.raf=0; const now=performance.now(), c=this.cx, W=this.W, H=this.H; c.setTransform(this.dpr,0,0,this.dpr,0,0); c.clearRect(0,0,W,H);
  if(now<this.until){ const cl=this.cols(); for(let k=0;k<3;k++) this.P.push({k:'c',x:Math.random()*W,y:-20,vx:(Math.random()-0.5)*2,vy:Math.random()*2+1,g:0.05,dr:0.995,w:6+Math.random()*7,h:9+Math.random()*9,r:Math.random()*6.3,vr:(Math.random()-0.5)*0.2,fl:Math.random()*6.3,col:cl[(Math.random()*cl.length)|0],life:1,dec:0.0015}); }
  if(now<this.fw && Math.random()<0.07){ const cl=this.cols(); this.P.push({k:'r',x:W*(0.12+Math.random()*0.76),y:H+10,vx:(Math.random()-0.5)*2,vy:-(H*0.016+4+Math.random()*4),g:0.17,col:cl[(Math.random()*cl.length)|0],life:1}); }
  const P=this.P; if(P.length>2600) P.splice(0,P.length-2600);
  for(let i=P.length-1;i>=0;i--){ const p=P[i];
   if(p.k==='c'){ p.vx*=p.dr; p.vy=p.vy*p.dr+p.g; p.x+=p.vx; p.y+=p.vy; p.r+=p.vr; p.fl+=0.12; p.life-=p.dec; if(p.y>H+40||p.life<=0){P.splice(i,1);continue;} c.save(); c.globalAlpha=Math.min(1,p.life*2); c.translate(p.x,p.y); c.rotate(p.r); c.scale(1,Math.cos(p.fl)); c.fillStyle=p.col; c.fillRect(-p.w/2,-p.h/2,p.w,p.h); c.restore(); }
   else if(p.k==='r'){ p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; c.globalAlpha=1; c.fillStyle=p.col; c.beginPath(); c.arc(p.x,p.y,2.6,0,6.3); c.fill(); if(p.vy>=-1){ P.splice(i,1); const n=80; for(let j=0;j<n;j++){ const a=j/n*6.283, sp=2.5+Math.random()*5.5; P.push({k:'s',x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,g:0.055,dr:0.972,col:Math.random()<0.25?'#ffffff':p.col,life:1,dec:0.01+Math.random()*0.012,sz:1.6+Math.random()*2.2}); } } }
   else { p.vx*=p.dr; p.vy=p.vy*p.dr+p.g; p.x+=p.vx; p.y+=p.vy; p.life-=p.dec; if(p.life<=0){P.splice(i,1);continue;} c.globalAlpha=Math.max(0,p.life); c.fillStyle=p.col; c.beginPath(); c.arc(p.x,p.y,p.sz,0,6.3); c.fill(); }
  }
  c.globalAlpha=1;
  if(P.length||now<this.until||now<this.fw) this.go();
 }
};

/* ---------- window link (second screen) ---------- */
const ME = IS_DISPLAY ? 'display' : 'control';
const DID = IS_DISPLAY ? uid() : null;
let bc=null; try{ bc=new BroadcastChannel('rr-reverse-raffle'); }catch(e){}
let popup=null, _seq=0; const _seen=new Set();
function post(msg){
  msg.id=ME+'-'+Date.now()+'-'+(_seq++); msg.from=ME; if(DID) msg.did=DID;
  try{ bc&&bc.postMessage(msg); }catch(e){}
  const tgt = IS_DISPLAY ? window.opener : (popup&&!popup.closed?popup:null);
  if(tgt){ try{ tgt.postMessage({rr:msg},'*'); }catch(e){} }
}
function onMsg(m){
  if(!m||!m.id||m.from===ME||_seen.has(m.id)) return;
  _seen.add(m.id); if(_seen.size>800){ const it=_seen.values(); for(let i=0;i<400;i++) _seen.delete(it.next().value); }
  if(IS_DISPLAY){ if(m.to&&m.to!==DID) return; R.handle(m); } else ctrlMsg(m);
}
if(bc) bc.onmessage=e=>onMsg(e.data);
addEventListener('message',e=>{ if(e.data&&e.data.rr) onMsg(e.data.rr); });

/* ---------- renderer (big screen) ---------- */
const R={D:null,T:[],O:[],A:{},dy:null,cells:[],tok:0,animating:false,stageCn:-1,ovKey:'',showNo:null,prevSt:null,cdOn:false,
 handle(m){
  try{
   switch(m.t){
    case 'full': this.full(m); break;
    case 'disp': this.D=m.D; this.applyD(); if(this.dy) this.dyn(this.dy); break;
    case 'assets': this.assets(m.A); break;
    case 'dyn': this.dyn(m.dy); break;
    case 'anim': this.anim(m.plan); break;
    case 'reveal': this.reveal(m); break;
    case 'fx': this.fx(m); break;
    case 'cd': this.countdown(m.n); break;
   }
  }catch(e){ console.error(e); }
 },
 full(m){ this.tok++; this.animating=false; ['ovWinner','ovFinal','ovGrand'].forEach(id=>$(id).classList.remove('on')); $('sStage').classList.remove('spinning'); this.D=m.D; this.T=m.T||[]; this.O=m.O||[]; this.prevSt=null; this.ovKey=''; this.stageCn=-1; if(m.A) this.A=m.A; this.showNo=null; this.applyD(); this.assets(this.A); this.build(); this.dyn(m.dy||null); },
 applyD(){
  const D=this.D; if(!D) return; const sh=$('show');
  document.body.dataset.theme=D.theme;
  sh.classList.toggle('anim-bg',!!D.bgAnim); sh.classList.toggle('bigboard',!!D.bigBoard);
  $('sStageRow').style.setProperty('--stageH',clamp(+D.stageShare||21,10,45)+'vh');
  $('sTitle').innerHTML=(D.subtitle?'<small></small>':'')+'<span></span>';
  if(D.subtitle) $('sTitle').querySelector('small').textContent=D.subtitle;
  $('sTitle').querySelector('span').textContent=D.title||'Reverse Raffle';
  $('sHead').classList.toggle('logo-right',D.logoPos==='right');
  $('sLogo').classList.toggle('white',!!D.logoWhite); this.welTint();
  this.center=D.namePos==='center'&&!D.bigBoard; sh.classList.toggle('name-center',this.center); this.placeStage();
  $('sStage').classList.toggle('slot',D.animation==='slot'&&!D.bigBoard);
  const wp=D.winnersPanel||'side';
  $('sSide').classList.toggle('hidden',!(wp==='side'||wp==='both'));
  $('sWinTop').classList.toggle('hidden',!(wp==='top'||wp==='both'));
  const tk=$('sTicker'); const tOn=!!(D.tickOn&&String(D.tickText||'').trim());
  tk.classList.toggle('hidden',!tOn);
  if(tOn){ const tr=$('sTickTrack'); if(tr.textContent!==D.tickText) tr.textContent=D.tickText; tk.style.setProperty('--tfg',D.tickFg); tk.style.setProperty('--tbg',D.tickBg); tk.style.setProperty('--tfs',(+D.tickSize||2.6)+'vh'); const per={slow:0.32,med:0.2,fast:0.11}[D.tickSpeed]||0.2; tk.style.setProperty('--tdur',Math.max(10,(String(D.tickText).length+40)*per)+'s'); }
  $('bgDimL').style.opacity=this.A.bg?(+D.bgDim):0;
  this.sponsors();
  const want=!!(D.showNumbers&&!(this.T[0]&&this.T[0].num));
  if(this.showNo!==null && want!==this.showNo) this.build(); else this.relayout();
  if(IS_DISPLAY) $('dSetup').classList.add('hidden');
 },
 assets(Aa){ this.A=Aa||{}; const lg=$('sLogo'); if(this.A.logo){ lg.src=this.A.logo; lg.classList.remove('hidden'); } else { lg.removeAttribute('src'); lg.classList.add('hidden'); }
  $('bgImg').style.backgroundImage=this.A.bg?'url("'+this.A.bg+'")':'none';
  if(this.D) $('bgDimL').style.opacity=this.A.bg?(+this.D.bgDim):0;
  const wi=$('welImg'), src=this.A.welcome||this.A.logo; if(src){ wi.src=src; wi.classList.remove('hidden'); } else { wi.removeAttribute('src'); wi.classList.add('hidden'); }
  this.welTint(); this.sponsors(); },
 welTint(){ $('welImg').classList.toggle('white',!!(this.D&&this.D.logoWhite&&!this.A.welcome&&this.A.logo)); },
 // "just called" name: in the top row, or as a card in the middle of the board (the grid flows around it)
 placeStage(){ const st=this.stageEl||(this.stageEl=$('sStage')); if(this.center){ if(st.parentNode!==$('sGrid')) $('sGrid').appendChild(st); } else { if(st.parentNode!==$('sStageRow')) $('sStageRow').prepend(st); st.style.gridColumn=''; st.style.gridRow=''; } },
 sponsors(){ const D=this.D||{}; const on=!!(this.A.sponsor&&D.sponsorPos&&D.sponsorPos!=='off');
  for(const [id,side] of [['sSpL','left'],['sSpR','right']]){ const el=$(id); const vis=on&&D.sponsorPos===side; el.classList.toggle('hidden',!vis); el.classList.toggle('small',D.sponsorSize!=='large'); el.classList.toggle('large',D.sponsorSize==='large'); if(vis) el.querySelector('img').src=this.A.sponsor; }
  this.relayout(); },
 build(){
  const g=$('sGrid'); const stg=this.stageEl||(this.stageEl=$('sStage')); if(stg&&stg.parentNode===g) $('sStageRow').appendChild(stg); // keep the stage when the grid is rebuilt
  g.replaceChildren(); this.cells=new Array(this.T.length);
  const D=this.D||{}; this.showNo=!!(D.showNumbers&&!(this.T[0]&&this.T[0].num));
  const frag=document.createDocumentFragment();
  for(const i of this.O){ const t=this.T[i]; if(!t) continue; const d=document.createElement('div'); d.className='cell';
   if(t.c){ d.dataset.c='1'; d.style.setProperty('--sc',t.c); }
   if(t.num){ d.classList.add('numonly'); }
   else if(this.showNo){ const no=document.createElement('span'); no.className='no'; no.textContent=t.no; d.appendChild(no); }
   const nm=document.createElement('span'); nm.className='nm'; nm.dir='auto'; nm.textContent=t.n; d.appendChild(nm);
   frag.appendChild(d); this.cells[i]=d; }
  g.appendChild(frag); this.placeStage(); this.prevSt=null; this.layout(); if(this.dy) this.paint();
 },
 relayout(){ clearTimeout(this._rl); this._rl=setTimeout(()=>{ this.layout(); this.fitOverlays(); this.fitStage(); },60); },
 layout(){
  const wrap=$('sGridWrap'), g=$('sGrid'); const W=wrap.clientWidth, H=wrap.clientHeight, n=this.O.length; if(!n||W<20||H<20) return;
  const gap=Math.max(3,Math.round(Math.min(innerWidth,innerHeight)*0.0055));
  const ws=this.O.map(i=>textW(this.T[i].n,700)); const sorted=[...ws].sort((a,b)=>a-b); const ref=sorted[Math.floor((sorted.length-1)*0.62)]||100;
  const withNo=this.showNo; let best=null; const center=!!this.center; const fr=clamp((+(this.D&&this.D.stageShare)||21)/70,0.18,0.6);
  for(let c=1;c<=n;c++){ let r=Math.ceil(n/c), bc=0, br=0;
   if(center){ bc=Math.max(1,Math.round(c*0.56)); if((c-bc)%2&&bc<c) bc++; for(let g2=0;g2<400;g2++){ br=Math.max(1,Math.round(r*fr)); if((r-br)%2) br++; if(r*c-bc*br>=n) break; r++; } }
   const cw=(W-gap*(c-1))/c, ch=(H-gap*(r-1))/r; if(cw<16) break; if(ch<8) continue;
   const bdr=(this.T[0]&&this.T[0].c)?innerHeight*0.0045:0; const fs=Math.min(ch*(withNo?0.36:0.46),(cw*0.84-bdr-2)/(ref/100)); const score=fs*(1-Math.abs(cw/ch-3.4)*0.012);
   if(!best||score>best.score) best={c,r,cw,ch,fs,score,bc,br}; }
  if(!best) return; const {c,r,cw,ch}=best; const fs=Math.min(best.fs,ch*0.52,72);
  const st=$('sStage'); if(center&&st.parentNode===g){ st.style.gridColumn=(Math.floor((c-best.bc)/2)+1)+' / span '+best.bc; st.style.gridRow=(Math.floor((r-best.br)/2)+1)+' / span '+best.br; }
  g.style.gridTemplateColumns='repeat('+c+',minmax(0,1fr))'; g.style.gridTemplateRows='repeat('+r+','+ch.toFixed(2)+'px)';
  g.style.setProperty('--gap',gap+'px'); g.style.setProperty('--cr',Math.round(Math.min(ch,cw)*0.2)+'px');
  this.O.forEach((i,k)=>{ const cell=this.cells[i]; if(!cell) return; const w=ws[k]*fs/100, avail=cw*0.84-(this.T[i].c?innerHeight*0.0045:0)-2; let f=fs, two=false;
   if(w>avail){ const sc=avail/w; if(sc>=0.76) f=fs*sc; else { two=true; f=Math.min(fs*Math.max(0.6,Math.min(1,sc*1.85)),ch*(withNo?0.27:0.38)); } }
   cell.style.fontSize=f.toFixed(1)+'px'; cell.classList.toggle('two',two); });
  this.cellW=cw; this.cellH=ch;
 },
 dyn(dy){
  this.dy=dy; const D=this.D||{};
  if(!dy){ this.setOv(null); $('ovWel').classList.add('on'); this.welcomeText(null); return; }
  $('sCalled').textContent=dy.called; $('sRem').textContent=dy.rem;
  $('sBar').style.width=(dy.total>1?Math.min(100,(dy.total-dy.rem)/(dy.total-1)*100):0)+'%';
  $('sSpeedInfo').textContent=dy.phase==='running'?('Every '+fmtS(dy.speed)+(dy.finalStretch?' · final stretch':'')):(dy.phase==='ready'?dy.total+' tickets in the draw':(dy.phase==='paused'?'Paused':''));
  const nx=$('sNext'); nx.classList.toggle('soon',!!(dy.next&&dy.next.inCalls===1));
  if(dy.next){ nx.innerHTML='<div class="k">Next prize at call <b></b></div><div class="t"></div><div class="i"></div>'; nx.querySelector('b').textContent='#'+dy.next.cn; nx.querySelector('.t').textContent=dy.next.text; nx.querySelector('.i').textContent=dy.next.inCalls===1?'This is the next call!':('in '+dy.next.inCalls+' calls'); }
  else { const dl=dy.deal||{}; nx.innerHTML='<div class="k"></div><div class="t"></div><div class="i"></div>'; nx.querySelector('.k').textContent=dy.grandWon?'Grand prize':(dy.finN>=2&&dy.rem>dy.finN?'Up next':'Grand prize'); nx.querySelector('.t').textContent=dy.grandPrize||D.grandPrize||'Grand Prize'; nx.querySelector('.i').textContent=dy.grandWon?'Congratulations!':(dy.finN>=2&&dy.rem>dy.finN?((dl.on?dl.name:('Final '+dy.finN))+' — then the grand prize'):(dl.decision==='deal'?(dl.name+' taken · last one standing wins'):'Last ticket standing wins')); }
  const chip=$('sChip'); chip.className='s-chip '+(dy.chip.cls||''); $('sChipT').textContent=dy.chip.text;
  const wl=$('sWinList'), wt=$('sWinTop'); const wins=dy.wins.slice().reverse();
  const sig=wins.map(w=>w.cn).join(',');
  if(wl.dataset.sig!==sig){ wl.dataset.sig=sig; wl.replaceChildren(); wt.replaceChildren();
   if(!wins.length){ const e=document.createElement('div'); e.className='empty'; e.textContent='Prize winners will appear here'; wl.appendChild(e); }
   wins.slice(0,14).forEach(w=>{ const li=document.createElement('li'); li.innerHTML='<div class="c"></div><div class="n" dir="auto"></div><div class="p"></div>'; li.querySelector('.c').textContent='Call #'+w.cn; li.querySelector('.n').textContent=w.n; li.querySelector('.p').textContent=w.prize; wl.appendChild(li); });
   wins.slice(0,10).forEach(w=>{ const c=document.createElement('div'); c.className='wchip'; c.innerHTML='<b></b><span dir="auto"></span><span></span>'; c.children[0].textContent='#'+w.cn; c.children[1].textContent=w.n; c.children[1].style.color='var(--text)'; c.children[2].textContent=w.prize; wt.appendChild(c); }); }
  const gb=$('sGrandBox'), dl=dy.deal||{}; gb.innerHTML='<div class="k">Grand prize</div><div class="t"></div><div class="f"></div>'; gb.querySelector('.t').textContent=dy.grandPrize||D.grandPrize||'Grand Prize';
  gb.querySelector('.f').textContent=dy.grandWon?('Won by '+dy.grandWon):(dl.decision==='deal'?(dl.name+' taken · runners-up get '+dl.runner+' each'):(dl.decision==='continue'?'Playing for it all':(dl.on?('or the '+dl.name+': '+dl.winner+' + '+dl.ru+' × '+dl.runner):(dy.finN>=2?('Final '+dy.finN):'Last ticket standing'))));
  this.paint();
  if(!this.animating && dy.lastCn!==this.stageCn) this.stageIdle();
  this.setOv(dy.ov);
  $('ovWel').classList.toggle('on',!!dy.welcome && !this.cdOn); this.welcomeText(dy);
  const dp=$('dPlay'); dp.textContent=dy.phase==='running'?'❚❚ Pause':(dy.phase==='ready'?'▶ Start':'▶ Continue');
  const sp=$('dSpeed'); if(document.activeElement!==sp) sp.value=dy.speed; $('dSpeedV').textContent=fmtS(dy.speed);
  $('dSound').style.opacity=dy.sound?1:0.45; $('dVoice').style.opacity=dy.tts?1:0.45;
 },
 welcomeText(dy){ const D=this.D||{}; const after=dy&&(dy.phase==='done'||dy.phase==='split');
  $('welBadge').textContent=after?'Thank you':(dy&&dy.phase!=='ready'?'We will be right back':'Reverse raffle');
  $('welTitleT').textContent=D.welTitle||D.title||'Reverse Raffle';
  $('welSubT').textContent=after?('Congratulations to all our winners!'):(D.welSub||''); },
 paint(){
  const dy=this.dy; if(!dy) return; const st=dy.st; const fin=new Set(dy.fin||[]); const prev=this.prevSt;
  for(let i=0;i<this.cells.length;i++){ const cell=this.cells[i]; if(!cell) continue; let s=st[i]; if(i===dy.pending) s=-1;
   const out=s>=0, rem=s===-2, w=out?dy.wmap[i]:null;
   cell.classList.toggle('out',out); cell.classList.toggle('removed',rem); cell.classList.toggle('win',!!w);
   let b=cell.querySelector('.badge'); if(w){ if(!b){ b=document.createElement('span'); b.className='badge'; cell.appendChild(b);} b.textContent='🏆 #'+w; } else if(b) b.remove();
   cell.classList.toggle('fin',s===-1&&fin.has(i)&&dy.grand==null);
   cell.classList.toggle('grand',dy.grand===i);
   if(prev && prev[i]!==-1 && s===-1 && i!==dy.pending){ cell.classList.remove('back'); void cell.offsetWidth; cell.classList.add('back'); setTimeout(()=>cell.classList.remove('back'),1300); }
  }
  this.prevSt=st.slice(); if(dy.pending!=null) this.prevSt[dy.pending]=-1;
 },
 /* ----- stage ----- */
 nameEl(t, dim){ const tk=this.T[t]; const d=document.createElement('div'); d.className='s-name'+(dim?' dim':''); d.dir='auto';
  if(tk&&this.showNo&&!tk.num){ const no=document.createElement('span'); no.className='no'; no.textContent=tk.no; d.appendChild(no); }
  d.appendChild(document.createTextNode(tk?tk.n:'')); d.dataset.t=t; this.fitName(d,tk?tk.n:''); return d; },
 fitName(d,text){ const win=$('sStageWin'); const W=win.clientWidth*0.94, H=win.clientHeight; const extra=(this.showNo&&d.querySelector('.no'))?1.25:1; d.style.fontSize=fitPx(text,W/extra,Math.max(14,H*0.78),800).toFixed(1)+'px'; },
 fitStage(){ const win=$('sStageWin'); win.querySelectorAll('.s-name').forEach(d=>{ if(d.dataset.t==null){ if(d.parentNode===win) d.style.fontSize=fitPx(d.textContent,win.clientWidth*0.9,Math.max(14,win.clientHeight*0.62),800)+'px'; return; } const t=+d.dataset.t; const tk=this.T[t]; if(tk) this.fitName(d,tk.n); }); },
 stageText(label,big,sub){ $('sStageLabel').textContent=label; const win=$('sStageWin'); win.classList.remove('reelmask'); const d=document.createElement('div'); d.className='s-name'; d.textContent=big; d.style.fontSize=fitPx(big,win.clientWidth*0.9,Math.max(14,win.clientHeight*0.62),800)+'px'; win.replaceChildren(d); const s=$('sStageSub'); s.className='s-stage-sub'; s.textContent=sub||''; },
 stageIdle(){ const dy=this.dy; if(!dy) return; this.stageCn=dy.lastCn; $('sStage').classList.remove('prize');
  if(dy.last){ const L=dy.last; $('sStageLabel').textContent=(L.prize?'🏆 Call #':'Call #')+L.cn; const win=$('sStageWin'); win.classList.remove('reelmask'); win.replaceChildren(this.nameEl(L.t)); const s=$('sStageSub'); s.className='s-stage-sub'+(L.prize?' win':''); s.textContent=L.prize?('Wins '+L.prize):'is out'; if(L.prize) $('sStage').classList.add('prize'); }
  else this.stageText((this.D&&this.D.title)?'Reverse raffle':'Get ready','Get ready!', dy.total+' tickets · last ticket standing wins');
 },
 anim(p){
  const tok=++this.tok; this.animating=true; this.clearLit();
  const st=$('sStage'); st.classList.toggle('prize',!!p.prize);
  $('sStageLabel').textContent=p.prize?('🏆 Prize call #'+p.cn+' · '+p.prize):('Call #'+p.cn);
  const sub=$('sStageSub'); sub.className='s-stage-sub'+(p.prize?' win':''); sub.textContent=p.prize?'Who will win it…':'';
  const D=this.D||{}; const a=(D.bigBoard||p.dur<0.3)?'quick':p.anim;
  st.classList.remove('spinning'); if(D.animation!=='slot') st.classList.toggle('slot',a==='slot');
  const done=()=>tok===this.tok;
  this['a_'+a] ? this['a_'+a](p,done) : this.a_quick(p,done);
 },
 a_quick(p,done){ const win=$('sStageWin'); win.classList.remove('reelmask'); const d=this.nameEl(p.t); win.replaceChildren(d); d.animate([{opacity:0,transform:'scale(.85)'},{opacity:1,transform:'none'}],{duration:Math.max(80,p.dur*900),easing:'ease-out'});
  const c=this.cells[p.t]; if(c){ c.classList.add('lit'); setTimeout(()=>c.classList.remove('lit'),Math.max(80,p.dur*900)); } },
 pullLever(ms){ const arm=$('sLeverArm'), kn=$('sLeverKnob'); if(!arm||!arm.animate) return; const d=clamp(ms*0.5,320,900), L=arm.offsetHeight*2;
  const ein='cubic-bezier(.55,0,.85,.4)', eout='cubic-bezier(.25,1.5,.4,1)';
  arm.animate([{transform:'scaleY(1)',easing:ein},{transform:'scaleY(-1)',offset:.32},{transform:'scaleY(-1)',offset:.44,easing:eout},{transform:'scaleY(1)'}],{duration:d});
  kn.animate([{transform:'translateY(0) scale(1)',easing:ein},{transform:'translateY('+L+'px) scale(1.22)',offset:.32},{transform:'translateY('+L+'px) scale(1.22)',offset:.44,easing:eout},{transform:'translateY(0) scale(1)'}],{duration:d}); },
 a_slot(p,done){
  const stg=$('sStage'); stg.classList.add('slot','spinning'); this.pullLever(p.dur*1000);
  const win=$('sStageWin'); win.classList.add('reelmask'); const H=win.clientHeight, W=win.clientWidth; const list=p.decoys.concat([p.t]);
  const reel=document.createElement('div'); reel.className='reel';
  list.forEach(t=>{ const tk=this.T[t]; const d=document.createElement('div'); d.style.height=H+'px'; d.dir='auto'; d.textContent=tk?tk.n:''; d.style.fontSize=fitPx(tk?tk.n:'',W*0.92,H*0.78,800)+'px'; reel.appendChild(d); });
  win.replaceChildren(reel); const N=list.length-1, D=p.dur*1000, t0=performance.now();
  const step=()=>{ if(!done()) return; const q=Math.min(1,(performance.now()-t0)/D); const e=1-Math.pow(1-q,3.2); reel.style.transform='translate3d(0,'+(-e*N*H).toFixed(1)+'px,0)';
   const v=3.2*Math.pow(1-q,2.2)*N*H/D*16.7; reel.style.filter=v>6?'blur('+Math.min(7,v*0.06).toFixed(1)+'px)':'none'; // motion blur while the reel is fast
   if(q<1) requestAnimationFrame(step); else { stg.classList.remove('spinning'); this.finishName(p,true); } };
  requestAnimationFrame(step);
 },
 cellCenter(t){ const c=this.cells[t]; if(!c) return null; const a=c.getBoundingClientRect(), b=$('sSpot').getBoundingClientRect(); return {x:a.left-b.left+a.width/2, y:a.top-b.top+a.height/2}; },
 a_spotlight(p,done){
  const sp=$('sSpot'); const pts=p.decoys.concat([p.t]).map(t=>({t,c:this.cellCenter(t)})).filter(o=>o.c);
  if(!pts.length) return this.a_quick(p,done);
  sp.style.setProperty('--sr',Math.max(40,(this.cellW||120)*0.62)+'px');
  const w=$('sSpot'); let from={x:w.clientWidth/2,y:w.clientHeight/2}; sp.style.setProperty('--sx',from.x+'px'); sp.style.setProperty('--sy',from.y+'px'); sp.classList.add('on');
  const t0=performance.now(); const times=p.hops; let seg=0, lit=null; const win=$('sStageWin'); win.classList.remove('reelmask'); win.replaceChildren(this.dotsEl());
  const step=()=>{ if(!done()){ sp.classList.remove('on'); return; } const el=performance.now()-t0;
   while(seg<pts.length && el>=times[seg]){ if(lit) lit.classList.remove('lit'); lit=this.cells[pts[seg].t]; lit&&lit.classList.add('lit'); from=pts[seg].c; if(seg<pts.length-1) win.replaceChildren(this.nameEl(pts[seg].t,true)); seg++; }
   if(seg<pts.length){ const sT=seg?times[seg-1]:0, eT=times[seg]; let q=(el-sT)/Math.max(1,eT-sT); q=q<.5?4*q*q*q:1-Math.pow(-2*q+2,3)/2; const to=pts[seg].c; const prevC=seg?pts[seg-1].c:{x:w.clientWidth/2,y:w.clientHeight/2}; sp.style.setProperty('--sx',(prevC.x+(to.x-prevC.x)*q)+'px'); sp.style.setProperty('--sy',(prevC.y+(to.y-prevC.y)*q)+'px'); requestAnimationFrame(step); }
   else { sp.style.setProperty('--sx',from.x+'px'); sp.style.setProperty('--sy',from.y+'px'); this.finishName(p); setTimeout(()=>{ if(lit) lit.classList.remove('lit'); sp.classList.remove('on'); }, Math.max(150,p.dur*1000-el)); }
  };
  requestAnimationFrame(step);
 },
 a_shuffle(p,done){
  const t0=performance.now(); let k=0, litEls=[]; const win=$('sStageWin'); win.classList.remove('reelmask'); win.replaceChildren(this.dotsEl());
  const step=()=>{ if(!done()){ litEls.forEach(e=>e.classList.remove('lit')); return; } const el=performance.now()-t0;
   while(k<p.groups.length && el>=p.hops[k]){ litEls.forEach(e=>e.classList.remove('lit')); litEls=p.groups[k].map(t=>this.cells[t]).filter(Boolean); litEls.forEach(e=>e.classList.add('lit')); if(k<p.groups.length-1) win.replaceChildren(this.nameEl(p.groups[k][0],true)); k++; }
   if(k<p.groups.length) requestAnimationFrame(step); else { this.finishName(p); const keep=litEls; setTimeout(()=>keep.forEach(e=>e.classList.remove('lit')),Math.max(150,p.dur*1000-el)); }
  };
  requestAnimationFrame(step);
 },
 a_flip(p,done){
  const win=$('sStageWin'); win.classList.remove('reelmask'); const fl=document.createElement('div'); fl.className='flipper';
  const fr=document.createElement('div'); fr.className='face front'; fr.textContent='#'+p.cn; fr.style.fontSize=(win.clientHeight*0.55)+'px';
  const bk=document.createElement('div'); bk.className='face back'; bk.appendChild(this.nameEl(p.t)); fl.appendChild(fr); fl.appendChild(bk); win.replaceChildren(fl);
  const D=p.dur*1000; fr.animate([{transform:'scale(1)'},{transform:'scale(1.06)'},{transform:'scale(1)'}],{duration:D*0.4,iterations:1});
  fl.animate([{transform:'rotateX(0deg)'},{transform:'rotateX(180deg)'}],{duration:D*0.5,delay:D*0.38,easing:'cubic-bezier(.45,-0.25,.3,1.35)',fill:'forwards'});
 },
 a_zoom(p,done){
  const win=$('sStageWin'); win.classList.remove('reelmask'); win.replaceChildren(this.dotsEl()); const D=p.dur*1000;
  setTimeout(()=>{ if(!done()) return; const d=this.nameEl(p.t); win.replaceChildren(d); d.animate([{transform:'scale(3)',opacity:0,filter:'blur(18px)'},{transform:'scale(1)',opacity:1,filter:'blur(0)'}],{duration:D*0.5,easing:'cubic-bezier(.2,.9,.25,1)'});
   const ring=document.createElement('div'); ring.className='ring'; $('sStage').appendChild(ring); ring.animate([{transform:'scale(.3)',opacity:.9},{transform:'scale(2.2)',opacity:0}],{duration:900,delay:D*0.42,easing:'ease-out'}).onfinish=()=>ring.remove(); },D*0.32);
 },
 dotsEl(){ const d=document.createElement('div'); d.className='dots'; d.innerHTML='<i></i><i></i><i></i>'; return d; },
 finishName(p,bounce){ const win=$('sStageWin'); win.classList.remove('reelmask'); const d=this.nameEl(p.t); win.replaceChildren(d); if(bounce&&d.animate) d.animate([{transform:'translateY(-12%)'},{transform:'translateY(4%)',offset:.55},{transform:'none'}],{duration:420,easing:'ease-out'}); },
 clearLit(){ this.cells.forEach(c=>c&&c.classList.remove('lit')); $('sSpot').classList.remove('on'); },
 reveal(m){
  this.tok++; this.animating=false; this.clearLit(); this.stageCn=m.cn; $('sStage').classList.remove('spinning');
  const win=$('sStageWin'); win.classList.remove('reelmask'); const d=this.nameEl(m.t); win.replaceChildren(d);
  d.animate([{transform:'scale(1.08)'},{transform:'scale(1)'}],{duration:400,easing:'ease-out'});
  $('sStageLabel').textContent=(m.prize?'🏆 Call #':'Call #')+m.cn;
  const s=$('sStageSub'); s.className='s-stage-sub'+(m.prize?' win':''); s.textContent=m.prize?('Wins '+m.prize):'is out';
  $('sStage').classList.toggle('prize',!!m.prize);
  const c=this.cells[m.t]; if(c){ c.classList.remove('just'); void c.offsetWidth; c.classList.add('just'); setTimeout(()=>c.classList.remove('just'),1150); }
 },
 /* ----- overlays ----- */
 setOv(ov){
  const key=ov?ov.key:''; if(key===this.ovKey) return; this.ovKey=key;
  ['ovWinner','ovFinal','ovGrand'].forEach(id=>$(id).classList.remove('on'));
  if(!ov) return;
  if(ov.k==='winner'){ $('wKick').textContent=(ov.ru?('Runner-up · '+ov.dealName+' · Call #'):'Winner · Call #')+ov.cn; const no=$('wNo'); no.classList.toggle('hidden',!ov.no); no.textContent=ov.no?('Ticket '+ov.no):''; $('wName').textContent=ov.n; $('wName').dir='auto'; $('wPrize').textContent=ov.prize; $('wHint').textContent=ov.hint||''; $('ovWinner').classList.add('on'); }
  else if(ov.k==='final'){ $('fKick').textContent=ov.split?('Our final '+ov.N+' · '+ov.N+' tickets remain'):(ov.N+' tickets remain'); $('fTitle').textContent=ov.split?ov.dealName:('Our final '+ov.N); const fc=$('fCards'); fc.replaceChildren(); ov.names.forEach((x,i)=>{ const c=document.createElement('div'); c.className='f-card'; c.style.animationDelay=(i*0.12)+'s'; if(x.no){ const s=document.createElement('small'); s.textContent='Ticket '+x.no; c.appendChild(s);} const n=document.createElement('span'); n.dir='auto'; n.textContent=x.n; c.appendChild(n); fc.appendChild(c); }); $('fPrompt').textContent=ov.split?ov.prompt:'On to the grand prize!'; $('fSplit').classList.toggle('hidden',!ov.split);
   $('fDeal').classList.toggle('hidden',!ov.split); if(ov.split){ $('fDealRu').textContent=ov.runner+(ov.ru>1?' each':''); $('fDealRuT').textContent=ov.ru===1?'to the runner-up':('to the '+ov.ru+' runners-up'); $('fDealWin').textContent=ov.winner; $('fAll').textContent=ov.full; }
   $('fCont').innerHTML=ov.split?'Play for it all <span class="kbd">P</span>':'Continue <span class="kbd">C</span>'; $('fBtns').classList.toggle('hidden', IS_DISPLAY); $('ovFinal').classList.add('on'); }
  else if(ov.k==='grand'||ov.k==='split'){ $('gKick').textContent=ov.kick||(ov.k==='split'?'The finalists split the grand prize':'Grand prize winner'); $('gName').textContent=ov.n; $('gName').dir='auto'; $('gPrize').textContent=ov.prize; $('gSub').textContent=ov.sub||''; $('ovGrand').classList.add('on'); }
  this.fitOverlays();
 },
 fitOverlays(){ const vw=innerWidth, vh=innerHeight;
  const wn=$('wName'); if(wn.textContent) wn.style.fontSize=fitPx(wn.textContent,Math.min(vw*0.7,vh*1.3),vh*0.14,800)+'px';
  const gn=$('gName'); if(gn.textContent) gn.style.fontSize=fitPx(gn.textContent,vw*0.88,vh*(gn.textContent.length>40?0.12:0.22),900)+'px';
  document.querySelectorAll('#fCards .f-card').forEach(c=>{ const n=c.querySelector('span'); const cnt=c.parentNode.children.length; n.parentNode.style.fontSize=fitPx(n.textContent,Math.min(vw*0.4,vw*0.86/Math.min(cnt,3)),vh*0.06,800)+'px'; }); },
 fx(m){ if(m.kind==='winner'){ FX.burst(false); FX.rain(2200); }
  else if(m.kind==='grand'){ FX.burst(true); FX.rain(9000); FX.fireworks(12000); setTimeout(()=>FX.burst(true),1600); }
  else if(m.kind==='final'){ FX.rain(1500); }
  else if(m.kind==='stop'){ FX.stop(); } },
 countdown(n){ const ov=$('ovCd'); if(n<0){ ov.classList.remove('on'); this.cdOn=false; if(this.dy) $('ovWel').classList.toggle('on',!!this.dy.welcome); return; }
  this.cdOn=true; $('ovWel').classList.remove('on'); ov.classList.add('on'); const el=$('cdNum'); el.textContent=n>0?n:'Go!'; el.style.fontSize=n>0?'40vh':'26vh'; el.animate([{transform:'scale(1.6)',opacity:0},{transform:'scale(1)',opacity:1,offset:.25},{transform:'scale(.92)',opacity:1}],{duration:950,easing:'ease-out'});
  ov.querySelector('.cd-ring').animate([{transform:'scale(.7)',opacity:1},{transform:'scale(1.25)',opacity:0}],{duration:950,easing:'ease-out'}); }
};
function fmtS(v){ v=+v; return (v<10?v.toFixed(1):Math.round(v))+'s'; }

/* ===================== ENGINE (control window) ===================== */
let timer=0, winTimer=0, welTimer=0, busy=false, gen=0, lastCallStart=0, view='setup';
const displays=new Map();
function labelFull(t){ const tk=G.tickets[t]; if(!tk) return '?'; return tk.num?tk.n:(tk.n+' (#'+tk.no+')'); }
function log(type,text){ if(!G) return; G.audit.push({at:Date.now(),type,text}); }
function remIdx(){ const r=[]; for(let i=0;i<G.st.length;i++) if(G.st[i]===-1) r.push(i); return r; }
function remaining(){ let n=0; for(let i=0;i<G.st.length;i++) if(G.st[i]===-1) n++; return n; }
function finN(){ return Math.max(0,parseInt(S.finalists,10)||0); }
function inFinalStretch(){ return !!(G&&S.finalOn&&remaining()<=(parseInt(S.finalLast,10)||0)); }
function effSpeed(){ return clamp(+(inFinalStretch()?S.finalSpeed:S.speed)||4,0.05,120); }
function nextPrize(){ if(!G) return null; const c=G.calls.length, rem=remaining(); let best=null; for(const p of curList().prizes){ const k=parseInt(p.call,10); if(k>c && k-c<rem && (!best||k<best.k)) best={k,p}; } return best?{cn:best.k,text:prizeText(best.p),inCalls:best.k-c}:null; }
function newGame(){
  const T=draftTickets(); if(T.length<2){ toast('Add at least 2 tickets first','warn'); if(!IS_DISPLAY) accOpen('cardTickets',true); return false; }
  let order=T.map((_,i)=>i);
  if(S.gridOrder==='alpha') order.sort((a,b)=>T[a].n.localeCompare(T[b].n,undefined,{sensitivity:'base',numeric:true})||a-b);
  else if(S.gridOrder==='shuffle') shuffle(order);
  G={v:2,id:uid(),created:Date.now(),mode:S.mode,tickets:T,order,st:T.map(()=>-1),calls:[],ops:[],audit:[],rebuys:[],phase:'ready',handled:0,decision:null,finAt:null,finList:null,grand:null,resumeAfter:false,winIdx:null,finalView:0,welManual:null,cdDone:false,pending:null,pausedAt:Date.now(),listName:curList().name,sig:ticketSig(T)};
  log('start','New draw created with '+T.length+' tickets (prize list: '+curList().name+')');
  saveGame(); return true;
}
function ticketSig(T){ return T.length+':'+T.map(t=>t.no+'='+t.n).join('\u0001'); }
function grandPrizeNow(){ return (G&&G.decision==='deal'&&G.deal)?G.deal.winner:(S.grandPrize||'Grand Prize'); }
function gameDealName(){ return dealName(G&&G.finList?G.finList.length:finN()); }
function runnersUp(){ return G?G.calls.filter(c=>c.ru).map(c=>G.tickets[c.t].n):[]; }
function dispSettings(){ const k=['namePos','logoWhite','animation','theme','title','subtitle','logoPos','bgAnim','bgDim','bigBoard','stageShare','winnersPanel','showNumbers','sponsorPos','sponsorSize','tickOn','tickText','tickSize','tickSpeed','tickFg','tickBg','welTitle','welSub','grandPrize']; const D={}; k.forEach(x=>D[x]=S[x]); return D; }
function chipFor(){ const p=G.phase;
  if(p==='ready') return {cls:'',text:'Ready · press SPACE to start'};
  if(p==='running') return {cls:'live',text:'Live · every '+fmtS(effSpeed())};
  if(p==='paused') return {cls:'hold',text:'Paused'};
  if(p==='winner') return {cls:'hold',text:S.winPause==='space'?'Winner! · SPACE to continue':'Winner!'};
  if(p==='finalists') return {cls:'hold',text:S.splitOn?(gameDealName()+' · take the deal or play for it all?'):'Finalists · continue'};
  if(p==='done') return {cls:'',text:'Grand prize awarded'};
  if(p==='split') return {cls:'',text:'Grand prize split'};
  return {cls:'',text:p}; }
function welcomeOn(){ if(!G) return true; if(G.welManual!=null) return G.welManual; const p=G.phase;
  if(p==='ready') return !!S.welBefore;
  if(p==='paused') return !!(S.welPaused && Date.now()-(G.pausedAt||0)>=(S.welPausedSec||20)*1000);
  if((p==='done'||p==='split')) return !!(S.welAfter && G.finalView===2);
  return false; }
function buildDyn(){
  if(!G) return null; const T=G.tickets; const wins=[], wmap={};
  G.calls.forEach((c,k)=>{ if(c.p) wins.push({cn:k+1,n:T[c.t].n,no:T[c.t].no,prize:c.ru?(c.p+' · runner-up'):c.p}); });
  for(let i=0;i<G.st.length;i++){ const s=G.st[i]; if(s>=0&&G.calls[s]&&G.calls[s].p) wmap[i]=s+1; }
  const rem=remaining(); let ov=null; const ph=G.phase;
  const di=dealInfo((G.finList||[]).length||finN());
  if(ph==='winner'&&G.winIdx!=null&&G.calls[G.winIdx]){ const c=G.calls[G.winIdx], tk=T[c.t]; ov={k:'winner',key:'w'+G.id+G.winIdx,cn:G.winIdx+1,n:tk.n,no:(S.showNumbers&&!tk.num)?tk.no:'',prize:c.p,ru:!!c.ru,dealName:gameDealName(),hint:S.winPause==='space'?'Press SPACE to continue':''}; }
  else if(ph==='finalists'){ ov={k:'final',key:'f'+G.id+G.finAt,N:(G.finList||[]).length,names:(G.finList||[]).filter(t=>G.st[t]===-1).map(t=>({n:T[t].n,no:(S.showNumbers&&!T[t].num)?T[t].no:''})),prompt:S.splitPrompt||'Take the deal, or play for it all?',split:!!S.splitOn,dealName:di.name,ru:di.ru,runner:di.runner,winner:di.winner,full:di.full}; }
  else if(ph==='done'&&G.grand!=null&&G.finalView===0){ const dealt=G.decision==='deal'&&G.deal; const ru=runnersUp(); ov={k:'grand',key:'g'+G.id+G.grand,n:T[G.grand].n,prize:grandPrizeNow(),kick:dealt?('Last one standing · '+gameDealName()):'',sub:dealt?((ru.length?('Runners-up: '+ru.join(' & ')+' — '+G.deal.runner+' each · '):'')+'last ticket standing out of '+T.length):('Last ticket standing out of '+T.length)}; }
  else if(ph==='split'&&G.finalView===0){ const names=(G.finList||[]).filter(t=>G.st[t]===-1).map(t=>T[t].n); ov={k:'split',key:'s'+G.id+G.finAt,n:names.join('  ·  '),prize:S.grandPrize||'Grand Prize',sub:'Congratulations to our '+names.length+' finalists!'}; }
  const last=G.calls.length?(()=>{ const k=G.calls.length-1, c=G.calls[k]; return (G.pending===c.t)?(k>0?{cn:k,t:G.calls[k-1].t,prize:G.calls[k-1].p}:null):{cn:k+1,t:c.t,prize:c.p}; })():null;
  const finSet = (G.finAt!=null)?(G.finList||[]):[];
  return {phase:ph,called:G.calls.length-(G.pending!=null?1:0),rem:rem+(G.pending!=null?1:0),total:T.length,st:G.st,pending:G.pending,wmap,wins,fin:finSet,grand:G.grand,
   grandWon:G.grand!=null?T[G.grand].n:(ph==='split'?'the finalists (split)':null),finN:finN(),next:nextPrize(),ov,chip:chipFor(),last,lastCn:last?last.cn:0,
   welcome:welcomeOn(),speed:effSpeed(),finalStretch:inFinalStretch(),sound:!!S.sound,tts:!!S.tts,grandPrize:grandPrizeNow(),
   deal:{on:!!S.splitOn&&finN()>=2&&G.decision==null,decision:G.decision,name:di.name,ru:di.ru,runner:(G.deal&&G.deal.runner)||di.runner,winner:(G.deal&&G.deal.winner)||di.winner,full:di.full}};
}
function send(t,payload){ const m=Object.assign({t},payload||{}); if(view==='show') R.handle(m); if(displays.size) post(m); }
function push(){ send('dyn',{dy:buildDyn()}); updLive(); }
function sendFull(to){ const m={t:'full',D:dispSettings(),T:G?G.tickets:[],O:G?G.order:[],A,dy:buildDyn()}; if(to){ m.to=to; post(m); } else send('full',m); }
function setPhase(p){ if(!G) return; const was=G.phase; G.phase=p; if(p==='paused'&&was!=='paused'){ G.pausedAt=Date.now(); clearTimeout(welTimer); if(S.welPaused) welTimer=setTimeout(()=>{ if(G&&G.phase==='paused') push(); },(S.welPausedSec||20)*1000+60); } saveGame(); push(); }
function scheduleNext(ms){ clearTimeout(timer); timer=setTimeout(()=>{ if(G&&G.phase==='running'&&!busy) doCall(); },ms); }

function makePlan(t,cn,prize,rem){
  let a=S.animation; if(a==='mix') a=ANIM_IDS[randInt(ANIM_IDS.length)];
  const sp=effSpeed(); let dur=clamp(sp*0.68,0.05,4.5);
  if(prize&&S.suspense&&sp>=1.2) dur=Math.max(dur,3.6);
  if(S.bigBoard) dur=Math.min(dur,0.5);
  const others=rem.filter(x=>x!==t); const pick=()=>others.length?others[randInt(others.length)]:t;
  const plan={t,cn,prize,anim:a,dur,decoys:[],hops:[],groups:[]}; const D=dur*1000; let ticks=[];
  if(S.bigBoard||dur<0.3){ plan.anim='quick'; }
  else if(a==='slot'){ const n=clamp(Math.round(dur*13),6,50); for(let i=0;i<n;i++) plan.decoys.push(pick()); for(let k=1;k<=n;k++) ticks.push((1-Math.pow(1-k/n,1/3.2))*D); }
  else if(a==='spotlight'){ const n=clamp(Math.round(dur*2.4),2,9); for(let i=0;i<n;i++) plan.decoys.push(pick()); const w=[]; for(let i=0;i<=n;i++) w.push(1+i*0.45); const tot=w.reduce((x,y)=>x+y,0); let acc=0; for(let i=0;i<=n;i++){ acc+=w[i]/tot*D*0.84; plan.hops.push(acc); } ticks=plan.hops.slice(); }
  else if(a==='shuffle'){ const n=clamp(Math.round(dur*8),4,26); const iv=[]; for(let i=0;i<n;i++) iv.push(Math.pow(1.13,i)); const tot=iv.reduce((x,y)=>x+y,0); let acc=0; for(let i=0;i<n;i++){ acc+=iv[i]/tot*D*0.86; plan.hops.push(acc); const g=[]; if(i<n-1){ const m=1+randInt(3); for(let j=0;j<m;j++) g.push(pick()); } else g.push(t); plan.groups.push(g); } ticks=plan.hops.slice(); }
  else if(a==='flip'){ ticks=[D*0.38,D*0.62]; }
  else if(a==='zoom'){ ticks=[D*0.32]; }
  plan.ticks=ticks; return plan;
}
async function countdown(n){ for(let k=n;k>=1;k--){ send('cd',{n:k}); Snd.beep(false); await sleep(1000); } send('cd',{n:0}); Snd.beep(true); await sleep(650); send('cd',{n:-1}); }
async function doCall(){
  if(!G||busy) return; if(!['running','paused','ready'].includes(G.phase)) return;
  let rem=remIdx(); if(rem.length<=1){ continueFlow(null); return; }
  busy=true; clearTimeout(timer); G.welManual=null; const my=gen; const t0=performance.now(); lastCallStart=t0;
  const cn=G.calls.length+1; const pz=prizeAt(cn); let ptxt=pz?prizeText(pz):null;
  const dealNow=G.decision==='deal'&&!!G.deal; // Final Three Deal taken: every finalist called out is a paid runner-up
  if((ptxt||dealNow)&&S.cdPrize&&(+S.countdown>0)){ await countdown(+S.countdown); if(my!==gen||!G){ busy=false; return; } rem=remIdx(); }
  const t=rem[randInt(rem.length)];
  const ru=dealNow&&(G.finList||[]).includes(t); if(ru) ptxt=ptxt?(ptxt+' + '+G.deal.runner):G.deal.runner;
  G.calls.push(ru?{t,p:ptxt,at:Date.now(),ru:true}:{t,p:ptxt,at:Date.now()}); G.st[t]=G.calls.length-1; G.ops.push({k:'call'}); G.pending=t;
  log(ru?'runner-up':(ptxt?'winner':'call'),'Call #'+cn+': '+labelFull(t)+(ru?' — out, RUNNER-UP ('+gameDealName()+') gets '+ptxt:(ptxt?' — WINS '+ptxt:' — out')));
  saveGame();
  const plan=makePlan(t,cn,ptxt,rem);
  send('anim',{plan}); push();
  if(plan.anim==='slot') Snd.clunk();
  if(plan.anim!=='quick'){ if(ptxt&&S.suspense&&plan.dur>=1) Snd.drumroll(plan.dur); else if(effSpeed()>=0.8) Snd.ticksAt(plan.ticks); }
  await sleep(plan.dur*1000);
  if(my!==gen||!G){ busy=false; return; }
  G.pending=null; saveGame();
  const tk=G.tickets[t];
  send('reveal',{t,cn,prize:ptxt});
  if(!ptxt){ if(effSpeed()>=0.6) Snd.out(); if(!S.ttsOnlyWinners) TTS.say(tk.n+' is out'); }
  else if(ru) TTS.say(tk.n+' is out, and wins '+ptxt+' as a runner-up!');
  else TTS.say(tk.n+'. Wins '+ptxt+'!');
  busy=false;
  afterReveal(G.calls.length-1,false,t0);
}
function afterReveal(idx,restored,t0){
  G.handled=idx+1; const c=G.calls[idx];
  if(c&&c.p){ G.resumeAfter=!restored&&G.phase==='running'; G.winIdx=idx; setPhase('winner');
    if(!restored){ send('fx',{kind:'winner'}); Snd.fanfare(false); if(S.winPause==='timed'){ clearTimeout(winTimer); winTimer=setTimeout(()=>dismissWinner(false),Math.max(0.2,+S.winSec||5)*1000); } }
    return; }
  saveGame(); push(); continueFlow(t0);
}
function offerFinal(){ const N=finN(), rem=remaining(); return N>=2 && G.finAt==null && G.decision==null && rem<=N && rem>=2; }
function continueFlow(t0){
  if(!G) return true; const rem=remaining();
  if(rem<=1){ if(G.grand==null) declareGrand(); return true; }
  if(offerFinal()){ G.finAt=G.calls.length; G.finList=remIdx(); log('finalists','Finalists ('+G.finList.length+'): '+G.finList.map(labelFull).join('; ')); setPhase('finalists'); send('fx',{kind:'final'}); Snd.chime(); TTS.say('We have our final '+G.finList.length+'!'+(S.splitOn?' Will they take the deal, or play for it all?':''),true); return true; }
  if(G.phase==='running'){ const iv=effSpeed()*1000; scheduleNext(t0?Math.max(80,iv-(performance.now()-t0)):Math.min(1200,iv)); }
  return false;
}
function dismissWinner(viaKey){ clearTimeout(winTimer); if(!G||G.phase!=='winner') return; const resume=viaKey||G.resumeAfter; G.phase=resume?'running':'paused'; if(!resume) G.pausedAt=Date.now(); log('continue','Winner screen closed'+(resume?', draw continues':'')); saveGame(); push(); continueFlow(null); }
function declareGrand(){ const r=remIdx(); if(r.length!==1) return; G.grand=r[0]; G.finalView=0; const dealt=G.decision==='deal'&&G.deal;
  log('grand',(dealt?'LAST ONE STANDING ('+gameDealName()+'): ':'GRAND PRIZE: ')+labelFull(G.grand)+' wins '+grandPrizeNow()); setPhase('done'); send('fx',{kind:'grand'}); Snd.fanfare(true);
  setTimeout(()=>TTS.say(dealt?('And the last one standing is… '+G.tickets[G.grand].n+'! Winning '+grandPrizeNow()+'!'):('And the grand prize winner is… '+G.tickets[G.grand].n+'!'),true),400); }
// Final Three Deal: "deal" = the N-1 runners-up each get the runner-up amount and the game plays on to the last one standing (deal winner amount); "continue" = play for it all (grand prize)
function decide(kind){ if(!G||G.phase!=='finalists') return;
  if(kind==='deal'||kind==='split'){ if(!S.splitOn) return; const di=dealInfo((G.finList||[]).length); G.decision='deal'; G.deal={runner:di.runner,winner:di.winner,ru:di.ru}; G.ops.push({k:'deal'});
    log('deal',di.name+' taken: '+di.ruText+', last one standing gets '+di.winner+' (instead of '+di.full+'). Finalists: '+(G.finList||[]).filter(t=>G.st[t]===-1).map(labelFull).join('; '));
    setPhase('running'); send('fx',{kind:'winner'}); Snd.fanfare(false); TTS.say('They take the deal! '+di.ruText+', and the last one standing gets '+di.winner+'.',true); scheduleNext(3200); }
  else { G.decision='continue'; G.ops.push({k:'continue'}); log('continue',S.splitOn?('Finalists play for it all ('+(S.grandPrize||'Grand Prize')+')'):'Finalists continue to one winner'); setPhase('running'); if(S.splitOn) TTS.say('They play for it all!',true); scheduleNext(S.splitOn?2200:1400); }
}
async function play(){
  if(!G) return; if(['done','split','winner','finalists'].includes(G.phase)) return;
  if(busy){ if(G.phase!=='running'){ setPhase('running'); } return; }
  const first=G.calls.length===0&&!G.cdDone; G.welManual=null;
  log(G.calls.length?'resume':'start-draw',G.calls.length?'Draw resumed':'Draw started');
  setPhase('running');
  if(continueFlow(null)) return;
  if(first&&(+S.countdown>0)){ G.cdDone=true; busy=true; const my=gen; await countdown(+S.countdown); busy=false; if(my!==gen||!G||G.phase!=='running') return; doCall(); return; }
  G.cdDone=true; scheduleNext(first?250:450);
}
function pause(){ if(!G||G.phase!=='running') return; clearTimeout(timer); log('pause','Draw paused'); setPhase('paused'); }
function cmdToggle(){ if(!G){ return; } Snd.init();
  switch(G.phase){ case 'winner': dismissWinner(true); break; case 'finalists': toast(S.splitOn?'Choose “Take the deal” (D) or “Play for it all” (P)':'Press Continue (C) on the finalists screen'); break;
   case 'done': case 'split': G.finalView=(G.finalView+1)%(S.welAfter?3:2); saveGame(); push(); break;
   case 'running': pause(); break; default: play(); } }
function cmdNext(){ if(!G||busy) return; if(!['ready','paused','running'].includes(G.phase)){ if(G.phase==='winner') dismissWinner(true); return; } if(G.phase==='ready'){ G.cdDone=true; setPhase('paused'); } clearTimeout(timer); doCall(); }
function stopTimers(){ clearTimeout(timer); clearTimeout(winTimer); }
function undo(){
  if(!G) return; if(busy){ toast('Wait for the current call to finish'); return; }
  const op=G.ops[G.ops.length-1]; if(!op){ toast('Nothing to undo'); return; }
  stopTimers(); G.ops.pop(); let msg='';
  if(op.k==='call'){ const c=G.calls.pop(); const cn=G.calls.length+1; G.st[c.t]=-1; G.handled=Math.min(G.handled,G.calls.length); G.grand=null; G.winIdx=null; G.finalView=0;
    if(G.finAt!=null&&G.calls.length<G.finAt){ G.finAt=null; G.finList=null; G.decision=null; }
    msg='Undid call #'+cn+' — '+G.tickets[c.t].n+' is back in'; G.phase=G.calls.length?'paused':'ready'; }
  else if(op.k==='rebuy'||op.k==='remove'){ G.st[op.t]=op.prev; G.rebuys.pop(); msg='Undid '+(op.k==='rebuy'?'re-buy':'removal')+' of '+G.tickets[op.t].n; G.phase=G.calls.length?'paused':'ready'; }
  else if(op.k==='split'||op.k==='continue'||op.k==='deal'){ G.decision=null; G.deal=null; G.phase='finalists'; msg='Back to the '+gameDealName()+' decision'; }
  if(G.phase==='paused') G.pausedAt=Date.now();
  log('undo',msg); saveGame(); send('fx',{kind:'stop'}); push(); toast(msg);
}
function canEditEntries(){ if(!G) return 'Start a game first'; if(busy) return 'Wait for the current call to finish'; if(G.phase==='running'){ pause(); } if(!['paused','ready'].includes(G.phase)) return 'Close the winner / finalists screen first (or undo)'; return ''; }
function rebuy(t){ const why=canEditEntries(); if(why) return toast(why,'warn'); const prev=G.st[t]; if(prev===-1) return; G.st[t]=-1; G.ops.push({k:'rebuy',t,prev}); G.rebuys.push({at:Date.now(),t,kind:prev===-2?'restore':'rebuy',afterCall:G.calls.length,was:prev}); log('rebuy',(prev===-2?'Restored: ':'Re-buy: ')+labelFull(t)+' is back in'+(prev>=0?' (was out at call #'+(prev+1)+')':'')); saveGame(); push(); Snd.back(); renderRebuy(); }
function removeT(t){ const why=canEditEntries(); if(why) return toast(why,'warn'); if(G.st[t]!==-1) return; if(remaining()<=2) return toast('At least 2 tickets must stay in','warn'); G.st[t]=-2; G.ops.push({k:'remove',t,prev:-1}); G.rebuys.push({at:Date.now(),t,kind:'remove',afterCall:G.calls.length}); log('remove','Removed by hand: '+labelFull(t)); saveGame(); push(); renderRebuy(); }
function resetGame(){ gen++; stopTimers(); busy=false; G=null; saveGame(); send('fx',{kind:'stop'}); send('cd',{n:-1}); if(view==='show') goSetup(); sendFull(); updLive(); renderNamesLock(); toast('Game reset'); }
// restart the current draw from the beginning with the same tickets, prizes and settings
async function askRestart(confirmed){ if(!G){ toast('No game yet — press “Open show screen” to start one'); return; }
  if(!confirmed&&G.calls.length){ const done=['done','split'].includes(G.phase);
    if(!(await ask('Restart the game?','Starts the draw over from call #1 with the same tickets, prizes and settings. The '+G.calls.length+' call'+(G.calls.length===1?'':'s')+(done?' and results':', winners and audit log')+' of this draw will be cleared.',{ok:'↻ Restart game',danger:true}))) return; }
  restartGame(); }
function restartGame(){ const prevCalls=G?G.calls.length:0; gen++; stopTimers(); clearTimeout(welTimer); busy=false; try{ if('speechSynthesis' in window) speechSynthesis.cancel(); }catch(e){}
  G=null; const ok=newGame(); if(ok) log('restart','Game restarted with the same settings'+(prevCalls?' (previous draw had '+prevCalls+' calls)':''));
  saveGame(); send('fx',{kind:'stop'}); send('cd',{n:-1}); sendFull(); updLive(); renderNamesLock(); closeModal();
  if(ok) toast('Game restarted — same tickets, prizes and settings'); }
function setSpeed(v,quiet){ v=Math.round(clamp(+v||4,0.05,120)*100)/100; if(inFinalStretch()) S.finalSpeed=v; else S.speed=v; saveSettings(); syncSpeedUI();
  if(G&&G.phase==='running'&&!busy&&timer){ const iv=v*1000; scheduleNext(Math.max(80,iv-(performance.now()-lastCallStart))); }
  clearTimeout(setSpeed._l); setSpeed._l=setTimeout(()=>{ if(G) { log('speed','Speed set to '+fmtS(v)+(inFinalStretch()?' (final stretch)':'')); saveGame(); } },1200);
  if(!quiet) toast((inFinalStretch()?'Final stretch: ':'Speed: ')+fmtS(v)+' per call'); push(); }
function speedStep(dir){ const cur=effSpeed(); const v=dir>0?cur/1.25:cur*1.25; setSpeed(clamp(v,0.3,10)); }
function toggleWelcome(){ if(!G) return; G.welManual=!welcomeOn(); log('welcome','Welcome screen '+(G.welManual?'shown':'hidden')); saveGame(); push(); }
function runCmd(c,arg){
  Snd.init();
  switch(c){
   case 'toggle': cmdToggle(); break; case 'next': cmdNext(); break;
   case 'undo': askUndo(); break; case 'rebuy': openRebuy(); break; case 'report': openReport(); break;
   case 'split': case 'deal': decide('deal'); break; case 'continue': decide('continue'); break;
   case 'restart': askRestart(arg==='yes'); break;
   case 'faster': speedStep(1); break; case 'slower': speedStep(-1); break; case 'speed': setSpeed(arg,true); break;
   case 'sound': S.sound=!S.sound; saveSettings(); syncForm(); toast('Sound '+(S.sound?'on':'off')); push(); break;
   case 'voice': S.tts=!S.tts; saveSettings(); syncForm(); toast('Voice '+(S.tts?'on':'off')); push(); break;
   case 'welcome': toggleWelcome(); break;
   case 'setup': goSetup(); break;
  }
}
function ctrlMsg(m){
  if(m.t==='hello'||m.t==='ping'){ const known=displays.has(m.did); displays.set(m.did,Date.now()); if(!known||m.t==='hello') sendFull(m.did); updDisplayPill(); }
  else if(m.t==='bye'){ displays.delete(m.did); updDisplayPill(); }
  else if(m.t==='cmd'){ runCmd(m.c,m.arg); }
}
setInterval(()=>{ if(IS_DISPLAY) return; const now=Date.now(); let ch=false; for(const [k,v] of displays) if(now-v>7000){ displays.delete(k); ch=true; } if(ch) updDisplayPill(); },2000);

/* ===================== UI helpers ===================== */
function toast(msg,kind){ const box=$('toasts'); if(!box) return; const d=document.createElement('div'); d.className='toast'+(kind?' '+kind:''); d.textContent=msg; box.appendChild(d); while(box.children.length>3) box.firstChild.remove(); setTimeout(()=>{ d.style.transition='opacity .4s'; d.style.opacity='0'; setTimeout(()=>d.remove(),400); },2600); }
let modalOpen=null;
function modal(html,opts){ closeModal(); const m=document.createElement('div'); m.className='modal'; m.innerHTML='<div class="box'+(opts&&opts.big?' big':'')+'">'+html+'</div>'; document.body.appendChild(m); modalOpen=m; m.addEventListener('mousedown',e=>{ if(e.target===m&&!(opts&&opts.sticky)) closeModal(); }); return m; }
function closeModal(){ if(modalOpen){ modalOpen.remove(); modalOpen=null; } }
function ask(title,text,o){ o=o||{}; return new Promise(res=>{ const m=modal('<h3></h3><p></p>'+(o.input!=null?'<input type="text" class="ain" style="width:100%">':'')+'<div class="acts"><button class="btn ghost" data-a="0">Cancel</button><button class="btn '+(o.danger?'danger':'primary')+'" data-a="1"></button></div>');
  m.querySelector('h3').textContent=title; m.querySelector('p').textContent=text||''; m.querySelector('[data-a="1"]').textContent=o.ok||'OK';
  const inp=m.querySelector('.ain'); if(inp){ inp.value=o.input; setTimeout(()=>{inp.focus();inp.select();},30); }
  else setTimeout(()=>m.querySelector('[data-a="1"]').focus(),30);
  const fin=v=>{ closeModal(); res(v); };
  m.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>fin(b.dataset.a==='1'?(inp?inp.value:true):null));
  m.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); fin(inp?inp.value:true);} else if(e.key==='Escape'){ fin(null);} e.stopPropagation(); }); }); }
async function askUndo(){ if(!G||!G.ops.length) return toast('Nothing to undo'); const op=G.ops[G.ops.length-1]; let d='';
  if(op.k==='call'){ const c=G.calls[G.calls.length-1]; d='Call #'+G.calls.length+' ('+G.tickets[c.t].n+(c.p?', winner of '+c.p:'')+') will be taken back and the ticket returns to the board.'; }
  else if(op.k==='rebuy') d='The re-buy of '+G.tickets[op.t].n+' will be reversed.'; else if(op.k==='remove') d=G.tickets[op.t].n+' will be put back in.'; else d='Go back to the '+gameDealName()+' decision (take the deal / play for it all).';
  if(await ask('Undo last action?',d,{ok:'Undo'})) undo(); }
function download(name,text,type){ const b=new Blob([text],{type:type||'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500); }
function csv(rows){ return '\ufeff'+rows.map(r=>r.map(v=>{ v=v==null?'':String(v); return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }).join(',')).join('\r\n'); }
function ts(ms){ const d=new Date(ms); return d.toLocaleDateString()+' '+d.toLocaleTimeString(); }
function tsT(ms){ return new Date(ms).toLocaleTimeString(); }
function dstamp(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function resultsRows(){ const T=G.tickets; const rows=[['Call #','Time','Ticket #','Name','Result','Prize']];
  G.calls.forEach((c,k)=>rows.push([k+1,ts(c.at),T[c.t].no,T[c.t].n,c.p?(c.ru?'Runner-up ('+gameDealName()+')':'Prize winner'):'Out',c.p||'']));
  if(G.grand!=null) rows.push(['',G.audit.length?ts(G.audit.filter(a=>a.type==='grand').pop()?.at||Date.now()):'',T[G.grand].no,T[G.grand].n,G.decision==='deal'?'LAST ONE STANDING ('+gameDealName()+')':'GRAND PRIZE WINNER',grandPrizeNow()]);
  else if(G.phase==='split') (G.finList||[]).filter(t=>G.st[t]===-1).forEach(t=>rows.push(['','',T[t].no,T[t].n,'Finalist — split the grand prize',S.grandPrize]));
  else remIdx().forEach(t=>rows.push(['','',T[t].no,T[t].n,'Still in','']));
  G.st.forEach((s,t)=>{ if(s===-2) rows.push(['','',T[t].no,T[t].n,'Removed by hand','']); });
  return rows; }
function exportResults(){ if(!G) return toast('No game to export'); download('reverse-raffle-results-'+dstamp()+'.csv',csv(resultsRows())); }
function exportAudit(){ if(!G) return toast('No game to export'); const rows=[['Time','Action','Details']]; G.audit.forEach(a=>rows.push([ts(a.at),a.type,a.text])); download('reverse-raffle-audit-'+dstamp()+'.csv',csv(rows)); }
function openReport(){
  if(!G) return toast('No game yet'); const T=G.tickets; const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const wins=G.calls.map((c,k)=>({c,k})).filter(o=>o.c.p);
  let result='Draw in progress — '+remaining()+' tickets remain.';
  if(G.grand!=null){ if(G.decision==='deal'&&G.deal){ const ru=G.calls.filter(c=>c.ru); result='Last one standing — '+esc(gameDealName())+' ('+esc(G.deal.winner)+'): <b>'+esc(T[G.grand].n)+'</b> (ticket '+esc(T[G.grand].no)+')'+(ru.length?'<br>Runners-up ('+esc(G.deal.runner)+' each): <b>'+ru.map(c=>esc(T[c.t].n)+' (ticket '+esc(T[c.t].no)+')').join(', ')+'</b>':''); }
    else result='Grand prize ('+esc(S.grandPrize)+'): <b>'+esc(T[G.grand].n)+'</b> (ticket '+esc(T[G.grand].no)+')'+(G.decision==='continue'&&S.splitOn?' — the finalists played for it all':''); }
  else if(G.phase==='split') result='The finalists split the grand prize ('+esc(S.grandPrize)+'): <b>'+(G.finList||[]).filter(t=>G.st[t]===-1).map(t=>esc(T[t].n)).join(', ')+'</b>';
  const h=[];
  h.push('<div class="rtools"><button class="btn" id="rpPrint">🖨 Print</button><button class="btn" id="rpCsv">Results CSV</button><button class="btn" id="rpAudit">Audit CSV</button><button class="btn" id="rpClose">Close</button></div>');
  h.push('<h1>'+esc(S.title||'Reverse Raffle')+' — Draw report</h1><p class="meta">'+esc(S.subtitle||'')+' Created '+ts(G.created)+' · Printed '+ts(Date.now())+' · '+T.length+' tickets · '+G.calls.length+' calls · prize list “'+esc(G.listName||curList().name)+'” · random draw by crypto.getRandomValues</p>');
  h.push('<h2>Result</h2><p>'+result+'</p>');
  if(G.finList) h.push('<p>Finalists ('+G.finList.length+'): '+G.finList.map(t=>esc(T[t].n)).join(', ')+(G.decision?' — <b>'+esc({deal:'took the '+gameDealName(),continue:S.splitOn?'played for it all':'continued',split:'split the grand prize'}[G.decision]||G.decision)+'</b>':'')+'</p>');
  h.push('<h2>Prize winners</h2><table><tr><th>Call #</th><th>Time</th><th>Ticket</th><th>Name</th><th>Prize</th></tr>'+(wins.map(o=>'<tr><td>'+(o.k+1)+'</td><td>'+tsT(o.c.at)+'</td><td>'+esc(T[o.c.t].no)+'</td><td dir="auto">'+esc(T[o.c.t].n)+'</td><td>'+esc(o.c.p)+(o.c.ru?' — '+esc(gameDealName())+' runner-up':'')+'</td></tr>').join('')||'<tr><td colspan="5">None yet</td></tr>')+'</table>');
  h.push('<h2>Re-buys &amp; removals</h2><table><tr><th>Time</th><th>Action</th><th>Ticket</th><th>Name</th><th>After call #</th></tr>'+((G.rebuys||[]).map(r=>'<tr><td>'+tsT(r.at)+'</td><td>'+({rebuy:'Re-buy',restore:'Restored',remove:'Removed by hand'}[r.kind])+'</td><td>'+esc(T[r.t].no)+'</td><td dir="auto">'+esc(T[r.t].n)+'</td><td>'+r.afterCall+'</td></tr>').join('')||'<tr><td colspan="5">None</td></tr>')+'</table>');
  h.push('<h2>All calls in order</h2><table><tr><th>Call #</th><th>Time</th><th>Ticket</th><th>Name</th><th>Result</th></tr>'+G.calls.map((c,k)=>'<tr'+(c.p?' class="w"':'')+'><td>'+(k+1)+'</td><td>'+tsT(c.at)+'</td><td>'+esc(T[c.t].no)+'</td><td dir="auto">'+esc(T[c.t].n)+'</td><td>'+(c.p?'WINS '+esc(c.p):'Out')+'</td></tr>').join('')+'</table>');
  h.push('<h2>Audit log</h2><table><tr><th>Time</th><th>Action</th><th>Details</th></tr>'+G.audit.map(a=>'<tr><td>'+tsT(a.at)+'</td><td>'+esc(a.type)+'</td><td dir="auto">'+esc(a.text)+'</td></tr>').join('')+'</table>');
  let r=$('report'); if(!r){ r=document.createElement('div'); r.id='report'; document.body.appendChild(r); }
  r.innerHTML=h.join(''); r.classList.remove('hidden');
  $('rpPrint').onclick=()=>window.print(); $('rpClose').onclick=()=>r.remove(); $('rpCsv').onclick=exportResults; $('rpAudit').onclick=exportAudit;
}
/* ----- re-buy modal ----- */
let rbQuery='';
function openRebuy(){ const why=canEditEntries(); if(why) return toast(why,'warn');
  modal('<h3>Re-buy / remove entries</h3><p>Bring an eliminated ticket back into the draw, or take a ticket out by hand. Every change is logged and can be undone.</p><input type="search" id="rbQ" placeholder="Search name or ticket #" style="width:100%;margin-bottom:12px"><div class="rb-cols"><div><h3 style="font-size:.85rem">Eliminated — bring back</h3><div class="rb-list" id="rbOut"></div></div><div><h3 style="font-size:.85rem">In play — remove</h3><div class="rb-list" id="rbIn"></div></div></div><div class="acts"><button class="btn primary" id="rbDone">Done</button></div>',{big:true});
  $('rbQ').value=rbQuery; $('rbQ').oninput=e=>{ rbQuery=e.target.value; renderRebuy(); }; $('rbDone').onclick=closeModal; setTimeout(()=>$('rbQ').focus(),30); renderRebuy(); }
function renderRebuy(){ const o=$('rbOut'), i=$('rbIn'); if(!o||!G) return; const q=rbQuery.trim().toLowerCase(); const T=G.tickets; const match=t=>!q||T[t].n.toLowerCase().includes(q)||String(T[t].no).toLowerCase().includes(q);
  const outs=[]; const ins=[]; G.st.forEach((s,t)=>{ if(!match(t)) return; if(s===-1) ins.push(t); else outs.push(t); });
  outs.sort((a,b)=>(G.st[b]===-2?1e9:G.st[b])-(G.st[a]===-2?1e9:G.st[a]));
  const item=(t,btn,cls,sub)=>{ const d=document.createElement('div'); d.className='rb-item'; const s=document.createElement('span'); s.dir='auto'; s.textContent=T[t].n+' '; const sm=document.createElement('small'); sm.textContent=sub; s.appendChild(sm); const b=document.createElement('button'); b.className='btn sm '+cls; b.textContent=btn; b.onclick=()=>btn==='Remove'?removeT(t):rebuy(t); d.appendChild(s); d.appendChild(b); return d; };
  const nn=t=>T[t].num?'':('#'+T[t].no+' · ');
  o.replaceChildren(...outs.slice(0,300).map(t=>item(t,G.st[t]===-2?'Restore':'Re-buy','primary',G.st[t]===-2?(nn(t)+'removed by hand'):(nn(t)+'out at call '+(G.st[t]+1)))));
  i.replaceChildren(...ins.slice(0,300).map(t=>item(t,'Remove','danger',T[t].num?'':'#'+T[t].no)));
  if(!outs.length) o.innerHTML='<div class="hint" style="padding:8px">No eliminated tickets'+(q?' match':'')+'</div>'; }

/* ===================== SETUP FORM ===================== */
function fillVoices(){ const sel=$('ttsVoice'); if(!sel) return; const cur=S.ttsVoice; sel.innerHTML='<option value="">Default voice</option>'; (TTS.voices||[]).forEach(v=>{ const o=document.createElement('option'); o.value=v.voiceURI; o.textContent=v.name+' ('+v.lang+')'; sel.appendChild(o); }); sel.value=cur; }
const BINDS=[ // id, key, kind
 ['grandPrize','grandPrize','text'],['finalists','finalists','int'],['splitOn','splitOn','bool'],['splitPrompt','splitPrompt','text'],['dealRunner','dealRunner','text'],['dealWinner','dealWinner','text'],['logoWhite','logoWhite','bool'],
 ['finalOn','finalOn','bool'],['finalLast','finalLast','int'],['finalSpeed','finalSpeed','num'],['winSec','winSec','num'],['suspense','suspense','bool'],
 ['countdown','countdown','int'],['cdPrize','cdPrize','bool'],['title','title','text'],['subtitle','subtitle','text'],['bgAnim','bgAnim','bool'],['bgDim','bgDim','num'],
 ['logoPos','logoPos','sel'],['bigBoard','bigBoard','bool'],['stageShare','stageShare','num'],['winnersPanel','winnersPanel','sel'],['gridOrder','gridOrder','sel'],['showNumbers','showNumbers','bool'],
 ['welTitle','welTitle','text'],['welSub','welSub','text'],['welBefore','welBefore','bool'],['welPaused','welPaused','bool'],['welPausedSec','welPausedSec','int'],['welAfter','welAfter','bool'],
 ['sponsorPos','sponsorPos','sel'],['sponsorSize','sponsorSize','sel'],['tickOn','tickOn','bool'],['tickText','tickText','text'],['tickSize','tickSize','num'],['tickSpeed','tickSpeed','sel'],['tickFg','tickFg','text'],['tickBg','tickBg','text'],
 ['soundOn','sound','bool'],['volume','volume','num'],['ttsOn','tts','bool'],['ttsVoice','ttsVoice','sel'],['ttsRate','ttsRate','num'],['ttsOnlyWinners','ttsOnlyWinners','bool']
];
let _dispT=0;
function settingsChanged(){ saveSettings(); clearTimeout(_dispT); _dispT=setTimeout(()=>{ send('disp',{D:dispSettings()}); push(); },80); renderPrizeSummary(); renderDealPreview(); accSoon(); }
function renderDealPreview(){ const el=$('dealPreview'); if(!el) return; const N=finN(); const di=dealInfo(N); $('dealNameL').textContent=di.name; $('dealRow').classList.toggle('dim-off',!S.splitOn);
  el.textContent=N<2?'Set “Finalists” to 2 or more to offer the deal.':(S.splitOn?('On screen at the final '+N+': “Take the deal: '+di.ruText+', last one standing gets '+di.winner+'” or “Play for it all: '+di.full+'”.'):('Deal is off — the final '+N+' play on for '+di.full+'.')); }
function syncForm(){ for(const [id,key,kind] of BINDS){ const el=$(id); if(!el) continue; if(kind==='bool') el.checked=!!S[key]; else if(document.activeElement!==el) el.value=S[key]==null?'':S[key]; }
  $('winSecWrap').style.visibility=S.winPause==='timed'?'visible':'hidden';
  document.querySelectorAll('#winPauseSeg button').forEach(b=>b.classList.toggle('on',b.dataset.v===S.winPause));
  document.querySelectorAll('#namePosSeg button').forEach(b=>b.classList.toggle('on',b.dataset.v===S.namePos)); renderDealPreview();
  document.querySelectorAll('#modeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.mode===S.mode));
  $('namesPane').classList.toggle('hidden',S.mode!=='names'); $('numbersPane').classList.toggle('hidden',S.mode!=='numbers'); $('showNoWrap').classList.toggle('hidden',S.mode!=='names');
  document.querySelectorAll('#anims .anim').forEach(a=>a.classList.toggle('on',a.dataset.id===S.animation));
  document.querySelectorAll('#themes .theme').forEach(a=>a.classList.toggle('on',a.dataset.id===S.theme));
  document.body.dataset.theme=S.theme; syncSpeedUI(); renderThumbs(); }
function syncSpeedUI(){ const v=effSpeed? (G?effSpeed():S.speed):S.speed; [['speedR',S.speed],['speedN',S.speed],['lbSpeed',v]].forEach(([id,val])=>{ const el=$(id); if(el&&document.activeElement!==el) el.value=val; }); $('lbSpeedV').textContent=fmtS(v); const ds=$('dSpeed'); if(ds&&document.activeElement!==ds) ds.value=v; const dv=$('dSpeedV'); if(dv) dv.textContent=fmtS(v); if(S.finalOn&&document.activeElement!==$('finalSpeed')) $('finalSpeed').value=S.finalSpeed; }
function bindForm(){
  for(const [id,key,kind] of BINDS){ const el=$(id); if(!el) continue; const ev=(kind==='bool'||kind==='sel')?'change':'input';
    el.addEventListener(ev,()=>{ let v; if(kind==='bool') v=el.checked; else if(kind==='int'){ v=parseInt(el.value,10); if(!isFinite(v)) return; } else if(kind==='num'){ v=parseFloat(el.value); if(!isFinite(v)) return; } else v=el.value; S[key]=v; if(key==='theme') document.body.dataset.theme=v; if(key==='sound'&&v) Snd.init(); settingsChanged(); if(['showNumbers','gridOrder'].includes(key)) renderNamesLock(); }); }
  $('speedR').addEventListener('input',e=>{ S.speed=+e.target.value; syncSpeedUI(); settingsChanged(); if(G) setSpeedLive(); });
  $('speedN').addEventListener('input',e=>{ const v=parseFloat(e.target.value); if(!(v>0)) return; S.speed=v; syncSpeedUI(); settingsChanged(); if(G) setSpeedLive(); });
  $('lbSpeed').addEventListener('input',e=>setSpeed(+e.target.value,true));
  document.querySelectorAll('#winPauseSeg button').forEach(b=>b.onclick=()=>{ S.winPause=b.dataset.v; syncForm(); settingsChanged(); });
  document.querySelectorAll('#namePosSeg button').forEach(b=>b.onclick=()=>{ S.namePos=b.dataset.v; syncForm(); settingsChanged(); });
  document.querySelectorAll('#modeSeg button').forEach(b=>b.onclick=()=>{ S.mode=b.dataset.mode; syncForm(); settingsChanged(); renderCount(); renderNamesLock(); });
  const an=$('anims'); ANIMS.forEach(a=>{ const b=document.createElement('button'); b.type='button'; b.className='anim'; b.dataset.id=a.id; b.innerHTML=a.icon+'<b></b><span></span>'; b.querySelector('b').textContent=a.name; b.querySelector('span').textContent=a.desc; b.onclick=()=>{ S.animation=a.id; syncForm(); settingsChanged(); }; an.appendChild(b); });
  const th=$('themes'); THEMES.forEach(t=>{ const b=document.createElement('button'); b.type='button'; b.className='theme'; b.dataset.id=t.id; b.innerHTML='<i></i><span></span>'; const i=b.querySelector('i'); i.style.background='linear-gradient(135deg,'+t.a+','+t.b+')'; i.style.setProperty('--sw2',t.s); b.querySelector('span').textContent=t.name; b.onclick=()=>{ S.theme=t.id; syncForm(); settingsChanged(); }; th.appendChild(b); });
  // names
  const ta=$('namesText'); ta.value=S.namesText; let nt=0; ta.addEventListener('input',()=>{ S.namesText=ta.value; clearTimeout(nt); nt=setTimeout(()=>{ renderCount(); renderNamesLock(); renderPrizeRows(); },200); saveSettings(); });
  $('btnSample').onclick=async()=>{ if(S.namesText.trim()&&!(await ask('Replace the list?','This replaces the names with 260 sample tickets.',{ok:'Load sample'}))) return; S.mode='names'; S.namesText=sampleNames().join('\n'); ta.value=S.namesText; syncForm(); saveSettings(); renderCount(); renderNamesLock(); renderPrizeRows(); };
  $('btnSortAZ').onclick=()=>{ const l=S.namesText.split(/\r?\n/).map(s=>s.trim()).filter(Boolean); l.sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'})); S.namesText=l.join('\n'); ta.value=S.namesText; saveSettings(); renderCount(); renderNamesLock(); };
  $('btnClearNames').onclick=async()=>{ if(await ask('Clear all names?','',{ok:'Clear',danger:true})){ S.namesText=''; ta.value=''; saveSettings(); renderCount(); renderNamesLock(); } };
  $('fileIn').onchange=e=>{ const f=e.target.files[0]; if(f) handleFile(f); e.target.value=''; };
  const drop=$('cardTickets'); ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); $('drop').classList.add('over'); })); ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); if(ev==='drop'||e.target===drop) $('drop').classList.remove('over'); }));
  drop.addEventListener('drop',e=>{ const f=e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) handleFile(f); });
  // sequences
  $('btnAddSeq').onclick=()=>{ const last=S.seqs[S.seqs.length-1]; const nxt=String.fromCharCode(((last&&last.prefix||'@').charCodeAt(0)||64)+1); S.seqs.push({id:uid(),prefix:/^[A-Z]$/.test(nxt)?nxt:'',from:1,to:100,digits:3,color:['#4b86ff','#f2994a','#27ae60','#eb5757','#9b51e0','#f2c94c'][S.seqs.length%6],exclude:false}); renderSeqs(); settingsChanged(); renderCount(); };
  // prizes
  $('listSel').onchange=e=>{ S.listId=e.target.value; renderLists(); settingsChanged(); };
  $('btnListNew').onclick=async()=>{ const n=await ask('New prize list','Give the list a name.',{input:'Prize list '+(S.lists.length+1),ok:'Create'}); if(n==null) return; const l={id:uid(),name:n.trim()||'Prize list',prizes:[]}; S.lists.push(l); S.listId=l.id; renderLists(); settingsChanged(); };
  $('btnListDup').onclick=async()=>{ const c=curList(); const n=await ask('Duplicate list','Name for the copy:',{input:c.name+' (copy)',ok:'Duplicate'}); if(n==null) return; const l={id:uid(),name:n.trim()||c.name,prizes:c.prizes.map(p=>({...p,id:uid()}))}; S.lists.push(l); S.listId=l.id; renderLists(); settingsChanged(); };
  $('btnListRen').onclick=async()=>{ const c=curList(); const n=await ask('Rename list','',{input:c.name,ok:'Rename'}); if(n==null) return; c.name=n.trim()||c.name; renderLists(); settingsChanged(); };
  $('btnListDel').onclick=async()=>{ if(S.lists.length<2) return toast('This is the only list — use “Clear list” instead'); const c=curList(); if(!(await ask('Delete “'+c.name+'”?','Its '+c.prizes.length+' prizes will be deleted.',{ok:'Delete',danger:true}))) return; S.lists=S.lists.filter(l=>l!==c); S.listId=S.lists[0].id; renderLists(); settingsChanged(); };
  $('btnAddPrize').onclick=()=>{ const ps=curList().prizes; const lastCall=ps.reduce((m,p)=>Math.max(m,parseInt(p.call,10)||0),0); ps.push({id:uid(),call:lastCall?lastCall+20:20,text:''}); renderPrizeRows(); settingsChanged(); setTimeout(()=>{ const r=$('prizeRows').lastElementChild; r&&r.querySelector('.ptext').focus(); },20); };
  $('btnSortPrizes').onclick=()=>{ curList().prizes.sort((a,b)=>(parseInt(a.call,10)||0)-(parseInt(b.call,10)||0)); renderPrizeRows(); settingsChanged(); };
  $('btnClearPrizes').onclick=async()=>{ if(await ask('Clear all prizes in this list?','',{ok:'Clear',danger:true})){ curList().prizes=[]; renderPrizeRows(); settingsChanged(); } };
  $('btnGen').onclick=()=>{ const every=parseInt($('genEvery').value,10), start=parseInt($('genStart').value,10)||every; const total=ticketTotal(); let end=parseInt($('genEnd').value,10); if(!end) end=Math.max(1,total-Math.max(1,finN())); if(!(every>0)) return toast('Enter how often','warn'); const tpl=$('genText').value||'Prize #{n}'; const ps=curList().prizes; const have=new Set(ps.map(p=>parseInt(p.call,10))); let n=ps.length, added=0; for(let c=start;c<=end;c+=every){ if(have.has(c)) continue; n++; ps.push({id:uid(),call:c,text:tpl.replace(/\{n\}/g,n).replace(/\{call\}/g,c)}); added++; if(added>2000) break; } ps.sort((a,b)=>(parseInt(a.call,10)||0)-(parseInt(b.call,10)||0)); renderPrizeRows(); settingsChanged(); toast(added+' prizes added'); };
  // images
  [['inLogo','logo',640],['inBg','bg',1920],['inWelcome','welcome',1400],['inSponsor','sponsor',1000]].forEach(([id,key,max])=>{ $(id).onchange=e=>{ const f=e.target.files[0]; e.target.value=''; if(f) loadImage(f,max,key); }; });
  document.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>{ const k=b.dataset.clear; A[k]=null; try{ localStorage.removeItem(K_ASSET+k);}catch(e){} renderThumbs(); send('assets',{A}); if(G) send('disp',{D:dispSettings()}); });
  // sound / voice tests
  $('btnTestSound').onclick=()=>{ Snd.init(); const was=S.sound; S.sound=true; Snd.ticksAt([0,120,240,360,480]); setTimeout(()=>Snd.fanfare(false),700); setTimeout(()=>{ S.sound=was; },2500); };
  $('btnTestVoice').onclick=()=>{ const tk=draftTickets()[0]; TTS.say((tk?tk.n:'Moshe Cohen')+'. Wins a fifty dollar gift card!',true); };
  // game buttons
  $('btnOpenShow').onclick=openShowHere; $('btnOpenShow2').onclick=openShowHere; $('btnPopout').onclick=openPopout;
  $('btnExport').onclick=exportResults; $('btnExportAudit').onclick=exportAudit;
  $('btnReset').onclick=resetAsk;
  document.querySelectorAll('[data-cmd]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); const c=b.dataset.cmd; if(IS_DISPLAY&&c==='restart'){ if(confirm('Restart the game from the beginning with the same tickets, prizes and settings?')) post({t:'cmd',c,arg:'yes'}); } else if(IS_DISPLAY&&!['fs','help'].includes(c)) post({t:'cmd',c}); else if(c==='fs') toggleFS(); else if(c==='help') $('sHelp').classList.toggle('hidden'); else runCmd(c); }));
  $('dSpeed').addEventListener('input',e=>{ if(IS_DISPLAY) post({t:'cmd',c:'speed',arg:+e.target.value}); else setSpeed(+e.target.value,true); $('dSpeedV').textContent=fmtS(+e.target.value); });
}
function setSpeedLive(){ if(G&&G.phase==='running'&&!busy){ scheduleNext(Math.max(80,effSpeed()*1000-(performance.now()-lastCallStart))); } push(); }
function ticketTotal(){ return G?G.tickets.length:draftTickets().length; }
function renderCount(){ accSoon(); const T=draftTickets(); const uniq=new Set(T.map(t=>t.n.toLowerCase())).size; $('ticketCount').innerHTML=T.length+'<small>ticket'+(T.length===1?'':'s')+'</small>';
  $('namesInfo').textContent=S.mode==='names'?(T.length?(uniq+' different names'+(T.length>uniq?' · '+(T.length-uniq)+' extra tickets for repeat names':'')):'No names yet'):'';
  if(S.mode==='numbers'){ const inc=S.seqs.filter(s=>!s.exclude).length; $('seqInfo').textContent=T.length+' tickets from '+inc+' sequence'+(inc===1?'':'s'); }
  renderPrizeSummary(); }
function renderNamesLock(){ const w=$('namesLocked'); if(!G){ w.classList.add('hidden'); return; } const same=ticketSig(draftTickets())===G.sig; w.classList.toggle('hidden',same); w.textContent='A draw is in progress with '+G.tickets.length+' tickets. Ticket changes here will only be used after you reset the game.'; }
function renderSeqs(){ const box=$('seqRows'); box.replaceChildren(); S.seqs.forEach((s,i)=>{ const r=document.createElement('div'); r.className='seqrow';
  r.innerHTML='<input type="text" data-k="prefix" placeholder="A"><input type="number" data-k="from"><input type="number" data-k="to"><input type="number" data-k="digits" min="0" max="8"><input type="color" data-k="color"><label class="switch"><input type="checkbox" data-k="exclude"></label><button class="btn sm icon danger" title="Delete">✕</button>';
  r.querySelectorAll('[data-k]').forEach(inp=>{ const k=inp.dataset.k; if(inp.type==='checkbox') inp.checked=!!s[k]; else inp.value=s[k]==null?'':s[k]; inp.addEventListener(inp.type==='checkbox'||inp.type==='color'?'change':'input',()=>{ s[k]=inp.type==='checkbox'?inp.checked:(inp.type==='number'?inp.value:inp.value); settingsChanged(); renderCount(); renderNamesLock(); }); });
  r.querySelector('button').onclick=()=>{ S.seqs.splice(i,1); renderSeqs(); settingsChanged(); renderCount(); }; box.appendChild(r); }); }
function renderLists(){ const sel=$('listSel'); sel.replaceChildren(); S.lists.forEach(l=>{ const o=document.createElement('option'); o.value=l.id; o.textContent=l.name+' ('+l.prizes.length+')'; sel.appendChild(o); }); sel.value=S.listId; renderPrizeRows(); }
function prizeMsg(p,all){ const c=parseInt(p.call,10); const total=ticketTotal(), N=finN(); if(!(c>=1)) return ['bad','Enter a call number'];
  if(all.filter(q=>parseInt(q.call,10)===c).length>1) return ['bad','Duplicate call #'+c+' — only the first one is used'];
  if(c>=total) return ['bad','Only '+total+' tickets — call #'+c+' can never happen'];
  if(G&&c<=G.calls.length) return ['done','Already called'];
  if(N>=2&&c>total-N) return ['','During the final '+N+' (after the deal / play-for-it-all choice)'];
  return ['',''];
}
function renderPrizeRows(){ const box=$('prizeRows'); const ps=curList().prizes; box.replaceChildren();
  if(!ps.length){ const e=document.createElement('div'); e.className='hint'; e.style.padding='10px'; e.textContent='No prizes yet. Add one, or use the generator below.'; box.appendChild(e); }
  ps.forEach((p,i)=>{ const r=document.createElement('div'); r.className='prow';
   r.innerHTML='<span class="pn"></span><span class="pcall"><b>#</b><input type="number" class="pc" min="1" title="Call number"></span><input type="text" class="ptext" placeholder="Prize, e.g. $50 gift card"><span class="acts"><button class="btn sm icon ghost" data-a="up" title="Move up">↑</button><button class="btn sm icon ghost" data-a="down" title="Move down">↓</button><button class="btn sm icon ghost danger" data-a="del" title="Remove">✕</button></span><span class="msg"></span>';
   r.querySelector('.pn').textContent=i+1; const pc=r.querySelector('.pc'), pt=r.querySelector('.ptext'); pc.value=p.call; pt.value=p.text;
   pc.addEventListener('input',()=>{ p.call=parseInt(pc.value,10)||''; settingsChanged(); updPrizeMsgs(); }); pt.addEventListener('input',()=>{ p.text=pt.value; settingsChanged(); });
   r.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ const a=b.dataset.a; if(a==='del') ps.splice(i,1); else { const j=a==='up'?i-1:i+1; if(j<0||j>=ps.length) return; [ps[i],ps[j]]=[ps[j],ps[i]]; } renderPrizeRows(); settingsChanged(); });
   box.appendChild(r); });
  updPrizeMsgs(); renderPrizeSummary(); const sel=$('listSel'); const o=sel.querySelector('option[value="'+CSS.escape(S.listId)+'"]'); if(o) o.textContent=curList().name+' ('+ps.length+')'; }
function updPrizeMsgs(){ const ps=curList().prizes; [...$('prizeRows').querySelectorAll('.prow')].forEach((r,i)=>{ const p=ps[i]; if(!p) return; const [cls,msg]=prizeMsg(p,ps); r.classList.toggle('bad',cls==='bad'); r.classList.toggle('done',cls==='done'); const m=r.querySelector('.msg'); m.textContent=msg; m.className='msg '+(cls==='bad'?'warn':'hint'); m.style.display=msg?'':'none'; }); renderPrizeSummary(); }
function renderPrizeSummary(){ const el=$('prizeSummary'); if(!el) return; const ps=curList().prizes.filter(p=>parseInt(p.call,10)>0); const total=ticketTotal(), N=finN(); const lastc=ps.reduce((m,p)=>Math.max(m,parseInt(p.call,10)),0);
  el.textContent=ps.length+' prize'+(ps.length===1?'':'s')+(lastc?' · last at call #'+lastc:'')+(total>1&&N>=2&&N<total?' · final '+N+' reached at call #'+(total-N):''); }
function renderThumbs(){ [['thLogo','logo'],['thBg','bg'],['thWelcome','welcome'],['thSponsor','sponsor']].forEach(([id,k])=>{ const el=$(id); if(el) el.style.backgroundImage=A[k]?'url("'+A[k]+'")':'none'; }); }
function loadImage(file,max,key){ const rd=new FileReader(); rd.onload=()=>{ const img=new Image(); img.onload=()=>{ const sc=Math.min(1,max/Math.max(img.width,img.height)); const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(img.width*sc)); c.height=Math.max(1,Math.round(img.height*sc)); c.getContext('2d').drawImage(img,0,0,c.width,c.height); let url=key==='bg'?c.toDataURL('image/jpeg',0.84):c.toDataURL('image/png'); if(url.length>1800000) url=c.toDataURL('image/jpeg',0.82); A[key]=url; try{ localStorage.setItem(K_ASSET+key,url); }catch(e){ toast('Image too large to save for refresh — it will work until you reload','warn'); } renderThumbs(); send('assets',{A}); send('disp',{D:dispSettings()}); toast('Image added'); }; img.onerror=()=>toast('Could not read that image','warn'); img.src=rd.result; }; rd.readAsDataURL(file); }

/* ----- spreadsheet import ----- */
let pickState=null;
function simpleCSV(text){ const rows=[]; let row=[], cur='', q=false; for(let i=0;i<text.length;i++){ const ch=text[i]; if(q){ if(ch==='"'){ if(text[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=ch; } else if(ch==='"') q=true; else if(ch===','||ch===';'||ch==='\t'){ row.push(cur); cur=''; } else if(ch==='\n'||ch==='\r'){ if(ch==='\r'&&text[i+1]==='\n') i++; row.push(cur); rows.push(row); row=[]; cur=''; } else cur+=ch; } if(cur||row.length){ row.push(cur); rows.push(row); } return rows; }
async function handleFile(f){
  let sheets=[];
  try{
    if(!window.XLSX&&/^https?:/.test(location.protocol)) await new Promise(res=>{ const sc=document.createElement('script'); sc.src='xlsx.mini.min.js'; sc.onload=res; sc.onerror=res; document.head.appendChild(sc); });
    if(window.XLSX){ const buf=await f.arrayBuffer(); const wb=XLSX.read(buf,{type:'array'}); sheets=wb.SheetNames.map(n=>({name:n,rows:XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,defval:'',raw:false,blankrows:false})})); }
    else if(/\.(csv|txt)$/i.test(f.name)){ sheets=[{name:f.name,rows:simpleCSV(await f.text())}]; }
    else return toast('Excel reader not available — save the sheet as CSV and try again','warn');
  }catch(e){ console.error(e); return toast('Could not read that file','warn'); }
  sheets.forEach(s=>s.rows=s.rows.map(r=>r.map(v=>String(v==null?'':v).trim())).filter(r=>r.some(v=>v)));
  sheets=sheets.filter(s=>s.rows.length); if(!sheets.length) return toast('That file has no data','warn');
  pickState={file:f.name,sheets,si:0}; setupPick(); renderPicker();
}
function setupPick(){ const s=pickState.sheets[pickState.si]; const rows=s.rows; const ncol=Math.max(...rows.map(r=>r.length));
  const first=rows[0]||[]; const hdrRe=/^(name|names|full ?name|first|first ?name|last|last ?name|surname|ticket|tickets|ticket ?(no|#|number)|no\.?|#|number|email|phone|qty|quantity|שם|מספר)$/i;
  const header=first.some(v=>hdrRe.test(v))||(rows.length>1&&first.every(v=>v&&isNaN(+v))&&first.length>1&&first.some(v=>/name|ticket|first|last/i.test(v)));
  const cols=[]; for(let c=0;c<ncol;c++){ const vals=rows.slice(header?1:0).map(r=>r[c]||''); if(!vals.some(v=>v)) continue; const numeric=vals.filter(v=>v&&!isNaN(+v)).length/Math.max(1,vals.filter(v=>v).length); cols.push({c,head:header?(first[c]||''):'',vals,numeric}); }
  let sel=[]; const hn=cols.filter(k=>/name|שם/i.test(k.head)&&!/user|file/i.test(k.head));
  const fn=cols.find(k=>/^first/i.test(k.head)), ln=cols.find(k=>/^(last|surname)/i.test(k.head));
  if(fn&&ln) sel=[fn.c,ln.c]; else if(hn.length) sel=[hn[0].c]; else { const t=cols.filter(k=>k.numeric<0.5); sel=[(t[0]||cols[0]).c]; }
  const numCol=cols.find(k=>/ticket|^no\.?$|^#$|number|מספר/i.test(k.head)&&!sel.includes(k.c));
  pickState.cols=cols; pickState.header=header; pickState.sel=sel; pickState.num=numCol?numCol.c:-1; }
function pickNames(){ const s=pickState.sheets[pickState.si]; const rows=s.rows.slice(pickState.header?1:0); const out=[];
  for(const r of rows){ const n=pickState.sel.map(c=>r[c]||'').filter(Boolean).join(' ').replace(/\s+/g,' ').trim(); if(!n) continue; const no=pickState.num>=0?(r[pickState.num]||'').trim():''; out.push(no?(no.replace(/\|/g,'/')+' | '+n):n); }
  return out; }
function renderPicker(){ const box=$('picker'); box.classList.remove('hidden'); const ps=pickState; const names=pickNames(); const colName=c=>{ const k=ps.cols.find(x=>x.c===c); const L=String.fromCharCode(65+(c%26)); return (k&&k.head)?k.head+' ('+L+')':'Column '+L; };
  box.innerHTML='<b>Import from “<span id="pkF"></span>”</b>'+(ps.sheets.length>1?' <select id="pkSheet"></select>':'')+'<div class="hint">Tick the column(s) that make up the name. Several ticked columns are joined (e.g. First + Last).</div><div class="cols" id="pkCols"></div><div class="row"><label class="switch"><input type="checkbox" id="pkHead"> First row is a header</label><label class="field" style="flex:0 0 220px"><span>Ticket # column (optional)</span><select id="pkNum"></select></label></div><div class="hint" id="pkPrev" style="margin:10px 0"></div><div class="row"><button class="btn primary sm" id="pkReplace">Replace list</button><button class="btn sm" id="pkAdd">Add to list</button><button class="btn sm ghost" id="pkCancel">Cancel</button></div>';
  $('pkF').textContent=ps.file;
  if(ps.sheets.length>1){ const s=$('pkSheet'); ps.sheets.forEach((sh,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=sh.name; s.appendChild(o); }); s.value=ps.si; s.onchange=()=>{ ps.si=+s.value; setupPick(); renderPicker(); }; }
  const cc=$('pkCols'); ps.cols.forEach(k=>{ const d=document.createElement('label'); d.className='col'; d.innerHTML='<input type="checkbox"> <b></b><i></i>'; const cb=d.querySelector('input'); cb.checked=ps.sel.includes(k.c); d.querySelector('b').textContent=colName(k.c); d.querySelector('i').textContent=k.vals.filter(Boolean).slice(0,3).join(', '); cb.onchange=()=>{ if(cb.checked) ps.sel.push(k.c); else ps.sel=ps.sel.filter(x=>x!==k.c); ps.sel.sort((a,b)=>a-b); renderPicker(); }; cc.appendChild(d); });
  const hd=$('pkHead'); hd.checked=ps.header; hd.onchange=()=>{ ps.header=hd.checked; renderPicker(); };
  const nm=$('pkNum'); nm.innerHTML='<option value="-1">None (number in list order)</option>'; ps.cols.forEach(k=>{ const o=document.createElement('option'); o.value=k.c; o.textContent=colName(k.c); nm.appendChild(o); }); nm.value=ps.num; nm.onchange=()=>{ ps.num=+nm.value; renderPicker(); };
  $('pkPrev').textContent=names.length+' tickets'+(names.length?' — e.g. '+names.slice(0,4).join(' · '):'');
  const apply=(add)=>{ if(!names.length) return toast('No names selected','warn'); S.mode='names'; S.namesText=(add&&S.namesText.trim()?S.namesText.replace(/\s+$/,'')+'\n':'')+names.join('\n'); $('namesText').value=S.namesText; box.classList.add('hidden'); pickState=null; syncForm(); saveSettings(); renderCount(); renderNamesLock(); renderPrizeRows(); toast(names.length+' tickets imported'); };
  $('pkReplace').onclick=()=>apply(false); $('pkAdd').onclick=()=>apply(true); $('pkCancel').onclick=()=>{ box.classList.add('hidden'); pickState=null; };
}
function sampleNames(){ let seed=5787; const rnd=()=>{ seed=(seed*1103515245+12345)%2147483648; return seed/2147483648; };
  const F=['Moshe','Sarah','Yossi','Rivka','David','Chana','Mendy','Leah','Shmuel','Devorah','Avi','Esther','Levi','Miriam','Eli','Rachel','Dovid','Shoshana','Yehuda','Batsheva','Ari','Malka','Benny','Tova','Chaim','Naomi','Yaakov','Rochel','Zev','Dina','Michael','Rebecca','Daniel','Hannah','Jonathan','Ilana','Adam','Talia','Ben','Shira','Noah','Ava','Ethan','Maya','Berel','Chani','Tzivia','Mordechai','Gitty','Shlomo'];
  const L=['Cohen','Levi','Goldberg','Friedman','Katz','Schwartz','Klein','Rosen','Stein','Weiss','Shapiro','Gold','Kaplan','Feldman','Adler','Baron','Mizrahi','Peretz','Azoulay','Sasson','Horowitz','Gordon','Silver','Rubin','Green','Levine','Blum','Berger','Hirsch','Lerner','Kalmenson','Sasonkin','Abramson','Weinberg'];
  const out=[]; const used=[]; while(out.length<260){ let n; const r=rnd(); if(used.length>20&&r<0.09) n=used[Math.floor(rnd()*used.length)]; else if(r<0.17) n='Mr. & Mrs. '+L[Math.floor(rnd()*L.length)]; else n=F[Math.floor(rnd()*F.length)]+' '+L[Math.floor(rnd()*L.length)]; out.push(n); used.push(n); }
  out[17]='משה כהן'; out[93]='The Goldberg Family'; out[141]='Dr. Avraham Yitzchak Horowitz'; return out; }

/* ===================== VIEWS, LIVE BAR, KEYS ===================== */
function updLive(){ if(IS_DISPLAY) return; const lb=$('livebar'); lb.classList.toggle('hidden',!G);
  const pill=$('gamePill'), pt=$('gamePillText');
  if(!G){ pt.textContent='No game yet'; pill.className='pill'; $('gameSummary').textContent='No game in progress. Press “Open show screen” to start a new draw with the tickets above.'; $('winTable').innerHTML=''; accSoon(); return; }
  const ph=G.phase, rem=remaining(); const live=ph==='running';
  pt.textContent={ready:'Ready to start',running:'Live',paused:'Paused',winner:'Winner on screen',finalists:'Finalists decision',done:'Finished',split:'Finished (split)'}[ph]||ph; pill.className='pill'+(live?' live':'');
  $('lbPhase').className='pill'+(live?' live':''); $('lbPhase').lastElementChild.textContent=chipFor().text;
  $('lbCalled').textContent=G.calls.length; $('lbRem').textContent=rem;
  const nx=nextPrize(); $('lbNext').innerHTML=''; if(nx){ $('lbNext').append('Next prize: #'+nx.cn+' · '); const b=document.createElement('span'); b.textContent=nx.text+' (in '+nx.inCalls+')'; $('lbNext').appendChild(b); }
  const pb=$('lbPlay'); pb.textContent=live?'❚❚ Pause':(ph==='ready'?'▶ Start draw':(ph==='winner'?'▶ Continue':(ph==='paused'?'▶ Continue':'Space'))); pb.disabled=['done','split','finalists'].includes(ph);
  syncSpeedUI();
  let sum=G.tickets.length+' tickets · '+G.calls.length+' called · '+rem+' remaining · started '+ts(G.created);
  if(G.grand!=null) sum='Finished — grand prize to '+G.tickets[G.grand].n+'. '+sum; if(ph==='split') sum='Finished — the finalists split the grand prize. '+sum;
  $('gameSummary').textContent=sum;
  const wins=G.calls.map((c,k)=>({c,k})).filter(o=>o.c.p); const tb=$('winTable');
  let h='<tr><th>Call #</th><th>Ticket</th><th>Name</th><th>Prize</th><th>Time</th></tr>'; const e=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  wins.forEach(o=>{ h+='<tr><td>'+(o.k+1)+'</td><td>'+e(G.tickets[o.c.t].no)+'</td><td dir="auto">'+e(G.tickets[o.c.t].n)+'</td><td>'+e(o.c.p)+'</td><td>'+tsT(o.c.at)+'</td></tr>'; });
  if(G.grand!=null) h+='<tr><td>—</td><td>'+e(G.tickets[G.grand].no)+'</td><td dir="auto"><b>'+e(G.tickets[G.grand].n)+'</b></td><td><b>'+e(grandPrizeNow())+'</b>'+(G.decision==='deal'?' (last one standing, '+e(gameDealName())+')':'')+'</td><td></td></tr>';
  tb.innerHTML=wins.length||G.grand!=null?h:'';
  updPrizeMsgs(); accSoon(); }
function updDisplayPill(){ $('displayPill').classList.toggle('hidden',!displays.size); $('btnPopout').textContent=displays.size?'⧉ Show window open':'⧉ Open show window'; }
function openShowHere(){ Snd.init(); if(!G){ if(!newGame()) return; renderNamesLock(); }
  view='show'; S.view='show'; saveSettings(); $('setup').classList.add('hidden'); $('show').classList.remove('hidden'); closeModal();
  FX.size(); sendFull(); updLive(); setTimeout(()=>{ R.relayout(); },50); }
function goSetup(){ if(IS_DISPLAY) return; if(G&&G.phase==='running') pause(); view='setup'; S.view='setup'; saveSettings(); $('show').classList.add('hidden'); $('setup').classList.remove('hidden'); if(document.fullscreenElement) document.exitFullscreen().catch(()=>{}); updLive(); }
function openPopout(){ Snd.init(); if(!G){ if(!newGame()) return; renderNamesLock(); }
  const url=location.href.split('#')[0]+'#display';
  popup=window.open(url,'rr-display','popup=yes,width=1280,height=720');
  if(!popup){ toast('The browser blocked the new window — allow pop-ups for this page','warn'); return; }
  if(view==='show') goSetup(); updLive(); toast('Drag the new window to the projector and press F there for full screen'); }
function toggleFS(){ if(document.fullscreenElement) document.exitFullscreen().catch(()=>{}); else document.documentElement.requestFullscreen().catch(()=>toast('Full screen was blocked by the browser')); }
const KEYMAP={' ':'toggle','n':'next','u':'undo','r':'rebuy','w':'welcome','m':'sound','v':'voice','e':'setup','s':'deal','d':'deal','c':'continue','p':'continue','arrowup':'faster','+':'faster','=':'faster','arrowdown':'slower','-':'slower','_':'slower'};
document.addEventListener('keydown',e=>{
  if(modalOpen||$('report')&&!$('report').classList.contains('hidden')&&$('report').isConnected) { if(e.key==='Escape'&&$('report')) $('report').remove(); return; }
  const tag=(e.target&&e.target.tagName)||''; if(/INPUT|TEXTAREA|SELECT/.test(tag)&&e.target.type!=='range'&&e.target.type!=='checkbox') return;
  if(e.ctrlKey&&e.key.toLowerCase()==='z'){ if(!IS_DISPLAY&&view==='show'){ e.preventDefault(); runCmd('undo'); } return; }
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  const inShow=IS_DISPLAY||view==='show'; const liveCtl=!IS_DISPLAY&&view==='setup'&&G;
  if(!inShow&&!liveCtl) return;
  const k=e.key.length===1?e.key.toLowerCase():e.key.toLowerCase();
  if(k==='f'&&inShow){ e.preventDefault(); toggleFS(); return; }
  if((k==='?'||k==='h')&&inShow){ $('sHelp').classList.toggle('hidden'); return; }
  if(k==='escape'){ $('sHelp').classList.add('hidden'); return; }
  let c=KEYMAP[k]; if(!c) return; if(!inShow&&['setup','welcome'].includes(c)&&c==='setup') return;
  if(e.target&&e.target.type==='range'&&/arrow/.test(k)) return;
  e.preventDefault(); if(e.repeat&&c!=='faster'&&c!=='slower') return;
  if(IS_DISPLAY){ if(c==='setup') return; post({t:'cmd',c}); } else runCmd(c);
});
// show: auto-hide drawer + cursor
(function(){ let t=0; const sh=$('show'), dr=$('sDrawer'); const wake=()=>{ dr.classList.add('on'); sh.classList.remove('nocursor'); clearTimeout(t); t=setTimeout(()=>{ if(!dr.matches(':hover')){ dr.classList.remove('on'); sh.classList.add('nocursor'); } },2600); }; sh.addEventListener('mousemove',wake); sh.addEventListener('mousedown',wake); sh.addEventListener('dblclick',e=>{ if(!e.target.closest('.s-drawer,.btn')) toggleFS(); }); })();
addEventListener('resize',()=>{ R.relayout(); });


/* ===================== COLLAPSIBLE SETUP SECTIONS ===================== */
const K_ACC='rr_acc_v1';
const ACC_ICONS={"cardTickets": "<path d=\"M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 0 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z\"/><path d=\"M14 5v14\" stroke-dasharray=\"2 2.5\"/>", "cardPrizes": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"4\" rx=\"1\"/><path d=\"M12 8v13M19 12v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8\"/><path d=\"M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5\"/>", "cardDraw": "<circle cx=\"12\" cy=\"13\" r=\"8\"/><path d=\"M12 9v4l2.5 2.5M9 2h6M12 2v3\"/>", "cardLook": "<path d=\"M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z\"/><circle cx=\"7.5\" cy=\"11\" r=\"1.2\" fill=\"currentColor\"/><circle cx=\"10.5\" cy=\"7\" r=\"1.2\" fill=\"currentColor\"/><circle cx=\"15.5\" cy=\"7.5\" r=\"1.2\" fill=\"currentColor\"/>", "cardAds": "<path d=\"M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z\"/><path d=\"M17 8.5a5 5 0 0 1 0 7M20 6a9 9 0 0 1 0 12\" opacity=\".0\"/><path d=\"M16 9h5M16 15h5M16 12h4\"/>", "cardSound": "<path d=\"M11 5 6 9H3v6h3l5 4z\"/><path d=\"M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13\"/>", "cardGame": "<path d=\"M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z\"/><path d=\"M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3\"/>"};
let accReady=false, _accT=0;
function accState(){ const o={}; document.querySelectorAll('#setup .card.acc').forEach(c=>o[c.id]=c.classList.contains('open')); return o; }
function accSave(){ try{ localStorage.setItem(K_ACC, JSON.stringify(accState())); }catch(e){} }
function accSet(card, open, opts){ opts=opts||{}; if(!card) return; const was=card.classList.contains('open'); open=!!open;
  card.classList.toggle('open',open); const hb=card.querySelector('.acc-head'); if(hb) hb.setAttribute('aria-expanded',open?'true':'false');
  const body=card.querySelector('.acc-body'); if(body){ if(open) body.removeAttribute('inert'); else body.setAttribute('inert',''); }
  clearTimeout(card._accT); if(!open) card.classList.remove('settled'); else if(opts.instant) card.classList.add('settled'); else if(!was) card._accT=setTimeout(()=>{ if(card.classList.contains('open')) card.classList.add('settled'); },380);
  if(opts.save!==false) accSave();
  if(open&&opts.scroll) setTimeout(()=>{ const hd=document.querySelector('.su-head'); const top=card.getBoundingClientRect().top+scrollY-(hd?hd.offsetHeight:0)-14-((!$('livebar').classList.contains('hidden'))?$('livebar').offsetHeight:0); if(card.getBoundingClientRect().top<(hd?hd.offsetHeight:0)||card.getBoundingClientRect().top>innerHeight*0.6) scrollTo({top:Math.max(0,top),behavior:'smooth'}); },60); }
function accOpen(id, scroll){ accSet($(id), true, {scroll}); }
function accAll(open){ document.querySelectorAll('#setup .card.acc').forEach(c=>accSet(c,open,{save:false})); accSave(); }
function accSummaries(){ if(!accReady) return; const set=(id,t)=>{ const c=$(id); const s=c&&c.querySelector('.acc-sum'); if(s&&s.textContent!==t){ s.textContent=t; s.title=t; } };
  const pl=(n,w)=>n+' '+w+(n===1?'':'s');
  // 1 tickets
  { const T=draftTickets(); const n=T.length; let t;
    if(S.mode==='numbers') t=n?pl(n,'ticket number'):'No ticket numbers yet';
    else { const u=new Set(T.map(x=>x.n.toLowerCase())).size; t=n?pl(n,'ticket')+(u<n?' · '+pl(u,'name'):''):'No names yet — paste or upload'; }
    if(G&&ticketSig(T)!==G.sig) t+=' · draw uses '+G.tickets.length;
    set('cardTickets',t); }
  // 2 prizes
  { const ps=curList().prizes.filter(p=>parseInt(p.call,10)>0); const g=String(S.grandPrize||'').trim()||'—'; const N=finN();
    set('cardPrizes',pl(ps.length,'prize')+', grand: '+g+(N>=2?' · final '+N+(S.splitOn?' deal '+(String(S.dealRunner||'').trim()||'—')+' / '+(String(S.dealWinner||'').trim()||'—'):''):'')); }
  // 3 draw
  { const sp=parseFloat(S.speed); const an=(ANIMS.find(a=>a.id===S.animation)||{}).name||S.animation;
    set('cardDraw','Speed '+(isFinite(sp)?sp.toFixed(1):'?')+' s · '+an+' · '+(S.winPause==='timed'?'winners pause '+S.winSec+' s':'winners wait for Space')+(S.finalOn?' · slower finish':'')); }
  // 4 look
  { const th=(THEMES.find(x=>x.id===S.theme)||{}).name||S.theme; const p=[th]; const tt=String(S.title||'').trim(); if(tt) p.push('“'+tt+'”'); if(A&&A.logo) p.push('logo'); if(S.bigBoard) p.push('Big Board only');
    set('cardLook',p.join(' · ')); }
  // 5 welcome / sponsors / ticker
  { const w=S.welBefore||S.welAfter||S.welPaused; const sp=S.sponsorPos!=='off'&&A&&A.sponsor;
    set('cardAds','Welcome screen '+(w?'on':'off')+' · '+(sp?'sponsor '+S.sponsorPos:'no sponsor')+' · ticker '+(S.tickOn?'on':'off')); }
  // 6 sound
  { set('cardSound','Sound '+(S.sound?'on ('+Math.round((+S.volume||0)*100)+'%)':'off')+' · Voice '+(S.tts?(S.ttsOnlyWinners?'winners only':'on'):'off')); }
  // 7 game
  { let t='No game yet'; if(G){ const ph={ready:'Ready to start',running:'Live',paused:'Paused',winner:'Winner on screen',finalists:'Finalists decision',done:'Finished',split:'Finished (split)'}[G.phase]||G.phase; const w=G.calls.filter(c=>c.p).length; t=ph+' · '+G.calls.length+' called · '+remaining()+' remaining'+(w?' · '+pl(w,'winner'):''); }
    set('cardGame',t); }
  updSetupCur();
}
function accSoon(){ clearTimeout(_accT); _accT=setTimeout(accSummaries,60); }
function initAcc(){ const cards=[...document.querySelectorAll('#setup .su-main > section.card')];
  const chev='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  cards.forEach(card=>{ const h2=card.querySelector(':scope > h2'); if(!h2) return; const num=h2.querySelector('.num'); if(num) num.remove(); const title=h2.textContent.trim();
    const body=document.createElement('div'); body.className='acc-body'; body.id=card.id+'Body'; const inner=document.createElement('div'); inner.className='acc-inner'; const pad=document.createElement('div'); pad.className='acc-pad';
    while(h2.nextSibling) pad.appendChild(h2.nextSibling); inner.appendChild(pad); body.appendChild(inner); card.appendChild(body);
    h2.className='acc-h'; h2.textContent=''; const b=document.createElement('button'); b.type='button'; b.className='acc-head'; b.setAttribute('aria-controls',body.id);
    b.innerHTML='<span class="acc-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(ACC_ICONS[card.id]||'')+'</svg></span><span class="acc-tt"><b></b><span class="acc-sum"></span></span><span class="acc-chev">'+chev+'</span>';
    b.querySelector('b').textContent=title; b.onclick=()=>accSet(card,!card.classList.contains('open'));
    h2.appendChild(b); card.classList.add('acc'); });
  let saved=null; try{ saved=JSON.parse(localStorage.getItem(K_ACC)||'null'); }catch(e){}
  const noNames=draftTickets().length===0;
  document.body.classList.add('no-anim');
  cards.forEach(c=>{ let open; if(saved&&typeof saved[c.id]==='boolean') open=saved[c.id]; else open=(c.id==='cardTickets'&&noNames);
    accSet(c,open,{save:false,instant:true}); });
  requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.remove('no-anim')));
  $('btnExpandAll').onclick=()=>accAll(true); $('btnCollapseAll').onclick=()=>accAll(false);
  const su=$('setup'); ['input','change','click'].forEach(ev=>su.addEventListener(ev,accSoon,true));
  accReady=true; accSummaries(); }


/* ===================== SAVED SETUPS · SETUP FILES · REOPEN CHOICE ===================== */
const K_SETUPS='rr_setups_v1', K_SETUP='rr_setup_', K_SIMG='rr_simg_', SETUP_FILE_TYPE='reverse-raffle-setup';
const ASSET_KEYS=['logo','bg','welcome','sponsor'];
const SKIP_KEYS=['view','setupName'];
function hstr(s){ let h=0x811c9dc5; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193); } return (h>>>0).toString(36)+s.length.toString(36); }
function setupSettings(){ const o={}; for(const k of Object.keys(DEF)){ if(SKIP_KEYS.includes(k)) continue; o[k]=JSON.parse(JSON.stringify(S[k]===undefined?DEF[k]:S[k])); } return o; }
function setupAssets(){ const o={}; ASSET_KEYS.forEach(k=>o[k]=A[k]||null); return o; }
function setupSig(settings,assets){ return hstr(JSON.stringify(settings)+'|'+ASSET_KEYS.map(k=>assets[k]?hstr(assets[k]):'-').join(',')); }
function cleanSettings(x){ const o={}; if(!x||typeof x!=='object') return o; for(const k of Object.keys(DEF)){ if(SKIP_KEYS.includes(k)||!(k in x)) continue; const d=DEF[k], v=x[k];
    if(Array.isArray(d)){ if(Array.isArray(v)) o[k]=v; } else if(typeof d==='number'){ const n=+v; if(isFinite(n)) o[k]=n; } else if(typeof d==='boolean') o[k]=!!v; else if(v!=null) o[k]=String(v); }
  if(o.lists) o.lists=o.lists.filter(l=>l&&typeof l==='object'&&Array.isArray(l.prizes)).map(l=>({id:String(l.id||uid()),name:String(l.name||'Prize list'),prizes:l.prizes.filter(p=>p&&typeof p==='object').map(p=>({...p,call:p.call,text:String(p.text==null?'':p.text)}))}));
  if(o.lists&&!o.lists.length) delete o.lists;
  return o; }
function setupStats(st){ const nt=parseNameLines(st.namesText||'').length; const L=(st.lists||[]).find(l=>l.id===st.listId)||(st.lists||[])[0]; const np=L?L.prizes.filter(p=>parseInt(p.call,10)>0).length:0; return {tickets:st.mode==='numbers'?null:nt,prizes:np}; }
function setupIndex(){ const v=loadJSON(K_SETUPS); return Array.isArray(v)?v.filter(e=>e&&e.id&&e.name):[]; }
function writeSetupIndex(ix){ return saveJSON(K_SETUPS,ix); }
function lsSet(k,v){ try{ localStorage.setItem(k,v); return true; }catch(e){ return false; } }
function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
function gcSetupImages(){ const used=new Set(); setupIndex().forEach(e=>{ const d=loadJSON(K_SETUP+e.id); if(d&&d.assets) Object.values(d.assets).forEach(h=>h&&used.add(h)); });
  try{ for(let i=localStorage.length-1;i>=0;i--){ const k=localStorage.key(i); if(k&&k.startsWith(K_SIMG)&&!used.has(k.slice(K_SIMG.length))) localStorage.removeItem(k); } }catch(e){} }
// returns true on success
function storeSetup(name,settings,assets){ const ix=setupIndex(); const ex=ix.find(e=>e.name.toLowerCase()===name.toLowerCase()); const id=ex?ex.id:uid();
  const refs={}; const added=[];
  for(const k of ASSET_KEYS){ const url=assets[k]; if(!url){ refs[k]=null; continue; } const h=hstr(url); refs[k]=h; let have=null; try{ have=localStorage.getItem(K_SIMG+h); }catch(e){} if(have==null){ if(!lsSet(K_SIMG+h,url)){ added.forEach(x=>lsDel(K_SIMG+x)); return false; } added.push(h); } }
  const st=setupStats(settings); const entry={id,name,saved:Date.now(),tickets:st.tickets,prizes:st.prizes,sig:setupSig(settings,assets)};
  const prev=ex?localStorage.getItem(K_SETUP+id):null;
  if(!lsSet(K_SETUP+id,JSON.stringify({v:1,name,settings,assets:refs}))){ added.forEach(x=>lsDel(K_SIMG+x)); return false; }
  const nix=ix.filter(e=>e.id!==id); nix.unshift(entry);
  if(!writeSetupIndex(nix)){ if(prev!=null) lsSet(K_SETUP+id,prev); else lsDel(K_SETUP+id); added.forEach(x=>lsDel(K_SIMG+x)); return false; }
  gcSetupImages(); return true; }
function readSetup(id){ const d=loadJSON(K_SETUP+id); if(!d||!d.settings) return null; const assets={}; ASSET_KEYS.forEach(k=>{ const h=d.assets&&d.assets[k]; let u=null; if(h){ try{ u=localStorage.getItem(K_SIMG+h); }catch(e){} } assets[k]=u||null; }); return {name:d.name,settings:d.settings,assets}; }
function gameWord(){ if(!G||!G.calls.length) return ''; return (['done','split'].includes(G.phase)?'the finished game':'the game in progress ('+G.calls.length+' called)'); }
// replace the whole setup and start clean (no game); reloads so every panel is rebuilt from storage
function applySetup(settings,assets,name,flash){
  gen++; try{ stopTimers(); }catch(e){} busy=false; G=null; saveGame();
  const ns=Object.assign(JSON.parse(JSON.stringify(DEF)),cleanSettings(settings),{view:'setup',setupName:name||''});
  if(!ns.lists.find(l=>l.id===ns.listId)) ns.listId=ns.lists[0].id;
  S=ns; clearTimeout(_st); saveJSON(K_SET,S);
  let lost=false; ASSET_KEYS.forEach(k=>{ const u=assets&&assets[k]||null; A[k]=u; if(u){ if(!lsSet(K_ASSET+k,u)) lost=true; } else lsDel(K_ASSET+k); });
  try{ sessionStorage.setItem('rr_flash',(flash||'Setup loaded')+(lost?' — one image was too large to keep after a refresh':'')); }catch(e){}
  location.reload(); }
function updSetupCur(){ const el=$('setupCur'); if(!el) return; const nm=String(S.setupName||'').trim(); const n=setupIndex().length;
  if(!nm){ el.textContent=n?'Current setup not saved · '+n+' saved':'Save your names, prizes and settings to reuse them next time'; el.classList.remove('dirty'); return; }
  const e=setupIndex().find(x=>x.name.toLowerCase()===nm.toLowerCase()); const dirty=!e||e.sig!==setupSig(setupSettings(),setupAssets());
  el.textContent='Current: “'+nm+'”'+(dirty?' · changed since saved':' · saved'); el.classList.toggle('dirty',dirty); }
function fmtDay(t){ try{ return new Date(t).toLocaleDateString(undefined,{month:'short',day:'numeric',year:new Date(t).getFullYear()!==new Date().getFullYear()?'numeric':undefined}); }catch(e){ return ''; } }
function renderSetupMenu(){ const m=$('setupMenu'); m.replaceChildren(); const ix=setupIndex(); const cur=String(S.setupName||'').toLowerCase();
  if(!ix.length){ const d=document.createElement('div'); d.className='sb-empty'; d.innerHTML='<b>No saved setups yet</b><span>Set up your names and prizes, then press “Save setup as…”.</span>'; m.appendChild(d); return; }
  const hd=document.createElement('div'); hd.className='sb-mh'; hd.textContent='Saved in this browser'; m.appendChild(hd);
  ix.forEach(e=>{ const r=document.createElement('div'); r.className='sb-item'+(e.name.toLowerCase()===cur?' cur':'');
    const b=document.createElement('button'); b.type='button'; b.className='sb-pick'; b.setAttribute('role','menuitem');
    const meta=[]; if(e.tickets!=null) meta.push(e.tickets+' ticket'+(e.tickets===1?'':'s')); meta.push(e.prizes+' prize'+(e.prizes===1?'':'s')); meta.push('saved '+fmtDay(e.saved));
    b.innerHTML='<b></b><span></span>'; b.querySelector('b').textContent=e.name; b.querySelector('span').textContent=meta.join(' · ');
    b.onclick=()=>{ closeSetupMenu(); loadSavedSetup(e.id); };
    const del=document.createElement('button'); del.type='button'; del.className='sb-del'; del.title='Delete “'+e.name+'”'; del.setAttribute('aria-label','Delete '+e.name);
    del.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>';
    del.onclick=async ev=>{ ev.stopPropagation(); closeSetupMenu(); if(!(await ask('Delete “'+e.name+'”?','The saved setup is removed from this browser. Your current names, prizes and game are not changed.',{ok:'Delete',danger:true}))) return;
      lsDel(K_SETUP+e.id); writeSetupIndex(setupIndex().filter(x=>x.id!==e.id)); gcSetupImages(); updSetupCur(); toast('Deleted “'+e.name+'”'); };
    r.append(b,del); m.appendChild(r); }); }
function closeSetupMenu(){ $('setupMenu').classList.add('hidden'); $('btnLoadSetup').setAttribute('aria-expanded','false'); }
function toggleSetupMenu(){ const m=$('setupMenu'); if(!m.classList.contains('hidden')) return closeSetupMenu(); renderSetupMenu(); m.classList.remove('hidden'); $('btnLoadSetup').setAttribute('aria-expanded','true'); }
async function loadSavedSetup(id){ const d=readSetup(id); if(!d) return toast('That setup could not be read','warn');
  const gw=gameWord(); const txt='This replaces the current names, prizes and settings with “'+d.name+'”.'+(gw?' It also clears '+gw+' — download the results first if you need them.':'');
  if(!(await ask('Load “'+d.name+'”?',txt,{ok:'Load setup'}))) return;
  applySetup(d.settings,d.assets,d.name,'Loaded “'+d.name+'”'); }
async function saveSetupAs(){ const suggest=String(S.setupName||'').trim()||(String(S.title||'').trim())||'';
  let name=await ask('Save setup as…','Saves the names, prizes, images and every setting (not the game), so you can load it again next time.',{input:suggest,ok:'Save setup'});
  if(name==null) return; name=String(name).trim().slice(0,80); if(!name) return toast('Give the setup a name','warn');
  const ex=setupIndex().find(e=>e.name.toLowerCase()===name.toLowerCase());
  if(ex&&ex.name.toLowerCase()!==String(S.setupName||'').toLowerCase()){ if(!(await ask('Replace “'+ex.name+'”?','A saved setup with this name already exists.',{ok:'Replace'}))) return; }
  if(!storeSetup(name,setupSettings(),setupAssets())) return toast('Not enough room in this browser — delete an old setup, or use “Export setup file”','warn');
  S.setupName=name; saveSettings(); updSetupCur(); toast('Saved “'+name+'”'); }
function slugify(s){ return String(s||'').trim().replace(/[\\/:*?"<>|]+/g,'').replace(/\s+/g,' ').slice(0,60)||'Raffle setup'; }
function exportSetupFile(){ const name=String(S.setupName||'').trim()||String(S.title||'').trim()||'Raffle setup';
  const data={type:SETUP_FILE_TYPE,version:1,name,exported:new Date().toISOString(),settings:setupSettings(),assets:setupAssets()};
  const blob=new Blob([JSON.stringify(data,null,1)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=slugify(name)+' - reverse raffle setup.json'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500);
  toast('Setup file downloaded'); }
async function importSetupFile(f){ let data; try{ data=JSON.parse(await f.text()); }catch(e){ return toast('That file is not a setup file','warn'); }
  if(!data||typeof data!=='object'||!data.settings||(data.type&&data.type!==SETUP_FILE_TYPE)) return toast('That file is not a reverse raffle setup file','warn');
  const settings=cleanSettings(data.settings); const assets={}; ASSET_KEYS.forEach(k=>{ const u=data.assets&&data.assets[k]; assets[k]=(typeof u==='string'&&/^data:image\//.test(u))?u:null; });
  const name=String(data.name||f.name.replace(/\.json$/i,'').replace(/ - reverse raffle setup$/i,'')||'Imported setup').trim().slice(0,80);
  const st=setupStats(Object.assign({},DEF,settings)); const gw=gameWord();
  const ex=setupIndex().find(e=>e.name.toLowerCase()===name.toLowerCase()); const same=ex&&ex.sig===setupSig(setupSettingsFrom(settings),assets);
  const txt=(st.tickets!=null?st.tickets+' tickets · ':'')+st.prizes+' prizes. This replaces the current names, prizes and settings'+(gw?', and clears '+gw:'')+'. '+(ex?(same?'It matches your saved “'+ex.name+'”.':'It also updates your saved “'+ex.name+'” to this version.'):'It is also added to your saved setups.');
  if(!(await ask('Import “'+name+'”?',txt,{ok:'Import setup'}))) return;
  const saved=storeSetup(name,setupSettingsFrom(settings),assets);
  applySetup(settings,assets,name,'Imported “'+name+'”'+(saved?'':' (not enough room to add it to saved setups)')); }
function setupSettingsFrom(settings){ const full=Object.assign(JSON.parse(JSON.stringify(DEF)),settings); const o={}; for(const k of Object.keys(DEF)){ if(SKIP_KEYS.includes(k)) continue; o[k]=full[k]; } return o; }
function initSetups(){
  $('btnSaveSetup').onclick=saveSetupAs; $('btnLoadSetup').onclick=e=>{ e.stopPropagation(); toggleSetupMenu(); };
  $('btnExportSetup').onclick=exportSetupFile; $('btnImportSetup').onclick=()=>$('inSetupFile').click();
  $('inSetupFile').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; if(f) importSetupFile(f); };
  document.addEventListener('mousedown',e=>{ if(!e.target.closest('.sb-load')) closeSetupMenu(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeSetupMenu(); });
  updSetupCur();
  let fl=null; try{ fl=sessionStorage.getItem('rr_flash'); sessionStorage.removeItem('rr_flash'); }catch(e){} if(fl) setTimeout(()=>toast(fl),300);
}
async function resetAsk(){ if(!G) return toast('No game to reset');
  if(await ask('Reset the game?','Clears the draw: calls, winners and the audit log. Your names, prizes and settings stay, ready for a new game. Tip: download the results first if you need them.',{ok:'Reset game',danger:true})) resetGame(); }
async function startFresh(){ if(!(await ask('Start fresh?','Clears the names, prizes, images and settings in this browser, and the game.'+(S.setupName&&!$('setupCur').classList.contains('dirty')?'':' If you may want this setup again, save it first.')+' Your saved setups are kept.',{ok:'Start fresh',danger:true}))) return false;
  gen++; try{ stopTimers(); }catch(e){} busy=false; G=null; saveGame(); S=JSON.parse(JSON.stringify(DEF)); clearTimeout(_st); saveJSON(K_SET,S);
  ASSET_KEYS.forEach(k=>{ A[k]=null; lsDel(K_ASSET+k); }); lsDel(K_ACC); try{ sessionStorage.setItem('rr_flash','Fresh start — add your names to begin'); }catch(e){}
  location.reload(); return true; }
const RO_IC={cont:'<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',new:'<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/>',fresh:'<path d="M11 3.5l1.8 4.9 4.9 1.8-4.9 1.8L11 16.9l-1.8-4.9-4.9-1.8 4.9-1.8z"/><path d="M18.5 14.5l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/>'};
function reopenChoice(onContinue){ const done=['done','split'].includes(G.phase); const w=G.calls.filter(c=>c.p).length; const last=G.calls.length?G.calls[G.calls.length-1].at:G.created;
  const opt=(a,t,d,pri)=>'<button type="button" class="ro-opt'+(pri?' pri':'')+'" data-ro="'+a+'"><span class="ro-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+RO_IC[a]+'</svg></span><span class="ro-tx"><b>'+t+'</b><span>'+d+'</span></span></button>';
  const m=modal('<div class="ro"><div class="ro-kick">Welcome back</div><h3 class="ro-h"></h3><p class="ro-meta"></p><div class="ro-opts">'+
    opt('cont','Continue game',done?'Go back to the finished game and its results.':'Pick up right where you left off, at call #'+(G.calls.length+1)+'.',true)+
    opt('new','New game, same setup','Keeps the names, prizes and every setting. Clears only the draw.')+
    opt('fresh','Start fresh','Blank names and prizes with default settings. Saved setups are kept.')+
    '</div>'+(w||G.grand!=null?'<div class="ro-foot"><span class="hint">Starting a new game clears this draw’s results.</span><button type="button" class="btn sm ghost" data-ro="csv">⬇ Download results first</button></div>':'')+'</div>',{sticky:true,big:false});
  m.querySelector('.box').classList.add('ro-box');
  m.querySelector('.ro-h').textContent=done?(G.phase==='split'?'Your last game is finished (split)':'Your last game is finished'):'You have a game in progress';
  const nm=String(S.setupName||S.title||'').trim();
  const meta=[]; if(nm) meta.push(nm); meta.push(done&&G.grand!=null?'Grand prize: '+G.tickets[G.grand].n:G.calls.length+' of '+G.tickets.length+' called'); if(w) meta.push(w+' winner'+(w===1?'':'s')); meta.push('last played '+fmtDay(last)+', '+new Date(last).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}));
  m.querySelector('.ro-meta').textContent=meta.join(' · ');
  const go=async a=>{
    if(a==='csv'){ $('btnExport').click(); return; }
    if(a==='cont'){ closeModal(); onContinue(); return; }
    if(a==='new'){ closeModal(); resetGame(); try{ toast('New game ready — same names, prizes and settings'); }catch(e){} return; }
    if(a==='fresh'){ closeModal(); const ok=await startFresh(); if(!ok) reopenChoice(onContinue); } };
  m.querySelectorAll('[data-ro]').forEach(b=>b.onclick=()=>go(b.dataset.ro));
  m.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'&&e.target===m.querySelector('[data-ro="cont"]')) return; });
  setTimeout(()=>{ const c=m.querySelector('[data-ro="cont"]'); c&&c.focus(); },40); }

/* ===================== INIT ===================== */
FX.init($('fx'));
if(IS_DISPLAY){
  document.title='Reverse Raffle — Show';
  $('setup').classList.add('hidden'); $('show').classList.remove('hidden'); bindForm();
  let synced=false; const hello=()=>post({t:synced?'ping':'hello'});
  const _h=R.handle.bind(R); R.handle=m=>{ if(m.t==='full') synced=true; _h(m); };
  hello(); setInterval(hello,2000); addEventListener('beforeunload',()=>post({t:'bye'}));
  R.D=dispSettings(); R.applyD(); $('ovWel').classList.add('on'); R.welcomeText(null);
} else {
  bindForm(); syncForm(); renderSeqs(); renderLists(); renderCount(); TTS.init();
  if(/^https?:/.test(location.protocol)) $('dlOffline').classList.remove('hidden');
  if(G){ // crash protection: resume exactly where we left off
    if(!Array.isArray(G.st)||!Array.isArray(G.calls)){ G=null; saveGame(); }
    else { if(G.phase==='running') { G.phase='paused'; G.pausedAt=Date.now(); } G.pending=null; G.audit=G.audit||[]; G.ops=G.ops||[]; G.rebuys=G.rebuys||[]; log('restore','Page reloaded — draw restored at call #'+G.calls.length); saveGame(); }
  }
  initAcc(); initSetups();
  renderNamesLock(); updLive();
  const resume=()=>{ if(!G) return; if(S.view==='show'||G.calls.length){ openShowHere(); toast(['done','split'].includes(G.phase)?'Finished game — press E to go back to setup':'Draw restored — '+G.calls.length+' called, '+remaining()+' remaining. Press SPACE to continue.'); }
    if(G.handled<G.calls.length) afterReveal(G.calls.length-1,true,null); };
  if(G&&(G.calls.length>0||['done','split'].includes(G.phase))) reopenChoice(resume);
  else { if(G&&S.view==='show') openShowHere(); if(G&&G.handled<G.calls.length) afterReveal(G.calls.length-1,true,null); }
  document.addEventListener('pointerdown',()=>Snd.init(),{once:false,passive:true});
}
window.RR={ get S(){return S;}, get G(){return G;}, randInt, cmd:runCmd, newGame, openShowHere, goSetup, remaining, effSpeed, isBusy:()=>busy, buildDyn, restartGame, settingsChanged, syncForm };
})();
