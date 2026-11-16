(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FletsLead=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const FIELDS=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','keyword','campaign_id','adgroup_id','ad_id','adset_id','matchtype','network','device','placement','site_source_name','gclid','gbraid','wbraid','fbclid'];
  const clean=value=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,1024);
  function campaignUrl(destination,currentUrl,saved={}){const current=new URL(currentUrl),target=new URL(destination,current);if(target.origin!==current.origin||!['http:','https:'].includes(target.protocol))return null;const fresh=FIELDS.some(key=>current.searchParams.has(key));FIELDS.forEach(key=>{target.searchParams.delete(key);const value=fresh?current.searchParams.get(key):saved[key];if(value)target.searchParams.set(key,clean(value));});target.searchParams.delete('choose');return target.href;}
  function eligible(route,kind,config){return route==='business'&&(kind==='corporation'||(kind==='sole_proprietor'&&config.includeSoleProprietors===true));}
  function payload(values,route,config,attribution,options){
    if(!['business','tokai','nationwide'].includes(route))throw Error('Unknown campaign route');
    const test=options?.test===true;
    const result={...values,...(attribution||{}),audience_type:route==='business'?'business':'personal',audience_label:route==='business'?'法人・個人事業主':'個人',campaign_route:route,formType:values.inquiryType==='area'?'area':'consultation',campaign:route==='business'?'10ギガ ワンコインキャンペーン（12ヶ月実質月額500円・税抜）':route==='tokai'?'東海地域 ご家庭向けキャンペーン（6ヶ月実質月額0円＋3万円キャッシュバック）':'全国 ご家庭向けキャンペーン（6ヶ月実質月額500円・税抜）',ads_conversion_eligible:String(eligible(route,values.businessKind,config)&&!test),is_test:String(test),test_id:test?String(options.testId||''):''};
    if(route!=='business'){delete result.businessKind;delete result.company;}
    result.lead_id=options?.leadId||('flets-'+Date.now()+'-'+Math.random().toString(36).slice(2,10));
    result.submittedAt=new Date().toISOString();
    if(result.formType==='area'){result.fullAddress=[values.postalCode,values.prefecture,values.city,values.street,values.address].filter(Boolean).join(' ');result.areaCheckMethod='担当者による住所・建物設備確認';result.submissionStage='contact_complete';}
    return result;
  }
  function conversionEvent(data,config,receipt,audience){
    if(config.previewMode!==false||config.businessMeasurementEnabled!==true||audience!=='business'||receipt?.sent!==true||data.is_test==='true'||data.ads_conversion_eligible!=='true'||!eligible(data.campaign_route,data.businessKind,config))return null;
    return {event:'lead_form_submit',audience_type:'business',campaign_route:'business',ads_conversion_eligible:true,form_type:data.formType,lead_id:data.lead_id};
  }
  async function deliver(data,config,fetcher,signal){
    if(config.previewMode!==false)return {sent:false,accepted:false,preview:true};
    const endpoint=config.webhooks?.[data.campaign_route];
    if(!endpoint||!/^https:\/\//.test(endpoint))throw Error('RECEPTION_UNCONFIGURED');
    // Keep the existing Zapier simple-POST contract. Opaque fetch completion is
    // only a transport signal: webhook processing and notification receipt require separate QA.
    const response=await fetcher(endpoint,{method:'POST',mode:'no-cors',credentials:'omit',body:new URLSearchParams(data),signal});
    if(response.type!=='opaque'&&!response.ok)throw Error('RECEPTION_REJECTED');
    return {sent:true,accepted:null,receiptVerified:false};
  }
  return Object.freeze({FIELDS,campaignUrl,eligible,payload,conversionEvent,deliver});
});
