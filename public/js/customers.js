/* ─── DTC Admin — Customers Module ──────────────────────────────────────── */

'use strict';

const Customers = (() => {

  const render = () => {
    const filter    = Store.custFilter;

    // Group all approved subscriptions by customer (so one card = one customer, not one link)
    const groups = {};
    Object.entries(Store.tokens).forEach(([tok, t]) => {
      if (!t.approved) return;
      const key = t.customerId
        || (t.email  ? 'e:' + t.email.toLowerCase()
        : (t.wechat ? 'w:' + t.wechat.toLowerCase()
        : 'n:' + (t.customerName || tok)));
      (groups[key] = groups[key] || []).push([tok, t]);
    });

    // Build one entry per customer: history (newest first) + a "primary" current subscription
    let customers = Object.values(groups).map(arr => {
      arr.sort((a, b) => new Date(b[1].createdAt || 0) - new Date(a[1].createdAt || 0));
      const active  = arr.find(([, t]) => !t.deactivated && !t.refunded);
      const primary = active || arr[0];
      return { token: primary[0], t: primary[1], history: arr };
    });
    customers.sort((a, b) => daysUntil(a.t.subscriptionExpiresAt || '9999') - daysUntil(b.t.subscriptionExpiresAt || '9999'));

    // Update expiring-soon badge in sidebar
    const expiring = customers.filter(({ t }) => {
      if (t.deactivated || t.refunded) return false;
      const d = daysUntil(t.subscriptionExpiresAt || '9999');
      return d >= 0 && d <= 30;
    }).length;
    const nb = document.getElementById('nb-exp');
    nb.textContent = expiring;
    nb.style.display = expiring > 0 ? '' : 'none';

    const filtered = customers.filter(({ t }) => {
      if (filter === 'all')      return true;
      const st = getSubStatus(t);
      if (filter === 'active')   return st === 'ok' && !t.deactivated && !t.refunded;
      if (filter === 'expiring') return st === 'soon' || st === 'danger';
      if (filter === 'expired')  return st === 'expired';
      return true;
    });

    const wrap = document.getElementById('cust-list');
    if (!filtered.length) {
      wrap.innerHTML = '<div class="empty">No customers match this filter.</div>';
      return;
    }

    wrap.innerHTML = filtered.map(({ token, t, history }) => _card(token, t, history)).join('');
  };

  const _card = (token, t, history) => {
    history = history || [[token, t]];
    const subSt   = getSubStatus(t);
    const days    = t.subscriptionExpiresAt ? daysUntil(t.subscriptionExpiresAt) : null;
    const total   = t.subscriptionDays || 30;
    const pct     = Math.min(100, Math.max(0, ((total - (days || 0)) / total) * 100));
    const barColor= subSt === 'expired' || subSt === 'danger' ? '#dc2626' : subSt === 'soon' ? '#d97706' : '#16a34a';
    const dCls    = subSt === 'expired' || subSt === 'danger' ? 'red' : subSt === 'soon' ? 'warn' : 'green';
    const cardCls = 'cust-card' + (subSt === 'soon' || subSt === 'danger' ? ' expiring' : subSt === 'expired' ? ' expired-sub' : '');
    const sym     = (Store.settings || {}).currencySymbol || t.currencySymbol || '$';
    const refundedBadge = t.refunded ? `<span class="badge b-exp" style="margin-left:.3rem">↩ Refunded</span>` : '';
    const subsBadge = history.length > 1 ? `<span class="badge" style="background:var(--blue-light);border:1px solid var(--blue-mid);color:var(--blue);margin-left:.3rem">${history.length} subscriptions</span>` : '';
    const cust = (Store.customers || []).find(c => c.id === t.customerId);
    const TAG_COLORS = { VIP: '#7c3aed', Reseller: '#2563eb', Problem: '#dc2626', Paid: '#16a34a' };
    const tagChips = (cust && Array.isArray(cust.tags) ? cust.tags : []).map(tg => {
      const c = TAG_COLORS[tg] || '#64748b';
      return `<span class="badge" style="background:${c}18;border:1px solid ${c}55;color:${c};margin-left:.3rem">${esc(tg)}</span>`;
    }).join('');

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
        <div>${expBadge}${refundedBadge}${subsBadge}${tagChips}</div>
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
        <div>
          <div class="cf-lbl">Payment</div>
          <div class="cf-val" style="${t.refunded ? 'text-decoration:line-through;color:var(--muted)' : 'color:var(--success)'}">${t.amountReceived != null ? sym + Number(t.amountReceived).toFixed(2) : (t.price != null ? sym + Number(t.price).toFixed(2) : '—')}${t.paymentMethod ? ` <span style="color:var(--muted);text-decoration:none">· ${esc(t.paymentMethod)}</span>` : ''}</div>
        </div>
      </div>

      ${expiredNote}
      ${t.refunded ? `<div style="margin-top:.4rem;font-size:.72rem;background:var(--error-bg);border:1px solid var(--error-border);border-radius:7px;padding:.45rem .7rem;color:var(--error);font-weight:600">↩ Refunded ${t.refundAmount != null ? sym + Number(t.refundAmount).toFixed(2) : ''}${t.refundedAt ? ' on ' + new Date(t.refundedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}${t.refundNote ? ' · ' + esc(t.refundNote) : ''}</div>` : ''}

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

      ${history.length > 1 ? `
      <div class="cust-history">
        <div class="cust-history-hdr">Subscription history (${history.length})</div>
        ${history.map(([, h]) => {
          const st = h.refunded ? 'Refunded' : h.deactivated ? 'Deactivated' : (daysUntil(h.subscriptionExpiresAt || '9999') < 0 ? 'Expired' : 'Active');
          const stColor = st === 'Active' ? 'var(--success)' : (st === 'Refunded' || st === 'Deactivated') ? 'var(--muted)' : 'var(--error)';
          const amt = h.amountReceived != null ? sym + Number(h.amountReceived).toFixed(2) : (h.price != null ? sym + Number(h.price).toFixed(2) : '—');
          return `<div class="cust-history-row">
            <span>${h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
            <span>${esc(h.packageType || '—')}</span>
            <span style="color:${stColor};font-weight:600">${st}</span>
            <span style="text-align:right">${amt}${h.paymentMethod ? ' · ' + esc(h.paymentMethod) : ''}</span>
          </div>`;
        }).join('')}
      </div>` : ''}

      <div class="email-actions">
        <button class="btn btn-primary btn-sm" onclick="Customers.openProfile('${token}')">👤 Profile</button>
        <button class="btn btn-ghost-blue btn-sm" onclick="Customers.renew('${token}')">↻ Renew</button>
        <button class="btn btn-outline btn-sm" onclick="Modals.openEdit('${token}')">✏ Edit Package</button>
        <button class="btn btn-outline btn-sm" onclick="Customers.downloadStatement('${token}')">🧾 Statement</button>
        ${t.refunded ? '' : `<button class="btn btn-outline btn-sm" style="border-color:var(--warn-border);color:var(--warn)" onclick="Customers.refund('${token}')">↩ Refund</button>`}
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

  const refund = async (token) => {
    const t = Store.tokens[token] || {};
    const amt = (t.amountReceived != null ? t.amountReceived : t.price);
    if (!confirm(`Mark ${t.customerName || 'this customer'} as refunded${amt != null ? ' (' + amt + ')' : ''}? This removes the amount from revenue and deactivates the subscription.`)) return;
    const refundNote = prompt('Optional refund note / reason:', '') || '';
    const d = await api('/admin/refund', { adminKey: Store.adminKey, token, refundNote });
    if (d && d.success) Dashboard.reload(); else alert('Refund failed.');
  };

  // ── Customer grouping + profile / renew / statement ──────────────────────────
  const _keyOf = (x) => x.customerId
    || (x.email  ? 'e:' + x.email.toLowerCase()
    : (x.wechat ? 'w:' + x.wechat.toLowerCase()
    : 'n:' + (x.customerName || '')));

  const _groupFor = (token) => {
    const t = Store.tokens[token];
    if (!t) return null;
    const key = _keyOf(t);
    const subs = Object.entries(Store.tokens)
      .filter(([, x]) => x.approved && _keyOf(x) === key)
      .sort((a, b) => new Date(b[1].createdAt || 0) - new Date(a[1].createdAt || 0));
    const cust = (Store.customers || []).find(c => c.id === t.customerId)
      || { id: t.customerId || '', name: t.customerName, email: t.email, wechat: t.wechat, tags: [], note: '' };
    const primary = subs.find(([, x]) => !x.deactivated && !x.refunded) || subs[0] || [token, t];
    return { key, subs, cust, primary };
  };

  const _lifetimeValue = (subs) => subs.reduce((sum, [, x]) => {
    if (x.refunded) return sum;
    const amt = x.amountReceived != null ? Number(x.amountReceived) : (Number(x.price) || 0);
    return sum + amt;
  }, 0);

  const PRESET_TAGS = ['VIP', 'Reseller', 'Problem', 'Paid'];
  let _profileToken = null;

  const openProfile = (token) => {
    const g = _groupFor(token);
    if (!g) return;
    _profileToken = token;
    const sym = (Store.settings || {}).currencySymbol || '$';
    const ltv = _lifetimeValue(g.subs);
    const tags = Array.isArray(g.cust.tags) ? g.cust.tags : [];
    const [, p] = g.primary;

    const rows = g.subs.map(([, h]) => {
      const st = h.refunded ? 'Refunded' : h.deactivated ? 'Deactivated' : (daysUntil(h.subscriptionExpiresAt || '9999') < 0 ? 'Expired' : 'Active');
      const amt = h.amountReceived != null ? sym + Number(h.amountReceived).toFixed(2) : (h.price != null ? sym + Number(h.price).toFixed(2) : '—');
      return `<tr><td>${h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td><td>${esc(h.productName || h.product || '—')}</td><td>${esc(h.packageType || '—')}</td><td>${st}</td><td style="text-align:right">${amt}${h.paymentMethod ? '<br><span style="color:var(--muted);font-size:.66rem">' + esc(h.paymentMethod) + '</span>' : ''}</td></tr>`;
    }).join('');

    document.getElementById('profile-body').innerHTML = `
      <div class="modal-title">${esc(g.cust.name || p.customerName || 'Customer')}</div>
      <div class="modal-sub">${g.cust.id ? 'ID ' + esc(g.cust.id) + ' · ' : ''}${esc(g.cust.email || p.email || '—')}${(g.cust.wechat || p.wechat) ? ' · WeChat ' + esc(g.cust.wechat || p.wechat) : ''}</div>
      <div style="display:flex;gap:.8rem;margin:.9rem 0">
        <div class="stat" style="flex:1"><div class="stat-val sv-green">${sym}${ltv.toFixed(2)}</div><div class="stat-lbl">Lifetime Value</div></div>
        <div class="stat" style="flex:1"><div class="stat-val sv-blue">${g.subs.length}</div><div class="stat-lbl">Subscriptions</div></div>
        <div class="stat" style="flex:1"><div class="stat-val sv-ind">${g.subs.filter(([, x]) => !x.deactivated && !x.refunded && daysUntil(x.subscriptionExpiresAt || '9999') >= 0).length}</div><div class="stat-lbl">Active</div></div>
      </div>
      <div class="form-group">
        <label>Tags</label>
        <div id="profile-tags" style="display:flex;gap:.4rem;flex-wrap:wrap">
          ${PRESET_TAGS.map(tg => `<button type="button" class="ptag${tags.includes(tg) ? ' on' : ''}" data-tag="${tg}" onclick="this.classList.toggle('on')">${tg}</button>`).join('')}
        </div>
      </div>
      <div class="form-group"><label>Internal Notes</label><textarea id="profile-note" rows="3" placeholder="Private notes about this customer…">${esc(g.cust.note || '')}</textarea></div>
      <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:.4rem 0">Subscription history</div>
      <div class="tbl-wrap" style="max-height:240px;overflow:auto"><table><thead><tr><th>Date</th><th>Product</th><th>Package</th><th>Status</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="modal-actions" style="flex-wrap:wrap">
        <button class="btn btn-ghost-blue" onclick="Customers.renew('${token}')">↻ Renew</button>
        <button class="btn btn-outline" onclick="Customers.downloadStatement('${token}')">🧾 Statement</button>
        <button class="btn btn-outline" onclick="Customers.closeProfile()">Close</button>
        <button class="btn btn-primary" onclick="Customers.saveProfile('${g.cust.id}')" ${g.cust.id ? '' : 'disabled title="Older link without a customer ID"'}>Save</button>
      </div>`;
    document.getElementById('profile-modal').classList.add('open');
  };

  const closeProfile = () => document.getElementById('profile-modal').classList.remove('open');

  const saveProfile = async (customerId) => {
    if (!customerId) { closeProfile(); return; }
    const tags = [...document.querySelectorAll('#profile-tags .ptag.on')].map(b => b.dataset.tag);
    const note = document.getElementById('profile-note').value;
    const d = await api('/admin/customer/update', { adminKey: Store.adminKey, customerId, note, tags });
    closeProfile();
    if (d && d.success) Dashboard.reload(); else alert('Failed to save.');
  };

  const renew = (token) => {
    const g = _groupFor(token);
    if (!g) return;
    const [, p] = g.primary;
    closeProfile();
    try { const navEl = document.querySelector('.nav-item'); if (window.Shell && Shell.navigate) Shell.navigate('dashboard', navEl); } catch (e) {}
    setTimeout(() => {
      Dashboard.prefillGenerate({
        customerId: p.customerId, customerName: p.customerName, email: p.email, wechat: p.wechat,
        productId: p.productId, packageLabel: p.packageType, price: p.price, paymentMethod: p.paymentMethod,
      });
    }, 60);
  };

  const downloadStatement = (token) => {
    const g = _groupFor(token);
    if (!g) return;
    const sym = (Store.settings || {}).currencySymbol || '$';
    const biz = (Store.settings || {}).businessName || 'DTC — Digital Tools Corner';
    const ltv = _lifetimeValue(g.subs);
    const [, p] = g.primary;
    const rows = g.subs.map(([, h]) => {
      const st = h.refunded ? 'Refunded' : h.deactivated ? 'Deactivated' : (daysUntil(h.subscriptionExpiresAt || '9999') < 0 ? 'Expired' : 'Active');
      const amt = h.amountReceived != null ? Number(h.amountReceived) : (Number(h.price) || 0);
      return `<tr><td>${h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-GB') : '—'}</td><td>${esc(h.productName || '')}</td><td>${esc(h.packageType || '')}</td><td>${esc(h.paymentMethod || '—')}</td><td>${st}</td><td style="text-align:right">${h.refunded ? '<s>' : ''}${sym}${amt.toFixed(2)}${h.refunded ? '</s>' : ''}</td></tr>`;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Statement — ${esc(g.cust.name || p.customerName || '')}</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:760px;margin:30px auto;padding:0 20px}
      h1{font-size:20px;margin:0}.muted{color:#64748b;font-size:13px}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2563eb;padding-bottom:14px;margin-bottom:18px}
      table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e2e8f0}th{background:#f8faff;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
      .total{margin-top:18px;text-align:right;font-size:16px;font-weight:700}.tag{display:inline-block;background:#eef2ff;color:#4338ca;border-radius:6px;padding:2px 8px;font-size:11px;margin-left:6px}
      @media print{.noprint{display:none}}</style></head>
      <body>
      <div class="head"><div><h1>${esc(biz)}</h1><div class="muted">Customer Statement</div></div>
      <div class="muted" style="text-align:right">Generated ${new Date().toLocaleDateString('en-GB')}</div></div>
      <div><strong>${esc(g.cust.name || p.customerName || 'Customer')}</strong>${(g.cust.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}<br>
      <span class="muted">${g.cust.id ? 'ID ' + esc(g.cust.id) + ' · ' : ''}${esc(g.cust.email || p.email || '')}${(g.cust.wechat || p.wechat) ? ' · WeChat ' + esc(g.cust.wechat || p.wechat) : ''}</span></div>
      <table><thead><tr><th>Date</th><th>Product</th><th>Package</th><th>Method</th><th>Status</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="total">Lifetime value: ${sym}${ltv.toFixed(2)}</div>
      <p class="muted noprint" style="margin-top:24px">Use your browser's “Save as PDF” in the print dialog.</p>
      <script>window.onload=function(){setTimeout(function(){window.print();},250);}<\/script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    else alert('Please allow pop-ups to download the statement.');
  };

  return { render, setFilter, sendReminder, toggleMore, deleteCustomer, refund, openProfile, closeProfile, saveProfile, renew, downloadStatement };
})();
