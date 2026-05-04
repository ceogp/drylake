#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/xupra-drylake}"
APP_USER="${APP_USER:-xupra}"
APP_GROUP="${APP_GROUP:-xupra}"
RELEASE_TAR="${RELEASE_TAR:?RELEASE_TAR is required}"
ENV_FILE="${ENV_FILE:?ENV_FILE is required}"

export DEBIAN_FRONTEND=noninteractive
set -a
source "$ENV_FILE"
set +a

REQUIRE_HTTPS_URL="${REQUIRE_HTTPS_URL:-true}"

install_node_runtime() {
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
}

prune_release_directories() {
  local keep_latest_count="${1:-2}"
  local current_target=""
  local release_dir_path=""
  local keep_dir=""
  local should_keep=""
  local -a release_dirs=()
  local -a keep_dirs=()

  if [ -L "$APP_DIR/current" ]; then
    current_target="$(readlink -f "$APP_DIR/current" || true)"
  fi

  if [ -n "$current_target" ] && [[ "$current_target" == "$APP_DIR/releases/"* ]]; then
    keep_dirs+=("$current_target")
  fi

  mapfile -t release_dirs < <(find "$APP_DIR/releases" -mindepth 1 -maxdepth 1 -type d | sort)

  while [ "${#release_dirs[@]}" -gt 0 ] && [ "${#keep_dirs[@]}" -lt $((keep_latest_count + 1)) ]; do
    keep_dirs+=("${release_dirs[-1]}")
    unset 'release_dirs[-1]'
  done

  mapfile -t release_dirs < <(find "$APP_DIR/releases" -mindepth 1 -maxdepth 1 -type d | sort)

  for release_dir_path in "${release_dirs[@]}"; do
    should_keep="0"

    for keep_dir in "${keep_dirs[@]}"; do
      if [ "$release_dir_path" = "$keep_dir" ]; then
        should_keep="1"
        break
      fi
    done

    if [ "$should_keep" = "0" ] && [[ "$release_dir_path" == "$APP_DIR/releases/"* ]]; then
      rm -rf -- "$release_dir_path"
    fi
  done
}

cleanup_npm_cache() {
  sudo -u "$APP_USER" npm cache clean --force >/dev/null 2>&1 || true
  rm -rf -- "/home/$APP_USER/.npm/_cacache" 2>/dev/null || true
}

apt-get update
apt-get install -y ca-certificates curl git build-essential nginx

if ! command -v node >/dev/null 2>&1; then
  install_node_runtime
else
  node_major_version="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)"

  if [ "$node_major_version" -lt 22 ]; then
    install_node_runtime
  fi
fi

DATABASE_HOST=""

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required in ENV_FILE." >&2
  exit 1
fi

if ! DATABASE_HOST="$(node -e "const parsed = new URL(process.env.DATABASE_URL || ''); if (!parsed.protocol.startsWith('postgres')) process.exit(2); process.stdout.write(parsed.hostname || '');" 2>/dev/null)"; then
  echo "DATABASE_URL must be a valid PostgreSQL URL." >&2
  exit 1
fi

echo "Using PostgreSQL database host: ${DATABASE_HOST:-unknown}"

# Enforce required production env vars
if [ "${NODE_ENV:-}" = "production" ]; then
  missing_vars=()

  # Auth
  [ -z "${CLERK_SECRET_KEY:-}" ] && missing_vars+=("CLERK_SECRET_KEY")
  [ -z "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}" ] && missing_vars+=("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")

  # Billing
  [ -z "${STRIPE_SECRET_KEY:-}" ] && missing_vars+=("STRIPE_SECRET_KEY")
  [ -z "${STRIPE_WEBHOOK_SECRET:-}" ] && missing_vars+=("STRIPE_WEBHOOK_SECRET")
  [ "${BILLING_ENFORCEMENT_MODE:-}" != "strict" ] && missing_vars+=("BILLING_ENFORCEMENT_MODE=strict")

  # Encryption
  [ -z "${APP_ENCRYPTION_KEY:-}" ] && missing_vars+=("APP_ENCRYPTION_KEY")

  # Admin
  [ -z "${ADMIN_INTERNAL_BASIC_AUTH_USERNAME:-}" ] && missing_vars+=("ADMIN_INTERNAL_BASIC_AUTH_USERNAME")
  [ -z "${ADMIN_INTERNAL_BASIC_AUTH_PASSWORD:-}" ] && missing_vars+=("ADMIN_INTERNAL_BASIC_AUTH_PASSWORD")

  # AI provider
  ai_provider="${AI_PROVIDER:-openai}"
  if [ "$ai_provider" = "kimi" ]; then
    [ -z "${KIMI_API_KEY:-}" ] && missing_vars+=("KIMI_API_KEY (AI_PROVIDER=kimi)")
  else
    [ -z "${OPENAI_API_KEY:-}" ] && missing_vars+=("OPENAI_API_KEY (AI_PROVIDER=openai)")
  fi

  if [ "${#missing_vars[@]}" -gt 0 ]; then
    echo "ERROR: Missing or invalid required production env vars:" >&2
    for var in "${missing_vars[@]}"; do
      echo "  - $var" >&2
    done
    exit 1
  fi

  echo "Production env var validation passed."
fi

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$APP_DIR/releases" "$APP_DIR/shared" "$APP_DIR/shared/storage"
chown -R "$APP_USER:$APP_GROUP" "$APP_DIR"

