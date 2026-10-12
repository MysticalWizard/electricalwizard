import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import chalk from 'chalk';
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

app.route('/auth', auth);
app.route('/api/events', events);
app.route('/api', api);

app.get('/health', (c) => c.json({ status: 'ok' }));

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
