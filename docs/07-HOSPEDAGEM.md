# 07 — Hospedagem e distribuição

## Ambientes

| Ambiente | Como subir | URL |
|----------|------------|-----|
| Dev Vite | `npm run dev` | http://localhost:5080/home.html |
| Testers hardened | `npm run build` + `py scripts\tester-server.py --port 5081` | http://127.0.0.1:5081/home.html |
| GitHub Pages | push → workflow `deploy-testers.yml` | https://vinaogamez.github.io/BRFut/home.html |
| API produção | VPS Locaweb | https://api.brfut.com.br |

**Importante:** build local para 5081 **sem** `GITHUB_PAGES=true` (paths relativos `./assets/`).

---

## Requisitos

| Item | Versão |
|------|--------|
| Node.js | 18+ (Vite 6) |
| Python | 3.x (servidor testers / legado) |
| Navegador | Chrome, Firefox ou Edge recente |

---

## Build de testers

```powershell
cd Matchday-Alpha
Remove-Item Env:GITHUB_PAGES -ErrorAction SilentlyContinue
npm run build
py scripts\tester-server.py --port 5081 --bind 127.0.0.1
```

Confirmar HTTP 200 em `/home.html`. Após mudança de bundle: **Ctrl+Shift+R**.

GitHub Pages rebuild: **1–3 min** após push.

---

## Desenvolvimento

```powershell
npm install
npm run dev
```

Hot reload em http://localhost:5080. Entry jogo: `index.html` → `js/main.js`.

---

## Sem Node (legado)

`INICIAR-JOGO.bat` — Python `http.server 5080` servindo módulos ES nativos.

---

## Rede local (LAN)

1. IP da máquina (`ipconfig`).
2. Compartilhar: `http://192.168.x.x:5080/home.html` (dev) ou `:5081` (testers).
3. Liberar porta no firewall.

---

## Acesso externo temporário

`INICIAR-LINK-EXTERNO.bat` + `scripts/start-tunnel.ps1` (Cloudflare). Apenas demos — URL muda a cada sessão.

---

## Distribuição

1. `npm run build` → pasta `dist/`.
2. Zip ou GitHub Pages.
3. Saves ficam no navegador / nuvem do usuário — **não** viajam com o zip.

---

## Exportar documentação

```bash
pandoc docs/DOCUMENTACAO-COMPLETA.md -o BRFut-Documentacao.pdf --toc -V lang=pt-BR
```

Índice: [INDICE.md](./INDICE.md).

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Porta 5080/5081 em uso | Encerrar processo ou mudar porta no script |
| Página em branco | F12 → erro de chunk; hard refresh; rebuild |
| Save não aparece | Mesmo perfil/navegador; verificar login e slot ativo |
| CORS / `file://` | Usar servidor HTTP, não abrir HTML direto |
| Sync falhou | Ver console `[brfut]`; `probeBackend`; token em localStorage |

---

## Segurança

- Testers 5081: `security/tester-hardening.js`, headers via `tester-server.py`.
- Detalhes: [SECURITY.md](./SECURITY.md).
- Não commitar secrets; API usa token por usuário.

---

## Documentação relacionada

- [Guia tester](./GUIA-TESTER.md)
- [VPS](./VPS-LOCAWEB.md)
