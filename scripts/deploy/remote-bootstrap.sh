#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/xupra-drylake}"
APP_USER="${APP_USER:-xupra}"
APP_GROUP="${APP_GROUP:-xupra}"
RELEASE_TAR="${RELEASE_TAR:?RELEASE_TAR is required}"
ENV_FILE="${ENV_FILE:?ENV_FILE is required}"
DB_NAME="${DB_NAME:-}"
DB_USER="${DB_USER:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
LEGACY_IP_HOST="${LEGACY_IP_HOST:-}"

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

USE_LOCAL_POSTGRES="0"
DATABASE_HOST=""

if [ -n "$DB_NAME" ] || [ -n "$DB_USER" ] || [ -n "$DB_PASSWORD" ]; then
  USE_LOCAL_POSTGRES="1"
fi

if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "DATABASE_URL is required when DB_NAME, DB_USER, or DB_PASSWORD is not provided." >&2
    exit 1
  fi

  mapfile -t db_parts < <(node -e "
const input = process.env.DATABASE_URL || '';
const parsed = new URL(input);
if (!parsed.protocol.startsWith('postgres')) process.exit(2);
const dbName = decodeURIComponent(parsed.pathname.replace(/^\\/+/, ''));
const dbUser = decodeURIComponent(parsed.username || '');
const dbPassword = decodeURIComponent(parsed.password || '');
const dbHost = parsed.hostname || '';
if (!dbName || !dbUser || !dbPassword) process.exit(3);
console.log(dbName);
console.log(dbUser);
console.log(dbPassword);
console.log(dbHost);
")

  if [ "${#db_parts[@]}" -lt 3 ]; then
    echo "Failed to parse DB_NAME, DB_USER, and DB_PASSWORD from DATABASE_URL." >&2
    exit 1
  fi

  DB_NAME="${DB_NAME:-${db_parts[0]}}"
  DB_USER="${DB_USER:-${db_parts[1]}}"
  DB_PASSWORD="${DB_PASSWORD:-${db_parts[2]}}"
  DATABASE_HOST="${db_parts[3]:-}"
fi

if [ -z "$DATABASE_HOST" ] && [ -n "${DATABASE_URL:-}" ]; then
  DATABASE_HOST="$(node -e "const parsed = new URL(process.env.DATABASE_URL || ''); process.stdout.write(parsed.hostname || '');")"
fi

if [ "$DATABASE_HOST" = "127.0.0.1" ] || [ "$DATABASE_HOST" = "localhost" ] || [ "$DATABASE_HOST" = "::1" ]; then
  USE_LOCAL_POSTGRES="1"
fi

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$APP_DIR/releases" "$APP_DIR/shared" "$APP_DIR/shared/storage"
chown -R "$APP_USER:$APP_GROUP" "$APP_DIR"

prune_release_directories 1
cleanup_npm_cache

if [ "$USE_LOCAL_POSTGRES" = "1" ]; then
  apt-get install -y postgresql postgresql-contrib
  systemctl enable postgresql
  systemctl start postgresql

  sudo -u postgres psql -v ON_ERROR_STOP=1 --set=db_user="$DB_USER" --set=db_password="$DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_password')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'db_user'
) \gexec
SQL

  sudo -u postgres psql -v ON_ERROR_STOP=1 --set=db_name="$DB_NAME" --set=db_user="$DB_USER" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'db_user')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'db_name'
) \gexec
SQL
fi

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

if [ -n "$marketing_host" ]; then
  server_names="$server_names $marketing_host www.$marketing_host"
  certificate_name="$marketing_host"
fi

certificate_dir="/etc/letsencrypt/live/$certificate_name"
certificate_fullchain="$certificate_dir/fullchain.pem"
certificate_privkey="$certificate_dir/privkey.pem"

sudo -u "$APP_USER" bash -lc "cd '$release_dir' && set -a && source ./.env && set +a && npm ci --include=dev && npx tsx scripts/prisma/render-schema.ts postgresql prisma/schema.runtime.prisma && npx prisma generate --schema prisma/schema.runtime.prisma && npx prisma db push --schema prisma/schema.runtime.prisma && npx tsx prisma/seed.ts && npm run build"

ln -sfn "$release_dir" "$APP_DIR/current"
release_activated="1"
prune_release_directories 2
cleanup_npm_cache
rm -f -- "$RELEASE_TAR" "$ENV_FILE"

service_after="network.target"
if [ "$USE_LOCAL_POSTGRES" = "1" ]; then
  service_after="$service_after postgresql.service"
fi

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

if [ -n "$LEGACY_IP_HOST" ]; then
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
