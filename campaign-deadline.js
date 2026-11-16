(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.FletsWestCampaignDeadline = api;
    if (root.document) api.start(root);
  }
})(typeof window !== 'undefined' ? window : globalThis, () => {
  'use strict';

  const JST_OFFSET = 9 * 60 * 60 * 1000;
  const MAX_TIMEOUT = 2147483647;

  function monthEndJst(value = new Date()) {
    const instant = value instanceof Date ? value.getTime() : new Date(value).getTime();
    if (!Number.isFinite(instant)) throw new RangeError('A valid date is required.');
    const local = new Date(instant + JST_OFFSET);
    const year = local.getUTCFullYear();
    const month = local.getUTCMonth() + 1;
    const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      year, month, day,
      isoDate: `${year}-${String(month).padStart(2, '0')}-${day}`,
      text: `${month}月${day}日`,
      nextMonthAt: Date.UTC(year, month, 1) - JST_OFFSET
    };
  }

  function start(browser) {
    const doc = browser.document;
    let timer = null;
    let started = false;

    function clearTimer() {
      if (timer !== null) browser.clearTimeout(timer);
      timer = null;
    }

    function refresh() {
      clearTimer();
      const now = new browser.Date();
      const deadline = monthEndJst(now);

      // Keep each number separate from its styled unit (月 / 日).
      // <time data-campaign-deadline> may contain any number of these hooks.
      doc.querySelectorAll('[data-campaign-deadline]').forEach(element => {
        element.querySelectorAll('[data-deadline-month]').forEach(node => {
          node.textContent = String(deadline.month);
        });
        element.querySelectorAll('[data-deadline-day]').forEach(node => {
          node.textContent = String(deadline.day);
        });
        if (element.tagName.toLowerCase() === 'time') {
          element.setAttribute('datetime', deadline.isoDate);
        }
      });
      doc.querySelectorAll('[data-campaign-deadline-text]').forEach(element => {
        element.textContent = deadline.text;
        if (element.tagName.toLowerCase() === 'time') {
          element.setAttribute('datetime', deadline.isoDate);
        }
      });

      // Browsers cap timeout delays at about 24.8 days. Longer months need one
      // intermediate wake-up before the actual midnight-JST month boundary.
      const delay = Math.min(MAX_TIMEOUT, deadline.nextMonthAt - now.getTime() + 50);
      timer = browser.setTimeout(refresh, Math.max(1, delay));
    }

    function onVisibilityChange() {
      if (doc.visibilityState === 'visible') refresh();
    }

    function initialize() {
      if (started) return;
      started = true;
      refresh();
      doc.addEventListener('visibilitychange', onVisibilityChange);
      browser.addEventListener('focus', refresh);
      browser.addEventListener('pageshow', refresh);
      browser.addEventListener('pagehide', clearTimer);
    }

    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', initialize, {once: true});
    } else initialize();

    return function stop() {
      clearTimer();
      doc.removeEventListener('DOMContentLoaded', initialize);
      doc.removeEventListener('visibilitychange', onVisibilityChange);
      browser.removeEventListener('focus', refresh);
      browser.removeEventListener('pageshow', refresh);
      browser.removeEventListener('pagehide', clearTimer);
    };
  }

  return Object.freeze({monthEndJst, start});
});
