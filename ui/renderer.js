/* ================================================================
   SHENDAL BROWSER v3 — Renderer
   ================================================================ */

// ── State ──────────────────────────────────────────────────────
const S = {
  tabs: [], activeTabId: null, autoHide: false,
  barVisible: { left:true, center:true, right:true },
  barTimers:  { left:null, center:null, right:null },
  barHover:   { left:false, center:false, right:false },
  activeSearchEngine: null, bookmarks: [],
  previewTimer: null, thumbs: new Map(),
  theme:'dark', windowMode:2, extPanelOpen:false,
};

const ENGINES = [
  { name:'YouTube', triggers:['you','youtube','yt'], searchUrl:'https://www.youtube.com/results?search_query=',
    favicon:'https://www.youtube.com/s/desktop/icon_144x144.png' },
  { name:'Twitch', triggers:['tw','twitch'], searchUrl:'https://www.twitch.tv/search?term=',
    favicon:'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c94346.png' },
];
const SEARCH = 'https://www.google.com/search?q=';
const FALLBACK = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2371717a" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>')}`;
let HOME_URL = '';

// ── DOM ────────────────────────────────────────────────────────
const $ = s => document.querySelector(s);
const bars = { left:$('#bar-left'), center:$('#bar-center'), right:$('#bar-right') };
const tabsEl=$('#tabs'), wvC=$('#webview-container'), sI=$('#search-input');
const sBadge=$('#search-engine-badge'), bIcon=$('#badge-icon'), bName=$('#badge-name'), bRem=$('#badge-remove');
const bBack=$('#btn-back'), bFwd=$('#btn-forward'), bRel=$('#btn-reload'), bNew=$('#btn-new-tab');
const bStar=$('#btn-star'), starIco=$('#star-icon'), bkEl=$('#bookmarks');
const bVoice=$('#btn-voice'), bAH=$('#btn-autohide'), bTheme=$('#btn-theme');
const iMoon=$('#icon-moon'), iSun=$('#icon-sun');
const bMin=$('#btn-minimize'), bResize=$('#btn-resize'), bQuit=$('#btn-quit');
const ldBar=$('#loading-bar'), tPrev=$('#tab-preview'), pvImg=$('#preview-img'), pvClose=$('#preview-close');
const bHome=$('#btn-home'), bExt=$('#btn-extensions'), extPanel=$('#ext-panel');
const extList=$('#ext-list'), extLoadBtn=$('#ext-load-btn'), extBtns=$('#ext-buttons');
const adblockTgl=$('#adblock-toggle'), clearBtn=$('#clear-data-btn');
const bPip=$('#btn-pip'), ctxOvl=$('#ctx-overlay');

// ================================================================
//  TABS
// ================================================================
let tabC=0;

function createTab(url, activate=true) {
  if (!url) url = HOME_URL;
  const id=`t${Date.now()}-${tabC++}`;
  const wv=document.createElement('webview');
  wv.id=`wv-${id}`; wv.src=url;
  wv.setAttribute('allowpopups',''); wv.setAttribute('autosize','on');
  wv.classList.add('hidden-tab');
  wvC.appendChild(wv);
  const tab={id,wv,title:'New Tab',favicon:null,url,loading:false,back:false,fwd:false};
  S.tabs.push(tab);

  wv.addEventListener('page-favicon-updated',e=>{if(e.favicons?.[0]){tab.favicon=e.favicons[0];renderTabs();}});
  wv.addEventListener('page-title-updated',e=>{tab.title=e.title;if(tab.id===S.activeTabId){updateStar();updatePip();}});
  wv.addEventListener('did-start-loading',()=>{tab.loading=true;if(tab.id===S.activeTabId)showLd();renderTabs();});
  wv.addEventListener('did-stop-loading',()=>{tab.loading=false;if(tab.id===S.activeTabId)hideLd();renderTabs();capThumb(tab);});
  wv.addEventListener('did-navigate',e=>{tab.url=e.url;syncNav(tab);if(tab.id===S.activeTabId){updatePip();if(sI!==document.activeElement)sI.value=tab.url;}});
  wv.addEventListener('did-navigate-in-page',e=>{tab.url=e.url;syncNav(tab);});
  wv.addEventListener('did-fail-load',()=>{tab.loading=false;if(tab.id===S.activeTabId)hideLd();renderTabs();});
  wv.addEventListener('new-window',e=>{e.preventDefault();createTab(e.url);});
  wv.addEventListener('permissionrequest',e=>{if(['media','fullscreen','geolocation'].includes(e.permission))e.request.allow();});
  wv.addEventListener('enter-html-full-screen',()=>{Object.values(bars).forEach(b=>b.style.zIndex='2147483647');tPrev.style.zIndex='2147483647';});
  wv.addEventListener('leave-html-full-screen',()=>{Object.values(bars).forEach(b=>b.style.zIndex='');tPrev.style.zIndex='';});
  // Close ctx on webview focus (user clicked inside)
  wv.addEventListener('focus',()=>closeCtx());

  if(activate)switchTab(id);
  renderTabs();
  return tab;
}

