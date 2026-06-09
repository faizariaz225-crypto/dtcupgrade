const express    = require('express');
const { v4: uuidv4 } = require('uuid');
const fs         = require('fs');
const path       = require('path');
const nodemailer = require('nodemailer');
const crypto     = require('crypto');
const multer     = require('multer');
const XLSX        = require('xlsx');
const PDFDocument = require('pdfkit');

const app  = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY         = process.env.ADMIN_KEY || 'dtc2024';
const DATA_DIR          = process.env.DATA_DIR
                          || (process.env.NODE_ENV === 'production'
                              ? '/opt/render/project/src/data'
                              : path.join(__dirname, 'data'));
const TOKENS_FILE       = path.join(DATA_DIR, 'tokens.json');
const SESSIONS_FILE     = path.join(DATA_DIR, 'sessions.txt');
const EMAIL_CONFIG      = path.join(DATA_DIR, 'emailConfig.json');
const EMAIL_LOG         = path.join(DATA_DIR, 'emailLog.json');
const INSTRUCTIONS_FILE = path.join(DATA_DIR, 'instructions.json');
const NOTIFY_FILE       = path.join(DATA_DIR, 'notifications.json');
const PRODUCTS_FILE     = path.join(DATA_DIR, 'products.json');
const TEMPLATES_FILE    = path.join(DATA_DIR, 'emailTemplates.json');
const SETTINGS_FILE     = path.join(DATA_DIR, 'settings.json');
const LANDING_FILE      = path.join(DATA_DIR, 'landingContent.json');
const KEYS_FILE         = path.join(DATA_DIR, 'keys.json');
const PAYMENTS_FILE     = path.join(DATA_DIR, 'payments.json');
const UPLOADS_DIR       = path.join(DATA_DIR, 'uploads');
const CUSTOMERS_FILE    = path.join(DATA_DIR, 'customers.json');
const RESELLERS_FILE    = path.join(DATA_DIR, 'resellers.json');
const ADMINS_FILE       = path.join(DATA_DIR, 'admins.json');
const USERS_FILE        = path.join(DATA_DIR, 'users.json');
const SESSIONS_MAP_FILE = path.join(DATA_DIR, 'sessions_map.json');

const LINK_EXPIRY_MS = 6 * 30 * 24 * 60 * 60 * 1000;

