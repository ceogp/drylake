const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, "");
const secret = process.env.CONTINUOUS_WATCH_CRON_SECRET;

if (!appBaseUrl) {
  console.error("APP_BASE_URL is required.");
  process.exit(1);
}

if (!secret) {
  console.error("CONTINUOUS_WATCH_CRON_SECRET is required.");
  process.exit(1);
}

const response = await fetch(`${appBaseUrl}/api/v1/team/security/continuous-watch/run`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
  },
});

const body = await response.text();

if (!response.ok) {
  console.error(`Continuous Watch scheduler failed: HTTP ${response.status}`);
  console.error(body);
  process.exit(1);
}

console.log(body);

export {};
