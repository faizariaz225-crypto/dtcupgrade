/* ─── DTC Admin — Auth Module ────────────────────────────────────────────── */

'use strict';

const Auth = (() => {

  // ── Private ────────────────────────────────────────────────────────────────
  const _showError = (msg) => {
    const el = document.getElementById('login-err');
    const card = document.getElementById('login-card');
    el.textContent = msg;
    el.classList.add('show');
    card?.classList.remove('login-denied');
    // Restart the short denied animation even on consecutive failed attempts.
    void card?.offsetWidth;
    card?.classList.add('login-denied');
    document.getElementById('login-status').textContent = 'Access denied';
  };

  const _clearError = () => {
    document.getElementById('login-err').classList.remove('show');
    document.getElementById('login-card')?.classList.remove('login-denied');
  };

  const _setLoading = (loading) => {
    const btn = document.getElementById('login-btn');
    const label = document.getElementById('login-btn-label');
    const status = document.getElementById('login-status');
    btn.disabled = loading;
    btn.classList.toggle('is-loading', loading);
    label.textContent = loading ? 'Verifying credentials' : 'Authenticate securely';
    if (loading) status.textContent = 'Authenticating…';
    else if (status.textContent !== 'Access denied' && status.textContent !== 'Access approved') status.textContent = 'Gateway ready';
  };

  // ── Public ─────────────────────────────────────────────────────────────────
  const init = () => {
    const keyInput = document.getElementById('admin-key');
    const toggle = document.getElementById('password-toggle');
    const capsWarning = document.getElementById('caps-warning');

    // Allow Enter key in password field and surface Caps Lock status.
    keyInput.addEventListener('keydown', (e) => {
      capsWarning?.classList.toggle('show', Boolean(e.getModifierState?.('CapsLock')));
      if (e.key === 'Enter') login();
    });
    keyInput.addEventListener('keyup', (e) => {
      capsWarning?.classList.toggle('show', Boolean(e.getModifierState?.('CapsLock')));
    });
    keyInput.addEventListener('blur', () => capsWarning?.classList.remove('show'));
    keyInput.addEventListener('input', () => {
      _clearError();
      document.getElementById('login-status').textContent = keyInput.value ? 'Key entered' : 'Gateway ready';
    });

    // Password visibility control; no OTP or additional login step is introduced.
    toggle?.addEventListener('click', () => {
      const reveal = keyInput.type === 'password';
      keyInput.type = reveal ? 'text' : 'password';
      toggle.setAttribute('aria-label', reveal ? 'Hide admin key' : 'Show admin key');
      toggle.setAttribute('title', reveal ? 'Hide admin key' : 'Show admin key');
      keyInput.focus({ preventScroll: true });
    });
  };

  const login = async () => {
    const key = document.getElementById('admin-key').value.trim();
    if (!key) return;

    _clearError();
    _setLoading(true);

    // Step 1 — authenticate
    let data;
    try {
      data = await api('/admin/sessions-data', { adminKey: key });
    } catch (e) {
      _showError('Cannot reach the server. Please make sure it is running.');
      _setLoading(false);
      return;
    }

    if (!data || data.error) {
      _showError('Incorrect admin key. Please check the key and try again.');
      _setLoading(false);
      return;
    }

    document.getElementById('login-status').textContent = 'Access approved';
    document.getElementById('login-card')?.classList.add('login-approved');

    // Step 2 — store credentials and hydrate state
    Store.setAdminKey(key);
    Store.load(data);

    // Step 3 — transition UI: briefly show the approved state, then reveal the app shell.
    await new Promise(resolve => setTimeout(resolve, 380));
    document.getElementById('login-wrap').style.display = 'none';
    document.getElementById('app').style.display        = 'flex';

    _setLoading(false);

    // Step 4 — boot all modules independently (a failure in one never blocks others)
    Shell.init();
    // Load data that other modules depend on FIRST (await so data is ready)
    await safeRun('Instructions', Instructions.loadData);
    await safeRun('Products',     Products.loadData);
    await safeRun('BulkEmail',    BulkEmail.loadTemplates);
    await safeRun('Settings',     Settings.load);

    // Now render — products + instructions are available
    safeRun('Dashboard',      Dashboard.render);
    safeRun('Dashboard.dd',   Dashboard.refreshDropdowns);
    safeRun('Customers',      Customers.render);
    safeRun('EmailConfig',    EmailConfig.load);
    safeRun('EmailLog',       EmailLog.render);
    safeRun('Notifications',  Notifications.load);
    safeRun('Revenue',        Revenue.render);
    safeRun('AuditLogs',      () => AuditLogs.load());
    safeRun('RegionMap',      () => RegionMap.load());
    safeRun('AdminEffects',   () => AdminEffects.apply());
    safeRun('BulkEmail.init', BulkEmail.init);
    safeRun('Resellers',      Resellers.render);
    Notifications.init();
    // Begin silent background polling so customer data stays current without manual refresh
    safeRun('AutoRefresh',    Dashboard.startAutoRefresh);
    // Enable new-submission alerts (sound + browser notification); request permission within this login gesture
    safeRun('Alerts',         () => Dashboard.setAlerts(true));
  };

  // Silent error boundary — logs to console, never crashes login
  const safeRun = async (name, fn) => {
    try { await fn(); }
    catch (e) { console.warn(`[${name}]`, e.message); }
  };

  return { init, login };
})();
