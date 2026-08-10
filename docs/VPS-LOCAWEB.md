# VPS Locaweb — API BR Football

Guia para colocar a **API Python** (`/api/*`) na VPS Locaweb, com HTTPS, enquanto o **site** continua em `brfut.com.br` (GitHub Pages).

## Arquitetura recomendada

| Componente | Onde | URL |
|------------|------|-----|
| Front (HTML/JS/CSS) | GitHub Pages | `https://brfut.com.br` |
| API (auth, saves, stats) | VPS Locaweb | `https://api.brfut.com.br` |
| Dados (usuários/saves) | Disco da VPS | `/var/lib/brfut/data` |

O front chama a API via `BRFUT_API_ORIGIN` (build). O login comum e o Google criam uma sessão em cookie `HttpOnly`, `Secure` e `SameSite=None`; o JavaScript não recebe nem armazena o token. O header `Authorization: Bearer …` existe apenas durante a migração automática de sessões antigas.

---

## O que você precisa ter em mãos

1. **IP público** da VPS (painel Locaweb)
2. **SSH** como root (ou sudo): `ssh root@SEU_IP`
3. **Client ID Google** (mesmo do ambiente local)
4. Acesso ao **Registro.br** (DNS de `brfut.com.br`)

---

## 1. DNS (Registro.br)

Crie um registro **A**:

| Nome | Tipo | Valor |
|------|------|-------|
| `api` | A | IP da VPS |

Resultado: `api.brfut.com.br` → VPS. Propagação: alguns minutos até 24 h.

O domínio principal (`brfut.com.br`) **permanece** apontando para GitHub Pages — não altere os registros atuais do site.

---

## 2. Bootstrap na VPS (Ubuntu)

Conecte na VPS e rode:

```bash
curl -fsSL https://raw.githubusercontent.com/VinaoGamez/BRFut/main/deploy/setup-vps-locaweb.sh -o setup-vps-locaweb.sh
bash setup-vps-locaweb.sh
```

Ou, se já clonou o repo:

```bash
cd /opt/brfut && bash deploy/setup-vps-locaweb.sh
```

O script instala `python3`, `nginx`, `certbot`, `ufw`, cria usuário `brfut`, clona o repo em `/opt/brfut` e prepara systemd + nginx.

---

## 3. Variáveis de ambiente

Edite `/etc/brfut/brfut.env` (modelo: `scripts/brfut-production.env.example`):

```bash
nano /etc/brfut/brfut.env
```

| Variável | Exemplo |
|----------|---------|
| `BRFUT_DATA_DIR` | `/var/lib/brfut/data` |
| `BRFUT_GOOGLE_CLIENT_ID` | `123….apps.googleusercontent.com` |
| `BRFUT_CORS_ORIGINS` | `https://brfut.com.br,https://www.brfut.com.br,https://vinaogamez.github.io` |

---

## 4. HTTPS (Let's Encrypt)

Depois do DNS de `api` propagar:

```bash
certbot --nginx -d api.brfut.com.br
systemctl start brfut-api
systemctl reload nginx
```

Teste:

```bash
curl -s https://api.brfut.com.br/api/health | python3 -m json.tool
```

Deve retornar `"ok": true`, `"service": "brfut-api"`, `"googleAuthEnabled": true`.

---

## 5. Front apontando para a API

### GitHub Pages / brfut.com.br (produção)

Build com API na VPS:

```powershell
cd "c:\Users\Vinão\Documents\Matchday-Alpha"
$env:GITHUB_PAGES = "true"
$env:BRFUT_API_ORIGIN = "https://api.brfut.com.br"
npm run build
```

No CI (`.github/workflows/deploy-testers.yml`), `BRFUT_API_ORIGIN` já está definido.

### Testers local 5081

**Não** defina `BRFUT_API_ORIGIN` — o front usa a API embutida no mesmo servidor (`http://127.0.0.1:5081/api/...`).

