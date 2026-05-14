/* ─── DTC Admin — Settings Module (currency, activation email) ───────────── */
'use strict';

const Settings = (() => {
  const CURRENCIES = [
    { code:'USD', symbol:'$',  name:'US Dollar'       },
    { code:'CNY', symbol:'¥',  name:'Chinese Yuan'    },
    { code:'EUR', symbol:'€',  name:'Euro'            },
    { code:'GBP', symbol:'£',  name:'British Pound'   },
    { code:'AED', symbol:'د.إ',name:'UAE Dirham'      },
    { code:'SAR', symbol:'﷼',  name:'Saudi Riyal'     },
    { code:'PKR', symbol:'₨',  name:'Pakistani Rupee' },
    { code:'INR', symbol:'₹',  name:'Indian Rupee'    },
    { code:'MYR', symbol:'RM', name:'Malaysian Ringgit'},
    { code:'SGD', symbol:'S$', name:'Singapore Dollar' },
    { code:'TRY', symbol:'₺',  name:'Turkish Lira'    },
    { code:'CAD', symbol:'C$', name:'Canadian Dollar'  },
    { code:'AUD', symbol:'A$', name:'Australian Dollar'},
  ];

  const load = async () => {
    const d = await api(`/admin/settings?adminKey=${encodeURIComponent(Store.adminKey)}`);
    if (!d || d.error) return;
    Store.setSettings(d);
    _renderCurrencyDropdown(d.currency);
    _renderActivationTemplateDropdown(d.activationEmailTemplateId);
    _updateCurrencyPreview(d);
    const reminderEl = document.getElementById('auto-reminders-enabled');
    if (reminderEl) reminderEl.checked = !d.autoRemindersDisabled;
  };

  const _renderCurrencyDropdown = (currentCode) => {
    const sel = document.getElementById('currency-select');
    if (!sel) return;
    sel.innerHTML = CURRENCIES.map(c =>
      `<option value="${c.code}" ${c.code === currentCode ? 'selected' : ''}>${c.symbol} ${c.name} (${c.code})</option>`
    ).join('');
  };

  const _renderActivationTemplateDropdown = (currentId) => {
    const sel = document.getElementById('activation-template-select');
    if (!sel) return;
    const templates = Store.templates || [];
    sel.innerHTML = '<option value="">— No auto email —</option>' +
      templates.map(t =>
        `<option value="${t.id}" ${t.id === currentId ? 'selected' : ''}>${esc(t.name)}</option>`
      ).join('');
  };

  const _updateCurrencyPreview = (settings) => {
    const el = document.getElementById('currency-preview');
    if (!el) return;
    const c = CURRENCIES.find(x => x.code === (settings.currency || 'USD')) || CURRENCIES[0];
    el.textContent = `Example: ${c.symbol}29.99`;
  };

  const save = async () => {
    const currCode = document.getElementById('currency-select')?.value || 'USD';
    const tmplId   = document.getElementById('activation-template-select')?.value || '';
    const remindersDisabled = !(document.getElementById('auto-reminders-enabled')?.checked ?? true);
    const c = CURRENCIES.find(x => x.code === currCode) || CURRENCIES[0];
    const settings = {
      currency:                   c.code,
      currencySymbol:             c.symbol,
      currencyName:               c.name,
      activationEmailTemplateId:  tmplId,
      autoRemindersDisabled:      remindersDisabled,
    };
    const d = await api('/admin/settings', { adminKey: Store.adminKey, settings });
    showMsg('settings-ok', 'settings-err', d && d.success,
      d && d.success ? '✓ Settings saved.' : 'Failed to save.');
    if (d && d.success) {
      Store.setSettings({ ...(Store.settings || {}), ...settings });
      _updateCurrencyPreview(settings);
      // Re-render pages that show prices so currency change is immediate
      try { Dashboard.render(); } catch(e) {}
      try { Revenue.render();   } catch(e) {}
      try { Products.render();  } catch(e) {}
    }
  };

  const changeKey = async () => {
    const current  = document.getElementById('key-current')?.value  || '';
    const newKey   = document.getElementById('key-new')?.value      || '';
    const confirm  = document.getElementById('key-confirm')?.value  || '';
    const okEl     = document.getElementById('key-ok');
    const errEl    = document.getElementById('key-err');
    okEl.classList.remove('show'); errEl.classList.remove('show');

    if (!current)                    { errEl.textContent = 'Please enter your current password.'; errEl.classList.add('show'); return; }
    if (newKey.length < 6)           { errEl.textContent = 'New password must be at least 6 characters.'; errEl.classList.add('show'); return; }
    if (newKey !== confirm)          { errEl.textContent = 'New passwords do not match.'; errEl.classList.add('show'); return; }

    const d = await api('/admin/change-key', { adminKey: Store.adminKey, newKey });
    if (d && d.success) {
      Store.setAdminKey(newKey);
      okEl.textContent = '✓ Password changed. Use the new password next time you log in.';
      okEl.classList.add('show');
      document.getElementById('key-current').value = '';
      document.getElementById('key-new').value     = '';
      document.getElementById('key-confirm').value = '';
    } else {
      errEl.textContent = (d && d.error) || 'Failed to change password.';
      errEl.classList.add('show');
    }
  };

  // Populate template dropdown when templates are loaded
  const refreshTemplateDropdown = () => {
    const current = (Store.settings || {}).activationEmailTemplateId || '';
    _renderActivationTemplateDropdown(current);
  };

  const downloadBackup = (e) => {
    e.preventDefault();
    const key = encodeURIComponent(Store.adminKey);
    const a = document.createElement('a');
    a.href = `/admin/backup?adminKey=${key}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const restoreBackup = async () => {
    const fileInput = document.getElementById('restore-file');
    const okEl  = document.getElementById('restore-ok');
    const errEl = document.getElementById('restore-err');
    okEl.classList.remove('show'); errEl.classList.remove('show');

    const file = fileInput.files[0];
    if (!file) return;

    let bundle;
    try {
      const text = await file.text();
      bundle = JSON.parse(text);
    } catch {
      errEl.textContent = 'Invalid file — could not parse JSON.';
      errEl.classList.add('show');
      fileInput.value = '';
      return;
    }

    if (!bundle._meta || !bundle.tokens) {
      errEl.textContent = 'This does not look like a valid DTC backup file.';
      errEl.classList.add('show');
      fileInput.value = '';
      return;
    }

    if (!confirm(`Restore backup from ${bundle._meta.exportedAt?.slice(0,10) || 'unknown date'}?\n\nThis will overwrite ALL current data. This cannot be undone.`)) {
      fileInput.value = '';
      return;
    }

    const d = await api('/admin/restore', { adminKey: Store.adminKey, bundle });
    fileInput.value = '';
    if (d && d.success) {
      okEl.textContent = '✓ Restore complete. Reloading data…';
      okEl.classList.add('show');
      setTimeout(async () => { await Dashboard.reload(); okEl.textContent = '✓ Data restored and reloaded successfully.'; }, 1200);
    } else {
      errEl.textContent = (d && d.error) || 'Restore failed.';
      errEl.classList.add('show');
    }
  };

  return { load, save, changeKey, downloadBackup, restoreBackup, refreshTemplateDropdown, CURRENCIES };
})();
