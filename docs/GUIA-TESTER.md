# Guia do tester — Matchday Football Alpha

## Links

| Ambiente | URL |
|---|---|
| Público (GitHub Pages) | https://vinaogamez.github.io/BRFut/home.html |
| Testers local (hardened) | http://127.0.0.1:5081/home.html |
| Dev Vite | http://localhost:5080/home.html |

Na home: **Guia do tester** e **Enviar feedback**. No jogo: Opções → mesma seção.

Deep links: `home.html#guia` · `home.html#feedback`

## Save e updates

- Carreira só neste navegador (`localStorage`).
- Após deploy: hard refresh (`Ctrl+Shift+R`).
- Histórico de builds: Opções → Consultar.
- Popup de nova build: só quando o autor liberar (`promptUpdate` na release note).

## Fluxo mínimo

1. Novo Jogo → Central → Táticas → Partida ao vivo → Mensagens  
2. Calendário / treinos · Escritório · Estádio  
3. Série D (grupos + mata-mata) e Copa do Brasil  
4. Fim de temporada (premiação por fase na D e na Copa)

## Feedback

Use o formulário na home/Opções:

1. Preencha categoria, severidade, área, título e descrição  
2. **Copiar relatório** ou **Abrir issue no GitHub**  
3. O relatório já inclui build, URL, user-agent e resumo da carreira  

Template GitHub: `.github/ISSUE_TEMPLATE/tester-feedback.yml`