function closeTab(id){
  const i=S.tabs.findIndex(t=>t.id===id);if(i===-1)return;
  S.tabs[i].wv.remove();S.tabs.splice(i,1);S.thumbs.delete(id);
  if(S.activeTabId===id){if(!S.tabs.length){createTab();return;}switchTab(S.tabs[Math.min(i,S.tabs.length-1)].id);}
  renderTabs();
}

function switchTab(id){
  const prev=activeTab();if(prev&&prev.id!==id)capThumb(prev);
  S.tabs.forEach(t=>t.wv.classList.toggle('hidden-tab',t.id!==id));
  S.activeTabId=id;
  const tab=activeTab();
  if(tab){syncNav(tab);updateStar();updatePip();if(sI!==document.activeElement)sI.value=tab.url||'';}
  renderTabs();
}
function nextTab(){if(S.tabs.length<=1)return;const i=(S.tabs.findIndex(t=>t.id===S.activeTabId)+1)%S.tabs.length;switchTab(S.tabs[i].id);}
function prevTab(){if(S.tabs.length<=1)return;const i=(S.tabs.findIndex(t=>t.id===S.activeTabId)-1+S.tabs.length)%S.tabs.length;switchTab(S.tabs[i].id);}
function activeTab(){return S.tabs.find(t=>t.id===S.activeTabId)||null;}