if (!fs.existsSync(DATA_DIR))       fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(UPLOADS_DIR))    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(TOKENS_FILE))    fs.writeFileSync(TOKENS_FILE,  JSON.stringify({}));
if (!fs.existsSync(SESSIONS_FILE))  fs.writeFileSync(SESSIONS_FILE, '');
if (!fs.existsSync(EMAIL_CONFIG))   fs.writeFileSync(EMAIL_CONFIG,  JSON.stringify({}));
if (!fs.existsSync(EMAIL_LOG))      fs.writeFileSync(EMAIL_LOG,     JSON.stringify([]));
if (!fs.existsSync(SETTINGS_FILE))  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ currency: 'USD', currencySymbol: '$', currencyName: 'US Dollar', activationEmailTemplateId: 'welcome', whatsapp: '', portalSlides: [], paymentMethods: ['Cash','Bank Transfer','Alipay','WeChat Pay','PayPal','Card','Crypto'] }, null, 2));
if (!fs.existsSync(CUSTOMERS_FILE)) fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(RESELLERS_FILE)) fs.writeFileSync(RESELLERS_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(KEYS_FILE))      fs.writeFileSync(KEYS_FILE, JSON.stringify({}));
if (!fs.existsSync(SESSIONS_MAP_FILE)) fs.writeFileSync(SESSIONS_MAP_FILE, JSON.stringify({}));
if (!fs.existsSync(USERS_FILE)) {
  // Default superadmin — password 'dtc2024' stored as plain initially; user should change it
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    {
      id: 'user-superadmin',
      username: 'admin',
      passwordHash: _hashPassword('dtc2024'),
      name: 'Super Admin',
      role: 'superadmin',
      active: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      permissions: ['all'],
    }
  ], null, 2));
}
if (!fs.existsSync(PAYMENTS_FILE))  fs.writeFileSync(PAYMENTS_FILE, JSON.stringify([]));
if (!fs.existsSync(ADMINS_FILE))    fs.writeFileSync(ADMINS_FILE, JSON.stringify([
  { id: 'admin-1', name: 'Admin', role: 'Owner', paymentMethods: [] }
]));
if (!fs.existsSync(LANDING_FILE))   fs.writeFileSync(LANDING_FILE, JSON.stringify({
  heroTitle:       'Your Gateway to <span>AI & Academic</span> Excellence',
  heroSubtitle:    'Digital Tools Corner (DTC) provides affordable, reliable access to premium AI and academic subscription tools for students, researchers, and professionals worldwide.',
  statCustomers:   '2,000+',
  statActivations: '10,000+',
  statTools:       '100+',
  statCountries:   '50+',
  email:           'dtc@dtc1.shop',
  whatsapp:        '+86 19738122807',
  wechatQrUrl:     '',
  aboutTitle:      'Premium AI Access, Made Affordable',
  aboutDesc:       'DTC is a trusted platform dedicated to providing affordable and reliable access to premium AI and academic subscription tools for students, researchers, and professionals worldwide.',
}, null, 2));
if (!fs.existsSync(NOTIFY_FILE))    fs.writeFileSync(NOTIFY_FILE,   JSON.stringify({ enabled: false, message: '', type: 'info' }, null, 2));
if (!fs.existsSync(TEMPLATES_FILE)) fs.writeFileSync(TEMPLATES_FILE, JSON.stringify({"templates": [{"id": "welcome", "name": "✅ Welcome / Activation Confirmed", "subject": "Welcome to DTC — Your {{package}} is ready! 🎉", "body": "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head><body style=\"margin:0;padding:0;background:#f0f4ff;font-family:'Helvetica Neue',Arial,sans-serif\">\n<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f0f4ff;padding:32px 16px\">\n<tr><td align=\"center\">\n<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(37,99,235,.08)\">\n\n<!-- Header -->\n<tr><td style=\"background:#2563eb;padding:32px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:28px;line-height:1\">⚡</td>\n    <td style=\"padding-left:12px\">\n      <div style=\"font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-.02em\">DTC</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.65);margin-top:2px;letter-spacing:.04em\">DIGITAL TOOLS CORNER</div>\n    </td>\n    <td align=\"right\">\n      <div style=\"font-size:13px;font-weight:700;color:rgba(255,255,255,.9)\">Activation Confirmed</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.6);margin-top:2px\">{{package}}</div>\n    </td>\n  </tr></table>\n</td></tr>\n\n<!-- Body -->\n<tr><td style=\"padding:36px 36px 28px\">\n<h1 style=\"margin:0 0 8px;font-size:24px;font-weight:700;color:#1e293b;letter-spacing:-.02em;line-height:1.2\">Welcome to DTC, {{name}}! 🎉</h1><p style=\"margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7\">Your <strong>{{package}}</strong> is now active and ready to use. Here is everything you need to get started.</p><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f8faff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px\">\n<tr><td style=\"padding:10px 16px\">\n  <span style=\"font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.07em;font-weight:600\">Package</span>\n  <div style=\"font-size:14px;font-weight:600;color:#1e293b;margin-top:3px;font-family:monospace\">{{package}}</div>\n</td></tr></table><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:10px\">\n<tr><td style=\"padding:10px 16px\">\n  <span style=\"font-size:11px;color:#15803d;text-transform:uppercase;letter-spacing:.07em;font-weight:600\">Status</span>\n  <div style=\"font-size:14px;font-weight:600;color:#15803d;margin-top:3px;font-family:monospace\">✓ Active</div>\n</td></tr></table><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><h2 style=\"margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b\">What to do next</h2><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:10px\">\n<tr>\n  <td width=\"32\" valign=\"top\"><div style=\"width:26px;height:26px;background:#2563eb20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#2563eb;text-align:center;line-height:26px\">1</div></td>\n  <td style=\"padding-left:10px;font-size:14px;color:#475569;line-height:1.6;padding-top:3px\">Sign in to your account and check your plan status in Settings → Billing.</td>\n</tr></table><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:10px\">\n<tr>\n  <td width=\"32\" valign=\"top\"><div style=\"width:26px;height:26px;background:#2563eb20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#2563eb;text-align:center;line-height:26px\">2</div></td>\n  <td style=\"padding-left:10px;font-size:14px;color:#475569;line-height:1.6;padding-top:3px\">Start a conversation to confirm everything is working correctly.</td>\n</tr></table><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:10px\">\n<tr>\n  <td width=\"32\" valign=\"top\"><div style=\"width:26px;height:26px;background:#2563eb20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#2563eb;text-align:center;line-height:26px\">3</div></td>\n  <td style=\"padding-left:10px;font-size:14px;color:#475569;line-height:1.6;padding-top:3px\">Reach out on WeChat or email us if you need any help.</td>\n</tr></table><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><p style=\"margin:0 0 0;font-size:13px;color:#64748b;line-height:1.7\">Thank you for choosing DTC. We are glad to have you.</p>\n</td></tr>\n\n<!-- Footer -->\n<tr><td style=\"background:#f8faff;border-top:1px solid #e2e8f0;padding:18px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:12px;color:#94a3b8;line-height:1.6\">\n      DTC — Digital Tools Corner &nbsp;·&nbsp; \n      <a href=\"mailto:dtc@dtc1.shop\" style=\"color:#94a3b8;text-decoration:none\">dtc@dtc1.shop</a>\n    </td>\n    <td align=\"right\" style=\"font-size:11px;color:#cbd5e1\">Automated email</td>\n  </tr></table>\n</td></tr>\n\n</table>\n</td></tr></table>\n</body></html>", "lastModified": "2026-04-06T23:16:18.326444Z"}, {"id": "renewal-30d", "name": "⏰ Renewal Reminder (30 days)", "subject": "Your {{package}} subscription expires in {{daysLeft}} days — DTC", "body": "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head><body style=\"margin:0;padding:0;background:#f0f4ff;font-family:'Helvetica Neue',Arial,sans-serif\">\n<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f0f4ff;padding:32px 16px\">\n<tr><td align=\"center\">\n<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(37,99,235,.08)\">\n\n<!-- Header -->\n<tr><td style=\"background:#d97706;padding:32px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:28px;line-height:1\">⏰</td>\n    <td style=\"padding-left:12px\">\n      <div style=\"font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-.02em\">DTC</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.65);margin-top:2px;letter-spacing:.04em\">DIGITAL TOOLS CORNER</div>\n    </td>\n    <td align=\"right\">\n      <div style=\"font-size:13px;font-weight:700;color:rgba(255,255,255,.9)\">Renewal Reminder</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.6);margin-top:2px\">Action needed</div>\n    </td>\n  </tr></table>\n</td></tr>\n\n<!-- Body -->\n<tr><td style=\"padding:36px 36px 28px\">\n<h1 style=\"margin:0 0 8px;font-size:24px;font-weight:700;color:#1e293b;letter-spacing:-.02em;line-height:1.2\">Your subscription renews in {{daysLeft}} days</h1><p style=\"margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7\">Hi <strong>{{name}}</strong>, your <strong>{{package}}</strong> subscription will expire on <strong>{{expiry}}</strong>. Renew early to avoid any interruption.</p><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f8faff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px\">\n<tr><td style=\"padding:10px 16px\">\n  <span style=\"font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.07em;font-weight:600\">Package</span>\n  <div style=\"font-size:14px;font-weight:600;color:#1e293b;margin-top:3px;font-family:monospace\">{{package}}</div>\n</td></tr></table><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:10px\">\n<tr><td style=\"padding:10px 16px\">\n  <span style=\"font-size:11px;color:#b45309;text-transform:uppercase;letter-spacing:.07em;font-weight:600\">Expiry Date</span>\n  <div style=\"font-size:14px;font-weight:600;color:#b45309;margin-top:3px;font-family:monospace\">{{expiry}}</div>\n</td></tr></table><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:10px\">\n<tr><td style=\"padding:10px 16px\">\n  <span style=\"font-size:11px;color:#b45309;text-transform:uppercase;letter-spacing:.07em;font-weight:600\">Days Remaining</span>\n  <div style=\"font-size:14px;font-weight:600;color:#b45309;margin-top:3px;font-family:monospace\">{{daysLeft}} days</div>\n</td></tr></table><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;margin-bottom:20px\">\n<tr><td style=\"padding:16px 20px\">\n  <div style=\"font-size:20px;margin-bottom:6px\">💡</div>\n  <div style=\"font-size:14px;font-weight:700;color:#1d4ed8;margin-bottom:4px\">How to Renew</div>\n  <div style=\"font-size:13px;color:#475569;line-height:1.6\">Contact us on WeChat or reply to this email and we will set up your renewal link right away.</div>\n</td></tr></table><p style=\"margin:0 0 0;font-size:13px;color:#64748b;line-height:1.7\">Renewing takes less than 5 minutes. Contact us today to keep your access uninterrupted.</p>\n</td></tr>\n\n<!-- Footer -->\n<tr><td style=\"background:#f8faff;border-top:1px solid #e2e8f0;padding:18px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:12px;color:#94a3b8;line-height:1.6\">\n      DTC — Digital Tools Corner &nbsp;·&nbsp; \n      <a href=\"mailto:dtc@dtc1.shop\" style=\"color:#94a3b8;text-decoration:none\">dtc@dtc1.shop</a>\n    </td>\n    <td align=\"right\" style=\"font-size:11px;color:#cbd5e1\">Automated email</td>\n  </tr></table>\n</td></tr>\n\n</table>\n</td></tr></table>\n</body></html>", "lastModified": "2026-04-06T23:16:18.326466Z"}, {"id": "renewal-urgent", "name": "🚨 Urgent Renewal (3 days)", "subject": "Last chance to renew — expires {{expiry}} — DTC", "body": "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head><body style=\"margin:0;padding:0;background:#f0f4ff;font-family:'Helvetica Neue',Arial,sans-serif\">\n<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f0f4ff;padding:32px 16px\">\n<tr><td align=\"center\">\n<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(37,99,235,.08)\">\n\n<!-- Header -->\n<tr><td style=\"background:#dc2626;padding:32px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:28px;line-height:1\">🚨</td>\n    <td style=\"padding-left:12px\">\n      <div style=\"font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-.02em\">DTC</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.65);margin-top:2px;letter-spacing:.04em\">DIGITAL TOOLS CORNER</div>\n    </td>\n    <td align=\"right\">\n      <div style=\"font-size:13px;font-weight:700;color:rgba(255,255,255,.9)\">Urgent Reminder</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.6);margin-top:2px\">Expires {{expiry}}</div>\n    </td>\n  </tr></table>\n</td></tr>\n\n<!-- Body -->\n<tr><td style=\"padding:36px 36px 28px\">\n<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin-bottom:20px\">\n<tr><td style=\"padding:16px 20px\">\n  <div style=\"font-size:20px;margin-bottom:6px\">🚨</div>\n  <div style=\"font-size:14px;font-weight:700;color:#dc2626;margin-bottom:4px\">Urgent — Your subscription expires in {{daysLeft}} days</div>\n  <div style=\"font-size:13px;color:#7f1d1d;line-height:1.6\">After expiry your access will be suspended. Contact us immediately to renew.</div>\n</td></tr></table><h1 style=\"margin:0 0 8px;font-size:24px;font-weight:700;color:#1e293b;letter-spacing:-.02em;line-height:1.2\">Last chance to renew, {{name}}</h1><p style=\"margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7\">Your <strong>{{package}}</strong> subscription expires on <strong>{{expiry}}</strong>. This is your final reminder before access is suspended.</p><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f8faff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px\">\n<tr><td style=\"padding:10px 16px\">\n  <span style=\"font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.07em;font-weight:600\">Package</span>\n  <div style=\"font-size:14px;font-weight:600;color:#1e293b;margin-top:3px;font-family:monospace\">{{package}}</div>\n</td></tr></table><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin-bottom:10px\">\n<tr><td style=\"padding:10px 16px\">\n  <span style=\"font-size:11px;color:#dc2626;text-transform:uppercase;letter-spacing:.07em;font-weight:600\">⚠ Expires</span>\n  <div style=\"font-size:14px;font-weight:600;color:#dc2626;margin-top:3px;font-family:monospace\">{{expiry}}</div>\n</td></tr></table><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><p style=\"margin:0 0 0;font-size:14px;color:#475569;line-height:1.7\"><strong>To renew:</strong> Contact us on WeChat or reply to this email with your renewal request. We will generate your renewal link immediately.</p>\n</td></tr>\n\n<!-- Footer -->\n<tr><td style=\"background:#f8faff;border-top:1px solid #e2e8f0;padding:18px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:12px;color:#94a3b8;line-height:1.6\">\n      DTC — Digital Tools Corner &nbsp;·&nbsp; \n      <a href=\"mailto:dtc@dtc1.shop\" style=\"color:#94a3b8;text-decoration:none\">dtc@dtc1.shop</a>\n    </td>\n    <td align=\"right\" style=\"font-size:11px;color:#cbd5e1\">Automated email</td>\n  </tr></table>\n</td></tr>\n\n</table>\n</td></tr></table>\n</body></html>", "lastModified": "2026-04-06T23:16:18.326471Z"}, {"id": "expired", "name": "⏱ Subscription Expired", "subject": "Your {{package}} subscription has expired — DTC", "body": "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head><body style=\"margin:0;padding:0;background:#f0f4ff;font-family:'Helvetica Neue',Arial,sans-serif\">\n<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f0f4ff;padding:32px 16px\">\n<tr><td align=\"center\">\n<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(37,99,235,.08)\">\n\n<!-- Header -->\n<tr><td style=\"background:#dc2626;padding:32px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:28px;line-height:1\">⏱</td>\n    <td style=\"padding-left:12px\">\n      <div style=\"font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-.02em\">DTC</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.65);margin-top:2px;letter-spacing:.04em\">DIGITAL TOOLS CORNER</div>\n    </td>\n    <td align=\"right\">\n      <div style=\"font-size:13px;font-weight:700;color:rgba(255,255,255,.9)\">Subscription Expired</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.6);margin-top:2px\">{{package}}</div>\n    </td>\n  </tr></table>\n</td></tr>\n\n<!-- Body -->\n<tr><td style=\"padding:36px 36px 28px\">\n<h1 style=\"margin:0 0 8px;font-size:24px;font-weight:700;color:#1e293b;letter-spacing:-.02em;line-height:1.2\">Your subscription has ended</h1><p style=\"margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7\">Hi <strong>{{name}}</strong>, your <strong>{{package}}</strong> subscription has expired and your access has been suspended.</p><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin-bottom:20px\">\n<tr><td style=\"padding:16px 20px\">\n  <div style=\"font-size:20px;margin-bottom:6px\">⏱</div>\n  <div style=\"font-size:14px;font-weight:700;color:#dc2626;margin-bottom:4px\">Access Suspended</div>\n  <div style=\"font-size:13px;color:#475569;line-height:1.6\">Your {{package}} access ended on {{expiry}}. Renew now to restore access immediately.</div>\n</td></tr></table><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><h2 style=\"margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b\">Renew now — restore access in minutes</h2><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:10px\">\n<tr>\n  <td width=\"32\" valign=\"top\"><div style=\"width:26px;height:26px;background:#dc262620;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#dc2626;text-align:center;line-height:26px\">1</div></td>\n  <td style=\"padding-left:10px;font-size:14px;color:#475569;line-height:1.6;padding-top:3px\">Contact us on WeChat or reply to this email.</td>\n</tr></table><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:10px\">\n<tr>\n  <td width=\"32\" valign=\"top\"><div style=\"width:26px;height:26px;background:#dc262620;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#dc2626;text-align:center;line-height:26px\">2</div></td>\n  <td style=\"padding-left:10px;font-size:14px;color:#475569;line-height:1.6;padding-top:3px\">We will send you a renewal activation link.</td>\n</tr></table><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:10px\">\n<tr>\n  <td width=\"32\" valign=\"top\"><div style=\"width:26px;height:26px;background:#dc262620;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#dc2626;text-align:center;line-height:26px\">3</div></td>\n  <td style=\"padding-left:10px;font-size:14px;color:#475569;line-height:1.6;padding-top:3px\">Complete the form and your access is restored immediately.</td>\n</tr></table><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><p style=\"margin:0 0 0;font-size:13px;color:#64748b;line-height:1.7\">Questions? Reach us at <a href=\"mailto:dtc@dtc1.shop\" style=\"color:#2563eb\">dtc@dtc1.shop</a> or on WeChat.</p>\n</td></tr>\n\n<!-- Footer -->\n<tr><td style=\"background:#f8faff;border-top:1px solid #e2e8f0;padding:18px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:12px;color:#94a3b8;line-height:1.6\">\n      DTC — Digital Tools Corner &nbsp;·&nbsp; \n      <a href=\"mailto:dtc@dtc1.shop\" style=\"color:#94a3b8;text-decoration:none\">dtc@dtc1.shop</a>\n    </td>\n    <td align=\"right\" style=\"font-size:11px;color:#cbd5e1\">Automated email</td>\n  </tr></table>\n</td></tr>\n\n</table>\n</td></tr></table>\n</body></html>", "lastModified": "2026-04-06T23:16:18.326475Z"}, {"id": "promo", "name": "🎁 Promotional / Special Offer", "subject": "Exclusive offer for DTC customers — {{name}} 🎁", "body": "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head><body style=\"margin:0;padding:0;background:#f0f4ff;font-family:'Helvetica Neue',Arial,sans-serif\">\n<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f0f4ff;padding:32px 16px\">\n<tr><td align=\"center\">\n<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(37,99,235,.08)\">\n\n<!-- Header -->\n<tr><td style=\"background:#15803d;padding:32px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:28px;line-height:1\">🎁</td>\n    <td style=\"padding-left:12px\">\n      <div style=\"font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-.02em\">DTC</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.65);margin-top:2px;letter-spacing:.04em\">DIGITAL TOOLS CORNER</div>\n    </td>\n    <td align=\"right\">\n      <div style=\"font-size:13px;font-weight:700;color:rgba(255,255,255,.9)\">Special Offer</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.6);margin-top:2px\">Exclusive for you</div>\n    </td>\n  </tr></table>\n</td></tr>\n\n<!-- Body -->\n<tr><td style=\"padding:36px 36px 28px\">\n<h1 style=\"margin:0 0 8px;font-size:24px;font-weight:700;color:#1e293b;letter-spacing:-.02em;line-height:1.2\">Exclusive offer for you, {{name}} 🎁</h1><p style=\"margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7\">As a valued DTC customer, we are offering you an exclusive deal on your next subscription. Limited time only.</p><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:20px\">\n<tr><td style=\"padding:16px 20px\">\n  <div style=\"font-size:20px;margin-bottom:6px\">🎉</div>\n  <div style=\"font-size:14px;font-weight:700;color:#15803d;margin-bottom:4px\">Special Offer — Limited Time</div>\n  <div style=\"font-size:13px;color:#475569;line-height:1.6\">Upgrade or renew your plan and get an exclusive deal available only to existing customers. Contact us on WeChat to claim it before it expires.</div>\n</td></tr></table><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><h2 style=\"margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b\">What is included</h2><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:10px\">\n<tr>\n  <td width=\"32\" valign=\"top\"><div style=\"width:26px;height:26px;background:#15803d20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#15803d;text-align:center;line-height:26px\">1</div></td>\n  <td style=\"padding-left:10px;font-size:14px;color:#475569;line-height:1.6;padding-top:3px\">Access to all premium AI tools at a discounted rate.</td>\n</tr></table><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:10px\">\n<tr>\n  <td width=\"32\" valign=\"top\"><div style=\"width:26px;height:26px;background:#15803d20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#15803d;text-align:center;line-height:26px\">2</div></td>\n  <td style=\"padding-left:10px;font-size:14px;color:#475569;line-height:1.6;padding-top:3px\">Priority processing — your link is activated same day.</td>\n</tr></table><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:10px\">\n<tr>\n  <td width=\"32\" valign=\"top\"><div style=\"width:26px;height:26px;background:#15803d20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#15803d;text-align:center;line-height:26px\">3</div></td>\n  <td style=\"padding-left:10px;font-size:14px;color:#475569;line-height:1.6;padding-top:3px\">Dedicated support via WeChat throughout your subscription.</td>\n</tr></table><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><p style=\"margin:0 0 0;font-size:13px;color:#64748b;line-height:1.7\">To claim your offer, simply contact us on WeChat and mention this email. Offer available while stocks last.</p>\n</td></tr>\n\n<!-- Footer -->\n<tr><td style=\"background:#f8faff;border-top:1px solid #e2e8f0;padding:18px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:12px;color:#94a3b8;line-height:1.6\">\n      DTC — Digital Tools Corner &nbsp;·&nbsp; \n      <a href=\"mailto:dtc@dtc1.shop\" style=\"color:#94a3b8;text-decoration:none\">dtc@dtc1.shop</a>\n    </td>\n    <td align=\"right\" style=\"font-size:11px;color:#cbd5e1\">Automated email</td>\n  </tr></table>\n</td></tr>\n\n</table>\n</td></tr></table>\n</body></html>", "lastModified": "2026-04-06T23:16:18.326478Z"}, {"id": "announcement", "name": "📢 General Announcement", "subject": "Important update from DTC", "body": "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head><body style=\"margin:0;padding:0;background:#f0f4ff;font-family:'Helvetica Neue',Arial,sans-serif\">\n<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f0f4ff;padding:32px 16px\">\n<tr><td align=\"center\">\n<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(37,99,235,.08)\">\n\n<!-- Header -->\n<tr><td style=\"background:#6366f1;padding:32px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:28px;line-height:1\">📢</td>\n    <td style=\"padding-left:12px\">\n      <div style=\"font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-.02em\">DTC</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.65);margin-top:2px;letter-spacing:.04em\">DIGITAL TOOLS CORNER</div>\n    </td>\n    <td align=\"right\">\n      <div style=\"font-size:13px;font-weight:700;color:rgba(255,255,255,.9)\">Announcement</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.6);margin-top:2px\">DTC Update</div>\n    </td>\n  </tr></table>\n</td></tr>\n\n<!-- Body -->\n<tr><td style=\"padding:36px 36px 28px\">\n<h1 style=\"margin:0 0 8px;font-size:24px;font-weight:700;color:#1e293b;letter-spacing:-.02em;line-height:1.2\">Important update from DTC</h1><p style=\"margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7\">Hi <strong>{{name}}</strong>, we have something important to share with all our customers.</p><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f8faff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px\">\n<tr><td style=\"padding:10px 16px\">\n  <span style=\"font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.07em;font-weight:600\">Package</span>\n  <div style=\"font-size:14px;font-weight:600;color:#1e293b;margin-top:3px;font-family:monospace\">{{package}}</div>\n</td></tr></table><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><p style=\"margin:0 0 12px;font-size:15px;color:#1e293b;line-height:1.7\"><strong>[Write your announcement here]</strong></p><p style=\"margin:0 0 20px;font-size:14px;color:#475569;line-height:1.7\">[Add more details about the update, what it means for customers, and any action required.]</p><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><p style=\"margin:0 0 0;font-size:13px;color:#64748b;line-height:1.7\">If you have any questions about this update, reply to this email or contact us on WeChat. We are always happy to help.</p>\n</td></tr>\n\n<!-- Footer -->\n<tr><td style=\"background:#f8faff;border-top:1px solid #e2e8f0;padding:18px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:12px;color:#94a3b8;line-height:1.6\">\n      DTC — Digital Tools Corner &nbsp;·&nbsp; \n      <a href=\"mailto:dtc@dtc1.shop\" style=\"color:#94a3b8;text-decoration:none\">dtc@dtc1.shop</a>\n    </td>\n    <td align=\"right\" style=\"font-size:11px;color:#cbd5e1\">Automated email</td>\n  </tr></table>\n</td></tr>\n\n</table>\n</td></tr></table>\n</body></html>", "lastModified": "2026-04-06T23:16:18.326484Z"}, {"id": "payment-thanks", "name": "💳 Payment Received", "subject": "Payment received — thank you, {{name}}! — DTC", "body": "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head><body style=\"margin:0;padding:0;background:#f0f4ff;font-family:'Helvetica Neue',Arial,sans-serif\">\n<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f0f4ff;padding:32px 16px\">\n<tr><td align=\"center\">\n<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(37,99,235,.08)\">\n\n<!-- Header -->\n<tr><td style=\"background:#0891b2;padding:32px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:28px;line-height:1\">💳</td>\n    <td style=\"padding-left:12px\">\n      <div style=\"font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-.02em\">DTC</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.65);margin-top:2px;letter-spacing:.04em\">DIGITAL TOOLS CORNER</div>\n    </td>\n    <td align=\"right\">\n      <div style=\"font-size:13px;font-weight:700;color:rgba(255,255,255,.9)\">Payment Received</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.6);margin-top:2px\">Thank you</div>\n    </td>\n  </tr></table>\n</td></tr>\n\n<!-- Body -->\n<tr><td style=\"padding:36px 36px 28px\">\n<h1 style=\"margin:0 0 8px;font-size:24px;font-weight:700;color:#1e293b;letter-spacing:-.02em;line-height:1.2\">Payment received — thank you, {{name}}!</h1><p style=\"margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7\">We have received your payment and your activation link is being processed. You will hear from us shortly.</p><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f8faff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px\">\n<tr><td style=\"padding:10px 16px\">\n  <span style=\"font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.07em;font-weight:600\">Package</span>\n  <div style=\"font-size:14px;font-weight:600;color:#1e293b;margin-top:3px;font-family:monospace\">{{package}}</div>\n</td></tr></table><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:10px\">\n<tr><td style=\"padding:10px 16px\">\n  <span style=\"font-size:11px;color:#b45309;text-transform:uppercase;letter-spacing:.07em;font-weight:600\">Status</span>\n  <div style=\"font-size:14px;font-weight:600;color:#b45309;margin-top:3px;font-family:monospace\">⏳ Processing — we will be in touch shortly</div>\n</td></tr></table><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><h2 style=\"margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b\">What happens next</h2><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:10px\">\n<tr>\n  <td width=\"32\" valign=\"top\"><div style=\"width:26px;height:26px;background:#2563eb20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#2563eb;text-align:center;line-height:26px\">1</div></td>\n  <td style=\"padding-left:10px;font-size:14px;color:#475569;line-height:1.6;padding-top:3px\">We verify your payment and prepare your activation link. This usually takes a few hours.</td>\n</tr></table><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:10px\">\n<tr>\n  <td width=\"32\" valign=\"top\"><div style=\"width:26px;height:26px;background:#2563eb20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#2563eb;text-align:center;line-height:26px\">2</div></td>\n  <td style=\"padding-left:10px;font-size:14px;color:#475569;line-height:1.6;padding-top:3px\">You receive your unique activation link via WeChat or email.</td>\n</tr></table><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:10px\">\n<tr>\n  <td width=\"32\" valign=\"top\"><div style=\"width:26px;height:26px;background:#2563eb20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#2563eb;text-align:center;line-height:26px\">3</div></td>\n  <td style=\"padding-left:10px;font-size:14px;color:#475569;line-height:1.6;padding-top:3px\">You submit your account details and your subscription is activated.</td>\n</tr></table><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><p style=\"margin:0 0 0;font-size:13px;color:#64748b;line-height:1.7\">Thank you for your trust in DTC. If you have any questions in the meantime, contact us on WeChat.</p>\n</td></tr>\n\n<!-- Footer -->\n<tr><td style=\"background:#f8faff;border-top:1px solid #e2e8f0;padding:18px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:12px;color:#94a3b8;line-height:1.6\">\n      DTC — Digital Tools Corner &nbsp;·&nbsp; \n      <a href=\"mailto:dtc@dtc1.shop\" style=\"color:#94a3b8;text-decoration:none\">dtc@dtc1.shop</a>\n    </td>\n    <td align=\"right\" style=\"font-size:11px;color:#cbd5e1\">Automated email</td>\n  </tr></table>\n</td></tr>\n\n</table>\n</td></tr></table>\n</body></html>", "lastModified": "2026-04-06T23:16:18.326488Z"}, {"id": "win-back", "name": "💙 Win Back / Re-engagement", "subject": "We miss you, {{name}} — come back to DTC", "body": "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head><body style=\"margin:0;padding:0;background:#f0f4ff;font-family:'Helvetica Neue',Arial,sans-serif\">\n<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f0f4ff;padding:32px 16px\">\n<tr><td align=\"center\">\n<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(37,99,235,.08)\">\n\n<!-- Header -->\n<tr><td style=\"background:#2563eb;padding:32px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:28px;line-height:1\">💙</td>\n    <td style=\"padding-left:12px\">\n      <div style=\"font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-.02em\">DTC</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.65);margin-top:2px;letter-spacing:.04em\">DIGITAL TOOLS CORNER</div>\n    </td>\n    <td align=\"right\">\n      <div style=\"font-size:13px;font-weight:700;color:rgba(255,255,255,.9)\">We Miss You</div>\n      <div style=\"font-size:11px;color:rgba(255,255,255,.6);margin-top:2px\">Come back to DTC</div>\n    </td>\n  </tr></table>\n</td></tr>\n\n<!-- Body -->\n<tr><td style=\"padding:36px 36px 28px\">\n<h1 style=\"margin:0 0 8px;font-size:24px;font-weight:700;color:#1e293b;letter-spacing:-.02em;line-height:1.2\">We miss you, {{name}}</h1><p style=\"margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7\">Your <strong>{{package}}</strong> subscription expired on <strong>{{expiry}}</strong>. We would love to have you back.</p><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;margin-bottom:20px\">\n<tr><td style=\"padding:16px 20px\">\n  <div style=\"font-size:20px;margin-bottom:6px\">💙</div>\n  <div style=\"font-size:14px;font-weight:700;color:#1d4ed8;margin-bottom:4px\">Special returning customer offer</div>\n  <div style=\"font-size:13px;color:#475569;line-height:1.6\">As a previous DTC customer, you qualify for our returning customer rate. Contact us on WeChat to find out more.</div>\n</td></tr></table><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><h2 style=\"margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b\">Why customers come back to DTC</h2><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:10px\">\n<tr>\n  <td width=\"32\" valign=\"top\"><div style=\"width:26px;height:26px;background:#2563eb20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#2563eb;text-align:center;line-height:26px\">1</div></td>\n  <td style=\"padding-left:10px;font-size:14px;color:#475569;line-height:1.6;padding-top:3px\">Same-day activation — your link is processed within hours.</td>\n</tr></table><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:10px\">\n<tr>\n  <td width=\"32\" valign=\"top\"><div style=\"width:26px;height:26px;background:#2563eb20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#2563eb;text-align:center;line-height:26px\">2</div></td>\n  <td style=\"padding-left:10px;font-size:14px;color:#475569;line-height:1.6;padding-top:3px\">Flexible packages — monthly, quarterly, or annual plans.</td>\n</tr></table><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:10px\">\n<tr>\n  <td width=\"32\" valign=\"top\"><div style=\"width:26px;height:26px;background:#2563eb20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#2563eb;text-align:center;line-height:26px\">3</div></td>\n  <td style=\"padding-left:10px;font-size:14px;color:#475569;line-height:1.6;padding-top:3px\">Dedicated WeChat support throughout your subscription.</td>\n</tr></table><div style=\"height:1px;background:#e2e8f0;margin:24px 0\"></div><p style=\"margin:0 0 0;font-size:13px;color:#64748b;line-height:1.7\">Ready to get back on board? Contact us on WeChat and we will set everything up for you.</p>\n</td></tr>\n\n<!-- Footer -->\n<tr><td style=\"background:#f8faff;border-top:1px solid #e2e8f0;padding:18px 36px\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n    <td style=\"font-size:12px;color:#94a3b8;line-height:1.6\">\n      DTC — Digital Tools Corner &nbsp;·&nbsp; \n      <a href=\"mailto:dtc@dtc1.shop\" style=\"color:#94a3b8;text-decoration:none\">dtc@dtc1.shop</a>\n    </td>\n    <td align=\"right\" style=\"font-size:11px;color:#cbd5e1\">Automated email</td>\n  </tr></table>\n</td></tr>\n\n</table>\n</td></tr></table>\n</body></html>", "lastModified": "2026-04-06T23:16:18.326494Z"}]}, null, 2));

