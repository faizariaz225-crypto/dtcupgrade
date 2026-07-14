/* ─── DTC Admin — Payment Methods (portal QR codes) ──────────────────────── */
'use strict';

const PayMethods = (() => {

  let _methods = [];

  const load = async () => {
    try {
      const d = await api(`/admin/payment-methods?adminKey=${encodeURIComponent(Store.adminKey)}`);
      _methods = (d && d.methods) ? d.methods : [];
    } catch (e) { _methods = []; }
    _paint();
  };

  const _paint = () => {
    const box = document.getElementById('pm-list');
    if (!box) return;
    if (!_methods.length) {
      box.innerHTML = '<div style="font-size:.82rem;color:var(--muted)">No payment methods yet. Add one below.</div>';
      return;
    }
    box.innerHTML = _methods.map((m, i) => `
      <div style="border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:.8rem;background:#fff;${m.enabled === false ? 'opacity:.55' : ''}">
        <div style="display:flex;align-items:center;gap:.8rem;margin-bottom:.7rem">
          <label class="toggle" style="margin-bottom:0" title="Show this method in every customer portal">
            <input type="checkbox" data-pm-on="${i}" ${m.enabled === false ? '' : 'checked'} onchange="PayMethods.toggle(${i}, this.checked)"/>
            <div class="toggle-track"><div class="toggle-thumb"></div></div>
          </label>
          <input type="text" data-pm-name="${i}" value="${esc(m.name)}"
                 style="flex:1;padding:.4rem .6rem;border:1px solid var(--border);border-radius:6px;font-size:.86rem;font-weight:600">
          ${m.builtin ? '<span style="font-size:.62rem;color:var(--muted);font-weight:600">BUILT-IN</span>'
                      : `<button class="btn btn-outline btn-sm" onclick="PayMethods.remove(${i})">Remove</button>`}
        </div>

        <div style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap">
          <div style="text-align:center">
            <div id="pm-qr-${i}">${_qr(m.qrUrl)}</div>
            <input type="file" accept="image/*" onchange="PayMethods.uploadQr(${i}, this)" style="font-size:.72rem;width:130px;margin-top:.4rem">
            ${m.qrUrl ? `<button class="btn btn-outline btn-sm" style="margin-top:.3rem" onclick="PayMethods.clearQr(${i})">Clear QR</button>` : ''}
          </div>
          <div style="flex:1;min-width:220px">
            <label style="font-size:.72rem;color:var(--muted);font-weight:600">Account / address (optional)</label>
            <input type="text" data-pm-acct="${i}" value="${esc(m.account || '')}" placeholder="e.g. Binance ID or Alipay account"
                   style="width:100%;padding:.45rem .6rem;border:1px solid var(--border);border-radius:6px;font-size:.8rem;margin-bottom:.5rem">
            <label style="font-size:.72rem;color:var(--muted);font-weight:600">Instructions (optional)</label>
            <input type="text" data-pm-note="${i}" value="${esc(m.note || '')}" placeholder="e.g. Include your email in the payment note"
                   style="width:100%;padding:.45rem .6rem;border:1px solid var(--border);border-radius:6px;font-size:.8rem">
          </div>
        </div>
      </div>`).join('');
  };

  const _qr = (url) => url
    ? `<img src="${esc(url)}" style="width:130px;height:130px;object-fit:contain;border:1px solid var(--border);border-radius:8px;background:#fff;padding:4px">`
    : `<div style="width:130px;height:130px;border:1px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.7rem;color:var(--muted);text-align:center;padding:6px">No QR</div>`;

  const _sync = () => {
    _methods.forEach((m, i) => {
      const n = document.querySelector(`[data-pm-name="${i}"]`);
      const a = document.querySelector(`[data-pm-acct="${i}"]`);
      const t = document.querySelector(`[data-pm-note="${i}"]`);
      if (n) m.name    = n.value.trim();
      if (a) m.account = a.value.trim();
      if (t) m.note    = t.value.trim();
    });
  };

  const toggle = (i, on) => { _methods[i].enabled = !!on; };

  const uploadQr = async (i, input) => {
    const f = input.files && input.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('image', f);
    showMsg('pm-ok', 'pm-err', true, 'Uploading QR…');
    try {
      const r = await fetch(`/admin/upload-image?adminKey=${encodeURIComponent(Store.adminKey)}`, { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'Upload failed');
      _sync();
      _methods[i].qrUrl = d.url;
      _paint();
      showMsg('pm-ok', 'pm-err', true, 'QR uploaded — click Save to publish it to every portal.');
    } catch (e) {
      showMsg('pm-ok', 'pm-err', false, 'Upload failed: ' + e.message);
    }
  };

  const clearQr = (i) => { _sync(); _methods[i].qrUrl = ''; _paint(); };

  const add = () => {
    _sync();
    const name = (document.getElementById('pm-new-name') || {}).value || '';
    if (!name.trim()) { showMsg('pm-ok', 'pm-err', false, 'Give the payment method a name.'); return; }
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '-' + Date.now().toString(36).slice(-4);
    _methods.push({ id, name: name.trim(), qrUrl: '', account: '', note: '', enabled: true, builtin: false });
    document.getElementById('pm-new-name').value = '';
    _paint();
    showMsg('pm-ok', 'pm-err', true, 'Added — click Save to publish.');
  };

  const remove = (i) => {
    if (!confirm('Remove this payment method?')) return;
    _sync();
    _methods.splice(i, 1);
    _paint();
  };

  const save = async () => {
    _sync();
    try {
      const d = await api('/admin/payment-methods', { adminKey: Store.adminKey, methods: _methods });
      if (d && d.error) throw new Error(d.error);
      showMsg('pm-ok', 'pm-err', true, 'Saved — every customer portal now shows these.');
      load();
    } catch (e) {
      showMsg('pm-ok', 'pm-err', false, 'Save failed: ' + e.message);
    }
  };

  return { load, save, add, remove, toggle, uploadQr, clearQr };
})();