// ── Render tabs ────────────────────────────────────────────────
function renderTabs(){
  tabsEl.innerHTML='';
  S.tabs.forEach(tab=>{
    const btn=document.createElement('button');
    btn.className=`tab-button${tab.id===S.activeTabId?' active':''}${tab.loading?' loading':''}`;
    if(tab.favicon){const img=document.createElement('img');img.className='tab-favicon';img.src=tab.favicon;img.draggable=false;img.onerror=()=>img.src=FALLBACK;btn.appendChild(img);
    }else{const d=document.createElement('div');d.className='tab-default-icon';d.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>';btn.appendChild(d);}
    btn.addEventListener('click',e=>{e.stopPropagation();switchTab(tab.id);hidePreview();});
    btn.addEventListener('mouseenter',()=>{clearTimeout(S.previewTimer);S.previewTimer=setTimeout(()=>showPreview(tab,btn),280);});
    btn.addEventListener('mouseleave',()=>{clearTimeout(S.previewTimer);S.previewTimer=setTimeout(()=>{if(!tPrev.matches(':hover'))hidePreview();},300);});
    tabsEl.appendChild(btn);
  });
}

// ── Tab Preview ────────────────────────────────────────────────
let pvTabId=null;
function showPreview(tab,anchor){
  const th=S.thumbs.get(tab.id);pvImg.src=th||FALLBACK;
  if(!th)capThumb(tab).then(()=>{const f=S.thumbs.get(tab.id);if(f&&pvTabId===tab.id)pvImg.src=f;});
  pvTabId=tab.id;
  const r=anchor.getBoundingClientRect(),pw=250;
  let left=r.left+r.width/2-pw/2;left=Math.max(6,Math.min(left,window.innerWidth-pw-6));
  tPrev.style.left=`${left}px`;tPrev.style.top=`${r.bottom+4}px`;tPrev.classList.add('visible');
}
function hidePreview(){tPrev.classList.remove('visible');pvTabId=null;}
tPrev.addEventListener('mouseleave',()=>{setTimeout(()=>{if(!document.querySelector('.tab-button:hover')&&!tPrev.matches(':hover'))hidePreview();},100);});
tPrev.addEventListener('click',e=>{if(pvClose.contains(e.target))return;if(pvTabId){switchTab(pvTabId);hidePreview();}});
pvClose.addEventListener('click',e=>{e.stopPropagation();if(pvTabId){closeTab(pvTabId);hidePreview();}});
async function capThumb(tab){try{if(!tab.wv?.getWebContentsId)return;const img=await tab.wv.capturePage();if(img&&!img.isEmpty())S.thumbs.set(tab.id,img.toDataURL());}catch{}}

// ================================================================
//  NAVIGATION
// ================================================================
function syncNav(tab){if(!tab)return;try{tab.back=tab.wv.canGoBack();tab.fwd=tab.wv.canGoForward();}catch{}if(tab.id===S.activeTabId){bBack.classList.toggle('disabled',!tab.back);bFwd.classList.toggle('disabled',!tab.fwd);}}
bBack.addEventListener('click',()=>{const t=activeTab();if(t?.back)t.wv.goBack();});
bFwd.addEventListener('click',()=>{const t=activeTab();if(t?.fwd)t.wv.goForward();});
bRel.addEventListener('click',()=>{const t=activeTab();if(t)t.loading?t.wv.stop():t.wv.reload();});
bNew.addEventListener('click',()=>createTab());
bHome.addEventListener('click',()=>{const t=activeTab();if(t)t.wv.loadURL(HOME_URL);});

// Loading
let ldP=0,ldR=null;
function showLd(){ldP=0;ldBar.classList.add('active');aLd();}
function hideLd(){ldP=100;ldBar.style.width='100%';setTimeout(()=>{ldBar.classList.remove('active');ldBar.style.width='0%';ldP=0;},300);if(ldR){cancelAnimationFrame(ldR);ldR=null;}}
function aLd(){if(ldP>=90)return;ldP+=(90-ldP)*.03;ldBar.style.width=`${ldP}%`;ldR=requestAnimationFrame(aLd);}

// ================================================================
//  SEARCH
// ================================================================
function isUrl(s){s=s.trim();return /^https?:\/\//i.test(s)||/^[\w-]+\.[\w.-]+(\/|$)/i.test(s)||s.includes('localhost');}
function navigate(input){
  const tab=activeTab();if(!tab)return;input=input.trim();if(!input)return;
  let url;
  if(S.activeSearchEngine){url=S.activeSearchEngine.searchUrl+encodeURIComponent(input);deactEngine();}
  else if(isUrl(input)){url=input.startsWith('http')?input:`https://${input}`;}
  else{url=SEARCH+encodeURIComponent(input);}
  tab.wv.loadURL(url);sI.blur();
}
sI.addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();navigate(sI.value);}
  if(e.key==='Escape'){e.preventDefault();sI.blur();deactEngine();const t=activeTab();if(t)sI.value=t.url||'';}
});
sI.addEventListener('input',()=>{
  if(S.activeSearchEngine)return;const v=sI.value,m=v.match(/^(\w+)[;:\s]$/);
  if(m){const kw=m[1].toLowerCase();const eng=ENGINES.find(s=>s.triggers.includes(kw));if(eng){actEngine(eng);sI.value='';}}
});
sI.addEventListener('focus',()=>{sI.select();if(S.autoHide)showBar('center');});
function actEngine(eng){S.activeSearchEngine=eng;bIcon.src=eng.favicon;bName.textContent=eng.name;sBadge.classList.remove('hidden');sI.placeholder=`Search ${eng.name}...`;sI.focus();}
function deactEngine(){S.activeSearchEngine=null;sBadge.classList.add('hidden');sI.placeholder='Search Google or enter URL';}
bRem.addEventListener('click',e=>{e.stopPropagation();deactEngine();sI.focus();});