// ── Default products ───────────────────────────────────────────────────────────
if (!fs.existsSync(PRODUCTS_FILE)) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify({
    products: [
      {
        id: 'claude-pro',
        name: 'Claude Pro',
        description: 'Access to Claude Opus, extended usage limits, and priority service.',
        type: 'session',           // 'session' = customer submits org ID / session data
        credentialsMode: false,    // false = ask customer for their details
        loginDetails: '',          // used when credentialsMode = true
        packages: [
          { label: 'Claude Pro — 1 Month',  price: 15, durationDays: 30  },
          { label: 'Claude Pro — 3 Months', price: 40, durationDays: 90  },
          { label: 'Claude Pro — 6 Months', price: 75, durationDays: 180 },
          { label: 'Claude Pro — 1 Year',   price: 140, durationDays: 365 },
        ],
        color: '#2563eb',
        active: true,
      },
      {
        id: 'chatgpt-plus',
        name: 'ChatGPT Plus',
        description: 'Access to GPT-4o, DALL·E image generation, and all premium features.',
        type: 'chatgpt',
        credentialsMode: false,
        loginDetails: '',
        packages: [
          { label: 'ChatGPT Plus — 1 Month',  price: 20, durationDays: 30  },
          { label: 'ChatGPT Plus — 3 Months', price: 55, durationDays: 90  },
          { label: 'ChatGPT Plus — 6 Months', price: 100, durationDays: 180 },
          { label: 'ChatGPT Plus — 1 Year',   price: 190, durationDays: 365 },
        ],
        color: '#10a37f',
        active: true,
      }
    ]
  }, null, 2));
}

if (!fs.existsSync(INSTRUCTIONS_FILE)) {
  fs.writeFileSync(INSTRUCTIONS_FILE, JSON.stringify({
    sets: {
      'default-claude': {
        id: 'default-claude', name: 'Claude Pro — Default',
        processingText: 'Your details have been received and are being reviewed by the DTC team. This page will update automatically once your Claude Pro account is activated.',
        approvedText: 'Your Claude Pro package is now live and ready to use.',
        approvedSteps: ['Open claude.ai and sign in.','Click your profile icon → Settings → Billing.','Your plan should now show as Claude Pro.'],
        postApprovedText: 'Your Claude Pro subscription is active. Here is what to do next.',
        postApprovedSteps: ['Try Claude Opus for complex tasks.','Use Projects to organise conversations.','Contact DTC on WeChat if you need help.']
      },
      'chatgpt-plus': {
        id: 'chatgpt-plus', name: 'ChatGPT Plus — Default',
        processingText: 'Your ChatGPT Plus session details have been received and are being reviewed.',
        approvedText: 'Your ChatGPT Plus package has been successfully activated.',
        approvedSteps: ['Open ChatGPT at chatgpt.com.','You should see a Plus badge next to your profile.','GPT-4o and image generation are now available.'],
        postApprovedText: 'Welcome to ChatGPT Plus! Here is how to get started.',
        postApprovedSteps: ['Use GPT-4o for faster smarter conversations.','Generate images with DALL·E inside the chat.','Contact DTC on WeChat if you need help.']
      }
    }
  }, null, 2));
}

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

// ── Image uploads (slideshow images, etc.) ───────────────────────────────────
const _ALLOWED_IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const _imgStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => {
    let ext = (path.extname(file.originalname || '') || '').toLowerCase().replace(/[^.a-z0-9]/g, '');
    if (!ext || ext.length > 6) ext = '.img';
    cb(null, uuidv4() + ext);
  },
});
const _imgUpload = multer({
  storage: _imgStorage,
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    if (_ALLOWED_IMG.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files (JPG, PNG, WEBP, GIF, SVG) are allowed.'));
  },
});

app.post('/admin/upload-image', (req, res) => {
  // Authorise from the query string before any file is written to disk
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  _imgUpload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'No file received.' });
    res.json({ success: true, url: '/uploads/' + req.file.filename });
  });
});

// ── File helpers ───────────────────────────────────────────────────────────────
const loadTokens      = () => JSON.parse(fs.readFileSync(TOKENS_FILE,  'utf8'));
const saveTokens      = t  => fs.writeFileSync(TOKENS_FILE,  JSON.stringify(t, null, 2));
const loadEmailCfg    = () => JSON.parse(fs.readFileSync(EMAIL_CONFIG, 'utf8'));
const saveEmailCfg    = c  => fs.writeFileSync(EMAIL_CONFIG, JSON.stringify(c, null, 2));
const loadEmailLog    = () => JSON.parse(fs.readFileSync(EMAIL_LOG,    'utf8'));
const saveEmailLog    = l  => fs.writeFileSync(EMAIL_LOG,    JSON.stringify(l, null, 2));
const loadInstructions= () => JSON.parse(fs.readFileSync(INSTRUCTIONS_FILE, 'utf8'));
const saveInstructions= i  => fs.writeFileSync(INSTRUCTIONS_FILE, JSON.stringify(i, null, 2));
const loadNotify      = () => JSON.parse(fs.readFileSync(NOTIFY_FILE,  'utf8'));
const saveNotify      = n  => fs.writeFileSync(NOTIFY_FILE,  JSON.stringify(n, null, 2));
const loadProducts    = () => JSON.parse(fs.readFileSync(PRODUCTS_FILE,'utf8'));
const saveProducts    = p  => fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(p, null, 2));
const isAdmin         = k  => k === ADMIN_KEY;
const loadTemplates   = () => JSON.parse(fs.readFileSync(TEMPLATES_FILE,'utf8'));
const saveTemplates   = t  => fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(t, null, 2));
const loadSettings    = () => JSON.parse(fs.readFileSync(SETTINGS_FILE,'utf8'));
const saveSettings    = s  => fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
const loadKeys        = () => { try { return JSON.parse(fs.readFileSync(KEYS_FILE,'utf8')); } catch { return {}; } };
const saveKeys        = k  => fs.writeFileSync(KEYS_FILE, JSON.stringify(k, null, 2));
const loadPayments    = () => { try { return JSON.parse(fs.readFileSync(PAYMENTS_FILE,'utf8')); } catch { return []; } };
const savePayments    = p  => fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(p, null, 2));

// ── Customer registry (groups subscriptions, prevents duplicates) ────────────────
const loadCustomers   = () => { try { return JSON.parse(fs.readFileSync(CUSTOMERS_FILE,'utf8')); } catch { return []; } };
const saveCustomers   = c  => fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(c, null, 2));
const _norm           = s  => (s == null ? '' : String(s)).trim().toLowerCase();
function findOrCreateCustomer({ customerId, name, email, wechat }) {
  const customers = loadCustomers();
  let cust = null;
  if (customerId)            cust = customers.find(c => c.id === customerId);
  if (!cust && _norm(email))  cust = customers.find(c => _norm(c.email)  && _norm(c.email)  === _norm(email));
  if (!cust && _norm(wechat)) cust = customers.find(c => _norm(c.wechat) && _norm(c.wechat) === _norm(wechat));
  if (cust) {
    if (name   && !cust.name)   cust.name   = name;
    if (email  && !cust.email)  cust.email  = email;
    if (wechat && !cust.wechat) cust.wechat = wechat;
    saveCustomers(customers);
    return cust;
  }
  cust = {
    id: 'C' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 900 + 100),
    name: name || '', email: email || '', wechat: wechat || '',
    createdAt: new Date().toISOString(),
  };
  customers.push(cust);
  saveCustomers(customers);
  return cust;
}

// ── Reseller registry (tracked separately, with commission) ──────────────────────
const loadResellers = () => { try { return JSON.parse(fs.readFileSync(RESELLERS_FILE,'utf8')); } catch { return []; } };
const saveResellers = r  => fs.writeFileSync(RESELLERS_FILE, JSON.stringify(r, null, 2));
function findOrCreateReseller({ resellerId, name, contact, commissionType, commissionValue }) {
  const list = loadResellers();
  let r = null;
  if (resellerId)             r = list.find(x => x.id === resellerId);
  if (!r && _norm(name))      r = list.find(x => _norm(x.name) === _norm(name));
  if (r) {
    if (commissionType)                                 r.commissionType  = commissionType;
    if (commissionValue !== undefined && commissionValue !== '' && commissionValue !== null) r.commissionValue = Number(commissionValue);
    if (contact)                                        r.contact = contact;
    saveResellers(list);
    return r;
  }
  if (!_norm(name)) return null;
  r = {
    id: 'R' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 900 + 100),
    name, contact: contact || '',
    commissionType: commissionType || 'percent',
    commissionValue: Number(commissionValue) || 0,
    note: '', createdAt: new Date().toISOString(),
  };
  list.push(r);
  saveResellers(list);
  return r;
}
function resellerCommission(t, amt) {
  const ct = t.resellerCommissionType || 'percent';
  const cv = Number(t.resellerCommissionValue) || 0;
  return ct === 'flat' ? cv : (amt * cv / 100);
}
const loadAdmins      = () => { try { return JSON.parse(fs.readFileSync(ADMINS_FILE,'utf8')); } catch { return []; } };
const saveAdmins      = a  => fs.writeFileSync(ADMINS_FILE, JSON.stringify(a, null, 2));

// ── Simple password hashing (SHA-256 + salt) ───────────────────────────────────
function _hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + plain).digest('hex');
  return salt + ':' + hash;
}
function _verifyPassword(plain, stored) {
  const [salt, hash] = stored.split(':');
  return crypto.createHash('sha256').update(salt + plain).digest('hex') === hash;
}

const loadUsers       = () => { try { return JSON.parse(fs.readFileSync(USERS_FILE,'utf8')); } catch { return []; } };
const saveUsers       = u  => fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2));
const loadSessionsMap = () => { try { return JSON.parse(fs.readFileSync(SESSIONS_MAP_FILE,'utf8')); } catch { return {}; } };
const saveSessionsMap = s  => fs.writeFileSync(SESSIONS_MAP_FILE, JSON.stringify(s, null, 2));

// ── Resolve a request to a user (supports legacy ADMIN_KEY + new session tokens) ─
function resolveUser(req) {
  const body = req.body || {};
  const query = req.query || {};
  const key = body.adminKey || query.adminKey || '';

  // Legacy single-key — treat as superadmin
  if (key === ADMIN_KEY) {
    return { id: 'legacy', role: 'superadmin', name: 'Admin', permissions: ['all'] };
  }

  // New session-token auth
  const sessions = loadSessionsMap();
  const session  = sessions[key];
  if (!session) return null;

  // Check expiry (24h sessions)
  if (Date.now() > session.expiresAt) {
    delete sessions[key]; saveSessionsMap(sessions);
    return null;
  }

  const users = loadUsers();
  const user  = users.find(u => u.id === session.userId && u.active);
  if (!user) return null;

  // Refresh session expiry on activity
  sessions[key].expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  sessions[key].lastSeen  = new Date().toISOString();
  saveSessionsMap(sessions);

  return user;
}

// ── Permission check ────────────────────────────────────────────────────────────
const ROLE_PERMISSIONS = {
  superadmin: ['all'],
  admin:      ['dashboard','customers','keys','payments','staff','revenue','resellers','products','instructions','notifications','settings','campaigns','email'],
  manager:    ['dashboard','customers','keys','payments','staff','revenue','resellers'],
  agent:      ['dashboard','customers','keys','payments'],
  viewer:     ['dashboard','customers','revenue'],
};

function hasPermission(user, section) {
  if (!user) return false;
  const perms = user.permissions || ROLE_PERMISSIONS[user.role] || [];
  return perms.includes('all') || perms.includes(section);
}

function requireAuth(section) {
  return (req, res, next) => {
    const user = resolveUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (section && !hasPermission(user, section)) return res.status(403).json({ error: 'Forbidden: insufficient permissions.' });
    req.dtcUser = user;
    next();
  };
}
const loadLanding     = () => JSON.parse(fs.readFileSync(LANDING_FILE,'utf8'));
const saveLanding     = c  => fs.writeFileSync(LANDING_FILE, JSON.stringify(c, null, 2));

// ── Duration lookup — checks product packages first, falls back to label parsing ──
function getDurationDays(productId, packageLabel) {
  try {
    const { products } = loadProducts();
    const prod = products.find(p => p.id === productId);
    if (prod) {
      const pkg = prod.packages.find(pk => pk.label === packageLabel);
      if (pkg) return pkg.durationDays;
    }
  } catch {}
  // Fallback to label parsing
  const p = (packageLabel || '').toLowerCase();
  if (p.includes('1 year') || p.includes('12 month')) return 365;
  if (p.includes('6 month')) return 180;
  if (p.includes('3 month')) return 90;
  return 30;
}

// ── Get price for a package ────────────────────────────────────────────────────
function getPrice(productId, packageLabel) {
  try {
    const { products } = loadProducts();
    const prod = products.find(p => p.id === productId);
    if (prod) {
      const pkg = prod.packages.find(pk => pk.label === packageLabel);
      if (pkg) return pkg.price || 0;
    }
  } catch {}
  return 0;
}

// ── Template variable replacement ─────────────────────────────────────────────
function applyTemplateVars(text, token) {
  const t = token || {};
  const expDate = t.subscriptionExpiresAt
    ? new Date(t.subscriptionExpiresAt).toLocaleDateString('en-GB', {day:'2-digit',month:'long',year:'numeric'})
    : '—';
  const daysLeft = t.subscriptionExpiresAt
    ? Math.ceil((new Date(t.subscriptionExpiresAt) - new Date()) / (1000*60*60*24))
    : 0;
  return text
    .replace(/{{name}}/g,     t.customerName || 'Customer')
    .replace(/{{package}}/g,  t.packageType  || '')
    .replace(/{{product}}/g,  t.productName  || t.productId || '')
    .replace(/{{email}}/g,    t.email        || '')
    .replace(/{{wechat}}/g,   t.wechat       || '')
    .replace(/{{expiry}}/g,   expDate)
    .replace(/{{daysLeft}}/g, String(daysLeft > 0 ? daysLeft : 0));
}

