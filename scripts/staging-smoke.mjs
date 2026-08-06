const webUrl = new URL(process.env.STAGING_WEB_URL ?? 'http://127.0.0.1:8080');
const apiUrl = new URL(
  process.env.STAGING_API_HEALTH_URL ?? process.env.STAGING_API_URL ?? 'http://127.0.0.1:3002',
);
const origin = process.env.STAGING_WEB_ORIGIN ?? webUrl.origin;
const timeoutMs = Number(process.env.STAGING_SMOKE_TIMEOUT_MS ?? 10_000);

async function request(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const web = await request(webUrl);
  assert(web.ok, `Web returned HTTP ${web.status}.`);
  const html = await web.text();
  assert(html.includes('<title>La Brecha Oscura</title>'), 'Web title is missing.');
  assert(html.includes('favicon.svg'), 'Web favicon link is missing.');

  const health = await request(new URL('/health', apiUrl));
  assert(health.ok, `API health returned HTTP ${health.status}.`);
  const payload = await health.json();
  assert(payload.status === 'ok', 'API health status is not ok.');
  assert(Number.isInteger(payload.protocolVersion), 'API protocol version is missing.');

  const status = await request(new URL('/api/status', apiUrl), { headers: { Origin: origin } });
  assert(status.ok, `API status returned HTTP ${status.status}.`);
  assert(
    status.headers.get('access-control-allow-origin') === origin,
    'API CORS origin does not match STAGING_WEB_ORIGIN.',
  );

  console.info(
    JSON.stringify({
      web: webUrl.origin,
      api: apiUrl.origin,
      protocolVersion: payload.protocolVersion,
      gameDataVersion: payload.gameDataVersion,
      corsOrigin: origin,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
