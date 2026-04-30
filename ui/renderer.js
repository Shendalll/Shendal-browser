/* ================================================================
   SHENDAL BROWSER v3 — Renderer
   ================================================================ */

// ── State ──────────────────────────────────────────────────────
const S = {
  tabs: [], activeTabId: null, autoHide: false,
  barVisible: { left:true, center:true, right:true, drag:true },
  barTimers:  { left:null, center:null, right:null, drag:null },
  barHover:   { left:false, center:false, right:false, drag:false },
  activeSearchEngine: null, bookmarks: [],
  previewTimer: null, thumbs: new Map(),
  theme:'dark', windowMode:2, extPanelOpen:false,
  downloads: [], downloadsPanelTimer: null,
  extPanelTimer: null, pinnedTabId: null,
  isPickerOpen: false, isResizing: false
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
const bars = { left:$('#bar-left'), center:$('#bar-center'), right:$('#bar-right'), drag:$('#bar-drag') };
const tabsEl=$('#tabs'), wvC=$('#webview-container'), sI=$('#search-input');
const sBadge=$('#search-engine-badge'), bIcon=$('#badge-icon'), bName=$('#badge-name'), bRem=$('#badge-remove');
const bBack=$('#btn-back'), bFwd=$('#btn-forward'), bRel=$('#btn-reload'), bNew=$('#btn-new-tab');
const bStar=$('#btn-star'), starIco=$('#star-icon'), bkEl=$('#bookmarks');
const bVoice=$('#btn-voice'), bAH=$('#btn-autohide'), bTheme=$('#btn-theme');
const iMoon=$('#icon-moon'), iSun=$('#icon-sun');
const bMin=$('#btn-minimize'), bResize=$('#btn-resize'), bQuit=$('#btn-quit');
const ldBar=$('#loading-bar'), tPrev=$('#tab-preview');
const bExt=$('#btn-extensions'), extPanel=$('#ext-panel');
const extList=$('#ext-list'), extLoadBtn=$('#ext-load-btn'), extBtns=$('#ext-buttons');
const adblockTgl=$('#adblock-toggle'), clearBtn=$('#clear-data-btn');
const bPip=$('#btn-pip'), ctxOvl=$('#ctx-overlay');
const bSplit=$('#btn-split'), splitResizer=$('#split-resizer'), splitPicker=$('#split-picker'), spGrid=$('#sp-grid'), spClose=$('#sp-close');

function updateSplitLayout() {
  const t = activeTab();
  
  S.tabs.forEach(tab => {
    tab.wv.classList.add('hidden-tab');
    if(tab.splitWith) tab.splitWith.wv.classList.add('hidden-tab');
  });

  const pinned = S.tabs.find(x => x.id === S.pinnedTabId);

  if (S.isPickerOpen) {
    splitPicker.style.width = `50%`;
    splitPicker.style.left = `50%`;
    splitPicker.classList.remove('hidden');
    splitResizer.classList.remove('hidden');
    splitResizer.style.left = `50%`;
    
    if (t) {
      t.wv.classList.remove('hidden-tab');
      t.wv.style.width = `50%`;
      t.wv.style.left = '0';
    }
  } else if (pinned && t && t.id !== pinned.id) {
    // GLOBAL PINNED MODE (Star button)
    splitPicker.classList.add('hidden');
    splitResizer.classList.remove('hidden');
    const ratio = t.splitRatio || 50;
    splitResizer.style.left = `${ratio}%`;
    
    t.wv.classList.remove('hidden-tab');
    t.wv.style.width = `${ratio}%`;
    t.wv.style.left = '0';
    
    pinned.wv.classList.remove('hidden-tab');
    pinned.wv.style.width = `${100 - ratio}%`;
    pinned.wv.style.left = `${ratio}%`;
  } else if (t && t.splitWith) {
    // PER-TAB SPLIT MODE (Split button)
    splitPicker.classList.add('hidden');
    splitResizer.classList.remove('hidden');
    splitResizer.style.left = `${t.splitRatio}%`;
    
    t.wv.classList.remove('hidden-tab');
    t.wv.style.width = `${t.splitRatio}%`;
    t.wv.style.left = '0';
    
    t.splitWith.wv.classList.remove('hidden-tab');
    t.splitWith.wv.style.width = `${100 - t.splitRatio}%`;
    t.splitWith.wv.style.left = `${t.splitRatio}%`;
  } else {
    splitPicker.classList.add('hidden');
    splitResizer.classList.add('hidden');
    if (t) {
      t.wv.classList.remove('hidden-tab');
      t.wv.style.width = '100%';
      t.wv.style.left = '0';
    }
  }
}

// ================================================================
//  TABS
// ================================================================
let tabC=0;

function createTab(url, activate=true) {
  if (!url) url = `${HOME_URL}?theme=${S.theme}`;
  const id=`t${Date.now()}-${tabC++}`;
  const wv=document.createElement('webview');
  wv.id=`wv-${id}`; wv.src=url;
  wv.setAttribute('allowpopups',''); wv.setAttribute('autosize','on');
  wv.classList.add('hidden-tab');
  wvC.appendChild(wv);
  const tab={id,wv,title:'New Tab',favicon:null,url,loading:false,back:false,fwd:false,splitWith:null,splitRatio:50,activePane:'left'};
  S.tabs.push(tab);

  wv.addEventListener('page-favicon-updated',e=>{if(e.favicons?.[0]){tab.favicon=e.favicons[0];renderTabs();}});
  wv.addEventListener('page-title-updated',e=>{tab.title=e.title;if(activePane()?.id===tab.id){updateStar();updatePip();}});
  wv.addEventListener('did-start-loading',()=>{tab.loading=true;if(activePane()?.id===tab.id)showLd();renderTabs();});
  wv.addEventListener('did-stop-loading',()=>{tab.loading=false;if(activePane()?.id===tab.id)hideLd();renderTabs();capThumb(tab);});
  wv.addEventListener('did-navigate',e=>{tab.url=e.url;syncNav(tab);if(activePane()?.id===tab.id){updatePip();if(sI!==document.activeElement)sI.value=formatUrlDisplay(tab.url);}});
  wv.addEventListener('did-navigate-in-page',e=>{tab.url=e.url;syncNav(tab);});
  wv.addEventListener('did-fail-load',()=>{tab.loading=false;if(activePane()?.id===tab.id)hideLd();renderTabs();});
  wv.addEventListener('new-window',e=>{e.preventDefault();createTab(e.url);});
  wv.addEventListener('permissionrequest',e=>{if(['media','fullscreen','geolocation'].includes(e.permission))e.request.allow();});
  wv.addEventListener('enter-html-full-screen',()=>{Object.values(bars).forEach(b=>b.style.zIndex='2147483647');tPrev.style.zIndex='2147483647';});
  wv.addEventListener('leave-html-full-screen',()=>{Object.values(bars).forEach(b=>b.style.zIndex='');tPrev.style.zIndex='';});
  wv.addEventListener('focus',()=>{
    const p = S.tabs.find(x => x.id === tab.id || x.splitWith?.id === tab.id);
    if(p) {
      p.activePane = (p.splitWith?.id === tab.id) ? 'right' : 'left';
      syncNav(activePane());
      if(sI!==document.activeElement)sI.value=formatUrlDisplay(activePane()?.url);
      updateStar();
    }
    closeCtx();
  });

  if(activate)switchTab(id);
  renderTabs();
  return tab;
}

function closeTab(id){
  let pIdx = S.tabs.findIndex(t=>t.id===id);
  if(pIdx !== -1) {
    const t = S.tabs[pIdx];
    t.wv.remove(); S.thumbs.delete(t.id);
    if(t.splitWith) {
      const newMain = t.splitWith;
      newMain.splitWith = null;
      newMain.activePane = 'left';
      S.tabs[pIdx] = newMain;
      if(S.activeTabId === id) {
        S.activeTabId = newMain.id;
        updateSplitLayout(); renderTabs();
        syncNav(activePane());
        if(sI!==document.activeElement)sI.value=formatUrlDisplay(activePane()?.url);
        updateStar();
      } else {
        renderTabs(); updateSplitLayout();
      }
      return;
    }
    S.tabs.splice(pIdx,1);
    if(S.activeTabId===id){if(!S.tabs.length){createTab();return;}switchTab(S.tabs[Math.min(pIdx,S.tabs.length-1)].id);}
    else { renderTabs(); updateSplitLayout(); }
    return;
  }
  for(let j=0; j<S.tabs.length; j++) {
    const p = S.tabs[j];
    if(p.splitWith && p.splitWith.id === id) {
      p.splitWith.wv.remove(); S.thumbs.delete(id);
      p.splitWith = null;
      if(p.activePane === 'right') p.activePane = 'left';
      renderTabs(); updateSplitLayout();
      if (S.activeTabId === p.id) {
        syncNav(activePane());
        if(sI!==document.activeElement)sI.value=formatUrlDisplay(activePane()?.url);
        updateStar();
      }
      return;
    }
  }
}

function switchTab(id){
  const prev=activePane();if(prev)capThumb(prev);
  S.activeTabId=id;
  updateSplitLayout();
  const p=activePane();
  if(p){syncNav(p);updateStar();updatePip();if(sI!==document.activeElement)sI.value=formatUrlDisplay(p.url);}
  renderTabs();
}
function nextTab(){if(S.tabs.length<=1)return;const i=(S.tabs.findIndex(t=>t.id===S.activeTabId)+1)%S.tabs.length;switchTab(S.tabs[i].id);}
function prevTab(){if(S.tabs.length<=1)return;const i=(S.tabs.findIndex(t=>t.id===S.activeTabId)-1+S.tabs.length)%S.tabs.length;switchTab(S.tabs[i].id);}
function activeTab(){return S.tabs.find(t=>t.id===S.activeTabId)||null;}
function activePane(){
  const t = activeTab();
  if(!t) return null;
  if(t.splitWith && t.activePane === 'right') return t.splitWith;
  return t;
}

// ── Render tabs ────────────────────────────────────────────────
function renderTabs(){
  tabsEl.innerHTML='';
  S.tabs.forEach(tab=>{
    const btn=document.createElement('button');
    btn.className=`tab-button${tab.id===S.activeTabId?' active':''}${tab.loading||tab.splitWith?.loading?' loading':''}`;
    const pinned = S.tabs.find(x => x.id === S.pinnedTabId);
    if (tab.splitWith || (pinned && tab.id !== pinned.id)) {
      btn.classList.add('tab-split');
      const getImg = (t) => {
        const img = document.createElement('img');
        img.className = 'tab-favicon';
        img.draggable = false;
        if(t.favicon){ img.src=t.favicon; img.onerror=()=>img.src=FALLBACK; }
        else { img.src=FALLBACK; }
        return img;
      };
      const sideTab = tab.splitWith || pinned;
      btn.appendChild(getImg(tab));
      btn.appendChild(getImg(sideTab));
    } else {
      if(tab.favicon){const img=document.createElement('img');img.className='tab-favicon';img.src=tab.favicon;img.draggable=false;img.onerror=()=>img.src=FALLBACK;btn.appendChild(img);
      }else{const d=document.createElement('div');d.className='tab-default-icon';d.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>';btn.appendChild(d);}
    }
    btn.addEventListener('click',e=>{e.stopPropagation();switchTab(tab.id);hidePreview();});
    btn.addEventListener('mouseenter',()=>{clearTimeout(S.previewTimer);S.previewTimer=setTimeout(()=>showPreview(tab,btn),280);});
    btn.addEventListener('mouseleave',()=>{clearTimeout(S.previewTimer);S.previewTimer=setTimeout(()=>{if(!tPrev.matches(':hover'))hidePreview();},300);});
    tabsEl.appendChild(btn);
  });
}

// ── Tab Preview ────────────────────────────────────────────────
let pvTabId=null;
async function showPreview(tab,anchor){
  pvTabId=tab.id;
  tPrev.innerHTML = '';
  
  const createPane = async (t) => {
    const p = document.createElement('div');
    p.className = 'preview-pane';
    const img = document.createElement('img');
    img.src = S.thumbs.get(t.id) || FALLBACK;
    const btn = document.createElement('button');
    btn.className = 'preview-close-btn';
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    btn.onclick = (e) => { e.stopPropagation(); closeTab(t.id); hidePreview(); };
    p.onclick = (e) => { if(!btn.contains(e.target)) { switchTab(tab.id); hidePreview(); } };
    p.appendChild(img);
    p.appendChild(btn);
    tPrev.appendChild(p);
    
    if(!S.thumbs.get(t.id)) {
      await capThumb(t);
      if(pvTabId === tab.id) img.src = S.thumbs.get(t.id) || FALLBACK;
    }
  };
  
  createPane(tab);
  if(tab.splitWith) createPane(tab.splitWith);
  
  const r=anchor.getBoundingClientRect(),pw=tab.splitWith ? 512 : 250;
  let left=r.left+r.width/2-pw/2;left=Math.max(6,Math.min(left,window.innerWidth-pw-6));
  tPrev.style.left=`${left}px`;tPrev.style.top=`${r.bottom+4}px`;tPrev.classList.add('visible');
}
function hidePreview(){tPrev.classList.remove('visible');pvTabId=null;}
tPrev.addEventListener('mouseleave',()=>{setTimeout(()=>{if(!document.querySelector('.tab-button:hover')&&!tPrev.matches(':hover'))hidePreview();},100);});

async function capThumb(tab){try{if(!tab.wv?.getWebContentsId)return;const img=await tab.wv.capturePage();if(img&&!img.isEmpty())S.thumbs.set(tab.id,img.toDataURL());}catch{}}

function formatUrlDisplay(url) {
  if(!url) return '';
  let s = url;
  if(s.startsWith('https://www.')) s=s.substring(12);
  else if(s.startsWith('https://')) s=s.substring(8);
  else if(s.startsWith('http://www.')) s=s.substring(11);
  else if(s.startsWith('http://')) s=s.substring(7);
  if(s.endsWith('/')) s=s.substring(0, s.length-1);
  return s;
}

// ================================================================
//  NAVIGATION
// ================================================================
function syncNav(tab){if(!tab)return;try{tab.back=tab.wv.canGoBack();tab.fwd=tab.wv.canGoForward();}catch{}if(activePane()?.id===tab.id){bBack.classList.toggle('disabled',!tab.back);bFwd.classList.toggle('disabled',!tab.fwd);}}
bBack.addEventListener('click',()=>{const t=activePane();if(t?.back)t.wv.goBack();});
bFwd.addEventListener('click',()=>{const t=activePane();if(t?.fwd)t.wv.goForward();});
bRel.addEventListener('click',()=>{const t=activePane();if(t)t.loading?t.wv.stop():t.wv.reload();});
bNew.addEventListener('click',()=>createTab());

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
  const tab=activePane();if(!tab)return;input=input.trim();if(!input)return;
  let url;
  if(S.activeSearchEngine){url=S.activeSearchEngine.searchUrl+encodeURIComponent(input);deactEngine();}
  else if(isUrl(input)){url=input.startsWith('http')?input:`https://${input}`;}
  else{url=SEARCH+encodeURIComponent(input);}
  tab.wv.loadURL(url);sI.blur();
}
sI.addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();navigate(sI.value);}
  if(e.key==='Escape'){e.preventDefault();sI.blur();deactEngine();const t=activePane();if(t)sI.value=formatUrlDisplay(t.url);}
});
sI.addEventListener('input',()=>{
  if(S.activeSearchEngine)return;const v=sI.value,m=v.match(/^(\w+)[;:\s]$/);
  if(m){const kw=m[1].toLowerCase();const eng=ENGINES.find(s=>s.triggers.includes(kw));if(eng){actEngine(eng);sI.value='';}}
});
sI.addEventListener('focus',()=>{
  sI.value = activePane()?.url || '';
  sI.select();
  if(S.autoHide)showBar('center');
});
sI.addEventListener('blur',()=>{
  if(!S.activeSearchEngine) sI.value = formatUrlDisplay(activePane()?.url);
});
function actEngine(eng){S.activeSearchEngine=eng;bIcon.src=eng.favicon;bName.textContent=eng.name;sBadge.classList.remove('hidden');sI.placeholder=`Search ${eng.name}...`;sI.focus();}
function deactEngine(){S.activeSearchEngine=null;sBadge.classList.add('hidden');sI.placeholder='Search Google or enter URL';}
bRem.addEventListener('click',e=>{e.stopPropagation();deactEngine();sI.focus();});