// ── Revenue helpers ────────────────────────────────────────────────────────────
function calcRevenue(tokens) {
  const byProduct  = {};
  const productProfit = {};   // pid -> { revenue, cost, commission, profit }
  const byReseller = {};
  const byMethod   = {};
  let total = 0, resellerTotal = 0, directTotal = 0, refundedTotal = 0, refundedCount = 0, resellerCommissionTotal = 0;
  let costTotal = 0, profitTotal = 0;
  for (const t of Object.values(tokens)) {
    if (!t.approved) continue;
    // "Amount received" is the source of truth; fall back to list price if not recorded
    const amt = (t.amountReceived != null && t.amountReceived !== '') ? Number(t.amountReceived) : (Number(t.price) || 0);
    if (!amt) continue;
    if (t.refunded) { refundedTotal += amt; refundedCount++; continue; } // refunds don't count toward revenue
    const pid = t.productId || 'unknown';
    byProduct[pid] = (byProduct[pid] || 0) + amt;
    const m = t.paymentMethod || 'Unspecified';
    byMethod[m] = (byMethod[m] || 0) + amt;
    total += amt;
    const cost = Number(t.purchasePrice) || 0;
    const comm = t.resellerId ? resellerCommission(t, amt) : 0;
    const profit = amt - cost - comm;
    costTotal += cost; profitTotal += profit;
    if (!productProfit[pid]) productProfit[pid] = { revenue: 0, cost: 0, commission: 0, profit: 0, count: 0 };
    productProfit[pid].revenue += amt; productProfit[pid].cost += cost; productProfit[pid].commission += comm; productProfit[pid].profit += profit; productProfit[pid].count++;
    if (t.resellerId) {
      const rid = t.resellerId;
      if (!byReseller[rid]) byReseller[rid] = { name: t.resellerName || rid, total: 0, count: 0, commission: 0, profit: 0 };
      byReseller[rid].total += amt;
      byReseller[rid].count++;
      byReseller[rid].commission += comm;
      byReseller[rid].profit += profit;
      resellerTotal += amt;
      resellerCommissionTotal += comm;
    } else {
      directTotal += amt;
    }
  }
  return { total, byProduct, productProfit, byReseller, byMethod, resellerTotal, directTotal, refundedTotal, refundedCount, resellerCommissionTotal, costTotal, profitTotal };
}

// ── Email ──────────────────────────────────────────────────────────────────────
function buildTransporter() {
  const cfg = loadEmailCfg();
  if (!cfg.host || !cfg.user || !cfg.pass) return null;
  const port = parseInt(cfg.port) || 587;
  return nodemailer.createTransport({ host: cfg.host, port, secure: port === 465, auth: { user: cfg.user, pass: cfg.pass }, connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 15000, tls: { rejectUnauthorized: false } });
}
async function sendEmail({ to, subject, html, type, token }) {
  const cfg = loadEmailCfg();
  if (!cfg.host || !cfg.user || !cfg.pass) return { ok: false, error: 'Email not configured.' };
  try {
    const tr = buildTransporter();
    await tr.verify();
    await tr.sendMail({ from: `"${cfg.fromName || 'DTC'}" <${cfg.user}>`, to, subject, html });
    const log = loadEmailLog(); log.push({ sentAt: new Date().toISOString(), to, subject, type, token: token || null }); saveEmailLog(log);
    return { ok: true };
  } catch (err) {
    let msg = err.message || 'Unknown error';
    if (msg.includes('ECONNREFUSED')) msg = `Connection refused on ${cfg.host}:${cfg.port}.`;
    if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) msg = 'Connection timed out. Use Gmail App Password on port 587.';
    if (msg.includes('ENOTFOUND')) msg = `Host "${cfg.host}" not found.`;
    if (msg.includes('535') || msg.includes('auth')) msg = 'Auth failed. For Gmail use an App Password.';
    return { ok: false, error: msg };
  }
}
const baseEmail = body => `<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0"><div style="background:#2563eb;padding:24px 32px"><div style="font-size:20px;font-weight:700;color:#fff">DTC</div><div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:2px">Digital Tools Corner</div></div><div style="padding:32px">${body}</div><div style="padding:20px 32px;background:#f8faff;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">DTC · Automated notification.</div></div>`;
const reminderTemplate = ({ customerName, packageType, expiryDate, daysLeft }) => baseEmail(`<h2 style="color:#1e293b;margin:0 0 16px">Your subscription expires in ${daysLeft} day${daysLeft!==1?'s':''}</h2><p style="color:#64748b">Hi ${customerName}, your <strong>${packageType}</strong> subscription expires soon. Contact us on WeChat to renew.</p><div style="background:#f8faff;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-top:16px"><div style="font-size:13px;color:#64748b">Expiry: <strong style="color:#d97706">${expiryDate}</strong> · ${daysLeft} days left</div></div>`);
const expiredTemplate  = ({ customerName, packageType }) => baseEmail(`<h2 style="color:#1e293b;margin:0 0 16px">Your subscription has ended</h2><p style="color:#64748b">Hi ${customerName}, your <strong>${packageType}</strong> has expired. Contact us on WeChat or at <a href="mailto:dtc@dtc1.shop">dtc@dtc1.shop</a> to renew.</p>`);

async function checkSubscriptionEmails() {
  const tokens = loadTokens(); const now = new Date(); let changed = false;
  const cfg = loadEmailCfg(); const emailOn = !!(cfg.host && cfg.user && cfg.pass);
  for (const [token, t] of Object.entries(tokens)) {
    if (!t.approved || !t.subscriptionExpiresAt) continue;
    const expiry = new Date(t.subscriptionExpiresAt);
    const daysLeft = Math.ceil((expiry - now) / (1000*60*60*24));

    // Auto-deactivate the moment a subscription lapses (runs even without email configured)
    if (daysLeft <= 0 && !t.deactivated && !t.refunded) {
      tokens[token].deactivated = true;
      tokens[token].deactivatedAt = now.toISOString();
      tokens[token].deactivationReason = 'expired';
      changed = true;
    }

    if (emailOn && t.email && !t.refunded) {
      const expStr = expiry.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
      const active = !t.deactivated; // never email reminders for a deactivated subscription
      if (active && daysLeft === 30 && !t.reminder30Sent) { const r = await sendEmail({ to: t.email, subject: `Subscription expires in 30 days — DTC`, html: reminderTemplate({ customerName: t.customerName, packageType: t.packageType, expiryDate: expStr, daysLeft: 30 }), type: 'reminder_30d', token }); if (r.ok) { tokens[token].reminder30Sent = true; changed = true; } }
      if (active && daysLeft === 5  && !t.reminder5Sent)  { const r = await sendEmail({ to: t.email, subject: `Subscription expires in 5 days — DTC`,  html: reminderTemplate({ customerName: t.customerName, packageType: t.packageType, expiryDate: expStr, daysLeft: 5  }), type: 'reminder_5d',  token }); if (r.ok) { tokens[token].reminder5Sent  = true; changed = true; } }
      // Expiry notice only for natural expiry (not for a manually deactivated or refunded sub)
      if (daysLeft <= 0 && tokens[token].deactivationReason === 'expired' && !t.expiredEmailSent) { const r = await sendEmail({ to: t.email, subject: `Subscription expired — DTC`, html: expiredTemplate({ customerName: t.customerName, packageType: t.packageType }), type: 'expired', token }); if (r.ok) { tokens[token].expiredEmailSent = true; changed = true; } }
    }
  }
  if (changed) saveTokens(tokens);
}
setInterval(checkSubscriptionEmails, 60*60*1000);
setTimeout(checkSubscriptionEmails, 30000);

// ── Helper: get instruction sets for a token ───────────────────────────────────
function getInstrSets(t) {
  const instr = loadInstructions();
  const pre   = instr.sets[t.instructionSetId]     || instr.sets['default-claude'] || {};
  const post  = instr.sets[t.postInstructionSetId] || pre;
  return { pre, post };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Products CRUD ──────────────────────────────────────────────────────────────
app.get('/admin/products', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  res.json(loadProducts());
});
app.post('/admin/products/save', (req, res) => {
  const { adminKey, product } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  if (!product || !product.id || !product.name) return res.status(400).json({ error: 'Invalid product.' });
  const data = loadProducts();
  const idx = data.products.findIndex(p => p.id === product.id);
  // Preserve live processing-alert state (managed from the Notifications page, not the product editor)
  if (idx >= 0 && product.processingTimer  === undefined && data.products[idx].processingTimer)  product.processingTimer  = data.products[idx].processingTimer;
  if (idx >= 0 && product.processingNotice === undefined && data.products[idx].processingNotice) product.processingNotice = data.products[idx].processingNotice;
  if (idx >= 0) data.products[idx] = product; else data.products.push(product);
  saveProducts(data);
  res.json({ success: true });
});
app.post('/admin/products/delete', (req, res) => {
  const { adminKey, id } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const data = loadProducts();
  data.products = data.products.filter(p => p.id !== id);
  saveProducts(data);
  res.json({ success: true });
});

// ── Revenue ────────────────────────────────────────────────────────────────────
app.get('/admin/revenue', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const tokens = loadTokens();
  res.json(calcRevenue(tokens));
});

// ── Generate link ──────────────────────────────────────────────────────────────
app.post('/admin/generate', (req, res) => {
  const { adminKey, customerName, productId, packageLabel, price, purchasePrice, instructionSetId, postInstructionSetId, resellerId, resellerName, subscriptionKey, customerId, email, wechat, paymentMethod, newReseller } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  if (!customerName)  return res.status(400).json({ error: 'Customer name is required.' });
  if (!productId)     return res.status(400).json({ error: 'Product is required.' });
  if (!packageLabel)  return res.status(400).json({ error: 'Package is required.' });
  if (!price && price !== 0) return res.status(400).json({ error: 'Price is required. Please set a price before generating a link.' });
  if (parseFloat(price) <= 0) return res.status(400).json({ error: 'Price must be greater than 0. Cannot generate a free link.' });

  // Look up product
  const { products } = loadProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return res.status(400).json({ error: 'Product not found.' });

  // Resolve (or create) the customer so subscriptions group under one record
  const customer = findOrCreateCustomer({ customerId, name: customerName, email, wechat });

  // Resolve (or create) the reseller, if this sale was referred
  let reseller = null;
  if (resellerId) reseller = findOrCreateReseller({ resellerId });
  else if (newReseller && newReseller.name) reseller = findOrCreateReseller(newReseller);
  else if (resellerName) reseller = findOrCreateReseller({ name: resellerName });

  const token     = uuidv4();
  const tokens    = loadTokens();
  const expiresAt = new Date(Date.now() + LINK_EXPIRY_MS).toISOString();
  const durationDays = getDurationDays(productId, packageLabel);
  const instrId   = instructionSetId     || (product.type === 'chatgpt' ? 'chatgpt-plus' : 'default-claude');
  const postId    = postInstructionSetId || instrId;

  tokens[token] = {
    customerName,
    customerId:       customer.id,
    email:            email  || '',
    wechat:           wechat || '',
    paymentMethod:    paymentMethod || '',
    productId,
    productName:      product.name,
    portalName:       product.portalName || '',
    packageType:      packageLabel,
    price:            parseFloat(price),
    purchasePrice:    (purchasePrice !== undefined && purchasePrice !== '' && purchasePrice !== null) ? Number(purchasePrice) : (Number(product.cost) || 0),
    currency:         loadSettings().currency || 'USD',
    currencySymbol:   loadSettings().currencySymbol || '$',
    resellerId:       reseller ? reseller.id   : (resellerId   || null),
    resellerName:     reseller ? reseller.name : (resellerName || null),
    resellerCommissionType:  reseller ? reseller.commissionType  : null,
    resellerCommissionValue: reseller ? reseller.commissionValue : null,
    product:          product.type,
    credentialsMode:  product.credentialsMode || false,
    loginDetails:     product.loginDetails    || '',
    instructionSetId: instrId,
    postInstructionSetId: postId,
    subscriptionKey:  subscriptionKey || null,
    createdAt:    new Date().toISOString(),
    expiresAt,
    durationDays,
    used: false, approved: false, declined: false, deactivated: false,
  };
  saveTokens(tokens);

  // Register key as used if provided (from the product's key pool, or ad-hoc)
  if (subscriptionKey) {
    const keysData = loadKeys();
    if (!keysData[subscriptionKey]) keysData[subscriptionKey] = { key: subscriptionKey, productId, product: product.type, addedAt: new Date().toISOString() };
    keysData[subscriptionKey].productId    = keysData[subscriptionKey].productId || productId;
    keysData[subscriptionKey].usedBy       = token;
    keysData[subscriptionKey].customerName = customerName;
    keysData[subscriptionKey].customerId   = customer.id;
    keysData[subscriptionKey].packageType  = packageLabel;
    keysData[subscriptionKey].assignedAt   = new Date().toISOString();
    saveKeys(keysData);
  }

  const link = `${req.protocol}://${req.get('host')}/submit?token=${token}`;
  res.json({ link, token, expiresAt, price: parseFloat(price) });
});

// ── Deactivate / Reactivate ────────────────────────────────────────────────────
app.post('/admin/deactivate', (req, res) => {
  const { adminKey, token } = req.body; if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const tokens = loadTokens(); if (!tokens[token]) return res.status(404).json({ error: 'Not found.' });
  tokens[token].deactivated = true; tokens[token].deactivatedAt = new Date().toISOString(); saveTokens(tokens); res.json({ success: true });
});
app.post('/admin/reactivate', (req, res) => {
  const { adminKey, token } = req.body; if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const tokens = loadTokens(); if (!tokens[token]) return res.status(404).json({ error: 'Not found.' });
  tokens[token].deactivated = false; delete tokens[token].deactivatedAt; saveTokens(tokens); res.json({ success: true });
});

