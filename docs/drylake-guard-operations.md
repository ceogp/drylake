# DryLake Guard Operations

## Continuous Watch scheduler

The backend scheduler endpoint is:

```txt
POST /api/v1/team/security/continuous-watch/run
Authorization: Bearer <CONTINUOUS_WATCH_CRON_SECRET>
```

The repo includes a scheduler runner:

```bash
npm run guard:continuous-watch
```

Required environment:

```txt
APP_BASE_URL=https://drylake.xupracorp.com
CONTINUOUS_WATCH_CRON_SECRET=<strong random secret matching production env>
```

GitLab scheduled pipeline support is wired through the `continuous_watch_scheduler` job.

To enable it:

1. Set `APP_BASE_URL` and `CONTINUOUS_WATCH_CRON_SECRET` in CI/CD variables.
2. Create a GitLab pipeline schedule.
3. Set schedule variable `RUN_CONTINUOUS_WATCH=true`.
4. Pick the desired cadence.

For host-level cron, run:

```bash
cd /srv/xupra-drylake/current
APP_BASE_URL=https://drylake.xupracorp.com CONTINUOUS_WATCH_CRON_SECRET=... npm run guard:continuous-watch
```

## Static media

Required static media path:

```txt
public/marketplace/extension/media/
```

Current shipped asset:

```txt
agent-control.gif
```

Current Guard workflow asset:

```txt
guard-security.gif
```

The GIF is generated from the implemented DryLake Guard product flow and can be regenerated with:

```bash
python scripts/generate-guard-security-gif.py
```

The animated flow covers:

1. Open the extension Control Plane.
2. Open Security.
3. Run Guard Scan.
4. Show scanning progress.
5. Show the detailed report sections.
6. Show Copy Summary / Open Report / Fix with AI.
7. Show Deep Cloud Analysis approval if using a paid account.

The generated file lives here:

```txt
public/marketplace/extension/media/guard-security.gif
```

After deployment it is hosted at:

```txt
https://drylake.xupracorp.com/marketplace/extension/media/guard-security.gif
```

After replacing it, run deployment verification with:

```bash
VERIFY_GUARD_SECURITY_GIF=true bash scripts/deploy/verify-deploy.sh
```

Local readiness check:

```bash
npm run guard:readiness
```

Release-enforced readiness check:

```bash
REQUIRE_GUARD_SECURITY_GIF=true npm run guard:readiness
```

The verify script always checks:

```txt
/marketplace/extension/media/agent-control.gif
```

It checks `guard-security.gif` when the file exists locally or `VERIFY_GUARD_SECURITY_GIF=true`.
