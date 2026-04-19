#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/xupra-drylake}"
APP_USER="${APP_USER:-xupra}"
APP_GROUP="${APP_GROUP:-xupra}"
RELEASE_TAR="${RELEASE_TAR:?RELEASE_TAR is required}"
ENV_FILE="${ENV_FILE:?ENV_FILE is required}"
DB_NAME="${DB_NAME:?DB_NAME is required}"
DB_USER="${DB_USER:?DB_USER is required}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}"
LEGACY_IP_HOST="${LEGACY_IP_HOST:-}"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl git build-essential nginx postgresql postgresql-contrib

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$APP_DIR/releases" "$APP_DIR/shared"
chown -R "$APP_USER:$APP_GROUP" "$APP_DIR"

systemctl enable postgresql
systemctl start postgresql

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASSWORD';"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
fi

release_name="$(date +%Y%m%d%H%M%S)"
release_dir="$APP_DIR/releases/$release_name"
mkdir -p "$release_dir"
tar -xf "$RELEASE_TAR" -C "$release_dir"

cp "$ENV_FILE" "$APP_DIR/shared/.env"
cp "$ENV_FILE" "$release_dir/.env"
chown -R "$APP_USER:$APP_GROUP" "$release_dir" "$APP_DIR/shared/.env"

set -a
source "$APP_DIR/shared/.env"
set +a

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

cat >/etc/systemd/system/xupra-drylake.service <<SERVICE
[Unit]
Description=Xupra DryLake staging app
After=network.target postgresql.service

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
