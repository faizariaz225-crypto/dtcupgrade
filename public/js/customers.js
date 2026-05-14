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

      ${t.paymentStatus ? (() => {
        const sym = (Store.settings||{}).currencySymbol||'$';
        const statusMap = {
          paid:            { bg:'#f0fdf4', border:'#bbf7d0', color:'#15803d', label:'✓ Paid' },
          partial:         { bg:'#fffbeb', border:'#fde68a', color:'#92400e', label:'⚠ Partial' },
          'partial-refund':{ bg:'#fff7ed', border:'#fed7aa', color:'#c2410c', label:'↩ Partial Refund' },
          refunded:        { bg:'#fef2f2', border:'#fecaca', color:'#dc2626', label:'↩ Refunded' },
          unpaid:          { bg:'#fef2f2', border:'#fecaca', color:'#dc2626', label:'✕ Unpaid' },
        };
        const sc = statusMap[t.paymentStatus] || statusMap.unpaid;
        const records = t.paymentRecords || [];
        const paid = t.amountPaid || 0;
        const refunded = t.amountRefunded || 0;
        return `<div style="margin-top:.6rem;background:${sc.bg};border:1px solid ${sc.border};border-radius:8px;padding:.45rem .75rem;font-size:.74rem;display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
          <span style="font-weight:700;color:${sc.color}">${sc.label}</span>
          ${paid > 0 ? `<span style="color:var(--muted)">Paid: <strong>${sym}${paid.toFixed(2)}</strong></span>` : ''}
          ${refunded > 0 ? `<span style="color:#dc2626">Refunded: <strong>−${sym}${refunded.toFixed(2)}</strong></span>` : ''}
          ${records.length > 0 ? `<span style="color:var(--muted2)">${records.length} record${records.length!==1?'s':''}</span>` : ''}
        </div>`;
      })() : ''}
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

  // ── Payment modal state ──────────────────────────────────────────────────
  let _payType = 'payment'; // 'payment' or 'refund'

  const setPayType = (type) => {
    _payType = type;
    const btnP = document.getElementById('pay-type-payment');
    const btnR = document.getElementById('pay-type-refund');
    const addBtn = document.getElementById('pay-add-btn');
    if (type === 'payment') {
      btnP.style.background = 'var(--blue)'; btnP.style.color = '#fff'; btnP.style.borderColor = 'var(--blue)';
      btnR.style.background = 'var(--white)'; btnR.style.color = 'var(--muted)'; btnR.style.borderColor = 'var(--border)';
      addBtn.textContent = 'Add Payment';
      addBtn.style.background = 'var(--blue)';
    } else {
      btnR.style.background = '#dc2626'; btnR.style.color = '#fff'; btnR.style.borderColor = '#dc2626';
      btnP.style.background = 'var(--white)'; btnP.style.color = 'var(--muted)'; btnP.style.borderColor = 'var(--border)';
      addBtn.textContent = 'Add Refund';
      addBtn.style.background = '#dc2626';
    }
  };

  const openPayment = (token) => {
    const t = Store.tokens[token];
    if (!t) return;
    _payType = 'payment';
    document.getElementById('pay-token').value              = token;
    document.getElementById('pay-customer-name').textContent = t.customerName;
    document.getElementById('pay-pkg').textContent          = t.packageType;
    const sym = (Store.settings||{}).currencySymbol||'$';
    document.getElementById('pay-price-label').textContent  = `Subscription price: ${sym}${(t.price||0).toFixed(2)}`;
    document.getElementById('pay-amount').value = '';
    document.getElementById('pay-method').value = '';
    document.getElementById('pay-note').value   = '';
    document.getElementById('pay-err').classList.remove('show');
    setPayType('payment');
    _renderPaySummary(t, sym);
    _renderPayRecords(token, t, sym);
    document.getElementById('pay-modal').classList.add('open');
  };

  const _renderPaySummary = (t, sym) => {
    const paid     = t.amountPaid     || 0;
    const refunded = t.amountRefunded || 0;
    const net      = t.netAmountPaid  || (paid - refunded);
    const price    = t.price || 0;
    const status   = t.paymentStatus  || 'unpaid';
    const statusColors = {
      paid:           { bg:'#f0fdf4', border:'#bbf7d0', color:'#15803d', label:'✓ Fully Paid' },
      partial:        { bg:'#fffbeb', border:'#fde68a', color:'#92400e', label:'⚠ Partial Payment' },
      'partial-refund':{ bg:'#fffbeb', border:'#fde68a', color:'#92400e', label:'⚠ Partial Refund' },
      refunded:       { bg:'#fef2f2', border:'#fecaca', color:'#dc2626', label:'↩ Refunded' },
      unpaid:         { bg:'#fef2f2', border:'#fecaca', color:'#dc2626', label:'✕ Unpaid' },
    };
    const sc = statusColors[status] || statusColors.unpaid;
    document.getElementById('pay-summary').innerHTML = `
      <div style="background:${sc.bg};border:1px solid ${sc.border};border-radius:6px;padding:.3rem .7rem;font-weight:700;color:${sc.color}">${sc.label}</div>
      <div style="padding:.3rem .5rem;color:var(--muted)">Paid: <strong style="color:var(--text)">${sym}${paid.toFixed(2)}</strong></div>
      ${refunded > 0 ? `<div style="padding:.3rem .5rem;color:var(--error)">Refunded: <strong>−${sym}${refunded.toFixed(2)}</strong></div>` : ''}
      <div style="padding:.3rem .5rem;color:var(--muted)">Net: <strong style="color:var(--text)">${sym}${Math.max(0,net).toFixed(2)}</strong> / ${sym}${price.toFixed(2)}</div>
    `;
  };

  const _renderPayRecords = (token, t, sym) => {
    const wrap    = document.getElementById('pay-records');
    const records = (t.paymentRecords || []).slice().sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
    if (!records.length) {
      wrap.innerHTML = '<div style="font-size:.78rem;color:var(--muted2);padding:.4rem 0">No transactions yet.</div>';
      return;
    }
    wrap.innerHTML = records.map(r => {
      const isRefund = r.type === 'refund';
      const fmtDate  = new Date(r.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
      return `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;padding:.55rem .65rem;margin-bottom:.35rem;border-radius:8px;background:${isRefund?'#fef2f2':'#f0fdf4'};border:1px solid ${isRefund?'#fecaca':'#bbf7d0'}">
        <div style="flex:1;min-width:0">
          <div style="font-size:.78rem;font-weight:700;color:${isRefund?'#dc2626':'#15803d'}">${isRefund?'↩ Refund':'＋ Payment'} &nbsp;<span style="font-family:\'JetBrains Mono\',monospace">${isRefund?'−':''}${sym}${r.amount.toFixed(2)}</span></div>
          <div style="font-size:.7rem;color:var(--muted);margin-top:.15rem">${r.method?esc(r.method)+' · ':''}<span style="color:var(--muted2)">${fmtDate}</span></div>
          ${r.note?`<div style="font-size:.7rem;color:var(--muted2);font-style:italic;margin-top:.1rem">${esc(r.note)}</div>`:''}
        </div>
        <button onclick="Customers.deletePayRecord('${token}','${r.id}')" title="Delete" style="background:none;border:none;cursor:pointer;color:var(--muted2);font-size:.85rem;padding:.1rem .2rem;flex-shrink:0;line-height:1" onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='var(--muted2)'">✕</button>
      </div>`;
    }).join('');
  };

  const addPaymentRecord = async () => {
    const token  = document.getElementById('pay-token').value;
    const amount = document.getElementById('pay-amount').value;
    const method = document.getElementById('pay-method').value;
    const note   = document.getElementById('pay-note').value.trim();
    const errEl  = document.getElementById('pay-err');
    errEl.classList.remove('show');
    if (!amount || parseFloat(amount) <= 0) {
      errEl.textContent = 'Please enter a valid amount greater than 0.';
      errEl.classList.add('show'); return;
    }
    const d = await api('/admin/payment', { adminKey: Store.adminKey, token, type: _payType, paymentMethod: method, amount, note });
    if (d && d.success) {
      // Update local token state immediately
      const t = Store.tokens[token];
      if (t) {
        if (!t.paymentRecords) t.paymentRecords = [];
        t.paymentRecords.unshift(d.record);
        t.paymentStatus   = d.paymentStatus;
        t.amountPaid      = d.amountPaid;
        t.amountRefunded  = d.amountRefunded;
        t.netAmountPaid   = d.netAmountPaid;
      }
      document.getElementById('pay-amount').value = '';
      document.getElementById('pay-note').value   = '';
      const sym = (Store.settings||{}).currencySymbol||'$';
      _renderPaySummary(t, sym);
      _renderPayRecords(token, t, sym);
      // Refresh revenue stat
      try { Dashboard.render(); } catch(e) {}
    } else {
      errEl.textContent = (d && d.error) || 'Failed to save.';
      errEl.classList.add('show');
    }
  };

  const deletePayRecord = async (token, recordId) => {
    if (!confirm('Delete this transaction record?')) return;
    const d = await api('/admin/payment/delete', { adminKey: Store.adminKey, token, recordId });
    if (d && d.success) {
      await Dashboard.reload();
      const t = Store.tokens[token];
      if (t) {
        const sym = (Store.settings||{}).currencySymbol||'$';
        _renderPaySummary(t, sym);
        _renderPayRecords(token, t, sym);
      }
    } else {
      alert((d && d.error) || 'Failed to delete.');
    }
  };

  const savePayment   = () => {}; // kept for compat, replaced by addPaymentRecord
  const closePayment  = () => document.getElementById('pay-modal').classList.remove('open');

  return { render, setFilter, sendReminder, deleteCustomer, openPayment, savePayment, closePayment, addPaymentRecord, deletePayRecord, setPayType };
})();
