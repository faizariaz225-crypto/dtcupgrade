/* ─── DTC Admin — Customers Module ──────────────────────────────────────── */

'use strict';

const Customers = (() => {

  const render = () => {
    const filter    = Store.custFilter;
    const activated = Object.entries(Store.tokens)
      .filter(([, t]) => t.approved && t.email)
      .sort((a, b) => daysUntil(a[1].subscriptionExpiresAt || '9999') - daysUntil(b[1].subscriptionExpiresAt || '9999'));

    // Update expiring-soon badge in sidebar
    const expiring = activated.filter(([, t]) => {
      const d = daysUntil(t.subscriptionExpiresAt || '9999');
      return d >= 0 && d <= 30;
    }).length;
    const nb = document.getElementById('nb-exp');
    nb.textContent = expiring;
    nb.style.display = expiring > 0 ? '' : 'none';

    const filtered = activated.filter(([, t]) => {
      if (filter === 'all')      return true;
      const st = getSubStatus(t);
      if (filter === 'active')   return st === 'ok';
      if (filter === 'expiring') return st === 'soon' || st === 'danger';
      if (filter === 'expired')  return st === 'expired';
      return true;
    });

    const wrap = document.getElementById('cust-list');
    if (!filtered.length) {
      wrap.innerHTML = '<div class="empty">No customers match this filter.</div>';
      return;
    }

    wrap.innerHTML = filtered.map(([token, t]) => _card(token, t)).join('');
  };

  const _card = (token, t) => {
    const subSt   = getSubStatus(t);
    const days    = t.subscriptionExpiresAt ? daysUntil(t.subscriptionExpiresAt) : null;
    const total   = t.subscriptionDays || 30;
    const pct     = Math.min(100, Math.max(0, ((total - (days || 0)) / total) * 100));
    const barColor= subSt === 'expired' || subSt === 'danger' ? '#dc2626' : subSt === 'soon' ? '#d97706' : '#16a34a';
    const dCls    = subSt === 'expired' || subSt === 'danger' ? 'red' : subSt === 'soon' ? 'warn' : 'green';
    const cardCls = 'cust-card' + (subSt === 'soon' || subSt === 'danger' ? ' expiring' : subSt === 'expired' ? ' expired-sub' : '');

    const expBadge = days === null ? ''
      : days < 0   ? `<span class="badge b-exp">✕ Expired</span>`
      : days <= 5  ? `<span class="badge" style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626">⚠ ${days}d left</span>`
      : days <= 30 ? `<span class="badge" style="background:#fffbeb;border:1px solid #fde68a;color:#d97706">⏰ ${days}d left</span>`
      :              `<span class="badge b-act">✓ Active · ${days}d left</span>`;

    const expDate = t.subscriptionExpiresAt
      ? new Date(t.subscriptionExpiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—';

    const prodTag = t.product === 'chatgpt'
      ? `<span class="prod-tag prod-chatgpt">ChatGPT Plus</span>`
      : `<span class="prod-tag prod-claude">Claude Pro</span>`;

    const dataRow = t.product === 'chatgpt'
      ? `<div>
           <div class="cf-lbl">Session Data</div>
           <div style="display:flex;gap:.3rem">
             <button class="icopy btn-sm" style="color:var(--gpt)" onclick="Modals.viewSession('${token}')">View</button>
             <button class="icopy btn-sm" onclick="copyText(${JSON.stringify(t.sessionData || '')}, this)">Copy</button>
           </div>
         </div>`
      : `<div>
           <div class="cf-lbl">Organization ID</div>
           <div style="display:flex;align-items:flex-start;gap:.3rem">
             <div class="cf-val" style="flex:1">${esc((t.orgId || '—').slice(0, 22))}…</div>
             ${t.orgId ? `<button class="icopy btn-sm" onclick="copyText('${esc(t.orgId)}', this)">Copy</button>` : ''}
           </div>
         </div>`;

    const expiredNote = days !== null && days < 0
      ? `<div style="margin-top:.4rem;font-size:.72rem;background:var(--error-bg);border:1px solid var(--error-border);border-radius:7px;padding:.45rem .7rem;color:var(--error);font-weight:600">
           ⏱ Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago
         </div>`
      : '';

    return `<div class="${cardCls}">
      <div class="cust-top">
        <div>
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem">
            ${prodTag}
            <div class="cust-nm">${esc(t.customerName)}</div>
          </div>
          <div class="cust-pk">${esc(t.packageType)}</div>
        </div>
        <div>${expBadge}</div>
      </div>

      <div class="cust-grid">
        <div><div class="cf-lbl">Email</div><div class="cf-val">${esc(t.email || '—')}</div></div>
        <div><div class="cf-lbl">WeChat</div><div class="cf-val">${esc(t.wechat || '—')}</div></div>
        ${dataRow}
        <div>
          <div class="cf-lbl">Activated On</div>
          <div class="cf-val">${t.approvedAt ? new Date(t.approvedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
        </div>
        <div><div class="cf-lbl">Expires On</div><div class="cf-val ${dCls}">${expDate}</div></div>
        <div>
          <div class="cf-lbl">Days Remaining</div>
          <div class="cf-val ${dCls}">${days === null ? '—' : days <= 0 ? 'Expired' : days + ' days'}</div>
        </div>
      </div>

      ${expiredNote}

      <div class="exp-bar-wrap" style="margin-top:${expiredNote ? '.6rem' : '.1rem'}">
        <div class="exp-bar-label">
          <span>Subscription Usage</span>
          <span style="font-weight:600">${Math.round(pct)}% used</span>
        </div>
        <div class="exp-bar">
          <div class="exp-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
      </div>

      <button class="cust-more-btn" id="cmb-${token}" onclick="Customers.toggleMore('${token}')">▸ See more</button>
      ${_moreSection(token, t)}

      <div class="email-actions">
        <button class="btn btn-outline btn-sm" onclick="Modals.openEdit('${token}')">✏ Edit Package</button>
        <button class="btn btn-ghost-blue btn-sm" onclick="Customers.sendReminder('${token}', 'reminder')">📧 Send 5-day Reminder</button>
        <button class="btn btn-outline btn-sm" style="border-color:var(--error-border);color:var(--error)" onclick="Customers.sendReminder('${token}', 'expired')">📧 Send Expiry Notice</button>
        <button class="btn btn-delete btn-sm" onclick="Customers.deleteCustomer('${token}')">Delete Customer</button>
      </div>
    </div>`;
  };

  // ── Expandable "See more" section ───────────────────────────────────────────
  const _moreSection = (token, t) => {
    const sym     = (Store.settings || {}).currencySymbol || t.currencySymbol || '$';
    const linkUrl = `${window.location.origin}/submit?token=${token}`;

    const fullData = t.product === 'chatgpt'
      ? `<div>
           <div class="cf-lbl">Session Data</div>
           <div style="display:flex;gap:.4rem">
             <button class="icopy btn-sm" style="color:var(--gpt)" onclick="Modals.viewSession('${token}')">View full JSON</button>
             <button class="icopy btn-sm" onclick="copyText(${JSON.stringify(t.sessionData || '')}, this)">Copy</button>
           </div>
         </div>`
      : `<div style="grid-column:1/-1">
           <div class="cf-lbl">Organization ID (full)</div>
           <div class="orgid-wrap">
             <span class="orgid-txt">${esc(t.orgId || '—')}</span>
             ${t.orgId ? `<button class="icopy" onclick="copyText('${esc(t.orgId)}', this)">Copy</button>` : ''}
           </div>
         </div>`;

    const log = (t.accessLog || []).slice(-15).reverse().map(e =>
      `<div class="cmore-log-row">
         <span>${fmtFull(new Date(e.at))}</span>
         <span>${esc(e.ip)}</span>
         <span title="${esc(e.userAgent)}">${esc(parseUA(e.userAgent))}</span>
       </div>`).join('');

    return `<div class="cust-more" id="cm-${token}">
      <div class="cmore-grid">
        ${fullData}
        <div><div class="cf-lbl">Price</div><div class="cf-val" style="color:var(--success)">${t.price != null ? sym + Number(t.price).toFixed(2) : '—'}</div></div>
        <div><div class="cf-lbl">Subscription Length</div><div class="cf-val">${t.subscriptionDays || t.durationDays || 30} days</div></div>
        <div><div class="cf-lbl">Total Opens</div><div class="cf-val">${t.accessCount || 0}</div></div>
        <div><div class="cf-lbl">Subscription Key</div><div class="cf-val">${esc(t.subscriptionKey || '—')}</div></div>
        <div><div class="cf-lbl">Link Created</div><div class="cf-val">${t.createdAt ? fmt(t.createdAt) : '—'}</div></div>
        <div><div class="cf-lbl">Reseller</div><div class="cf-val">${esc(t.resellerName || t.resellerId || '—')}</div></div>
        <div style="grid-column:1/-1">
          <div class="cf-lbl">Activation Link</div>
          <div class="orgid-wrap">
            <a href="${linkUrl}" target="_blank" class="orgid-txt" style="color:var(--blue);text-decoration:none">${esc(linkUrl)}</a>
            <button class="icopy" onclick="copyText('${linkUrl}', this)">Copy</button>
          </div>
        </div>
      </div>
      <div class="cmore-log">
        <div class="cmore-log-hdr"><span>Opened At</span><span>IP</span><span>Device</span></div>
        ${log || '<div style="color:var(--muted2);font-size:.66rem;padding:.3rem 0">No access records yet.</div>'}
      </div>
    </div>`;
  };

  const toggleMore = (token) => {
    const box = document.getElementById(`cm-${token}`);
    const btn = document.getElementById(`cmb-${token}`);
    if (!box) return;
    const open = box.classList.toggle('open');
    if (btn) btn.textContent = open ? '▾ See less' : '▸ See more';
  };

  const setFilter = (f, btn) => {
    Store.setCustFilter(f);
    document.querySelectorAll('#cf .fb').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  };

  const sendReminder = async (token, type) => {
    const d = await api('/admin/send-reminder', { adminKey: Store.adminKey, token, type });
    alert(d && d.ok ? '✓ Email sent successfully.' : '✕ Failed: ' + (d && d.error));
    if (d && d.ok) Dashboard.reload();
  };

  const deleteCustomer = async (token) => {
    const t = Store.tokens[token] || {};
    const name = t.customerName || 'this customer';
    if (!confirm(`Permanently delete ${name}? This removes the customer and their link completely and cannot be undone.`)) return;
    const d = await api('/admin/delete-token', { adminKey: Store.adminKey, token });
    if (d && d.success) Dashboard.reload(); else alert('Failed to delete.');
  };

  return { render, setFilter, sendReminder, toggleMore, deleteCustomer };
})();
