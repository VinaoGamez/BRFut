#!/usr/bin/env bash
# Bootstrap inicial — Ubuntu 22.04/24.04 na VPS Locaweb.
# Rode como root: bash deploy/setup-vps-locaweb.sh
set -euo pipefail

BRFUT_USER=brfut
BRFUT_HOME=/opt/brfut
BRFUT_DATA=/var/lib/brfut/data
BRFUT_ENV=/etc/brfut/brfut.env
REPO_URL="${BRFUT_REPO_URL:-https://github.com/VinaoGamez/BRFut.git}"

echo "==> Pacotes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git python3 nginx certbot python3-certbot-nginx ufw

echo "==> Usuário e pastas"
id -u "$BRFUT_USER" &>/dev/null || useradd --system --home "$BRFUT_HOME" --shell /usr/sbin/nologin "$BRFUT_USER"
mkdir -p "$BRFUT_HOME" /var/lib/brfut /etc/brfut /var/www/certbot
chown -R "$BRFUT_USER:$BRFUT_USER" /var/lib/brfut

if [[ ! -d "$BRFUT_HOME/.git" ]]; then
  echo "==> Clone do repositório"
  git clone "$REPO_URL" "$BRFUT_HOME"
  chown -R "$BRFUT_USER:$BRFUT_USER" "$BRFUT_HOME"
else
  echo "==> Repositório já existe em $BRFUT_HOME — pulando clone"
fi

if [[ ! -f "$BRFUT_ENV" ]]; then
  echo "==> Arquivo de ambiente"
  cp "$BRFUT_HOME/scripts/brfut-production.env.example" "$BRFUT_ENV"
  sed -i "s|BRFUT_DATA_DIR=.*|BRFUT_DATA_DIR=$BRFUT_DATA|" "$BRFUT_ENV"
  chmod 600 "$BRFUT_ENV"
  echo "    Edite $BRFUT_ENV (Google Client ID + CORS) antes de subir o serviço."
fi

mkdir -p "$BRFUT_DATA/profiles" "$BRFUT_DATA/saves" "$BRFUT_DATA/sessions"
chown -R "$BRFUT_USER:$BRFUT_USER" /var/lib/brfut

echo "==> systemd"
cp "$BRFUT_HOME/deploy/brfut-api.service" /etc/systemd/system/brfut-api.service
systemctl daemon-reload
systemctl enable brfut-api

echo "==> nginx"
cp "$BRFUT_HOME/deploy/nginx-brfut-rate-limit.conf" /etc/nginx/conf.d/brfut-rate-limit.conf
mkdir -p /etc/nginx/snippets
cp "$BRFUT_HOME/deploy/nginx-brfut-api-proxy.conf" /etc/nginx/snippets/brfut-api-proxy.conf
cp "$BRFUT_HOME/deploy/nginx-api.brfut.com.br.conf" /etc/nginx/sites-available/brfut-api
ln -sf /etc/nginx/sites-available/brfut-api /etc/nginx/sites-enabled/brfut-api
rm -f /etc/nginx/sites-enabled/default
nginx -t

echo "==> backup"
install -m 750 "$BRFUT_HOME/deploy/backup-brfut-data.sh" /usr/local/sbin/backup-brfut-data.sh
CRON_LINE='15 3 * * * root /usr/local/sbin/backup-brfut-data.sh >> /var/log/brfut-backup.log 2>&1'
grep -Fq 'backup-brfut-data.sh' /etc/crontab 2>/dev/null || echo "$CRON_LINE" >> /etc/crontab

echo "==> Firewall (SSH + HTTP/S)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "Próximos passos (manual):"
echo "  1. DNS: registro A  api.brfut.com.br  ->  IP desta VPS"
echo "  2. Editar $BRFUT_ENV (Client ID Google + CORS)"
echo "  3. certbot --nginx -d api.brfut.com.br"
echo "  4. systemctl start brfut-api && systemctl reload nginx"
echo "  5. curl -s https://api.brfut.com.br/api/health | python3 -m json.tool"
echo ""
echo "Front GitHub Pages: build com BRFUT_API_ORIGIN=https://api.brfut.com.br"