// ── Validate token ─────────────────────────────────────────────────────────────
app.get('/api/validate-token', (req, res) => {
  const { token } = req.query;
  const tokens = loadTokens();
  if (!token || !tokens[token]) return res.status(404).json({ valid: false, error: 'This activation link is invalid. Please contact support.' });
  const t = tokens[token];
  const entry = { at: new Date().toISOString(), ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown', userAgent: req.headers['user-agent'] || 'unknown' };
  if (!t.accessLog) t.accessLog = [];
  t.accessLog.push(entry); t.firstAccessedAt = t.firstAccessedAt || entry.at; t.lastAccessedAt = entry.at; t.accessCount = (t.accessCount || 0) + 1;
  saveTokens(tokens);

  if (t.deactivated) return res.status(410).json({ valid: false, error: 'This link has been deactivated. Please contact support.' });
  if (t.declined)    return res.json({ valid: true, declined: true, declineReason: t.declineReason || '', customerName: t.customerName, packageType: t.packageType, product: t.product || 'claude' });

  const notify = loadNotify();
  const notifPayload = notify.enabled ? { message: notify.message, type: notify.type } : null;

  if (t.used) {
    const { pre, post } = getInstrSets(t);
    const portalName = t.portalName || (loadProducts().products.find(p => p.id === t.productId)?.portalName) || '';
    return res.json({ valid: true, submitted: true, approved: t.approved || false, stage: t.approved ? 'approved' : (t.declined ? 'declined' : (t.stage || 'submitted')), approvedAt: t.approvedAt || null, customerName: t.customerName, packageType: t.packageType, product: t.product || 'claude', portalName, credentialsMode: t.credentialsMode || false, loginDetails: t.approved ? (t.loginDetails || '') : '', accessLink: t.approved ? (t.accessLink || '') : '', orgId: t.orgId || '', sessionData: t.sessionData || '', wechat: t.wechat || '', email: t.email || '', subscriptionExpiresAt: t.subscriptionExpiresAt || null, durationDays: t.durationDays || 30, processingText: pre.processingText, approvedText: pre.approvedText, approvedSteps: pre.approvedSteps, postApprovedText: post.postApprovedText, postApprovedSteps: post.postApprovedSteps, notification: notifPayload, processingNotice: noticeForToken(t) });
  }
  if (t.expiresAt && new Date() > new Date(t.expiresAt)) return res.status(410).json({ valid: false, error: 'This activation link has expired. Please contact support for a new link.' });

  const { pre, post } = getInstrSets(t);
  const portalName = t.portalName || (loadProducts().products.find(p => p.id === t.productId)?.portalName) || '';
  res.json({ valid: true, submitted: false, customerName: t.customerName, packageType: t.packageType, product: t.product || 'claude', portalName, lockEmail: !!t.email, lockWechat: !!t.wechat, credentialsMode: t.credentialsMode || false, processingText: pre.processingText, approvedText: pre.approvedText, approvedSteps: pre.approvedSteps, postApprovedText: post.postApprovedText, postApprovedSteps: post.postApprovedSteps, notification: notifPayload });
});

// ── Submit ─────────────────────────────────────────────────────────────────────
app.post('/api/submit', (req, res) => {
  const { token, orgId, sessionData, wechat, email } = req.body;
  const tokens = loadTokens();
  if (!token || !tokens[token]) return res.status(404).json({ success: false, error: 'Invalid link.' });
  const t = tokens[token];
  if (t.deactivated) return res.status(410).json({ success: false, error: 'This link has been deactivated.' });
  if (t.declined)    return res.status(410).json({ success: false, error: 'This request has been declined.' });
  if (t.used)        return res.status(410).json({ success: false, error: 'Details already submitted.' });
  if (t.expiresAt && new Date() > new Date(t.expiresAt)) return res.status(410).json({ success: false, error: 'This link has expired.' });

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const errors = {};

  // Credentials-mode products: only ask for email + wechat
  if (!t.credentialsMode) {
    if (t.product === 'chatgpt') {
      if (!sessionData || !sessionData.trim()) { errors.sessionData = 'Session data is required.'; }
      else {
        try {
          const parsed = JSON.parse(sessionData.trim());
          const acct = parsed.account || parsed;
          const planType  = acct.planType  || parsed.planType;
          const structure = acct.structure || parsed.structure;
          if (!planType) errors.sessionData = 'Could not find planType. Please copy the full JSON from the session URL.';
          else if (planType !== 'free') errors.sessionData = `⚠ Package already active (planType: "${planType}"). Only free accounts can be upgraded.`;
          else if (structure !== 'personal') errors.sessionData = `⚠ Team account detected (structure: "${structure}"). Switch to personal profile first.`;
        } catch { errors.sessionData = 'Invalid JSON. Please copy the complete content from the session URL.'; }
      }
    } else {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!orgId || !UUID_REGEX.test(orgId.trim())) errors.orgId = 'Invalid Organization ID format.';
    }
  }

  if (!t.wechat && (!wechat || !wechat.trim()))           errors.wechat = 'WeChat ID is required.';
  if (!t.email  && (!email  || !EMAIL_REGEX.test((email||'').trim())))  errors.email  = 'Please enter a valid email address.';
  if (Object.keys(errors).length) return res.status(400).json({ success: false, errors });

  const timestamp = new Date().toISOString();
  let lines = ['══════════════════════════════════════════════════════', `Submitted At : ${timestamp}`, `Customer     : ${t.customerName}`, `Package      : ${t.packageType}`, `Price        : $${t.price || 0}`];
  if (t.credentialsMode) { lines.push('── Credentials provided by DTC ────────────────────────'); }
  else if (t.product === 'chatgpt') { lines.push('── Session Data ───────────────────────────────────────', sessionData.trim()); }
  else { lines.push(`Org ID       : ${orgId ? orgId.trim() : '—'}`); }
  const _wechat = t.wechat || (wechat || '').trim();
  const _email  = t.email  || (email  || '').trim();
  lines.push(`WeChat       : ${_wechat || '—'}`, `Email        : ${_email || '—'}`, '══════════════════════════════════════════════════════', '');
  fs.appendFileSync(SESSIONS_FILE, lines.join('\n'));

  tokens[token].used = true; tokens[token].submittedAt = timestamp;
  tokens[token].wechat = _wechat;
  tokens[token].email  = _email;
  // Backfill the customer registry record with contact details (helps future dedup + history)
  if (tokens[token].customerId) {
    try {
      const customers = loadCustomers();
      const cust = customers.find(c => c.id === tokens[token].customerId);
      if (cust) {
        if (!cust.email)  cust.email  = tokens[token].email;
        if (!cust.wechat) cust.wechat = tokens[token].wechat;
        saveCustomers(customers);
      }
    } catch (e) {}
  }
  if (!t.credentialsMode) {
    if (t.product === 'chatgpt') tokens[token].sessionData = sessionData.trim();
    else tokens[token].orgId = orgId ? orgId.trim() : '';
  }
  saveTokens(tokens);
  res.json({ success: true });
});

// ── Public portal config (slideshow + WhatsApp) for the activation page ──────────
app.get('/api/portal-config', (req, res) => {
  let s = {};
  try { s = loadSettings(); } catch (e) { s = {}; }
  const slides = Array.isArray(s.portalSlides) ? s.portalSlides : [];
  res.json({ whatsapp: s.whatsapp || '', slides, layout: s.portalLayout || 'single', panelSize: s.portalPanelSize || 'half', theme: { accent: s.portalAccent || '#2563eb', bg: s.portalBg || '#f0f4ff', anim: s.portalAnim || 'full' }, intro: { enabled: !!s.portalIntroPopup, title: s.portalIntroTitle || '', text: s.portalIntroText || '', wechatQR: s.portalWechatQR || '', whatsappQR: s.portalWhatsappQR || '', whatsapp: s.whatsapp || '' } });
});

// ── Per-product processing alerts (warning + timer) ──────────────────────────────
const DEFAULT_NOTICE_TITLE = 'Server Under Heavy Load';
const DEFAULT_NOTICE_MSG   = "Your order is taking longer than usual due to high demand. You can safely close this page — we'll notify you once your package is activated.";
function noticeForToken(t) {
  if (!t || !t.productId) return null;
  try {
    const p = loadProducts().products.find(x => x.id === t.productId);
    const n = p && p.processingNotice;
    if (n && n.enabled) return { title: n.title || DEFAULT_NOTICE_TITLE, message: n.message || DEFAULT_NOTICE_MSG, eta: n.eta || '' };
  } catch (e) {}
  return null;
}
function timerElapsed(tm) {
  if (!tm) return 0;
  return (tm.baseMs || 0) + (tm.running && tm.lastStartedAt ? (Date.now() - new Date(tm.lastStartedAt).getTime()) : 0);
}
function timerForToken(t) {
  if (!t || !t.productId) return null;
  try {
    const p = loadProducts().products.find(x => x.id === t.productId);
    const tm = p && p.processingTimer;
    if (tm && tm.show) return { show: true, running: !!tm.running, elapsedMs: timerElapsed(tm) };
  } catch (e) {}
  return null;
}

// ── Admin: control a product's processing timer (show/play/pause/reset) ──────────
app.post('/admin/product/timer', (req, res) => {
  const { adminKey, productId, action } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const data = loadProducts();
  const p = data.products.find(x => x.id === productId);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  const tm = p.processingTimer || { show: false, running: false, baseMs: 0, lastStartedAt: null };
  const now = Date.now();
  switch (action) {
    case 'show': tm.show = true; break;
    case 'hide': tm.show = false; break;
    case 'play': if (!tm.running) { tm.running = true; tm.lastStartedAt = new Date().toISOString(); } break;
    case 'pause': if (tm.running) { tm.baseMs = (tm.baseMs || 0) + (now - new Date(tm.lastStartedAt).getTime()); tm.running = false; tm.lastStartedAt = null; } break;
    case 'reset': tm.baseMs = 0; tm.lastStartedAt = tm.running ? new Date().toISOString() : null; break;
    default: return res.status(400).json({ error: 'Invalid action.' });
  }
  p.processingTimer = tm;
  saveProducts(data);
  res.json({ success: true, timer: { show: !!tm.show, running: !!tm.running, elapsedMs: timerElapsed(tm) } });
});

// ── Admin: set a product's processing warning ────────────────────────────────────
app.post('/admin/product/notice', (req, res) => {
  const { adminKey, productId, enabled, title, message, eta } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const data = loadProducts();
  const p = data.products.find(x => x.id === productId);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  p.processingNotice = { enabled: !!enabled, title: (title || '').trim(), message: (message || '').trim(), eta: (eta || '').trim() };
  saveProducts(data);
  res.json({ success: true, processingNotice: p.processingNotice });
});

// ── Admin: all products + their live processing-alert state (Notifications page) ──
app.get('/admin/processing-alerts', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const list = loadProducts().products.map(p => ({
    id: p.id, name: p.name, active: p.active !== false,
    notice: p.processingNotice || { enabled: false, title: '', message: '', eta: '' },
    timer: { show: !!(p.processingTimer && p.processingTimer.show), running: !!(p.processingTimer && p.processingTimer.running), elapsedMs: timerElapsed(p.processingTimer) },
  }));
  res.json({ products: list });
});

// ── Reports (Excel + PDF; daily / weekly / monthly) ──────────────────────────────
function _periodKey(dateStr, period) {
  if (!dateStr) return '—';
  const dt = new Date(dateStr);
  if (isNaN(dt)) return '—';
  if (period === 'daily')   return dt.toISOString().slice(0, 10);
  if (period === 'monthly') return dt.toISOString().slice(0, 7);
  // weekly → ISO week (YYYY-Www)
  const t = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return t.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}
const _amt   = t => (t.amountReceived != null && t.amountReceived !== '') ? Number(t.amountReceived) : (Number(t.price) || 0);
const _date  = t => t.approvedAt || t.submittedAt || t.createdAt || '';
const _fmtDate = d => d ? new Date(d).toISOString().slice(0, 10) : '';

function buildReport(type, period, opts = {}) {
  const tokens    = Object.values(loadTokens());
  const activated = tokens.filter(t => t.approved && !t.refunded);
  const sym = (loadSettings().currencySymbol) || '$';
  const MONEY = ['Revenue', 'Total Spent', 'Amount', 'Sales', 'Commission', 'Commission Earned'];
  const pLabel = period === 'daily' ? 'Day' : period === 'weekly' ? 'Week' : 'Month';

  if (type === 'activations') {
    const byPeriod = {}, byProduct = {};
    let totalRev = 0;
    activated.forEach(t => {
      const k = _periodKey(_date(t), period);
      byPeriod[k] = byPeriod[k] || { count: 0, rev: 0 };
      byPeriod[k].count++; byPeriod[k].rev += _amt(t);
      const pn = t.productName || t.portalName || t.productId || 'Unknown';
      byProduct[pn] = byProduct[pn] || { count: 0, rev: 0 };
      byProduct[pn].count++; byProduct[pn].rev += _amt(t);
      totalRev += _amt(t);
    });
    return {
      title: 'Total Activations Report',
      filenameBase: `activations_${period}`,
      sheets: [
        { name: 'Summary', columns: [{ header: 'Metric', key: 'm' }, { header: 'Value', key: 'v' }], rows: [
          { m: 'Total activations', v: activated.length },
          { m: 'Total revenue', v: totalRev, money: true },
          { m: 'Total links created', v: tokens.length },
          { m: 'Awaiting approval', v: tokens.filter(t => t.used && !t.approved && !t.declined).length },
          { m: 'Report generated', v: new Date().toISOString().slice(0, 16).replace('T', ' ') },
        ] },
        { name: `By ${pLabel}`, columns: [{ header: pLabel, key: 'p' }, { header: 'Activations', key: 'count' }, { header: 'Revenue', key: 'Revenue' }],
          rows: Object.keys(byPeriod).sort().map(k => ({ p: k, count: byPeriod[k].count, Revenue: byPeriod[k].rev })) },
        { name: 'By Product', columns: [{ header: 'Product', key: 'p' }, { header: 'Activations', key: 'count' }, { header: 'Revenue', key: 'Revenue' }],
          rows: Object.keys(byProduct).sort().map(k => ({ p: k, count: byProduct[k].count, Revenue: byProduct[k].rev })) },
      ], sym, MONEY,
    };
  }

  if (type === 'customers') {
    const custMap = {};
    activated.forEach(t => {
      const key = t.customerId || t.email || t.wechat || t.customerName || 'Unknown';
      custMap[key] = custMap[key] || { name: t.customerName || '', email: t.email || '', wechat: t.wechat || '', count: 0, spent: 0, first: null, last: null };
      const c = custMap[key];
      c.count++; c.spent += _amt(t);
      const d = _date(t);
      if (d) { if (!c.first || d < c.first) c.first = d; if (!c.last || d > c.last) c.last = d; }
    });
    const list = activated.slice().sort((a, b) => (_date(b) || '').localeCompare(_date(a) || ''));
    return {
      title: 'Customer-wise Activations Report',
      filenameBase: `customer_activations_${period}`,
      sheets: [
        { name: 'Customers', columns: [
            { header: 'Customer', key: 'name' }, { header: 'Email', key: 'email' }, { header: 'WeChat', key: 'wechat' },
            { header: 'Activations', key: 'count' }, { header: 'Total Spent', key: 'Total Spent' },
            { header: 'First Activation', key: 'first' }, { header: 'Last Activation', key: 'last' }],
          rows: Object.values(custMap).sort((a, b) => b.spent - a.spent).map(c => ({
            name: c.name, email: c.email, wechat: c.wechat, count: c.count, 'Total Spent': c.spent,
            first: _fmtDate(c.first), last: _fmtDate(c.last) })) },
        { name: 'All Activations', columns: [
            { header: pLabel, key: 'p' }, { header: 'Date', key: 'date' }, { header: 'Customer', key: 'cust' },
            { header: 'Product', key: 'prod' }, { header: 'Package', key: 'pkg' }, { header: 'Amount', key: 'Amount' },
            { header: 'Payment', key: 'pay' }, { header: 'Reseller', key: 'res' }],
          rows: list.map(t => ({
            p: _periodKey(_date(t), period), date: _fmtDate(_date(t)), cust: t.customerName || '',
            prod: t.productName || t.portalName || t.productId || '', pkg: t.packageType || '',
            Amount: _amt(t), pay: t.paymentMethod || '', res: t.resellerName || 'Direct' })) },
      ], sym, MONEY,
    };
  }

  if (type === 'profit') {
    const prodMap = {}, custMap = {}, resMap = {};
    let rev = 0, cost = 0, comm = 0, profit = 0;
    activated.forEach(t => {
      const a = _amt(t), c = Number(t.purchasePrice) || 0;
      const cm = t.resellerId ? resellerCommission(t, a) : 0;
      const p = a - c - cm;
      rev += a; cost += c; comm += cm; profit += p;
      const pn = t.productName || t.portalName || t.productId || 'Unknown';
      prodMap[pn] = prodMap[pn] || { rev: 0, cost: 0, comm: 0, profit: 0, n: 0 };
      prodMap[pn].rev += a; prodMap[pn].cost += c; prodMap[pn].comm += cm; prodMap[pn].profit += p; prodMap[pn].n++;
      const ck = t.customerName || t.email || t.customerId || 'Unknown';
      custMap[ck] = custMap[ck] || { rev: 0, cost: 0, comm: 0, profit: 0, n: 0 };
      custMap[ck].rev += a; custMap[ck].cost += c; custMap[ck].comm += cm; custMap[ck].profit += p; custMap[ck].n++;
      const rk = t.resellerName || (t.resellerId ? t.resellerId : 'Direct (no reseller)');
      resMap[rk] = resMap[rk] || { rev: 0, cost: 0, comm: 0, profit: 0, n: 0 };
      resMap[rk].rev += a; resMap[rk].cost += c; resMap[rk].comm += cm; resMap[rk].profit += p; resMap[rk].n++;
    });
    const cols = (firstHeader, firstKey) => [
      { header: firstHeader, key: firstKey }, { header: 'Activations', key: 'n' },
      { header: 'Revenue', key: 'Revenue' }, { header: 'Cost', key: 'Cost' },
      { header: 'Commission', key: 'Commission' }, { header: 'Profit', key: 'Profit' }, { header: 'Margin %', key: 'margin' } ];
    const toRows = (m, nameKey) => Object.keys(m).sort((a, b) => m[b].profit - m[a].profit).map(k => ({
      [nameKey]: k, n: m[k].n, Revenue: m[k].rev, Cost: m[k].cost, Commission: m[k].comm, Profit: m[k].profit,
      margin: m[k].rev ? Math.round(m[k].profit / m[k].rev * 100) + '%' : '—' }));
    return {
      title: 'Profit & Margin Report',
      filenameBase: `profit_${period}`,
      sheets: [
        { name: 'Summary', columns: [{ header: 'Metric', key: 'm' }, { header: 'Value', key: 'v' }], rows: [
          { m: 'Total revenue', v: rev, money: true }, { m: 'Total cost (purchase price)', v: cost, money: true },
          { m: 'Total reseller commission', v: comm, money: true }, { m: 'Total profit', v: profit, money: true },
          { m: 'Overall margin', v: rev ? Math.round(profit / rev * 100) + '%' : '—' },
          { m: 'Activations counted', v: activated.length } ] },
        { name: 'By Product',  columns: cols('Product', 'p'),     rows: toRows(prodMap, 'p') },
        { name: 'By Customer', columns: cols('Customer', 'c'),    rows: toRows(custMap, 'c') },
        { name: 'By Reseller', columns: cols('Reseller', 'r'),    rows: toRows(resMap, 'r') },
      ], sym, MONEY: ['Revenue', 'Cost', 'Commission', 'Profit', 'Value'],
    };
  }

  // type === 'resellers'
  const resellers = loadResellers();
  const onlyId = opts.resellerId || '';
  const regMap = {};
  resellers.filter(r => !onlyId || r.id === onlyId).forEach(r => { regMap[r.id] = { name: r.name, contact: r.contact || '', commission: r.commissionType === 'flat' ? `${sym}${r.commissionValue}/sale` : `${r.commissionValue}%`, clients: new Set(), count: 0, sales: 0, comm: 0 }; });
  const rows = [];
  activated.filter(t => t.resellerId && (!onlyId || t.resellerId === onlyId)).forEach(t => {
    const rid = t.resellerId;
    if (!regMap[rid]) regMap[rid] = { name: t.resellerName || rid, contact: '', commission: '', clients: new Set(), count: 0, sales: 0, comm: 0 };
    const m = regMap[rid];
    const amt = _amt(t), comm = resellerCommission(t, amt);
    m.clients.add(t.customerId || t.email || t.customerName); m.count++; m.sales += amt; m.comm += comm;
    rows.push({ p: _periodKey(_date(t), period), date: _fmtDate(_date(t)), res: t.resellerName || rid,
      client: t.customerName || '', email: t.email || t.wechat || '', prod: t.productName || t.portalName || t.productId || '',
      pkg: t.packageType || '', Amount: amt, Commission: comm });
  });
  rows.sort((a, b) => (a.res || '').localeCompare(b.res || '') || (b.date || '').localeCompare(a.date || ''));
  const onlyName = onlyId ? ((resellers.find(r => r.id === onlyId) || {}).name || rows[0]?.res || onlyId) : '';
  return {
    title: onlyId ? `Reseller Report — ${onlyName}` : 'Reseller Clients & Reports',
    filenameBase: onlyId ? `reseller_${onlyName.replace(/[^a-z0-9]+/gi, '_')}_${period}` : `reseller_report_${period}`,
    sheets: [
      { name: 'Resellers', columns: [
          { header: 'Reseller', key: 'name' }, { header: 'Contact', key: 'contact' }, { header: 'Commission Rate', key: 'commission' },
          { header: 'Clients', key: 'clients' }, { header: 'Activations', key: 'count' },
          { header: 'Sales', key: 'Sales' }, { header: 'Commission Earned', key: 'Commission Earned' }],
        rows: Object.values(regMap).sort((a, b) => b.sales - a.sales).map(m => ({
          name: m.name, contact: m.contact, commission: m.commission, clients: m.clients.size, count: m.count,
          Sales: m.sales, 'Commission Earned': m.comm })) },
      { name: 'Reseller Activations', columns: [
          { header: pLabel, key: 'p' }, { header: 'Date', key: 'date' }, { header: 'Reseller', key: 'res' },
          { header: 'Client', key: 'client' }, { header: 'Contact', key: 'email' }, { header: 'Product', key: 'prod' },
          { header: 'Package', key: 'pkg' }, { header: 'Amount', key: 'Amount' }, { header: 'Commission', key: 'Commission' }],
        rows },
    ], sym, MONEY,
  };
}

