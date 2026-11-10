'use strict';

// The entire sender runs in a VM with a fake fetch. No test contacts Zapier.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'household/home.js'), 'utf8');
const businessHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const endpoint = businessHtml.match(/data-webhook="([^"]+)"/)?.[1];

class Element {
  constructor(value = '') {
    this.value = value;
    this.checked = false;
    this.required = false;
    this.disabled = false;
    this.hidden = false;
    this.textContent = '';
    this.dataset = {};
    this.handlers = new Map();
    this.children = [];
    this.attributes = new Map();
    this.customValidity = '';
    this.classList = {toggle() {}, add() {}, remove() {}};
  }
  addEventListener(type, handler) {
    const list = this.handlers.get(type) || [];
    list.push(handler);
    this.handlers.set(type, list);
  }
  async fire(type) {
    const event = {target:this, defaultPrevented:false, preventDefault() { this.defaultPrevented = true; }};
    for (const handler of this.handlers.get(type) || []) await handler(event);
    return event;
  }
  setCustomValidity(value) { this.customValidity = value; }
  append(value) { this.children.push(value); }
  appendChild(value) { this.children.push(value); }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  removeAttribute(key) { this.attributes.delete(key); }
  scrollIntoView() { this.scrolled = true; }
  focus() { this.focused = true; }
}

