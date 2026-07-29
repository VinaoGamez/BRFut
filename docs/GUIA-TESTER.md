# Guia do tester — BR Fut

## Links

| Ambiente | URL |
|---|---|
| Público (GitHub Pages) | https://vinaogamez.github.io/BRFut/home.html |
| Testers local (hardened) | http://127.0.0.1:5081/home.html |
| Dev Vite | http://localhost:5080/home.html |

Na home: **Guia do tester** e **Enviar feedback**. No jogo: Opções → mesma seção.

Deep links: `home.html#guia` · `home.html#feedback`

## Save, slots e sync

- Até **5 slots** por conta; nome automático `{Clube} {Ano}`.
- Carreira em `localStorage` (`brfut-*`) + sync na nuvem se logado.
- Troca de slot: flush do anterior antes de carregar o novo.
- Após deploy: hard refresh (`Ctrl+Shift+R`); limpar `brfut-last-seen-build` para testar alerta de update.
- Histórico de builds: Opções → Consultar.

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
