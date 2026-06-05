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
    _renderPortal(d);
  };

  // ── Activation portal: WhatsApp + slides ───────────────────────────────────
  const _renderPortal = (d) => {
    const wa = document.getElementById('portal-whatsapp');
    if (wa) wa.value = d.whatsapp || '';
    const pm = document.getElementById('payment-methods');
    if (pm) pm.value = (Array.isArray(d.paymentMethods) ? d.paymentMethods : []).join('\n');
    const ps = document.getElementById('portal-panel-size'); if (ps) ps.value = d.portalPanelSize || 'half';
    const pl = document.getElementById('portal-layout');     if (pl) pl.value = d.portalLayout || 'single';
    const pa = document.getElementById('portal-accent');     const pah = document.getElementById('portal-accent-hex');
    if (pa) { pa.value = d.portalAccent || '#2563eb'; if (pah) pah.value = d.portalAccent || '#2563eb'; }
    const pb = document.getElementById('portal-bg');         const pbh = document.getElementById('portal-bg-hex');
    if (pb) { pb.value = d.portalBg || '#f0f4ff'; if (pbh) pbh.value = d.portalBg || '#f0f4ff'; }
    const pan = document.getElementById('portal-anim');      if (pan) pan.value = d.portalAnim || 'full';
    const io = document.getElementById('portal-intro-on');   if (io) io.checked = !!d.portalIntroPopup;
    const it = document.getElementById('portal-intro-title'); if (it) it.value = d.portalIntroTitle || '';
    const ix = document.getElementById('portal-intro-text');  if (ix) ix.value = d.portalIntroText || '';
    _setQR('wechat',   d.portalWechatQR   || '');
    _setQR('whatsapp', d.portalWhatsappQR || '');
    _renderSlides(Array.isArray(d.portalSlides) ? d.portalSlides : []);
  };

  const _slideRowHtml = (s) => `
    <div class="slide-edit-row">
      <div class="slide-edit-head">
        <span class="slide-idx">Slide</span>
        <button class="btn btn-delete btn-sm" onclick="Settings.removeSlide(this)">Remove</button>
      </div>
      <div class="form-row">
        <div class="form-group" style="margin-bottom:0"><label>Title</label><input class="slide-title" placeholder="e.g. Claude Pro — 1 Month" value="${esc(s.title || '')}"/></div>
        <div class="form-group" style="margin-bottom:0"><label>Subtitle</label><input class="slide-text" placeholder="e.g. Unlimited access · tap to order" value="${esc(s.text || '')}"/></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="margin-bottom:0"><label>Price badge <span style="font-weight:400;color:var(--muted)">(optional)</span></label><input class="slide-price" placeholder="e.g. $15 /mo" value="${esc(s.price || '')}"/></div>
        <div class="form-group" style="margin-bottom:0"><label>Tag <span style="font-weight:400;color:var(--muted)">(optional)</span></label><input class="slide-tag" placeholder="e.g. Most popular" value="${esc(s.tag || '')}"/></div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label>Image <span style="font-weight:400;color:var(--muted)">(upload a file or paste a URL)</span></label>
        <div class="slide-image-controls">
          <div class="slide-thumb" style="${s.image ? `background-image:url('${esc(s.image)}')` : ''}"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:.45rem">
            <input class="slide-image" placeholder="https://…/promo.jpg" value="${esc(s.image || '')}" oninput="Settings.syncThumb(this)"/>
            <div style="display:flex;align-items:center;gap:.5rem">
              <input type="file" accept="image/*" class="slide-file" style="display:none" onchange="Settings.uploadSlideImage(this)"/>
              <button class="btn btn-outline btn-sm" type="button" onclick="this.parentElement.querySelector('.slide-file').click()">Upload Image</button>
              <span class="slide-upload-status" style="font-size:.7rem;color:var(--muted)"></span>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  const _renderSlides = (slides) => {
    const wrap = document.getElementById('portal-slides-rows');
    if (!wrap) return;
    wrap.innerHTML = slides.length
      ? slides.map(s => _slideRowHtml(s)).join('')
      : '<div style="font-size:.74rem;color:var(--muted);padding:.4rem 0">No slides yet. Click "+ Add Slide" to create one.</div>';
  };

  const addSlide = () => {
    const wrap = document.getElementById('portal-slides-rows');
    if (!wrap) return;
    if (wrap.querySelector('.slide-edit-row') === null) wrap.innerHTML = '';
    const div = document.createElement('div');
    div.innerHTML = _slideRowHtml({ title: '', text: '', image: '' });
    wrap.appendChild(div.firstElementChild);
  };

  const removeSlide = (btn) => {
    const row = btn.closest('.slide-edit-row');
    if (row) row.remove();
    const wrap = document.getElementById('portal-slides-rows');
    if (wrap && !wrap.querySelector('.slide-edit-row')) _renderSlides([]);
  };

  const syncThumb = (input) => {
    const row = input.closest('.slide-edit-row');
    const thumb = row && row.querySelector('.slide-thumb');
    if (thumb) thumb.style.backgroundImage = input.value.trim() ? `url('${input.value.trim()}')` : '';
  };

  const uploadSlideImage = async (fileInput) => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const row    = fileInput.closest('.slide-edit-row');
    const status = row.querySelector('.slide-upload-status');
    const urlInp = row.querySelector('.slide-image');
    if (!/^image\//.test(file.type)) { status.textContent = 'Not an image file.'; return; }
    if (file.size > 5 * 1024 * 1024) { status.textContent = 'Too large (max 5 MB).'; return; }

    status.textContent = 'Uploading…';
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await fetch('/admin/upload-image?adminKey=' + encodeURIComponent(Store.adminKey), { method: 'POST', body: fd });
      const d = await r.json();
      if (d && d.success && d.url) {
        urlInp.value = d.url;
        syncThumb(urlInp);
        status.textContent = '✓ Uploaded';
        setTimeout(() => { status.textContent = ''; }, 2500);
      } else {
        status.textContent = '✕ ' + ((d && d.error) || 'Upload failed.');
      }
    } catch (e) {
      status.textContent = '✕ Upload failed.';
    } finally {
      fileInput.value = '';
    }
  };

  const _collectSlides = () => {
    const rows = document.querySelectorAll('#portal-slides-rows .slide-edit-row');
    const slides = [];
    rows.forEach(row => {
      const title = row.querySelector('.slide-title').value.trim();
      const text  = row.querySelector('.slide-text').value.trim();
      const image = row.querySelector('.slide-image').value.trim();
      const price = (row.querySelector('.slide-price') || {}).value ? row.querySelector('.slide-price').value.trim() : '';
      const tag   = (row.querySelector('.slide-tag')   || {}).value ? row.querySelector('.slide-tag').value.trim()   : '';
      if (title || text || image || price || tag) slides.push({ title, text, image, price, tag });
    });
    return slides;
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
    const c = CURRENCIES.find(x => x.code === currCode) || CURRENCIES[0];
    const settings = {
      currency:                   c.code,
      currencySymbol:             c.symbol,
      currencyName:               c.name,
      activationEmailTemplateId:  tmplId,
      whatsapp:                   document.getElementById('portal-whatsapp')?.value.trim() || '',
      portalSlides:               _collectSlides(),
      portalPanelSize:            document.getElementById('portal-panel-size')?.value || 'half',
      portalLayout:               document.getElementById('portal-layout')?.value || 'single',
      portalAccent:               document.getElementById('portal-accent')?.value || '#2563eb',
      portalBg:                   document.getElementById('portal-bg')?.value || '#f0f4ff',
      portalAnim:                 document.getElementById('portal-anim')?.value || 'full',
      portalIntroPopup:           !!document.getElementById('portal-intro-on')?.checked,
      portalIntroTitle:           document.getElementById('portal-intro-title')?.value.trim() || '',
      portalIntroText:            document.getElementById('portal-intro-text')?.value.trim() || '',
      portalWechatQR:             document.getElementById('portal-wechat-qr')?.value || '',
      portalWhatsappQR:           document.getElementById('portal-whatsapp-qr')?.value || '',
      paymentMethods:             (document.getElementById('payment-methods')?.value || '').split('\n').map(s => s.trim()).filter(Boolean),
    };
    const d = await api('/admin/settings', { adminKey: Store.adminKey, settings });
    showMsg('settings-ok', 'settings-err', d && d.success,
      d && d.success ? '✓ Settings saved.' : 'Failed to save.');
    if (d && d.success) {
      Store.setSettings({ ...(Store.settings || {}), ...settings });
      _updateCurrencyPreview(settings);
      try { if (window.Dashboard && Dashboard.reload) Dashboard.reload(); } catch (e) {}
    }
  };

  // Populate template dropdown when templates are loaded
  const refreshTemplateDropdown = () => {
    const current = (Store.settings || {}).activationEmailTemplateId || '';
    _renderActivationTemplateDropdown(current);
  };

  const downloadBackup = () => {
    window.open('/admin/backup?adminKey=' + encodeURIComponent(Store.adminKey), '_blank');
  };

  const restoreBackup = (input) => {
    const file = input.files && input.files[0];
    const status = document.getElementById('restore-status');
    if (!file) return;
    if (!confirm('Restore from this backup? This OVERWRITES all current data and cannot be undone.')) { input.value = ''; return; }
    status.textContent = 'Restoring…';
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const backup = JSON.parse(reader.result);
        const d = await api('/admin/restore', { adminKey: Store.adminKey, backup });
        if (d && d.success) {
          status.textContent = `✓ Restored ${d.restored} file(s). Reloading…`;
          setTimeout(() => window.location.reload(), 1200);
        } else {
          status.textContent = '✕ ' + ((d && d.error) || 'Restore failed.');
        }
      } catch (e) {
        status.textContent = '✕ Invalid backup file.';
      }
      input.value = '';
    };
    reader.readAsText(file);
  };

  const _setQR = (which, url) => {
    const hid = document.getElementById('portal-' + which + '-qr');
    const th  = document.getElementById('qr-' + which + '-thumb');
    if (hid) hid.value = url || '';
    if (th)  { th.src = url || ''; th.style.display = url ? '' : 'none'; }
  };
  const clearQR = (which) => { _setQR(which, ''); const s = document.getElementById('qr-' + which + '-status'); if (s) s.textContent = 'Removed (save to apply).'; };
  const uploadQR = async (input, which) => {
    const file = input.files && input.files[0];
    if (!file) return;
    const status = document.getElementById('qr-' + which + '-status');
    if (!/^image\//.test(file.type)) { status.textContent = 'Not an image.'; return; }
    if (file.size > 5 * 1024 * 1024) { status.textContent = 'Too large (max 5 MB).'; return; }
    status.textContent = 'Uploading…';
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await fetch('/admin/upload-image?adminKey=' + encodeURIComponent(Store.adminKey), { method: 'POST', body: fd });
      const d = await r.json();
      if (d && d.url) { _setQR(which, d.url); status.textContent = '✓ Uploaded (save to apply).'; }
      else status.textContent = '✕ ' + ((d && d.error) || 'Upload failed.');
    } catch (e) { status.textContent = '✕ Upload failed.'; }
    input.value = '';
  };

  return { load, save, refreshTemplateDropdown, addSlide, removeSlide, uploadSlideImage, syncThumb, downloadBackup, restoreBackup, uploadQR, clearQR, CURRENCIES };
})();
