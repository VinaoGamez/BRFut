/**
 * Notas exibidas no alerta de atualização para testers.
 * Estilo: linguagem simples, só o que o jogador precisa saber.
 * Evitar detalhes técnicos, números de calibração e jargão de motor.
 *
 * Modal popup na entrada: só se `promptUpdate: true` na entrada da build atual
 * (ativar apenas quando o autor pedir anúncio aos testers).
 * Histórico manual: Opções → Consultar.
 */
export const RELEASE_NOTES = [
  {
    version: 'Alpha V.4.35',
    date: '2026-07-29',
    publishedAt: '2026-07-29T14:45:00-04:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Home',
        items: [
          'Contadores da home com base discreta (~10 ON / ~55 cadastros) que somam os usuários reais e crescem leve por dia.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.4.30',
    date: '2026-07-29',
    publishedAt: '2026-07-29T14:40:00-04:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Home',
        items: [
          'Contadores de jogadores online e cadastrados na home com vitrine mais atrativa para novos visitantes.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.4.25',
    date: '2026-07-29',
    publishedAt: '2026-07-29T14:35:00-04:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Site',
        items: [
          'Manutenção encerrada — home e jogo liberados normalmente.',
        ],
      },
      {
        label: 'Premiação e campeões',
        items: [
          'Participação nacional com rótulo claro e premiação estadual no balanço de fim de temporada.',
          'Troféus dos campeões voltam ao layout clássico e não somem mais ao trocar de torneio.',
        ],
      },
      {
        label: 'Olheiros',
        items: [
          'Manutenção dos olheiros ligada à comissão técnica e à classe do olheiro.',
          'Custo de viagem ao buscar talentos, conforme a região de origem e destino.',
          'Linha própria de Olheiros no fluxo de caixa do Escritório.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.4.20',
    date: '2026-07-29',
    publishedAt: '2026-07-30T01:55:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Manutenção',
        items: [
          'Servidor em manutenção — acesso ao jogo e login temporariamente fechados.',
          'Saves locais e de nuvem resetados para validação do novo sistema de múltiplas carreiras.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.4.15',
    date: '2026-07-29',
    publishedAt: '2026-07-30T01:20:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Rodada',
        items: [
          'Corrigido loop em que a mesma rodada repetia após AVANÇAR no pós-jogo.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.4.10',
    date: '2026-07-29',
    publishedAt: '2026-07-30T01:10:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Copa do Mundo',
        items: [
          'Corrigido travamento ao clicar AVANÇAR no pós-jogo da seleção.',
          'Gols da seleção passam a aparecer com o nome correto no relatório ao vivo.',
        ],
      },
      {
        label: 'Salvamento',
        items: [
          'Autosave por rodada grava de forma confiável após cada partida (incluindo CMU).',
          'Botão SALVAR mostra mensagens mais claras (local, nuvem ou memória cheia).',
          'Corrigido loop em que a mesma rodada repetia após compactação do save.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.4.05',
    date: '2026-07-29',
    publishedAt: '2026-07-30T00:45:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Treinos',
        items: [
          'Corrigido destaque visual ao escolher foco Juvenis nos dias livres.',
          'Treino Juvenis passa a valer para elenco U-20 contratado e talentos em relatórios de olheiro.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.4.00',
    date: '2026-07-29',
    publishedAt: '2026-07-30T00:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Treinos',
        items: [
          'Corrigido erro ao abrir a rotina de treinos (tela de calendário travava).',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.95',
    date: '2026-07-29',
    publishedAt: '2026-07-30T00:20:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Treinos',
        items: [
          'Novo foco Juvenis nos dias livres — evolui o elenco da Categoria de Base.',
          'Opção aparece quando a base está desbloqueada e há jogadores no Sub-20.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.90',
    date: '2026-07-29',
    publishedAt: '2026-07-30T00:10:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Save na nuvem',
        items: [
          'Logado na conta, o jogo guarda o save completo na VPS e mantém só um resumo leve no navegador.',
          'Isso reduz erros de cota do localStorage — ao recarregar, o progresso vem da nuvem.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.85',
    date: '2026-07-29',
    publishedAt: '2026-07-29T23:40:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Save na nuvem',
        items: [
          'Corrigido erro "Failed to fetch" ao salvar durante o jogo — sync usa keepalive só ao fechar a aba.',
          'Testers no 5081 passam a usar a API local automaticamente, sem conflito de CORS.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.80',
    date: '2026-07-29',
    publishedAt: '2026-07-29T23:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Convites CMU',
        items: [
          'Cada proposta semanal traz 3 seleções para escolher.',
          'Layout do popup: bandeiras retangulares, tabela em azul claro e botões alinhados.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.75',
    date: '2026-07-29',
    publishedAt: '2026-07-29T23:10:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Convites CMU',
        items: [
          'Corrigido erro ao aceitar/negar convite de seleção (persistência da temporada).',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.70',
    date: '2026-07-29',
    publishedAt: '2026-07-29T23:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Correção crítica de boot',
        items: [
          'Corrigido erro que impedia o jogo de iniciar (convites para seleção CMU).',
          'Redirect HTTP→HTTPS sem script inline — compatível com CSP do site.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.65',
    date: '2026-07-29',
    publishedAt: '2026-07-29T22:45:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Novo Jogo e save na nuvem',
        items: [
          'Correção ao iniciar Novo Jogo: a nuvem não reidrata mais temporada ou carreira antiga por cima da nova.',
          'Temporada órfã (seed diferente) é descartada no boot — evita meta, orçamento e partidas de save anterior.',
          'Placeholders demo (Atlético Fênix / Rodada 14) removidos do HTML inicial.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.60',
    date: '2026-07-29',
    publishedAt: '2026-07-29T22:35:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Carregamento do save',
        items: [
          'Correção ao abrir o jogo após atualização: o dashboard passa a carregar com os dados da sua carreira antes de aparecer na tela, sem misturar clube demo com o save real.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.55',
    date: '2026-07-29',
    publishedAt: '2026-07-29T03:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Convites para seleções (CMU)',
        items: [
          'Propostas deixam a caixa de mensagens e viram popup na data — 1ª em março, depois +1 por semana, até 3 seleções diferentes.',
          'Tela com troféu, contador de propostas restantes, Aceitar, Ver Time e Negar todos.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.50',
    date: '2026-07-29',
    publishedAt: '2026-07-29T02:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Campeonatos estaduais',
        items: [
          'Hub de Estaduais libera visualização de todos os 27 estados — save parcial na nuvem não bloqueia mais os demais campeonatos.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.45',
    date: '2026-07-29',
    publishedAt: '2026-07-29T01:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Save / nuvem',
        items: [
          'Merge local+nuvem combina temporada sem perder rodada estadual — checkpoint enxuto não sobrescreve mais o save completo.',
          'Quota do navegador não apaga mais stateLeagues; progresso estadual gravado em stateLeagueProgressRound.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.40',
    date: '2026-07-29',
    publishedAt: '2026-07-29T00:10:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Save / estadual',
        items: [
          'Hard refresh não volta mais para Rodada 1 — merge na nuvem prioriza rodada estadual e save completo local.',
          'Upload na nuvem mantém calendário estadual inteiro (jogos futuros inclusos).',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.35',
    date: '2026-07-28',
    publishedAt: '2026-07-28T24:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Save na nuvem',
        items: [
          'SALVAR revalida login na API e envia checkpoint compacto (temporada primeiro) — corrige "SÓ LOCAL" / "NUVEM FALHOU".',
          'Botão mostra código do erro (SESSÃO, MUITO GRANDE, ERRO 4xx) quando a nuvem não confirma.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.30',
    date: '2026-07-28',
    publishedAt: '2026-07-28T23:45:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Save na nuvem',
        items: [
          'SALVAR envia versão compacta à API quando o save é grande — corrige "SÓ LOCAL" no brfut.com.br.',
          'Botão indica causa quando falha: SEM LOGIN, SESSÃO ou MUITO GRANDE.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.25',
    date: '2026-07-28',
    publishedAt: '2026-07-28T23:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Save / sessão',
        items: [
          'Hard refresh não apaga mais a carreira nem desloga quando há save ativo — corrige rollback para save antigo na nuvem.',
          'Se precisar relogar após recarregar, o progresso local é preservado e comparado com a nuvem antes de carregar.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.20',
    date: '2026-07-28',
    publishedAt: '2026-07-28T23:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Save / sessão',
        items: [
          'Hard refresh (Ctrl+Shift+R) mantém login e progresso — corrige rollback para Rodada 1 após recarregar a página.',
          'Opções → SALVAR aguarda a nuvem confirmar antes de mostrar "SALVO!" — saves grandes não falham mais em silêncio.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.15',
    date: '2026-07-28',
    publishedAt: '2026-07-28T22:15:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Save / sessão',
        items: [
          'Hard refresh (Ctrl+Shift+R) não desloga mais nem apaga a carreira em andamento.',
          'Modo "Salvar a cada 3 jogos" grava a temporada localmente a cada partida; sync na nuvem continua a cada 3.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.10',
    date: '2026-07-28',
    publishedAt: '2026-07-28T21:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Calendário',
        items: [
          'Após o estadual, times da Série D voltam a ver os jogos nacionais na Central — corrige grupos com número ímpar de clubes que deixavam a agenda vazia.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.05',
    date: '2026-07-28',
    publishedAt: '2026-07-28T20:40:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Central',
        items: [
          'Últimos resultados na dashboard não duplicam mais o jogo recém-disputado.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.3.00',
    date: '2026-07-28',
    publishedAt: '2026-07-28T19:40:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Elenco',
        items: [
          'Alerta verde no menu Elenco só aparece quando algum jogador evolui OVR ou muda de status (lesão, cartão, suspensão).',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.95',
    date: '2026-07-28',
    publishedAt: '2026-07-28T19:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Site',
        items: [
          'Link compartilhado no WhatsApp e redes exibe o título correto do jogo.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.90',
    date: '2026-07-28',
    publishedAt: '2026-07-28T18:35:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Correção',
        items: [
          'Ao confirmar nova carreira, o jogo não volta mais para a tela inicial sem login.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.85',
    date: '2026-07-28',
    publishedAt: '2026-07-28T18:25:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Correção',
        items: [
          'Modal de login permanece aberto ao clicar em COMEÇAR CARREIRA na home.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.80',
    date: '2026-07-28',
    publishedAt: '2026-07-28T18:15:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Entrada no jogo',
        items: [
          'Sem login, o jogo abre a página inicial (home) em vez de pedir conta dentro do simulador.',
          'Login só ao clicar em COMEÇAR CARREIRA na home — como era antes.',
          'Após entrar, use CONTINUAR CARREIRA ou NOVO JOGO para ir ao jogo.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.75',
    date: '2026-07-28',
    publishedAt: '2026-07-28T18:05:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Correção',
        items: [
          'Botão ENTRAR na tela inicial abre o modal de login imediatamente (sem esperar a API).',
          'Modal de conta garantido no DOM e exibido acima da tela de boas-vindas.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.70',
    date: '2026-07-28',
    publishedAt: '2026-07-28T17:55:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Correção',
        items: [
          'Tela de login não fica mais presa em "Carregando…" ao abrir o jogo sem sessão ativa.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.65',
    date: '2026-07-28',
    publishedAt: '2026-07-28T17:45:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Conta e sessão',
        items: [
          'Ao abrir o jogo é preciso entrar na conta; a carreira não carrega mais sozinha do navegador.',
          'Ao fechar a aba a sessão encerra; na volta você loga de novo e o save vem da nuvem.',
          'Opções: botão SAIR para deslogar e voltar à tela inicial.',
        ],
      },
      {
        label: 'Salvamento e opções',
        items: [
          'Opções → Salvamento: a cada rodada, a cada 3 jogos ou só manual, com botão SALVAR.',
          'Ritmo de jogo passa a ser salvo junto com a carreira.',
          'Carreira atual: nome do clube e divisão em linha única, com fonte maior.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.60',
    date: '2026-07-28',
    publishedAt: '2026-07-28T17:15:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Calendário e save',
        items: [
          'Hard refresh não reinicia mais o calendário para o primeiro jogo — a data da carreira acompanha rodadas e jogos já disputados.',
          'Merge com nuvem prioriza rodada e data do calendário antes do timestamp do servidor.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.55',
    date: '2026-07-28',
    publishedAt: '2026-07-28T17:05:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Progresso e interface',
        items: [
          'Salvamento: ao atualizar a página, a rodada não volta mais por conflito com a nuvem.',
          'Menu Elenco: alerta verde no mesmo estilo de Mensagens (sem número, um pouco menor).',
          'Substituições: cabeçalho Pé centralizado com o ícone do pé.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.50',
    date: '2026-07-28',
    publishedAt: '2026-07-28T16:45:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Partida',
        items: [
          'Substituições: coluna Pé após o nome e cansaço com mais espaço entre as barras.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.45',
    date: '2026-07-28',
    publishedAt: '2026-07-28T16:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Elenco e partida',
        items: [
          'Renomear jogador só na seção Elencos; tabela de escalação e substituições sem lápis.',
          'Coluna Pé no Elenco com o mesmo ícone dos cards; substituições com barra de cansaço igual ao Elenco + pé.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.40',
    date: '2026-07-28',
    publishedAt: '2026-07-28T16:10:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Segurança',
        items: [
          'Proteção extra no site brfut.com.br (mesmo nível dos testers públicos).',
          'API com limite de tentativas de login e backup automático dos dados na VPS.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.35',
    date: '2026-07-28',
    publishedAt: '2026-07-28T15:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Site',
        items: [
          'brfut.com.br passa a redirecionar automaticamente para HTTPS — login e API voltam a funcionar.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.30',
    date: '2026-07-28',
    publishedAt: '2026-07-28T14:55:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Conta e nuvem',
        items: [
          'Entrada com ENTRAR na welcome — cadastro, login e Google na conta BR Fut.',
          'Saves na nuvem quando logado (api.brfut.com.br); contagem de cadastros e jogadores ON.',
          'Opção Salvar login no dispositivo ou sessão só até fechar o navegador.',
        ],
      },
      {
        label: 'Site',
        items: [
          'Home e welcome com copy de carreira completa; COMEÇAR CARREIRA na página marketing.',
          'Site em brfut.com.br conectado à API na VPS (HTTPS).',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.25',
    date: '2026-07-27',
    publishedAt: '2026-07-27T18:40:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Site e testers',
        items: [
          'Jogo publicado em brfut.com.br — build corrigido para carregar CSS/JS no domínio próprio.',
          'Repositório renomeado para BRFut; links de feedback e guia atualizados.',
        ],
      },
      {
        label: 'Temporada e hub',
        items: [
          'Tela de campeões no fim de temporada com destaque troféu → escudo e estatísticas do time.',
          'Avançar Semana mais confiável no dashboard (partida pendente, jogo ao vivo e transferências).',
          'Saves de temporada com aviso único quando o navegador enche o armazenamento local.',
        ],
      },
      {
        label: 'Motor',
        items: [
          'Rodadas, copas e calendário extraídos para módulos menores — base para evoluções futuras.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.20',
    date: '2026-07-26',
    publishedAt: '2026-07-26T15:35:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Treinamento com evolução',
        items: [
          'Dias livres: escolha Gestão de Carga (recupera energia) ou Desenvolvimento (evolui Fin, Pas, Mar e Overall).',
          'Sete focos de treino — Finalização, Passes & Visão, Defesa & Desarme, Condução & Velocidade, Jogo aéreo & Físico, Goleiro (se houver) e Individual.',
          'Reservas e jovens evoluem mais rápido; titulares exaustos perdem eficiência — trade-off entre desgaste e crescimento.',
          'Overall recalculado a partir dos atributos treinados, respeitando o Potential (POT).',
          'Relatório semanal de treino ao avançar a semana no Calendário (também na inbox).',
          'Tela de Treinamento reorganizada: plano ativo na sidebar, comparativo Gestão vs Desenvolvimento, pré/pós-jogo simplificados e focos em grade.',
        ],
      },
      {
        label: 'Elenco',
        items: [
          'Nova coluna XP TREINO: barra de progresso por jogador (100 XP ≈ +1 atributo) quando o modo Desenvolvimento está ativo.',
          'Ordenação pela coluna XP; badge +N quando já houve ganho de atributos na temporada.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.15',
    date: '2026-07-26',
    publishedAt: '2026-07-26T07:35:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Categoria de Base (beta)',
        items: [
          'Nova área Categoria de Base no menu — elenco U-20 separado do profissional (até 15 jogadores).',
          'Desbloqueio ao investir na Estrutura do estádio até o nível 3; ao liberar, você já ganha 1 olheiro.',
          'Abas Elenco U-20, Olheiros e Infraestrutura para revelações, captação e upgrades da base.',
          'Olheiros com classes A, B, C e D — quanto melhor a classe, maiores as chances de achar talentos e de qualidade.',
          'Busca manual: escolha região, olheiro e clique em BUSCAR. Missão deixa o olheiro indisponível por 6 meses.',
          'Resultado da missão fica em RELATÓRIOS (não vai para a caixa de mensagens) e expira em 3 semanas.',
          'Na captação, contrate ou descarte os jovens indicados. Promoção para o elenco principal a partir dos 17 anos.',
        ],
      },
      {
        label: 'Elenco e contratos',
        items: [
          'Nova janela GESTÃO DE CONTRATOS no Elenco — renovações com aceitar/recusar direto na tela.',
          'Bolinha amarela no menu Elenco quando houver contrato a vencer ou vencido.',
          'Linhas do elenco continuam destacadas (azul, laranja, vermelho) conforme a situação do contrato.',
        ],
      },
      {
        label: 'Seleção (CMU)',
        items: [
          'Em anos de Copa do Mundo, a partir de maio você recebe convites para comandar uma seleção (3 propostas na inbox).',
          'Campeonatos e Tabela de Jogos mostram a CMU quando você comanda a seleção.',
          'Renovações do clube deixam de encher a inbox enquanto você está na seleção.',
        ],
      },
      {
        label: 'Estabilidade e desempenho',
        items: [
          'Save do navegador mais resistente quando a memória enche — compactação automática antes de falhar.',
          'Carregamento mais rápido ao abrir o jogo.',
          'Categoria de Base e outras telas pesadas carregam sob demanda, sem travar a abertura.',
          'Aviso para Ctrl+Shift+R se o navegador estiver com arquivos antigos do jogo.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.10',
    date: '2026-07-26',
    publishedAt: '2026-07-26T01:45:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Elenco e contratos',
        items: [
          'Nova janela GESTÃO DE CONTRATOS no Elenco — renovações com aceitar/recusar sem ir às mensagens.',
          'Bolinha amarela no menu Elenco quando houver contrato a vencer ou vencido.',
          'Linhas do elenco continuam destacadas (azul, laranja, vermelho) conforme a situação.',
        ],
      },
      {
        label: 'Copa do Mundo (seleção)',
        items: [
          'Campeonatos e Tabela de Jogos passam a mostrar a CMU quando você comanda a seleção.',
          'Renovações do clube deixam de encher a inbox enquanto você está na seleção.',
        ],
      },
      {
        label: 'Estabilidade',
        items: [
          'Save do navegador mais resistente quando a memória enche — compactação automática antes de falhar.',
          'Carregamento mais rápido: o jogo não regrava a temporada inteira em todo refresh.',
          'Aviso para Ctrl+Shift+R se o navegador estiver com arquivos antigos do jogo.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.05',
    date: '2026-07-23',
    publishedAt: '2026-07-23T19:20:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Copa do Mundo',
        items: [
          'A Copa do Mundo (CMU) foi desligada temporariamente enquanto estabilizamos o modo seleções.',
          'Por hora o jogo continua o foco só no clube (Brasileirão + Copa do Brasil).',
          'Seus saves continuam válidos — dados da copa ficam guardados, sem aparecer no jogo.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.2.00',
    date: '2026-07-23',
    publishedAt: '2026-07-23T15:10:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Disputa de pênaltis',
        items: [
          'Disputa de pênaltis refeita — mais realista, com a mesma lógica no ao vivo e nos jogos automáticos de mata-mata.',
          'Gols na disputa não entram na média de gols do jogo.',
          'Relatório pós-jogo mostra Pênaltis marcados (durante o jogo) e, quando houver, a seção Disputa de pênaltis com placar e vencedor.',
        ],
      },
      {
        label: 'Cartas de jogador',
        items: [
          'Verso do card exibe série/divisão e nome do clube do jogador.',
        ],
      },
      {
        label: 'Seleções',
        items: [
          'Escudos de seleções nacionais usam a bandeira do país (48 seleções da Copa 2026).',
          'Bandeiras aparecem no placar ao vivo, no calendário e nas chaves de campeonato.',
        ],
      },
      {
        label: 'Calendário',
        items: [
          'Agenda e calendário mais leves ao avançar semana (menos recálculos repetidos).',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.95',
    date: '2026-07-23',
    publishedAt: '2026-07-23T13:12:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Calendário',
        items: [
          'Cada dia com jogos mostra tags de campeonato.',
          'Grade mais limpa: removido o texto repetido de fase da Copa no dia.',
          'Legenda atualizada com as cores das séries e da Copa.',
          'Temporada reorganizada.',
          'Correção: Brasileirão e Copa do Brasil rodam em paralelo, sem empurrar tudo para dezembro.',
        ],
      },
      {
        label: 'Ambiente · ingressos',
        items: [
          'Preços de ingresso agora são por setor do estádio (arquibancada, premium, etc.).',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.90',
    date: '2026-07-23',
    publishedAt: '2026-07-23T03:15:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Cartas de jogador',
        items: [
          'Novo sistema para verificação de jogadores.',
          'Frente do card com OVR, posição, nome e bandeira; verso com atributos, especialistas e carreira na temporada.',
          'Vire o card para ver stats, pé forte e resumo (média, jogos, gols, cartões).',
          'Cards não abrem no relatório pós-jogo.',
        ],
      },
      {
        label: 'Elenco',
        items: [
          'Agora é possível renomear jogador.',
          '1 renomeação por jogador por temporada.',
        ],
      },
      {
        label: 'Nomes e nacionalidade',
        items: [
          'Elencos com possibilidade de estrangeiros.',
          'Países: Argentina, Uruguai, Paraguai, Colômbia, Venezuela, Equador e Chile.',
          'Nomes gerados pela nacionalidade; saves antigos migram na carga.',
        ],
      },
      {
        label: 'Especialistas',
        items: [
          'Goleiros especialistas em defesa de pênalti — novo tipo.',
          'Laterais e volantes agora também podem ser especialistas em falta.',
        ],
      },
      {
        label: 'Transferências',
        items: [
          'Nomes no Mercado são clicáveis e abrem o card.',
          'Filtro novo: “Só mostrar especialistas”.',
          'Do card dá para iniciar compra, venda ou empréstimo (com mercado aberto).',
        ],
      },
      {
        label: 'Ao vivo',
        items: [
          'Sons na partida: apito, ambiente de estádio, torcida em gol e reação em pênalti.',
          'Em Opções → Sons ao vivo: ligar/desligar e ajustar volume (salvo no navegador).',
          'Análise do adversário durante o jogo pausa o relógio.',
        ],
      },
      {
        label: 'Opções',
        items: [
          'Nova seção “Sons ao vivo” nas configurações.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.85',
    date: '2026-07-22',
    publishedAt: '2026-07-22T14:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Calendário · temporada única',
        items: [
          'Todos os campeonatos (Brasileirão, Copa etc.) ficam dentro do mesmo ano — nada de jogo “vazando” para janeiro do ano seguinte.',
          'Se o calendário atrasa no fim do ano, as partidas pendentes da Copa são remarcadas dentro de dezembro.',
          'Correção do travamento ao avançar semana com Copa pendente após o encerramento do Brasileirão.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.80',
    date: '2026-07-22',
    publishedAt: '2026-07-22T13:40:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Finanças · contratações',
        items: [
          'Receita recorrente no gate de folha ficou mais estável ao longo da temporada.',
          'Séries B, C e D começam com elenco menor (22) e patrocínio/TV um pouco mais generosos — contratar na janela de inverno fica mais viável.',
        ],
      },
      {
        label: 'Estádio · lotação',
        items: [
          'Finais e jogos decisivos (título ou rebaixamento) lotam mais o estádio.',
          'Capacidade inicial varia por clube dentro de faixas por divisão; teto máximo de expansão dobrou (fantasy).',
        ],
      },
      {
        label: 'Escritório · Fluxo de Caixa',
        items: [
          'Novo card de folha salarial no Fluxo de Caixa — % da receita e limite em destaque.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.75',
    date: '2026-07-22',
    publishedAt: '2026-07-22T12:40:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Calendário · Série D',
        items: [
          'Datas e horários da Série D passam a ser preservados no save — mata-mata não perde agenda após recarregar.',
          'Carregamento de save antigo faz merge inteligente em vez de sobrescrever rodadas já agendadas.',
        ],
      },
      {
        label: 'Calendário · estabilidade',
        items: [
          'Removido ajuste legado de espaçamento que conflitava com o motor unificado de agenda.',
          'Constante de rodadas da fase de grupos da Série D centralizada — menos risco de inconsistência.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.70',
    date: '2026-07-22',
    publishedAt: '2026-07-22T12:12:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Correção urgente',
        items: [
          'Carreiras voltam a abrir normalmente — o jogo não trava mais na tela inicial.',
          'Dashboard, Próximos Jogos e Calendário carregam de novo após a atualização.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.65',
    date: '2026-07-22',
    publishedAt: '2026-07-22T12:05:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Calendário · datas fixas',
        items: [
          'Cada jogo de liga agora tem data e horário definidos — não mudam no meio da temporada.',
          'Copa e campeonato respeitam intervalo mínimo de 3 dias entre partidas do mesmo clube.',
          'Saves antigos recebem datas na primeira carga; Calendário, AO VIVO e Painel ficam alinhados.',
        ],
      },
      {
        label: 'Calendário · estabilidade',
        items: [
          'Fixtures nacionais persistem entre rodadas — evita repetir o mesmo adversário por bug de agenda.',
          'Confrontos reconhecidos pelo par de clubes, mesmo com mando invertido no histórico.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.60',
    date: '2026-07-22',
    publishedAt: '2026-07-22T01:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Calendário · mandos',
        items: [
          'Novas carreiras alternam casa e fora — no máximo 2 jogos seguidos no mesmo mando.',
          'Próximos Jogos e Calendário refletem a rotina mais equilibrada.',
        ],
      },
      {
        label: 'Diretoria · risco de emprego',
        items: [
          'Avisos de demissão aparecem em popup na tela, além da caixa de Mensagens.',
          'Campanha acima da meta protege o cargo quando finanças ou diretoria estão no vermelho.',
          'Colapso total (diretoria + finanças no piso) ou falência ainda encerram o ciclo.',
        ],
      },
      {
        label: 'Partida ao vivo',
        items: [
          'Cabeçalho reorganizado: AO VIVO no topo; fase do campeonato e estádio abaixo do badge.',
        ],
      },
      {
        label: 'Painel · próxima partida',
        items: [
          'Fase da competição e contexto na tabela (ex.: posição no grupo) ao lado dos clubes.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.55',
    date: '2026-07-21',
    publishedAt: '2026-07-21T21:25:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Estádio · capacidade',
        items: [
          'Teto de lotação alinhado ao modelo por setores — expansão máxima realista por série.',
          'Painel do estádio mostra capacidade atual e teto (ex.: 32.000 / 46.000).',
        ],
      },
      {
        label: 'Metas de temporada',
        items: [
          'Balanço de fim de temporada lista as metas complementares com ✓/◐/✗.',
          'No Escritório, a meta principal também exibe o resultado final após a avaliação.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.50',
    date: '2026-07-21',
    publishedAt: '2026-07-21T20:55:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Escritório · metas de temporada',
        items: [
          'Card de orçamento reorganizado: meta principal no anel e bloco Metas de temporada.',
          'Três metas complementares (torneio, economia, estrutura) com progresso ao vivo.',
          'No fim da temporada: avaliação com ✓/◐/✗, mensagem na caixa de entrada e impacto na diretoria.',
        ],
      },
      {
        label: 'Empréstimo bancário',
        items: [
          'Simulação só aparece após OK; confirmação com CONFIRMAR / NEGAR.',
          'Popup de informações e teto de crédito em valor exato (ex.: R$ 1.075.000).',
          'Se digitar acima do teto, ajusta ao máximo automaticamente.',
          'Avisos de validação em popup efêmero — não vão para Mensagens.',
        ],
      },
      {
        label: 'Mercado · empréstimo de jogador',
        items: [
          'O salário do emprestado entra integralmente na folha do clube que está usando o jogador.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.49',
    date: '2026-07-21',
    publishedAt: '2026-07-21T19:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Estádio · visual por divisão',
        items: [
          'Ilustração da arena muda conforme a Série (A, B, C ou D) — cada divisão tem escala visual própria.',
          'O badge mostra o tier e a série do clube (ex.: TIER 4/8 · Série D).',
        ],
      },
      {
        label: 'Empréstimo bancário',
        items: [
          'Financiamento por parcelas: escolha 12x, 24x, 36x ou 48x na contratação — mais parcelas, taxa maior.',
          'A taxa fica travada no contrato; o Escritório mostra como ela foi calculada (série, saúde do clube, prazo).',
          'Juros saem do caixa automaticamente; a parcela do principal você paga no Escritório.',
          'Em atraso, a parcela mostra encargos (juros + multa). Saves antigos migram para 24x.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.48',
    date: '2026-07-21',
    publishedAt: '2026-07-21T17:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Estádio',
        items: [
          'A arena agora evolui por setores — Popular, Arquibancada, Cadeiras, Camarotes e VIP — cada um com preço e lotação próprios.',
          'Novos jogos começam com estádio menor; investir na estrutura destrava setores e expande a bilheteria.',
          'Ilustração do estádio na aba Estádio muda conforme você investe (8 níveis visuais).',
          'Saves antigos migram automaticamente para o novo modelo de setores.',
        ],
      },
      {
        label: 'Naming do estádio',
        items: [
          'Na Série A ou B, com estrutura e investimentos suficientes, você pode fechar parceiro de naming — receita por rodada nacional.',
          'O nome do estádio continua o seu; o patrocinador aparece como parceiro. Na crise financeira, a receita cai ou zera.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.43',
    date: '2026-07-21',
    publishedAt: '2026-07-21T14:55:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Clima do clube',
        items: [
          'Com atrasos ou caixa no vermelho, a torcida esfria e o vestiário fica mais tenso.',
          'Ao sair da crise, há um alívio leve por algumas rodadas.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.38',
    date: '2026-07-21',
    publishedAt: '2026-07-21T13:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Mercado',
        items: [
          'Antes de comprar ou emprestar, o jogo mostra se a folha vai ficar apertada — você ainda pode seguir, mas fica avisado.',
          'Em crise grave, as contratações podem ser bloqueadas até as finanças melhorarem (vendas e adiantamento de TV continuam liberados).',
          'Clubes de série menor agora podem tentar contratar de séries superiores com ofertas bem altas — a chance é baixa e não é garantia.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.33',
    date: '2026-07-20',
    publishedAt: '2026-07-21T00:45:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Empréstimo e falência',
        items: [
          'Sistema de empréstimos adicionado — agora você pode pedir empréstimos.',
          'Sistema de falência adicionado — existe chance de colapso financeiro e de você ser demitido por isso.',
        ],
      },
      {
        label: 'Adiantamento de TV',
        items: [
          'Sistema de adiantamento de cota de TV adicionado — agora, para ganhar respiro orçamentário, você pode pedir adiantamento da cota de TV.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.32',
    date: '2026-07-20',
    publishedAt: '2026-07-21T00:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Adiantamento de TV',
        items: [
          'Sistema de adiantamento de cota de TV adicionado.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.31',
    date: '2026-07-20',
    publishedAt: '2026-07-20T23:25:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Empréstimo e falência',
        items: [
          'Sistema de empréstimos adicionado — agora você pode pedir empréstimos.',
          'Sistema de falência adicionado — existe chance de colapso financeiro e de você ser demitido por isso.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.26',
    date: '2026-07-20',
    publishedAt: '2026-07-20T20:50:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Economia',
        items: [
          'Cheque especial dinâmico: taxa sobe com saúde, rombo e rodadas seguidas no vermelho.',
          'Ficar no negativo ~5–6 rodadas pressiona forte Finanças e Diretoria (risco de demissão com campanha ruim).',
          '1–2 rodadas no vermelho ainda são recuperáveis; sair do negativo zera o contador.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.25',
    date: '2026-07-20',
    publishedAt: '2026-07-20T05:05:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Mercado',
        items: [
          'Na busca de jogadores, clicar no nome do clube abre a análise do time.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.20',
    date: '2026-07-20',
    publishedAt: '2026-07-20T05:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Elenco',
        items: ['Tag EMPR. de jogador emprestado agora em laranja.'],
      },
    ],
  },
  {
    version: 'Alpha V.1.15',
    date: '2026-07-20',
    publishedAt: '2026-07-20T04:55:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Elenco',
        items: [
          'Após pulsos de evolução, o Overall no Elenco mostra ↑ verde, ↓ vermelho ou − laranja (estável).',
          'A marcação permanece por 3 semanas no calendário do jogo.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.10',
    date: '2026-07-20',
    publishedAt: '2026-07-20T04:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Elenco / Prancheta',
        items: [
          'Hover na lista de titulares/reservas destaca o jogador na prancheta (scout, adversário ao vivo e táticas).',
          'Jogadores emprestados mostram a tag EMPR. ao lado do nome no elenco e listagens.',
        ],
      },
      {
        label: 'Mercado',
        items: [
          'Recusar proposta de empréstimo agora atualiza a mensagem para “Proposta recusada” e mantém o leitor aberto.',
          'Falha ao pedir empréstimo no mercado gera mensagem na caixa de entrada.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.05',
    date: '2026-07-20',
    publishedAt: '2026-07-20T03:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Calendário / Save',
        items: [
          'Save da temporada bem mais leve: fadiga/disponibilidade esparsas, sem duplicar o AO VIVO, históricos compactos.',
          'Avanço do calendário não faz mais reschedule pesado em loop (menos travadas na UI).',
          'Se a cota do navegador estourar, o jogo corta históricos extras e tenta gravar de novo.',
        ],
      },
    ],
  },
  {
    version: 'Alpha V.1.00',
    date: '2026-07-20',
    publishedAt: '2026-07-20T03:15:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Versão',
        items: [
          'Nova nomenclatura das atualizações: Alpha V.1.00 (próximas sobem de 0.05 em 0.05).',
        ],
      },
      {
        label: 'Mercado',
        items: [
          'Mercado de transferências ativo também no GitHub Pages (não só no build local).',
          'Funil de propostas da IA calibrado: ~4 por janela, pico de 2 pendentes, expiração em 4 dias.',
        ],
      },
      {
        label: 'Temporada e UI',
        items: [
          'Corrigidos crashes da simulação idle e do balanço/próxima temporada (Série D).',
          'Calendário alinhado ao dia de carreira; pós-jogo com AVANÇAR e CLASSIFICAÇÃO sem consumir a rodada.',
          'Tabelas no visual BR Fut; limpeza mais agressiva quando a cota do localStorage estoura.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-35',
    date: '2026-07-20',
    publishedAt: '2026-07-20T03:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Temporada idle',
        items: [
          'Corrigido crash ao simular o restante da temporada e no balanço/próxima temporada (Série D promoted).',
          'Simulação idle mais resistente a fixtures/Copa incompletos e clubes ausentes.',
          'Calendário não deixa jogos da Copa atrás do dia de carreira; Dia de Jogo reconhece partidas atrasadas.',
        ],
      },
      {
        label: 'Pós-jogo e tabelas',
        items: [
          'AVANÇAR no pós-jogo; CLASSIFICAÇÃO não consome a rodada (dá para reabrir PÓS-JOGO).',
          'Tabelas do campeonato no visual BR Fut (azul); zonas de acesso e linha do seu clube em verde.',
        ],
      },
      {
        label: 'Save',
        items: [
          'Quota do localStorage: limpeza mais agressiva do histórico de jogadores quando a cota estoura.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-34',
    date: '2026-07-20',
    publishedAt: '2026-07-20T01:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Mercado',
        items: [
          'Propostas da IA ao seu elenco bem menos frequentes (~4 por janela, pico de 2 pendentes).',
          'Funil interesse → chance → no máximo 1 oferta por tick; 1 tick/semana (diário só no deadline).',
          'Propostas expiram em 4 dias; recusa gera cooldown de 10 dias no mesmo jogador.',
          'No GitHub Pages o mercado continua desligado; no build local de testers segue ativo.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-33',
    date: '2026-07-20',
    publishedAt: '2026-07-20T01:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Motor de partida',
        items: [
          'Calibração v4c: média de gols mais próxima do Brasileirão e bem menos goleadas extremas (8×0).',
          'Novo freio por placar: quem já lidera por 2+ gols perde conversão nas finalizações.',
          'Ao vivo alinhado à simulação (menos boost artificial de ataque no chute).',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-32',
    date: '2026-07-20',
    publishedAt: '2026-07-20T00:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Central',
        items: [
          'Cabeçalho vira informativo em ticker contínuo (próximo jogo, rodada, mercado e vendas).',
          'Orçamento do clube com ícone de moedas e destaque visual.',
          'Após fechar a janela de transferências, o botão Avançar Semana continua no Dashboard.',
          'Card da próxima partida com escudos e nomes maiores; nomes de clubes abrem o scout.',
        ],
      },
      {
        label: 'Mercado',
        items: [
          'No GitHub Pages o mercado permanece desligado; no build local de testers continua ativo.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-31',
    date: '2026-07-20',
    publishedAt: '2026-07-20T00:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Elenco / Evolução',
        items: [
          'Motor de evolução em 4 pulsos na temporada (notas, minutos e titularidade); idade +1 no ano novo.',
          'Tabela do Elenco destaca os 3 melhores atributos de cada jogador.',
          'Geração: jovens abaixo de 19 mais raros; jóias com potencial mais alto.',
        ],
      },
      {
        label: 'Pênaltis',
        items: [
          'Disputa não trava mais na morte súbita: a lista de cobradores reinicia até haver vencedor.',
          'Goleiro também pode bater pênalti.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-30',
    date: '2026-07-19',
    publishedAt: '2026-07-19T18:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Central',
        items: [
          'PÓS-JOGO só aparece depois de fechar o resumo da partida recém-jogada; some ao SAIR.',
          'Com o pós-jogo pendente, JOGAR PARTIDA fica oculto (mesmo fluxo do PÓS-JOGO).',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-29',
    date: '2026-07-19',
    publishedAt: '2026-07-19T17:45:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Central',
        items: [
          'Botão PÓS-JOGO entre JOGAR PARTIDA e DIA DE JOGO para reabrir o resumo depois de fechar a janela.',
          'O × no pós-jogo só fecha a tela; SAIR continua avançando a rodada.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-28',
    date: '2026-07-19',
    publishedAt: '2026-07-19T17:35:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Relatório / NOTAS',
        items: [
          'Gol contra deixa de aparecer no time adversário quando há homônimos — bola vermelha só no autor do GC.',
          'Ícones de gol, assistência, cartões e substituições ficam amarrados ao lado correto da ficha.',
        ],
      },
      {
        label: 'Campeonatos',
        items: [
          'Botão REGRAS com o regulamento da competição aberta.',
          'Série C segue o calendário CBF (tamanho e zonas de acesso/rebaixamento sem inflar o grupo).',
        ],
      },
      {
        label: 'Mensagens / Análise',
        items: [
          'Mensagens antigas (14 dias) saem do contador, exceto as que pedem ação.',
          'Aviso médico urgente com destaque vermelho na navegação.',
          'Análise do clube: escudo, chips de estilo e coluna MÉDIA do histórico.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-27',
    date: '2026-07-19',
    publishedAt: '2026-07-19T15:15:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Escritório',
        items: [
          'META DE TEMPORADA ganha anel de desempenho ao lado do texto (mesmo visual do balanço de fim de temporada).',
          'O % é uma projeção do momento: posição/fase, ritmo de pontos e últimos resultados — vermelho abaixo, amarelo no ritmo, verde no alvo.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-26',
    date: '2026-07-19',
    publishedAt: '2026-07-19T14:50:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Mata-mata',
        items: [
          'Empate no agregado (ida+volta) abre disputa de pênaltis ao vivo — não resolve mais sozinho nos bastidores.',
          'Pênaltis só avançam a fase depois da disputa jogada no seu confronto; jogos só-CPU ainda podem decidir no automático.',
        ],
      },
      {
        label: 'Elenco / táticas',
        items: [
          'Ajustes de UI no painel tático e na página de campeonatos.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-25',
    date: '2026-07-19',
    publishedAt: '2026-07-19T00:45:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'AO VIVO',
        items: [
          'Pênalti contra: comparativo cobrador × goleiro; cobrança só após o botão ASSISTIR (tempo para ler).',
          'Acréscimos passam a seguir interrupções reais: sem cartão/substituição no 2º tempo, o quadro fica em 2–3\' (não mais 7\' por sorte).',
          'Gol contra no Volume: bola vermelha com detalhes brancos no lado do time que sofreu.',
          'Substituições no Volume: setas verde/vermelha no lado do time que fez a troca.',
          'Disputa de pênaltis no mata-mata: cobranças da IA também com comparativo e animação; título repetido removido.',
        ],
      },
      {
        label: 'Campeonatos',
        items: [
          'Todas as competições vira dropdown na página (sem modal); setas para grupos da Série D e fases da Copa/mata-mata.',
          'Com mata-mata da D ativo, alterne Grupos ↔ Mata-mata no modal e na página Campeonatos.',
          'Zonas de acesso/rebaixamento nas tabelas A/B/C; escudos e badges de divisão nos confrontos.',
        ],
      },
      {
        label: 'Temporada',
        items: [
          'Medidor gráfico no balanço: desempenho entregue vs meta pedida pela diretoria.',
          'Preview seguro: Opções → PREVIEW META (ou ?preview=season-goal) — não altera a carreira.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-24',
    date: '2026-07-18',
    publishedAt: '2026-07-19T00:15:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'AO VIVO',
        items: [
          'Acréscimos recalibrados: 1º ~1–3\', 2º ~3–5\' (7\' raro). Em mata-mata ou nas 2 últimas rodadas da liga, o 2º pode chegar a 8–10\' — extremamente raro.',
          'Badge de suspensão só aparece no torneio da partida (não vaza de Copa/liga cruzada). Elenco continua mostrando todas.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-23',
    date: '2026-07-18',
    publishedAt: '2026-07-18T23:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Economia',
        items: [
          'Prêmios de liga/Copa e receitas de TV/patrocínio/ingresso recalibrados — campanha boa paga bem sem inflar o caixa multi-ano.',
        ],
      },
      {
        label: 'AO VIVO',
        items: [
          'Volume de Jogo acompanha os acréscimos: linha e marcadores em 45+N / 90+N não colam mais no 90\'.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-22',
    date: '2026-07-18',
    publishedAt: '2026-07-18T22:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Motor de partida',
        items: [
          'Gol contra volta a ocorrer no AO VIVO e na simulação da IA (marcado como GC / gol contra).',
          'Acréscimos no fim de cada tempo: relógio 45+N / 90+N, anunciados pelo árbitro conforme faltas, cartões e substituições.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-21',
    date: '2026-07-18',
    publishedAt: '2026-07-18T21:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Integridade da partida',
        items: [
          'Recarregar a página no meio do jogo retoma o mesmo confronto — não dá mais para recomeçar e pescar resultado.',
          'Escalação e formação da tela Táticas passam a valer no pré-jogo e são salvas entre sessões.',
        ],
      },
      {
        label: 'Interface',
        items: [
          'Selo do campeonato (troféu + nome) na Central, no pré-jogo/AO VIVO e no relatório da partida.',
          'Volume de Jogo com curvas mais fluidas e marcadores de cartão/lesão.',
          'Escolha de cobrador de pênalti mais limpa (Overall + chance estimada).',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-20',
    date: '2026-07-18',
    publishedAt: '2026-07-18T18:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'AO VIVO',
        items: [
          'Gráfico Volume de Jogo com marcadores de gol e artilheiros sob o placar.',
          'Timeline só com ocorrências importantes e escudo do time em cada evento.',
          'Ajuste tático na pausa fica recolhido por padrão (botão AJUSTE TÁTICO).',
        ],
      },
      {
        label: 'Economia e clube',
        items: [
          'Escolha de patrocínios (Master + 3 Secundários) no Novo Jogo e a cada temporada.',
          'Nome do estádio no Novo Jogo; rename só via Name Rights no Escritório.',
          'Metas da diretoria, status do clube e risco de demissão do técnico.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-19',
    date: '2026-07-17',
    publishedAt: '2026-07-17T21:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Testers',
        items: [
          'Guia do tester e envio de feedback na home e em Opções (copiar relatório ou abrir issue no GitHub).',
          'Deep links: home.html#guia e home.html#feedback.',
          'Arrasto de posições na prancheta volta a funcionar na build hardened (5081 / Pages).',
        ],
      },
      {
        label: 'Economia',
        items: [
          'Premiação da Série D e da Copa do Brasil por fase avançada (não usa mais a posição do grupo como ranking nacional).',
        ],
      },
      {
        label: 'Arquitetura',
        items: [
          'CSS do motor legado extraído para arquivos estáticos; módulos de fadiga e UI da partida ao vivo.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-18',
    date: '2026-07-17',
    publishedAt: '2026-07-17T20:20:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Estabilidade',
        items: [
          'Uso de memória e save do navegador otimizados: históricos compactos, artilharia magra e proteção contra cota do localStorage.',
          'Fechar o jogo ao vivo pausa o relógio (evita vazamento de timer em segundo plano).',
          'Histórico de lesões e títulos do ranking passam a ter teto por carreira longa.',
        ],
      },
      {
        label: 'Interface',
        items: [
          'Logos de patrocínio reenquadrados; valores do Escritório em destaque.',
          'Badge de Mensagens maior; tabelas da Central realinhadas.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-17',
    date: '2026-07-17',
    publishedAt: '2026-07-17T18:45:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Novidades',
        items: [
          'Sidebar: Treinamento, Transferências e Categoria de Base abaixo de Estádio.',
          'Planejamento semanal de treinos moveu para a área Treinamento (atalho no Calendário).',
          'Transferências e Categoria de Base aparecem como Em Breve.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-16',
    date: '2026-07-17',
    publishedAt: '2026-07-17T17:35:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Correções',
        items: [
          'Bilheteria só credita em jogos em casa; trava reforçada no motor e na mensagem de resultado.',
          'VER ADVERSÁRIO AO VIVO volta a mostrar a formação no gramado (helpers táticos exportados).',
          'AO VIVO: estádio no formato Nome (CASA/FORA) · público · %; badges de lesão/cartão maiores no elenco.',
        ],
      },
      {
        label: 'Interface',
        items: [
          'CONFRONTO TÁTICO e PLANO TÁTICO VS PARTIDA ocultos (pré-jogo, pausa e pós-jogo).',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-15',
    date: '2026-07-17',
    publishedAt: '2026-07-17T17:00:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Novidades',
        items: [
          'Lotação do estádio no dia do jogo varia com Ambiente, torcida, preço do ingresso e fase (mata-mata agudo enche mais).',
          'AO VIVO mostra público/capacidade e % de lotação; bilheteria em casa entra no fluxo de caixa.',
          'Mensagem única RESULTADO DA PARTIDA com placar, público e bilheteria (sem alerta separado de bilheteria).',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-14',
    date: '2026-07-17',
    publishedAt: '2026-07-17T16:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Correções',
        items: [
          'Posse AO VIVO recalibrada: mando segue o calendário (casa/fora), faixa mais realista e alinhada aos passes.',
          'Corrige extremos irreais (ex.: 62%–38% constantes) mantendo o efeito das táticas perceptível.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-13',
    date: '2026-07-17',
    publishedAt: '2026-07-17T16:20:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Correções',
        items: [
          'Posse de bola AO VIVO deixa de ficar travada em 50%–50%, principalmente em jogos fora de casa.',
          'Estatísticas salvas de Copa/mata-mata passam a respeitar mandante × visitante do calendário.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-12',
    date: '2026-07-17',
    publishedAt: '2026-07-17T15:50:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Novidades',
        items: [
          'Nova seção Escritório: orçamento, investimentos médicos e movimentos de caixa.',
          'Nova aba Estádio: gramado, expansão de capacidade e preços de ingresso (Nacional e Copas).',
          'Bilheteria creditada após jogos em casa — preço alto reduz ocupação; preço baixo enche mais o estádio.',
          'Patrocínio no Escritório: 1 Master + 3 secundários sorteados sem repetição, com valor por divisão.',
        ],
      },
      {
        label: 'Melhorias',
        items: [
          'Premiação de fim de temporada passa pelo módulo econômico (crédito com histórico).',
          'Saves antigos sem orçamento/estádio recebem valores iniciais da divisão automaticamente.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-11',
    date: '2026-07-17',
    publishedAt: '2026-07-17T14:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Melhorias',
        items: [
          'Motor tático reforçado: sliders de mentalidade, posse, pressão e linha de impedimento passam a impactar posse, finalizações, faltas e impedimentos de forma perceptível.',
          'Simulação de rodada alinhada ao jogo ao vivo — mesma escala de bônus táticos e linha de impedimento variável por estilo do adversário.',
          'Resumo pós-jogo compara plano tático (posse planejada, precisão estimada, finalizações) com o que aconteceu na partida.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-10',
    date: '2026-07-17',
    publishedAt: '2026-07-17T13:10:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Novidades',
        items: [
          'Sistema disciplinar reformulado: 3 amarelos acumulados = 1 jogo suspenso, com contador separado por competição.',
          'Vermelho direto com punição de 1 a 3 jogos conforme a gravidade da falta.',
          'Confronto tático visual na pausa, tela de táticas e estatísticas ao vivo (ataque, passe e defesa).',
          'Orçamento fictício do clube no dashboard e premiação de fim de temporada (participação, colocação, título, Copa e acesso).',
        ],
      },
      {
        label: 'Correções',
        items: [
          'Cartões em jogos fora de casa passam a ser registrados corretamente no elenco.',
          'Placar ao vivo e estatísticas seguem mandante × visitante do calendário (seu time destacado em verde).',
        ],
      },
      {
        label: 'Melhorias',
        items: [
          'Badges e mensagens mostram contador X/3 amarelos por competição.',
          'Timeline registra o plano tático no apito inicial; pós-jogo compara plano vs resultado.',
          'Balanço de temporada exibe detalhamento da premiação creditada.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-9',
    date: '2026-07-16',
    publishedAt: '2026-07-16T23:15:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Novidades',
        items: [
          'Ritmo de jogo ULTRA (~8 s por tempo) nas Opções — acima do modo Rápido.',
        ],
      },
      {
        label: 'Correções',
        items: [
          'Botão SAIR ao vivo funciona novamente após o fim da partida.',
          'Placar da Copa do Brasil deixa de exibir pênaltis quando já há vencedor no tempo regulamentar.',
          'Saves antigos são saneados ao carregar — metadados órfãos de shootout removidos.',
        ],
      },
      {
        label: 'Melhorias',
        items: [
          'Card Ambiente do Elenco no dashboard com layout vertical e métricas empilhadas.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-8',
    date: '2026-07-16',
    publishedAt: '2026-07-16T22:41:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Novidades',
        items: [
          'Balanço de fim de temporada redesenhado: campeões com troféu e escudo, artilheiros e assistências por liga.',
          'Painel de acessos e rebaixamentos com movimentos entre divisões.',
        ],
      },
      {
        label: 'Correções',
        items: [
          'Botão Iniciar próxima temporada avança de fato para a nova temporada, sem regravar o save antigo.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-7',
    date: '2026-07-16',
    publishedAt: '2026-07-16T22:30:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Novidades',
        items: [
          'Dashboard modularizado: próximo jogo, mini-tabela, últimos resultados e líderes.',
          'Tela de táticas extraída para módulo dedicado: prancheta, escalação, substituições e sugestão tática.',
        ],
      },
      {
        label: 'Melhorias',
        items: [
          'Fase C da modularização concluída — engine legado significativamente mais enxuto.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-6',
    date: '2026-07-16',
    publishedAt: '2026-07-16T22:18:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Novidades',
        items: [
          'Calendário extraído para módulo dedicado com agenda mensal e relatórios de partida.',
          'Badges de status do jogador (cartões, lesão, suspensão) compartilhados entre elenco e táticas.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-5',
    date: '2026-07-16',
    publishedAt: '2026-07-16T21:55:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Correções',
        items: [
          'Copa do Brasil não simula mais jogos do usuário sem participação.',
          'Calendário respeita intervalos de descanso entre rodadas.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-4',
    date: '2026-07-16',
    publishedAt: '2026-07-16T21:40:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Novidades',
        items: [
          'Slider Linha de Impedimento nas táticas (pré-jogo e pausa ao vivo).',
          'Táticas do usuário persistidas no save da temporada.',
        ],
      },
      {
        label: 'Melhorias',
        items: [
          'Inbox de mensagens reorganizado por categorias (competição, médico, disciplina).',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-3',
    date: '2026-07-16',
    publishedAt: '2026-07-16T21:20:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Correções',
        items: [
          'Jogo do dia avança corretamente ao sair da partida ou abrir a classificação.',
          'Expulsão do adversário não pausa mais o jogo.',
        ],
      },
      {
        label: 'Novidades',
        items: [
          'Botão Partidas em Andamento na pausa ao vivo.',
          'Prancheta tática redesenhada com marcadores menores e badges de status.',
        ],
      },
    ],
  },
  {
    version: 'alpha-02-tester-2',
    date: '2026-07-16',
    publishedAt: '2026-07-16T20:50:00-03:00',
    title: 'BR Fut foi atualizado',
    topics: [
      {
        label: 'Correções',
        items: [
          'Jogo do dia avança corretamente ao sair da partida ou abrir a classificação.',
          'Expulsão do adversário não pausa mais o jogo.',
        ],
      },
      {
        label: 'Novidades',
        items: [
          'Botão "Partidas em Andamento" mostra placares parciais da rodada na pausa ao vivo.',
          'Prancheta tática redesenhada: marcadores menores, sobrenomes e badges de status.',
        ],
      },
      {
        label: 'Melhorias',
        items: [
          'Alerta de atualização para testers ao abrir uma versão nova.',
        ],
      },
    ],
  },
];
