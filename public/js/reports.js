/* ─── DTC Admin — Reports Module ───────────────────────────────────────── */
'use strict';

const Reports = (() => {

  const DEFS = [
    { type: 'activations', icon: '📈', title: 'Total Activations',
      desc: 'Summary of all activations with a breakdown by day, week or month, plus totals by product.',
      hideable: ['Revenue'] },
    { type: 'customers', icon: '👥', title: 'Customer-wise Activations',
      desc: 'Every customer with their number of activations and total spend, plus a full activation list.',
      hideable: ['Email', 'WeChat', 'Total Spent', 'Payment', 'Reseller', 'First Activation', 'Last Activation'] },
    { type: 'resellers', icon: '🤝', title: 'Reseller Clients & Reports',
      desc: 'A single reseller (or all) with their clients, activations, sales and commission, plus a detailed list.',
      hideable: ['Contact', 'Commission Rate', 'Sales', 'Commission Earned', 'Commission', 'Amount'], perReseller: true },
    { type: 'profit', icon: '💵', title: 'Profit & Margin',
      desc: 'Revenue minus cost and reseller commission → profit and margin, by product, customer, reseller and total.',
      hideable: ['Revenue', 'Cost', 'Commission', 'Margin %'] },
  ];

  const render = () => {
    const wrap = document.getElementById('reports-cards');
    if (!wrap) return;
    const resellerOpts = '<option value="">All resellers</option>' +
      (Store.resellers || []).map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
    wrap.innerHTML = DEFS.map(d => `
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.3rem">
          <span style="font-size:1.4rem">${d.icon}</span>
          <span style="font-weight:700;font-size:1.05rem">${d.title}</span>
        </div>
        <div style="font-size:.82rem;color:var(--muted);line-height:1.6;margin-bottom:.9rem">${d.desc}</div>

        <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.7rem">
          <label style="font-size:.75rem;font-weight:600">Group by:</label>
          <select id="rep-period-${d.type}" style="padding:.4rem .7rem;font-size:.8rem;border:1.5px solid var(--border);border-radius:7px;background:var(--white)">
            <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly" selected>Monthly</option>
          </select>
          ${d.perReseller ? `<label style="font-size:.75rem;font-weight:600;margin-left:.4rem">Reseller:</label>
            <select id="rep-reseller" style="padding:.4rem .7rem;font-size:.8rem;border:1.5px solid var(--border);border-radius:7px;background:var(--white)">${resellerOpts}</select>` : ''}
        </div>

        <details style="margin-bottom:.8rem">
          <summary style="font-size:.75rem;font-weight:600;color:var(--muted);cursor:pointer">🔧 Hide columns (optional)</summary>
          <div style="display:flex;flex-wrap:wrap;gap:.5rem .9rem;margin-top:.5rem">
            ${d.hideable.map(h => `<label style="font-size:.76rem;font-weight:500;display:flex;align-items:center;gap:.3rem;cursor:pointer">
              <input type="checkbox" class="rep-hide-${d.type}" value="${esc(h)}" style="width:auto"/> ${esc(h)}</label>`).join('')}
          </div>
        </details>

        <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="Reports.download('${d.type}','xlsx')">⬇ Excel (.xlsx)</button>
          <button class="btn btn-outline btn-sm" onclick="Reports.download('${d.type}','pdf')">⬇ PDF</button>
        </div>
      </div>`).join('');
  };

  const download = (type, format) => {
    const period = document.getElementById('rep-period-' + type)?.value || 'monthly';
    const hide = [...document.querySelectorAll('.rep-hide-' + type + ':checked')].map(c => c.value);
    let url = `/admin/report?adminKey=${encodeURIComponent(Store.adminKey)}&type=${type}&period=${period}&format=${format}`;
    if (hide.length) url += '&hide=' + encodeURIComponent(hide.join(','));
    if (type === 'resellers') {
      const rid = document.getElementById('rep-reseller')?.value || '';
      if (rid) url += '&resellerId=' + encodeURIComponent(rid);
    }
    window.open(url, '_blank');
  };

  return { render, download };
})();
