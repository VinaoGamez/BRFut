# Rodar o BR Fut localmente

A API (`api.brfut.com.br`) está fora do ar e não há VPS. O jogo funciona
inteiramente no navegador com **modo offline**: a tela inicial abre direto e a
carreira fica no `localStorage` da máquina.

## Como rodar

**Duas cliques:**

| Arquivo | O que faz |
|---|---|
| `INICIAR-BRFUT-OFFLINE.bat` | Vite em `:5080` — modo de desenvolvimento, recarrega ao editar |
| `INICIAR-BRFUT-OFFLINE-BUILD.bat` | Gera `dist/` e serve com Python em `:5081` — o mesmo pacote que vai para os testers |

Ambos abrem o navegador sozinhos e verificam as dependências na primeira
execução.

## Por que preciso de variáveis de ambiente

O `vite.config.js` injeta três valores **no momento do build**:

| Variável | Efeito |
|---|---|
| `BRFUT_AUTH_REQUIRED=false` | Deixa de exigir login. Sem isso o jogo trava no boot esperando um servidor que não responde. |
| `BRFUT_API_ORIGIN=` | Sem origem de API, nada tenta sincronizar com a nuvem. |
| `BRFUT_LOCAL_API_TARGET=http://127.0.0.1:9/` | O proxy de `/api` aponta para uma porta fechada: falha na hora em vez de esperar timeout. |

Os `.bat` já definem as três. Para rodar na mão:

```powershell
$env:BRFUT_AUTH_REQUIRED='false'
$env:BRFUT_API_ORIGIN=''
$env:BRFUT_LOCAL_API_TARGET='http://127.0.0.1:9/'
npm run dev
```

## Linha de comando

```powershell
npm install        # so na primeira vez
npm run dev        # Vite em :5080
npm run build      # gera dist/
npm run test:all   # suite completa de testes
```

## Observações

- **Erro de `/api/health` no console é esperado.** O proxy aponta para a porta
  fechada de propósito; é o jogo comprovando que está offline.
- O save fica no navegador (`localStorage`). Limpar os dados do site apaga a
  carreira.
- `INICIAR-BRFUT-LOCAL.bat` agora usa a pasta do próprio arquivo como projeto —
  ele apontava para um caminho fixo que não existe nesta máquina.

## Estado dos testes

No commit `f7e6b7d` a suíte está em **40 de 47 suítes**. As 7 que falham são
pendências conhecidas, não regressões:

`player-card-stats-source`, `competition-rules`, `transfer-division-fit`,
`transfer-division-phase`, `loan-fit`, `loan-buy-option`, `soft-envelope`
