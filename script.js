(() => {
  const forms = document.querySelectorAll('.lead-form');

  const setStatus = (form, message, isError = false) => {
    const status = form.querySelector('.form-status');
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  };

  const normalizePostalCode = (value) => value.replace(/\D/g, '').slice(0, 7);

  document.querySelectorAll('input[name="postalCode"]').forEach((input) => {
    input.addEventListener('input', () => {
      const digits = normalizePostalCode(input.value);
      input.value = digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
    });
  });

  document.querySelectorAll('.postal-lookup').forEach((button) => {
    button.addEventListener('click', () => {
      const form = button.closest('form');
      const postalCode = normalizePostalCode(form.elements.postalCode.value);
      if (postalCode.length !== 7) {
        setStatus(form, '7桁の郵便番号を入力してください。', true);
        form.elements.postalCode.focus();
        return;
      }
      setStatus(form, '住所の自動入力機能は現在準備中です。続けて都道府県・市区町村・町名番地を入力してください。');
    });
  });

  forms.forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus(form, '');

      if (!form.checkValidity()) {
        form.reportValidity();
        setStatus(form, '未入力または入力形式に誤りがある項目をご確認ください。', true);
        return;
      }

      const webhook = form.dataset.webhook?.trim();
      if (!webhook) {
        const message = form.dataset.formType === 'area'
          ? 'エリア確認の受付先は現在準備中です。入力内容は送信されていません。'
          : '無料相談の受付先は現在準備中です。入力内容は送信されていません。';
        setStatus(form, message);
        return;
      }

      const submitButton = form.querySelector('[type="submit"]');
      const originalText = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.textContent = '送信中…';

      const payload = Object.fromEntries(new FormData(form).entries());
      payload.formType = form.dataset.formType;
      payload.submittedAt = new Date().toISOString();

      try {
        const response = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        form.reset();
        const successMessage = form.dataset.formType === 'area'
          ? 'エリア確認を受け付けました。提供可否を確認後、担当者よりご案内します。'
          : '無料相談を受け付けました。担当者よりご連絡します。';
        setStatus(form, successMessage);
      } catch (error) {
        console.error(error);
        setStatus(form, '送信できませんでした。時間をおいて、もう一度お試しください。', true);
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
      }
    });
  });
})();
