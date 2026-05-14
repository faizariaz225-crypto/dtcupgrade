/* ─── DTC Admin — Customers Module ──────────────────────────────────────── */

'use strict';

const Customers = (() => {

  const render = () => {
    const filter    = Store.custFilter;
    const activated = Object.entries(Store.tokens)
      .filter(([, t]) => t.approved && t.email)
      .sort((a, b) => daysUntil(a[1].subscriptionExpiresAt || '9999') - daysUntil(b[1].subscriptionExpiresAt || '9999'));

    // Deduplicate: keep only the most recent (latest approvedAt) record per customer name
    const seenNames = new Map();
    activated.forEach(([tok, t]) => {
      const key = (t.customerName || '').trim().toLowerCase();
      const existing = seenNames.get(key);
      if (!existing || new Date(t.approvedAt || 0) > new Date(existing[1].approvedAt || 0)) {
        seenNames.set(key, [tok, t]);
      }
    });
    const deduplicated = Array.from(seenNames.values())
      .sort((a, b) => daysUntil(a[1].subscriptionExpiresAt || '9999') - daysUntil(b[1].subscriptionExpiresAt || '9999'));

    // Update expiring-soon badge in sidebar
    const expiring = deduplicated.filter(([, t]) => {
      const d = daysUntil(t.subscriptionExpiresAt || '9999');
      return d >= 0 && d <= 30;
    }).length;
    const nb = document.getElementById('nb-exp');
    nb.textContent = expiring;
    nb.style.display = expiring > 0 ? '' : 'none';

    const filtered = deduplicated.filter(([, t]) => {
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
        <div><div class="cf-lbl">Country</div><div class="cf-val">${esc(t.country || '—')}</div></div>
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

      <div class="email-actions">
        <button class="btn btn-ghost-blue btn-sm" onclick="Customers.sendReminder('${token}', 'reminder')">📧 Send 5-day Reminder</button>
        <button class="btn btn-outline btn-sm" style="border-color:var(--error-border);color:var(--error)" onclick="Customers.sendReminder('${token}', 'expired')">📧 Send Expiry Notice</button>
        <button class="btn btn-outline btn-sm" onclick="Customers.openPayment('${token}')" style="border-color:#7c3aed;color:#7c3aed">💳 Payment Details</button>
        <button class="btn btn-outline btn-sm" style="border-color:#dc2626;color:#dc2626;margin-top:.3rem" onclick="Customers.deleteCustomer('${esc(t.customerName)}')">🗑 Delete Customer</button>
      </div>

      ${t.paymentStatus ? `<div style="margin-top:.6rem;background:${t.paymentStatus==='paid'?'#f0fdf4':t.paymentStatus==='partial'?'#fffbeb':'#fef2f2'};border:1px solid ${t.paymentStatus==='paid'?'#bbf7d0':t.paymentStatus==='partial'?'#fde68a':'#fecaca'};border-radius:8px;padding:.5rem .75rem;font-size:.74rem;display:flex;gap:.75rem;flex-wrap:wrap;align-items:center">
        <span style="font-weight:700;color:${t.paymentStatus==='paid'?'#15803d':t.paymentStatus==='partial'?'#92400e':'#dc2626'}">${t.paymentStatus==='paid'?'✓ Paid':t.paymentStatus==='partial'?'⚠ Partial':'✕ Unpaid'}</span>
        ${t.paymentMethod?`<span style="color:var(--muted)">via ${esc(t.paymentMethod)}</span>`:''}
        ${t.amountPaid?`<span style="font-family:'JetBrains Mono',monospace;color:var(--text)">${(Store.settings||{}).currencySymbol||'$'}${parseFloat(t.amountPaid).toFixed(2)}</span>`:''}
        ${t.paymentNote?`<span style="color:var(--muted2);font-style:italic">${esc(t.paymentNote)}</span>`:''}
      </div>` : ''}
    </div>`;
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

  const deleteCustomer = async (customerName) => {
    if (!confirm(`Delete "${customerName}" and hide all their records?\n\nThis cannot be undone. Revenue history is preserved.`)) return;
    const d = await api('/admin/delete-customer', { adminKey: Store.adminKey, customerName });
    if (d && d.success) {
      await Dashboard.reload();
    } else {
      alert('Failed to delete customer: ' + (d && d.error));
    }
  };

  const openPayment = (token) => {
    const t = Store.tokens[token];
    if (!t) return;
    document.getElementById('pay-token').value         = token;
    document.getElementById('pay-status').value        = t.paymentStatus  || 'unpaid';
    document.getElementById('pay-method').value        = t.paymentMethod  || '';
    document.getElementById('pay-amount').value        = t.amountPaid     || '';
    document.getElementById('pay-note').value          = t.paymentNote    || '';
    document.getElementById('pay-customer-name').textContent = t.customerName;
    document.getElementById('pay-pkg').textContent     = t.packageType;
    const sym = (Store.settings||{}).currencySymbol||'$';
    document.getElementById('pay-price-label').textContent = `Total price: ${sym}${(t.price||0).toFixed(2)}`;
    document.getElementById('pay-modal').classList.add('open');
  };

  const savePayment = async () => {
    const token         = document.getElementById('pay-token').value;
    const paymentStatus = document.getElementById('pay-status').value;
    const paymentMethod = document.getElementById('pay-method').value.trim();
    const amountPaid    = document.getElementById('pay-amount').value;
    const paymentNote   = document.getElementById('pay-note').value.trim();
    const d = await api('/admin/payment', { adminKey: Store.adminKey, token, paymentStatus, paymentMethod, amountPaid, paymentNote });
    if (d && d.success) {
      document.getElementById('pay-modal').classList.remove('open');
      await Dashboard.reload();
    } else {
      alert('Failed to save: ' + (d && d.error));
    }
  };

  const closePayment = () => document.getElementById('pay-modal').classList.remove('open');

  return { render, setFilter, sendReminder, deleteCustomer, openPayment, savePayment, closePayment };
})();
