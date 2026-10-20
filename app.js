(() => {
  'use strict';
  let attributionStorage;
  try { attributionStorage = window.sessionStorage; } catch (_) { /* Blocked browser storage. */ }
  const attribution = window.OshigotoAttribution?.createAttribution(window.location.search, attributionStorage);
  const form = document.querySelector('#lead-form');
  const addressFields = document.querySelector('#address-fields');
  const submitLabel = document.querySelector('#submit-label');
  const complete = document.querySelector('.form-complete');
  const sticky = document.querySelector('.mobile-sticky');
  const preferences = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
  const prefecture = document.querySelector('#prefecture');
  preferences.forEach(name => { const option = document.createElement('option'); option.value = name; option.textContent = name; prefecture.append(option); });
  const track = (event, properties = {}) => { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event, ...properties }); };
  const status = (message, error = false) => { const node = form.querySelector('.form-status'); node.textContent = message; node.classList.toggle('is-error', error); };
  const updateType = () => {
    const area = form.querySelector('[name=inquiryType]:checked').value === 'area';
    addressFields.hidden = !area; addressFields.disabled = !area;
    submitLabel.textContent = area ? '提供エリアの確認を依頼する' : 'お問い合わせを送信する';
    status('');
  };
  form.querySelectorAll('[name=inquiryType]').forEach(input => input.addEventListener('change', updateType));
  document.querySelectorAll('[data-select-area]').forEach(link => link.addEventListener('click', () => {
    if (form.hidden) { form.hidden = false; complete.hidden = true; }
    form.querySelector('[name=inquiryType][value=area]').checked = true; updateType();
  }));
  document.querySelectorAll('[data-open-details]').forEach(link => link.addEventListener('click', () => {
    const details = document.getElementById(link.dataset.openDetails); if (details) details.open = true;
  }));
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
    const fragment = link.getAttribute('href');
    const target = document.getElementById(fragment.slice(1));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({behavior:'smooth', block:'start'});
    window.history.replaceState(null, '', window.location.pathname + window.location.search + fragment);
  }));
  document.querySelectorAll('a[href^="tel:"]').forEach(link => link.addEventListener('click', () => track('click_to_call', { phone_number:'050-1780-2661', cta_location:link.dataset.ctaLocation || 'unknown' })));
  let heroPast = false; let inquiryVisible = false;
  const updateSticky = () => { sticky.hidden = !heroPast || inquiryVisible; };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { heroPast = !entry.isIntersecting && entry.boundingClientRect.top < 0; updateSticky(); }, {threshold:0}).observe(document.querySelector('.hero'));
    new IntersectionObserver(([entry]) => { inquiryVisible = entry.isIntersecting; updateSticky(); }, {threshold:0}).observe(document.querySelector('#inquiry'));
  }
  document.querySelector('#postal-code').addEventListener('input', event => {
    const digits = event.target.value.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/\D/g,'').slice(0,7);
    event.target.value = digits.length > 3 ? digits.slice(0,3)+'-'+digits.slice(3) : digits;
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (form.dataset.submitting === 'true') return;
    if (!form.checkValidity()) { form.reportValidity(); status('未入力の項目や入力形式をご確認ください。', true); return; }
    const payload = Object.fromEntries(new FormData(form).entries());
    Object.assign(payload, attribution?.getPayload() || {});
    payload.formType = payload.inquiryType === 'area' ? 'area' : 'consultation';
    payload.campaign = '10ギガ ワンコインキャンペーン（12ヶ月実質月額500円・税抜）';
    payload.submittedAt = new Date().toISOString();
    if (payload.formType === 'area') { payload.fullAddress = `${payload.postalCode} ${payload.prefecture}${payload.city}${payload.street}`; payload.areaCheckMethod = '担当者による住所・建物設備確認'; payload.submissionStage = 'contact_complete'; }
    const button = form.querySelector('[type=submit]'); const originalLabel = submitLabel.textContent;
    button.disabled = true; form.dataset.submitting = 'true'; submitLabel.textContent = '送信中…'; status('');
    const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      // Existing reception workflow. An opaque no-cors response cannot confirm downstream receipt.
      await fetch(form.dataset.webhook, { method:'POST', mode:'no-cors', credentials:'omit', body:new URLSearchParams(payload), signal:controller.signal });
      track('lead_form_submit', {form_type:payload.formType});
      complete.querySelector('h3').textContent = payload.formType === 'area' ? '提供エリアの確認依頼を送信しました。' : 'お問い合わせを送信しました。';
      form.reset(); updateType(); form.hidden = true; complete.hidden = false; complete.focus({preventScroll:true}); complete.scrollIntoView({behavior:'smooth',block:'center'});
    } catch (error) {
      status(error.name === 'AbortError' ? '通信がタイムアウトしました。送信状況をお電話でご確認ください。' : '送信できませんでした。時間をおいて再度お試しいただくか、お電話でお問い合わせください。', true);
    } finally { window.clearTimeout(timeout); button.disabled = false; form.dataset.submitting = 'false'; submitLabel.textContent = originalLabel; }
  });
  document.querySelector('#reset-form').addEventListener('click', () => { complete.hidden = true; form.hidden = false; updateType(); form.querySelector('[name=company]').focus(); });
  updateType();
})();
