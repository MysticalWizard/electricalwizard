import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import chalk from 'chalk';
import { config } from '@/config.js';
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

export function startWebServer(): void {
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

  serve({ fetch: app.fetch, port: config.webPort }, () => {
    console.log(chalk.green(`  API server running on port ${config.webPort}`));
  });
}
