(() => {
  const forms = document.querySelectorAll('.lead-form');
  const pushDataLayerEvent = (eventName, eventData = {}) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...eventData });
  };

  const setStatus = (form, message, isError = false) => {
    const status = form.querySelector('.form-status');
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  };

  const normalizePostalCode = (value) => value.replace(/\D/g, '').slice(0, 7);

  // 2026年9月時点の公式公開地域をもとにした保守的な簡易データ。
  // 市区町村が一致しても、番地・建物・設備状況によって提供できない場合がある。
  const provisionalAreaMunicipalities = `
    札幌市 函館市 旭川市 青森市 八戸市 盛岡市 仙台市 秋田市 山形市 米沢市
    福島市 郡山市 いわき市 水戸市 つくば市 宇都宮市 高崎市 前橋市 さいたま市
    川口市 川越市 千葉市 市川市 船橋市 松戸市 柏市 横浜市 川崎市 相模原市
    藤沢市 横須賀市 新潟市 長岡市 甲府市 長野市 富山市 高岡市 金沢市 福井市
    岐阜市 大垣市 静岡市 浜松市 沼津市 富士市 名古屋市 豊橋市 岡崎市 一宮市
    豊田市 津市 四日市市 大津市 京都市 宇治市 大阪市 堺市 豊中市 吹田市
    高槻市 東大阪市 神戸市 姫路市 尼崎市 西宮市 奈良市 和歌山市 鳥取市
    米子市 松江市 出雲市 岡山市 倉敷市 広島市 福山市 山口市 下関市 徳島市
    高松市 松山市 高知市 福岡市 北九州市 久留米市 佐賀市 長崎市 佐世保市
    熊本市 大分市 宮崎市 鹿児島市 那覇市 浦添市 沖縄市
  `.trim().split(/\s+/);
  const tokyoLikelyAreas = `
    千代田区 中央区 港区 新宿区 文京区 台東区 墨田区 江東区 品川区 目黒区
    大田区 世田谷区 渋谷区 中野区 杉並区 豊島区 北区 荒川区 板橋区 練馬区
    足立区 葛飾区 江戸川区 三鷹市 調布市 府中市 武蔵野市 町田市 立川市 八王子市
  `.trim().split(/\s+/);

  const normalizeMunicipality = (value) => value.replace(/[\s　]/g, '').replace(/ヶ/g, 'ケ');

  const getPreliminaryAreaResult = (prefecture, city) => {
    const normalizedCity = normalizeMunicipality(city);
    const candidates = [...provisionalAreaMunicipalities, ...(prefecture === '東京都' ? tokyoLikelyAreas : [])];
    const matched = candidates.some((name) => normalizedCity.includes(normalizeMunicipality(name)));

    return matched
      ? {
          value: '提供可能性あり（簡易判定）',
          title: '提供可能性があります',
          description: `${prefecture}${city}は、10G光回線の公開提供地域に含まれる可能性があります。続けて連絡先をご入力ください。`,
          className: 'is-likely'
        }
      : {
          value: '詳細確認が必要（簡易判定）',
          title: '詳細確認が必要です',
          description: `${prefecture}${city}は、簡易データだけでは提供可否を確認できません。担当者が個別確認しますので、続けて連絡先をご入力ください。`,
          className: 'is-review'
        };
  };

  const showAreaContactStep = (form) => {
    const addressStep = form.querySelector('[data-area-step="address"]');
    const contactStep = form.querySelector('[data-area-step="contact"]');
    const addressFields = [...addressStep.querySelectorAll('input, select')];
    const invalidField = addressFields.find((field) => !field.checkValidity());

    if (invalidField) {
      invalidField.reportValidity();
      setStatus(form, '住所の未入力または入力形式に誤りがある項目をご確認ください。', true);
      return;
    }

    const result = getPreliminaryAreaResult(form.elements.prefecture.value, form.elements.city.value);
    const resultCard = form.querySelector('[data-area-result-card]');
    resultCard.classList.remove('is-likely', 'is-review');
    resultCard.classList.add(result.className);
    form.querySelector('[data-area-result-title]').textContent = result.title;
    form.querySelector('[data-area-result-description]').textContent = result.description;
    form.elements.preliminaryResult.value = result.value;
    form.dataset.areaChecked = 'true';
    setStatus(form, '');
    addressStep.hidden = true;
    contactStep.hidden = false;
    contactStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const showCompleteScreen = (form) => {
    const complete = form.parentElement.querySelector(`.form-complete[data-complete-for="${form.dataset.formType}"]`);
    if (!complete) return;
    form.hidden = true;
    complete.hidden = false;
    complete.focus({ preventScroll: true });
    complete.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  document.querySelectorAll('input[name="postalCode"]').forEach((input) => {
    input.addEventListener('input', () => {
      const digits = normalizePostalCode(input.value);
      input.value = digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
    });
  });

  document.querySelectorAll('.postal-lookup').forEach((button) => {
    button.addEventListener('click', async () => {
      const form = button.closest('form');
      const postalCode = normalizePostalCode(form.elements.postalCode.value);
      if (postalCode.length !== 7) {
        setStatus(form, '7桁の郵便番号を入力してください。', true);
        form.elements.postalCode.focus();
        return;
      }

      const originalText = button.textContent;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 8000);
      button.disabled = true;
      button.textContent = '検索中…';
      form.elements.postalCode.value = `${postalCode.slice(0, 3)}-${postalCode.slice(3)}`;
      setStatus(form, '郵便番号から住所を検索しています。');

      try {
        const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Postal API returned ${response.status}`);

        const data = await response.json();
        if (data.status !== 200 || !Array.isArray(data.results) || data.results.length === 0) {
          setStatus(form, '該当する住所が見つかりませんでした。郵便番号をご確認ください。', true);
          form.elements.postalCode.focus();
          return;
        }

        const result = data.results[0];
        form.elements.prefecture.value = result.address1 || '';
        form.elements.city.value = result.address2 || '';
        form.elements.street.value = result.address3 || '';
        [form.elements.prefecture, form.elements.city, form.elements.street].forEach((field) => {
          field.dispatchEvent(new Event('change', { bubbles: true }));
        });

        const needsConfirmation = data.results.length > 1;
        const needsStreet = !result.address3;
        const message = needsConfirmation
          ? '複数の町域がある郵便番号です。住所候補を入力しましたので、町名・番地をご確認ください。'
          : needsStreet
            ? '都道府県・市区町村を入力しました。続けて町名・番地を入力してください。'
            : '住所を自動入力しました。続けて番地・建物名をご入力ください。';
        setStatus(form, message);
        form.elements.street.focus({ preventScroll: true });
        const streetLength = form.elements.street.value.length;
        form.elements.street.setSelectionRange(streetLength, streetLength);
      } catch (error) {
        console.error('Postal code lookup failed:', error);
        const message = error.name === 'AbortError'
          ? '住所検索がタイムアウトしました。時間をおいて、もう一度お試しください。'
          : '住所を取得できませんでした。通信状況をご確認のうえ、もう一度お試しください。';
        setStatus(form, message, true);
      } finally {
        window.clearTimeout(timeoutId);
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });

  document.querySelectorAll('.area-check-action').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      showAreaContactStep(button.closest('form'));
    });
  });

  document.querySelectorAll('.area-back').forEach((button) => {
    button.addEventListener('click', () => {
      const form = button.closest('form');
      form.dataset.areaChecked = 'false';
      form.querySelector('[data-area-step="contact"]').hidden = true;
      form.querySelector('[data-area-step="address"]').hidden = false;
      setStatus(form, '');
      form.elements.city.focus({ preventScroll: true });
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.addEventListener('click', (event) => {
    const phoneLink = event.target.closest('a[href^="tel:"]');
    if (!phoneLink) return;
    pushDataLayerEvent('click_to_call', {
      phone_number: '050-1780-2661',
      cta_location: phoneLink.dataset.ctaLocation || 'unknown'
    });
  });

  forms.forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form.dataset.submitting === 'true') return;
      setStatus(form, '');

      if (form.dataset.formType === 'area' && form.dataset.areaChecked !== 'true') {
        showAreaContactStep(form);
        return;
      }

      if (!form.checkValidity()) {
        form.reportValidity();
        setStatus(form, '未入力または入力形式に誤りがある項目をご確認ください。', true);
        return;
      }

      const submitButton = event.submitter || form.querySelector('[type="submit"]');
      const webhook = submitButton?.dataset.webhook?.trim() || form.dataset.webhook?.trim();
      if (!webhook) {
        const message = form.dataset.formType === 'area'
          ? 'エリア確認の受付先は現在準備中です。入力内容は送信されていません。'
          : 'お問い合わせの受付先は現在準備中です。入力内容は送信されていません。';
        setStatus(form, message);
        return;
      }

      const originalText = submitButton.innerHTML;
      form.dataset.submitting = 'true';
      submitButton.disabled = true;
      submitButton.textContent = '送信中…';

      const payload = Object.fromEntries(new FormData(form).entries());
      payload.formType = form.dataset.formType;
      payload.campaign = '最大7万円キャッシュバック';
      if (form.dataset.formType === 'area') {
        payload.submissionStage = 'contact_complete';
        payload.areaCheckMethod = '市区町村単位の簡易判定（2026年9月時点）';
        payload.fullAddress = `${payload.postalCode} ${payload.prefecture}${payload.city}${payload.street}`.trim();
      }
      payload.submittedAt = new Date().toISOString();

      try {
        const requestBody = new URLSearchParams();
        Object.entries(payload).forEach(([key, value]) => requestBody.append(key, value));

        // Zapier Catch Hookのレスポンスは、file:// やGitHub Pagesからの
        // クロスオリジン送信時にブラウザ側で読み取りを拒否される場合がある。
        // no-corsで一度だけ送信し、読めないレスポンスを成功判定に使わない。
        await fetch(webhook, {
          method: 'POST',
          mode: 'no-cors',
          credentials: 'omit',
          body: requestBody
        });
        pushDataLayerEvent('lead_form_submit', {
          form_type: form.dataset.formType
        });
        form.reset();
        const successMessage = form.dataset.formType === 'area'
          ? '10G光回線の提供エリア確認依頼を送信しました。提供可否を確認後、担当者よりご案内します。'
          : 'お問い合わせを送信しました。担当者よりご連絡します。';
        setStatus(form, successMessage);
        showCompleteScreen(form);
      } catch (error) {
        console.error(error);
        setStatus(form, '送信できませんでした。時間をおいて、もう一度お試しください。', true);
      } finally {
        form.dataset.submitting = 'false';
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
      }
    });
  });
})();
