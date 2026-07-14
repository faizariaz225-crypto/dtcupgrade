/* ─── DTC Admin — Customer Requests Module ───────────────────────────────── */
'use strict';

const Requests = (() => {

  let _all = [];
  let _filter = 'pending';

  const render = async () => {
    try {
      const d = await api(`/admin/requests?adminKey=${encodeURIComponent(Store.adminKey)}`);
      _all = (d && d.requests) ? d.requests : [];
    } catch (e) {
      _all = [];
    }
    _paint();
    _badge();
  };

  const _badge = () => {
    const n = _all.filter(r => r.status === 'pending').length;
    const el = document.getElementById('req-nav-badge');
    if (el) {
      el.textContent = n || '';
      el.style.display = n ? 'inline-block' : 'none';
    }
  };

  const setFilter = (f, el) => {
    _filter = f;
    document.querySelectorAll('[data-req-filter]').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    _paint();
  };

  const _paint = () => {
    const box = document.getElementById('req-list');
    if (!box) return;

    const list = _all.filter(r => _filter === 'all' ? true : r.status === _filter);

    if (!list.length) {
      box.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--muted);font-size:.85rem">No ${_filter === 'all' ? '' : _filter} requests.</div>`;
      return;
    }

    box.innerHTML = list.map(r => {
      const colour = r.status === 'approved' ? 'background:#dcfce7;color:#15803d'
                   : r.status === 'rejected' ? 'background:#fee2e2;color:#b91c1c'
                   : 'background:#fef3c7;color:#b45309';
      const when = (r.createdAt || '').slice(0, 16).replace('T', ' ');

      return `
      <div style="border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:.8rem;background:#fff">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:.5rem">
          <div>
            <div style="font-weight:600;font-size:.92rem">${esc(r.productName)} <span style="color:var(--muted);font-weight:400">— ${esc(r.packageLabel)}</span></div>
            <div style="font-size:.76rem;color:var(--muted);margin-top:.15rem">${esc(r.email)} · ${esc(when)} · ${esc(String(r.price != null ? r.price : ''))}</div>
          </div>
          <span style="font-size:.64rem;font-weight:700;padding:.25rem .6rem;border-radius:999px;text-transform:uppercase;${colour}">${esc(r.status)}</span>
        </div>

        <div style="display:flex;gap:.8rem;align-items:flex-start;flex-wrap:wrap;margin-bottom:.6rem">
          ${r.receiptFile ? `
            <a href="/receipts/${esc(r.receiptFile)}?adminKey=${encodeURIComponent(Store.adminKey)}" target="_blank"
               style="display:block;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:#fff" title="Open receipt">
              ${/\.pdf$/i.test(r.receiptFile)
                ? '<div style="width:110px;height:110px;display:flex;align-items:center;justify-content:center;font-size:.72rem;color:var(--muted);font-weight:600">📄 PDF receipt</div>'
                : `<img src="/receipts/${esc(r.receiptFile)}?adminKey=${encodeURIComponent(Store.adminKey)}" style="width:110px;height:110px;object-fit:cover;display:block">`}
            </a>` : '<div style="width:110px;height:110px;border:1px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.68rem;color:var(--muted)">No receipt</div>'}
          <div style="flex:1;min-width:200px;font-size:.78rem;color:#475569">
            <div style="margin-bottom:.25rem"><b>Paid via:</b> ${esc(r.paymentMethodName || '—')}</div>
            <div style="margin-bottom:.25rem"><b>Receipt ID:</b> ${esc(r.receiptId || '—')}</div>
            ${r.note ? `<div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:.5rem .7rem;margin-top:.4rem"><b>Customer note:</b> ${esc(r.note)}</div>` : ''}
          </div>
        </div>

        ${r.status === 'approved' && r.link
          ? `<div style="font-size:.76rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:.5rem .7rem;margin-bottom:.6rem;word-break:break-all">
               <b style="color:#15803d">Link delivered to portal:</b> ${esc(r.link)}
             </div>`
          : `<div style="font-size:.76rem;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:.5rem .7rem;margin-bottom:.6rem">
               Generate a link for <b>${esc(r.email)}</b> with this exact product and package on the
               <b>Customers</b> page — it attaches here and appears in their portal automatically.
             </div>`}

        <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="Requests.goCreate('${esc(r.id)}')">Create link →</button>
          ${r.status !== 'rejected' ? `<button class="btn btn-outline btn-sm" onclick="Requests.reject('${esc(r.id)}')">Reject</button>` : ''}
          <button class="btn btn-outline btn-sm" onclick="Requests.remove('${esc(r.id)}')">Delete</button>
        </div>
      </div>`;
    }).join('');
  };

  // Jump to the Customers page with this request's details prefilled
  const goCreate = (id) => {
    const r = _all.find(x => x.id === id);
    if (!r) return;
    try {
      Store.prefillRequest = { email: r.email, productId: r.productId, packageLabel: r.packageLabel, price: r.price };
      sessionStorage.setItem('dtc_prefill', JSON.stringify(Store.prefillRequest));
    } catch (e) {}
    const nav = document.querySelector('.nav-item[onclick*="customers"]');
    if (nav) Shell.navigate('customers', nav);
    showMsg('rq-ok', 'rq-err', true,
      `Create the link for ${r.email} — ${r.productName} / ${r.packageLabel}. It will attach to this request automatically.`);
  };

  const reject = async (id) => {
    const why = prompt('Reason for the customer (optional):', '');
    if (why === null) return;
    await _update({ id, status: 'rejected', adminNote: why || '' });
  };

  const remove = async (id) => {
    if (!confirm('Delete this request permanently?')) return;
    try {
      await api('/admin/requests/delete', { adminKey: Store.adminKey, id });
      showMsg('rq-ok', 'rq-err', true, 'Request deleted.');
      render();
    } catch (e) {
      showMsg('rq-ok', 'rq-err', false, 'Delete failed.');
    }
  };

  const _update = async (payload) => {
    try {
      const d = await api('/admin/requests/update', { adminKey: Store.adminKey, ...payload });
      if (d && d.error) throw new Error(d.error);
      showMsg('rq-ok', 'rq-err', true,
        payload.status === 'approved' ? 'Link sent — the customer can see it in their portal.' : 'Request updated.');
      render();
    } catch (e) {
      showMsg('rq-ok', 'rq-err', false, e.message || 'Update failed.');
    }
  };

  // Keep the sidebar badge fresh so new requests surface without a refresh
  const poll = () => {
    setInterval(async () => {
      if (!Store.adminKey) return;
      try {
        const d = await api(`/admin/requests?adminKey=${encodeURIComponent(Store.adminKey)}`);
        if (d && d.requests) { _all = d.requests; _badge(); }
      } catch (e) {}
    }, 60000);
  };

  return { render, setFilter, goCreate, reject, remove, poll };
})();