// Voice
let recog=null;
function initVoice(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){bVoice.title='Voice search not available';return;}recog=new SR();recog.lang='es-419';recog.continuous=false;recog.interimResults=false;recog.onresult=ev=>{sI.value=ev.results[0][0].transcript;bVoice.classList.remove('listening');navigate(sI.value);};recog.onerror=()=>bVoice.classList.remove('listening');recog.onend=()=>bVoice.classList.remove('listening');}
bVoice.addEventListener('click',()=>{if(!recog){initVoice();if(!recog)return;}if(bVoice.classList.contains('listening')){recog.stop();bVoice.classList.remove('listening');}else{bVoice.classList.add('listening');if(S.autoHide)showBar('center');try{recog.start();}catch{bVoice.classList.remove('listening');}}});

// ================================================================
//  BOOKMARKS & UTILS
// ================================================================
function loadBk(){try{S.bookmarks=JSON.parse(localStorage.getItem('sb-bk')||'[]');}catch{S.bookmarks=[];}}
function saveBk(){localStorage.setItem('sb-bk',JSON.stringify(S.bookmarks));}
function addBk(u,t,f){if(S.bookmarks.some(b=>b.url===u))return;S.bookmarks.push({url:u,title:t||u,favicon:f||null});saveBk();renderBk();}
function removeBk(u){S.bookmarks=S.bookmarks.filter(b=>b.url!==u);saveBk();renderBk();}
function isBk(u){return S.bookmarks.some(b=>b.url===u);}

