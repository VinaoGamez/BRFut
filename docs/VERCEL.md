# BR Fut na Vercel

O site (Vite) e a API (Python, `api/index.py`) rodam no mesmo projeto Vercel.
Os dados ficam num Postgres Neon. A VPS (`api.brfut.com.br`) foi desativada.

## Arquitetura

| Parte | Onde | Observação |
|---|---|---|
| Site | `dist/` gerado por `npm run build` | `/` redireciona para `/home.html` |
| API | `api/index.py` → `scripts/brfut_api` | todas as rotas `/api/*` |
| Banco | Neon (Postgres), variável `DATABASE_URL` | região `gru1` (São Paulo) |
| Local/testes | SQLite em `<BRFUT_DATA_DIR>/brfut.sqlite3` | sem `DATABASE_URL` |

A camada `scripts/brfut_api/db.py` usa o mesmo SQL nos dois bancos e cria as
tabelas sozinha na primeira conexão.

## Primeira configuração

1. **Projeto**: em vercel.com → *Add New → Project* → importe `VinaoGamez/BRFut`.
   As configurações vêm do `vercel.json` (Vite, saída `dist`, região `gru1`).
2. **Acesso restrito até o lançamento**: *Settings → Deployment Protection →
   Vercel Authentication → All Deployments*. Só quem estiver logado na sua conta
   Vercel (ou tiver um link de compartilhamento) abre o jogo.
3. **Banco**: *Storage → Create Database → Neon*, região **São Paulo (gru1)**,
   conecte ao projeto. Isso cria `DATABASE_URL` automaticamente.
4. **Variáveis opcionais**:
   - `BRFUT_GOOGLE_CLIENT_ID`: ativa o login com Google (adicione a URL da
     Vercel como origem autorizada no Google Cloud Console).
   - `BRFUT_CORS_ORIGINS`: só para apps mobile/desktop em outra origem
     (ex.: `capacitor://localhost,https://localhost`).
5. **Deploy**: qualquer push no GitHub gera um deploy automático.

## Trazer os dados antigos

Contas e saves da VPS (ou da pasta `Documentos/BR Fut`) entram com o
importador, que é idempotente (pode rodar mais de uma vez):

```bash
pip install "psycopg[binary]"
DATABASE_URL="<copie de Settings → Environment Variables>" \
  python scripts/import-legacy-data.py "C:/Users/<você>/Documents/BR Fut"
```

Senhas antigas continuam válidas e são reforçadas (PBKDF2 600 mil iterações)
no primeiro login. Sessões vencidas não são importadas: cada jogador entra de novo.

## Desenvolvimento local

```bash
npm install
py scripts/tester-server.py --port 5081      # API + build, SQLite local
npm run dev                                  # Vite em 5080, proxy /api → 5081
```

Para usar o Postgres localmente, defina `DATABASE_URL` antes de iniciar o servidor.

## Limites da Vercel considerados

- Corpo de requisição/resposta até 4,5 MB: o jogo comprime saves grandes com
  gzip nos dois sentidos (um save de carreira de 540 KB trafega com ~45 KB).
- Sem disco persistente: nada é gravado em arquivo na função.
- Cada instância tem memória própria: o bloqueio de tentativas de login fica no
  banco (`auth_failures`, `rate_counters`), não só em memória.