// Voice
let recog=null;
function initVoice(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){bVoice.title='Voice search not available';return;}recog=new SR();recog.lang='es-419';recog.continuous=false;recog.interimResults=false;recog.onresult=ev=>{sI.value=ev.results[0][0].transcript;bVoice.classList.remove('listening');navigate(sI.value);};recog.onerror=()=>bVoice.classList.remove('listening');recog.onend=()=>bVoice.classList.remove('listening');}
bVoice.addEventListener('click',()=>{if(!recog){initVoice();if(!recog)return;}if(bVoice.classList.contains('listening')){recog.stop();bVoice.classList.remove('listening');}else{bVoice.classList.add('listening');if(S.autoHide)showBar('center');try{recog.start();}catch{bVoice.classList.remove('listening');}}});

// ================================================================
//  BOOKMARKS
// ================================================================
function loadBk(){try{S.bookmarks=JSON.parse(localStorage.getItem('sb-bk')||'[]');}catch{S.bookmarks=[];}}
function saveBk(){localStorage.setItem('sb-bk',JSON.stringify(S.bookmarks));}
function addBk(u,t,f){if(S.bookmarks.some(b=>b.url===u))return;S.bookmarks.push({url:u,title:t||u,favicon:f||null});saveBk();renderBk();updateStar();}
function removeBk(u){S.bookmarks=S.bookmarks.filter(b=>b.url!==u);saveBk();renderBk();updateStar();}
function isBk(u){return S.bookmarks.some(b=>b.url===u);}
function updateStar(){const t=activeTab();if(!t)return;const bk=isBk(t.url);bStar.classList.toggle('bookmarked',bk);starIco.querySelector('path').setAttribute('fill',bk?'var(--yellow)':'none');}
bStar.addEventListener('click',()=>{const t=activeTab();if(!t)return;isBk(t.url)?removeBk(t.url):addBk(t.url,t.title,t.favicon);});

function renderBk(){
  bkEl.innerHTML='';
  S.bookmarks.forEach(bk=>{
    const btn=document.createElement('button');btn.className='bookmark-btn';
    const img=document.createElement('img');img.src=bk.favicon||FALLBACK;img.draggable=false;img.onerror=()=>img.src=FALLBACK;btn.appendChild(img);
    const tip=document.createElement('div');tip.className='bk-tip';tip.textContent=bk.title||bk.url;btn.appendChild(tip);
    btn.addEventListener('click',()=>{const t=activeTab();if(t)t.wv.loadURL(bk.url);});
    btn.addEventListener('auxclick',e=>{if(e.button===1){e.preventDefault();createTab(bk.url);}});
    btn.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();showBkCtx(e.clientX,e.clientY,bk);});
    bkEl.appendChild(btn);
  });
}
function showBkCtx(x,y,bk){
  closeCtx();showOverlay();
  const d=document.createElement('div');d.className='ctx-menu';
  d.innerHTML=`<button class="ctx-item" data-act="open">${svgI('newtab')} Open in new tab</button><button class="ctx-item destructive" data-act="remove">${svgI('close')} Remove</button>`;
  d.querySelector('[data-act=open]').onclick=()=>{createTab(bk.url);closeCtx();};
  d.querySelector('[data-act=remove]').onclick=()=>{removeBk(bk.url);closeCtx();};
  d.style.left=`${x}px`;d.style.top=`${y}px`;document.body.appendChild(d);
}

