# DTC Activity & Audit Logs

This revision adds a server-recorded audit trail to the admin panel.

## What is recorded

- Administrator sign-in, sign-out and failed access attempts
- Activation link creation, approval, decline, stage changes, edits and deletion
- Subscription deactivation, reactivation and refund changes
- Customer/profile changes
- Product, package, credential, instruction, notification and settings changes
- Product-key addition, assignment, unassignment and deletion
- Payments, resellers, staff accounts and administrator account changes
- Email campaigns, reminders, templates and email configuration changes
- Backup/report exports and restore operations
- Customer portal code requests, sign-ins, product requests and receipt uploads
- Customer activation form submissions and activation-link opens

Each record includes timestamp, actor, affected user or record, action, result, route, IP address, browser/user agent, duration, and sanitised request/response details.

## Security

Passwords, admin keys, OTPs, magic links, sessions, secrets and full activation/product keys are not stored in the audit trail. Sensitive values are redacted or masked.

## Storage

Logs are stored in `data/auditLog.json`. The file is created automatically if it is missing. The default retention is the newest 25,000 events. To change it, set:

```bash
AUDIT_MAX_ENTRIES=10000
```

## Admin filters

The Activity Logs page supports:

- Full-text search
- Performed-by administrator/user filter
- Affected customer/user filter
- Category, action and result filters
- Exact from/to date and time
- Newest/oldest sorting
- 25, 50, 100 or 200 rows per page
- Filtered CSV export

No administrator OTP was added. The existing admin-key login remains unchanged.
