// Page-turn geometry adapted from Meng To; provenance retained in images/notebook/mengto/ATTRIBUTION.md.
(()=>{

/* =====================================================================
   Meng To — sketchbook hero.
   Spreads are transparent PNGs of an open sketchbook generated with
   Higgsfield.  The leaf that turns is a real curved surface: a chain of
   nested strips whose tangent sweeps through an arc, so the page bends
   the way paper bends instead of pivoting like a flat door.
   ===================================================================== */
const Q=new URLSearchParams(location.search);
const DIR='images/notebook/spreads/';
const PAGES=[{"file":"front-cover.svg","title":"The notebook.","place":"Front cover","cover":"front"},{"file":"spider-man.svg","title":"Spider-Man","place":"Character studies"},{"file":"cactus.svg","title":"A little green","place":"Watercolour study"},{"file":"jack-sparrow.svg","title":"Captain Jack Sparrow","place":"Portrait study"},{"file":"wolverine.svg","title":"Wolverine","place":"Light & shadow"},{"file":"po.svg","title":"Po","place":"Character studies"},{"file":"iron-man.svg","title":"Iron Man","place":"Armour study"},{"file":"back-cover.svg","title":"Until the next page.","place":"Back cover","cover":"back"}];
PAGES.forEach(p=>p.url=DIR+p.file+'?v=covers-1');
const M=PAGES.length, LAND=0;

const wrap=document.getElementById('sbWrap');
const stage=document.getElementById('sbStage');
const sb3d=document.getElementById('sb3d');
const book=document.getElementById('sbBook');
const capBox=document.getElementById('sbCaptions');
const hint=document.getElementById('sbHint');
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------ the turning leaf */
const N=18;            /* strips — enough for a smooth curve          */
const SPAN=0.449;      /* gutter → outer page edge, as a fraction     */
const BETA=0.60;       /* peak curl of the arc, radians              */
let idx=0, turn=null;  /* turn = {dir, from, to, t}                   */
let strips=[];         /* the chain, kept for per-frame lighting       */

function el(t,c){const e=document.createElement(t);if(c)e.className=c;return e}
function imgEl(i,side){
  const im=new Image();im.className='sb-half-img '+side;
  im.draggable=false;im.alt='';im.src=PAGES[i].url;return im;
}

function halfEl(pos,i){
  const d=el('div','sb-half '+pos);
  d.appendChild(imgEl(i,pos));
  d.appendChild(el('div','gutter-shade '+pos));
  return d;
}
/* build the strip chain once per turn; background offsets are pure
   geometry, so they never need touching again while it animates */
function buildCurl(dir,from,to){
  strips=[];
  const c=el('div','curl '+dir);
  c.style.setProperty('--n',N);
  c.style.setProperty('--span',SPAN);
  let host=c;
  for(let i=0;i<N;i++){
    const s=el('div','strip');
    s.style.setProperty('--i',i);
    const gut='calc(var(--bw) * 0.5)';
    const sw='calc(var(--bw) * '+SPAN+' / '+N+')';
    const A='calc(-1 * ('+gut+' + '+i+' * '+sw+'))';         /* faces the from-page  */
    const B='calc('+(i+1)+' * '+sw+' - '+gut+')';            /* faces the to-page    */
    const f=el('div','face front'), b=el('div','face back');
    const dress=(e,url,px)=>{
      e.style.backgroundImage='url('+url+')';
      e.style.backgroundPositionX=px;
    };
    dress(f,PAGES[from].url, dir==='next'?A:B);
    dress(b,PAGES[to].url,   dir==='next'?B:A);
    f.appendChild(el('div','sh'));f.appendChild(el('div','gl'));
    b.appendChild(el('div','sh'));b.appendChild(el('div','gl'));
    s.appendChild(f);s.appendChild(b);
    if(i===N-1)s.classList.add('edge');
    host.appendChild(s);host=s;
    strips.push(s);
  }
  return c;
}
function applyTurn(t){
  const th=Math.PI*t;                       /* how far the leaf has swung */
  const beta=BETA*Math.sin(Math.PI*t);      /* it is flat at both ends    */
  const D=180/Math.PI;
  const tt=th+beta, td=2*beta/N;
  sb3d.style.setProperty('--tt',(tt*D).toFixed(2)+'deg');
  sb3d.style.setProperty('--td',(td*D).toFixed(3)+'deg');
  sb3d.style.setProperty('--shade',Math.sin(Math.PI*t).toFixed(3));
  fadeCaption(t);
  for(let i=0;i<strips.length;i++){
    const l1=Math.abs(Math.cos(tt-i*td));        /* facing at this strip's near edge */
    const l2=Math.abs(Math.cos(tt-(i+1)*td));    /* ...and at its far edge           */
    const st=strips[i].style;
    st.setProperty('--lit',l1.toFixed(3));
    st.setProperty('--a1',((1-l1)*.62).toFixed(3));
    st.setProperty('--a2',((1-l2)*.62).toFixed(3));
  }
}
function paint(){
  book.textContent='';
  if(!turn){
    const f=el('div','sb-full');
    const im=new Image();im.src=PAGES[idx].url;im.alt=PAGES[idx].title;
    im.draggable=false;
    f.appendChild(im);book.appendChild(f);
    sb3d.style.setProperty('--shade','0');
  }else{
    const next=turn.dir==='next';
    book.appendChild(halfEl('left', next?turn.from:turn.to));
    book.appendChild(halfEl('right',next?turn.to:turn.from));
    book.appendChild(buildCurl(turn.dir,turn.from,turn.to));
    applyTurn(turn.t);
  }
  const a=el('button','sb-zone sb-prev'),b=el('button','sb-zone sb-next');
  a.setAttribute('aria-label','previous page');b.setAttribute('aria-label','next page');
  book.appendChild(a);book.appendChild(b);
  layout();
  caption();
  marks();
  if(typeof syncZoomLayer==='function')syncZoomLayer();
  if(typeof placeLoupe==='function')placeLoupe();
}
function caption(){
  capBox.textContent='';
  capOut=capIn=null;
  if(turn){
    capOut=el('p','sb-caption live');capOut.textContent=PAGES[turn.from].title;capBox.appendChild(capOut);
    capIn=el('p','sb-caption live');capIn.textContent=PAGES[turn.to].title;capBox.appendChild(capIn);
    fadeCaption(turn.t);
  }else{
    const p=el('p','sb-caption');p.textContent=PAGES[idx].title;capBox.appendChild(p);
  }
}
let capOut=null,capIn=null;
function fadeCaption(t){
  if(!capOut||!capIn)return;
  /* the old title is gone before the new one arrives, so they never
     sit on top of each other mid-drag */
  const out=1-Math.max(0,Math.min(1,(t-0.10)/0.28));
  const inn=Math.max(0,Math.min(1,(t-0.56)/0.30));
  capOut.style.opacity=out.toFixed(3);
  capIn.style.opacity=inn.toFixed(3);
}
function layout(){
  sb3d.style.setProperty('--bw',book.clientWidth+'px');
}
addEventListener('resize',layout);

/* ------------------------------------------------------ spring loop */
let spring=null;
function animateTo(target,onDone,stiff,damp){
  spring={kind:'spring',v:0,target:target,done:onDone,k:stiff||150,c:damp||22};
  kick();
}
/* the riffle wants a fixed tempo, not a spring settling time */
function tweenTo(target,dur,onDone){
  spring={kind:'tween',from:turn?turn.t:0,target:target,dur:dur,e:0,done:onDone};
  kick();
}
let raf=null,last=0;
function tick(now){
  raf=null;
  const dt=Math.min(0.032,(now-last)/1000||0.016);last=now;
  if(spring&&turn){
    const s=spring;
    if(s.kind==='tween'){
      s.e+=dt;
      const k=Math.min(1,s.e/s.dur);
      turn.t=s.from+(s.target-s.from)*k;
      applyTurn(turn.t);
      if(k>=1){spring=null;const d=s.done;d&&d();}
    }else{
      const x=turn.t-s.target;
      s.v+= (-s.k*x - s.c*s.v)*dt;
      turn.t+=s.v*dt;
      if(Math.abs(turn.t-s.target)<0.002&&Math.abs(s.v)<0.02){
        turn.t=s.target;spring=null;
        applyTurn(turn.t);
        const d=s.done;d&&d();
      }else applyTurn(turn.t);
    }
  }
  viewSpring();
  const lmoved=false;
  /* kick() may already have queued the next frame from a done-callback */
  if((spring||viewActive||lmoved)&&raf===null) raf=requestAnimationFrame(tick);
}
function kick(){ if(raf===null){last=performance.now();raf=requestAnimationFrame(tick);} }

/* ------------------------------------------- tilt + zoom of the book */
const TILT_X=4.5, TILT_Y=7;      /* degrees — deliberately restrained   */
const ZOOM_MIN=0.9, ZOOM_MAX=1.5;
const view={rx:0,ry:0,z:1, trx:0,try_:0,tz:1};
let viewActive=false;
let lastZ=1;
function applyView(){
  sb3d.style.setProperty('--rx',view.rx.toFixed(2)+'deg');
  sb3d.style.setProperty('--ry',view.ry.toFixed(2)+'deg');
  sb3d.style.setProperty('--zoom',view.z.toFixed(3));
  /* the glass stays put, but the page under it has moved */
  if(view.z!==lastZ){lastZ=view.z;if(typeof placeLoupe==='function')placeLoupe();}
}
function viewSpring(){
  const e=0.14;
  let moved=false;
  for(const [k,t] of [['rx','trx'],['ry','try_'],['z','tz']]){
    const d=view[t]-view[k];
    if(Math.abs(d)>0.0006){view[k]+=d*e;moved=true;}
    else view[k]=view[t];
  }
  if(moved)applyView();
  viewActive=moved;
  return moved;
}
function setView(rx,ry,z){
  view.trx=Math.max(-TILT_X,Math.min(TILT_X,rx));
  view.try_=Math.max(-TILT_Y,Math.min(TILT_Y,ry));
  view.tz=Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,z));
  viewActive=true;kick();
  if(typeof syncZoom==='function')syncZoom();
}
/* the book leans toward the cursor — no dragging, and never far */
function tiltTo(cx,cy){
  if(drag)return;                       /* hold still while a page is being turned */
  const r=book.getBoundingClientRect();
  if(!r.width)return;
  const nx=Math.max(-1,Math.min(1,(cx-(r.left+r.width/2))/(r.width*0.62)));
  const ny=Math.max(-1,Math.min(1,(cy-(r.top+r.height/2))/(r.height*0.9)));
  setView(-ny*TILT_X, nx*TILT_Y, view.tz);
}
addEventListener('pointermove',e=>{
  if(e.pointerType==='touch')return;
  tiltTo(e.clientX,e.clientY);
},{passive:true});
addEventListener('pointerout',e=>{if(!e.relatedTarget)setView(0,0,view.tz)});
addEventListener('blur',()=>setView(0,0,view.tz));
/* the wheel belongs to the page — zoom is on the toolbar, or a double click
   to come back to 100% */
