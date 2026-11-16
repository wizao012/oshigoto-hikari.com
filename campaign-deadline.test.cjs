'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {monthEndJst, start} = require('./campaign-deadline.js');

test('the current month ends on its correct calendar day in Japan', () => {
  const deadline = monthEndJst('2026-10-26T00:00:00Z');
  assert.deepEqual(deadline, {
    year: 2026, month: 10, day: 31,
    isoDate: '2026-10-31', text: '10月31日',
    nextMonthAt: Date.parse('2026-10-31T15:00:00Z')
  });
  assert.equal(monthEndJst('2026-04-12T00:00:00Z').day, 30);
  assert.equal(monthEndJst('2026-02-12T00:00:00Z').day, 28);
  assert.equal(monthEndJst('2028-02-12T00:00:00Z').day, 29);
});

test('the campaign changes months at midnight in Japan, including the new year', () => {
  assert.equal(monthEndJst('2026-10-31T14:59:59.999Z').text, '10月31日');
  assert.equal(monthEndJst('2026-10-31T15:00:00.000Z').text, '11月30日');
  assert.equal(monthEndJst('2026-12-31T14:59:59.999Z').isoDate, '2026-12-31');
  const january = monthEndJst('2026-12-31T15:00:00.000Z');
  assert.equal(january.isoDate, '2027-01-31');
  assert.equal(january.nextMonthAt, Date.parse('2027-01-31T15:00:00Z'));
});

test('invalid dates are rejected rather than rendering NaN', () => {
  assert.throws(() => monthEndJst(new Date(NaN)), RangeError);
  assert.throws(() => monthEndJst('not-a-date'), RangeError);
});

function eventTarget() {
  const handlers = new Map();
  return {
    addEventListener(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(handler);
    },
    removeEventListener(type, handler) { handlers.get(type)?.delete(handler); },
    emit(type) { for (const handler of handlers.get(type) || []) handler(); }
  };
}

function browserFixture(instant, readyState = 'complete') {
  const clock = {now: Date.parse(instant)};
  const month = {textContent: '10'};
  const day = {textContent: '31'};
  const unit = {textContent: '月', className: 'deadline-unit'};
  const date = {
    tagName: 'TIME', attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    querySelectorAll(selector) {
      return selector === '[data-deadline-month]' ? [month]
        : selector === '[data-deadline-day]' ? [day] : [];
    }
  };
  const compact = {tagName: 'SPAN', textContent: ''};
  const document = {
    ...eventTarget(), readyState, visibilityState: 'visible',
    querySelectorAll(selector) {
      return selector === '[data-campaign-deadline]' ? [date]
        : selector === '[data-campaign-deadline-text]' ? [compact] : [];
    }
  };
  let nextTimer = 0;
  const timers = new Map();
  const browser = {
    ...eventTarget(), document,
    Date: class extends Date { constructor() { super(clock.now); } },
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, {callback, delay});
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };
  return {browser, clock, month, day, unit, date, compact, timers};
}

test('the scheduled JST rollover refreshes date hooks while preserving styled units', () => {
  const fixture = browserFixture('2026-10-31T14:59:59.000Z');
  const stop = start(fixture.browser);
  assert.equal(fixture.date.attributes.datetime, '2026-10-31');
  assert.equal(fixture.compact.textContent, '10月31日');
  const timer = [...fixture.timers.values()][0];
  assert.equal(timer.delay, 1050);
  fixture.clock.now = Date.parse('2026-10-31T15:00:00.050Z');
  timer.callback();
  assert.equal(fixture.month.textContent, '11');
  assert.equal(fixture.day.textContent, '30');
  assert.equal(fixture.date.attributes.datetime, '2026-11-30');
  assert.equal(fixture.compact.textContent, '11月30日');
  assert.deepEqual(fixture.unit, {textContent: '月', className: 'deadline-unit'});
  assert.equal(fixture.timers.size, 1);
  stop();
  assert.equal(fixture.timers.size, 0);
});

test('long waits stay within browser limits and a returning page refreshes immediately', () => {
  const fixture = browserFixture('2026-09-30T15:00:00Z', 'loading');
  const stop = start(fixture.browser);
  assert.equal(fixture.timers.size, 0);
  fixture.browser.document.emit('DOMContentLoaded');
  assert.equal([...fixture.timers.values()][0].delay, 2147483647);
  fixture.browser.emit('pagehide');
  assert.equal(fixture.timers.size, 0);
  fixture.clock.now = Date.parse('2027-01-01T00:00:00Z');
  fixture.browser.emit('pageshow');
  assert.equal(fixture.date.attributes.datetime, '2027-01-31');
  fixture.clock.now = Date.parse('2027-02-01T00:00:00Z');
  fixture.browser.emit('focus');
  assert.equal(fixture.date.attributes.datetime, '2027-02-28');
  fixture.clock.now = Date.parse('2027-03-01T00:00:00Z');
  fixture.browser.document.emit('visibilitychange');
  assert.equal(fixture.date.attributes.datetime, '2027-03-31');
  assert.equal(fixture.timers.size, 1);
  stop();
});