// Repurposed Star Button -> Global Pinned Tab
function updateStar(){
  const t = activeTab();
  if(!t)return;
  const isPinned = (S.pinnedTabId === t.id);
  bStar.classList.toggle('bookmarked', isPinned);
  starIco.querySelector('path').setAttribute('fill', isPinned ? 'var(--accent)' : 'none');
  bStar.title = isPinned ? 'Unpin this tab' : 'Pin this tab to side (Global)';
}
bStar.addEventListener('click', () => {
  const t = activeTab();
  if (!t) return;
  if (S.pinnedTabId === t.id) {
    S.pinnedTabId = null;
  } else {
    S.pinnedTabId = t.id;
    // Clean up if it was a child split
    S.tabs.forEach(x => { if(x.splitWith?.id === t.id) x.splitWith = null; });
    
    // Switch to another tab so we can see the pinned one on the right
    const other = S.tabs.find(x => x.id !== t.id);
    if (other) switchTab(other.id);
    else createTab(); // If no other tab, create one (like a search page)
  }
  updateSplitLayout();
  renderTabs();
  updateStar();
});

function renderBk(){
  bkEl.innerHTML='';
  bkEl.style.display = S.bookmarks.length ? 'flex' : 'none';
  S.bookmarks.forEach(bk=>{
    const btn=document.createElement('button');btn.className='bookmark-btn';
    const img=document.createElement('img');img.src=bk.favicon||FALLBACK;img.draggable=false;img.onerror=()=>img.src=FALLBACK;btn.appendChild(img);
    const tip=document.createElement('div');tip.className='bk-tip';tip.textContent=bk.title||bk.url;btn.appendChild(tip);
    btn.addEventListener('click',()=>{const t=activePane();if(t)t.wv.loadURL(bk.url);});
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
  h+=ctxB('back',svgI('back'),'Back');h+=ctxB('reload',svgI('reload'),'Reload');h+=ctxB('forward',svgI('forward'),'Forward');h+='<div class="ctx-sep"></div>';
  if(!isBk(data.pageURL)) h+=ctxB('add-bk',svgI('star'),'Add to bookmarks');
  else h+=ctxB('remove-bk',svgI('close'),'Remove bookmark');
  h+='<div class="ctx-sep"></div>';h+=ctxB('save',svgI('save'),'Save as…');
  m.innerHTML=h;
  m.addEventListener('click',e=>{const b=e.target.closest('.ctx-item');if(!b)return;const t=activePane(),a=b.dataset.act;
    if(a==='newtab'&&data.linkURL)createTab(data.linkURL);
    else if(a==='bgtab'&&data.linkURL)createTab(data.linkURL,false);
    else if(a==='back'&&t?.back)t.wv.goBack();
    else if(a==='forward'&&t?.fwd)t.wv.goForward();
    else if(a==='add-bk'&&t)addBk(t.url,t.title,t.favicon);
    else if(a==='remove-bk'&&t)removeBk(t.url);
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
  star:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l1.85 3.75L14 5.85l-3 2.92.71 4.13L8 10.88 4.29 12.9 5 8.77 2 5.85l4.15-.6L8 1.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
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

// Cursor tracking — Optimized (100ms in main.js)
window.browserAPI.onCursorPosition(pos=>{
  if(!S.autoHide)return;
  const tH=25,zL=pos.winWidth*.22,zR=pos.winWidth*.78;
  if(pos.y<=tH){
    if(pos.x<=zL){if(!S.barVisible.left)showBar('left');}
    else if(pos.x>=zR){if(!S.barVisible.right)showBar('right');}
    else{if(!S.barVisible.center)showBar('center');}
  }
  if(pos.y>80){
    ['left','center','right'].forEach(n=>{
      if(S.barVisible[n]&&!S.barHover[n])schedHide(n);
    });
  }
});

// ================================================================
//  THEME
// ================================================================
function setTheme(t){
  S.theme=t;
  document.body.classList.toggle('light',t==='light');
  iMoon.classList.toggle('hidden',t==='light');
  iSun.classList.toggle('hidden',t==='dark');
  localStorage.setItem('sb-theme',t);
  window.browserAPI.setThemeIcon(t);
  
  // Update theme on all home tabs
  S.tabs.forEach(tab => {
    if (tab.url && tab.url.includes('home.html')) {
      try {
        tab.wv.executeJavaScript(`document.body.classList.toggle('light', ${t==='light'})`);
      } catch {}
    }
  });
}
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
  bars.drag.classList.toggle('hidden', S.windowMode !== 0);
  if(S.windowMode===0)el.innerHTML='<rect x="2.5" y="2.5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/>';
  else if(S.windowMode===1)el.innerHTML='<rect x="1.5" y="3.5" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="4.5" y="1.5" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.3"/>';
  else el.innerHTML='<rect x="2" y="2" width="10" height="10" rx="1.5" fill="currentColor" opacity="0.3" stroke="currentColor" stroke-width="1.3"/>';
}

// ================================================================
//  EXTENSIONS
// ================================================================
bExt.addEventListener('mouseenter', () => {
  clearTimeout(S.extPanelTimer);
  const r = bExt.getBoundingClientRect();
  extPanel.style.top = `${r.bottom + 6}px`;
  extPanel.style.left = `${r.left - 280 + r.width/2}px`;
  extPanel.classList.remove('hidden');
  S.extPanelOpen = true;
  refreshExts();
});

bExt.addEventListener('mouseleave', () => {
  S.extPanelTimer = setTimeout(() => { extPanel.classList.add('hidden'); S.extPanelOpen = false; }, 300);
});

extPanel.addEventListener('mouseenter', () => clearTimeout(S.extPanelTimer));
extPanel.addEventListener('mouseleave', () => {
  S.extPanelTimer = setTimeout(() => { extPanel.classList.add('hidden'); S.extPanelOpen = false; }, 300);
});


extLoadBtn.addEventListener('click',async()=>{const ext=await window.browserAPI.extLoadFolder();if(ext)refreshExts();});
clearBtn.addEventListener('click',async()=>{await window.browserAPI.clearData();clearBtn.textContent='Done!';setTimeout(()=>clearBtn.textContent='Clear browsing data',1500);});
adblockTgl.addEventListener('change',()=>window.browserAPI.adblockToggle(adblockTgl.checked));

async function refreshExts(){
  const exts=await window.browserAPI.extGetAll();
  extList.innerHTML='';extBtns.innerHTML='';
  extBtns.style.display = exts.filter(e=>e.hasPopup).length ? 'flex' : 'none';
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
  const t=activePane();
  const show=t&&t.url&&(t.url.includes('youtube.com/watch')||t.url.includes('youtu.be/'));
  bPip.classList.toggle('hidden',!show);
}
bPip.addEventListener('click',async()=>{const t=activePane();if(t){try{await window.browserAPI.pip(t.wv.getWebContentsId());}catch{}}});

// ================================================================
//  SESSION PERSISTENCE
// ================================================================
async function saveSession(){
  const data={
    tabs:S.tabs.map(t=>({
      url:t.url,title:t.title,favicon:t.favicon,
      splitWith: t.splitWith ? {url:t.splitWith.url,title:t.splitWith.title,favicon:t.splitWith.favicon} : null,
      splitRatio: t.splitRatio,
      activePane: t.activePane
    })),
    activeIndex:S.tabs.findIndex(t=>t.id===S.activeTabId),
    pinnedTabId: S.pinnedTabId
  };
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
    sess.tabs.forEach((tData,i)=>{
      const tab = createTab(tData.url, false);
      if(tData.splitWith) {
        const splitTab = createTab(tData.splitWith.url, false);
        S.tabs.pop(); // remove from main array
        tab.splitWith = splitTab;
        tab.splitRatio = tData.splitRatio || 50;
        tab.activePane = tData.activePane || 'left';
      }
      if(i===(sess.activeIndex??0)) switchTab(tab.id);
    });
    if(sess.pinnedTabId) S.pinnedTabId = sess.pinnedTabId;
  }else{
    createTab(HOME_URL);
  }

  // Load extensions
  refreshExts();
  
  updateSplitLayout();
  updateStar();
}
init();

// ================================================================
//  DOWNLOADS
// ================================================================
const bDl=$('#btn-downloads'), dlPanel=$('#downloads-panel'), dlList=$('#downloads-list'), dlFolder=$('#downloads-folder-btn');

function renderDownloads() {
  dlList.innerHTML = '';
  const last4 = S.downloads.slice(-4).reverse();
  last4.forEach(d => {
    const item = document.createElement('div');
    item.className = 'dl-item';
    const percent = d.totalBytes ? Math.round((d.receivedBytes / d.totalBytes) * 100) : 0;
    
    let stateTxt = d.state;
    if (d.state === 'progressing') stateTxt = `${percent}%`;
    else if (d.state === 'completed') stateTxt = 'Done';
    
    item.innerHTML = `
      <div class="dl-header">
        <span class="dl-name" title="${d.filename}">${d.filename}</span>
        ${d.state === 'progressing' ? `<button class="dl-cancel" title="Cancel">×</button>` : ''}
      </div>
      <div class="dl-progress">
        <div class="dl-bar" style="width: ${d.state === 'completed' ? 100 : percent}%; background: ${d.state === 'cancelled' || d.state === 'interrupted' ? 'var(--red)' : 'var(--accent)'};"></div>
      </div>
      <div class="dl-status">
        <span>${(d.receivedBytes / 1024 / 1024).toFixed(1)} MB</span>
        <span>${stateTxt}</span>
      </div>
    `;
    const btnCancel = item.querySelector('.dl-cancel');
    if (btnCancel) {
      btnCancel.onclick = () => window.browserAPI.cancelDownload(d.id);
    }
    dlList.appendChild(item);
  });
}

window.browserAPI.onDownloadUpdated(data => {
  const idx = S.downloads.findIndex(d => d.id === data.id);
  if (idx > -1) {
    S.downloads[idx] = data;
  } else {
    S.downloads.push(data);
  }
  renderDownloads();
});

bDl.addEventListener('mouseenter', () => {
  clearTimeout(S.downloadsPanelTimer);
  const r = bDl.getBoundingClientRect();
  dlPanel.style.top = `${r.bottom + 6}px`;
  dlPanel.style.left = `${r.left - 280 + r.width/2}px`;
  dlPanel.classList.remove('hidden');
});

bDl.addEventListener('mouseleave', () => {
  S.downloadsPanelTimer = setTimeout(() => dlPanel.classList.add('hidden'), 300);
});
dlPanel.addEventListener('mouseenter', () => clearTimeout(S.downloadsPanelTimer));
dlPanel.addEventListener('mouseleave', () => {
  S.downloadsPanelTimer = setTimeout(() => dlPanel.classList.add('hidden'), 300);
});

dlFolder.addEventListener('click', () => window.browserAPI.openDownloadsFolder());

// ================================================================
//  SPLIT SCREEN
// ================================================================
bSplit.addEventListener('click', () => {
  const t = activeTab();
  if (!t) return;
  if (t.splitWith) {
    S.tabs.push(t.splitWith);
    t.splitWith = null;
    updateSplitLayout();
    renderTabs();
  } else if (S.isPickerOpen) {
    S.isPickerOpen = false;
    updateSplitLayout();
  } else {
    S.isPickerOpen = true;
    updateSplitLayout();
    renderSplitPicker();
  }
});

spClose.addEventListener('click', () => {
  S.isPickerOpen = false;
  updateSplitLayout();
});

function renderSplitPicker() {
  spGrid.innerHTML = '';
  const tabs = S.tabs.filter(t => t.id !== S.activeTabId);
  if (tabs.length === 0) {
    spGrid.innerHTML = '<div style="color:var(--text-3);font-size:12px;">No other tabs open</div>';
    return;
  }
  tabs.forEach(t => {
    const card = document.createElement('div');
    card.className = 'sp-card';
    const thumb = S.thumbs.get(t.id) || FALLBACK;
    const fav = t.favicon || FALLBACK;
    card.innerHTML = `
      <img class="sp-thumb" src="${thumb}" onerror="this.src='${FALLBACK}'">
      <div class="sp-info">
        <img src="${fav}" onerror="this.src='${FALLBACK}'">
        <span>${t.title}</span>
      </div>
    `;
    card.addEventListener('click', () => {
      const parent = activeTab();
      S.tabs = S.tabs.filter(x => x.id !== t.id);
      parent.splitWith = t;
      parent.splitRatio = 50;
      parent.activePane = 'right';
      S.isPickerOpen = false;
      updateSplitLayout();
      renderTabs();
      syncNav(activePane());
      if(sI!==document.activeElement)sI.value=formatUrlDisplay(activePane()?.url);
      updateStar();
    });
    spGrid.appendChild(card);
  });
}

splitResizer.addEventListener('mousedown', () => {
  S.isResizing = true;
  splitResizer.classList.add('active');
  wvC.style.pointerEvents = 'none';
});

document.addEventListener('mousemove', (e) => {
  if (!S.isResizing) return;
  const t = activeTab();
  if(!t || !t.splitWith) return;
  const w = window.innerWidth;
  let ratio = (e.clientX / w) * 100;
  if (ratio < 20) ratio = 20;
  if (ratio > 80) ratio = 80;
  t.splitRatio = ratio;
  updateSplitLayout();
});

document.addEventListener('mouseup', () => {
  if (S.isResizing) {
    S.isResizing = false;
    splitResizer.classList.remove('active');
    wvC.style.pointerEvents = 'auto';
  }
});