stage.addEventListener('dblclick',()=>setView(view.trx,view.try_,1));

/* ------------------------------------------------------- pointer work */
let drag=null;
function bookRect(){return book.getBoundingClientRect()}
function hideHint(){hint.classList.add('gone')}

stage.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  e.preventDefault();                     /* no text selection, no image drag */
  const onBook=e.target.closest('.sb-zone');
  stage.setPointerCapture(e.pointerId);
  hideHint();
  if(!onBook||introOn)return;
  const r=bookRect();
  const dir=(e.clientX-r.left)/r.width>0.5?'next':'prev';
  startTurn(dir,0);
  if(!turn)return;
  drag={dir:dir,x0:e.clientX,w:r.width,moved:0,vel:0,tPrev:performance.now()};
});
stage.addEventListener('pointermove',e=>{
  if(!drag)return;
  const dx=e.clientX-drag.x0;
  drag.moved=Math.max(drag.moved,Math.abs(dx));
  const raw=(drag.dir==='next'? -dx : dx)/(drag.w*0.62);
  const t=Math.max(0,Math.min(1,raw));
  const now=performance.now();
  drag.vel=(t-(turn?turn.t:0))/Math.max(0.001,(now-drag.tPrev)/1000);
  drag.tPrev=now;
  if(turn){turn.t=t;applyTurn(t);}
});
function endDrag(e){
  if(!drag)return;
  const d=drag;drag=null;
  if(!turn)return;
  if(d.moved<6){                              /* a tap, not a drag */
    commit();return;
  }
  const go = turn.t>0.42 || d.vel>1.1;
  if(go)commit(); else cancel();
}
stage.addEventListener('dragstart',e=>e.preventDefault());
stage.addEventListener('selectstart',e=>e.preventDefault());
stage.addEventListener('pointerup',endDrag);
stage.addEventListener('pointercancel',endDrag);

