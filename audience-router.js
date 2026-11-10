(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LpAudience = api.createRouter(root, root.document, root.LpAudienceConfig || {});
})(typeof window !== 'undefined' ? window : globalThis, () => {
  'use strict';

  const STORAGE_KEY = 'oshigoto:audience:v1';
  const ATTRIBUTION_FIELDS = Object.freeze([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'keyword', 'campaign_id', 'adgroup_id', 'ad_id', 'adset_id',
    'matchtype', 'network', 'device', 'placement', 'site_source_name',
    'gclid', 'gbraid', 'wbraid', 'fbclid'
  ]);

  function campaignUrl(destination, currentUrl) {
    const current = new URL(currentUrl);
    const target = new URL(destination, current);
    if (!['https:', 'http:'].includes(target.protocol)) return null;
    for (const field of ATTRIBUTION_FIELDS) {
      if (current.searchParams.has(field)) {
        target.searchParams.set(field, current.searchParams.get(field)
          .replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 1024));
      }
    }
    target.searchParams.delete('choose');
    return target.href;
  }

  function createRouter(win, doc, config) {
    const dialog = doc.querySelector('#audience-dialog');
    let state = 'pending';
    let gtmLoaded = false;
    let storage;
    try { storage = win.sessionStorage; } catch (_) { /* Selection still works without storage. */ }
    const isPreview = () => config.previewMode !== false;
    const isBusiness = () => state === 'business';
    const canTrack = () => isBusiness() && !isPreview() && config.businessMeasurementEnabled === true;
    const saveBusiness = selected => {
      try {
        if (selected) storage?.setItem(STORAGE_KEY, 'business');
        else storage?.removeItem(STORAGE_KEY);
      } catch (_) { /* Storage is optional. */ }
    };
    const setState = value => {
      state = value;
      if (doc.documentElement) doc.documentElement.dataset.audienceState = value;
    };
    const showStep = name => {
      doc.querySelectorAll('[data-audience-step]').forEach(panel => { panel.hidden = panel.dataset.audienceStep !== name; });
      const title = doc.querySelector(name === 'personal' ? '#personal-title' : '#audience-title');
      if (title) {
        dialog?.setAttribute('aria-labelledby', title.id);
        title.setAttribute('tabindex', '-1');
        title.focus();
      }
      const tokaiStatus = doc.querySelector('#tokai-route-status');
      if (tokaiStatus) tokaiStatus.hidden = true;
    };
    const open = () => {
      // A full document navigation is required to discard already running tags.
      if (gtmLoaded) {
        const target = new URL(win.location.href);
        target.searchParams.set('choose', '1');
        win.location.assign(target.href);
        return;
      }
      setState('pending');
      doc.documentElement?.classList.add('audience-modal-open');
      if (dialog && !dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      }
      showStep('purpose');
    };
    const loadBusinessMeasurement = () => {
      if (!canTrack() || gtmLoaded || !/^GTM-[A-Z0-9]+$/.test(config.businessGtmId || '')) return;
      gtmLoaded = true;
      win.dataLayer = win.dataLayer || [];
      win.dataLayer.push({audience_type: 'business'});
      win.dataLayer.push({'gtm.start': Date.now(), event: 'gtm.js'});
      const script = doc.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(config.businessGtmId)}`;
      doc.head.appendChild(script);
    };
    const selectBusiness = () => {
      setState('business');
      saveBusiness(true);
      doc.documentElement?.classList.remove('audience-modal-open');
      if (dialog?.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
      const url = new URL(win.location.href);
      if (url.searchParams.has('choose')) {
        url.searchParams.delete('choose');
        win.history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
      loadBusinessMeasurement();
    };
    const selectPersonal = () => {
      setState('personal');
      saveBusiness(false);
      showStep('personal');
    };
    const route = (name, element) => {
      // Never let a pending visitor enter a campaign without choosing personal use.
      if (state !== 'personal') { open(); return; }
      const destination = name === 'tokai' ? config.tokaiUrl : (element?.getAttribute('href') || 'household/');
      const url = destination ? campaignUrl(destination, win.location.href) : null;
      if (!url) {
        const status = doc.querySelector('#tokai-route-status');
        if (status) {
          status.textContent = 'キャンペーンを表示できませんでした。時間をおいて再度お試しください。';
          status.hidden = false;
        }
        return;
      }
      saveBusiness(false);
      win.location.assign(url);
    };

    doc.querySelectorAll('[data-audience-choice]').forEach(button => button.addEventListener('click', () => {
      if (button.dataset.audienceChoice === 'business') selectBusiness();
      else if (button.dataset.audienceChoice === 'personal') selectPersonal();
    }));
    doc.querySelectorAll('[data-audience-back]').forEach(button => button.addEventListener('click', () => { setState('pending'); showStep('purpose'); }));
    doc.querySelectorAll('[data-open-audience]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); open(); }));
    doc.querySelectorAll('[data-campaign-route]').forEach(element => {
      if (element.dataset.campaignRoute === 'nationwide') {
        const url = campaignUrl(element.getAttribute('href') || 'household/', win.location.href);
        if (url && element.tagName === 'A') element.setAttribute('href', url);
      }
      element.addEventListener('click', event => { event.preventDefault(); route(element.dataset.campaignRoute, element); });
    });
    dialog?.addEventListener('cancel', event => { event.preventDefault(); });
    let remembered = false;
    try { remembered = storage?.getItem(STORAGE_KEY) === 'business'; } catch (_) { /* Show the chooser. */ }
    if (remembered && new URL(win.location.href).searchParams.get('choose') !== '1') selectBusiness();
    else open();

    return Object.freeze({isBusiness, canTrack, isPreview, open});
  }

  return Object.freeze({STORAGE_KEY, ATTRIBUTION_FIELDS, campaignUrl, createRouter});
});
