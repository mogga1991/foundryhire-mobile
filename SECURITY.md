# Security Guide

## Overview

This document outlines the security measures implemented in VerticalHire and best practices for maintaining a secure application.

## Encryption

### OAuth Token and Sensitive Data Encryption

OAuth tokens, SMTP passwords, and other sensitive credentials are encrypted at rest using **AES-256-GCM**.

**Security Features:**
- **AES-256**: Industry-standard symmetric encryption (256-bit key)
- **GCM Mode**: Provides both confidentiality and authenticity
- **Random IV**: Each encryption uses a unique initialization vector
- **Authentication Tag**: Prevents tampering and detects modifications
- **Key Validation**: Enforces proper key length and format
- **Error Masking**: Generic error messages prevent information leakage

**Implementation:**

```typescript
import { encrypt, decrypt } from '@/lib/utils/encryption'

// Encrypt sensitive data before storing
const encryptedToken = encrypt(oauthToken)
await db.insert(emailAccountSecrets).values({ token: encryptedToken })

// Decrypt when needed
const decryptedToken = decrypt(storedToken)
```

**Key Generation:**

```bash
# Generate a new encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use the utility function
node -e "const {generateEncryptionKey} = require('./src/lib/utils/encryption'); console.log(generateEncryptionKey())"
```

**Environment Setup:**

```env
# .env.local
ENCRYPTION_KEY=<64-character-hex-string>
```

### Key Management Best Practices

1. **Never commit keys to version control**
   - Keep `.env.local` in `.gitignore`
   - Use environment variables for all environments

2. **Use different keys per environment**
   - Development: One key
   - Staging: Different key
   - Production: Different key

3. **Rotate keys periodically**
   - Plan for quarterly key rotation
   - Implement key rotation script (future improvement)

4. **Secure key storage**
   - Use secrets management services (AWS Secrets Manager, HashiCorp Vault, etc.)
   - Never share keys via email or chat

5. **Validate on startup**
   ```typescript
   import { validateEncryptionKey } from '@/lib/utils/encryption'

   if (!validateEncryptionKey()) {
     throw new Error('Invalid encryption configuration')
   }
   ```

## Authentication

### Password Security

**Hashing Algorithm:** PBKDF2-SHA512
- **Iterations:** 100,000 (configurable)
- **Salt:** Unique random salt per password
- **Output:** 64-byte (512-bit) hash

**Implementation:**
```typescript
import { hashPassword, verifyPassword } from '@/lib/auth'

// Hashing (during signup)
const hashedPassword = await hashPassword(plainPassword)

// Verification (during login)
const isValid = await verifyPassword(plainPassword, hashedPassword)
```

### Session Management

- **Storage:** Database-backed sessions (not JWT)
- **Cookie:** HTTP-only, Secure (in production), SameSite=Lax
- **Duration:** 30 days
- **Token:** Cryptographically random session token

**Security Benefits:**
- Server-side session revocation
- No sensitive data in client-side tokens
- Protection against XSS attacks (HTTP-only cookies)

## API Security

### Rate Limiting

Implemented using Upstash Redis (production) or in-memory (development).

**Presets:**
- **Strict** (5 req/min): Authentication, payments
- **Standard** (30 req/min): Regular API calls
- **Relaxed** (100 req/min): Read-heavy operations
- **AI** (10 req/5min): Expensive AI operations

**Implementation:**
```typescript
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await rateLimit(request, RateLimitPresets.strict)
  if (rateLimitResult) return rateLimitResult

  // API logic...
}
```

See [RATE_LIMITING.md](./RATE_LIMITING.md) for details.

### Input Validation

**Database-level:**
- Drizzle ORM provides type-safe queries
- Parameterized queries prevent SQL injection

**API-level validation:**
```typescript
// Validate required fields
if (!email || !password) {
  return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
}

// Sanitize and validate email
const sanitizedEmail = email.toLowerCase().trim()
if (!sanitizedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
  return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
}
```

### CORS and Headers

**Security headers** (recommended for production):

```typescript
// middleware.ts or next.config.ts
const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}
```

## Data Protection

### Sensitive Data Handling

**Never log sensitive data:**
```typescript
// Bad
logger.info({ password, token }, 'User login')

// Good
logger.info({ userId }, 'User login successful')
```

**Database column encryption:**
- OAuth tokens: Encrypted via `encrypt()`
- SMTP passwords: Encrypted via `encrypt()`
- Email addresses: Stored in plaintext (needed for queries)
- Phone numbers: Stored in plaintext (needed for queries)

