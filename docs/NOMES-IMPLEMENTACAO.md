# Nomes: implementação offline

- Sufixos são uma camada declarada na pool, nunca sobrenomes-base. A variante
  de deduplicação também remove o sufixo anterior antes de montar outra forma.
- Segundo sobrenome brasileiro: parâmetro de projeto de 55%, não uma medição
  populacional. Sufixo: probabilidade de projeto de 5%; entre esses, 10% usam
  primeiro nome + sufixo como forma esportiva. Não implica nome no registro civil.
- Apelidos brasileiros: tentativa de derivação em 1,5% dos sorteios e lista
  curada em 0,1%. A derivação só acontece quando há uma correspondência explícita
  conhecida; nos outros casos o nome continua completo. Portanto a frequência
  efetiva de apelidos não é garantidamente 1,6%. Essas taxas são de projeto.
- A abreviação é aplicada pela célula compartilhada de jogador, consultando o
  elenco atual do clube. Partículas saem; o nome completo fica no tooltip.
  IDs, nomes armazenados, edição e histórico não recebem a abreviação.
- Todas as formas completas são reservadas antes de abreviar, evitando colisões
  com jogadores que ainda serão renderizados. Se necessário, mantém o completo.
  Sem contexto de elenco, mantém o completo por segurança. Fichas individuais,
  mensagens e superfícies que não usam a célula compartilhada mantêm o nome.
- Dados e funções são empacotados pelo Vite, sem consulta de rede em runtime.

Validação:

```text
node scripts/player-name-display-tests.mjs
node scripts/player-names-tests.mjs
node scripts/sufixo-camada-tests.mjs
npm run test:all
npm run build
```

Os testes de exibição incluem a célula real da UI, partículas, colisão com nome
completo posterior, renomeação e preservação da identidade. A validação é Node,
sem substituir um teste visual do aplicativo instalado.
