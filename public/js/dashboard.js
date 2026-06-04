/* ─── DTC Admin — Dashboard Module ──────────────────────────────────────── */
'use strict';

const Dashboard = (() => {

  // ── Stats (cumulative funnel) ───────────────────────────────────────────────
  // The activation journey is a funnel: Generated → Opened → Submitted → Activated.
  // Each later stage implies every earlier stage was reached, so the tiles are
  // counted cumulatively (Total ≥ Opened ≥ Submitted ≥ Activated). A link that has
  // been submitted still counts toward "Opened"; one that's been activated still
  // counts toward both "Opened" and "Submitted".
  const _updateStats = (entries) => {
    let all = 0, opened = 0, submitted = 0, activated = 0, declined = 0, expired = 0;
    entries.forEach(([, t, s]) => {
      all++;
      // A submission (used) — and therefore approval or decline, which only happen
      // after a submission — guarantees the link was opened first.
      const everSubmitted = !!t.used || !!t.submittedAt || !!t.approved || !!t.declined;
      const everOpened    = (t.accessCount || 0) > 0 || !!t.firstAccessedAt || everSubmitted;
      const everActivated = !!t.approved;
      if (everOpened)    opened++;
      if (everSubmitted) submitted++;
      if (everActivated) activated++;
      if (t.declined)    declined++;
      if (s === 'expired') expired++; // activation link lapsed before it was ever used
    });
    const notOpened = all - opened;

    document.getElementById('s-all').textContent  = all;
    document.getElementById('s-pend').textContent = notOpened;          // Not Opened
    document.getElementById('s-acc').textContent  = opened;             // Opened (cumulative)
    document.getElementById('s-sub').textContent  = submitted;          // Submitted (cumulative)
    document.getElementById('s-act').textContent  = activated;          // Activated (cumulative)
    document.getElementById('s-exp').textContent  = expired + declined; // Expired / Declined

    // Revenue stat
    const rev = Store.revenue || { total: 0 };
    const revEl = document.getElementById('s-rev');
    if (revEl) revEl.textContent = _sym() + (rev.total || 0).toFixed(2);
    const refEl = document.getElementById('s-refund');
    if (refEl) refEl.textContent = (rev.refundedTotal ? `· −${_sym()}${rev.refundedTotal.toFixed(2)} refunded` : '');
  };

  // ── Sub expiry cell ────────────────────────────────────────────────────────
  const _subCell = (t) => {
    if (!t.subscriptionExpiresAt) return '<span style="color:var(--muted2);font-size:.65rem">—</span>';
    const days  = daysUntil(t.subscriptionExpiresAt);
    const subSt = getSubStatus(t);
    const cls   = subSt === 'expired' || subSt === 'danger' ? 'danger' : subSt === 'soon' ? 'soon' : 'ok';
    let flag = '';
    if (days <= 0) flag = `<div class="exp-flag expired">⏱ Expired ${Math.abs(days)}d ago</div>`;
    else if (days <= 30) flag = `<div class="exp-flag ${subSt === 'danger' ? 'danger' : 'soon'}">⚠ ${days}d left</div>`;
    return `<div class="sub-exp ${cls}"><div class="days">${days <= 0 ? 'Expired' : days + ' days left'}</div><div class="date">${fmt(t.subscriptionExpiresAt)}</div>${flag}</div>`;
  };

  // ── Data cell ──────────────────────────────────────────────────────────────
  const _dataCell = (t, token) => {
    if (t.credentialsMode) return `<span class="badge" style="background:#fdf4ff;border:1px solid #e9d5ff;color:#7c3aed">🔑 Credentials</span>`;
    if (t.product === 'chatgpt' && t.sessionData) return `<div class="orgid-wrap"><span class="orgid-txt" style="color:var(--gpt)">ChatGPT Session</span><button class="icopy" style="color:var(--gpt)" onclick="Modals.viewSession('${token}')">View</button><button class="icopy" onclick="copyText(${JSON.stringify(t.sessionData)},this)">Copy</button></div>`;
    if (t.orgId) return `<div class="orgid-wrap"><span class="orgid-txt">${esc(t.orgId)}</span><button class="icopy" onclick="copyText('${esc(t.orgId)}',this)">Copy</button></div>`;
    return '<span style="color:var(--muted2);font-size:.65rem">Not submitted</span>';
  };

  // ── Action cell ────────────────────────────────────────────────────────────
  const _actionCell = (t, token, status) => {
    const del = `<button class="action-btn delete" onclick="Dashboard.deleteLink('${token}')">Delete</button>`;
    if (t.deactivated) return `<div><span class="badge b-deact">⊘ Deactivated</span><div style="font-size:.62rem;color:#6b7280;font-family:'JetBrains Mono',monospace;margin-top:.2rem">⊘ ${t.deactivatedAt ? fmtFull(new Date(t.deactivatedAt)) : '—'}</div><button class="action-btn react" style="margin-top:.4rem" onclick="Dashboard.reactivate('${token}')">↑ Reactivate</button>${del}</div>`;
    if (t.approved)    return `<div><span class="badge b-act">✓ Activated</span><div style="font-size:.62rem;color:var(--success);font-family:'JetBrains Mono',monospace;margin-top:.2rem">✓ ${fmtFull(new Date(t.approvedAt))}</div><button class="action-btn edit" style="margin-top:.4rem" onclick="Modals.openEdit('${token}')">✏ Edit</button><button class="action-btn deact" style="margin-top:.4rem" onclick="Dashboard.deactivate('${token}')">⊘ Deactivate</button>${del}</div>`;
    if (t.declined)    return `<div><span class="badge b-dec">✕ Declined</span><div style="font-size:.62rem;color:var(--error);font-family:'JetBrains Mono',monospace;margin-top:.2rem">✕ ${fmtFull(new Date(t.declinedAt))}</div><button class="action-btn deact" style="margin-top:.4rem" onclick="Dashboard.deactivate('${token}')">⊘ Deactivate</button>${del}</div>`;
    if (status === 'submitted') {
      const stage = t.stage || 'submitted';
      const map = {
        submitted:  { label: 'Submitted',             lbl: '→ Start Verification',    fn: `Dashboard.setStage('${token}','verifying')` },
        verifying:  { label: 'Verification',          lbl: '→ Verification Approved',  fn: `Dashboard.setStage('${token}','verified')` },
        verified:   { label: 'Verification Approved', lbl: '→ Start Processing',       fn: `Dashboard.setStage('${token}','processing')` },
        processing: { label: 'Processing',            lbl: '✓ Approve & Activate',     fn: `Dashboard.approve('${token}')` },
      };
      const sd = map[stage] || map.submitted;
      return `<div class="action-wrap">
        <span class="stage-pill">⏳ ${sd.label}</span>
        <button class="approve-btn" onclick="${sd.fn}">${sd.lbl}</button>
        <button class="decline-btn" onclick="Modals.openDecline('${token}')">✕ Decline</button>
        <button class="action-btn deact" onclick="Dashboard.deactivate('${token}')">⊘ Deactivate</button>
        ${del}
      </div>`;
    }
    if (!t.used) return `<div><button class="action-btn deact" onclick="Dashboard.deactivate('${token}')">⊘ Deactivate</button>${del}</div>`;
    return `<div>${del}</div>`;
  };

  // ── Log row ────────────────────────────────────────────────────────────────
  const _logRow = (token, t) => {
    const entries = (t.accessLog || []).slice(-10).map(e => `<div class="log-entry"><span class="le-t">${fmtFull(new Date(e.at))}</span><span class="le-ip">${esc(e.ip)}</span><span class="le-ua" title="${esc(e.userAgent)}">${esc(parseUA(e.userAgent))}</span></div>`).join('');
    return `<tr class="log-row" id="log-row-${token}"><td colspan="8"><div class="log-inner"><div class="log-hdr"><span>Time</span><span>IP</span><span>Device</span></div>${entries || '<div style="color:var(--muted2);font-size:.63rem">No records.</div>'}</div></td></tr>`;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const render = () => {
    const filter  = Store.dashFilter;
    const entries = Object.entries(Store.tokens)
      .map(([tok, t]) => [tok, t, getLinkStatus(t)])
      .sort((a, b) => new Date(b[1].createdAt || 0) - new Date(a[1].createdAt || 0));
    _updateStats(entries);
    const filtered = filter === 'all' ? entries : entries.filter(([,, s]) => s === filter);
    const wrap = document.getElementById('dash-tbl');
    if (!filtered.length) { wrap.innerHTML = '<div class="empty">No links match this filter.</div>'; return; }

    const rows = filtered.map(([token, t, status]) => {
      const subSt  = getSubStatus(t);
      const rowCls = t.deactivated ? 'row-deactivated' : subSt === 'soon' || subSt === 'danger' ? 'row-expiring' : subSt === 'expired' ? 'row-expired-sub' : status === 'declined' ? 'row-declined' : '';

      // Generated link URL
      const linkUrl = `${window.location.origin}/submit?token=${token}`;

    // Product colour dot
      const products = Store.products || [];
      const prod     = products.find(p => p.id === t.productId);
      const dotColor = prod ? (prod.color || '#2563eb') : (t.product === 'chatgpt' ? 'var(--gpt)' : 'var(--blue)');
      const prodTag  = `<span class="prod-tag" style="background:${dotColor}20;border:1px solid ${dotColor}40;color:${dotColor}">${esc(t.productName || t.product || 'Claude')}</span>`;

      // Price badge
      const priceBadge = t.price ? `<span class="price-badge">${_sym()}${t.price.toFixed(2)}</span>` : '';

      const ac     = t.accessCount || 0;
      const hasLog = (t.accessLog || []).length > 0;

      const mainRow = `<tr class="${rowCls}">
        <td>
          <div style="display:flex;align-items:center;gap:.35rem;margin-bottom:.2rem;flex-wrap:wrap">${prodTag}${priceBadge}</div>
          <div style="font-weight:600;font-size:.82rem">${esc(t.customerName)}</div>
          <div style="font-size:.68rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${esc(t.packageType)}</div>
          ${t.email ? `<div style="font-size:.68rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${esc(t.email)}</div>` : ''}
          ${t.resellerId ? `<span style="font-size:.62rem;background:#fdf4ff;border:1px solid #e9d5ff;border-radius:4px;padding:.08rem .4rem;color:#7c3aed;font-weight:600">🤝 ${esc(t.resellerName||t.resellerId)}</span>` : ''}
        </td>
        <td>${statusBadge(status)}</td>
        <td>${_dataCell(t, token)}</td>
        <td>
          <div style="font-size:.65rem;color:var(--muted);line-height:1.7">
            <div style="display:flex;gap:.4rem"><span style="color:var(--muted2);min-width:52px;font-weight:500">Created</span><span>${fmt(t.createdAt)}</span></div>
            <div style="display:flex;gap:.4rem"><span style="color:var(--muted2);min-width:52px;font-weight:500">Expires</span><span>${fmt(t.expiresAt)}</span></div>
            <div style="display:flex;gap:.4rem"><span style="color:var(--muted2);min-width:52px;font-weight:500">1st open</span><span>${t.firstAccessedAt ? fmt(t.firstAccessedAt) : '—'}</span></div>
            ${t.submittedAt ? `<div style="display:flex;gap:.4rem"><span style="color:var(--muted2);min-width:52px;font-weight:500">Submit</span><span>${fmt(t.submittedAt)}</span></div>` : ''}
            ${t.approvedAt  ? `<div style="display:flex;gap:.4rem"><span style="color:var(--muted2);min-width:52px;font-weight:500">Active</span><span style="color:var(--success)">${fmt(t.approvedAt)}</span></div>` : ''}
          </div>
          <div style="margin-top:.4rem">
          <a href="${linkUrl}" target="_blank" style="font-size:.62rem;color:var(--blue);text-decoration:none;font-family:'JetBrains Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;max-width:160px" title="${linkUrl}">🔗 Open link</a>
          <button class="icopy" style="margin-top:2px" onclick="copyText('${linkUrl}',this)">Copy URL</button>
        </div>
        <span style="display:inline-block;background:${ac>0?'var(--blue-light)':'#f1f5f9'};border:1px solid ${ac>0?'var(--blue-mid)':'var(--border)'};border-radius:4px;padding:.08rem .4rem;font-size:.61rem;font-family:'JetBrains Mono',monospace;color:${ac>0?'var(--blue)':'var(--muted2)'};margin-top:.25rem">👁 ${ac} open${ac!==1?'s':''}</span>
          ${hasLog ? `<button class="xbtn" id="xb-${token}" onclick="Dashboard.toggleLog('${token}')">▸ View access log</button>` : ''}
        </td>
        <td>${_subCell(t)}</td>
        <td>${t.wechat ? `<span style="font-size:.72rem;font-family:'JetBrains Mono',monospace">${esc(t.wechat)}</span>` : '<span style="color:var(--muted2)">—</span>'}</td>
        <td>${t.price ? `<strong style="color:var(--success);font-size:.82rem">${t.currencySymbol||'$'}${t.price.toFixed(2)}</strong>` : '<span style="color:var(--muted2)">—</span>'}</td>
        <td>${_actionCell(t, token, status)}</td>
      </tr>`;
      return mainRow + _logRow(token, t);
    }).join('');

    wrap.innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>Customer</th><th>Status</th><th>Data</th><th>Timeline</th><th>Subscription</th><th>WeChat</th><th>Price</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    try { _checkNewSubmissions(); } catch (e) { console.warn(e); }
  };

  // ── Reload ─────────────────────────────────────────────────────────────────
  const reload = async () => {
    const d = await api('/admin/sessions-data', { adminKey: Store.adminKey });
    if (!d || d.error) return;
    Store.load(d);
    try { render(); } catch(e) { console.warn(e); }
    try { Customers.render(); } catch(e) { console.warn(e); }
    try { EmailLog.render(); } catch(e) { console.warn(e); }
    try { Revenue.render(); } catch(e) { console.warn(e); }
    try { _checkNewSubmissions(); } catch(e) { console.warn(e); }
    try { refreshCustomerPicker(); refreshPaymentMethods(); _applyCurrencyUi(); } catch(e) { console.warn(e); }
    _stampUpdated();
  };

  // ── Auto-refresh ─────────────────────────────────────────────────────────────
  let _autoTimer = null;
  let _autoOn    = true;
  const AUTO_MS  = 15000; // poll every 15s

  const _stampUpdated = () => {
    const el = document.getElementById('last-updated');
    if (el) {
      const t = new Date();
      el.textContent = 'Updated ' + t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  };

  const startAutoRefresh = () => {
    if (_autoTimer) clearInterval(_autoTimer);
    const cb = document.getElementById('auto-refresh');
    if (cb) _autoOn = cb.checked;
    _autoTimer = setInterval(() => {
      // Only poll when enabled and the tab is actually visible (saves bandwidth/battery)
      if (_autoOn && document.visibilityState === 'visible') {
        reload().catch(() => {});
      }
    }, AUTO_MS);

    // Refresh immediately when the operator returns to the tab
    if (!startAutoRefresh._wired) {
      document.addEventListener('visibilitychange', () => {
        if (_autoOn && document.visibilityState === 'visible') reload().catch(() => {});
      });
      startAutoRefresh._wired = true;
    }
  };

  const setAuto = (on) => {
    _autoOn = !!on;
    if (_autoOn) reload().catch(() => {}); // give instant feedback when switched on
  };

  // ── New-submission alerts (sound + browser notification + badge) ─────────────
  let _knownSubmitted = null;   // Set of tokens already in 'submitted' on the previous poll; null = not initialised
  let _alertsOn       = true;
  let _audioCtx       = null;
  let _titleTimer     = null;
  const _origTitle    = (typeof document !== 'undefined' && document.title) || 'DTC Admin';

  const _ensureAudio = () => {
    try {
      if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (_audioCtx.state === 'suspended') _audioCtx.resume();
    } catch (e) { /* audio unavailable */ }
  };

  const _ping = () => {
    _ensureAudio();
    if (!_audioCtx) return;
    try {
      const now = _audioCtx.currentTime;
      [880, 1244].forEach((freq, i) => {
        const t   = now + i * 0.18;
        const osc = _audioCtx.createOscillator();
        const g   = _audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
        osc.connect(g).connect(_audioCtx.destination);
        osc.start(t); osc.stop(t + 0.19);
      });
    } catch (e) { /* ignore */ }
  };

  const _notify = (count) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification('DTC — New submission', {
          body: count + ' new activation request' + (count !== 1 ? 's' : '') + ' awaiting approval.',
          tag:  'dtc-new-submission',
        });
        n.onclick = () => {
          window.focus();
          try { const dn = document.querySelector(".nav-item"); Shell.navigate('dashboard', dn); } catch (e) {}
          n.close();
        };
      }
    } catch (e) { /* ignore */ }
  };

  const _flashTitle = (count) => {
    if (document.visibilityState === 'visible') return; // only blink when tab is in background
    if (_titleTimer) clearInterval(_titleTimer);
    const msg = `(${count}) New submission`;
    let on = false;
    _titleTimer = setInterval(() => { document.title = on ? _origTitle : msg; on = !on; }, 1000);
  };

  const _stopFlash = () => {
    if (_titleTimer) { clearInterval(_titleTimer); _titleTimer = null; document.title = _origTitle; }
  };

  const _updatePendingBadge = (count) => {
    const b = document.getElementById('nb-sub');
    if (!b) return;
    b.textContent = count;
    b.style.display = count > 0 ? '' : 'none';
  };

  const _checkNewSubmissions = () => {
    const submitted = new Set(
      Object.entries(Store.tokens || {})
        .filter(([, t]) => getLinkStatus(t) === 'submitted')
        .map(([tok]) => tok)
    );
    _updatePendingBadge(submitted.size);

    if (_knownSubmitted === null) { _knownSubmitted = submitted; return; } // first load — don't alert
    let fresh = 0;
    submitted.forEach(tok => { if (!_knownSubmitted.has(tok)) fresh++; });
    _knownSubmitted = submitted;

    if (fresh > 0 && _alertsOn) { _ping(); _notify(fresh); _flashTitle(fresh); }
  };

  const setAlerts = (on) => {
    _alertsOn = !!on;
    if (_alertsOn) {
      _ensureAudio(); // unlock audio within this user gesture
      try {
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
      } catch (e) {}
    } else {
      _stopFlash();
    }
  };

  // Stop the title blink as soon as the operator looks at the tab
  if (typeof window !== 'undefined' && !setAlerts._wired) {
    window.addEventListener('focus', _stopFlash);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') _stopFlash(); });
    setAlerts._wired = true;
  }

  // ── Generate link ──────────────────────────────────────────────────────────
  const generateLink = async () => {
    const customerName  = document.getElementById('cust-name').value.trim();
    const productId     = document.getElementById('gen-product').value;
    const packageLabel  = document.getElementById('pkg').value;
    const price         = document.getElementById('gen-price').value;
    const instr         = document.getElementById('gen-instr-set').value;
    const postInstr     = document.getElementById('gen-post-instr-set').value;
    const resellerId    = document.getElementById('gen-reseller-id')?.value.trim() || null;
    const resellerName  = document.getElementById('gen-reseller-name')?.value.trim() || null;
    const customerId    = document.getElementById('gen-customer')?.value || undefined;
    const email         = document.getElementById('gen-email')?.value.trim() || '';
    const wechat        = document.getElementById('gen-wechat')?.value.trim() || '';
    const paymentMethod = document.getElementById('gen-method')?.value || '';
    const errEl         = document.getElementById('gen-err');
    errEl.classList.remove('show');

    if (!customerName) { errEl.textContent = 'Customer name is required.'; errEl.classList.add('show'); return; }
    if (!productId)    { errEl.textContent = 'Please select a product.'; errEl.classList.add('show'); return; }
    if (!packageLabel) { errEl.textContent = 'Please select a package.'; errEl.classList.add('show'); return; }
    if (!price || parseFloat(price) <= 0) { errEl.textContent = 'Price must be greater than 0. Generating free links is not allowed.'; errEl.classList.add('show'); return; }

    const d = await api('/admin/generate', { adminKey: Store.adminKey, customerName, productId, packageLabel, price: parseFloat(price), instructionSetId: instr || undefined, postInstructionSetId: postInstr || undefined, resellerId, resellerName, customerId, email, wechat, paymentMethod });
    if (!d || d.error) { errEl.textContent = (d && d.error) || 'Failed to generate link.'; errEl.classList.add('show'); return; }
    document.getElementById('gen-link').textContent = d.link;
    const sym = _sym();
    document.getElementById('gen-price-display').textContent = sym + parseFloat(price).toFixed(2);
    document.getElementById('link-result').classList.add('show');
    document.getElementById('copy-btn').textContent = 'Copy';
    document.getElementById('copy-btn').classList.remove('done');
    reload();
  };

  const copyGenLink = () => { navigator.clipboard.writeText(document.getElementById('gen-link').textContent).then(() => { const b = document.getElementById('copy-btn'); b.textContent = 'Copied ✓'; b.classList.add('done'); }); };

  // ── Approve / Decline / Deactivate ────────────────────────────────────────
  const approve = async (token) => {
    const btn = document.getElementById(`ab-${token}`);
    if (btn) { btn.textContent = '…'; btn.disabled = true; }
    const d = await api('/admin/approve', { adminKey: Store.adminKey, token });
    if (d && d.success) reload(); else { if (btn) { btn.textContent = '✓ Approve'; btn.disabled = false; } alert('Failed.'); }
  };
  const deactivate = async (token) => {
    if (!confirm('Deactivate this link?')) return;
    const d = await api('/admin/deactivate', { adminKey: Store.adminKey, token });
    if (d && d.success) reload(); else alert('Failed.');
  };
  const reactivate = async (token) => {
    const d = await api('/admin/reactivate', { adminKey: Store.adminKey, token });
    if (d && d.success) reload(); else alert('Failed.');
  };

  const setStage = async (token, stage) => {
    const d = await api('/admin/set-stage', { adminKey: Store.adminKey, token, stage });
    if (d && d.success) reload(); else alert('Failed to update stage.');
  };

  const deleteLink = async (token) => {
    const t = Store.tokens[token] || {};
    const who = t.customerName ? ` for ${t.customerName}` : '';
    if (!confirm(`Permanently delete this link${who}? This removes the record completely and cannot be undone.`)) return;
    const d = await api('/admin/delete-token', { adminKey: Store.adminKey, token });
    if (d && d.success) reload(); else alert('Failed to delete.');
  };

  const toggleLog = (token) => {
    const row = document.getElementById(`log-row-${token}`);
    const btn = document.getElementById(`xb-${token}`);
    const open = row.classList.toggle('open');
    if (btn) btn.textContent = open ? '▾ Hide access log' : '▸ View access log';
  };

  // ── Dropdowns: populate from products list ─────────────────────────────────
  const refreshDropdowns = (prodId) => {
    const products  = Store.products || [];
    const productSel= document.getElementById('gen-product');
    if (!productSel) return;

    // Rebuild product dropdown
    const currentProdId = prodId || productSel.value;
    productSel.innerHTML = '<option value="">— Select Product —</option>';
    products.filter(p => p.active !== false).forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.name;
      if (p.id === currentProdId) o.selected = true;
      productSel.appendChild(o);
    });

    // Packages for selected product
    const selectedProd = products.find(p => p.id === (prodId || productSel.value));
    const pkgSel = document.getElementById('pkg');
    pkgSel.innerHTML = '<option value="">— Select Package —</option>';
    if (selectedProd) {
      selectedProd.packages.forEach(pk => {
        const o = document.createElement('option');
        o.value = pk.label; o.textContent = `${pk.label} — ${_sym()}${pk.price}`;
        pkgSel.appendChild(o);
      });
    }

    // Instruction dropdowns
    _buildInstrOptions('gen-instr-set',      selectedProd);
    _buildInstrOptions('gen-post-instr-set', selectedProd);

    // Customer picker + payment methods + currency
    refreshCustomerPicker();
    refreshPaymentMethods();
    _applyCurrencyUi();
  };

  const _sym = () => (Store.settings || {}).currencySymbol || '$';

  const _applyCurrencyUi = () => {
    const ic = document.querySelector('.price-currency-icon');
    if (ic) ic.textContent = _sym();
    const lbl = document.querySelector('#page-dashboard label');
    // price label "(USD)" → reflect configured currency code
    document.querySelectorAll('.price-cur-code').forEach(el => { el.textContent = (Store.settings || {}).currency || 'USD'; });
  };

  // ── Existing-customer picker (dedup) ─────────────────────────────────────────
  let _custCache = [];
  const refreshCustomerPicker = () => {
    _custCache = (Store.customers || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    _renderCustomerOptions('');
  };
  const _renderCustomerOptions = (q) => {
    const sel = document.getElementById('gen-customer');
    if (!sel) return;
    const cur = sel.value;
    const qq = (q || '').toLowerCase();
    const list = _custCache.filter(c => !qq ||
      (c.name || '').toLowerCase().includes(qq) ||
      (c.email || '').toLowerCase().includes(qq) ||
      (c.wechat || '').toLowerCase().includes(qq) ||
      (c.id || '').toLowerCase().includes(qq));
    sel.innerHTML = '<option value="">➕ New customer</option>' + list.map(c => {
      const contact = c.email || c.wechat || '';
      return `<option value="${c.id}">${esc(c.name || 'Unnamed')}${contact ? ' — ' + esc(contact) : ''} · ${esc(c.id)}</option>`;
    }).join('');
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  };
  const filterCustomers = () => _renderCustomerOptions(document.getElementById('gen-cust-search').value);
  const onCustomerPick = () => {
    const id = document.getElementById('gen-customer').value;
    const c  = _custCache.find(x => x.id === id);
    const nameEl = document.getElementById('cust-name');
    const emailEl = document.getElementById('gen-email');
    const wechatEl = document.getElementById('gen-wechat');
    if (c) {
      nameEl.value = c.name || '';
      emailEl.value = c.email || '';
      wechatEl.value = c.wechat || '';
    } else {
      nameEl.value = ''; emailEl.value = ''; wechatEl.value = '';
    }
  };

  const refreshPaymentMethods = () => {
    const methods = (Store.settings || {}).paymentMethods || [];
    ['gen-method', 'edit-method'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = '<option value="">— Select —</option>' + methods.map(m => `<option>${esc(m)}</option>`).join('');
      if (cur) sel.value = cur;
    });
  };

  // ── Pre-fill the Generate form (used by "Renew") ─────────────────────────────
  const prefillGenerate = (data) => {
    refreshCustomerPicker();
    const custSel = document.getElementById('gen-customer');
    if (custSel && data.customerId && [...custSel.options].some(o => o.value === data.customerId)) {
      custSel.value = data.customerId;
      onCustomerPick();
    } else {
      if (document.getElementById('cust-name'))  document.getElementById('cust-name').value  = data.customerName || '';
      if (document.getElementById('gen-email'))  document.getElementById('gen-email').value  = data.email  || '';
      if (document.getElementById('gen-wechat')) document.getElementById('gen-wechat').value = data.wechat || '';
    }
    const prodSel = document.getElementById('gen-product');
    if (prodSel && data.productId) { prodSel.value = data.productId; refreshDropdowns(data.productId); }
    const pkgSel = document.getElementById('pkg');
    if (pkgSel && data.packageLabel) { pkgSel.value = data.packageLabel; onPackageChange(); }
    if (data.price != null && document.getElementById('gen-price')) document.getElementById('gen-price').value = data.price;
    refreshPaymentMethods();
    if (data.paymentMethod && document.getElementById('gen-method')) document.getElementById('gen-method').value = data.paymentMethod;
    const card = document.getElementById('gen-product');
    if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Called when product changes — auto-fill price
  const onProductChange = () => {
    refreshDropdowns(document.getElementById('gen-product').value);
    document.getElementById('gen-price').value = '';
  };

  // Called when package changes — auto-fill price from product definition
  const onPackageChange = () => {
    const products = Store.products || [];
    const prodId   = document.getElementById('gen-product').value;
    const pkgLabel = document.getElementById('pkg').value;
    const prod     = products.find(p => p.id === prodId);
    if (!prod) return;
    const pkg = prod.packages.find(pk => pk.label === pkgLabel);
    if (pkg) document.getElementById('gen-price').value = pkg.price;
  };

  const _buildInstrOptions = (selId, prod) => {
    const sel = document.getElementById(selId); if (!sel) return;
    const defaultId = prod && prod.type === 'chatgpt' ? 'chatgpt-plus' : 'default-claude';
    sel.innerHTML = '<option value="">— Default —</option>';
    Object.values(Store.instructions.sets || {}).forEach(s => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = s.name;
      if (s.id === defaultId) o.selected = true;
      sel.appendChild(o);
    });
  };

  const setFilter = (f, btn) => {
    Store.setDashFilter(f);
    document.querySelectorAll('#df .fb').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  };

  return { render, reload, generateLink, copyGenLink, approve, deactivate, reactivate, deleteLink, setStage, toggleLog, refreshDropdowns, onProductChange, onPackageChange, setFilter, startAutoRefresh, setAuto, setAlerts, filterCustomers, onCustomerPick, prefillGenerate };
})();
