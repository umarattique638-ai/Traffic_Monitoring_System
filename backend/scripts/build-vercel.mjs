// Builds the Vercel deployment (Build Output API v3) at the repository root: .vercel/output
//   static/                the dashboard (Frontend/dist), served by Vercel's CDN
//   functions/api.func/    the API (src/vercel.ts) bundled into one file, Node 22
//   config.json            /api/* -> the function; everything else -> the dashboard (SPA fallback); crons
// Run after the Frontend build. Vercel runs both (../../vercel.json buildCommand).
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const backend = fileURLToPath(new URL('..', import.meta.url));
const web = fileURLToPath(new URL('../../Frontend/dist/', import.meta.url));
const out = fileURLToPath(new URL('../../.vercel/output/', import.meta.url));

if (!existsSync(`${web}index.html`)) {
  console.error('Frontend/dist is missing: run the Frontend build first.');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}functions/api.func`, { recursive: true });
cpSync(web, `${out}static`, { recursive: true });

await build({
  absWorkingDir: backend,
  entryPoints: ['src/vercel.ts'],
  outfile: `${out}functions/api.func/index.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // The MongoDB driver's OPTIONAL extras (Kerberos, compression, cloud auth, client-side encryption): not used,
  // and the driver loads them inside try/catch, so leaving them out is safe.
  external: ['kerberos', '@mongodb-js/zstd', 'snappy', '@aws-sdk/credential-providers', 'gcp-metadata', 'socks', 'aws4', 'mongodb-client-encryption'],
  // CommonJS packages bundled into ESM still call require(): give them one.
  banner: { js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);" },
  logLevel: 'warning',
});

writeFileSync(
  `${out}functions/api.func/.vc-config.json`,
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 30 }, null, 2),
);

writeFileSync(
  `${out}config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        // Every API path goes to the one function, which puts the original path back (src/vercel.ts).
        { src: '^/api/(.*)$', dest: '/api?__path=/api/$1' },
        { handle: 'filesystem' },
        // Dashboard routes (/login, /dashboard, ...) are client-side: serve index.html.
        { src: '^/(.*)$', dest: '/index.html' },
      ],
      // Vercel sends CRON_SECRET as a Bearer token when that environment variable is set (Hobby: once a day each).
      crons: [
        { path: '/api/v1/internal/health', schedule: '23 1 * * *' },
        { path: '/api/v1/internal/maintenance', schedule: '41 2 * * *' },
        { path: '/api/v1/internal/reconcile', schedule: '17 3 * * *' },
      ],
    },
    null,
    2,
  ),
);
console.log('.vercel/output built (static dashboard + api function)');