function mount(options = {}) {
  const initial = {
    name:'テスト 太郎', phone:'090-1234-5678', email:'test@example.invalid',
    prefecture:'大阪府', address:'', message:'テスト用・外部送信なし',
    audience_type:'business', audience_label:'改ざん値', campaign_route:'business',
    ads_conversion_eligible:'true', ...options.fields
  };
  const inputs = Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, new Element(value)]));
  inputs.privacyConsent = new Element('on');
  inputs.privacyConsent.checked = options.consent !== false;
  for (const key of ['name', 'phone', 'email', 'prefecture', 'privacyConsent']) inputs[key].required = true;
  const consultation = new Element('consultation');
  const area = new Element('area');
  consultation.checked = options.inquiryType !== 'area';
  area.checked = options.inquiryType === 'area';
  const inquiryType = {get value() { return area.checked ? 'area' : 'consultation'; }};
  const form = new Element();
  form.dataset.webhook = options.endpoint === undefined ? endpoint : options.endpoint;
  form.elements = {...inputs, inquiryType};
  const status = new Element();
  const button = new Element();
  const label = new Element(); label.textContent = '送信する';
  button.querySelector = selector => selector === 'span' ? label : null;
  const marker = new Element();
  const complete = new Element(); complete.hidden = true;
  const nameQuery = selector => {
    const match = selector.match(/\[name=["']?([^\]"']+)/);
    return match ? inputs[match[1]] || null : null;
  };
  form.querySelector = selector => {
    if (selector === '.form-status') return status;
    if (selector === '[type=submit]' || selector === '[type="submit"]' || selector === '.submit-cta') return button;
    if (selector === '[type=submit] span' || selector === '[type="submit"] span' || selector === '.submit-cta span' || selector === '#home-submit-label') return label;
    if (selector.includes('inquiryType')) return selector.includes('area') ? area : consultation;
    return nameQuery(selector);
  };
  form.querySelectorAll = selector => selector.includes('inquiryType') ? [consultation, area] : [];
  let reports = 0;
  form.checkValidity = () => {
    if (Object.values(inputs).some(input => input.customValidity)) return false;
    for (const [key, input] of Object.entries(inputs)) {
      if (input.required && (key === 'privacyConsent' ? !input.checked : !input.value)) return false;
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputs.email.value);
  };
  form.reportValidity = () => { reports += 1; return form.checkValidity(); };
  form.reset = () => { form.wasReset = true; };
  const byId = new Map([
    ['household-form', form], ['home-phone', inputs.phone], ['home-prefecture', inputs.prefecture],
    ['home-address', inputs.address], ['address-required', marker], ['home-submit-label', label],
    ['household-complete', complete], ['home-name', inputs.name], ['home-email', inputs.email]
  ]);
  const scripts = [];
  const document = {
    body:{dataset:{campaignRoute:options.route || 'nationwide'}},
    head:{appendChild(node) { scripts.push(node); }},
    getElementById(id) { return byId.get(id) || null; },
    createElement() { return new Element(); },
    querySelectorAll() { return []; },
    querySelector(selector) {
      if (selector.startsWith('#')) return byId.get(selector.slice(1)) || null;
      return form.querySelector(selector);
    }
  };
  const stored = new Map(options.stored || []);
  const storage = {
    getItem(key) { if (options.blockedStorage) throw new Error('Blocked'); return stored.get(key) ?? null; },
    setItem(key, value) { if (options.blockedStorage) throw new Error('Blocked'); stored.set(key, value); }
  };
  const calls = [];
  const timers = [];
  const clearedTimers = [];
  const adCalls = [];
  const location = new URL(`https://${options.hostname || 'example.test'}/household/${options.search || ''}`);
  const window = {
    location, sessionStorage:storage,
    setInterval() { return 0; },
    setTimeout(callback, ms) { timers.push({callback, ms}); return timers.length; },
    clearTimeout(id) { clearedTimers.push(id); },
    fbq(...args) { adCalls.push(['fbq', ...args]); },
    gtag(...args) { adCalls.push(['gtag', ...args]); }
  };
  if (!options.missingConfig) window.LpAudienceConfig = options.config || {previewMode:false};
  class FakeFormData {
    constructor() {
      this.values = Object.entries(inputs)
        .filter(([key, input]) => key !== 'privacyConsent' || input.checked)
        .map(([key, input]) => [key, input.value]);
      this.values.push(['inquiryType', inquiryType.value]);
    }
    entries() { return this.values[Symbol.iterator](); }
  }
  const fetch = (url, init) => {
    const call = {url, init, payload:Object.fromEntries(init.body.entries())};
    calls.push(call);
    return options.fetchImpl ? options.fetchImpl(call) : Promise.resolve({type:'opaque', status:0});
  };
  vm.runInNewContext(source, {
    window, document, sessionStorage:storage, location, URL, URLSearchParams,
    FormData:FakeFormData, AbortController, HTMLDetailsElement:Element,
    fetch, Intl, Date, console,
    fbq:window.fbq, gtag:window.gtag,
    setTimeout:window.setTimeout, clearTimeout:window.clearTimeout
  }, {filename:'household/home.js'});
  return {form, status, button, label, inputs, calls, timers, clearedTimers, stored, window, adCalls, scripts, reports:() => reports};
}

function noAdvertising(fixture) {
  assert.equal(fixture.window.dataLayer, undefined, 'personal submissions must not create an advertising data layer');
  assert.deepEqual(fixture.adCalls, []);
  assert.deepEqual(fixture.scripts, []);
}

test('both personal forms use the existing business webhook and load preview config before home.js', () => {
  assert.match(endpoint, /^https:\/\/hooks\.zapier\.com\/hooks\/catch\//);
  for (const relative of ['household/index.html', 'household/tokai/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, relative), 'utf8');
    assert.equal(html.match(/<form\b[^>]*id="household-form"[^>]*data-webhook="([^"]+)"/)?.[1], endpoint, relative);
    const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(match => match[1]);
    const configIndex = scripts.findIndex(value => /audience-config\.js/.test(value));
    const homeIndex = scripts.findIndex(value => /(?:^|\/)home\.js/.test(value));
    assert.ok(configIndex >= 0 && homeIndex > configIndex, relative);
    assert.ok(scripts.every(value => !/(?:googletagmanager|fbevents|(?:^|\/)app\.js|audience-router\.js)/.test(value)), relative);
  }
});

test('preview, missing config, local hostnames and disabled destinations all block real sending', async () => {
  const cases = [
    {config:{previewMode:true}}, {missingConfig:true}, {config:{}},
    ...['localhost', '127.0.0.1', '[::1]'].map(hostname => ({hostname})),
    {endpoint:''}, {endpoint:'/__preview_disabled'}
  ];
  for (const options of cases) {
    const f = mount(options);
    await f.form.fire('submit');
    assert.equal(f.calls.length, 0, JSON.stringify(options));
    assert.match(f.status.textContent, /プレビュー|送信.*(?:いません|ません)|未設定|無効/, JSON.stringify(options));
    assert.notEqual(f.form.dataset.submitted, 'true');
    noAdvertising(f);
  }
});

test('nationwide sends compatible flat fields, authoritative personal metadata and Google attribution', async () => {
  const f = mount({search:'?utm_source=google&utm_medium=cpc&utm_campaign=TEST&utm_term=%E6%B3%95%E4%BA%BA%E5%85%89&gclid=G123', fields:{name:' テスト 太郎 '}});
  await f.form.fire('submit');
  assert.equal(f.calls.length, 1);
  const {url, init, payload} = f.calls[0];
  assert.equal(url, endpoint);
  assert.equal(init.method, 'POST');
  assert.equal(init.mode, 'no-cors');
  assert.equal(init.credentials, 'omit');
  assert.ok(init.body instanceof URLSearchParams);
  assert.equal(payload.name, 'テスト 太郎');
  assert.equal(payload.phone, '090-1234-5678');
  assert.equal(payload.email, 'test@example.invalid');
  assert.equal(payload.audience_type, 'personal');
  assert.equal(payload.audience_label, '個人');
  assert.equal(payload.campaign_route, 'nationwide');
  assert.equal(payload.ads_conversion_eligible, 'false');
  assert.equal(payload.formType, 'consultation');
  assert.equal(payload.utm_source, 'google');
  assert.equal(payload.utm_medium, 'cpc');
  assert.equal(payload.utm_campaign, 'TEST');
  assert.equal(payload.google_keyword, '法人光');
  assert.equal(payload.gclid, 'G123');
  assert.match(payload.campaign, /6.*500円/);
  assert.ok(Number.isFinite(Date.parse(payload.submittedAt)));
  assert.equal(payload.attribution, undefined, 'Zapier needs top-level attribution, not [object Object]');
  assert.ok(f.timers.some(timer => timer.ms === 15000));
  assert.ok(f.clearedTimers.length > 0);
  assert.equal(f.form.dataset.submitted, 'true');
  noAdvertising(f);
});

test('Tokai area inquiries retain the separate offer and a complete address', async () => {
  const f = mount({route:'tokai', inquiryType:'area', fields:{prefecture:'愛知県', address:'名古屋市中区1-1'}});
  await f.form.fire('submit');
  assert.equal(f.calls.length, 1);
  const payload = f.calls[0].payload;
  assert.equal(payload.campaign_route, 'tokai');
  assert.equal(payload.formType, 'area');
  assert.equal(payload.fullAddress, '愛知県名古屋市中区1-1');
  assert.match(payload.campaign, /6.*0円.*3万/);
  assert.equal(payload.audience_type, 'personal');
  assert.equal(payload.ads_conversion_eligible, 'false');
  noAdvertising(f);
});

test('empty required inputs, invalid phone/email, missing consent and missing area address never send', async () => {
  const cases = [
    {fields:{name:''}}, {fields:{name:'   '}}, {fields:{phone:'12345'}},
    {fields:{phone:'1234567890123456'}}, {fields:{email:'invalid'}},
    {fields:{prefecture:''}}, {consent:false}, {inquiryType:'area', fields:{address:''}}
  ];
  for (const options of cases) {
    const f = mount(options);
    await f.form.fire('submit');
    assert.equal(f.calls.length, 0, JSON.stringify(options));
    assert.notEqual(f.form.dataset.submitted, 'true');
    assert.equal(f.button.disabled, false);
    noAdvertising(f);
  }
});

test('double clicks during submission and after success produce only one webhook request', async () => {
  let finish;
  const f = mount({fetchImpl:() => new Promise(resolve => { finish = resolve; })});
  const first = f.form.fire('submit');
  assert.equal(f.calls.length, 1);
  assert.equal(f.button.disabled, true);
  await f.form.fire('submit');
  assert.equal(f.calls.length, 1);
  finish({type:'opaque'});
  await first;
  assert.equal(f.form.dataset.submitted, 'true');
  await f.form.fire('submit');
  assert.equal(f.calls.length, 1);
  noAdvertising(f);
});

test('failed transport restores the form and permits a deliberate retry without CV events', async () => {
  let attempts = 0;
  const f = mount({fetchImpl:() => ++attempts === 1 ? Promise.reject(new TypeError('Offline')) : Promise.resolve({type:'opaque'})});
  await f.form.fire('submit');
  assert.equal(f.button.disabled, false);
  assert.equal(f.label.textContent, '送信する');
  assert.notEqual(f.form.dataset.submitted, 'true');
  assert.match(f.status.textContent, /送信できません|送信に失敗/);
  await f.form.fire('submit');
  assert.equal(f.calls.length, 2);
  assert.equal(f.form.dataset.submitted, 'true');
  noAdvertising(f);
});

test('15-second timeout aborts transport and restores the form without reporting success', async () => {
  const f = mount({fetchImpl:({init}) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const error = new Error('Aborted'); error.name = 'AbortError'; reject(error);
    });
  })});
  const pending = f.form.fire('submit');
  const timeout = f.timers.find(timer => timer.ms === 15000);
  assert.ok(timeout);
  timeout.callback();
  await pending;
  assert.equal(f.calls[0].init.signal.aborted, true);
  assert.equal(f.button.disabled, false);
  assert.equal(f.label.textContent, '送信する');
  assert.notEqual(f.form.dataset.submitted, 'true');
  assert.match(f.status.textContent, /タイムアウト/);
  noAdvertising(f);
});

