(() => {
  'use strict';
  const config=window.FletsConfig||{},core=window.FletsLead;
  const route=document.body.dataset.campaignRoute;
  const form=document.querySelector('#household-form'),status=form.querySelector('.form-status'),button=form.querySelector('[type=submit]');
  let storage;try{storage=window.sessionStorage;storage.removeItem('flets-cross:audience:v1');}catch(_){}
  const attribution=window.FletsWestAttribution?.createAttribution(window.location.search,storage);
  const prefectures=['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
  prefectures.forEach(name=>{const option=document.createElement('option');option.value=name;option.textContent=name;form.elements.prefecture.append(option);});
  const update=()=>{const area=form.querySelector('[name=inquiryType]:checked').value==='area';form.elements.address.required=area;document.querySelector('#address-requirement').textContent=area?'必須':'任意';status.textContent='';};
  form.querySelectorAll('[name=inquiryType]').forEach(el=>el.addEventListener('change',update));
  document.querySelectorAll('a[href="#inquiry"]').forEach(el=>el.addEventListener('click',()=>{form.querySelector('[name=inquiryType][value="'+(el.hasAttribute('data-select-area')?'area':'consultation')+'"]').checked=true;update();}));
  document.querySelectorAll('[data-home-open-details]').forEach(el=>el.addEventListener('click',()=>{const target=document.querySelector(el.getAttribute('href'));if(target?.tagName==='DETAILS')target.open=true;}));
  document.querySelectorAll('[data-change-purpose]').forEach(el=>{const url=core.campaignUrl(el.getAttribute('href'),location.href,attribution?.getPayload());if(url){const target=new URL(url);target.searchParams.set('choose','1');el.href=target.href;}});
  const phoneInput=form.elements.phone;
  phoneInput.addEventListener('input',()=>phoneInput.setCustomValidity(''));
  const validatePhone=()=>{const digits=phoneInput.value.replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/\D/g,'');phoneInput.setCustomValidity(digits.length>=10&&digits.length<=15?'':'電話番号をご確認ください。');};
  document.querySelectorAll('a[href^="tel:"]').forEach(link=>link.addEventListener('click',event=>{
    if(config.previewMode!==false){event.preventDefault();return;}
    
    // Telephone navigation never emits a lead conversion.
  }));
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(form.dataset.submitting==='true'||form.dataset.submitted==='true')return;
    validatePhone();
    if(!form.checkValidity()){form.reportValidity();return;}
    const data=core.payload(Object.fromEntries(new FormData(form)),route,config,attribution?.getPayload());
    button.disabled=true;form.dataset.submitting='true';button.querySelector('strong').textContent='送信中…';status.textContent='';status.classList.remove('is-error');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const receipt=await core.deliver(data,config,window.fetch.bind(window),controller.signal);
      if(receipt.preview){status.textContent='入力内容を確認しました。確認用のため送信は行われません。';return;}
      // Household delivery never calls conversionEvent, dataLayer, gtag or advertising pixels.
      form.dataset.submitted='true';form.hidden=true;const complete=document.querySelector('.home-complete');complete.hidden=false;complete.focus({preventScroll:true});complete.scrollIntoView({behavior:'smooth',block:'center'});
    }catch(error){status.textContent=error.message==='RECEPTION_UNCONFIGURED'?'受付先を準備中です。入力内容は送信されていません。':'送信状況を確認できませんでした。お電話（050-1780-2661）でお問い合わせください。';status.classList.add('is-error');}
    finally{clearTimeout(timer);button.disabled=false;form.dataset.submitting='false';button.querySelector('strong').textContent='この内容で相談する';}
  });
  const sticky=document.querySelector('.home-sticky');
  if('IntersectionObserver' in window){
    const heroActions=document.querySelector('.home-hero-actions');
    const visible=new Map([[heroActions,true],[form,false]]);
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>visible.set(entry.target,entry.isIntersecting));
      sticky.hidden=Array.from(visible.values()).some(Boolean);
    },{threshold:0});
    observer.observe(heroActions);observer.observe(form);
  }else sticky.hidden=false;
  update();
})();
