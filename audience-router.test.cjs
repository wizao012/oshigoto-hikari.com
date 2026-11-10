'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {createRouter, campaignUrl, STORAGE_KEY} = require('./audience-router.js');

class Element {
  constructor(dataset = {}, attributes = {}) {
    this.dataset = dataset;
    this.attributes = {...attributes};
    this.handlers = new Map();
    this.hidden = false;
    this.open = false;
    this.textContent = '';
    this.tagName = 'BUTTON';
    this.classList = {toggle() {}};
  }
  addEventListener(name, fn) {
    const handlers = this.handlers.get(name) || [];
    handlers.push(fn); this.handlers.set(name, handlers);
  }
  async fire(name) {
    const event = {defaultPrevented:false, preventDefault() { this.defaultPrevented = true; }};
    for (const fn of this.handlers.get(name) || []) await fn(event);
    return event;
  }
  setAttribute(name, value) { this.attributes[name] = value; if (name === 'open') this.open = true; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; if (name === 'open') this.open = false; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus() { this.focused = true; }
}

function fixture({href = 'https://example.test/', remembered = false, blockedStorage = false, config = {}} = {}) {
  const dialog = new Element();
  const purpose = new Element({audienceStep:'purpose'});
  const personal = new Element({audienceStep:'personal'});
  const businessButton = new Element({audienceChoice:'business'});
  const personalButton = new Element({audienceChoice:'personal'});
  const nationwide = new Element({campaignRoute:'nationwide'}, {href:'household/'});
  nationwide.tagName = 'A';
  const tokai = new Element({campaignRoute:'tokai'});
  const back = new Element(); const reopen = new Element();
  const title = new Element(); title.id = 'audience-title';
  const personalTitle = new Element(); personalTitle.id = 'personal-title';
  const tokaiStatus = new Element();
  const elements = new Map([
    ['#audience-dialog', dialog], ['#audience-title', title], ['#personal-title', personalTitle],
    ['#tokai-route-status', tokaiStatus]
  ]);
  const groups = new Map([
    ['[data-audience-step]', [purpose, personal]],
    ['[data-audience-choice]', [businessButton, personalButton]],
    ['[data-audience-back]', [back]], ['[data-open-audience]', [reopen]],
    ['[data-campaign-route]', [nationwide, tokai]]
  ]);
  const scripts = []; const navigations = [];
  const records = new Map(remembered ? [[STORAGE_KEY, 'business']] : []);
  const storage = {
    getItem(key) { return records.get(key) ?? null; },
    setItem(key, value) { records.set(key, value); },
    removeItem(key) { records.delete(key); }
  };
  const rootClasses = new Set();
  const doc = {
    documentElement: {dataset:{}, classList:{add(value) { rootClasses.add(value); }, remove(value) { rootClasses.delete(value); }, contains(value) { return rootClasses.has(value); }}}, head: {appendChild(node) { scripts.push(node); }},
    querySelector(selector) { return elements.get(selector) || null; },
    querySelectorAll(selector) { return groups.get(selector) || []; },
    createElement() { return new Element(); }
  };
  const win = {
    location: {href, assign(url) { navigations.push(url); }},
    history: {replaceState(_state, _title, path) { win.location.href = new URL(path, win.location.href).href; }}
  };
  Object.defineProperty(win, 'sessionStorage', {get() { if (blockedStorage) throw new Error('Blocked'); return storage; }});
  const settings = {previewMode:true, businessMeasurementEnabled:false, businessGtmId:'GTM-5VTFWXV6', tokaiUrl:'', ...config};
  const router = createRouter(win, doc, settings);
  win.LpAudience = router;
  return {win, doc, router, dialog, purpose, personal, businessButton, personalButton, nationwide, tokai, back, reopen, tokaiStatus, scripts, navigations, records, elements, groups};
}

test('arrival and personal choice do not create an advertising data layer or load GTM', async () => {
  const f = fixture({config:{previewMode:false, businessMeasurementEnabled:true}});
  assert.equal(f.dialog.open, true);
  assert.equal(f.doc.documentElement.classList.contains('audience-modal-open'), true);
  assert.equal(f.router.isBusiness(), false);
  assert.equal(f.win.dataLayer, undefined);
  await f.personalButton.fire('click');
  assert.equal(f.personal.hidden, false);
  assert.equal(f.purpose.hidden, true);
  assert.equal(f.router.isBusiness(), false);
  assert.equal(f.scripts.length, 0);
  assert.equal(f.win.dataLayer, undefined);
});

test('enabled production measurement starts once after business selection, with business context first', async () => {
  const f = fixture({config:{previewMode:false, businessMeasurementEnabled:true}});
  await f.businessButton.fire('click');
  await f.businessButton.fire('click');
  assert.equal(f.scripts.length, 1);
  assert.match(f.scripts[0].src, /^https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=GTM-5VTFWXV6$/);
  assert.deepEqual(f.win.dataLayer[0], {audience_type:'business'});
  assert.equal(f.win.dataLayer[1].event, 'gtm.js');
  assert.equal(f.router.canTrack(), true);
  assert.equal(f.dialog.open, false);
  assert.equal(f.doc.documentElement.classList.contains('audience-modal-open'), false);
  assert.equal(f.records.get(STORAGE_KEY), 'business');
});

test('preview and the measurement kill switch independently block GTM for business', async () => {
  for (const config of [
    {previewMode:true, businessMeasurementEnabled:true},
    {previewMode:false, businessMeasurementEnabled:false}
  ]) {
    const f = fixture({config});
    await f.businessButton.fire('click');
    assert.equal(f.router.isBusiness(), true);
    assert.equal(f.router.canTrack(), false);
    assert.equal(f.win.dataLayer, undefined);
    assert.equal(f.scripts.length, 0);
  }
});

test('blocked sessionStorage does not prevent either choice or navigation', async () => {
  const f = fixture({blockedStorage:true});
  await f.businessButton.fire('click');
  assert.equal(f.router.isBusiness(), true);
  f.router.open();
  await f.personalButton.fire('click');
  await f.nationwide.fire('click');
  assert.equal(f.navigations[0], 'https://example.test/household/');
  assert.equal(f.router.isBusiness(), false);
});

test('business is remembered until personal is selected; choose=1 forces a fresh choice', async () => {
  const returning = fixture({remembered:true});
  assert.equal(returning.router.isBusiness(), true);
  assert.equal(returning.dialog.open, false);
  const forced = fixture({remembered:true, href:'https://example.test/?choose=1&utm_source=google#campaign'});
  assert.equal(forced.router.isBusiness(), false);
  assert.equal(forced.dialog.open, true);
  await forced.personalButton.fire('click');
  assert.equal(forced.records.has(STORAGE_KEY), false);
  await forced.back.fire('click');
  assert.equal(forced.purpose.hidden, false);
  assert.equal(forced.personal.hidden, true);
  await forced.businessButton.fire('click');
  assert.equal(forced.win.location.href, 'https://example.test/?utm_source=google#campaign');
});

test('reopening after GTM has run uses a full navigation before the choice changes', async () => {
  const f = fixture({config:{previewMode:false, businessMeasurementEnabled:true}, href:'https://example.test/?utm_campaign=autumn#faq'});
  await f.businessButton.fire('click');
  await f.reopen.fire('click');
  assert.equal(f.navigations.length, 1);
  const target = new URL(f.navigations[0]);
  assert.equal(target.searchParams.get('choose'), '1');
  assert.equal(target.searchParams.get('utm_campaign'), 'autumn');
  assert.equal(target.hash, '#faq');
  assert.equal(f.scripts.length, 1);
});

test('campaign navigation preserves only advertising parameters, excludes choose and unrelated data', async () => {
  const f = fixture({href:'https://example.test/?choose=1&utm_source=google&utm_term=%E6%B3%95%E4%BA%BA%E5%85%89&gclid=G-1&email=private@example.test&redirect=https://bad.test#inquiry'});
  await f.personalButton.fire('click');
  await f.nationwide.fire('click');
  const url = new URL(f.navigations[0]);
  assert.equal(url.pathname, '/household/');
  assert.equal(url.searchParams.get('utm_source'), 'google');
  assert.equal(url.searchParams.get('utm_term'), '法人光');
  assert.equal(url.searchParams.get('gclid'), 'G-1');
  assert.deepEqual([...url.searchParams.keys()], ['utm_source', 'utm_term', 'gclid']);
  assert.equal(url.hash, '');
});

test('an unset Tokai destination shows an explanation and does not navigate', async () => {
  const f = fixture();
  await f.personalButton.fire('click');
  const click = await f.tokai.fire('click');
  assert.equal(click.defaultPrevented, true);
  assert.equal(f.navigations.length, 0);
  assert.equal(f.tokaiStatus.hidden, false);
  assert.equal(f.tokaiStatus.textContent, 'キャンペーンを表示できませんでした。時間をおいて再度お試しください。');
  assert.equal(f.scripts.length, 0);
});

test('configured Tokai URLs use normal navigation and reject executable URL schemes', async () => {
  const f = fixture({href:'https://example.test/?utm_source=meta&fbclid=F1', config:{tokaiUrl:'https://tokai.example.test/campaign/'}});
  await f.personalButton.fire('click');
  await f.tokai.fire('click');
  assert.equal(f.navigations[0], 'https://tokai.example.test/campaign/?utm_source=meta&fbclid=F1');
  assert.equal(campaignUrl('javascript:alert(1)', f.win.location.href), null);
});

test('the production configuration routes each personal offer without loading business measurement', async () => {
  const context = {window:{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('./audience-config.js'), 'utf8'), context);
  const config = context.window.LpAudienceConfig;
  assert.equal(config.previewMode, false);
  assert.equal(config.businessMeasurementEnabled, true);
  for (const [choice, expectedPath] of [['nationwide', '/household/'], ['tokai', '/household/tokai/']]) {
    const f = fixture({href:'https://example.test/?choose=1&utm_source=google&utm_campaign=november&gclid=G1&email=private@example.test', config});
    await f.personalButton.fire('click');
    await f[choice].fire('click');
    const target = new URL(f.navigations[0]);
    assert.equal(target.origin, 'https://example.test');
    assert.equal(target.pathname, expectedPath);
    assert.equal(target.searchParams.get('utm_campaign'), 'november');
    assert.equal(target.searchParams.get('gclid'), 'G1');
    assert.equal(target.searchParams.has('choose'), false);
    assert.equal(target.searchParams.has('email'), false);
    assert.equal(f.scripts.length, 0);
    assert.equal(f.win.dataLayer, undefined);
    assert.equal(f.router.isBusiness(), false);
  }
});

function mountBusinessApp(f) {
  const form = new Element(); form.checkValidity = () => true;
  const status = new Element(); const selection = {value:'consultation'};
  form.querySelector = selector => selector === '.form-status' ? status : selection;
  form.querySelectorAll = () => [];
  const label = new Element(); const prefecture = new Element(); prefecture.append = () => {};
  const phone = new Element(); const reset = new Element(); const postal = new Element();
  for (const [selector, element] of [
    ['#lead-form', form], ['#address-fields', new Element()], ['#submit-label', label],
    ['.form-complete', new Element()], ['.mobile-sticky', new Element()],
    ['#prefecture', prefecture], ['#postal-code', postal], ['#reset-form', reset]
  ]) f.elements.set(selector, element);
  f.groups.set('a[href^="tel:"]', [phone]);
  let requests = 0;
  vm.runInNewContext(fs.readFileSync(require.resolve('./app.js'), 'utf8'), {
    window:f.win, document:f.doc, fetch() { requests += 1; throw new Error('Unexpected network request'); }
  });
  return {form, status, label, phone, requestCount:() => requests};
}

test('preview form submission and telephone clicks never make requests or publish conversions', async () => {
  const f = fixture();
  const app = mountBusinessApp(f);
  await app.form.fire('submit');
  assert.equal(f.dialog.open, true);
  assert.equal(app.requestCount(), 0);
  await f.businessButton.fire('click');
  await app.form.fire('submit');
  assert.match(app.status.textContent, /プレビュー.*送信されません/);
  const phoneClick = await app.phone.fire('click');
  assert.equal(phoneClick.defaultPrevented, true);
  assert.equal(app.requestCount(), 0);
  assert.equal(f.win.dataLayer, undefined);
  assert.equal(app.label.textContent, '送信する');
  f.router.open();
  await f.personalButton.fire('click');
  await app.form.fire('submit');
  assert.equal(f.router.isBusiness(), false);
  assert.equal(app.requestCount(), 0);
});

test('a business telephone click remains available without adding an advertising event when measurement is enabled', async () => {
  const f = fixture({config:{previewMode:false, businessMeasurementEnabled:true}});
  await f.businessButton.fire('click');
  const app = mountBusinessApp(f);
  const before = JSON.stringify(f.win.dataLayer);
  const phoneClick = await app.phone.fire('click');
  assert.equal(phoneClick.defaultPrevented, false);
  assert.equal(JSON.stringify(f.win.dataLayer), before);
  assert.equal(app.requestCount(), 0);
});
