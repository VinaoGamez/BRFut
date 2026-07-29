# BR Fut — Índice da documentação

**Produto:** BR Fut (rebrand de Matchday Football)  
**Build de referência:** Alpha V.4.20  
**Repositório:** Matchday-Alpha / BRFut  
**Compositor:** `js/legacy/engine.js` (~7,5k linhas) + ~120 módulos em `js/engine/` e ~32 features em `js/feature/`  
**Última revisão:** Julho 2026

---

## Documentos principais

| Arquivo | Conteúdo |
|---------|----------|
| [DOCUMENTACAO-COMPLETA.md](./DOCUMENTACAO-COMPLETA.md) | **Documento único** — visão integrada (PDF/impressão) |
| [01-VISAO-GERAL.md](./01-VISAO-GERAL.md) | Produto, stack, pontos de entrada |
| [02-ARQUITETURA.md](./02-ARQUITETURA.md) | Camadas, boot, sync, slots |
| [03-MOTORES.md](./03-MOTORES.md) | Mapa dos motores em `js/engine/` |
| [04-ROTINAS-FLUXOS.md](./04-ROTINAS-FLUXOS.md) | Boot, rodada, partida, temporada |
| [05-MODELOS-DADOS.md](./05-MODELOS-DADOS.md) | localStorage, slots, nuvem, entidades |
| [06-INTERFACE.md](./06-INTERFACE.md) | Views, features, modais |
| [07-HOSPEDAGEM.md](./07-HOSPEDAGEM.md) | Dev, build, testers 5081, GitHub Pages |
| [08-JOGADAS-E-RITMO.md](./08-JOGADAS-E-RITMO.md) | Jogadas ao vivo, ritmo, tuning |
| [09-RISCO-QUEBRA-FINANCEIRA.md](./09-RISCO-QUEBRA-FINANCEIRA.md) | Empréstimo, insolvência, demissão |
| [10-ECOSSISTEMA-ECONOMICO.md](./10-ECOSSISTEMA-ECONOMICO.md) | Arrecadação, folha, mercado, feedbacks |

## Arquitetura e modularização

| Arquivo | Conteúdo |
|---------|----------|
| [PLANO-MODULARIZACAO.md](./PLANO-MODULARIZACAO.md) | Histórico das fases A–G + Sync |
| [modularization.md](./modularization.md) | Regras atuais e módulos extraídos |
| [GUIA-TESTER.md](./GUIA-TESTER.md) | Links, fluxo mínimo, feedback |
| [SECURITY.md](./SECURITY.md) | Hardening testers, HTTPS |
| [VPS-LOCAWEB.md](./VPS-LOCAWEB.md) | API nuvem, dados em `/var/lib/brfut/data` |

## Links do jogo

| Ambiente | URL |
|----------|-----|
| Dev Vite | http://localhost:5080/home.html |
| Testers local (hardened) | http://127.0.0.1:5081/home.html |
| GitHub Pages (público) | https://vinaogamez.github.io/BRFut/home.html |

## Comandos rápidos

```powershell
npm install
npm run dev          # Vite 5080
npm run build        # dist/
npm run test:all     # suítes em scripts/
```

Após editar código jogável: rebuild + servidor **5081** (ver regras do projeto).

## Exportar para PDF

```bash
pandoc docs/DOCUMENTACAO-COMPLETA.md -o BRFut-Documentacao.pdf --toc -V lang=pt-BR
```

Ou: abrir `DOCUMENTACAO-COMPLETA.md` no Cursor → preview → imprimir como PDF.