function reportToXlsx(report) {
  const wb = XLSX.utils.book_new();
  report.sheets.forEach(sheet => {
    const aoa = [sheet.columns.map(c => c.header)];
    sheet.rows.forEach(r => aoa.push(sheet.columns.map(c => {
      let v = r[c.key];
      if (v === undefined || v === null) v = '';
      return v;
    })));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = sheet.columns.map(c => ({ wch: Math.max(c.header.length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  });
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function reportToPdf(report, res) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
  doc.pipe(res);
  doc.fontSize(20).fillColor('#1e293b').text(report.title, { align: 'left' });
  doc.fontSize(9).fillColor('#64748b').text('Generated ' + new Date().toLocaleString() + '   ·   DTC — Digital Tools Corner');
  doc.moveDown(0.8);

  report.sheets.forEach((sheet, si) => {
    if (si > 0) doc.moveDown(1);
    doc.fontSize(13).fillColor('#2563eb').text(sheet.name);
    doc.moveDown(0.3);
    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colW = pageW / sheet.columns.length;
    const isMoney = h => report.MONEY.includes(h);
    const drawRow = (vals, opts = {}) => {
      const y = doc.y;
      if (doc.y > doc.page.height - 60) { doc.addPage(); }
      const yy = doc.y;
      let x = doc.page.margins.left;
      doc.fontSize(opts.header ? 9 : 8).fillColor(opts.header ? '#ffffff' : '#334155');
      if (opts.header) doc.rect(x, yy - 2, pageW, 16).fill('#2563eb').fillColor('#ffffff');
      sheet.columns.forEach((c, i) => {
        let v = vals[i];
        if (typeof v === 'number') v = (isMoney(c.header) ? report.sym : '') + v.toLocaleString(undefined, { maximumFractionDigits: 2 });
        doc.fillColor(opts.header ? '#ffffff' : '#334155').text(String(v == null ? '' : v), x + 3, yy, { width: colW - 6, ellipsis: true, lineBreak: false });
        x += colW;
      });
      doc.y = yy + 15;
    };
    drawRow(sheet.columns.map(c => c.header), { header: true });
    if (!sheet.rows.length) { doc.fontSize(8).fillColor('#94a3b8').text('No data.', doc.page.margins.left + 3, doc.y + 2); doc.moveDown(0.5); }
    sheet.rows.forEach(r => drawRow(sheet.columns.map(c => r[c.key])));
  });
  doc.end();
}

app.get('/admin/report', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const type   = ['activations', 'customers', 'resellers', 'profit'].includes(req.query.type) ? req.query.type : 'activations';
  const period = ['daily', 'weekly', 'monthly'].includes(req.query.period) ? req.query.period : 'monthly';
  const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx';
  const hide = (req.query.hide || '').split(',').map(s => s.trim()).filter(Boolean);
  let report;
  try { report = buildReport(type, period, { resellerId: req.query.resellerId || '' }); }
  catch (e) { return res.status(500).json({ error: 'Failed to build report.' }); }
  // Apply admin column filters (hide selected columns from every sheet)
  if (hide.length) report.sheets = report.sheets.map(s => ({ ...s, columns: s.columns.filter(c => !hide.includes(c.header)) }));
  const fname = `${report.filenameBase}_${new Date().toISOString().slice(0, 10)}`;
  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}.pdf"`);
    return reportToPdf(report, res);
  }
  const buf = reportToXlsx(report);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}.xlsx"`);
  res.send(buf);
});

// ── Poll status ────────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  const { token } = req.query;
  const tokens = loadTokens();
  if (!token || !tokens[token]) return res.status(404).json({ error: 'Invalid.' });
  const t = tokens[token];
  const { pre, post } = getInstrSets(t);
  const notify = loadNotify();
  res.json({
    status: t.declined ? 'declined' : t.approved ? 'activated' : t.used ? 'processing' : 'pending',
    stage:  t.declined ? 'declined' : t.approved ? 'approved'  : t.used ? (t.stage || 'submitted') : 'pending',
    packageType: t.packageType, customerName: t.customerName, product: t.product || 'claude',
    portalName: t.portalName || (loadProducts().products.find(p => p.id === t.productId)?.portalName) || '',
    credentialsMode: t.credentialsMode || false, loginDetails: t.approved ? (t.loginDetails || '') : '', accessLink: t.approved ? (t.accessLink || '') : '',
    approvedAt: t.approvedAt || null, declineReason: t.declineReason || '',
    orgId: t.orgId || '', sessionData: t.sessionData || '', wechat: t.wechat || '', email: t.email || '',
    subscriptionExpiresAt: t.subscriptionExpiresAt || null, durationDays: t.durationDays || 30,
    processingText: pre.processingText, approvedText: pre.approvedText, approvedSteps: pre.approvedSteps,
    postApprovedText: post.postApprovedText, postApprovedSteps: post.postApprovedSteps,
    notification: notify.enabled ? { message: notify.message, type: notify.type } : null,
    processingNotice: noticeForToken(t),
    processingTimer: timerForToken(t),
  });
});

// ── Approve ────────────────────────────────────────────────────────────────────
// ── Set verification stage (admin-controlled pipeline) ───────────────────────────
app.post('/admin/set-stage', (req, res) => {
  const { adminKey, token, stage } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const allowed = ['submitted', 'verifying', 'verified', 'processing'];
  if (!allowed.includes(stage)) return res.status(400).json({ error: 'Invalid stage.' });
  const tokens = loadTokens();
  if (!tokens[token]) return res.status(404).json({ error: 'Not found.' });
  tokens[token].stage = stage;
  tokens[token].stageAt = new Date().toISOString();
  saveTokens(tokens);
  res.json({ success: true, stage });
});

app.post('/admin/approve', async (req, res) => {
  const { adminKey, token } = req.body; if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const tokens = loadTokens(); if (!tokens[token]) return res.status(404).json({ error: 'Not found.' });
  if (tokens[token].approved) return res.json({ success: true });
  const days = getDurationDays(tokens[token].productId, tokens[token].packageType);
  tokens[token].approved = true; tokens[token].declined = false;
  tokens[token].stage = 'approved';
  tokens[token].approvedAt = new Date().toISOString();
  tokens[token].subscriptionExpiresAt = new Date(Date.now() + days*24*60*60*1000).toISOString();
  tokens[token].subscriptionDays = days;
  saveTokens(tokens);

  // Auto-send activation email if customer has email + template configured
  const t = tokens[token];
  if (t.email) {
    try {
      const settings = loadSettings();
      const tmplId   = settings.activationEmailTemplateId;
      if (tmplId) {
        const tmplData = loadTemplates();
        const tmpl     = tmplData.templates.find(x => x.id === tmplId);
        if (tmpl) {
          const html = applyTemplateVars(tmpl.body, t);
          const subj = applyTemplateVars(tmpl.subject, t);
          await sendEmail({ to: t.email, subject: subj, html, type: 'activation', token });
        }
      }
    } catch(e) { console.warn('Activation email failed:', e.message); }
  }
  res.json({ success: true });
});

// ── Decline ────────────────────────────────────────────────────────────────────
app.post('/admin/decline', (req, res) => {
  const { adminKey, token, reason } = req.body; if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const tokens = loadTokens(); if (!tokens[token]) return res.status(404).json({ error: 'Not found.' });
  tokens[token].declined = true; tokens[token].approved = false;
  tokens[token].declinedAt = new Date().toISOString(); tokens[token].declineReason = reason || 'The details provided could not be verified.';
  saveTokens(tokens); res.json({ success: true });
});

// ── Delete token (soft-delete) ─────────────────────────────────────────────────
app.post('/admin/delete-token', (req, res) => {
  const { adminKey, token } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const tokens = loadTokens();
  if (!tokens[token]) return res.status(404).json({ error: 'Not found.' });
  // Free up any subscription key that was tied to this token
  const usedKey = tokens[token].subscriptionKey;
  if (usedKey) {
    const keysData = loadKeys();
    if (keysData[usedKey] && keysData[usedKey].usedBy === token) {
      keysData[usedKey].usedBy = null;
      keysData[usedKey].customerName = null;
      keysData[usedKey].packageType = null;
      keysData[usedKey].assignedAt = null;
      saveKeys(keysData);
    }
  }
  // Permanently remove the record
  delete tokens[token];
  saveTokens(tokens);
  res.json({ success: true });
});

// ── Refund token ────────────────────────────────────────────────────────────────
app.post('/admin/refund', (req, res) => {
  const { adminKey, token, refundNote } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const tokens = loadTokens();
  if (!tokens[token]) return res.status(404).json({ error: 'Not found.' });
  const _amt = (tokens[token].amountReceived != null && tokens[token].amountReceived !== '') ? Number(tokens[token].amountReceived) : (Number(tokens[token].price) || 0);
  tokens[token].refunded   = true;
  tokens[token].refundedAt = new Date().toISOString();
  tokens[token].refundNote = refundNote || '';
  tokens[token].refundAmount = _amt;
  // Deactivate the subscription
  tokens[token].deactivated   = true;
  tokens[token].deactivatedAt = tokens[token].deactivatedAt || new Date().toISOString();
  saveTokens(tokens);
  res.json({ success: true });
});

// ── Edit token fields ──────────────────────────────────────────────────────────
app.post('/admin/edit-token', (req, res) => {
  const { adminKey, token, customerName, email, wechat, packageType, subscriptionExpiresAt, approvedAt, price, purchasePrice, subscriptionDays, subscriptionKey, amountReceived, paymentMethod } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const tokens = loadTokens();
  if (!tokens[token]) return res.status(404).json({ error: 'Not found.' });
  const t = tokens[token];
  if (customerName   !== undefined) t.customerName          = customerName;
  if (email          !== undefined) t.email                 = email;
  if (wechat         !== undefined) t.wechat                = wechat;
  if (packageType    !== undefined) t.packageType           = packageType;
  if (subscriptionExpiresAt !== undefined) t.subscriptionExpiresAt = subscriptionExpiresAt;
  if (approvedAt     !== undefined) t.approvedAt            = approvedAt;
  if (price          !== undefined) t.price                 = parseFloat(price);
  if (purchasePrice  !== undefined) t.purchasePrice         = (purchasePrice === '' || purchasePrice == null) ? 0 : parseFloat(purchasePrice);
  if (amountReceived !== undefined) t.amountReceived        = (amountReceived === '' || amountReceived == null) ? null : parseFloat(amountReceived);
  if (paymentMethod  !== undefined) t.paymentMethod         = paymentMethod;
  if (subscriptionDays !== undefined) t.subscriptionDays    = parseInt(subscriptionDays);
  if (subscriptionKey !== undefined && subscriptionKey !== '') {
    // Record the old key as used in key store if changed
    const oldKey = t.subscriptionKey;
    t.subscriptionKey = subscriptionKey;
    // Update key registry
    const keysData = loadKeys();
    if (oldKey && keysData[oldKey]) { keysData[oldKey].usedBy = null; keysData[oldKey].customerName = null; keysData[oldKey].packageType = null; keysData[oldKey].assignedAt = null; }
    if (!keysData[subscriptionKey]) keysData[subscriptionKey] = { key: subscriptionKey, product: t.product || 'claude', addedAt: new Date().toISOString() };
    keysData[subscriptionKey].usedBy       = token;
    keysData[subscriptionKey].customerName = t.customerName || '';
    keysData[subscriptionKey].packageType  = t.packageType  || '';
    keysData[subscriptionKey].assignedAt   = new Date().toISOString();
    saveKeys(keysData);
  }
  saveTokens(tokens);
  res.json({ success: true });
});

// ── Keys CRUD (per-product inventory) ────────────────────────────────────────────
const _productName = (pid) => { try { const p = loadProducts().products.find(x => x.id === pid); return p ? p.name : pid; } catch { return pid; } };
const availableKeys = (pid) => Object.values(loadKeys()).filter(k => !k.usedBy && (k.productId === pid));
const keyStockMap = () => {
  const map = {};
  Object.values(loadKeys()).forEach(k => { if (!k.productId) return; map[k.productId] = map[k.productId] || { available: 0, used: 0 }; if (k.usedBy) map[k.productId].used++; else map[k.productId].available++; });
  return map;
};

app.get('/admin/keys', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const keysData = loadKeys();
  const pid = req.query.productId;
  let keys = Object.values(keysData).map(k => ({ ...k, productName: _productName(k.productId) }));
  if (pid) keys = keys.filter(k => k.productId === pid);
  keys.sort((a, b) => {
    if (!a.usedBy && b.usedBy) return -1;
    if (a.usedBy && !b.usedBy) return 1;
    return (a.key || '').localeCompare(b.key || '');
  });
  res.json({ keys, stock: keyStockMap() });
});

app.post('/admin/keys/add', (req, res) => {
  const { adminKey, productId, product, keys } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  if (!productId) return res.status(400).json({ error: 'Select a product first.' });
  if (!Array.isArray(keys) || !keys.length) return res.status(400).json({ error: 'No keys provided.' });
  const keysData = loadKeys();
  let added = 0, skipped = 0;
  keys.forEach(k => {
    const key = String(k).trim();
    if (!key) return;
    if (keysData[key]) { skipped++; return; }
    keysData[key] = { key, productId, product: product || '', addedAt: new Date().toISOString(), usedBy: null };
    added++;
  });
  saveKeys(keysData);
  res.json({ success: true, added, skipped, stock: keyStockMap() });
});