test('a fresh Meta visit replaces saved Google attribution and does not invent a Google keyword', async () => {
  const f = mount({
    stored:[['household:attribution:v1', JSON.stringify({utm_source:'google', utm_term:'old', gclid:'OLD'})]],
    search:'?utm_source=facebook&utm_medium=paid_social&utm_campaign=META_TEST&fbclid=F123'
  });
  await f.form.fire('submit');
  const payload = f.calls[0].payload;
  assert.equal(payload.utm_source, 'facebook');
  assert.equal(payload.utm_campaign, 'META_TEST');
  assert.equal(payload.fbclid, 'F123');
  assert.ok(!payload.gclid);
  assert.ok(!payload.google_keyword);
  assert.ok(!payload.utm_term);
  noAdvertising(f);
});

test('blocked storage and full-width phone input do not prevent a valid personal inquiry', async () => {
  const f = mount({blockedStorage:true, fields:{phone:'０９０－１２３４－５６７８'}, search:'?utm_source=google&keyword=test_keyword'});
  await f.form.fire('submit');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].payload.google_keyword, 'test_keyword');
  assert.equal(f.calls[0].payload.audience_type, 'personal');
  noAdvertising(f);
});

test('the business form sends the same endpoint with business metadata and emits only its completed form lead', async () => {
  const form = new Element();
  form.dataset.webhook = endpoint;
  const fields = {
    inquiryType:'consultation', company:'検証用株式会社', name:'テスト 担当者',
    phone:'090-1234-5678', email:'test@example.invalid', privacyConsent:'on',
    audience_type:'personal', audience_label:'改ざん値', campaign_route:'tokai', ads_conversion_eligible:'false'
  };
  const selection = {value:'consultation'};
  const status = new Element(); const button = new Element(); const label = new Element();
  const phone = new Element();
  const complete = new Element(); complete.hidden = true;
  const completeTitle = new Element();
  complete.querySelector = selector => selector === 'h3' ? completeTitle : null;
  form.querySelector = selector => {
    if (selector === '[name=inquiryType]:checked') return selection;
    if (selector === '.form-status') return status;
    if (selector === '[type=submit]') return button;
    if (selector === '[name=company]') return new Element();
    throw new Error(`Unexpected business form selector: ${selector}`);
  };
  form.querySelectorAll = () => [];
  form.checkValidity = () => true;
  form.reportValidity = () => true;
  form.reset = () => { selection.value = 'consultation'; };
  const elements = new Map([
    ['#lead-form', form], ['#address-fields', new Element()], ['#submit-label', label],
    ['.form-complete', complete], ['.mobile-sticky', new Element()], ['#prefecture', new Element()],
    ['#postal-code', new Element()], ['#reset-form', new Element()]
  ]);
  const document = {
    querySelector(selector) {
      assert.ok(elements.has(selector), `Unexpected business document selector: ${selector}`);
      return elements.get(selector);
    },
    querySelectorAll(selector) { return selector === 'a[href^="tel:"]' ? [phone] : []; },
    createElement() { return new Element(); }
  };
  const window = {
    location:{search:'?utm_source=google&utm_campaign=BUSINESS_TEST'}, dataLayer:[],
    OshigotoAttribution:require('./attribution.js'),
    LpAudience:{isBusiness:() => true, isPreview:() => false, canTrack:() => true},
    setTimeout() { return 1; }, clearTimeout() {}
  };
  class BusinessFormData {
    constructor(node) { assert.equal(node, form); }
    entries() { return Object.entries(fields)[Symbol.iterator](); }
  }
  const calls = [];
  let finish;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8'), {
    window, document, URLSearchParams, AbortController, FormData:BusinessFormData,
    fetch(url, init) {
      calls.push({url, init, payload:Object.fromEntries(init.body.entries())});
      return new Promise(resolve => { finish = resolve; });
    }
  }, {filename:'app.js'});
  const click = await phone.fire('click');
  assert.equal(click.defaultPrevented, false);
  assert.equal(calls.length, 0);
  assert.equal(window.dataLayer.length, 0);
  const submission = form.fire('submit');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, endpoint);
  const payload = calls[0].payload;
  assert.equal(payload.audience_type, 'business');
  assert.equal(payload.audience_label, '法人・個人事業主');
  assert.equal(payload.campaign_route, 'business');
  assert.equal(payload.ads_conversion_eligible, 'true');
  assert.equal(payload.formType, 'consultation');
  assert.equal(payload.utm_campaign, 'BUSINESS_TEST');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.mode, 'no-cors');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(window.dataLayer.length, 0, 'pending form requests must not emit a lead');
  finish({type:'opaque'});
  await submission;
  assert.equal(window.dataLayer.length, 1);
  assert.equal(window.dataLayer[0].event, 'lead_form_submit');
  assert.equal(window.dataLayer[0].audience_type, 'business');
  assert.equal(window.dataLayer[0].form_type, 'consultation');
  assert.equal(form.hidden, true);
  assert.equal(complete.hidden, false);
});
