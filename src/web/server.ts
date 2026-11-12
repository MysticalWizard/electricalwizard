import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { HTTPException } from 'hono/http-exception';
import chalk from 'chalk';
import mongoose from 'mongoose';
import { config } from '#/config.js';
import { auth } from './routes/auth.js';
import { api } from './routes/api.js';
import { events } from './routes/events.js';

const app = new Hono();

// CSRF protection on mutations
app.use('*', async (c, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) return next();
  const origin = c.req.header('origin');
  if (!origin) {
    return c.text('CSRF rejected — missing Origin header', 403);
  }
  const allowed = new URL(config.webBaseUrl).origin;
  if (origin !== allowed) {
    return c.text('CSRF rejected', 403);
  }
  return next();
});

// Responses carry session-specific data, so browsers and proxies mustn't
// cache them. The event stream sets its own Cache-Control.
app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  if (!c.res.headers.has('Cache-Control')) {
    c.res.headers.set('Cache-Control', 'no-store');
  }
});

app.route('/auth', auth);
app.route('/api/events', events);
app.route('/api', api);

app.get('/health', (c) => c.json({ status: 'ok' }));

// Bad input that Mongoose catches (a malformed ID, a missing required field,
// a value outside an enum) is the client's mistake, not a server error
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  if (err instanceof mongoose.Error.ValidationError) {
    const fields = Object.fromEntries(
      Object.entries(err.errors).map(([path, e]) => [path, e.message]),
    );
    return c.json({ error: 'Invalid input', fields }, 400);
  }
  if (err instanceof mongoose.Error.CastError) {
    return c.json({ error: `Invalid value for ${err.path}` }, 400);
  }
  console.error(`${c.req.method} ${c.req.path} failed:`, err);
  return c.text('Internal Server Error', 500);
});

// Session cookies are encrypted with a key derived from this secret, so a
// guessable one lets anyone holding a cookie crack it offline and forge others
const MIN_SECRET_LENGTH = 32;

export function startWebServer(): void {
  if (config.webSessionSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `WEB_SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters; generate one with \`openssl rand -base64 32\``,
    );
  }

  if (
    process.env.NODE_ENV === 'production' &&
    !config.webBaseUrl.startsWith('https')
  ) {
    console.warn(
      chalk.yellow(
        '  ⚠️  WEB_BASE_URL is not HTTPS in production — session cookies will NOT be marked Secure.',
      ),
    );
  }

  // Only the dashboard's Next server, on this machine, talks to the API
  serve(
    { fetch: app.fetch, hostname: '127.0.0.1', port: config.webPort },
    () => {
      console.log(
        chalk.green(`  API server running on port ${config.webPort}`),
      );
    },
  );
}