app.post('/admin/keys/delete', (req, res) => {
  const { adminKey, key } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const keysData = loadKeys();
  if (!keysData[key]) return res.status(404).json({ error: 'Key not found.' });
  if (keysData[key].usedBy) return res.status(400).json({ error: 'Key is in use and cannot be deleted.' });
  delete keysData[key];
  saveKeys(keysData);
  res.json({ success: true });
});

app.post('/admin/keys/delete-unused', (req, res) => {
  const { adminKey, productId } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const keysData = loadKeys();
  Object.keys(keysData).forEach(k => {
    if (!keysData[k].usedBy && (!productId || keysData[k].productId === productId)) delete keysData[k];
  });
  saveKeys(keysData);
  res.json({ success: true });
});

// ── Unassign a used key: clears it from the subscription and returns it to available ──
app.post('/admin/keys/unassign', (req, res) => {
  const { adminKey, key } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const keysData = loadKeys();
  if (!keysData[key]) return res.status(404).json({ error: 'Key not found.' });
  const token = keysData[key].usedBy;
  // Clear the key's assignment
  keysData[key].usedBy       = null;
  keysData[key].customerName = null;
  keysData[key].customerId   = null;
  keysData[key].packageType  = null;
  keysData[key].assignedAt   = null;
  saveKeys(keysData);
  // Also clear it from the token that was using it
  if (token) {
    const tokens = loadTokens();
    if (tokens[token] && tokens[token].subscriptionKey === key) {
      tokens[token].subscriptionKey = null;
      saveTokens(tokens);
    }
  }
  res.json({ success: true, stock: keyStockMap() });
});

// ── Assign an existing unused key to a subscription token ──────────────────────
app.post('/admin/keys/assign', (req, res) => {
  const { adminKey, key, token } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const keysData = loadKeys();
  if (!keysData[key]) return res.status(404).json({ error: 'Key not found.' });
  if (keysData[key].usedBy) return res.status(400).json({ error: 'Key is already assigned to another subscription.' });
  const tokens = loadTokens();
  if (!tokens[token]) return res.status(404).json({ error: 'Subscription not found.' });
  const t = tokens[token];
  // If the token already has a key, free the old one first
  const oldKey = t.subscriptionKey;
  if (oldKey && keysData[oldKey]) {
    keysData[oldKey].usedBy = null; keysData[oldKey].customerName = null;
    keysData[oldKey].customerId = null; keysData[oldKey].packageType = null;
    keysData[oldKey].assignedAt = null;
  }
  // Assign the new key
  keysData[key].usedBy       = token;
  keysData[key].customerName = t.customerName || '';
  keysData[key].customerId   = t.customerId   || '';
  keysData[key].packageType  = t.packageType  || '';
  keysData[key].assignedAt   = new Date().toISOString();
  keysData[key].productId    = keysData[key].productId || t.productId || '';
  saveKeys(keysData);
  // Update the token
  t.subscriptionKey = key;
  saveTokens(tokens);
  res.json({ success: true, stock: keyStockMap() });
});




// ════════════════════════════════════════════════════════════════════════════
// USER AUTH — login / logout / session / user management
// ════════════════════════════════════════════════════════════════════════════

app.post('/admin/user-login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
  const users = loadUsers();
  const user  = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.active);
  if (!user) return res.status(401).json({ error: 'Invalid username or password.' });
  if (!_verifyPassword(password, user.passwordHash)) return res.status(401).json({ error: 'Invalid username or password.' });

  // Create session
  const sessionToken = uuidv4();
  const sessions = loadSessionsMap();
  sessions[sessionToken] = {
    userId:    user.id,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    lastSeen:  new Date().toISOString(),
    ip:        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
  };
  saveSessionsMap(sessions);

  // Update lastLoginAt
  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) { users[idx].lastLoginAt = new Date().toISOString(); saveUsers(users); }

  const perms = user.permissions || ROLE_PERMISSIONS[user.role] || [];
  res.json({
    sessionToken,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, permissions: perms },
  });
});

app.post('/admin/user-logout', (req, res) => {
  const { sessionToken } = req.body;
  if (sessionToken) {
    const sessions = loadSessionsMap();
    delete sessions[sessionToken];
    saveSessionsMap(sessions);
  }
  res.json({ success: true });
});

app.post('/admin/user-verify', (req, res) => {
  const user = resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Session expired or invalid.' });
  const perms = user.permissions || ROLE_PERMISSIONS[user.role] || [];
  res.json({ valid: true, user: { id: user.id, username: user.username, name: user.name, role: user.role, permissions: perms } });
});

// User management — superadmin / admin only
app.get('/admin/users', requireAuth('settings'), (req, res) => {
  if (!hasPermission(req.dtcUser, 'all') && req.dtcUser.role !== 'superadmin' && req.dtcUser.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  const users = loadUsers().map(u => ({ ...u, passwordHash: undefined }));
  res.json({ users });
});

app.post('/admin/users/save', requireAuth('settings'), (req, res) => {
  const actor = req.dtcUser;
  if (actor.role !== 'superadmin' && actor.role !== 'admin') return res.status(403).json({ error: 'Forbidden.' });
  const { user } = req.body;
  if (!user || !user.username || !user.name) return res.status(400).json({ error: 'Username and name required.' });

  const users = loadUsers();

  // Prevent non-superadmin creating superadmin
  if (user.role === 'superadmin' && actor.role !== 'superadmin') return res.status(403).json({ error: 'Only superadmins can create superadmin accounts.' });

  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) {
    // Edit existing
    const existing = users[idx];
    // Prevent demoting/editing a superadmin unless you are one
    if (existing.role === 'superadmin' && actor.role !== 'superadmin') return res.status(403).json({ error: 'Cannot edit superadmin.' });
    users[idx] = {
      ...existing,
      username:    user.username,
      name:        user.name,
      role:        user.role || existing.role,
      active:      user.active !== undefined ? user.active : existing.active,
      permissions: user.permissions || ROLE_PERMISSIONS[user.role] || existing.permissions,
      updatedAt:   new Date().toISOString(),
    };
    if (user.newPassword) users[idx].passwordHash = _hashPassword(user.newPassword);
  } else {
    // New user
    if (!user.newPassword) return res.status(400).json({ error: 'Password required for new user.' });
    const dupUser = users.find(u => u.username.toLowerCase() === user.username.toLowerCase());
    if (dupUser) return res.status(400).json({ error: 'Username already exists.' });
    users.push({
      id:           'user-' + uuidv4().slice(0,8),
      username:     user.username,
      passwordHash: _hashPassword(user.newPassword),
      name:         user.name,
      role:         user.role || 'agent',
      active:       true,
      permissions:  user.permissions || ROLE_PERMISSIONS[user.role || 'agent'] || [],
      createdAt:    new Date().toISOString(),
      lastLoginAt:  null,
    });
  }
  saveUsers(users);
  res.json({ success: true, users: users.map(u => ({ ...u, passwordHash: undefined })) });
});

app.post('/admin/users/delete', requireAuth('settings'), (req, res) => {
  const actor = req.dtcUser;
  if (actor.role !== 'superadmin' && actor.role !== 'admin') return res.status(403).json({ error: 'Forbidden.' });
  const { id } = req.body;
  const users = loadUsers();
  const target = users.find(u => u.id === id);
  if (target && target.role === 'superadmin' && actor.role !== 'superadmin') return res.status(403).json({ error: 'Cannot delete superadmin.' });
  // Prevent self-delete
  if (actor.id === id) return res.status(400).json({ error: 'Cannot delete your own account.' });
  const filtered = users.filter(u => u.id !== id);
  saveUsers(filtered);
  // Invalidate all sessions for this user
  const sessions = loadSessionsMap();
  Object.keys(sessions).forEach(k => { if (sessions[k].userId === id) delete sessions[k]; });
  saveSessionsMap(sessions);
  res.json({ success: true, users: filtered.map(u => ({ ...u, passwordHash: undefined })) });
});

app.post('/admin/users/change-password', (req, res) => {
  const user = resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { currentPassword, newPassword, targetUserId } = req.body;
  const users = loadUsers();

  // Changing own password
  if (!targetUserId || targetUserId === user.id) {
    const self = users.find(u => u.id === user.id);
    if (!self) return res.status(404).json({ error: 'User not found.' });
    if (!_verifyPassword(currentPassword, self.passwordHash)) return res.status(401).json({ error: 'Current password incorrect.' });
    self.passwordHash = _hashPassword(newPassword);
    saveUsers(users);
    return res.json({ success: true });
  }

  // Admin changing another user's password
  if (user.role !== 'superadmin' && user.role !== 'admin') return res.status(403).json({ error: 'Forbidden.' });
  const target = users.find(u => u.id === targetUserId);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  target.passwordHash = _hashPassword(newPassword);
  saveUsers(users);
  res.json({ success: true });
});

app.get('/admin/users/sessions', requireAuth('settings'), (req, res) => {
  if (req.dtcUser.role !== 'superadmin' && req.dtcUser.role !== 'admin') return res.status(403).json({ error: 'Forbidden.' });
  const sessions = loadSessionsMap();
  const users    = loadUsers();
  const active   = Object.entries(sessions)
    .filter(([, s]) => Date.now() < s.expiresAt)
    .map(([token, s]) => {
      const u = users.find(u => u.id === s.userId);
      return { token: token.slice(0,8)+'…', userId: s.userId, userName: u ? u.name : 'Unknown', role: u ? u.role : '?', lastSeen: s.lastSeen, ip: s.ip };
    });
  res.json({ sessions: active });
});

app.post('/admin/users/revoke-sessions', requireAuth('settings'), (req, res) => {
  if (req.dtcUser.role !== 'superadmin' && req.dtcUser.role !== 'admin') return res.status(403).json({ error: 'Forbidden.' });
  const { userId } = req.body;
  const sessions = loadSessionsMap();
  Object.keys(sessions).forEach(k => { if (!userId || sessions[k].userId === userId) delete sessions[k]; });
  saveSessionsMap(sessions);
  res.json({ success: true });
});

// ── sessions-data: now also returns current user context ──────────────────────
// (legacy endpoint — still used by old auth flow)

// ════════════════════════════════════════════════════════════════════════════
// ADMINS (staff who receive payments)
// ════════════════════════════════════════════════════════════════════════════
app.get('/admin/admins', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ admins: loadAdmins() });
});
app.post('/admin/admins/save', (req, res) => {
  const { adminKey, admin } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  if (!admin || !admin.name) return res.status(400).json({ error: 'Name is required.' });
  const admins = loadAdmins();
  const idx = admins.findIndex(a => a.id === admin.id);
  if (idx >= 0) { admins[idx] = { ...admins[idx], ...admin }; }
  else { admins.push({ ...admin, id: admin.id || ('admin-' + uuidv4().slice(0,8)), createdAt: new Date().toISOString() }); }
  saveAdmins(admins);
  res.json({ success: true, admins });
});
app.post('/admin/admins/delete', (req, res) => {
  const { adminKey, id } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const admins = loadAdmins().filter(a => a.id !== id);
  saveAdmins(admins);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ════════════════════════════════════════════════════════════════════════════
app.get('/admin/payments', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ payments: loadPayments(), admins: loadAdmins() });
});
app.post('/admin/payments/add', (req, res) => {
  const { adminKey, payment } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  if (!payment || !payment.amount) return res.status(400).json({ error: 'Amount is required.' });
  if (!payment.adminId)            return res.status(400).json({ error: 'Receiving admin is required.' });
  const payments = loadPayments();
  const id = 'pay-' + uuidv4().slice(0,8);
  const record = {
    id, amount: parseFloat(payment.amount),
    currency: payment.currency || 'USD', currencySymbol: payment.currencySymbol || '$',
    method: payment.method || 'Unknown',
    adminId: payment.adminId, adminName: payment.adminName || '',
    customerName: payment.customerName || '', customerEmail: payment.customerEmail || '',
    tokenRef: payment.tokenRef || null, note: payment.note || '',
    paidAt: payment.paidAt || new Date().toISOString(),
    recordedAt: new Date().toISOString(), status: payment.status || 'received',
  };
  payments.unshift(record);
  savePayments(payments);
  if (record.tokenRef) {
    const tokens = loadTokens();
    if (tokens[record.tokenRef]) {
      tokens[record.tokenRef].paymentId = id; tokens[record.tokenRef].paymentMethod = record.method;
      tokens[record.tokenRef].paidToAdmin = record.adminId; tokens[record.tokenRef].paidToAdminName = record.adminName;
      saveTokens(tokens);
    }
  }
  res.json({ success: true, payment: record });
});
app.post('/admin/payments/edit', (req, res) => {
  const { adminKey, id, updates } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const payments = loadPayments();
  const idx = payments.findIndex(p => p.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Not found.' });
  payments[idx] = { ...payments[idx], ...updates, id };
  savePayments(payments);
  res.json({ success: true, payment: payments[idx] });
});
app.post('/admin/payments/delete', (req, res) => {
  const { adminKey, id } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const payments = loadPayments().filter(p => p.id !== id);
  savePayments(payments);
  res.json({ success: true });
});
app.get('/admin/payments/summary', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const payments = loadPayments().filter(p => p.status !== 'refunded');
  const admins   = loadAdmins();
  const byAdmin  = {};
  payments.forEach(p => {
    if (!byAdmin[p.adminId]) {
      const adm = admins.find(a => a.id === p.adminId);
      byAdmin[p.adminId] = { adminId: p.adminId, adminName: p.adminName || (adm&&adm.name) || 'Unknown', total: 0, count: 0, byMethod: {} };
    }
    byAdmin[p.adminId].total += p.amount;
    byAdmin[p.adminId].count++;
    const m = p.method || 'Unknown';
    byAdmin[p.adminId].byMethod[m] = (byAdmin[p.adminId].byMethod[m] || 0) + p.amount;
  });
  res.json({ summary: Object.values(byAdmin), total: payments.reduce((s,p)=>s+p.amount,0), count: payments.length });
});

app.post('/admin/sessions-data', (req, res) => {
  const user = resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const allTokens = loadTokens();
  const tokens = Object.fromEntries(Object.entries(allTokens).filter(([, t]) => !t.deleted));
  const perms  = user.permissions || ROLE_PERMISSIONS[user.role] || [];
  const s = (() => { try { return loadSettings(); } catch { return {}; } })();
  res.json({
    tokens, emailLog: loadEmailLog(), revenue: calcRevenue(allTokens),
    customers: loadCustomers(),
    resellers: loadResellers(),
    keys: Object.values(loadKeys()).map(k => ({ key: k.key, productId: k.productId || null, used: !!k.usedBy, customerName: k.customerName || '', customerId: k.customerId || '', usedBy: k.usedBy || null, assignedAt: k.assignedAt || null, addedAt: k.addedAt || null })),
    keyStock: keyStockMap(),
    settings: { currency: s.currency || 'USD', currencySymbol: s.currencySymbol || '$', currencyName: s.currencyName || '', paymentMethods: Array.isArray(s.paymentMethods) ? s.paymentMethods : [] },
    currentUser: { id: user.id, username: user.username, name: user.name, role: user.role, permissions: perms },
  });
});

// ── Instructions ───────────────────────────────────────────────────────────────
app.get('/admin/instructions', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  res.json(loadInstructions());
});
app.post('/admin/instructions/save', (req, res) => {
  const { adminKey, set } = req.body; if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  if (!set || !set.id || !set.name) return res.status(400).json({ error: 'Invalid.' });
  const data = loadInstructions(); data.sets[set.id] = set; saveInstructions(data); res.json({ success: true });
});
app.post('/admin/instructions/delete', (req, res) => {
  const { adminKey, id } = req.body; if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const data = loadInstructions(); delete data.sets[id]; saveInstructions(data); res.json({ success: true });
});

