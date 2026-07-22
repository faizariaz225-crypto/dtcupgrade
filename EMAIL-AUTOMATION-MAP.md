# DTC Email Automation, OTP, Motion and Customer Map

## What was added

### Email Automation Center
Open **Admin → Communications → Email Automation**.

From this page an administrator can:

- Enable or pause all automatic email delivery.
- Choose and edit the customer portal OTP email.
- Choose and edit the activation-confirmed email.
- Choose and edit the product-request-approved email.
- Add, remove, enable and edit any number of expiry reminder rules.
- Send a test copy of any template before enabling it.

Every automatic message uses the existing template editor, so its subject and full HTML body can be changed without editing code.

### Available template variables

Common variables:

- `{{name}}`
- `{{email}}`
- `{{wechat}}`
- `{{product}}`
- `{{package}}`
- `{{expiry}}`
- `{{daysLeft}}`

Automation variables:

- `{{otp}}`
- `{{otpDigits}}`
- `{{otpExpiryMinutes}}`
- `{{magicLink}}`
- `{{magicLinkBlock}}`
- `{{activationLink}}`

`{{magicLinkBlock}}` produces the complete customer portal button. When magic-link access is disabled, it becomes empty.

### OTP controls

The portal security settings support:

- 4–8 code digits
- 2–60 minute code expiry
- 10–300 second resend delay
- 3–10 incorrect attempts
- 1–90 day customer portal session duration
- Optional magic-link access

The resend delay and maximum attempts are enforced by the server, not only by the browser interface.

This changes only the **customer portal OTP**. The administrator login remains single-step and does not use OTP.

### Expiry automation

The server checks subscriptions every hour and once shortly after startup.

- `30` means 30 days before expiry.
- `5` means 5 days before expiry.
- `0` means the expiry/expired notice.

The system records which rule was sent for each subscription expiry date. Existing 30-day, 5-day and expired flags are respected during migration so the same old reminder is not sent twice.

### Admin appearance and motion

The Email Automation page also controls:

- Motion level: Off, Subtle, Balanced or Full
- Card hover movement
- Background glow
- Data/table entrance animations

The interface also respects the operating system's reduced-motion preference.

### Animated customer region map

The dashboard contains an animated map with:

- Customer count by country
- Active-customer count
- Assigned and unassigned location totals
- Pulsing regional markers
- Country ranking bars
- Clickable regional details

The map uses customer profile data. It does not guess locations from IP addresses.

To place a customer on the map, open the customer profile and add:

- Country
- Region/state
- City

Existing customers without a country remain under **Location not set** until updated.

## Safe upgrade steps

1. Back up the complete `data` directory.
2. Replace `server.js`, `public/admin.html`, `public/portal.html`, the listed CSS/JS files, and the root `portal.html` where applicable.
3. Do not replace the live `data` directory when using the update-only package.
4. Run `npm install` or `npm ci` in the project directory.
5. Restart the Node.js application.
6. Open the Email Automation page and save the preferred settings.
7. Add country information to customer profiles to populate the map.

The server safely adds the two required system templates only when they are missing. Existing administrator-edited templates are not overwritten.

## Email requirements

Automatic and test emails require a working SMTP configuration in the existing Email Settings page. Test each mapped template before relying on automatic delivery.
