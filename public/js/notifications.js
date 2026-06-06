/* ─── DTC Admin — Notifications Module ─────────────────────────────────── */

'use strict';

const Notifications = (() => {

  const load = async () => {
    const d = await api(`/admin/notification?adminKey=${encodeURIComponent(Store.adminKey)}`);
    if (!d || d.error) return;
    document.getElementById('notif-enabled').checked = d.enabled || false;
    document.getElementById('notif-message').value   = d.message || '';
    document.getElementById('notif-type').value      = d.type    || 'info';
    _updatePreview();
    renderAlerts();
  };

  // ── Per-product server-load alerts (warning + timer) ───────────────────────
  let _alerts = [];           // [{id,name,active,notice,timer,_anchor}]
  let _tick = null;
  const _fmtDur = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };
  const renderAlerts = async () => {
    const wrap = document.getElementById('proc-alert-list');
    if (!wrap) return;
    let d;
    try { d = await (await fetch(`/admin/processing-alerts?adminKey=${encodeURIComponent(Store.adminKey)}`)).json(); }
    catch (e) { wrap.innerHTML = '<div class="empty">Could not load products.</div>'; return; }
    _alerts = (d.products || []).map(p => ({ ...p, _anchor: Date.now() }));
    if (!_alerts.length) { wrap.innerHTML = '<div class="empty">No products yet. Add a product on the Products page first.</div>'; return; }

    wrap.innerHTML = _alerts.map(p => {
      const n = p.notice || {}; const t = p.timer || {};
      const on = !!n.enabled;
      const live = on || t.show;
      return `
      <div class="card" style="border:1.5px solid ${live ? '#fde68a' : 'var(--border)'};background:${live ? '#fffdf5' : 'var(--white)'};margin-bottom:.9rem">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:.6rem">
          <div style="font-weight:700">${esc(p.name)} ${p.active ? '' : '<span style="font-size:.66rem;color:var(--muted)">(inactive)</span>'} ${live ? '<span style="font-size:.62rem;background:#fef3c7;border:1px solid #fde68a;border-radius:4px;padding:.08rem .4rem;color:#b45309;font-weight:700;margin-left:.3rem">● LIVE</span>' : ''}</div>
          <label class="toggle" style="margin-bottom:0">
            <input type="checkbox" id="al-on-${p.id}" ${on ? 'checked' : ''} onchange="Notifications.saveNotice('${p.id}')"/>
            <div class="toggle-track"><div class="toggle-thumb"></div></div>
            <span style="font-size:.74rem;font-weight:600;margin-left:.4rem">Show heavy-load warning</span>
          </label>
        </div>
        <div class="form-row" style="margin-bottom:.5rem">
          <div class="form-group" style="margin-bottom:0"><label>Warning Title</label><input id="al-title-${p.id}" value="${esc(n.title || '')}" placeholder="Server Under Heavy Load"/></div>
          <div class="form-group" style="margin-bottom:0"><label>Expected Completion</label><input id="al-eta-${p.id}" value="${esc(n.eta || '')}" placeholder="Within the next 2-4 hours"/></div>
        </div>
        <div class="form-group" style="margin-bottom:.5rem"><label>Message</label><textarea id="al-msg-${p.id}" rows="2" placeholder="Your order is taking longer than usual due to high demand. You can safely close this page — we'll notify you once activated.">${esc(n.message || '')}</textarea></div>
        <button class="btn btn-outline btn-sm" onclick="Notifications.saveNotice('${p.id}')">Save warning text</button>
        <div style="font-size:.66rem;color:var(--muted);margin-top:.35rem">Leave title/message blank to use the default heavy-load text.</div>
        <div style="border-top:1px solid var(--border);margin:.8rem 0 .6rem"></div>
        <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
          <span style="font-size:.74rem;font-weight:700;margin-right:.2rem">⏱ Timer</span>
          <span id="al-tval-${p.id}" style="font-family:'JetBrains Mono',monospace;font-weight:700;font-size:1rem;min-width:80px">${_fmtDur(t.elapsedMs || 0)}</span>
          <span id="al-tstate-${p.id}" style="font-size:.7rem;color:var(--muted);margin-right:.3rem">${!t.show ? '(hidden)' : t.running ? '● running · visible' : '⏸ paused · visible'}</span>
          <button class="btn btn-outline btn-sm" onclick="Notifications.timer('${p.id}','show')">👁 Show</button>
          <button class="btn btn-outline btn-sm" onclick="Notifications.timer('${p.id}','hide')">🚫 Hide</button>
          <button class="btn btn-outline btn-sm" onclick="Notifications.timer('${p.id}','play')">▶ Play</button>
          <button class="btn btn-outline btn-sm" onclick="Notifications.timer('${p.id}','pause')">⏸ Pause</button>
          <button class="btn btn-outline btn-sm" onclick="Notifications.timer('${p.id}','reset')">⟲ Reset</button>
        </div>
      </div>`;
    }).join('');

    if (_tick) clearInterval(_tick);
    _tick = setInterval(_tickTimers, 1000);
  };
  const _tickTimers = () => {
    _alerts.forEach(p => {
      const el = document.getElementById('al-tval-' + p.id);
      if (!el || !p.timer) return;
      const shown = p.timer.running ? p.timer.elapsedMs + (Date.now() - p._anchor) : p.timer.elapsedMs;
      el.textContent = _fmtDur(shown);
    });
  };
  const saveNotice = async (id) => {
    const d = await api('/admin/product/notice', {
      adminKey: Store.adminKey, productId: id,
      enabled: document.getElementById('al-on-' + id)?.checked,
      title:   document.getElementById('al-title-' + id)?.value || '',
      message: document.getElementById('al-msg-' + id)?.value || '',
      eta:     document.getElementById('al-eta-' + id)?.value || '',
    });
    if (d && d.success) { const p = _alerts.find(x => x.id === id); if (p) p.notice = d.processingNotice; renderAlerts(); }
  };
  const timer = async (id, action) => {
    const d = await api('/admin/product/timer', { adminKey: Store.adminKey, productId: id, action });
    if (d && d.success) {
      const p = _alerts.find(x => x.id === id);
      if (p) { p.timer = d.timer; p._anchor = Date.now(); }
      const st = document.getElementById('al-tstate-' + id);
      if (st) st.textContent = !d.timer.show ? '(hidden)' : d.timer.running ? '● running · visible' : '⏸ paused · visible';
      _tickTimers();
      renderAlerts();
    }
  };

  const save = async () => {
    const enabled = document.getElementById('notif-enabled').checked;
    const message = document.getElementById('notif-message').value.trim();
    const type    = document.getElementById('notif-type').value;
    if (enabled && !message) {
      showMsg('notif-ok', 'notif-err', false, 'Please enter a notification message before enabling.');
      return;
    }
    const d = await api('/admin/notification', { adminKey: Store.adminKey, enabled, message, type });
    showMsg('notif-ok', 'notif-err', d && d.success,
      d && d.success ? '✓ Notification saved successfully.' : 'Failed to save.');
    _updatePreview();
  };

  const _updatePreview = () => {
    const enabled = document.getElementById('notif-enabled').checked;
    const message = document.getElementById('notif-message').value.trim();
    const type    = document.getElementById('notif-type').value;
    const preview = document.getElementById('notif-preview');
    if (!preview) return;
    if (!enabled || !message) {
      preview.style.display = 'none';
      return;
    }
    const colors = {
      info:    { bg:'#eff6ff', border:'#bfdbfe', color:'#1d4ed8', icon:'ℹ' },
      success: { bg:'#f0fdf4', border:'#bbf7d0', color:'#15803d', icon:'✓' },
      warning: { bg:'#fffbeb', border:'#fde68a', color:'#b45309', icon:'⚠' },
      error:   { bg:'#fef2f2', border:'#fecaca', color:'#dc2626', icon:'⚠' },
    };
    const c = colors[type] || colors.info;
    preview.style.display = 'block';
    preview.innerHTML = `
      <div style="background:${c.bg};border:1px solid ${c.border};border-radius:10px;padding:.85rem 1.1rem;display:flex;align-items:flex-start;gap:.7rem">
        <span style="font-size:1rem;flex-shrink:0;margin-top:.05rem">${c.icon}</span>
        <span style="font-size:.82rem;color:${c.color};font-weight:500;line-height:1.5">${esc(message)}</span>
      </div>`;
  };

  const init = () => {
    const tog = document.getElementById('notif-enabled');
    const msg = document.getElementById('notif-message');
    const typ = document.getElementById('notif-type');
    if (tog) tog.addEventListener('change', _updatePreview);
    if (msg) msg.addEventListener('input',  _updatePreview);
    if (typ) typ.addEventListener('change', _updatePreview);
  };

  return { load, save, init, renderAlerts, saveNotice, timer };
})();