// ── Email config ───────────────────────────────────────────────────────────────
app.post('/admin/email-config', (req, res) => {
  const { adminKey, config } = req.body; if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  saveEmailCfg(config); res.json({ success: true });
});
app.get('/admin/email-config', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const cfg = loadEmailCfg(); res.json({ ...cfg, pass: cfg.pass ? '••••••••' : '' });
});
app.post('/admin/test-email', async (req, res) => {
  const { adminKey, to } = req.body; if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  res.json(await sendEmail({ to, subject: 'DTC — Test Email', html: baseEmail('<h2>✓ Email is working!</h2>'), type: 'test' }));
});
app.post('/admin/send-reminder', async (req, res) => {
  const { adminKey, token, type } = req.body; if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const tokens = loadTokens(); const t = tokens[token];
  if (!t || !t.email) return res.status(400).json({ error: 'No email on record.' });
  if (t.refunded || t.deactivated) return res.status(400).json({ error: 'Subscription is inactive (deactivated or refunded) — reminders are disabled for it.' });
  const expiry = t.subscriptionExpiresAt ? new Date(t.subscriptionExpiresAt) : null;
  const daysLeft = expiry ? Math.ceil((expiry - new Date())/(1000*60*60*24)) : 0;
  const expiryStr = expiry ? expiry.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}) : '—';
  const html = type==='expired' ? expiredTemplate({ customerName:t.customerName, packageType:t.packageType }) : reminderTemplate({ customerName:t.customerName, packageType:t.packageType, expiryDate:expiryStr, daysLeft });
  res.json(await sendEmail({ to: t.email, subject: type==='expired' ? 'Subscription expired — DTC' : `Reminder: ${daysLeft} days left — DTC`, html, type:'manual_'+type, token }));
});

// ── Update a customer record (notes + tags) ──────────────────────────────────────
app.post('/admin/customer/update', (req, res) => {
  const { adminKey, customerId, note, tags, name, email, wechat } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const customers = loadCustomers();
  const c = customers.find(x => x.id === customerId);
  if (!c) return res.status(404).json({ error: 'Customer not found.' });
  if (note  !== undefined) c.note  = note;
  if (tags  !== undefined) c.tags  = Array.isArray(tags) ? tags : [];
  if (name  !== undefined) c.name  = name;
  if (email !== undefined) c.email = email;
  if (wechat!== undefined) c.wechat= wechat;
  saveCustomers(customers);
  res.json({ success: true, customer: c });
});

// ── One-click backup & restore ────────────────────────────────────────────────
const BACKUP_FILES = {
  'tokens.json': TOKENS_FILE, 'customers.json': CUSTOMERS_FILE, 'products.json': PRODUCTS_FILE,
  'settings.json': SETTINGS_FILE, 'keys.json': KEYS_FILE, 'payments.json': PAYMENTS_FILE,
  'instructions.json': INSTRUCTIONS_FILE, 'landingContent.json': LANDING_FILE,
  'emailTemplates.json': TEMPLATES_FILE, 'notifications.json': NOTIFY_FILE, 'emailLog.json': EMAIL_LOG,
};
app.get('/admin/backup', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const files = {};
  for (const [name, p] of Object.entries(BACKUP_FILES)) {
    try { if (fs.existsSync(p)) files[name] = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {}
  }
  const bundle = { app: 'dtcmodular', version: 1, exportedAt: new Date().toISOString(), files };
  res.setHeader('Content-Disposition', `attachment; filename="dtc-backup-${new Date().toISOString().slice(0,10)}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(bundle, null, 2));
});
app.post('/admin/restore', (req, res) => {
  const { adminKey, backup } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  if (!backup || !backup.files || typeof backup.files !== 'object') return res.status(400).json({ error: 'Invalid backup file.' });
  let restored = 0;
  for (const [name, content] of Object.entries(backup.files)) {
    if (!BACKUP_FILES[name]) continue; // only known files
    try { fs.writeFileSync(BACKUP_FILES[name], JSON.stringify(content, null, 2)); restored++; } catch (e) {}
  }
  res.json({ success: true, restored });
});

// ── Email Templates CRUD ──────────────────────────────────────────────────────
app.get('/admin/email-templates', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  res.json(loadTemplates());
});
app.post('/admin/email-templates/save', (req, res) => {
  const { adminKey, template } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  if (!template || !template.id || !template.name || !template.subject || !template.body)
    return res.status(400).json({ error: 'All fields required.' });
  const data = loadTemplates();
  const idx  = data.templates.findIndex(t => t.id === template.id);
  template.lastModified = new Date().toISOString();
  if (idx >= 0) data.templates[idx] = template; else data.templates.push(template);
  saveTemplates(data);
  res.json({ success: true });
});
app.post('/admin/email-templates/delete', (req, res) => {
  const { adminKey, id } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const data = loadTemplates();
  data.templates = data.templates.filter(t => t.id !== id);
  saveTemplates(data);
  res.json({ success: true });
});

// ── Bulk email send ────────────────────────────────────────────────────────────
app.post('/admin/bulk-email', async (req, res) => {
  const { adminKey, templateId, customSubject, customBody, recipientFilter, tokenList, customEmails } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });

  const cfg = loadEmailCfg();
  if (!cfg.host || !cfg.user || !cfg.pass)
    return res.status(400).json({ error: 'Email is not configured. Go to Email Config first.' });

  // Resolve template
  let subject = customSubject || '';
  let body    = customBody    || '';
  if (templateId) {
    const data = loadTemplates();
    const tmpl = data.templates.find(t => t.id === templateId);
    if (tmpl) { subject = subject || tmpl.subject; body = body || tmpl.body; }
  }
  if (!subject || !body) return res.status(400).json({ error: 'Subject and body are required.' });

  // Build recipient list
  const tokens  = loadTokens();
  let recipients = [];

  if (tokenList && tokenList.length) {
    // Specific tokens selected by admin
    recipients = tokenList.map(tok => tokens[tok]).filter(t => t && t.email);
  } else if (recipientFilter !== 'custom-only') {
    // Filter-based
    const filter = recipientFilter || 'all-with-email';
    for (const t of Object.values(tokens)) {
      if (!t.email) continue;
      if (filter === 'all-with-email') { recipients.push(t); continue; }
      if (filter === 'activated'   && t.approved)                { recipients.push(t); continue; }
      if (filter === 'expiring'    && t.approved && t.subscriptionExpiresAt) {
        const d = Math.ceil((new Date(t.subscriptionExpiresAt) - new Date())/(1000*60*60*24));
        if (d >= 0 && d <= 30) { recipients.push(t); continue; }
      }
      if (filter === 'expired' && t.approved && t.subscriptionExpiresAt) {
        const d = Math.ceil((new Date(t.subscriptionExpiresAt) - new Date())/(1000*60*60*24));
        if (d < 0) { recipients.push(t); continue; }
      }
      if (filter === 'submitted' && t.used && !t.approved) { recipients.push(t); continue; }
    }
  }

  // Append custom / external recipients (people not in the customer list), de-duplicated by email
  const seen = new Set(recipients.map(t => String(t.email).toLowerCase()));
  if (Array.isArray(customEmails)) {
    for (const c of customEmails) {
      const email = (c && c.email ? String(c.email) : '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
      seen.add(email);
      recipients.push({ email, customerName: (c.name || '').trim(), _custom: true });
    }
  }

  if (!recipients.length) return res.status(400).json({ error: 'No recipients match this filter.' });

  // Send emails one by one (avoid rate limits)
  const results = { sent: 0, failed: 0, errors: [] };
  for (const t of recipients) {
    const personalSubject = applyTemplateVars(subject, t);
    const personalBody    = applyTemplateVars(body, t);
    const html = `<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:#2563eb;padding:20px 28px">
        <div style="font-size:18px;font-weight:700;color:#fff">DTC</div>
        <div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:2px">Digital Tools Corner</div>
      </div>
      <div style="padding:28px;font-size:14px;color:#334155;line-height:1.75">${personalBody}</div>
      <div style="padding:16px 28px;background:#f8faff;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">
        DTC — Digital Tools Corner &nbsp;·&nbsp; <a href="mailto:dtc@dtc1.shop" style="color:#94a3b8">dtc@dtc1.shop</a>
      </div>
    </div>`;
    const r = await sendEmail({ to: t.email, subject: personalSubject, html, type: 'bulk' });
    if (r.ok) results.sent++;
    else { results.failed++; results.errors.push({ email: t.email, error: r.error }); }
    // Small delay between sends to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  res.json({ success: true, ...results, total: recipients.length });
});

// ── Preview bulk email (returns personalised HTML for first recipient) ─────────
app.post('/admin/bulk-email/preview', (req, res) => {
  const { adminKey, templateId, customSubject, customBody, recipientFilter } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });

  let subject = customSubject || '';
  let body    = customBody    || '';
  if (templateId) {
    const data = loadTemplates();
    const tmpl = data.templates.find(t => t.id === templateId);
    if (tmpl) { subject = subject || tmpl.subject; body = body || tmpl.body; }
  }

  // Find a sample recipient
  const tokens = loadTokens();
  const sample = Object.values(tokens).find(t => t.email) || { customerName: 'Ahmed Khan', packageType: 'Claude Pro — 1 Month', email: 'customer@example.com' };

  res.json({
    subject: applyTemplateVars(subject, sample),
    body:    applyTemplateVars(body, sample),
    sampleName: sample.customerName,
  });
});

// ── Update product credentials (push to all approved tokens of same product) ──
app.post('/admin/products/update-credentials', (req, res) => {
  const { adminKey, productId, loginDetails, accessLink } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });

  // Update product file
  const data = loadProducts();
  const prod = data.products.find(p => p.id === productId);
  if (!prod) return res.status(404).json({ error: 'Product not found.' });
  if (loginDetails !== undefined) prod.loginDetails = loginDetails;
  if (accessLink   !== undefined) prod.accessLink   = accessLink;
  saveProducts(data);

  // Push to all active tokens using this product
  const tokens  = loadTokens();
  let updated   = 0;
  for (const [, t] of Object.entries(tokens)) {
    if (t.productId === productId && t.approved) {
      if (loginDetails !== undefined) t.loginDetails = loginDetails;
      if (accessLink   !== undefined) t.accessLink   = accessLink;
      updated++;
    }
  }
  saveTokens(tokens);
  res.json({ success: true, updatedTokens: updated });
});

// ── Settings (currency etc.) ───────────────────────────────────────────────────
app.get('/admin/settings', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  res.json(loadSettings());
});
app.post('/admin/settings', (req, res) => {
  const { adminKey, settings } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const current = loadSettings();
  saveSettings({ ...current, ...settings });
  res.json({ success: true });
});

// ── Resellers list (registry + sales + commission/profit) ───────────────────────
app.get('/admin/resellers', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const registry = loadResellers();
  const tokens = loadTokens();
  const map = {};
  registry.forEach(r => { map[r.id] = { ...r, total: 0, count: 0, activated: 0, commission: 0, refunded: 0 }; });
  for (const t of Object.values(tokens)) {
    if (!t.resellerId) continue;
    if (!map[t.resellerId]) map[t.resellerId] = { id: t.resellerId, name: t.resellerName || t.resellerId, contact: '', commissionType: t.resellerCommissionType || 'percent', commissionValue: Number(t.resellerCommissionValue) || 0, note: '', total: 0, count: 0, activated: 0, commission: 0, refunded: 0 };
    const m = map[t.resellerId];
    m.count++;
    if (t.approved) {
      m.activated++;
      if (t.refunded) { m.refunded++; }
      else {
        const amt = (t.amountReceived != null && t.amountReceived !== '') ? Number(t.amountReceived) : (Number(t.price) || 0);
        m.total += amt;
        m.commission += resellerCommission(t, amt);
      }
    }
  }
  res.json({ resellers: Object.values(map) });
});

// ── Update a reseller (commission / contact / note) ─────────────────────────────
app.post('/admin/reseller/update', (req, res) => {
  const { adminKey, id, name, contact, commissionType, commissionValue, note } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  const list = loadResellers();
  const r = list.find(x => x.id === id);
  if (!r) return res.status(404).json({ error: 'Reseller not found.' });
  if (name           !== undefined) r.name            = name;
  if (contact        !== undefined) r.contact         = contact;
  if (commissionType !== undefined) r.commissionType  = commissionType;
  if (commissionValue!== undefined) r.commissionValue = Number(commissionValue) || 0;
  if (note           !== undefined) r.note            = note;
  saveResellers(list);
  res.json({ success: true, reseller: r });
});

// ── Notifications ──────────────────────────────────────────────────────────────
app.get('/admin/notification', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  res.json(loadNotify());
});
app.post('/admin/notification', (req, res) => {
  const { adminKey, enabled, message, type } = req.body; if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  saveNotify({ enabled: !!enabled, message: message || '', type: type || 'info' }); res.json({ success: true });
});

// ── Landing page content (public read, admin write) ───────────────────────────
app.get('/api/landing-content', (req, res) => {
  try { res.json(loadLanding()); }
  catch(e) { res.json({}); }
});
app.get('/admin/landing-content', (req, res) => {
  if (!isAdmin(req.query.adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  try { res.json(loadLanding()); }
  catch(e) { res.json({}); }
});
app.post('/admin/landing-content', (req, res) => {
  const { adminKey, content } = req.body;
  if (!isAdmin(adminKey)) return res.status(401).json({ error: 'Unauthorized' });
  if (!content || typeof content !== 'object') return res.status(400).json({ error: 'Invalid content.' });
  const current = (() => { try { return loadLanding(); } catch(e) { return {}; } })();
  saveLanding({ ...current, ...content });
  res.json({ success: true });
});

// ── Pages ──────────────────────────────────────────────────────────────────────
// ── Customer self-service portal (email + OTP / magic link) ──────────────────────
const portalCodes = new Map(); // email -> { otp, magic, expires }
function portalSubStatus(t) {
  if (t.refunded)            return 'Refunded';
  if (t.deactivated)         return 'Inactive';
  if (t.declined)            return 'Declined';
  if (t.approved) {
    if (t.subscriptionExpiresAt && new Date(t.subscriptionExpiresAt) < new Date()) return 'Expired';
    return 'Active';
  }
  if (t.used) return 'Processing';
  return 'Pending';
}
function portalSubs(email) {
  const tokens = loadTokens();
  return Object.values(tokens)
    .filter(t => t.email && String(t.email).toLowerCase() === email.toLowerCase())
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map(t => ({
      // NOTE: deliberately NO payment method, NO times (date only), NO orgId, NO session data
      product:       t.productName || t.portalName || t.product || 'Subscription',
      package:       t.packageType || '',
      status:        portalSubStatus(t),
      amount:        (t.amountReceived != null && t.amountReceived !== '') ? Number(t.amountReceived) : (Number(t.price) || 0),
      currencySymbol: t.currencySymbol || '$',
      orderDate:     t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : '',
      activatedDate: t.approvedAt ? new Date(t.approvedAt).toISOString().slice(0, 10) : '',
      expiryDate:    t.subscriptionExpiresAt ? new Date(t.subscriptionExpiresAt).toISOString().slice(0, 10) : '',
    }));
}
const portalOtpEmail = (otp, link) => `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
    <h2 style="color:#1e293b;margin:0 0 8px">Your access code</h2>
    <p style="color:#475569;font-size:14px">Use this code to view your subscriptions. It expires in 15 minutes.</p>
    <div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#2563eb;background:#eff6ff;border-radius:10px;padding:16px;text-align:center;margin:14px 0">${otp}</div>
    <p style="color:#475569;font-size:14px">Or just click this link to open your portal directly:</p>
    <p><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700">View my subscriptions →</a></p>
    <p style="color:#94a3b8;font-size:12px;margin-top:18px">If you didn't request this, you can ignore this email.</p>
  </div>`;

app.post('/api/portal/request-otp', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  const subs = portalSubs(email);
  if (subs.length) {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const magic = uuidv4();
    portalCodes.set(email, { otp, magic, expires: Date.now() + 15 * 60 * 1000 });
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const base = process.env.BASE_URL || (proto + '://' + req.get('host'));
    const link = `${base}/portal?magic=${magic}&email=${encodeURIComponent(email)}`;
    try { await sendEmail({ to: email, subject: 'Your access code — DTC', html: portalOtpEmail(otp, link), type: 'portal_otp' }); } catch (e) {}
  }
  // Generic response so we don't reveal whether an email exists
  res.json({ ok: true });
});

app.post('/api/portal/verify', (req, res) => {
  let email = (req.body.email || '').trim().toLowerCase();
  const { otp, magic } = req.body;
  let rec = email ? portalCodes.get(email) : null;
  if (!rec && magic) { for (const [e, r] of portalCodes) { if (r.magic === magic) { rec = r; email = e; break; } } }
  if (!rec || rec.expires < Date.now()) return res.status(401).json({ error: 'Your code or link has expired. Please request a new one.' });
  const ok = (magic && magic === rec.magic) || (otp && String(otp).trim() === rec.otp);
  if (!ok) return res.status(401).json({ error: 'Incorrect code. Please check and try again.' });
  portalCodes.delete(email); // one-time use
  res.json({ ok: true, email, subscriptions: portalSubs(email) });
});

app.get('/portal', (req, res) => res.sendFile(path.join(__dirname, 'public', 'portal.html')));

app.get('/submit', (req, res) => res.sendFile(path.join(__dirname, 'public', 'form.html')));


app.get('/admin',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, () => { console.log(`\n✅  DTC — Digital Tools Corner\n🌐  http://localhost:${PORT}\n`); });