/* ------------------------------------------------------ turn control */
function startTurn(dir,t){
  if(!turn&&((dir==='prev'&&idx===0)||(dir==='next'&&idx===M-1)))return;
  spring=null;
  if(turn){idx=turn.to;turn=null;}      /* settle anything still in flight */
  if(typeof shoveLoupe==='function')shoveLoupe(dir);
  const from=idx;
  turn={dir:dir,from:from,to:dir==='next'?Math.min(M-1,from+1):Math.max(0,from-1),t:t||0};
  paint();
}
function commit(){
  if(!turn)return;
  if(REDUCED){idx=turn.to;turn=null;paint();return;}
  animateTo(1,()=>{idx=turn.to;turn=null;paint();},170,26);
  kick();
}
function cancel(){
  if(!turn)return;
  animateTo(0,()=>{turn=null;paint();},150,24);
  kick();
}
function step(dir){
  if(introOn)endIntro();
  if(turn){ /* finish whatever is in flight first */ idx=turn.to;turn=null; }
  startTurn(dir,0);commit();
}
function goTo(i){
  if(introOn)endIntro();
  if(i===idx)return;
  if(turn){idx=turn.to;turn=null;}
  if(Math.abs(i-idx)===1){step(i>idx?'next':'prev');return;}
  startTurn(i>idx?'next':'prev',0);
  if(turn){turn.to=i;paint();commit();}
}
document.getElementById('sbLeft').onclick=()=>step('prev');
document.getElementById('sbRight').onclick=()=>step('next');
addEventListener('keydown',e=>{
  if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
  if(e.metaKey||e.ctrlKey||e.altKey||document.documentElement.classList.contains('is-gated'))return;
  const t=e.target;
  if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
  e.preventDefault();hideHint();
  step(e.key==='ArrowRight'?'next':'prev');
});


