# Monitoring and Error Tracking Setup Guide

This guide explains how to set up monitoring and error tracking for BattleArena production deployment.

## Option 1: Sentry (Recommended for Error Tracking)

### Setup Steps

1. **Create Sentry Account**
   - Sign up at https://sentry.io
   - Create a new project for Next.js

2. **Install Sentry SDK**
```bash
npm install @sentry/nextjs
```

3. **Initialize Sentry**
```bash
npx @sentry/wizard -i nextjs
```

4. **Update .env.production**
Add the Sentry DSN from your Sentry project:
```
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your-auth-token
```

5. **Sentry will automatically configure**
   - Error tracking
   - Performance monitoring
   - Release tracking

## Option 2: Logtail (Recommended for Logging)

### Setup Steps

1. **Create Logtail Account**
   - Sign up at https://betterstack.com/logtail
   - Create a new source

2. **Install Logtail SDK**
```bash
npm install @logtail/node
```

3. **Create logging utility**
```typescript
// src/lib/monitoring/logger.ts
import { Logtail } from "@logtail/node";

const logtail = new Logtail(process.env.LOGTAIL_SOURCE_TOKEN!);

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => {
    logtail.info(message, context);
  },
  error: (message: string, error?: Error, context?: Record<string, unknown>) => {
    logtail.error(message, { error, ...context });
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    logtail.warn(message, context);
  },
};
```

4. **Update .env.production**
```
LOGTAIL_SOURCE_TOKEN=your-logtail-token
```

## Option 3: Vercel Analytics (If deploying to Vercel)

### Setup Steps

1. **Install Vercel Analytics**
```bash
npm install @vercel/analytics
```

2. **Add to layout.tsx**
```typescript
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

## Option 4: Uptime Monitoring

### Setup Steps

1. **UptimeRobot (Free)**
   - Sign up at https://uptimerobot.com
   - Add monitor for your site URL
   - Configure alerts (email, Slack, etc.)

2. **Pingdom (Paid)**
   - Sign up at https://www.pingdom.com
   - Add uptime and performance monitors
   - Configure alerting

## Database Monitoring (Supabase)

Supabase provides built-in monitoring:
- Dashboard: https://supabase.com/dashboard/project/your-project
- Database logs
- Performance metrics
- Storage usage

## Application Health Check

The application already has a health check endpoint. Monitor it:
```
GET /api/health
```

## Recommended Production Stack

For production, we recommend:
1. **Sentry** - Error tracking and performance monitoring
2. **Logtail** - Application logging
3. **UptimeRobot** - External uptime monitoring
4. **Supabase Dashboard** - Database monitoring

## Implementation Example

Complete monitoring setup:

```typescript
// src/lib/monitoring/index.ts
import * as Sentry from "@sentry/nextjs";
import { Logtail } from "@logtail/node";

// Initialize Sentry
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

// Initialize Logtail
const logtail = process.env.LOGTAIL_SOURCE_TOKEN
  ? new Logtail(process.env.LOGTAIL_SOURCE_TOKEN)
  : null;

export const monitoring = {
  captureError: (error: Error, context?: Record<string, unknown>) => {
    Sentry.captureException(error, { extra: context });
    if (logtail) {
      logtail.error(error.message, { error, ...context });
    }
  },
  captureMessage: (message: string, level: "info" | "warning" | "error" = "info") => {
    Sentry.captureMessage(message, { level });
    if (logtail) {
      if (level === "error") logtail.error(message);
      else if (level === "warning") logtail.warn(message);
      else logtail.info(message);
    }
  },
};
```

## Environment Variables

Add these to your .env.production:

```bash
# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your-auth-token

# Logtail
LOGTAIL_SOURCE_TOKEN=your-logtail-token
```

## Testing

Test your monitoring setup:

```bash
# Test error tracking
curl -X POST https://your-domain.com/api/test-error

# Test health check
curl https://your-domain.com/api/health
```
