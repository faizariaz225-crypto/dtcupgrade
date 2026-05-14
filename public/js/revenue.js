/* ─── DTC Admin — Revenue Module ────────────────────────────────────────── */
'use strict';

const Revenue = (() => {

  // Track which product blocks are expanded
  const _expanded = new Set();

  const render = () => {
    const tokens   = Store.tokens;
    const products = Store.products || [];
    const rev      = Store.revenue  || { total: 0, byProduct: {} };

    // Stats
    const sym = (Store.settings || {}).currencySymbol || '$';
    document.getElementById('rev-total').textContent = sym + rev.total.toFixed(2);

    // Per-product breakdown
    const wrap = document.getElementById('rev-breakdown');
    if (!wrap) return;

    // Build activated tokens list sorted by date desc
    const activated = Object.entries(tokens)
      .filter(([, t]) => t.approved && t.price)
      .sort((a, b) => new Date(b[1].approvedAt || 0) - new Date(a[1].approvedAt || 0));

    if (!activated.length) {
      wrap.innerHTML = '<div class="empty">No revenue yet. Activate your first customer to start tracking.</div>';
      return;
    }

    // Group by product
    const byProd = {};
    activated.forEach(([tok, t]) => {
      const pid = t.productId || 'unknown';
      if (!byProd[pid]) byProd[pid] = { name: t.productName || pid, total: 0, count: 0, items: [] };
      byProd[pid].total += t.price;
      byProd[pid].count++;
      byProd[pid].items.push([tok, t]);
    });

    const totalRev  = activated.reduce((s, [, t]) => s + t.price, 0);
    const PREVIEW   = 5;

    wrap.innerHTML = Object.entries(byProd).map(([pid, g]) => {
      const prod        = products.find(p => p.id === pid);
      const color       = prod ? (prod.color || '#2563eb') : '#6366f1';
      const pct         = totalRev > 0 ? (g.total / totalRev * 100) : 0;
      const isExpanded  = _expanded.has(pid);
      const visible     = isExpanded ? g.items : g.items.slice(0, PREVIEW);
      const hiddenCount = g.items.length - PREVIEW;

      const rows = visible.map(([, t]) =>
        `<div class="rev-row">
          <span class="rev-row-name">${esc(t.customerName)}</span>
          <span class="rev-row-pkg">${esc(t.packageType)}</span>
          <span class="rev-row-date">${t.approvedAt ? fmt(t.approvedAt) : '—'}</span>
          <span class="rev-row-price">${sym}${t.price.toFixed(2)}</span>
        </div>`).join('');

      const moreBtn = g.items.length > PREVIEW ? `
        <button
          onclick="Revenue.toggle('${pid}')"
          style="margin-top:.6rem;display:inline-flex;align-items:center;gap:.35rem;
                 background:var(--blue-light);border:1.5px solid var(--blue-mid);
                 border-radius:7px;padding:.35rem .85rem;font-size:.74rem;font-weight:600;
                 color:var(--blue);cursor:pointer;transition:background .15s"
          onmouseover="this.style.background='#dbeafe'"
          onmouseout="this.style.background='var(--blue-light)'">
          ${isExpanded
            ? '<span style="font-size:.8rem">&#9650;</span> Show less'
            : `<span style="font-size:.8rem">&#9660;</span> Show ${hiddenCount} more sale${hiddenCount !== 1 ? 's' : ''}`}
        </button>` : '';

      return `<div class="rev-product-block">
        <div class="rev-product-header">
          <div style="display:flex;align-items:center;gap:.6rem">
            <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
            <span class="rev-product-name">${esc(g.name)}</span>
            <span class="rev-count">${g.count} sale${g.count !== 1 ? 's' : ''}</span>
          </div>
          <span class="rev-product-total" style="color:${color}">${sym}${g.total.toFixed(2)}</span>
        </div>
        <div class="rev-bar-wrap">
          <div class="rev-bar"><div class="rev-bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>
          <span class="rev-bar-pct">${pct.toFixed(0)}%</span>
        </div>
        ${rows}
        ${moreBtn}
      </div>`;
    }).join('');
  };

  // Toggle expanded state for a product block and re-render in place
  const toggle = (pid) => {
    if (_expanded.has(pid)) _expanded.delete(pid);
    else _expanded.add(pid);
    render();
  };

  return { render, toggle };
})();
