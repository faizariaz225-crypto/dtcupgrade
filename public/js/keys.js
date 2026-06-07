/* ─── DTC Admin — Product Keys Module ──────────────────────────────────── */
'use strict';

const Keys = (() => {

  const _fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

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

    const keys = data.keys || [];
    const products = Store.products || [];

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
      const list = byProd[pid];
      const p = products.find(x => x.id === pid);
      const name = p ? p.name : (list[0].productName || pid);
      const avail = list.filter(k => !k.usedBy);
      const used  = list.filter(k => k.usedBy);
      const lowBadge = avail.length < 2 ? `<span style="font-size:.62rem;background:#fef3c7;border:1px solid #fde68a;border-radius:4px;padding:.08rem .4rem;color:#b45309;font-weight:700;margin-left:.4rem">⚠ LOW</span>` : '';
      return `
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;margin-bottom:.7rem">
          <div style="font-weight:700;font-size:1.02rem">${esc(name)} ${lowBadge}</div>
          <div style="font-size:.76rem;color:var(--muted)"><strong style="color:var(--success)">${avail.length}</strong> available · ${used.length} used</div>
        </div>

        <div style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.4rem">Available (${avail.length})</div>
        ${avail.length ? `<div style="display:flex;flex-direction:column;gap:.35rem;margin-bottom:.9rem">
          ${avail.map(k => `<div style="display:flex;justify-content:space-between;align-items:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:7px;padding:.4rem .7rem">
            <span style="font-family:'JetBrains Mono',monospace;font-size:.8rem">${esc(k.key)}</span>
            <button class="btn btn-outline btn-sm" style="border-color:var(--error-border);color:var(--error)" onclick="Keys.del('${esc(k.key)}')">Delete</button>
          </div>`).join('')}
        </div>` : '<div style="font-size:.78rem;color:var(--error);margin-bottom:.9rem">None available — add more above.</div>'}

        ${used.length ? `
          <div style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.4rem">Used — history (${used.length})</div>
          <div style="display:flex;flex-direction:column;gap:.35rem">
            ${used.map(k => `<div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;border:1px solid var(--border);border-radius:7px;padding:.4rem .7rem;gap:.5rem;flex-wrap:wrap">
              <span style="font-family:'JetBrains Mono',monospace;font-size:.8rem;color:var(--muted);text-decoration:line-through">${esc(k.key)}</span>
              <span style="font-size:.74rem">→ <strong>${esc(k.customerName || 'Unknown')}</strong> <span style="color:var(--muted)">· ${_fmtDate(k.assignedAt)}</span></span>
            </div>`).join('')}
          </div>` : ''}
      </div>`;
    }).join('');
  };

  const add = async () => {
    const productId = document.getElementById('keys-add-product')?.value || '';
    const text = document.getElementById('keys-add-text')?.value || '';
    const status = document.getElementById('keys-add-status');
    const keys = text.split('\n').map(s => s.trim()).filter(Boolean);
    if (!productId) { if (status) status.textContent = 'Select a product first.'; return; }
    if (!keys.length) { if (status) status.textContent = 'Enter at least one key.'; return; }
    const d = await api('/admin/keys/add', { adminKey: Store.adminKey, productId, keys });
    if (d && d.success) {
      if (status) status.textContent = `✓ Added ${d.added}${d.skipped ? `, skipped ${d.skipped} duplicate(s)` : ''}.`;
      document.getElementById('keys-add-text').value = '';
      Dashboard.reload();      // refresh Store.keys/keyStock for the create-link dropdown
      render();
    } else if (status) status.textContent = '✕ ' + ((d && d.error) || 'Failed.');
  };

  const del = async (key) => {
    if (!confirm('Delete this unused key?')) return;
    const d = await api('/admin/keys/delete', { adminKey: Store.adminKey, key });
    if (d && d.success) { Dashboard.reload(); render(); }
    else alert((d && d.error) || 'Failed to delete.');
  };

  return { render, add, del };
})();