/* --------------------------------------------------------- the index */
const plateList=document.getElementById('plateList');
PAGES.forEach((p,i)=>{
 const b=el('button','plate');b.type='button';b.setAttribute('aria-label',p.cover?p.place:'Sketch '+i+': '+p.title);b.onclick=()=>goTo(i);plateList.appendChild(b);
});
function marks(){
 const cur=turn?turn.to:idx;
 const page=PAGES[cur];
 const state=turn?'open':(page.cover||'open');
 wrap.dataset.cover=state;
 plateList.querySelectorAll('.plate').forEach((b,i)=>b.setAttribute('aria-current',String(i===cur)));
 document.getElementById('notebook-count').innerHTML=page.cover?(page.cover==='front'?'VOL. 01':'FIN'):String(cur).padStart(2,'0')+' <span>/ 06</span>';
 book.setAttribute('aria-label',page.cover?page.place+': '+page.title:'Sketch '+cur+' of 6: '+page.title);
 document.getElementById('sbLeft').disabled=cur===0;
 document.getElementById('sbRight').disabled=cur===M-1;
 const prev=book.querySelector('.sb-prev'),next=book.querySelector('.sb-next');
 if(prev)prev.disabled=cur===0;
 if(next)next.disabled=cur===M-1;
 hint.textContent=page.cover==='front'?'Click or drag to open':page.cover==='back'?'Turn back to reopen':'Drag a page to turn';
}

/* ---------------------------------------------------------- the riffle */
let riffle=null,riffleAt=0,introOn=false;
function endIntro(){
  introOn=false;wrap.classList.remove('intro','b2');
}
function riffleStep(){
  const s=riffle[riffleAt];
  wrap.classList.toggle('b2',s.bell>0.55);
  startTurn('next',0);
  tweenTo(1,s.dur,()=>{
    idx=turn.to;turn=null;
    riffleAt++;
    if(introOn&&riffleAt<riffle.length){paint();riffleStep();}
    else{endIntro();paint();}
  });
}
function startIntro(){
  const coarse=matchMedia('(max-width: 640px), (pointer: coarse)').matches;
  if(coarse||REDUCED||Q.has('nointro')){idx=LAND;paint();return;}
  const steps=M+LAND;
  riffle=[];
  for(let r=0;r<steps;r++){
    const bell=Math.sin(Math.PI*(r/(steps-1)));
    riffle.push({bell:bell,dur:0.26-0.19*bell});
  }
  riffleAt=0;introOn=true;wrap.classList.add('intro');
  riffleStep();
}

/* ------------------------------------------------------------- boot */
(async function boot(){
  idx=Q.has('shot')?(parseInt(Q.get('shot'),10)||0)%M:0;
  paint();applyView();
  await Promise.all(PAGES.map(p=>{
    const im=new Image();im.src=p.url;
    return im.decode?im.decode().catch(()=>{}):new Promise(r=>{im.onload=im.onerror=r});
  }));
  if(document.fonts&&document.fonts.ready)await document.fonts.ready.catch(()=>{});
  
  document.body.dataset.ready='1';
  if(Q.has('shot')){
    if(Q.has('t')){startTurn(Q.get('dir')||'next',parseFloat(Q.get('t')));}
    return;
  }
  // Keep the front cover closed until the reader opens it.
})();

})();