```powershell
cd "c:\Users\Vinão\Documents\Matchday-Alpha"
Remove-Item Env:GITHUB_PAGES -ErrorAction SilentlyContinue
Remove-Item Env:BRFUT_API_ORIGIN -ErrorAction SilentlyContinue
npm run build
py scripts\tester-server.py --port 5081 --bind 127.0.0.1
```

Se o build local tiver `BRFUT_API_ORIGIN=https://api.brfut.com.br`, o browser bloqueia CORS (`127.0.0.1` não está na VPS).

**Só faça push quando quiser publicar** — a política do projeto é commit/push manual.

---

## 6. Google Cloud Console

Em **Origens JavaScript autorizadas**, confirme:

- `https://brfut.com.br`
- `https://www.brfut.com.br`
- `http://127.0.0.1:5081` (testers local)
- `http://localhost:5081` (opcional)

Não é necessário adicionar `api.brfut.com.br` — o login Google roda no front, não na API.

---

## 7. Operação do serviço

```bash
systemctl status brfut-api
journalctl -u brfut-api -f
systemctl restart brfut-api
```

Atualizar código na VPS:

```bash
cd /opt/brfut
sudo -u brfut git pull
systemctl restart brfut-api
```

Backup dos dados (manual ou automático):

```bash
/usr/local/sbin/backup-brfut-data.sh
# ou tar manual:
tar -czf brfut-data-$(date +%F).tar.gz -C /var/lib/brfut data
```

Após `git pull`, reaplique nginx + backup:

```bash
cd /opt/brfut && bash deploy/apply-vps-security.sh
```

---

## Alternativa: tudo na VPS

Se preferir **um único domínio** (`brfut.com.br` na VPS):

1. Aponte o DNS principal para o IP da VPS.
2. `nginx` serve `dist/` + `proxy_pass /api/` → `127.0.0.1:5081`.
3. Build **sem** `BRFUT_API_ORIGIN` (mesma origem).
4. Deploy do front via `git pull` + `npm run build` na VPS ou rsync do `dist/`.

Arquivos de referência: `deploy/nginx-api.brfut.com.br.conf` (adaptar para site completo).

---

## Checklist de segurança (alpha → produção)

- [x] HTTPS ativo (`api.brfut.com.br`)
- [x] Firewall: só 22, 80, 443
- [x] `brfut.env` com permissão restrita (640, root:brfut)
- [x] Backup periódico de `/var/lib/brfut/data` (`backup-brfut-data.sh` + cron)
- [x] Rate limit no nginx (`deploy/nginx-brfut-rate-limit.conf`)
- [ ] Enforce HTTPS no GitHub Pages (Settings → Pages)
- [ ] SSH por chave (`scripts/setup-vps-ssh-key.ps1`) e senha root trocada

Detalhes: [SECURITY.md](./SECURITY.md)

---

## Troubleshooting

| Problema | Causa provável |
|----------|----------------|
| Login funciona no 5081, não no site | Front publicado sem `BRFUT_API_ORIGIN` ou CORS errado |
| `403` no preflight OPTIONS | Origem ausente em `BRFUT_CORS_ORIGINS` |
| `invalid_client` Google | Typo no Client ID em `/etc/brfut/brfut.env` |
| certbot falha | DNS `api` ainda não aponta para a VPS |
| API não sobe | `journalctl -u brfut-api`; permissões em `/var/lib/brfut` |

---

## Arquivos no repositório

```
deploy/
  brfut-api.service
  nginx-api.brfut.com.br.conf
  nginx-brfut-rate-limit.conf
  nginx-brfut-api-proxy.conf
  backup-brfut-data.sh
  apply-vps-security.sh
  setup-vps-locaweb.sh
scripts/
  brfut-production.env.example
  setup-vps-ssh-key.ps1
  tester-server.py           # --api-only + CORS
docs/
  SECURITY.md
```
