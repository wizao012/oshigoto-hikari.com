(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OshigotoAttribution = api;
})(typeof window !== 'undefined' ? window : globalThis, () => {
  'use strict';

  const STORAGE_KEY = 'oshigoto-hikari:ad-attribution:v1';
  const FIELDS = Object.freeze([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'keyword', 'campaign_id', 'adgroup_id', 'ad_id', 'adset_id',
    'matchtype', 'network', 'device', 'placement', 'site_source_name',
    'gclid', 'gbraid', 'wbraid', 'fbclid'
  ]);
  const clean = value => typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 1024) : '';
  const normalize = values => Object.fromEntries(FIELDS.map(key => [key, clean(values[key])]));

  function createAttribution(search, storage) {
    let values = normalize({});
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
      if (saved?.version === 1 && saved.values && typeof saved.values === 'object' && !Array.isArray(saved.values)) {
        values = normalize(saved.values);
      }
    } catch (_) { /* Storage can be unavailable or contain an invalid record. */ }

    const params = new URLSearchParams(search || '');
    if (FIELDS.some(key => params.has(key))) {
      // A new tagged visit replaces the whole touch, avoiding mixed Google/Meta data.
      values = Object.fromEntries(FIELDS.map(key => [key, clean(params.get(key))]));
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify({version: 1, values}));
      } catch (_) { /* Keep the current visit in memory if persistence is blocked. */ }
    }

    return Object.freeze({
      getPayload() {
        const source = values.utm_source.toLowerCase();
        const isGoogle = source === 'google' || (!source && Boolean(values.gclid || values.gbraid || values.wbraid));
        return {
          ...values,
          // ValueTrack supplies the matched account keyword, not the user's search query.
          google_keyword: isGoogle ? (values.utm_term || values.keyword) : ''
        };
      }
    });
  }

  return Object.freeze({STORAGE_KEY, FIELDS, createAttribution});
});
