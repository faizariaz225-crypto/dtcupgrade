/* ─── DTC Admin — Profile Menu & Panel ──────────────────────────────────── */
'use strict';

const ProfileMenu = (() => {

  // ── State ──────────────────────────────────────────────────────────────────
  let _open    = false;
  let _tab     = 'profile';
  let _profile = {};   // cached profile data (name, email, phone, photoUrl)

  // ── Helpers ────────────────────────────────────────────────────────────────
  const _initials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  };

  const _setAvatar = (elOrId, name, photoUrl) => {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (!el) return;
    if (photoUrl) {
      el.innerHTML = `<img src="${esc(photoUrl)}" onerror="this.parentElement.textContent='${_initials(name)}'"/>`;
    } else {
      el.textContent = _initials(name);
    }
  };

  const _msg = (elId, text, isError) => {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? 'var(--error)' : 'var(--success)';
  };

  // ── Boot: called once after login to hydrate the sidebar ──────────────────
  const init = () => {
    const u = Store.currentUser || {};
    _profile = { ...(Store.profileExtra || {}), name: u.name || u.username || 'Admin', role: u.role || '', username: u.username || '' };

    // Sidebar widget
    _setAvatar('sb-avatar',    _profile.name, _profile.photoUrl);
    _setAvatar('sb-pmenu-avatar', _profile.name, _profile.photoUrl);
    const nameEl = document.getElementById('sb-profile-name');
    const roleEl = document.getElementById('sb-profile-role');
    const pmName = document.getElementById('sb-pmenu-name');
    const pmMeta = document.getElementById('sb-pmenu-meta');
    if (nameEl) nameEl.textContent = _profile.name;
    if (roleEl) roleEl.textContent = _profile.role;
    if (pmName) pmName.textContent = _profile.name;
    if (pmMeta) pmMeta.textContent = `@${_profile.username} · ${_profile.role}`;

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (_open && !e.target.closest('#sb-profile') && !e.target.closest('#sb-profile-menu')) {
        closeMenu();
      }
    });
  };

  // ── Sidebar dropdown toggle ────────────────────────────────────────────────
  const toggle = () => _open ? closeMenu() : openMenu();

  const openMenu = () => {
    _open = true;
    document.getElementById('sb-profile-menu').classList.add('open');
    document.getElementById('sb-profile').classList.add('open');
  };

  const closeMenu = () => {
    _open = false;
    document.getElementById('sb-profile-menu').classList.remove('open');
    document.getElementById('sb-profile').classList.remove('open');
  };

  // ── Full panel ─────────────────────────────────────────────────────────────
  const openSection = (tab) => {
    closeMenu();
    _populateProfile();
    document.getElementById('profile-panel-overlay').classList.add('open');
    switchTab(tab);
    if (tab === 'sessions') _loadSessions();
  };

  const closePanel = () => {
    document.getElementById('profile-panel-overlay').classList.remove('open');
  };

  const switchTab = (tab) => {
    _tab = tab;
    document.querySelectorAll('.pp-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.pp-section').forEach(s => s.classList.remove('active'));
    const tabBtn = document.getElementById('pptab-' + tab);
    const tabSec = document.getElementById('ppsec-' + tab);
    if (tabBtn) tabBtn.classList.add('active');
    if (tabSec) tabSec.classList.add('active');
    if (tab === 'sessions') _loadSessions();
  };

  // ── Profile tab ────────────────────────────────────────────────────────────
  const _populateProfile = () => {
    const u = Store.currentUser || {};
    _profile = { ..._profile, name: _profile.name || u.name || u.username || '', role: u.role || '', username: u.username || '' };

    // Big avatar
    _setAvatar('pp-big-avatar', _profile.name, _profile.photoUrl);
    const dn = document.getElementById('pp-display-name');
    const dr = document.getElementById('pp-display-role');
    const du = document.getElementById('pp-display-username');
    if (dn) dn.textContent = _profile.name;
    if (dr) dr.textContent = _profile.role;
    if (du) du.textContent = `@${_profile.username}`;

    // Form fields
    _val('pp-name',  _profile.name  || u.name  || '');
    _val('pp-email', _profile.email || u.email || '');
    _val('pp-phone', _profile.phone || '');
    _val('pp-photo', _profile.photoUrl || '');
    _msg('pp-profile-msg', '', false);

    // Photo preview
    if (_profile.photoUrl) {
      document.getElementById('pp-photo-preview').style.display = '';
      document.getElementById('pp-photo-img').src = _profile.photoUrl;
    } else {
      document.getElementById('pp-photo-preview').style.display = 'none';
    }
  };

  const _val = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  const _get = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

  const previewPhoto = () => {
    const url = _get('pp-photo');
    const prev = document.getElementById('pp-photo-preview');
    const img  = document.getElementById('pp-photo-img');
    if (url) { prev.style.display = ''; img.src = url; }
    else { prev.style.display = 'none'; }
  };

  const saveProfile = async () => {
    const name     = _get('pp-name');
    const email    = _get('pp-email');
    const phone    = _get('pp-phone');
    const photoUrl = _get('pp-photo');
    if (!name) { _msg('pp-profile-msg', 'Name cannot be empty.', true); return; }

    // Save extra profile data (email, phone, photo) to server via user update
    const u = Store.currentUser || {};
    const d = await api('/admin/users/save', {
      adminKey: Store.adminKey,
      user: { id: u.id, username: u.username, name, role: u.role, email, phone, photoUrl },
    });

    if (d && d.success) {
      // Update local store
      _profile = { ..._profile, name, email, phone, photoUrl };
      if (Store.currentUser) Store.currentUser.name = name;

      // Refresh sidebar
      _setAvatar('sb-avatar',       name, photoUrl);
      _setAvatar('sb-pmenu-avatar', name, photoUrl);
      _setAvatar('pp-big-avatar',   name, photoUrl);
      const nameEl = document.getElementById('sb-profile-name');
      const pmName = document.getElementById('sb-pmenu-name');
      const dn     = document.getElementById('pp-display-name');
      if (nameEl) nameEl.textContent = name;
      if (pmName) pmName.textContent = name;
      if (dn)     dn.textContent     = name;

      _msg('pp-profile-msg', '✓ Profile saved.', false);
    } else {
      _msg('pp-profile-msg', '✕ ' + ((d && d.error) || 'Failed to save.'), true);
    }
  };

  // ── Password tab ───────────────────────────────────────────────────────────
  const checkPwStrength = () => {
    const pw  = _get('pp-new-pw');
    const el  = document.getElementById('pp-pw-strength');
    if (!el) return;
    if (!pw) { el.textContent = ''; return; }
    const score = [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^a-zA-Z0-9]/.test(pw)].filter(Boolean).length;
    const labels = ['', '⚠ Weak', '⚠ Fair', '✓ Good', '✓ Strong'];
    const colors = ['', 'var(--error)', 'var(--warn)', '#16a34a', '#15803d'];
    el.textContent = labels[score] || '';
    el.style.color = colors[score] || '';
  };

  const changePassword = async () => {
    const cur  = _get('pp-cur-pw');
    const nw   = _get('pp-new-pw');
    const conf = _get('pp-conf-pw');
    if (!cur)  { _msg('pp-pw-msg', 'Enter your current password.', true);  return; }
    if (!nw)   { _msg('pp-pw-msg', 'Enter a new password.', true);         return; }
    if (nw.length < 8) { _msg('pp-pw-msg', 'New password must be at least 8 characters.', true); return; }
    if (nw !== conf)   { _msg('pp-pw-msg', 'Passwords do not match.', true); return; }

    const d = await api('/admin/users/change-password', {
      adminKey: Store.adminKey, currentPassword: cur, newPassword: nw,
    });

    if (d && d.success) {
      _msg('pp-pw-msg', '✓ Password changed. Other sessions will be signed out.', false);
      _val('pp-cur-pw', ''); _val('pp-new-pw', ''); _val('pp-conf-pw', '');
      document.getElementById('pp-pw-strength').textContent = '';
    } else {
      _msg('pp-pw-msg', '✕ ' + ((d && d.error) || 'Failed to change password.'), true);
    }
  };

  // ── Sessions tab ───────────────────────────────────────────────────────────
  const _loadSessions = async () => {
    const wrap = document.getElementById('pp-sessions-list');
    if (!wrap) return;
    wrap.innerHTML = '<div class="empty">Loading…</div>';
    const d = await api(`/admin/users/sessions?adminKey=${encodeURIComponent(Store.adminKey)}`);
    if (!d || d.error) { wrap.innerHTML = '<div class="empty">Could not load sessions.</div>'; return; }
    const sessions = d.sessions || [];
    if (!sessions.length) { wrap.innerHTML = '<div class="empty">No active sessions found.</div>'; return; }
    wrap.innerHTML = sessions.map(s => {
      const lastSeen = s.lastSeen ? new Date(s.lastSeen).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
      return `<div style="background:#f8fafc;border:1px solid var(--border);border-radius:9px;padding:.75rem 1rem;margin-bottom:.55rem">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap">
          <div>
            <div style="font-weight:600;font-size:.82rem">${esc(s.userName)} <span style="font-size:.68rem;color:var(--muted)">· ${esc(s.role)}</span></div>
            <div style="font-size:.7rem;color:var(--muted);margin-top:.15rem">Last seen: ${lastSeen}${s.ip ? ' · IP: ' + esc(s.ip) : ''}</div>
          </div>
          <div style="font-size:.68rem;font-family:'JetBrains Mono',monospace;color:var(--muted2)">${esc(s.token)}</div>
        </div>
      </div>`;
    }).join('');
  };

  const revokeOtherSessions = async () => {
    if (!confirm('Sign out all other devices?\n\nYou will remain signed in here but all other active sessions will end.')) return;
    const u = Store.currentUser || {};
    const d = await api('/admin/users/revoke-sessions', { adminKey: Store.adminKey, userId: u.id });
    if (d && d.success) { alert('✓ All other sessions ended.'); _loadSessions(); }
    else alert('Failed: ' + ((d && d.error) || 'Unknown error.'));
  };

  // ── Privacy tab ────────────────────────────────────────────────────────────
  const exportMyData = () => {
    const u = Store.currentUser || {};
    const data = {
      exportedAt: new Date().toISOString(),
      account: { id: u.id, username: u.username, name: u.name, role: u.role },
      profile: _profile,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `my-account-data-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = async () => {
    closeMenu();
    closePanel();
    try { await api('/admin/user-logout', { sessionToken: Store.sessionToken || '' }); } catch(e) {}
    // Reset UI
    document.getElementById('app').style.display        = 'none';
    document.getElementById('login-wrap').style.display  = '';
    document.getElementById('admin-key').value           = '';
    Store.setAdminKey('');
  };

  return { init, toggle, openMenu, closeMenu, openSection, closePanel, switchTab, previewPhoto, saveProfile, checkPwStrength, changePassword, revokeOtherSessions, exportMyData, logout };
})();
