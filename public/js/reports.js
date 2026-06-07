/* ─── DTC Admin — Reports Module ───────────────────────────────────────── */
'use strict';

const Reports = (() => {

  const DEFS = [
    { type: 'activations', icon: '📈', title: 'Total Activations',
      desc: 'Summary of all activations with a breakdown by day, week or month, plus totals by product.' },
    { type: 'customers', icon: '👥', title: 'Customer-wise Activations',
      desc: 'Every customer with their number of activations and total spend, plus a full activation list.' },
    { type: 'resellers', icon: '🤝', title: 'Reseller Clients & Reports',
      desc: 'Each reseller with their clients, activations, sales and commission earned, plus a detailed list.' },
    { type: 'profit', icon: '💵', title: 'Profit & Margin',
      desc: 'Revenue minus cost (purchase price) and reseller commission → profit and margin, broken down by product, customer, reseller and total.' },
  ];

  const render = () => {
    const wrap = document.getElementById('reports-cards');
    if (!wrap) return;
    wrap.innerHTML = DEFS.map(d => `
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.3rem">
          <span style="font-size:1.4rem">${d.icon}</span>
          <span style="font-weight:700;font-size:1.05rem">${d.title}</span>
        </div>
        <div style="font-size:.82rem;color:var(--muted);line-height:1.6;margin-bottom:.9rem">${d.desc}</div>
        <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
          <label style="font-size:.75rem;font-weight:600;color:var(--text)">Group by:</label>
          <select id="rep-period-${d.type}" style="padding:.4rem .7rem;font-size:.8rem;border:1.5px solid var(--border);border-radius:7px;background:var(--white)">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly" selected>Monthly</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="Reports.download('${d.type}','xlsx')">⬇ Excel (.xlsx)</button>
          <button class="btn btn-outline btn-sm" onclick="Reports.download('${d.type}','pdf')">⬇ PDF</button>
        </div>
      </div>`).join('');
  };

  const download = (type, format) => {
    const period = document.getElementById('rep-period-' + type)?.value || 'monthly';
    const url = `/admin/report?adminKey=${encodeURIComponent(Store.adminKey)}&type=${type}&period=${period}&format=${format}`;
    window.open(url, '_blank');
  };

  return { render, download };
})();
