/* ─── DTC Admin — Modals Module ─────────────────────────────────────────── */

'use strict';

const Modals = (() => {

  // ── Decline modal ─────────────────────────────────────────────────────────
  const openDecline = (token) => {
    document.getElementById('decline-token').value = token;
    document.getElementById('decline-reason').value =
      'The details provided could not be verified. Please ensure you have entered the correct details and request a new link.';
    document.getElementById('decline-modal').classList.add('open');
  };

  const closeDecline = () => document.getElementById('decline-modal').classList.remove('open');

  const confirmDecline = async () => {
    const token  = document.getElementById('decline-token').value;
    const reason = document.getElementById('decline-reason').value.trim();
    if (!reason) { alert('Please provide a reason.'); return; }
    const d = await api('/admin/decline', { adminKey: Store.adminKey, token, reason });
    closeDecline();
    if (d && d.success) Dashboard.reload();
    else alert('Failed to decline.');
  };

  // ── Session data modal ─────────────────────────────────────────────────────
  const viewSession = (token) => {
    const t = Store.tokens[token];
    if (!t || !t.sessionData) return;
    let display = t.sessionData;
    try { display = JSON.stringify(JSON.parse(t.sessionData), null, 2); } catch {}
    document.getElementById('session-modal-content').value = display;
    document.getElementById('session-modal').classList.add('open');
  };

  const closeSession = () => document.getElementById('session-modal').classList.remove('open');

  const copySession = () => {
    const val = document.getElementById('session-modal-content').value;
    navigator.clipboard.writeText(val).then(() => alert('Session data copied!'));
  };

  // ── Edit customer / package modal ──────────────────────────────────────────
  const openEdit = (token) => {
    const t = Store.tokens[token];
    if (!t) return;
    document.getElementById('edit-token').value   = token;
    document.getElementById('edit-name').value    = t.customerName || '';
    document.getElementById('edit-email').value   = t.email || '';
    document.getElementById('edit-wechat').value  = t.wechat || '';
    document.getElementById('edit-package').value = t.packageType || '';
    document.getElementById('edit-price').value   = (t.price != null ? t.price : '');
    document.getElementById('edit-days').value    = t.subscriptionDays || t.durationDays || 30;
    document.getElementById('edit-amount').value   = (t.amountReceived != null ? t.amountReceived : '');
    document.getElementById('edit-method').value   = t.paymentMethod || '';
    const exp = t.subscriptionExpiresAt ? new Date(t.subscriptionExpiresAt) : null;
    document.getElementById('edit-expiry').value  = exp && !isNaN(exp) ? exp.toISOString().slice(0, 10) : '';
    document.getElementById('edit-modal').classList.add('open');
  };

  const closeEdit = () => document.getElementById('edit-modal').classList.remove('open');

  const confirmEdit = async () => {
    const token        = document.getElementById('edit-token').value;
    const customerName = document.getElementById('edit-name').value.trim();
    const email        = document.getElementById('edit-email').value.trim();
    const wechat       = document.getElementById('edit-wechat').value.trim();
    const packageType  = document.getElementById('edit-package').value.trim();
    const priceVal     = document.getElementById('edit-price').value;
    const daysVal      = document.getElementById('edit-days').value;
    const amountVal    = document.getElementById('edit-amount').value;
    const methodVal    = document.getElementById('edit-method').value;
    const expiryVal    = document.getElementById('edit-expiry').value; // yyyy-mm-dd

    if (!customerName) { alert('Customer name is required.'); return; }

    const payload = { adminKey: Store.adminKey, token, customerName, email, wechat, packageType, paymentMethod: methodVal };
    if (priceVal !== '') payload.price = parseFloat(priceVal);
    if (daysVal  !== '') payload.subscriptionDays = parseInt(daysVal, 10);
    payload.amountReceived = (amountVal === '' ? '' : parseFloat(amountVal));
    if (expiryVal)       payload.subscriptionExpiresAt = new Date(expiryVal + 'T23:59:59').toISOString();

    const d = await api('/admin/edit-token', payload);
    closeEdit();
    if (d && d.success) Dashboard.reload();
    else alert('Failed to update: ' + ((d && d.error) || 'unknown error'));
  };

  // ── Click-outside close on all modals ────────────────────────────────────
  const init = () => {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });
  };

  return { init, openDecline, closeDecline, confirmDecline, viewSession, closeSession, copySession, openEdit, closeEdit, confirmEdit };
})();
