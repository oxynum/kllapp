# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in KLLAPP, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email: **security@kllapp.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |

## Security Best Practices for Self-Hosting

- Always use HTTPS in production (`AUTH_URL` must be `https://`)
- Set a strong `AUTH_SECRET` (use `openssl rand -hex 32`)
- Keep dependencies updated (Dependabot is configured)
- Use a dedicated PostgreSQL user with limited permissions
- Store secrets in environment variables, never in code
- Enable Redis authentication in production if exposed