### Email Security

**OAuth preferred over SMTP:**
- OAuth tokens are more secure than passwords
- Support for Gmail and Outlook OAuth
- SMTP fallback available

**Email tracking:**
- Transparent pixels for open tracking
- Link rewriting for click tracking
- Privacy-respecting (no third-party trackers)

## Third-Party API Security

### API Key Storage

All API keys are stored in environment variables, never in code.

```env
ANTHROPIC_API_KEY=sk-ant-...
APOLLO_API_KEY=...
PROXYCURL_API_KEY=...
```

### API Key Rotation

Plan for quarterly rotation of all third-party API keys.

### Usage Monitoring

Track API usage with `apiUsage` table to:
- Prevent quota overruns
- Detect unusual usage patterns
- Monitor costs

## Webhooks

### Webhook Authentication

**Resend webhooks:**
```typescript
// Verify webhook signature
const signature = request.headers.get('svix-signature')
const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

// Verify using Svix or manual HMAC verification
```

**Stripe webhooks:**
```typescript
// Verify Stripe signature
const signature = request.headers.get('stripe-signature')
const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
```

## Environment Variables

### Critical Variables

These environment variables MUST be set for security:

```env
# Encryption (REQUIRED for OAuth/SMTP)
ENCRYPTION_KEY=<64-char-hex-string>

# Database (REQUIRED)
DATABASE_URL=postgresql://...

# Session cookies (auto-generated, but rotate periodically)
# Not explicitly set, handled by session creation
```

### Development vs Production

**Development:**
- Use separate API keys (test/sandbox modes)
- Use separate database
- Use separate encryption key
- Disable HTTPS requirements for local testing

**Production:**
- Use production API keys
- Use production database
- Use strong, unique encryption key
- Enable HTTPS everywhere
- Enable security headers
- Use Redis for rate limiting

## Security Checklist

### Before Deploying to Production

- [ ] All environment variables set correctly
- [ ] ENCRYPTION_KEY is unique and stored securely
- [ ] Different keys used for dev/staging/prod
- [ ] HTTPS enabled and enforced
- [ ] Security headers configured
- [ ] Rate limiting enabled with Redis
- [ ] Webhook secrets configured
- [ ] Database backups enabled
- [ ] Error monitoring enabled (Sentry, etc.)
- [ ] API keys rotated from development keys
- [ ] Console.log statements removed or replaced with logger
- [ ] No sensitive data logged
- [ ] CORS properly configured
- [ ] File upload size limits set
- [ ] Session timeout appropriate (30 days default)

### Ongoing Security

- [ ] Rotate ENCRYPTION_KEY quarterly
- [ ] Rotate third-party API keys quarterly
- [ ] Review and update dependencies monthly
- [ ] Monitor security advisories
- [ ] Review access logs for unusual activity
- [ ] Audit database for orphaned encrypted secrets
- [ ] Test backup restoration process
- [ ] Review and update security headers

## Incident Response

### If Encryption Key is Compromised

1. **Immediate action:**
   - Generate new encryption key
   - Update ENCRYPTION_KEY in all environments
   - Restart all application instances

2. **Re-encrypt existing data:**
   ```typescript
   // Script to re-encrypt all secrets with new key
   // (future improvement - create migration script)
   ```

3. **Revoke OAuth tokens:**
   - Users will need to reconnect email accounts
   - Consider notifying users of security update

4. **Audit access:**
   - Review who had access to the old key
   - Check for unauthorized access during exposure window

### If Database is Compromised

1. **OAuth tokens:** Encrypted, but rotate key as precaution
2. **Passwords:** PBKDF2-hashed, cannot be reversed
3. **User data:** Consider data breach notification requirements
4. **Sessions:** Invalidate all active sessions

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** open a public GitHub issue
2. **Do not** discuss publicly
3. Email security concerns to: [your-security-email]
4. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Future Security Improvements

- [ ] Implement key rotation mechanism
- [ ] Add security audit logging
- [ ] Implement MFA (multi-factor authentication)
- [ ] Add CSP (Content Security Policy) headers
- [ ] Implement automated security scanning (Snyk, Dependabot)
- [ ] Add IP allowlisting for sensitive operations
- [ ] Implement honeypot endpoints for attack detection
- [ ] Add CAPTCHA for signup/login after rate limit
- [ ] Implement session fingerprinting
- [ ] Add email verification for sensitive account changes
