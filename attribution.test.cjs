'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {STORAGE_KEY, FIELDS, createAttribution} = require('./attribution.js');

function sessionStorage(initialValue) {
  const records = new Map(initialValue === undefined ? [] : [[STORAGE_KEY, initialValue]]);
  return {
    getItem(key) { return records.get(key) ?? null; },
    setItem(key, value) { records.set(key, value); }
  };
}

test('a direct visit has no attributed source, campaign, keyword or click ID', () => {
  const payload = createAttribution('', sessionStorage()).getPayload();
  assert.equal(payload.utm_source, '');
  assert.equal(payload.utm_medium, '');
  assert.equal(payload.utm_campaign, '');
  assert.equal(payload.google_keyword, '');
  assert.equal(payload.gclid, '');
  assert.ok(Object.values(payload).every(value => value === ''));
});

test('Google campaign values and a UTF-8 matched keyword survive URL decoding', () => {
  const query = new URLSearchParams({
    utm_source: 'google', utm_medium: 'cpc', utm_campaign: '法人10G_秋',
    utm_term: '法人 光回線 10ギガ', gclid: 'Google-click-123',
    campaign_id: '12345', adgroup_id: '67890', matchtype: 'e', device: 'm'
  });
  const payload = createAttribution(`?${query}`, sessionStorage()).getPayload();
  assert.equal(payload.utm_source, 'google');
  assert.equal(payload.utm_medium, 'cpc');
  assert.equal(payload.utm_campaign, '法人10G_秋');
  assert.equal(payload.utm_term, '法人 光回線 10ギガ');
  assert.equal(payload.google_keyword, '法人 光回線 10ギガ');
  assert.equal(payload.gclid, 'Google-click-123');
  assert.equal(payload.campaign_id, '12345');
  assert.equal(payload.adgroup_id, '67890');
  assert.equal(payload.matchtype, 'e');
  assert.equal(payload.device, 'm');
});

test('an untagged same-tab reload keeps the preceding campaign', () => {
  const storage = sessionStorage();
  const landing = createAttribution('?utm_source=google&utm_medium=cpc&utm_campaign=autumn&utm_term=office&gclid=G1', storage);
  const reloaded = createAttribution('', storage);
  assert.deepEqual(reloaded.getPayload(), landing.getPayload());
  assert.deepEqual(createAttribution('?unrelated=example', storage).getPayload(), landing.getPayload());
});

test('a new Meta click replaces a Google touch without carrying over old fields', () => {
  const storage = sessionStorage();
  createAttribution('?utm_source=google&utm_medium=cpc&utm_campaign=google-campaign&utm_term=google-term&gclid=G1&adgroup_id=G2', storage);
  const meta = createAttribution('?utm_source=meta&utm_medium=paid_social&fbclid=F1&adset_id=F2', storage).getPayload();
  assert.equal(meta.utm_source, 'meta');
  assert.equal(meta.utm_medium, 'paid_social');
  assert.equal(meta.fbclid, 'F1');
  assert.equal(meta.adset_id, 'F2');
  for (const field of ['utm_campaign', 'utm_term', 'google_keyword', 'gclid', 'adgroup_id']) {
    assert.equal(meta[field], '', `${field} must not leak from the preceding Google visit`);
  }
  assert.deepEqual(createAttribution('', storage).getPayload(), meta);
});

test('explicitly empty advertising parameters clear the old campaign', () => {
  const storage = sessionStorage();
  createAttribution('?utm_source=google&utm_campaign=old&utm_term=old-term&gclid=old-id', storage);
  const payload = createAttribution('?utm_campaign=', storage).getPayload();
  assert.ok(Object.values(payload).every(value => value === ''));
  assert.deepEqual(createAttribution('', storage).getPayload(), payload);
});

test('blocked storage still allows the current landing values to be sent', () => {
  const blocked = {
    getItem() { throw new Error('Storage access denied'); },
    setItem() { throw new Error('Storage quota or access denied'); }
  };
  const attribution = createAttribution('?utm_source=google&utm_medium=cpc&utm_campaign=current&utm_term=business', blocked);
  assert.equal(attribution.getPayload().utm_campaign, 'current');
  assert.equal(attribution.getPayload().google_keyword, 'business');
  assert.equal(createAttribution('', blocked).getPayload().utm_source, '');
});

test('storage is optional and a failed write does not discard the new campaign', () => {
  assert.equal(createAttribution('?utm_source=meta', undefined).getPayload().utm_source, 'meta');
  const storage = {
    getItem() { return JSON.stringify({version: 1, values: {utm_source: 'google', utm_campaign: 'old'}}); },
    setItem() { throw new Error('Quota exceeded'); }
  };
  const payload = createAttribution('?utm_source=meta&utm_campaign=new', storage).getPayload();
  assert.equal(payload.utm_source, 'meta');
  assert.equal(payload.utm_campaign, 'new');
});

