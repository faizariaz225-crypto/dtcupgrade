/* ─── DTC Admin — Resellers Module ──────────────────────────────────────── */
'use strict';

const Resellers = (() => {

  const _fmt = (amount) => ((Store.settings || {}).currencySymbol || '$') + (Number(amount) || 0).toFixed(2);
  const _commLabel = (r) => r.commissionType === 'flat'
    ? `${_fmt(r.commissionValue)} / sale`
    : `${r.commissionValue || 0}% of sale`;

  // ── Delegated click handler for the reseller list ─────────────────────────
  const _onWrapClick = (e) => {
    const delBtn = e.target.closest('[data-del-reseller-id]');
    if (delBtn) {
      del(delBtn.dataset.delResellerId, delBtn.dataset.delResellerName);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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
    const tokens = Store.tokens || {};

    // ── Add-reseller form (always visible at top) ──────────────────────────
    const addForm = `
      <div class="card" style="margin-bottom:1.2rem;background:#f0fdf4;border:1.5px solid #bbf7d0">
        <div style="font-weight:700;font-size:.95rem;margin-bottom:.7rem">➕ Add Reseller</div>
        <div class="form-row" style="margin-bottom:.5rem;flex-wrap:wrap;gap:.5rem">
          <div class="form-group" style="margin-bottom:0;flex:1;min-width:140px">
            <label>Name <span style="color:var(--error)">*</span></label>
            <input id="ra-name" placeholder="e.g. Ahmed Khan"/>
          </div>
          <div class="form-group" style="margin-bottom:0;flex:1;min-width:140px">
            <label>Contact</label>
            <input id="ra-contact" placeholder="WeChat / phone / email"/>
          </div>
          <div class="form-group" style="margin-bottom:0;flex:0 0 150px">
            <label>Commission Type</label>
            <select id="ra-ctype">
              <option value="percent">Percentage (%)</option>
              <option value="flat">Flat per sale</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;flex:0 0 100px">
            <label>Value</label>
            <input type="number" id="ra-cval" min="0" step="0.01" placeholder="e.g. 20"/>
          </div>
          <div class="form-group" style="margin-bottom:0;flex:1;min-width:140px">
            <label>Note</label>
            <input id="ra-note" placeholder="Optional internal note"/>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:.6rem;margin-top:.4rem">
          <button class="btn btn-primary btn-sm" onclick="Resellers.add()">Add Reseller</button>
          <span id="ra-status" style="font-size:.75rem;color:var(--muted)"></span>
        </div>
      </div>`;

    if (!resellers.length) {
      wrap.innerHTML = addForm + '<div class="empty">No resellers yet. Add one above — they\'ll be tracked here with their commission.</div>';
      return;
    }

    wrap.innerHTML = addForm + resellers.map(r => {
      const sales = Object.values(tokens)
        .filter(t => t.resellerId === r.id && t.approved)
        .sort((a, b) => new Date(b.approvedAt || 0) - new Date(a.approvedAt || 0))
        .slice(0, 5);

      return `
        <div class="reseller-card" id="rcard-${r.id}">
          <div class="reseller-header">
            <div>
              <div class="reseller-name">${esc(r.name)}${r.contact ? `<span style="font-weight:400;color:var(--muted);font-size:.76rem"> · ${esc(r.contact)}</span>` : ''}</div>
              <div class="reseller-id">ID: ${esc(r.id)} · Commission: ${_commLabel(r)}${r.note ? ` · <em style="color:var(--muted)">${esc(r.note)}</em>` : ''}</div>
            </div>
            <div style="text-align:right">
              <div class="reseller-revenue">${_fmt(r.total)}</div>
              <div class="reseller-count">${r.count} sale${r.count !== 1 ? 's' : ''} · ${r.activated || 0} activated${r.refunded ? ' · ' + r.refunded + ' refunded' : ''}</div>
              <div style="font-size:.8rem;font-weight:700;color:#7c3aed;margin-top:.2rem">Profit: ${_fmt(r.commission)}</div>
            </div>
          </div>

          <!-- ── Edit form (hidden by default) ────────────────────────── -->
          <div id="redit-${r.id}" style="display:none;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:.75rem .85rem;margin-bottom:.65rem">
            <div style="font-weight:600;font-size:.82rem;margin-bottom:.55rem;color:#6d28d9">Edit Reseller</div>
            <div class="form-row" style="flex-wrap:wrap;gap:.5rem;margin-bottom:.5rem">
              <div class="form-group" style="margin-bottom:0;flex:1;min-width:130px">
                <label>Name <span style="color:var(--error)">*</span></label>
                <input id="re-name-${r.id}" value="${esc(r.name)}"/>
              </div>
              <div class="form-group" style="margin-bottom:0;flex:1;min-width:130px">
                <label>Contact</label>
                <input id="re-contact-${r.id}" value="${esc(r.contact || '')}"/>
              </div>
              <div class="form-group" style="margin-bottom:0;flex:0 0 150px">
                <label>Commission Type</label>
                <select id="re-ctype-${r.id}">
                  <option value="percent"${r.commissionType !== 'flat' ? ' selected' : ''}>Percentage (%)</option>
                  <option value="flat"${r.commissionType === 'flat' ? ' selected' : ''}>Flat per sale</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0;flex:0 0 100px">
                <label>Value</label>
                <input type="number" id="re-cval-${r.id}" min="0" step="0.01" value="${r.commissionValue || 0}"/>
              </div>
              <div class="form-group" style="margin-bottom:0;flex:1;min-width:130px">
                <label>Note</label>
                <input id="re-note-${r.id}" value="${esc(r.note || '')}" placeholder="Internal note"/>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" onclick="Resellers.save('${r.id}')">Save changes</button>
              <button class="btn btn-outline btn-sm" onclick="Resellers.toggleEdit('${r.id}')">Cancel</button>
              <span style="font-size:.68rem;color:var(--muted)">Name changes apply everywhere; commission changes apply to future sales only.</span>
            </div>
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

          <div style="margin-top:.65rem;display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" onclick="Resellers.toggleEdit('${r.id}')">✎ Edit</button>
            <button class="btn btn-outline btn-sm" style="border-color:var(--error-border);color:var(--error)"
              data-del-reseller-id="${esc(r.id)}"
              data-del-reseller-name="${esc(r.name)}">🗑 Delete</button>
          </div>
        </div>`;
    }).join('');

    // Bind delegated listener (persistent — handles delete across re-renders)
    wrap.removeEventListener('click', _onWrapClick);
    wrap.addEventListener('click', _onWrapClick);
  };

  // ── Add ────────────────────────────────────────────────────────────────────
  const add = async () => {
    const name    = document.getElementById('ra-name')?.value.trim()   || '';
    const contact = document.getElementById('ra-contact')?.value.trim()|| '';
    const ctype   = document.getElementById('ra-ctype')?.value         || 'percent';
    const cval    = parseFloat(document.getElementById('ra-cval')?.value) || 0;
    const note    = document.getElementById('ra-note')?.value.trim()   || '';
    const status  = document.getElementById('ra-status');
    if (!name) { if (status) status.textContent = 'Name is required.'; return; }
    if (status) status.textContent = 'Adding…';
    const d = await api('/admin/reseller/add', {
      adminKey: Store.adminKey, name, contact,
      commissionType: ctype, commissionValue: cval, note,
    });
    if (d && d.success) {
      if (status) status.textContent = `✓ ${name} added.`;
      // Clear form
      ['ra-name','ra-contact','ra-cval','ra-note'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      await Dashboard.reload();
      await render();
    } else {
      if (status) status.textContent = '✕ ' + ((d && d.error) || 'Failed to add reseller.');
    }
  };

  // ── Toggle edit panel ──────────────────────────────────────────────────────
  const toggleEdit = (id) => {
    const el = document.getElementById('redit-' + id);
    if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
  };

  // ── Save edits ─────────────────────────────────────────────────────────────
  const save = async (id) => {
    const name    = document.getElementById('re-name-' + id)?.value.trim()    || '';
    const contact = document.getElementById('re-contact-' + id)?.value.trim() || '';
    const ctype   = document.getElementById('re-ctype-' + id)?.value          || 'percent';
    const cval    = parseFloat(document.getElementById('re-cval-' + id)?.value) || 0;
    const note    = document.getElementById('re-note-' + id)?.value.trim()    || '';
    if (!name) { alert('Name cannot be empty.'); return; }
    const d = await api('/admin/reseller/update', {
      adminKey: Store.adminKey, id, name, contact,
      commissionType: ctype, commissionValue: cval, note,
    });
    if (d && d.success) {
      await Dashboard.reload();
      await render();
    } else {
      alert('Failed to save: ' + ((d && d.error) || 'Unknown error.'));
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const del = async (id, name) => {
    if (!confirm(`Delete reseller "${name}"?\n\nTheir sales history will remain in the system but won't be grouped under this reseller any more. This cannot be undone.`)) return;
    const d = await api('/admin/reseller/delete', { adminKey: Store.adminKey, id });
    if (d && d.success) {
      await Dashboard.reload();
      await render();
    } else {
      alert('Failed to delete: ' + ((d && d.error) || 'Unknown error.'));
    }
  };

  return { render, add, toggleEdit, save, del };
})();
