/* ─── DTC Admin — App Shell (sidebar navigation) ────────────────────────── */

'use strict';

const Shell = (() => {

  const init = () => {
    // Mobile sidebar toggle
    document.getElementById('mob-menu-btn')
      .addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  };

  // Switch active page + sidebar highlight
  const navigate = (pageId, navEl) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById('page-' + pageId).classList.add('active');
    navEl.classList.add('active');

    // Close mobile drawer
    document.getElementById('sidebar').classList.remove('open');

    // Page-specific on-enter hooks
    if (pageId === 'instructions') Instructions.render();
    if (pageId === 'products')     Products.render();
    if (pageId === 'campaigns')    { BulkEmail.render(); BulkEmail.init(); }
    if (pageId === 'resellers')    Resellers.render();
    if (pageId === 'reports')      Reports.render();
    if (pageId === 'keys')         Keys.render();
    if (pageId === 'settings')     Settings.load();
    if (pageId === 'revenue')      Revenue.render();
    if (pageId === 'audit-logs')   AuditLogs.load();
    if (pageId === 'email-automation') EmailAutomation.load();
    if (pageId === 'dashboard') RegionMap.load();
    if (pageId === 'notifications')  { Notifications.init(); Notifications.load(); }
    if (pageId === 'landing')         Landing.load();
    try { AdminEffects.pageChanged(); } catch (e) {}
  };

  // Called by nav-items: onclick="Shell.navigate('dashboard', this)"
  return { init, navigate };
})();
