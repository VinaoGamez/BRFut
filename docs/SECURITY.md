# Segurança — BR Football (alpha)

Referência rápida para produção (`brfut.com.br` + `api.brfut.com.br`).

## Front (GitHub Pages)

1. **Enforce HTTPS** — GitHub → repositório **BRFut** → **Settings** → **Pages** → marque *Enforce HTTPS* (só aparece após DNS e certificado OK).
2. Redirect extra no HTML (`https-upgrade.js`) cobre quem acessa `http://` direto.
3. **Hardening** (`js/security/tester-hardening.js`) ativo em `brfut.com.br` e `*.github.io` (F12/cópia bloqueados em build pública).
4. Tokens de sessão ficam em `localStorage` / `sessionStorage` — risco XSS; não coloque scripts de terceiros no domínio do jogo.

## API (VPS)

| Medida | Onde |
|--------|------|
| HTTPS (Let's Encrypt) | nginx `api.brfut.com.br` |
| CORS whitelist | `/etc/brfut/brfut.env` → `BRFUT_CORS_ORIGINS` |
| Rate limit login | nginx `10r/m` em `/api/auth/login`, `register`, `google` |
| Rate limit geral | nginx `120r/m` em `/api/` |
| systemd hardening | `deploy/brfut-api.service` (`User=brfut`, `ProtectSystem=strict`) |
| Backup diário | `/usr/local/sbin/backup-brfut-data.sh` (cron 03:15 UTC) |

Aplicar/atualizar na VPS após `git pull`:

```bash
cd /opt/brfut && bash deploy/apply-vps-security.sh
```

## SSH

- Preferir **chave** em vez de senha root: `scripts/setup-vps-ssh-key.ps1` (Windows).
- Trocar senha root após migrar para chave.
- Firewall: `ufw` — apenas 22, 80, 443.

## O que ainda não está coberto (alpha)

- Rate limit no código Python (só nginx)
- Rotação automática de sessões comprometidas
- WAF / DDoS na borda (Locaweb)
- Auditoria de logs centralizada

Detalhes de deploy: [VPS-LOCAWEB.md](./VPS-LOCAWEB.md).
