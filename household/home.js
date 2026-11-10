(() => {
  'use strict';

  // The personal route is intentionally independent of the business form and its attribution store.
  const ATTRIBUTION_KEY = 'household:attribution:v1';
  const campaignRoute = document.body.dataset.campaignRoute === 'tokai' ? 'tokai' : 'nationwide';
  const updateCampaignDeadline = () => {
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric' }).formatToParts(new Date());
    const year = Number(parts.find((part) => part.type === 'year').value);
    const month = Number(parts.find((part) => part.type === 'month').value);
    const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
    document.querySelectorAll('[data-deadline-month]').forEach((node) => { node.textContent = String(month); });
    document.querySelectorAll('[data-deadline-day]').forEach((node) => { node.textContent = String(day); });
    document.querySelectorAll('[data-deadline-full]').forEach((node) => { node.textContent = `${month}月${day}日`; });
  };
  updateCampaignDeadline();
  // Keep the displayed month-end current even when a tab stays open overnight in Japan.
  window.setInterval(updateCampaignDeadline, 60000);
  const ALLOWED_PARAMETERS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'keyword', 'campaign_id', 'adgroup_id', 'ad_id', 'adset_id',
    'matchtype', 'network', 'device', 'placement', 'site_source_name',
    'gclid', 'gbraid', 'wbraid', 'fbclid'
  ];
  const clean = (value) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 1024) : '';
  const search = new URLSearchParams(window.location.search);
  let attribution = {};
  try {
    const existing = JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) || '{}');
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      for (const key of ALLOWED_PARAMETERS) {
        if (clean(existing[key])) attribution[key] = clean(existing[key]);
      }
    }
  } catch (_) { /* The page still works when browser storage is unavailable. */ }
  if (ALLOWED_PARAMETERS.some((key) => search.has(key))) {
    // A newly tagged visit replaces the whole touch, avoiding mixed Google/Meta data.
    attribution = {};
    for (const key of ALLOWED_PARAMETERS) {
      const value = clean(search.get(key));
      if (value) attribution[key] = value;
    }
  }
  try { sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution)); } catch (_) { /* No persistence is required to use the page. */ }

  for (const link of document.querySelectorAll('[data-purpose-link]')) {
    const url = new URL(link.getAttribute('href'), window.location.href);
    for (const [key, value] of Object.entries(attribution)) url.searchParams.set(key, value);
    link.href = url.href;
  }

  for (const link of document.querySelectorAll('[data-open-details]')) {
    link.addEventListener('click', () => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target instanceof HTMLDetailsElement) target.open = true;
    });
  }

  const form = document.getElementById('household-form');
  const phone = document.getElementById('home-phone');
  phone.addEventListener('input', () => phone.setCustomValidity(''));
  const prefecture = document.getElementById('home-prefecture');
  const prefectures = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'];
  for (const value of prefectures) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    prefecture.append(option);
  }

  const updateInquiryType = () => {
    const isArea = form.elements.inquiryType.value === 'area';
    const address = document.getElementById('home-address');
    const marker = document.getElementById('address-required');
    address.required = isArea;
    marker.className = isArea ? 'required' : 'optional';
    marker.textContent = isArea ? '必須' : '任意';
  };
  for (const radio of form.querySelectorAll('[name="inquiryType"]')) radio.addEventListener('change', updateInquiryType);
  for (const link of document.querySelectorAll('[data-area-link]')) {
    link.addEventListener('click', () => {
      form.querySelector('[name="inquiryType"][value="area"]').checked = true;
      updateInquiryType();
    });
  }

  const status = form.querySelector('.form-status');
  const button = form.querySelector('[type=submit]');
  const submitLabel = button.querySelector('span');
  const setStatus = (message) => {
    status.textContent = message;
    if (message) status.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const isPreview = () => window.LpAudienceConfig?.previewMode !== false
    || ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname)
    || !form.dataset.webhook || form.dataset.webhook === '/__preview_disabled';

  // Use the existing reception workflow without emitting personal advertising conversions.
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.dataset.submitting === 'true' || form.dataset.submitted === 'true') return;
    const phoneDigits = phone.value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0)).replace(/\D/g, '');
    phone.setCustomValidity(phoneDigits.length >= 10 && phoneDigits.length <= 15 ? '' : '電話番号をご確認ください。');
    if (!form.reportValidity()) return;
    const fields = Object.fromEntries(new FormData(form).entries());
    const payload = {
      name: String(fields.name || '').trim(),
      phone: String(fields.phone || '').trim(),
      email: String(fields.email || '').trim(),
      prefecture: String(fields.prefecture || '').trim(),
      address: String(fields.address || '').trim(),
      message: String(fields.message || '').trim(),
      inquiryType: fields.inquiryType === 'area' ? 'area' : 'consultation',
      privacyConsent: fields.privacyConsent === 'on' ? 'on' : '',
      ...Object.fromEntries(ALLOWED_PARAMETERS.map((key) => [key, attribution[key] || ''])),
      audience_type: 'personal',
      audience_label: '個人',
      campaign_route: campaignRoute,
      ads_conversion_eligible: 'false',
      campaign: campaignRoute === 'tokai'
        ? '東海地域 ご家庭向けキャンペーン（6ヶ月実質月額0円＋3万円キャッシュバック）'
        : '全国 ご家庭向けキャンペーン（6ヶ月実質月額500円・税抜）',
      submittedAt: new Date().toISOString()
    };
    payload.formType = payload.inquiryType;
    const source = payload.utm_source.toLowerCase();
    const isGoogle = source === 'google' || (!source && Boolean(payload.gclid || payload.gbraid || payload.wbraid));
    // ValueTrack provides the matched advertising keyword, not the user's search query.
    payload.google_keyword = isGoogle ? (payload.utm_term || payload.keyword) : '';
    if (!payload.name || !payload.phone || !payload.email || !payload.prefecture || !payload.privacyConsent
      || (payload.formType === 'area' && !payload.address)) {
      setStatus('未入力の項目や入力形式をご確認ください。');
      return;
    }
    if (payload.formType === 'area') {
      payload.fullAddress = `${payload.prefecture}${payload.address}`;
      payload.areaCheckMethod = '担当者による住所・建物設備確認';
      payload.submissionStage = 'contact_complete';
    }
    if (isPreview()) {
      setStatus('入力内容を確認しました。プレビュー画面のため、送信・受付は行っていません。');
      return;
    }

    const originalLabel = submitLabel.textContent;
    button.disabled = true;
    form.dataset.submitting = 'true';
    submitLabel.textContent = '送信中…';
    setStatus('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      // As with the business form, an opaque response cannot confirm downstream processing.
      await fetch(form.dataset.webhook, {
        method: 'POST', mode: 'no-cors', credentials: 'omit',
        body: new URLSearchParams(payload), signal: controller.signal
      });
      form.dataset.submitted = 'true';
      form.reset();
      updateInquiryType();
      setStatus(payload.formType === 'area'
        ? '提供エリアの確認依頼を送信しました。担当者からの連絡をお待ちください。'
        : 'お問い合わせを送信しました。担当者からの連絡をお待ちください。');
    } catch (error) {
      setStatus(error.name === 'AbortError'
        ? '通信がタイムアウトしました。時間をおいて再度お試しください。'
        : '送信できませんでした。時間をおいて再度お試しください。');
    } finally {
      window.clearTimeout(timeout);
      form.dataset.submitting = 'false';
      button.disabled = form.dataset.submitted === 'true';
      submitLabel.textContent = button.disabled ? '送信済み' : originalLabel;
    }
  });
  updateInquiryType();
})();
