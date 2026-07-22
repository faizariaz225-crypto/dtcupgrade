/* ─── DTC Admin — Activity & Audit Logs ─────────────────────────────────── */
'use strict';

const AuditLogs = (() => {
  let _page = 1;
  let _data = null;
  let _searchTimer = null;
  let _refreshTimer = null;

  const el = id => document.getElementById(id);
  const value = id => (el(id)?.value || '').trim();
  const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase();
  const pretty = value => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const actionIcon = category => ({
    security:'🛡', activation:'⚡', payments:'💳', customers:'👤', catalogue:'📦', keys:'🔑',
    users:'👥', staff:'🪪', resellers:'🤝', requests:'🧾', content:'✎', settings:'⚙',
    email:'✉', system:'⬡', operations:'◌', customer_activity:'◎', admin:'◆',
  }[category] || '•');

  const parseWindow = () => {
    const fromDate = value('audit-date-from');
    const fromTime = value('audit-time-from') || '00:00';
    const toDate   = value('audit-date-to');
    const toTime   = value('audit-time-to') || '23:59';
    const out = {};
    if (fromDate) {
      const d = new Date(`${fromDate}T${fromTime}:00`);
      if (!Number.isNaN(d.getTime())) out.from = d.toISOString();
    }
    if (toDate) {
      const d = new Date(`${toDate}T${toTime}:59.999`);
      if (!Number.isNaN(d.getTime())) out.to = d.toISOString();
    }
    return out;
  };

  const buildParams = (includePage = true) => {
    const params = new URLSearchParams({ adminKey: Store.adminKey });
    const entries = {
      search: value('audit-search'), actor: value('audit-actor'), subject: value('audit-subject'),
      category: value('audit-category'), action: value('audit-action'), result: value('audit-result'),
      order: value('audit-order') || 'newest', limit: value('audit-limit') || '50',
      ...parseWindow(),
    };
    Object.entries(entries).forEach(([k,v]) => { if (v) params.set(k, v); });
    if (includePage) params.set('page', String(_page));
    return params;
  };

  const load = async (force = false) => {
    if (!el('audit-log-body')) return;
    if (force) _page = 1;
    el('audit-log-body').innerHTML = '<tr><td colspan="7"><div class="audit-loading"><span></span>Loading audit trail…</div></td></tr>';
    try {
      const r = await fetch('/admin/audit-logs?' + buildParams().toString(), { cache:'no-store' });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'Unable to load logs');
      _data = d;
      render(d);
      if (!_refreshTimer) {
        _refreshTimer = setInterval(() => {
          if (document.getElementById('page-audit-logs')?.classList.contains('active')) load(false);
        }, 60000);
      }
    } catch (err) {
      el('audit-log-body').innerHTML = `<tr><td colspan="7"><div class="audit-empty">⚠ ${esc(err.message || 'Could not load activity logs.')}</div></td></tr>`;
    }
  };

  const render = d => {
    renderSummary(d.summary || {});
    renderOptions(d.options || {});
    renderUsers(d.summary?.byActor || []);
    renderRows(d.logs || []);
    renderPagination(d.pagination || {});
    const failBadge = el('nb-audit-fail');
    const failures = Number(d.summary?.failed || 0);
    if (failBadge) { failBadge.textContent = failures > 99 ? '99+' : failures; failBadge.style.display = failures ? '' : 'none'; }
  };

  const renderSummary = summary => {
    const values = [summary.total, summary.today, summary.successful, summary.failed, summary.uniqueActors];
    document.querySelectorAll('#audit-summary-grid .audit-summary-card strong').forEach((node, i) => {
      node.textContent = Number(values[i] || 0).toLocaleString();
    });
  };

  const fillSelect = (id, firstLabel, items, mapItem) => {
    const select = el(id); if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${esc(firstLabel)}</option>` + items.map(item => {
      const mapped = mapItem(item);
      return `<option value="${esc(mapped.value)}">${esc(mapped.label)}</option>`;
    }).join('');
    if ([...select.options].some(o => o.value === current)) select.value = current;
  };

  const renderOptions = options => {
    fillSelect('audit-actor','All administrators/users',options.actors || [], a => ({ value:a.id, label:`${a.name}${a.role ? ' · ' + a.role : ''}` }));
    fillSelect('audit-subject','All affected records',options.subjects || [], s => ({ value:s.id, label:`${s.name}${s.email && s.email !== s.name ? ' · ' + s.email : ''}${s.product ? ' · ' + s.product : ''}` }));
    fillSelect('audit-category','All categories',options.categories || [], c => ({ value:c, label:pretty(c) }));
    fillSelect('audit-action','All actions',options.actions || [], a => ({ value:a.id, label:pretty(a.label || a.id) }));
  };

  const renderUsers = users => {
    const wrap = el('audit-user-strip'); if (!wrap) return;
    if (!users.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = users.map(u => `<button class="audit-user-card" onclick="AuditLogs.filterByActor('${esc(u.id)}')" title="Show activity by ${esc(u.name)}">
      <span class="audit-user-avatar">${esc(initials(u.name))}</span>
      <span class="audit-user-meta"><strong>${esc(u.name)}</strong><span>${esc(pretty(u.role || 'user'))}${u.failed ? ` · <b class="audit-user-fail">${u.failed} failed</b>` : ''}</span></span>
      <span class="audit-user-count">${Number(u.count || 0).toLocaleString()}</span>
    </button>`).join('');
  };

  const renderRows = logs => {
    const body = el('audit-log-body'); if (!body) return;
    const count = el('audit-result-count');
    const p = _data?.pagination || {};
    if (count) count.textContent = p.total ? `${Number(p.total).toLocaleString()} matching events` : 'No matching events';
    if (!logs.length) {
      body.innerHTML = '<tr><td colspan="7"><div class="audit-empty">No activity matches the selected filters.</div></td></tr>';
      return;
    }
    body.innerHTML = logs.map(log => rowHtml(log) + detailHtml(log)).join('');
  };

  const rowHtml = log => {
    const d = new Date(log.timestamp);
    const date = Number.isNaN(d.getTime()) ? 'Unknown' : d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    const time = Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const actor = log.actor || {};
    const subject = log.subject || {};
    const result = ['success','denied','failed'].includes(log.result) ? log.result : 'failed';
    const subjectName = subject.name || subject.email || subject.id || 'System-wide';
    const subjectMeta = [subject.email && subject.email !== subjectName ? subject.email : '', subject.product || ''].filter(Boolean).join(' · ');
    return `<tr class="audit-row">
      <td><div class="audit-time"><strong>${esc(date)}</strong><span>${esc(time)}</span></div></td>
      <td><div class="audit-actor"><span class="audit-actor-avatar">${esc(initials(actor.name))}</span><div><strong>${esc(actor.name || 'Unknown')}</strong><span>${esc(pretty(actor.role || actor.type || 'user'))}${actor.username && actor.username !== actor.name ? ' · @' + esc(actor.username) : ''}</span></div></div></td>
      <td><div class="audit-action"><div class="audit-action-main"><span class="audit-action-icon">${actionIcon(log.category)}</span><div><strong>${esc(log.description || pretty(log.action))}</strong><span class="audit-category">${esc(pretty(log.category))}</span></div></div></div></td>
      <td><div class="audit-subject"><strong>${esc(subjectName)}</strong><span>${esc(subjectMeta || subject.type || '—')}</span></div></td>
      <td><div class="audit-source"><strong>${esc(log.ip || 'unknown')}</strong><span>${esc(parseUA(log.userAgent || ''))} · ${Number(log.durationMs || 0)} ms</span></div></td>
      <td><span class="audit-result ${result}">${esc(result)}</span></td>
      <td><button class="audit-detail-btn" id="audit-btn-${esc(log.id)}" onclick="AuditLogs.toggleDetails('${esc(log.id)}')" aria-label="View event details">⌄</button></td>
    </tr>`;
  };

  const detailHtml = log => `<tr class="audit-detail-row" id="audit-detail-${esc(log.id)}"><td colspan="7">
    <div class="audit-detail-grid">
      <div class="audit-detail-item"><small>Event ID</small><strong>${esc(log.id)}</strong></div>
      <div class="audit-detail-item"><small>Server route</small><strong>${esc(log.route || '—')}</strong></div>
      <div class="audit-detail-item"><small>HTTP status</small><strong>${esc(log.statusCode || '—')}</strong></div>
      <div class="audit-detail-item"><small>Browser / device</small><strong>${esc(log.userAgent || 'Unknown')}</strong></div>
    </div>
    <div class="audit-json">
      <section><h4>Sanitised request details</h4><pre>${esc(JSON.stringify(log.request || {}, null, 2))}</pre></section>
      <section><h4>Sanitised response details</h4><pre>${esc(JSON.stringify(log.response || {}, null, 2))}</pre></section>
    </div>
  </td></tr>`;

  const renderPagination = p => {
    const wrap = el('audit-pagination'); if (!wrap) return;
    const page = Number(p.page || 1), pages = Number(p.totalPages || 1), total = Number(p.total || 0), limit = Number(p.limit || 50);
    const first = total ? ((page - 1) * limit + 1) : 0;
    const last = Math.min(page * limit, total);
    const nums = [];
    for (let n = Math.max(1,page-2); n <= Math.min(pages,page+2); n++) nums.push(n);
    wrap.innerHTML = `<div class="audit-pagination-info">Showing ${first.toLocaleString()}–${last.toLocaleString()} of ${total.toLocaleString()}</div>
      <div class="audit-page-buttons">
        <button onclick="AuditLogs.goPage(${page-1})" ${page<=1?'disabled':''}>‹</button>
        ${nums.map(n => `<button class="${n===page?'active':''}" onclick="AuditLogs.goPage(${n})">${n}</button>`).join('')}
        <button onclick="AuditLogs.goPage(${page+1})" ${page>=pages?'disabled':''}>›</button>
      </div>`;
  };

  const queueSearch = () => { clearTimeout(_searchTimer); _searchTimer = setTimeout(() => applyFilters(), 320); };
  const applyFilters = () => { _page = 1; load(); };
  const goPage = page => { const pages = Number(_data?.pagination?.totalPages || 1); _page = Math.min(Math.max(1,page),pages); load(); document.getElementById('page-audit-logs')?.scrollIntoView({behavior:'smooth',block:'start'}); };
  const filterByActor = actorId => { if (el('audit-actor')) el('audit-actor').value = actorId; applyFilters(); };
  const toggleDetails = id => { el('audit-detail-' + id)?.classList.toggle('open'); el('audit-btn-' + id)?.classList.toggle('open'); };

  const resetFilters = () => {
    ['audit-search','audit-actor','audit-subject','audit-category','audit-action','audit-result','audit-date-from','audit-time-from','audit-date-to','audit-time-to'].forEach(id => { if (el(id)) el(id).value = ''; });
    if (el('audit-order')) el('audit-order').value = 'newest';
    if (el('audit-limit')) el('audit-limit').value = '50';
    applyFilters();
  };

  const exportCsv = () => {
    const params = buildParams(false);
    params.delete('limit'); params.delete('order');
    window.location.href = '/admin/audit-logs/export?' + params.toString();
  };

  return { load, queueSearch, applyFilters, resetFilters, goPage, filterByActor, toggleDetails, exportCsv };
})();