// ================================================================
//  CONTEXT MENU
// ================================================================
window.browserAPI.onShowContextMenu(data=>{
  closeCtx();showOverlay();
  const m=document.createElement('div');m.className='ctx-menu';
  let h='';
  if(data.linkURL){h+=ctxB('newtab',svgI('newtab'),'Open in new tab');h+=ctxB('bgtab',svgI('bgtab'),'Open in background tab');h+='<div class="ctx-sep"></div>';}
  h+=ctxB('back',svgI('back'),'Back');h+=ctxB('reload',svgI('reload'),'Reload');h+=ctxB('forward',svgI('forward'),'Forward');h+='<div class="ctx-sep"></div>';h+=ctxB('save',svgI('save'),'Save as…');
  m.innerHTML=h;
  m.addEventListener('click',e=>{const b=e.target.closest('.ctx-item');if(!b)return;const t=activeTab(),a=b.dataset.act;
    if(a==='newtab'&&data.linkURL)createTab(data.linkURL);
    else if(a==='bgtab'&&data.linkURL)createTab(data.linkURL,false);
    else if(a==='back'&&t?.back)t.wv.goBack();
    else if(a==='reload'&&t)t.wv.reload();
    else if(a==='forward'&&t?.fwd)t.wv.goForward();
    else if(a==='save'&&t){try{window.browserAPI.savePage(t.wv.getWebContentsId());}catch{}}
    closeCtx();
  });
  let x=data.x,y=data.y;document.body.appendChild(m);
  const r=m.getBoundingClientRect();
  if(x+r.width>window.innerWidth)x=window.innerWidth-r.width-8;
  if(y+r.height>window.innerHeight)y=window.innerHeight-r.height-8;
  m.style.left=`${Math.max(4,x)}px`;m.style.top=`${Math.max(4,y)}px`;
});

function showOverlay(){ctxOvl.classList.remove('hidden');}
function closeCtx(){ctxOvl.classList.add('hidden');document.querySelectorAll('.ctx-menu').forEach(el=>el.remove());}
ctxOvl.addEventListener('mousedown',e=>{e.stopPropagation();closeCtx();});

function ctxB(a,i,l){return `<button class="ctx-item" data-act="${a}">${i} ${l}</button>`;}
function svgI(n){const i={
  newtab:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 3V2a1 1 0 011-1h8a1 1 0 011 1v8a1 1 0 01-1 1h-1" stroke="currentColor" stroke-width="1.3"/></svg>',
  bgtab:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.3"/><rect x="5" y="1" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2 2"/></svg>',
  back:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  forward:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reload:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13.5 8A5.5 5.5 0 1 1 8 2.5M13.5 2.5v3h-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  save:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 14h10a1 1 0 001-1V5l-3-3H4a1 1 0 00-1 1v10a1 1 0 001 1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5 14v-4h6v4M5 2v3h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};return i[n]||'';}

// ================================================================
//  3-BAR AUTO-HIDE (FIXED)
// ================================================================
function toggleAH(){
  S.autoHide=!S.autoHide;bAH.classList.toggle('active',S.autoHide);
  if(S.autoHide){setTimeout(()=>['left','center','right'].forEach(hideBar),500);}
  else{['left','center','right'].forEach(showBar);}
  localStorage.setItem('sb-ah',S.autoHide?'1':'0');
}
function showBar(n){clearTimeout(S.barTimers[n]);bars[n].classList.remove('bar-hidden');S.barVisible[n]=true;}
function hideBar(n){
  if(!S.autoHide)return;
  if(n==='center'&&(sI===document.activeElement||bVoice.classList.contains('listening')))return;
  if(S.barHover[n])return; // Don't hide if mouse is on the bar
  clearTimeout(S.barTimers[n]);S.barVisible[n]=false;bars[n].classList.add('bar-hidden');
  if(n==='center')hidePreview();
}
function schedHide(n){
  if(S.barHover[n])return; // Don't schedule if hovering
  clearTimeout(S.barTimers[n]);S.barTimers[n]=setTimeout(()=>hideBar(n),500);
}
['left','center','right'].forEach(n=>{
  bars[n].addEventListener('mouseenter',()=>{S.barHover[n]=true;clearTimeout(S.barTimers[n]);});
  bars[n].addEventListener('mouseleave',()=>{S.barHover[n]=false;if(S.autoHide)schedHide(n);});
});
bAH.addEventListener('click',toggleAH);

