(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FletsAudience=api.createRouter(root,root.document,root.FletsConfig||{},root.FletsLead);})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';const KEY='flets-cross:audience:v1';
  function createRouter(win,doc,config,core){
    const dialog=doc.querySelector('#audience-dialog');let state='pending',loaded=false,storage;
    try{storage=win.sessionStorage;}catch(_){}
    const save=value=>{try{value?storage?.setItem(KEY,value):storage?.removeItem(KEY);}catch(_){}};
    const setState=value=>{state=value;doc.documentElement.dataset.audienceState=value;};
    const show=name=>{doc.querySelectorAll('[data-audience-step]').forEach(el=>{el.hidden=el.dataset.audienceStep!==name;});const title=doc.querySelector(name==='personal'?'#personal-title':'#audience-title');if(title){dialog?.setAttribute('aria-labelledby',title.id);title.focus();}};
    const canTrack=()=>state==='business'&&config.previewMode===false&&config.businessMeasurementEnabled===true;
    const loadTags=()=>{if(!canTrack()||loaded||!/^GTM-[A-Z0-9]+$/.test(config.businessGtmId||''))return;loaded=true;win.dataLayer=win.dataLayer||[];win.dataLayer.push({audience_type:'business'});win.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});const script=doc.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtm.js?id='+encodeURIComponent(config.businessGtmId);doc.head.appendChild(script);};
    const open=()=>{save(null);if(loaded){const url=new URL(win.location.href);url.searchParams.set('choose','1');win.location.assign(url.href);return;}setState('pending');doc.documentElement.classList.add('audience-modal-open');if(dialog&&!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}show('purpose');};
    const business=()=>{setState('business');save('business');doc.documentElement.classList.remove('audience-modal-open');if(dialog?.open){if(dialog.close)dialog.close();else dialog.removeAttribute('open');}const url=new URL(win.location.href);url.searchParams.delete('choose');win.history.replaceState(null,'',url.pathname+url.search+url.hash);loadTags();};
    const personal=()=>{setState('personal');save(null);show('personal');};
    doc.querySelectorAll('[data-audience-choice]').forEach(el=>el.addEventListener('click',()=>el.dataset.audienceChoice==='business'?business():personal()));
    doc.querySelectorAll('[data-audience-back]').forEach(el=>el.addEventListener('click',()=>{setState('pending');show('purpose');}));
    doc.querySelectorAll('[data-open-audience]').forEach(el=>el.addEventListener('click',event=>{event.preventDefault();open();}));
    doc.querySelectorAll('[data-campaign-route]').forEach(el=>el.addEventListener('click',event=>{event.preventDefault();if(state!=='personal'){open();return;}const destination=el.dataset.campaignRoute==='tokai'?config.tokaiUrl:config.nationwideUrl;const url=core.campaignUrl(destination,win.location.href,win.FletsWestAttribution?.createAttribution(win.location.search,storage).getPayload());if(url){save(null);win.location.assign(url);}}));
    dialog?.addEventListener('cancel',event=>event.preventDefault());
    win.addEventListener('pageshow',event=>{if(event.persisted&&state==='business'){let remembered=false;try{remembered=storage?.getItem(KEY)==='business';}catch(_){}if(!remembered)open();}});
    let remembered=false;try{remembered=storage?.getItem(KEY)==='business';}catch(_){}
    if(remembered&&new URL(win.location.href).searchParams.get('choose')!=='1')business();else open();
    return Object.freeze({isBusiness:()=>state==='business',canTrack,open,getState:()=>state});
  }
  return Object.freeze({KEY,createRouter});
});