prune_release_directories 1
cleanup_npm_cache

release_name="$(date +%Y%m%d%H%M%S)"
release_dir="$APP_DIR/releases/$release_name"
release_activated="0"

cleanup_incomplete_release() {
  if [ "$release_activated" != "1" ] && [ -n "${release_dir:-}" ] && [ -d "$release_dir" ] && [[ "$release_dir" == "$APP_DIR/releases/"* ]]; then
    rm -rf -- "$release_dir"
  fi
}

trap cleanup_incomplete_release EXIT

mkdir -p "$release_dir"
tar -xf "$RELEASE_TAR" -C "$release_dir"

app_base_url="${APP_BASE_URL:-}"

if [ -z "$app_base_url" ]; then
  echo "APP_BASE_URL is required in ENV_FILE." >&2
  exit 1
fi

if ! app_base_url_protocol="$(node -e "const input = process.env.APP_BASE_URL || ''; const url = new URL(input); process.stdout.write(url.protocol);" 2>/dev/null)"; then
  echo "APP_BASE_URL must be a valid URL. Received: $app_base_url" >&2
  exit 1
fi

if ! app_base_url_hostname="$(node -e "const input = process.env.APP_BASE_URL || ''; const url = new URL(input); process.stdout.write(url.hostname);" 2>/dev/null)"; then
  echo "APP_BASE_URL must be a valid URL. Received: $app_base_url" >&2
  exit 1
fi

if [ "$REQUIRE_HTTPS_URL" = "true" ]; then
  if [ "$app_base_url_protocol" != "https:" ]; then
    echo "APP_BASE_URL must use https. Received protocol: $app_base_url_protocol" >&2
    exit 1
  fi

  if node -e "const host = process.argv[1] || ''; process.exit(/^\\d{1,3}(\\.\\d{1,3}){3}$/.test(host) ? 0 : 1);" "$app_base_url_hostname"; then
    echo "APP_BASE_URL must use a domain host, not a raw IP ($app_base_url_hostname)." >&2
    exit 1
  fi
fi

cp "$ENV_FILE" "$APP_DIR/shared/.env"
cp "$ENV_FILE" "$release_dir/.env"
chown -R "$APP_USER:$APP_GROUP" "$release_dir" "$APP_DIR/shared/.env"

app_host="$(node -e "const url = new URL(process.env.APP_BASE_URL || 'http://localhost:3000'); process.stdout.write(url.host);")"
marketing_host="$(node -e "const url = new URL(process.env.APP_BASE_URL || 'http://localhost:3000'); const host = url.host; process.stdout.write(host.startsWith('drylake.') ? host.slice('drylake.'.length) : '');")"
server_names="$app_host"
certificate_name="$app_host"
admin_internal_host="${ADMIN_INTERNAL_HOST:-}"

if [ -n "$marketing_host" ]; then
  server_names="$server_names $marketing_host www.$marketing_host"
  certificate_name="$marketing_host"
fi

if [ -n "$admin_internal_host" ] && [ "$admin_internal_host" != "$app_host" ]; then
  server_names="$server_names $admin_internal_host"
fi

certificate_dir="/etc/letsencrypt/live/$certificate_name"
certificate_fullchain="$certificate_dir/fullchain.pem"
certificate_privkey="$certificate_dir/privkey.pem"

sudo -u "$APP_USER" bash -lc "cd '$release_dir' && set -a && source ./.env && set +a && npm ci --include=dev && npx prisma generate && npx prisma migrate deploy && npx tsx prisma/seed.ts && npm run build"

ln -sfn "$release_dir" "$APP_DIR/current"
release_activated="1"
prune_release_directories 2
cleanup_npm_cache
rm -f -- "$RELEASE_TAR" "$ENV_FILE"

service_after="network.target"

cat >/etc/systemd/system/xupra-drylake.service <<SERVICE
[Unit]
Description=Xupra DryLake staging app
After=$service_after

[Service]
Type=simple
User=$APP_USER
Group=$APP_GROUP
WorkingDirectory=$APP_DIR/current
EnvironmentFile=$APP_DIR/shared/.env
Environment=PORT=3000
ExecStart=/usr/bin/env bash -lc 'npm run start'
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

if [ -f "$certificate_fullchain" ] && [ -f "$certificate_privkey" ]; then
cat >/etc/nginx/sites-available/xupra-drylake <<NGINX
server {
  listen 80 default_server;
  server_name $server_names;

  return 301 https://\$host\$request_uri;
}

server {
  listen 443 ssl http2;
  server_name $server_names;

  ssl_certificate $certificate_fullchain;
  ssl_certificate_key $certificate_privkey;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
NGINX

if [ -n "${LEGACY_IP_HOST:-}" ]; then
cat >>/etc/nginx/sites-available/xupra-drylake <<NGINX

server {
  listen 80;
  server_name $LEGACY_IP_HOST;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
NGINX
fi
else
cat >/etc/nginx/sites-available/xupra-drylake <<NGINX
server {
  listen 80 default_server;
  server_name $server_names;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
NGINX
fi

ln -sfn /etc/nginx/sites-available/xupra-drylake /etc/nginx/sites-enabled/xupra-drylake
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl daemon-reload
systemctl enable nginx
systemctl restart nginx
systemctl enable xupra-drylake
systemctl restart xupra-drylake
trap - EXIT
