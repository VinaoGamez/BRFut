# Segurança e gerenciamento de credenciais

## Regra do frontend

Todo valor usado por `vite.config.js` pode aparecer no JavaScript público. Portanto, o
frontend recebe somente configurações públicas, como a origem da API e o Google OAuth
Client ID. Senhas, tokens, chaves privadas e client secrets nunca devem usar variáveis
`VITE_*`, `define` do Vite ou arquivos dentro de `public/`.

- Ative **Enforce HTTPS** em GitHub → BRFut → Settings → Pages.
- O redirect `https-upgrade.js` cobre acessos HTTP diretos.
- A sessão usa cookie `HttpOnly`, `Secure` e `SameSite`; o navegador mantém apenas um
  indicador não secreto para renderizar a interface e nunca recebe o token novo.

## GitHub Actions

- Configurações públicas de build usam GitHub **Variables** no Environment `github-pages`.
- Credenciais futuras devem usar GitHub **Environment Secrets** e somente em jobs de
  backend que não gerem artefatos públicos.
- O workflow executa `npm run security:secrets` antes do build e interrompe a publicação
  se encontrar padrões de segredo de alta confiança.

## VPS/API

- A configuração fica em `/etc/brfut/brfut.env`, fora do repositório.
- O arquivo deve pertencer a `root:brfut` e ter permissão `0640`.
- O serviço usa `UMask=0077`, mantendo perfis, sessões e saves privados por padrão.
- O Google Client ID não é secreto. Se futuramente houver client secret, chave de e-mail,
  banco ou provedor de pagamento, armazenar em variável protegida do serviço ou em um
  secret manager; nunca no repositório.

| Medida | Onde |
|--------|------|
| HTTPS (Let's Encrypt) | nginx `api.brfut.com.br` |
| CORS whitelist | `/etc/brfut/brfut.env` → `BRFUT_CORS_ORIGINS` |
| Rate limit login | nginx `10r/m` em `/api/auth/login`, `register`, `google` |
| Rate limit geral | nginx `120r/m` em `/api/` |
| systemd hardening | `deploy/brfut-api.service` |
| Backup diário | `/usr/local/sbin/backup-brfut-data.sh` |

Aplicar as proteções na VPS após atualizar o repositório:

```bash
cd /opt/brfut && bash deploy/apply-vps-security.sh
```

## SSH

- Prefira chave SSH em vez de senha root: `scripts/setup-vps-ssh-key.ps1`.
- Depois de validar a chave, rotacione/desative a senha administrativa quando possível.
- Mantenha no firewall somente as portas necessárias (22, 80 e 443).

## Pendências conhecidas

- Centralizar logs de segurança e alertas de autenticação.
- Rate limit também no processo Python, como segunda camada além do nginx.
- Avaliar WAF/DDoS na borda conforme o crescimento do serviço.

Detalhes de deploy: [VPS-LOCAWEB.md](./VPS-LOCAWEB.md).

## Resposta a incidente

Se um segredo entrar no Git ou em logs: revogue/rotacione primeiro, remova o valor dos
arquivos e do histórico, invalide sessões relacionadas e só então publique a correção.
Apagar apenas o commit mais recente não torna um segredo seguro novamente.
