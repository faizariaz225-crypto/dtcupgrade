# Update Guide

This package adds editable system emails, configurable customer OTP behavior, admin animations and the regional customer map.

## Full project package

Upload the complete project when deploying to a new environment or when replacing the whole current project. Back up `data/` first because it contains customer and operational records.

## Update-only package

The update-only package deliberately excludes live JSON data. Copy its files over the matching project paths, then restart the Node.js process.

Changed paths:

- `server.js`
- `portal.html`
- `public/admin.html`
- `public/portal.html`
- `public/css/admin-enhancements.css`
- `public/js/admin-effects.js`
- `public/js/auth.js`
- `public/js/bulk-email.js`
- `public/js/customers.js`
- `public/js/dashboard.js`
- `public/js/email-automation.js`
- `public/js/region-map.js`
- `public/js/shell.js`

After restart, use **Admin → Communications → Email Automation** to configure emails and OTP settings.
