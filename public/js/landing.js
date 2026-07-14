/* ─── DTC Admin — Landing Page Editor Module ─────────────────────────────── */
'use strict';

const Landing = (() => {

  const DEFAULTS = {
    heroTitle:       'Your Gateway to <span>AI & Academic</span> Excellence',
    heroSubtitle:    'Digital Tools Corner (DTC) provides affordable, reliable access to premium AI and academic subscription tools for students, researchers, and professionals worldwide.',
    statCustomers:   '2,000+',
    statActivations: '10,000+',
    statTools:       '100+',
    statCountries:   '50+',
    email:           'dtc@dtc1.shop',
    emailEnabled:    true,
    whatsapp:        '+86 19738122807',
    whatsappLink:    'https://wa.me/8619738122807',
    whatsappEnabled: true,
    phone:           '',
    phoneEnabled:    false,
    wechatId:        '',
    wechatQrUrl:     '',
    wechatEnabled:   true,
    showPricing:     true,
    pricingTitle:    'Simple, Transparent Pricing',
    pricingSubtitle: 'Official access to premium tools at a fraction of the standard price.',
    aboutTitle:      'Premium AI Access, Made Affordable',
    aboutDesc:       'DTC is a trusted platform dedicated to providing affordable and reliable access to premium AI and academic subscription tools for students, researchers, and professionals worldwide.',
    productOverrides: {},
  };

  let _content  = { ...DEFAULTS };
  let _products = [];

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = async () => {
    try {
      const d = await api(`/admin/landing-content?adminKey=${encodeURIComponent(Store.adminKey)}`);
      _content = (d && !d.error) ? { ...DEFAULTS, ...d } : { ...DEFAULTS };
    } catch (e) {
      _content = { ...DEFAULTS };
    }
    if (!_content.productOverrides) _content.productOverrides = {};

    try {
      const p = await api(`/admin/products?adminKey=${encodeURIComponent(Store.adminKey)}`);
      _products = (p && p.products) ? p.products : [];
    } catch (e) {
      _products = [];
    }

    _populate(_content);
    _renderProducts();
  };

  const _populate = (c) => {
    _set('lp-hero-title',       c.heroTitle);
    _set('lp-hero-subtitle',    c.heroSubtitle);
    _set('lp-stat-customers',   c.statCustomers);
    _set('lp-stat-activations', c.statActivations);
    _set('lp-stat-tools',       c.statTools);
    _set('lp-stat-countries',   c.statCountries);
    _set('lp-about-title',      c.aboutTitle);
    _set('lp-about-desc',       c.aboutDesc);

    _set('lp-email',            c.email);
    _set('lp-whatsapp',         c.whatsapp);
    _set('lp-whatsapp-link',    c.whatsappLink);
    _set('lp-phone',            c.phone);
    _set('lp-wechat-id',        c.wechatId);
    _set('lp-wechat-qr',        c.wechatQrUrl);
    _set('lp-pricing-title',    c.pricingTitle);
    _set('lp-pricing-subtitle', c.pricingSubtitle);

    _check('lp-email-enabled',    c.emailEnabled);
    _check('lp-whatsapp-enabled', c.whatsappEnabled);
    _check('lp-phone-enabled',    c.phoneEnabled);
    _check('lp-wechat-enabled',   c.wechatEnabled);
    _check('lp-show-pricing',     c.showPricing);

    _qrPreview(c.wechatQrUrl);
  };

  const _set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  };
  const _get = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };
  const _check = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };
  const _checked = (id) => {
    const el = document.getElementById(id);
    return el ? !!el.checked : false;
  };

  // ── WeChat QR upload ────────────────────────────────────────────────────────
  const _qrPreview = (url) => {
    const box = document.getElementById('lp-qr-preview');
    if (!box) return;
    box.innerHTML = url
      ? `<img src="${esc(url)}" alt="WeChat QR" style="width:120px;height:120px;object-fit:contain;border:1px solid var(--border);border-radius:8px;background:#fff;padding:4px">`
      : `<div style="width:120px;height:120px;border:1px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.72rem;color:var(--muted);text-align:center;padding:8px">No QR uploaded</div>`;
  };

  const uploadQr = async (input) => {
    const file = input.files && input.files[0];
    if (!file) return;
    showMsg('lp-ok', 'lp-err', true, 'Uploading QR…');

    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await fetch(`/admin/upload-image?adminKey=${encodeURIComponent(Store.adminKey)}`, {
        method: 'POST',
        body:   fd,
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Upload failed');
      _set('lp-wechat-qr', d.url);
      _qrPreview(d.url);
      showMsg('lp-ok', 'lp-err', true, 'QR uploaded — click Save Landing Page to publish it.');
    } catch (e) {
      showMsg('lp-ok', 'lp-err', false, 'Upload failed: ' + e.message);
    }
    input.value = '';
  };

  const removeQr = () => {
    _set('lp-wechat-qr', '');
    _qrPreview('');
    showMsg('lp-ok', 'lp-err', true, 'QR removed — click Save Landing Page to apply.');
  };

  // ── Product approval + price overrides ──────────────────────────────────────
  const _renderProducts = () => {
    const box = document.getElementById('lp-products');
    if (!box) return;

    if (!_products.length) {
      box.innerHTML = `<div style="font-size:.82rem;color:var(--muted)">No products found. Add products on the Products page first.</div>`;
      return;
    }

    const ov = _content.productOverrides || {};

    box.innerHTML = _products.map(p => {
      const o      = ov[p.id] || {};
      const on     = o.visible === true;
      const hidden = o.hidden || [];
      const prices = o.prices || {};

      const rows = (p.packages || []).map((pkg, i) => {
        const isHidden = hidden.includes(pkg.label);
        const custom   = prices[pkg.label] !== undefined ? prices[pkg.label] : '';
        return `
          <div style="display:flex;align-items:center;gap:.6rem;padding:.45rem 0;border-top:1px solid var(--border)">
            <label style="display:flex;align-items:center;gap:.4rem;flex:1;font-size:.8rem;cursor:pointer">
              <input type="checkbox" data-pkg-show="${esc(p.id)}" data-idx="${i}" ${isHidden ? '' : 'checked'}>
              <span>${esc(pkg.label)}</span>
            </label>
            <span style="font-size:.72rem;color:var(--muted);white-space:nowrap">Product page: ${esc(String(pkg.price))}</span>
            <input type="number" step="0.01" min="0" placeholder="same"
                   data-pkg-price="${esc(p.id)}" data-idx="${i}"
                   value="${esc(String(custom))}"
                   style="width:92px;padding:.35rem .5rem;border:1px solid var(--border);border-radius:6px;font-size:.8rem">
          </div>`;
      }).join('');

      return `
        <div style="border:1px solid var(--border);border-radius:10px;padding:.9rem 1rem;margin-bottom:.8rem;background:#fff">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.4rem">
            <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer">
              <input type="checkbox" data-prod-visible="${esc(p.id)}" ${on ? 'checked' : ''}>
              <span style="font-weight:600;font-size:.9rem">${esc(p.name)}</span>
            </label>
            <input type="text" placeholder="Badge (e.g. Popular)" data-prod-badge="${esc(p.id)}"
                   value="${esc(o.badge || '')}"
                   style="width:170px;padding:.35rem .5rem;border:1px solid var(--border);border-radius:6px;font-size:.78rem">
          </div>
          <div style="font-size:.73rem;color:var(--muted);margin-bottom:.2rem">
            Tick the product to show it on the landing page. Leave a price blank to use the product page price.
          </div>
          ${rows || '<div style="font-size:.78rem;color:var(--muted)">No packages.</div>'}
        </div>`;
    }).join('');
  };

  const _collectOverrides = () => {
    const out = {};
    _products.forEach(p => {
      const visEl  = document.querySelector(`[data-prod-visible="${p.id}"]`);
      const badgeEl= document.querySelector(`[data-prod-badge="${p.id}"]`);
      const hidden = [];
      const prices = {};

      (p.packages || []).forEach((pkg, i) => {
        const showEl  = document.querySelector(`[data-pkg-show="${p.id}"][data-idx="${i}"]`);
        const priceEl = document.querySelector(`[data-pkg-price="${p.id}"][data-idx="${i}"]`);
        if (showEl && !showEl.checked) hidden.push(pkg.label);
        if (priceEl && priceEl.value.trim() !== '') prices[pkg.label] = Number(priceEl.value);
      });

      out[p.id] = {
        visible: visEl ? !!visEl.checked : false,
        badge:   badgeEl ? badgeEl.value.trim() : '',
        hidden,
        prices,
      };
    });
    return out;
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const save = async () => {
    const content = {
      heroTitle:       _get('lp-hero-title'),
      heroSubtitle:    _get('lp-hero-subtitle'),
      statCustomers:   _get('lp-stat-customers'),
      statActivations: _get('lp-stat-activations'),
      statTools:       _get('lp-stat-tools'),
      statCountries:   _get('lp-stat-countries'),
      aboutTitle:      _get('lp-about-title'),
      aboutDesc:       _get('lp-about-desc'),

      email:           _get('lp-email'),
      emailEnabled:    _checked('lp-email-enabled'),
      whatsapp:        _get('lp-whatsapp'),
      whatsappLink:    _get('lp-whatsapp-link'),
      whatsappEnabled: _checked('lp-whatsapp-enabled'),
      phone:           _get('lp-phone'),
      phoneEnabled:    _checked('lp-phone-enabled'),
      wechatId:        _get('lp-wechat-id'),
      wechatQrUrl:     _get('lp-wechat-qr'),
      wechatEnabled:   _checked('lp-wechat-enabled'),

      showPricing:     _checked('lp-show-pricing'),
      pricingTitle:    _get('lp-pricing-title'),
      pricingSubtitle: _get('lp-pricing-subtitle'),

      productOverrides: _collectOverrides(),
    };

    try {
      const d = await api('/admin/landing-content', { adminKey: Store.adminKey, content });
      if (d && d.error) throw new Error(d.error);
      _content = { ...DEFAULTS, ...content };
      showMsg('lp-ok', 'lp-err', true, 'Landing page saved and published.');
    } catch (e) {
      showMsg('lp-ok', 'lp-err', false, 'Save failed: ' + e.message);
    }
  };

  return { load, save, uploadQr, removeQr };
})();
