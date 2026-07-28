#!/usr/bin/env bash
# Aplica hardening nginx + backup na VPS (idempotente). Rode como root após git pull.
set -euo pipefail

BRFUT_HOME="${BRFUT_HOME:-/opt/brfut}"

echo "==> nginx rate limit + proxy snippet"
cp "$BRFUT_HOME/deploy/nginx-brfut-rate-limit.conf" /etc/nginx/conf.d/brfut-rate-limit.conf
mkdir -p /etc/nginx/snippets
cp "$BRFUT_HOME/deploy/nginx-brfut-api-proxy.conf" /etc/nginx/snippets/brfut-api-proxy.conf
cp "$BRFUT_HOME/deploy/nginx-api.brfut.com.br.conf" /etc/nginx/sites-available/brfut-api
ln -sf /etc/nginx/sites-available/brfut-api /etc/nginx/sites-enabled/brfut-api
nginx -t
systemctl reload nginx

echo "==> backup diário"
install -m 750 "$BRFUT_HOME/deploy/backup-brfut-data.sh" /usr/local/sbin/backup-brfut-data.sh
CRON_LINE='15 3 * * * root /usr/local/sbin/backup-brfut-data.sh >> /var/log/brfut-backup.log 2>&1'
grep -Fq 'backup-brfut-data.sh' /etc/crontab 2>/dev/null || echo "$CRON_LINE" >> /etc/crontab

echo "==> health"
curl -s https://api.brfut.com.br/api/health | python3 -m json.tool || curl -s http://127.0.0.1:5081/api/health | python3 -m json.tool
echo "==> Concluído."