test('corrupt and incompatible saved records do not break attribution', () => {
  for (const record of ['{invalid', 'null', '42', '{"version":2,"values":{"utm_source":"google"}}', '{"version":1,"values":[]}']) {
    const storage = sessionStorage(record);
    assert.equal(createAttribution('', storage).getPayload().utm_source, '');
    const payload = createAttribution('?utm_source=google&utm_campaign=recovered', storage).getPayload();
    assert.equal(payload.utm_source, 'google');
    assert.equal(payload.utm_campaign, 'recovered');
  }
});

test('unknown URL values, personal data, full URLs and referrers are not collected', () => {
  const query = new URLSearchParams({
    utm_source: 'google', email: 'example@example.com', phone: '09012345678',
    referrer: 'https://example.com/private', landing_url: 'https://example.com/?email=private',
    search_query: 'actual search term', unexpected: 'value'
  });
  const payload = createAttribution(`?${query}`, sessionStorage()).getPayload();
  assert.deepEqual(Object.keys(payload).sort(), [...FIELDS, 'google_keyword'].sort());
  for (const key of ['email', 'phone', 'referrer', 'landing_url', 'search_query', 'unexpected']) {
    assert.equal(Object.hasOwn(payload, key), false);
  }
  const saved = sessionStorage(JSON.stringify({version: 1, values: {utm_source: 'meta', email: 'private@example.com'}}));
  assert.equal(Object.hasOwn(createAttribution('', saved).getPayload(), 'email'), false);
});

test('changing a returned payload cannot change later submissions', () => {
  const attribution = createAttribution('?utm_source=google&utm_campaign=original&utm_term=matched', sessionStorage());
  const first = attribution.getPayload();
  first.utm_campaign = 'modified';
  first.google_keyword = 'modified';
  first.extra = 'injected';
  const second = attribution.getPayload();
  assert.equal(second.utm_campaign, 'original');
  assert.equal(second.google_keyword, 'matched');
  assert.equal(Object.hasOwn(second, 'extra'), false);
});

test('Google keyword uses utm_term first and keyword only as a fallback', () => {
  assert.equal(createAttribution('?utm_source=google&utm_term=primary&keyword=fallback').getPayload().google_keyword, 'primary');
  assert.equal(createAttribution('?utm_source=GOOGLE&utm_term=&keyword=fallback').getPayload().google_keyword, 'fallback');
  assert.equal(createAttribution('?gclid=G1&keyword=matched').getPayload().google_keyword, 'matched');
  assert.equal(createAttribution('?gbraid=B1&utm_term=matched').getPayload().google_keyword, 'matched');
  assert.equal(createAttribution('?wbraid=W1&utm_term=matched').getPayload().google_keyword, 'matched');
  assert.equal(createAttribution('?utm_source=meta&utm_term=creative-label&keyword=label').getPayload().google_keyword, '');
  assert.equal(createAttribution('?utm_source=google&search_query=actual-search-text').getPayload().google_keyword, '');
});

test('campaign values remove controls, trim whitespace and bound oversized inputs', () => {
  const query = new URLSearchParams({
    utm_source: '  google\r\n', utm_medium: '\tcpc\u0000',
    utm_campaign: ` ${'a'.repeat(5000)} `, utm_term: ' \t法人\n光回線\u007f '
  });
  const payload = createAttribution(`?${query}`, sessionStorage()).getPayload();
  assert.equal(payload.utm_source, 'google');
  assert.equal(payload.utm_medium, 'cpc');
  assert.equal(payload.utm_campaign.length, 1024);
  assert.equal(payload.utm_term, '法人光回線');
  assert.equal(payload.google_keyword, '法人光回線');
  assert.ok(Object.values(payload).every(value => !/[\u0000-\u001f\u007f]/.test(value)));
});

test('saved data is normalized before use, including unexpected value types', () => {
  const storage = sessionStorage(JSON.stringify({version: 1, values: {
    utm_source: ' google\n ', utm_campaign: {nested: 'invalid'}, utm_term: 123,
    keyword: '\tmatched\u0000', gclid: null, extra: 'ignored'
  }}));
  const payload = createAttribution('', storage).getPayload();
  assert.equal(payload.utm_source, 'google');
  assert.equal(payload.utm_campaign, '');
  assert.equal(payload.utm_term, '');
  assert.equal(payload.google_keyword, 'matched');
  assert.equal(payload.gclid, '');
  assert.equal(Object.hasOwn(payload, 'extra'), false);
});