// Cursor tracking — FIXED: only trigger show, let mouseleave handle hide
window.browserAPI.onCursorPosition(pos=>{
  if(!S.autoHide)return;
  const tH=8,zL=pos.winWidth*.22,zR=pos.winWidth*.78;
  if(pos.y<=tH){
    if(pos.x<=zL){if(!S.barVisible.left)showBar('left');}
    else if(pos.x>=zR){if(!S.barVisible.right)showBar('right');}
    else{if(!S.barVisible.center)showBar('center');}
  }
  // Only schedule hide if cursor is far below bars AND not hovering
  if(pos.y>60){
    ['left','center','right'].forEach(n=>{
      if(S.barVisible[n]&&!S.barHover[n])schedHide(n);
    });
  }
});

// ================================================================
//  THEME
// ================================================================
function setTheme(t){S.theme=t;document.body.classList.toggle('light',t==='light');iMoon.classList.toggle('hidden',t==='light');iSun.classList.toggle('hidden',t==='dark');localStorage.setItem('sb-theme',t);window.browserAPI.setThemeIcon(t);}
bTheme.addEventListener('click',()=>setTheme(S.theme==='dark'?'light':'dark'));

// ================================================================
//  WINDOW CONTROLS
// ================================================================
bMin.addEventListener('click',()=>window.browserAPI.minimize());
bResize.addEventListener('click',async()=>{S.windowMode=await window.browserAPI.cycleMode();updateResizeIcon();});
bQuit.addEventListener('click',()=>window.browserAPI.close());
window.browserAPI.onModeChanged(m=>{S.windowMode=m;updateResizeIcon();});

function updateResizeIcon(){
  const el=$('#icon-resize');
  if(S.windowMode===0)el.innerHTML='<rect x="2.5" y="2.5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/>';
  else if(S.windowMode===1)el.innerHTML='<rect x="1.5" y="3.5" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="4.5" y="1.5" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.3"/>';
  else el.innerHTML='<rect x="2" y="2" width="10" height="10" rx="1.5" fill="currentColor" opacity="0.3" stroke="currentColor" stroke-width="1.3"/>';
}

// ================================================================
//  EXTENSIONS
// ================================================================
bExt.addEventListener('click',e=>{e.stopPropagation();S.extPanelOpen=!S.extPanelOpen;extPanel.classList.toggle('hidden',!S.extPanelOpen);if(S.extPanelOpen)refreshExts();});
document.addEventListener('click',e=>{if(S.extPanelOpen&&!extPanel.contains(e.target)&&!bExt.contains(e.target)){S.extPanelOpen=false;extPanel.classList.add('hidden');}});
extLoadBtn.addEventListener('click',async()=>{const ext=await window.browserAPI.extLoadFolder();if(ext)refreshExts();});
clearBtn.addEventListener('click',async()=>{await window.browserAPI.clearData();clearBtn.textContent='Done!';setTimeout(()=>clearBtn.textContent='Clear browsing data',1500);});
adblockTgl.addEventListener('change',()=>window.browserAPI.adblockToggle(adblockTgl.checked));

async function refreshExts(){
  const exts=await window.browserAPI.extGetAll();
  extList.innerHTML='';extBtns.innerHTML='';
  exts.forEach(ext=>{
    // List item
    const item=document.createElement('div');item.className='ext-item';
    item.innerHTML=`<img src="${ext.icon||FALLBACK}" onerror="this.src='${FALLBACK}'"><span>${ext.name}</span><button title="Remove">×</button>`;
    item.querySelector('button').onclick=async()=>{await window.browserAPI.extRemove(ext.id);refreshExts();};
    extList.appendChild(item);
    // Navbar button
    if(ext.hasPopup){
      const btn=document.createElement('button');btn.className='ext-nav-btn';
      const img=document.createElement('img');img.src=ext.icon||FALLBACK;img.onerror=()=>img.src=FALLBACK;btn.appendChild(img);
      const tip=document.createElement('div');tip.className='bk-tip';tip.textContent=ext.name;btn.appendChild(tip);
      btn.addEventListener('click',()=>window.browserAPI.extOpenPopup(ext.id));
      extBtns.appendChild(btn);
    }
  });
  // Adblock status
  const ab=await window.browserAPI.adblockStatus();adblockTgl.checked=ab;
}

