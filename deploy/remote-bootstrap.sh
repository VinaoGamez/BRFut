#!/usr/bin/env bash
# Bootstrap BR Fut API — rodar como root na VPS (após enviar pasta deploy/ + scripts/).
set -euo pipefail

UPLOAD="${BRFUT_UPLOAD:-/tmp/brfut-upload}"
BRFUT_HOME=/opt/brfut
BRFUT_DATA=/var/lib/brfut/data
BRFUT_ENV=/etc/brfut/brfut.env
BRFUT_USER=brfut
REPO_URL="${BRFUT_REPO_URL:-https://github.com/VinaoGamez/BRFut.git}"

echo "==> Rede"
if ! ping -c1 -W2 8.8.8.8 &>/dev/null; then
  echo "    Sem internet — tentando mirror Ubuntu oficial..."
  sed -i 's|ubuntu-archive.locaweb.com.br|archive.ubuntu.com|g' /etc/apt/sources.list 2>/dev/null || true
  sed -i 's|ubuntu-archive.locaweb.com.br|archive.ubuntu.com|g' /etc/apt/sources.list.d/*.sources 2>/dev/null || true
  sed -i 's|ubuntu-archive.locaweb.com.br|archive.ubuntu.com|g' /etc/apt/sources.list.d/*.list 2>/dev/null || true
fi

echo "==> Pacotes"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git python3 nginx certbot python3-certbot-nginx ufw openssh-server

echo "==> Repositório base"
id -u "$BRFUT_USER" &>/dev/null || useradd --system --home "$BRFUT_HOME" --shell /usr/sbin/nologin "$BRFUT_USER"
mkdir -p "$BRFUT_HOME" /var/lib/brfut /etc/brfut
if [[ ! -d "$BRFUT_HOME/.git" ]]; then
  git clone "$REPO_URL" "$BRFUT_HOME"
fi

echo "==> Código local (upload)"
if [[ -d "$UPLOAD/deploy" ]]; then
  cp -a "$UPLOAD/deploy/"* "$BRFUT_HOME/deploy/" 2>/dev/null || mkdir -p "$BRFUT_HOME/deploy" && cp -a "$UPLOAD/deploy/"* "$BRFUT_HOME/deploy/"
fi
if [[ -f "$UPLOAD/scripts/tester-server.py" ]]; then
  mkdir -p "$BRFUT_HOME/scripts/brfut_api"
  cp -a "$UPLOAD/scripts/tester-server.py" "$BRFUT_HOME/scripts/"
  cp -a "$UPLOAD/scripts/brfut_api/"* "$BRFUT_HOME/scripts/brfut_api/" 2>/dev/null || true
fi
if [[ -f "$UPLOAD/scripts/brfut-production.env.example" ]]; then
  cp "$UPLOAD/scripts/brfut-production.env.example" "$BRFUT_HOME/scripts/"
fi

echo "==> Dados e ambiente"
mkdir -p "$BRFUT_DATA/profiles" "$BRFUT_DATA/saves" "$BRFUT_DATA/sessions"
chown -R "$BRFUT_USER:$BRFUT_USER" /var/lib/brfut
if [[ ! -f "$BRFUT_ENV" ]]; then
  cp "$BRFUT_HOME/scripts/brfut-production.env.example" "$BRFUT_ENV"
  sed -i "s|BRFUT_DATA_DIR=.*|BRFUT_DATA_DIR=$BRFUT_DATA|" "$BRFUT_ENV"
  chmod 640 "$BRFUT_ENV"
  chown root:"$BRFUT_USER" "$BRFUT_ENV"
fi

echo "==> systemd"
cat > /etc/systemd/system/brfut-api.service << 'EOF'
[Unit]
Description=BR Football API (brfut-api)
After=network.target

[Service]
Type=simple
User=brfut
Group=brfut
WorkingDirectory=/opt/brfut
EnvironmentFile=/etc/brfut/brfut.env
Environment=BRFUT_ENV_FILE=/etc/brfut/brfut.env
ExecStart=/usr/bin/python3 /opt/brfut/scripts/tester-server.py --bind 127.0.0.1 --port 5081 --api-only
Restart=on-failure
RestartSec=5
ReadWritePaths=/var/lib/brfut

[Install]
WantedBy=multi-user.target
EOF

echo "==> nginx (HTTP — SSL depois do certbot)"
cat > /etc/nginx/sites-available/brfut-api << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name api.brfut.com.br 177.153.66.13;

    location /api/ {
        proxy_pass http://127.0.0.1:5081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
ln -sf /etc/nginx/sites-available/brfut-api /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

systemctl daemon-reload
systemctl enable brfut-api
systemctl restart brfut-api
systemctl reload nginx

echo ""
echo "==> Health local"
sleep 1
curl -s http://127.0.0.1:5081/api/health | python3 -m json.tool || true
curl -s http://127.0.0.1/api/health | python3 -m json.tool || true
echo ""
echo "IMPORTANTE: edite $BRFUT_ENV com BRFUT_GOOGLE_CLIENT_ID"
echo "DNS: api.brfut.com.br -> $(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo "HTTPS: certbot --nginx -d api.brfut.com.br"
