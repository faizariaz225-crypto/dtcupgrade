/* ─── DTC Admin — Product Keys Module ──────────────────────────────────── */
'use strict';

const Keys = (() => {

  const _fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  // ── Internal refresh helper ────────────────────────────────────────────────
  const _silentStoreRefresh = async () => {
    try {
      const fresh = await api('/admin/sessions-data', { adminKey: Store.adminKey });
      if (fresh && !fresh.error) {
        Store.load(fresh);
        try { refreshCustomerPicker(); refreshPaymentMethods(); } catch(e) {}
      }
    } catch(e) {}
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const render = async () => {
    // Product dropdown for adding keys
    const sel = document.getElementById('keys-add-product');
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = '<option value="">— Select product —</option>' +
        (Store.products || []).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
      if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
    }

    const wrap = document.getElementById('keys-list');
    const low  = document.getElementById('keys-lowstock');
    if (!wrap) return;

    wrap.innerHTML = '<div class="empty">Loading…</div>';

    let data;
    try { data = await (await fetch(`/admin/keys?adminKey=${encodeURIComponent(Store.adminKey)}`)).json(); }
    catch (e) { wrap.innerHTML = '<div class="empty">Could not load keys.</div>'; return; }

    const keys     = data.keys || [];
    const products = Store.products || [];
    const tokens   = Store.tokens  || {};

    // Group keys by product
    const byProd = {};
    keys.forEach(k => {
      const pid = k.productId || 'unassigned';
      (byProd[pid] = byProd[pid] || []).push(k);
    });

    // Low-stock banner (< 2 available among products that have keys)
    const lowList = [];
    Object.keys(byProd).forEach(pid => {
      const avail = byProd[pid].filter(k => !k.usedBy).length;
      if (avail < 2) {
        const p = products.find(x => x.id === pid);
        lowList.push({ name: p ? p.name : pid, avail });
      }
    });
    if (low) {
      low.innerHTML = lowList.length ? `
        <div class="card" style="border:1.5px solid #fde68a;background:#fffbeb;margin-bottom:1.2rem">
          <div style="font-weight:700;color:#b45309;margin-bottom:.4rem">⚠ Low key stock — add more</div>
          <div style="font-size:.82rem;color:#92633a;line-height:1.7">${lowList.map(l => `<strong>${esc(l.name)}</strong>: ${l.avail} key${l.avail !== 1 ? 's' : ''} left`).join(' · ')}</div>
        </div>` : '';
    }

    // Render one card per product that has keys
    const pids = Object.keys(byProd).sort((a, b) => {
      const an = (products.find(p => p.id === a) || {}).name || a;
      const bn = (products.find(p => p.id === b) || {}).name || b;
      return an.localeCompare(bn);
    });
    if (!pids.length) { wrap.innerHTML = '<div class="empty">No keys yet. Add some above — they\'ll appear in the create-link dropdown for that product.</div>'; return; }

    wrap.innerHTML = pids.map(pid => {
      const list  = byProd[pid];
      const p     = products.find(x => x.id === pid);
      const name  = p ? p.name : (list[0].productName || pid);
      const avail = list.filter(k => !k.usedBy);
      const used  = list.filter(k =>  k.usedBy);
      const lowBadge = avail.length < 2
        ? `<span style="font-size:.62rem;background:#fef3c7;border:1px solid #fde68a;border-radius:4px;padding:.08rem .4rem;color:#b45309;font-weight:700;margin-left:.4rem">⚠ LOW</span>`
        : '';

      // ── Available keys ─────────────────────────────────────────────────────
      const availHTML = avail.length
        ? `<div style="display:flex;flex-direction:column;gap:.35rem;margin-bottom:.9rem">
            ${avail.map(k => {
              // safe index used as HTML id (avoid special chars in key value)
              const safeId = 'asel-' + btoa(unescape(encodeURIComponent(k.key))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
              const eligibleTokens = Object.entries(tokens)
                .filter(([, t]) => t.approved && !t.refunded && !t.deactivated && (t.productId === pid || !pid) && !t.subscriptionKey)
                .sort((a, b) => (a[1].customerName || '').localeCompare(b[1].customerName || ''));
              const assignOpts = eligibleTokens.length
                ? `<select id="${safeId}" style="font-size:.72rem;padding:.25rem .4rem;border:1.5px solid var(--border);border-radius:6px;background:#fff;max-width:160px">
                    <option value="">Assign to…</option>
                    ${eligibleTokens.map(([tk, t]) => `<option value="${tk}">${esc(t.customerName || tk)} · ${esc(t.packageType || '')}</option>`).join('')}
                   </select>
                   <button class="btn btn-outline btn-sm" style="border-color:var(--blue-mid);color:var(--blue)"
                     data-assign-key="${encodeURIComponent(k.key)}"
                     data-assign-sel="${safeId}">Assign</button>`
                : `<span style="font-size:.7rem;color:var(--muted2)">No unkeyed subscriptions</span>`;

              // FIX 1: use data-del-key attribute instead of inline onclick with JSON.stringify
              return `<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:7px;padding:.45rem .8rem">
                <span style="font-family:'JetBrains Mono',monospace;font-size:.8rem;flex:1;min-width:0;word-break:break-all">${esc(k.key)}</span>
                <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                  ${assignOpts}
                  <button class="btn btn-outline btn-sm" style="border-color:var(--error-border);color:var(--error)"
                    data-del-key="${encodeURIComponent(k.key)}">Delete</button>
                </div>
              </div>`;
            }).join('')}
          </div>`
        : `<div style="font-size:.78rem;color:var(--error);margin-bottom:.9rem">None available — add more above.</div>`;

      // ── Used / history keys ────────────────────────────────────────────────
      const usedHTML = used.length
        ? `<div style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.4rem">Used — history (${used.length})</div>
           <div style="display:flex;flex-direction:column;gap:.35rem">
             ${used.map(k => {
               const token = k.usedBy;
               const t     = token ? (tokens[token] || {}) : {};
               const custName = k.customerName || t.customerName || 'Unknown';
               const pkg      = k.packageType  || t.packageType  || '';
               const custLink = token
                 ? `<button class="btn-link-cust" title="Jump to customer in Customers tab"
                       data-goto-token="${token}"
                    >👤 ${esc(custName)}</button>${pkg ? `<span style="color:var(--muted);font-size:.7rem"> · ${esc(pkg)}</span>` : ''}`
                 : `<strong>${esc(custName)}</strong>${pkg ? `<span style="color:var(--muted)"> · ${esc(pkg)}</span>` : ''}`;

               // FIX 2: use data-unassign-key attribute (handled by persistent delegated listener below)
               return `<div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;background:#f8fafc;border:1px solid var(--border);border-radius:7px;padding:.45rem .8rem">
                 <span style="font-family:'JetBrains Mono',monospace;font-size:.8rem;color:var(--muted);text-decoration:line-through;flex:1;min-width:0;word-break:break-all">${esc(k.key)}</span>
                 <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                   <span style="font-size:.74rem">→ ${custLink}</span>
                   <span style="font-size:.7rem;color:var(--muted2)">${_fmtDate(k.assignedAt)}</span>
                   <button class="btn btn-outline btn-sm" style="border-color:var(--warn-border);color:var(--warn);font-size:.68rem"
                     data-unassign-key="${encodeURIComponent(k.key)}"
                     title="Remove this key from the subscription and return it to Available">↩ Unassign</button>
                 </div>
               </div>`;
             }).join('')}
           </div>`
        : '';

      return `
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;margin-bottom:.7rem">
          <div style="font-weight:700;font-size:1.02rem">${esc(name)} ${lowBadge}</div>
          <div style="font-size:.76rem;color:var(--muted)"><strong style="color:var(--success)">${avail.length}</strong> available · ${used.length} used</div>
        </div>

        <div style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.4rem">Available (${avail.length})</div>
        ${availHTML}
        ${usedHTML}
      </div>`;
    }).join('');

    // ── Single persistent delegated listener on #keys-list ──────────────────
    // (attached once here after render, handles all three button types)
    _bindListEvents(wrap);
  };

  // Persistent click delegation — survives re-render since we re-call after each render
  let _listenerAttached = false;
  const _boundHandler = (e) => {
    // Delete unused key
    const delBtn = e.target.closest('[data-del-key]');
    if (delBtn) { del(decodeURIComponent(delBtn.dataset.delKey)); return; }

    // Unassign used key
    const unBtn = e.target.closest('[data-unassign-key]');
    if (unBtn) { unassign(decodeURIComponent(unBtn.dataset.unassignKey)); return; }

    // Assign available key to subscription
    const assignBtn = e.target.closest('[data-assign-key]');
    if (assignBtn) {
      const key   = decodeURIComponent(assignBtn.dataset.assignKey);
      const selEl = document.getElementById(assignBtn.dataset.assignSel);
      assign(key, selEl ? selEl.value : '');
      return;
    }

    // Navigate to customer
    const gotoBtn = e.target.closest('[data-goto-token]');
    if (gotoBtn) { goToCustomer(gotoBtn.dataset.gotoToken); return; }
  };

  const _bindListEvents = (wrap) => {
    // Remove old listener then re-add so we never double-fire
    wrap.removeEventListener('click', _boundHandler);
    wrap.addEventListener('click', _boundHandler);
  };

  // ── Add keys ───────────────────────────────────────────────────────────────
  const add = async () => {
    const productId = document.getElementById('keys-add-product')?.value || '';
    const text      = document.getElementById('keys-add-text')?.value    || '';
    const status    = document.getElementById('keys-add-status');
    const keys      = text.split('\n').map(s => s.trim()).filter(Boolean);
    if (!productId) { if (status) status.textContent = 'Select a product first.'; return; }
    if (!keys.length) { if (status) status.textContent = 'Enter at least one key.'; return; }
    if (status) status.textContent = 'Adding…';
    const d = await api('/admin/keys/add', { adminKey: Store.adminKey, productId, keys });
    if (d && d.success) {
      if (status) status.textContent = `✓ Added ${d.added}${d.skipped ? `, skipped ${d.skipped} duplicate(s)` : ''}.`;
      document.getElementById('keys-add-text').value = '';
      await render();
      await _silentStoreRefresh();
    } else if (status) status.textContent = '✕ ' + ((d && d.error) || 'Failed.');
  };

  // ── Delete unused key ──────────────────────────────────────────────────────
  const del = async (key) => {
    if (!confirm('Delete this unused key? It will be removed permanently.')) return;
    const d = await api('/admin/keys/delete', { adminKey: Store.adminKey, key });
    if (d && d.success) { await render(); await _silentStoreRefresh(); }
    else alert((d && d.error) || 'Failed to delete.');
  };

  // ── Unassign a used key → returns it to Available ──────────────────────────
  const unassign = async (key) => {
    if (!confirm('Unassign this key?\n\nIt will be removed from the customer\'s subscription and returned to the Available pool.')) return;
    const d = await api('/admin/keys/unassign', { adminKey: Store.adminKey, key });
    if (d && d.success) { await render(); await _silentStoreRefresh(); }
    else alert((d && d.error) || 'Failed to unassign key.');
  };

  // ── Assign an available key to a subscription ──────────────────────────────
  const assign = async (key, token) => {
    if (!token) { alert('Please select a subscription to assign this key to.'); return; }
    const t = (Store.tokens || {})[token] || {};
    const name = t.customerName || token;
    if (!confirm(`Assign this key to ${name}?\n\nIt will move from Available to Used history and be linked to their subscription.`)) return;
    const d = await api('/admin/keys/assign', { adminKey: Store.adminKey, key, token });
    if (d && d.success) { await render(); await _silentStoreRefresh(); }
    else alert((d && d.error) || 'Failed to assign key.');
  };

  // FIX 3: Navigate to Customers tab and scroll/highlight the matching card
  const goToCustomer = (token) => {
    // Find the Customers nav item and trigger Shell.navigate
    const navEl = [...document.querySelectorAll('.nav-item')]
      .find(el => el.getAttribute('onclick') && el.getAttribute('onclick').includes("'customers'"));
    if (navEl) {
      Shell.navigate('customers', navEl);
    } else {
      // fallback: directly activate the page
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const pg = document.getElementById('page-customers');
      if (pg) pg.classList.add('active');
      Customers.render();
    }

    // After the tab renders, find the card by token and scroll to it
    setTimeout(() => {
      // Customer cards are identified by their token in the cust-more div id (cm-TOKEN)
      // and the expand button. We look for a card that contains the cm- element.
      const cmEl = document.getElementById('cm-' + token);
      if (cmEl) {
        // Walk up to the .cust-card wrapper
        const card = cmEl.closest('.cust-card') || cmEl.parentElement;
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const prev = card.style.outline;
          card.style.outline = '2.5px solid var(--blue)';
          card.style.outlineOffset = '3px';
          setTimeout(() => { card.style.outline = prev || ''; card.style.outlineOffset = ''; }, 2500);
        }
      } else {
        // Card may not be rendered yet (customers.render is async) — retry once
        setTimeout(() => {
          const cmEl2 = document.getElementById('cm-' + token);
          if (!cmEl2) return;
          const card = cmEl2.closest('.cust-card') || cmEl2.parentElement;
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.outline = '2.5px solid var(--blue)';
            card.style.outlineOffset = '3px';
            setTimeout(() => { card.style.outline = ''; card.style.outlineOffset = ''; }, 2500);
          }
        }, 600);
      }
    }, 200);
  };

  return { render, add, del, unassign, assign, goToCustomer };
})();