// ================================================================
//  PiP (YouTube)
// ================================================================
function updatePip(){
  const t=activeTab();
  const show=t&&t.url&&(t.url.includes('youtube.com/watch')||t.url.includes('youtu.be/'));
  bPip.classList.toggle('hidden',!show);
}
bPip.addEventListener('click',async()=>{const t=activeTab();if(t){try{await window.browserAPI.pip(t.wv.getWebContentsId());}catch{}}});

// ================================================================
//  SESSION PERSISTENCE
// ================================================================
async function saveSession(){
  const data={tabs:S.tabs.map(t=>({url:t.url,title:t.title,favicon:t.favicon})),activeIndex:S.tabs.findIndex(t=>t.id===S.activeTabId)};
  await window.browserAPI.saveSession(data);
}
window.browserAPI.onSaveAndQuit(async()=>{await saveSession();await window.browserAPI.savedQuit();});
// Auto-save every 30s
setInterval(saveSession,30000);

// ================================================================
//  KEYBOARD SHORTCUTS
// ================================================================
window.browserAPI.onShortcut(a=>{
  switch(a){
    case 'next-tab':nextTab();break;
    case 'prev-tab':prevTab();break;
    case 'new-tab':createTab();break;
    case 'close-tab':if(S.activeTabId)closeTab(S.activeTabId);break;
    case 'focus-search':showBar('center');sI.focus();sI.select();break;
    case 'quick-search':showBar('center');sI.value='';sI.focus();break;
    case 'toggle-autohide':toggleAH();break;
  }
});
document.addEventListener('keydown',e=>{
  if(e.ctrlKey&&!e.shiftKey&&e.key==='t'){e.preventDefault();createTab();}
  if(e.ctrlKey&&!e.shiftKey&&e.key==='w'){e.preventDefault();if(S.activeTabId)closeTab(S.activeTabId);}
  if(e.ctrlKey&&!e.shiftKey&&e.key==='l'){e.preventDefault();showBar('center');sI.focus();sI.select();}
  if(e.ctrlKey&&!e.shiftKey&&e.key==='Tab'){e.preventDefault();showBar('center');sI.value='';sI.focus();}
  if(e.ctrlKey&&e.shiftKey&&(e.key==='H'||e.key==='h')){e.preventDefault();toggleAH();}
});
window.browserAPI.onOpenUrlNewTab(url=>createTab(url));

// ================================================================
//  INIT
// ================================================================
async function init(){
  // Get paths
  const paths=await window.browserAPI.getPaths();
  const uiDir=window.location.href.substring(0,window.location.href.lastIndexOf('/'));
  HOME_URL=`${uiDir}/home.html`;

  loadBk();renderBk();

  // Restore theme
  const savedTheme=localStorage.getItem('sb-theme');
  if(savedTheme==='light')setTheme('light');

  // Restore auto-hide
  if(localStorage.getItem('sb-ah')==='1'){S.autoHide=true;bAH.classList.add('active');setTimeout(()=>['left','center','right'].forEach(hideBar),1200);}

  // Restore window mode
  S.windowMode=await window.browserAPI.getMode();updateResizeIcon();

  initVoice();

  // Load session or open home
  const sess=await window.browserAPI.loadSession();
  if(sess&&sess.tabs&&sess.tabs.length){
    sess.tabs.forEach((t,i)=>createTab(t.url,i===(sess.activeIndex??0)));
  }else{
    createTab(HOME_URL);
  }

  // Load extensions
  refreshExts();
}
init();
