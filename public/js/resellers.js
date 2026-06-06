/* ─── DTC Admin — Resellers Module ──────────────────────────────────────── */
'use strict';

const Resellers = (() => {

  const _fmt = (amount) => ((Store.settings || {}).currencySymbol || '$') + (Number(amount) || 0).toFixed(2);
  const _commLabel = (r) => r.commissionType === 'flat' ? `${_fmt(r.commissionValue)} / sale` : `${r.commissionValue || 0}% of sale`;

  const render = async () => {
    const rev = Store.revenue || {};
    const rTotalEl = document.getElementById('reseller-total');
    const dTotalEl = document.getElementById('direct-total');
    const cEl      = document.getElementById('reseller-commission');
    if (rTotalEl) rTotalEl.textContent = _fmt(rev.resellerTotal || 0);
    if (dTotalEl) dTotalEl.textContent = _fmt(rev.directTotal   || 0);
    if (cEl)      cEl.textContent      = _fmt(rev.resellerCommissionTotal || 0);

    const wrap = document.getElementById('reseller-breakdown');
    if (!wrap) return;
    wrap.innerHTML = '<div class="empty">Loading…</div>';

    let data;
    try {
      const r = await fetch(`/admin/resellers?adminKey=${encodeURIComponent(Store.adminKey)}`);
      data = await r.json();
    } catch (e) { wrap.innerHTML = '<div class="empty">Could not load resellers.</div>'; return; }

    const resellers = (data.resellers || []).sort((a, b) => (b.total || 0) - (a.total || 0));
    if (!resellers.length) {
      wrap.innerHTML = '<div class="empty">No resellers yet. When generating a link, expand “Reseller / referral” and add one — they’ll be tracked here with their commission.</div>';
      return;
    }

    const tokens = Store.tokens || {};
    wrap.innerHTML = resellers.map(r => {
      const sales = Object.values(tokens)
        .filter(t => t.resellerId === r.id && t.approved)
        .sort((a, b) => new Date(b.approvedAt || 0) - new Date(a.approvedAt || 0))
        .slice(0, 5);
      return `
        <div class="reseller-card">
          <div class="reseller-header">
            <div>
              <div class="reseller-name">${esc(r.name)} ${r.contact ? `<span style="font-weight:400;color:var(--muted);font-size:.76rem">· ${esc(r.contact)}</span>` : ''}</div>
              <div class="reseller-id">ID: ${esc(r.id)} · Commission: ${_commLabel(r)}</div>
            </div>
            <div style="text-align:right">
              <div class="reseller-revenue">${_fmt(r.total)}</div>
              <div class="reseller-count">${r.count} sale${r.count !== 1 ? 's' : ''} · ${r.activated || 0} activated${r.refunded ? ' · ' + r.refunded + ' refunded' : ''}</div>
              <div style="font-size:.8rem;font-weight:700;color:#7c3aed;margin-top:.2rem">Profit: ${_fmt(r.commission)}</div>
            </div>
          </div>

          <div id="redit-${r.id}" style="display:none;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:.7rem .8rem;margin-bottom:.6rem">
            <div class="form-row" style="margin-bottom:.5rem">
              <div class="form-group" style="margin-bottom:0"><label>Contact</label><input id="re-contact-${r.id}" value="${esc(r.contact || '')}"/></div>
              <div class="form-group" style="margin-bottom:0"><label>Commission Type</label>
                <select id="re-ctype-${r.id}"><option value="percent"${r.commissionType !== 'flat' ? ' selected' : ''}>Percentage (%)</option><option value="flat"${r.commissionType === 'flat' ? ' selected' : ''}>Flat per sale</option></select>
              </div>
              <div class="form-group" style="margin-bottom:0"><label>Value</label><input type="number" id="re-cval-${r.id}" min="0" step="0.01" value="${r.commissionValue || 0}"/></div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="Resellers.save('${r.id}')">Save</button>
            <button class="btn btn-outline btn-sm" onclick="Resellers.toggleEdit('${r.id}')">Cancel</button>
            <span style="font-size:.68rem;color:var(--muted);margin-left:.5rem">Changes apply to future sales; past sales keep their original rate.</span>
          </div>

          ${sales.length ? `
            <div class="reseller-sales">
              ${sales.map(t => {
                const amt = t.amountReceived != null ? t.amountReceived : (t.price || 0);
                return `<div class="reseller-sale-row">
                  <span class="rs-name">${esc(t.customerName)}</span>
                  <span class="rs-pkg">${esc(t.packageType)}</span>
                  <span class="rs-date">${t.approvedAt ? fmt(t.approvedAt) : '—'}</span>
                  <span class="rs-price">${_fmt(amt)}</span>
                </div>`;
              }).join('')}
              ${r.count > 5 ? `<div style="font-size:.68rem;color:var(--muted);padding:.3rem 0">+ ${r.count - 5} more</div>` : ''}
            </div>` : ''}

          <div style="margin-top:.6rem"><button class="btn btn-outline btn-sm" onclick="Resellers.toggleEdit('${r.id}')">✎ Edit commission</button></div>
        </div>`;
    }).join('');
  };

  const toggleEdit = (id) => {
    const el = document.getElementById('redit-' + id);
    if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
  };

  const save = async (id) => {
    const payload = {
      adminKey: Store.adminKey, id,
      contact: document.getElementById('re-contact-' + id)?.value || '',
      commissionType: document.getElementById('re-ctype-' + id)?.value || 'percent',
      commissionValue: parseFloat(document.getElementById('re-cval-' + id)?.value) || 0,
    };
    const d = await api('/admin/reseller/update', payload);
    if (d && d.success) { Dashboard.reload(); render(); } else alert('Failed to save.');
  };

  return { render, toggleEdit, save };
})();
