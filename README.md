# PULSO

**FPS tático 5v5 para Android** — conceito original inspirado na mecânica e na linguagem visual do Valorant, construído do zero em React Native + three.js (render 3D nativo via OpenGL).

> Duas facções em guerra pelos cenários desativados da cidade: **CORO** (atacantes) contra **DIRAC** (defensores). Plante o **Diapasão**, faça a carga ressoar e estabeleça o Pulso — ou elimine todos que se colocarem no caminho.

---

## 📥 Como jogar (sem PC, sem Expo Go)

1. Abra **[github.com/mrspecterr/Pulso/releases](https://github.com/mrspecterr/Pulso/releases)** no navegador do celular.
2. Baixe o arquivo `PULSO-vX.Y.Z.apk` da versão mais recente.
3. Toque no arquivo baixado. Se o Android pedir, permita **instalar apps de fontes desconhecidas**.
4. Jogue. 🎮

Cada release nova (tag `vX.Y.Z`) gera o APK automaticamente via GitHub Actions — é só voltar na aba Releases pra atualizar (instala por cima da versão anterior, mantendo a mesma assinatura).

## 🎮 Controles

| Ação | Toque |
|---|---|
| Mover | Joystick na metade esquerda |
| Mirar | Arrastar na metade direita |
| Atirar | Segurar o botão de fogo (automático) |
| Recarregar | Botão `R` |
| Luneta (FERMATA) | Botão `◎ LUNETA` — zoom 2,3×, mira lenta, meio passo |
| Plantar Diapasão | Segurar o botão `◈` dentro do site |
| Comprar | Loja durante a fase de compra |
| Traços | Botões à direita (3 por agente) — `◈` `▤` `⌾` · `⇢` `◎` `◉` · `⛨` `✸` `◫` · `♪` `◐` `❖` |
| Som | Botão `SOM` (100% · 50% · mudo) |

## 🧩 Sistemas do jogo

- **Arsenal vivo (v0.24)** — o quinto e o sexto calibre, a nota que repete e a nota que se segura:
  - **TREMOLANDO · submetralhadora (1.600 dB)** — 800 rpm e pente de 32: a rajada que abre corredor. Os 4 primeiros tiros vão onde se olha; depois o padrão sobe íngreme e tece mais largo que o LEGATO — rajada curta e controlada ou nada
  - **FERMATA · rifle de precisão (4.500 dB)** — a arma mais cara do jogo: 140 no corpo derruba qualquer um sem traje INTEGRAL, na cabeça ninguém resiste — e a **LUNETA** (botão ◎): FOV 75° → 32°, mira por arrasto lenta e fina, passo à meia velocidade e o retículo da ótica É a mira (o viewmodel some). Sem a luneta o cano cospe num cone de 6,5° — hipfire não
  - **Ferreirinho animado** — após cada nota da FERMATA a alavanca sobe, puxa o ferrolho e fecha (viewmodel + som próprio); o clarão de boca e o chute de câmera são do calibre
  - **Loja repaginada** — cinco armas na lista e os TRAJES em linha horizontal: a loja continua cabendo na tela deitada
  - **Arsenal do hub atualizado** — fichas técnicas das duas novas armas (DPS, tiros p/ abater, dispersão/luneta) com artes próprias; as barras comparativas recalculam os tetos sozinhas
- **Operadores humanoides (v0.23)** — o fim dos robôs flutuantes:
  - **Gente de verdade em campo** — aliados CORO e DIRACs deixam de ser cápsulas com propulsor: agora são operadores com **pernas e ciclo de caminhada** (o passo balança pelo deslocamento real do frame), braços em pose de mira segurando o **fuzil** (receiver, cano, coronha, pente e alça), **capacete com óculos táticos**, placa peitoral, ombreiras, cinto, mochila de rádio e botas
  - **Hitboxes intocadas** — corpo continua a cápsula (0.26×0.92) e cabeça a esfera (0.18) exatas; armadura, capacete e fuzil são filhos fora do raycast (`intersectObjects` não-recursivo): mira, dano e headshot idênticos ao de sempre
  - **Leitura de time** — óculos e LEDs (ombro e mochila) na cor do esquadrão; a silhueta do SONAR/MARCA acompanha o corpo inteiro humanoide
  - **Economia preservada** — ~10 meshes por personagem (o robot usava ~7): tudo que não anda vira uma única mesh fundida por material; só as duas pernas são pivôs animados
- **Entrada de partida (v0.22)** — o fim da tela preta de carga:
  - **Cartão de entrada** — apertar JOGAR agora atravessa uma tela de entrada de verdade: mapa em destaque na cor própria, clima com tagline, esquadrão CORO ⟷ DIRAC, modo da sessão e dicas da estação rotativas — tudo honesto com o que o motor faz
  - **Saída no primeiro quadro** — o motor 3D avisa quando o primeiro quadro chega na tela (sinal `onReady` do Game) e o cartão sai em crossfade de 420ms: o jogador nunca vê a montagem crua da cena
  - **Guarda de 8s** — se o sinal não vier (inclusive painel de falha do GL), o cartão se retira sozinho; animações em driver nativo seguem vivas mesmo com a thread JS ocupada construindo a cena
- **Cliente premium (v0.21)** — a camada de apresentação no padrão dos grandes:
  - **Navegação viva** — nenhuma tela troca "à seco": a anterior continua montada enquanto a nova entra por cima em crossfade de 280ms com deslize sutil, e a antiga recua em profundidade (scale-down); entrar/sair de partida é fade puro, porque a montagem do motor 3D já pesa o suficiente
  - **Entrada cinematográfica** — a splash MONTA a si mesma em sequência (fundo → logo com peso de assinatura → tagline → equalizer → convite → rodapé) sobre um único driver Animated, sem re-render
  - **Arte viva (Ken Burns)** — a splash art do operador no hub e a base da galeria derivam em zoom/pan lento de 32s: a tela nunca está parada
  - **Brilho de aço no JOGAR** — varredura diagonal periódica no CTA principal, cortada pela borda do botão
  - **tap() — o toque do PULSO** — click de terminal + vibração leve sempre juntos (impacto médio em confirmar operador e entrar em partida), respeitando o interruptor de haptics dos ajustes; MenuButton agora AFUNDA no dedo com mola de escala
- **Arsenal & Dossiê (v0.20)** — o hub fecha as contas do jogador:
  - **ARSENAL** — a galeria de armas com **arte ilustrada por arma** (a mesma direção das artes dos operadores): STACCATO, GLISSANDO e LEGATO com a **ficha técnica real do motor** — dano por salvo (corpo/cabeça), cadência em rpm, pente, recarga, dispersão, **DPS teórico** e quantos disparos fecham um operador — além das barras comparativas e uma nota de campo por arma; os **TRAJES REFORÇADOS** têm vitrine própria (absorção e preço) e o bloco **A CONTA DA RODADA** documenta a economia de verdade (o texto antigo do briefing prometia +300 de plantio que o código não pagava — corrigido)
  - **DOSSIÊ DO OPERADOR** — o cartão de perfil do hub virou porta de entrada: **grade com 12 estatísticas de carreira** (partidas, vitórias, aproveitamento, K/D, abates, quedas, média, recorde, headshots, precisão, plantios, imaculadas), **ETIQUETAS DE ESTILO** que o jogo deriva dos próprios números (VIRTUOSE, CIRÚRGICO, AFINADO, SEMEADOR, ÍNTEGRO, VETERANO, IMBATÍVEL — até 4 por retrato), patente da temporada resumida com progresso e as **próximas 3 conquistas** com barras honestas
  - **Hub reorganizado** — BRIEFING subiu para a barra do topo (ao lado da engrenagem) e a coluna de módulos segue com cinco degraus: AGENTES · ARSENAL · MISSÕES · PATENTE · AJUSTES
- **Ranking sazonal (v0.19)** — a patente medida na própria física do jogo, o decibel:
  - **Escala dB 30–120** — do sussurro ao limiar da dor (que se chama PULSO); começa em 60 (MEZZO III), 3 partidas de **calibração** com passos largos abrem a temporada
  - **A escada da dinâmica musical** — SILENTE `pp` → PIANO `p` → MEZZO `mp` → FORTE `mf` → FORTISSIMO `f` → DIAPASÃO `ff` → **PULSO `fff`** (o topo único, exatamente 120 dB); três divisões por patente (III→II→I)
  - **A conta é honesta** — vitória soma pela margem de rodadas (7–0 pesa mais que 7–5), desempenho pessoal e embalo de sequência; derrota subtrai pelo placar; piso de 30 dB sempre deixa caminho de volta
  - **Tela de patente no hub** — emblema em losango na cor da patente, dB vivo, barra rumo à próxima, números da temporada (V/D, aproveitamento, sequência, pico) e a escada completa com VOCÊ marcado
  - **Cartão de dB no fim da partida** — `+21 dB` ou `−17 dB`, promoção ▲ / rebaixamento ▼ e a seladura da calibração, na hora em que acontece
- **Frente Climática & Progressão (v0.17)** — a partida muda de cara — e de regras:
  - **Clima por partida (PADRÃO · NOITE · NEBLINA)** — escolha ao lado do mapa no hub, persiste no perfil. **NOITE**: blecaute — luar frio, neon dos sites carregando a leitura e DIRACs enxergando 20% menos; **NEBLINA**: vapor engolindo a estação, alcance de percepção 38% menor, audição cortada e reação mais lenta — ambos os mapas reescritos por clima (fog, luzes, exposição)
  - **3º Traço por kit** — o botão do kit vira um "L" à direita da munição:
    - **MUDO** — ⌾ **SURDINA** ensurdece DIRACs próximos por 6s (tiros não alertam; visor apagado)
    - **ECO** — ◉ **MARCA** dardo rastreador: o alvo na mira fica revelado no minimapa por 8s (atravessa parede; 2 usos)
    - **GRAVE** — ◫ **POSTURA** finca o cotovelo: zero dispersão e recuo amortecido por 4,5s — o passo cai pra 55%
    - **VIBRATO** — ❖ **ACORDE** escudo harmônico: −35% de dano em você e no esquadrão inteiro por 6s
  - **Missões diárias** — 3 por dia (renascem à meia-noite, sorteio determinístico pela data): elimine DIRACs, plante o Diapasão, vença partidas… o XP cai direto na carreira e o fim de partida mostra o que fechou
  - **Conquistas** — 10 marcos permanentes (PRIMEIRO PULSO, REGENTE, CIRURGIA, CENTURIÃO, MÃO DE DIAPASÃO, RECITAL, INQUEBRÁVEL…): parede de estrelas no quadro MISSÕES, com barras de progresso honestas
  - **Carreira estendida** — plantios, quedas e vitórias sem cair agora contam; XP de missões creditado fora da fórmula base
- **Arsenal & Campo de Provas (v0.16)** — a terceira arma, o quarto operador e o modo treino:
  - **GLISSANDO · escopeta de corredera** (2.100 dB) — 8 balins por disparo em cone de dispersão: letal à queima-roupa (8×16 na cabeça = abate), fraca à distância; pente de 6, bombeamento de 850ms com **a corredera animada no viewmodel** e o som do rack depois de cada tiro
  - **VIBRATO · REGENTE** — o quarto operador CORO (+2% velocidade): ♪ **CADÊNCIA** reafina o esquadrão (+40 de vida ao longo de 3,5s no jogador e nos aliados próximos) · ◐ **RITARDANDO** ergue um campo de lentidão (9m por 4,5s): DIRACs desacelerados, com reação atrasada e o visor violeta enquanto o campo atua
  - **CAMPO DE PROVAS** — treino livre direto do hub: **dB infinito**, **ARSENAL aberto a qualquer momento** (troque de arma no meio da ação), sem rodadas nem placar — os 5 DIRAC e o esquadrão seguem em campo, bonecos de aquecimento no spawn e **respawn com kit recarregado** quando você cai
- **Cliente de jogo real (v0.15)** — entrada, hub e telas no padrão dos grandes (Free Fire, Wild Rift, Mobile Legends):
  - **Splash de entrada** — a estação vazia na neblina, o logo respirando e o equalizador de ressonância vivo; toque para entrar (o perfil carrega nesse tempo)
  - **HUB** — a **splash art do operador selecionado** dominando a tela (arte ilustrada por personagem), perfil com **nível/XP e patente reais** (RECRUTA → LENDA DO SUBSOLO — sobem jogando) que abre o **dossiê de carreira**, carreira no rodapé, coluna de módulos (AGENTES · ARSENAL · MISSÕES · PATENTE · AJUSTES), seletor de mapa e o botão **JOGAR** respirando no centro
  - **Galeria de operadores** — cada CORO com arte própria em destaque, crossfade ao trocar, dossiê com bio, Traços e papel tático
  - **Ajustes** — sensibilidade (BAIXA · PADRÃO · ALTA · MÁXIMA), gráficos, áudio, **vibração** e zerar dados — tudo persistido
  - **Perfil persistente (AsyncStorage)** — agente e mapa favoritos, configurações e carreira (partidas, vitórias, abates, headshots, precisão, recorde de abates) sobrevivem ao fechar o app
  - **BRIEFING** — o manual da Operação Rissonância dentro do hub (objetivo, fases, economia, controles)
- **Agentes CORO (v0.8 · 3º Traço v0.17)** — escolha o operador antes da partida; cada kit tem três Traços e uma velocidade própria:
  - **MUDO · TÁTICO** — ◈ CENZURA cega com linha de visão · ▤ BARREIRA ergue muro · ⌾ SURDINA ensurdece quem está perto
  - **ECO · BATEDORA** (+10% velocidade) — ⇢ IMPULSO arremesso de 8,5m · ◎ SONAR revela através de paredes · ◉ MARCA rastreia o alvo na mira
  - **GRAVE · VANGUARDA** (−6% velocidade) — ⛨ COURAÇA escudo temporal de 50 · ✸ ONDA DE CHOQUE fere e arremessa · ◫ POSTURA mira morta com passo curto
  - **VIBRATO · REGENTE** (+2% velocidade) — ♪ CADÊNCIA reafina o esquadrão · ◐ RITARDANDO desacelera DIRACs próximos · ❖ ACORDE escudo harmônico do esquadrão
- **Economia dB** — créditos por abates, vitórias e derrotas (cap 9.000); compre arsenais (STACCATO, TREMOLANDO, GLISSANDO, LEGATO, FERMATA) e trajes com escudo.
- **Rodadas** — fase de compra → ação → desfecho; primeira facção a 7 rodadas vence a partida.
- **Diapasão** — o objetivo: plante no Site A ou B e proteja a carga por 40s.
- **LEGATO** — rifle com padrão de spray determinístico (treino de recuo real); STACCATO — pistola grátis de 12 balas; TREMOLANDO — SMG de 800 rpm; FERMATA — rifle de precisão de ferrolho com luneta.
- **Operadores DIRAC** — bots com visão em cone, audição de tiros, strafe em combate, retake e silenciamento do Diapasão.
- **Esquadrão 5v5 (v0.12)** — quatro aliados CORO (TENOR, ALTO, BAIXO, CONTRA) lutam ao seu lado: seguem sua formação, engajam DIRACs à vista, defendem o site plantado e caçam sozinhos se você cair. Kill feed no canto, barra do esquadrão no HUD, modo espectador quando você é abatido e vitória por varrida (`DIRAC VARRIDO DO MAPA`). Os DIRACs também cresceram para cinco — e agora revidam quando baleados durante o retake.
- **Polimento e equilíbrio (v0.13)** — **minimapa tático** com a planta real do SUBSOLO (paredes dos colisores, seta de orientação, esquadrão, sites e Diapasão plantado; DIRACs acendem ao atirar, levar dano ou serem revelados pelo SONAR — sem wallhack); **dificuldade escalonada**: cada ponto DIRAC no placar deixa o esquadrão inimigo um nível mais afiado (precisão, reação, dano, percepção e retake — indicador `AMEAÇA` no HUD); **resgate da carga**: se você cair com o Diapasão, o aliado mais próximo pega a carga e planta por você (`◈ TENOR LEVA A CARGA`) — e se ele cair, outro assume; **placar de combate** no fim de cada rodada (abates por operador, CORO × DIRAC).
- **Três mapas + seleção (v0.14/18)** — escolha o campo antes da partida no hub:
  - **SUBSOLO** — estação de metrô desativada, 40×32m, três lanes simétricas e corredores curtos
  - **PALCO** — casa de espetáculos desativada, 44×34m, assimétrica: foyer com três portas, plateia coberta de poltronas, camarins a oeste, galeria a leste e o site B em cima do palco atrás de uma mureta baixa de 1,1m (dá para atirar por cima, não para passar)
  - **ESTÚDIO (v0.18)** — complexo de gravação desativado, 36×28m, o mapa fechado por salas: RECEPÇÃO com balcão e sofás ao sul, MISTURA com o console de mistura no centro, LOBBIES com pilhas de amplificadores e as portas das SALAS A/B ao norte — e entre os dois sites o **CONTROLE, uma caixa de vidro**: de dentro você enxerga os dois sites através dos vidros temperados por ressonância, mas balas não cruzam e os DIRACs não enxergam de volta. Quem toma o mid, toma o olho da partida
  - toda a IA (rotas de patrulha, retakes, defesa e resgate da carga) e o minimapa leem a planta do mapa — `config/maps.ts` é a fonte da verdade; as cenas cuidam só da arte (e do clima)
- **Mapa SUBSOLO** — 40×32m com corredores, sites A/B, caixotes e colisão real.
- **Direção de arte (v0.9)** — texturas procedurais (concreto, lajes, painéis, hazard), iluminação com sombras dinâmicas, arma em primeira pessoa animada, faíscas de impacto, luminárias/vigas/canos e placas de site.
- **Áudio e feedback (v0.11)** — todo o áudio é procedural (sintetizado por `scripts/gen_sfx.py`, zero assets externos): tiros com variação de timbre, estrondos do DIRAC com atenuação por distância, recarga com dois estágios, o Diapasão canta ao ser plantado e acelera o bip conforme o fusível derrete, detonação com sub-grave, motivos de vitória/derrota e o zumbido contínuo do subsolo. Haptics em acerto/abate/dano/plantio e botão `SOM` (100% · 50% · mudo).

## 🗺️ Roadmap

- [x] **1** — Motor 3D (OpenGL nativo, câmera FPS)
- [x] **2** — Controles mobile (joystick, mira por arrasto, fogo)
- [x] **3** — Mapa SUBSOLO com colisão AABB e balas por raycast
- [x] **4** — Gunplay do LEGATO (spray, recarga, dano/headshot, alvos)
- [x] **5** — Economia dB, rodadas, plantio do Diapasão, loja
- [x] **6** — Bots DIRAC com IA (patrulha, percepção, combate)
- [x] **7** — Traços (◈ CENZURA cega · ▤ BARREIRA ergue muro) + DIRACs que silenciam o Diapasão
- [x] **8** — Agentes jogáveis com kits próprios (MUDO, ECO, GRAVE) + troca de agente entre partidas
- [x] **9** — Direção de arte: texturas, iluminação/sombras, viewmodel, VFX
- [x] **10** — Multi-touch real (camada única de entrada) + desempenho (merge de geometria, resolução escalonada, contador de FPS)
- [x] **11** — Áudio e feedback: SFX 100% procedurais, haptics, botão SOM, automação de APK no GitHub Actions
- [x] **12** — Esquadrão 5v5: aliados CORO com IA (formação, combate, defesa do site, caça), DIRACs revidando no retake, kill feed, espectador e varrida
- [x] **13** — Polimento e equilíbrio: minimapa tático, dificuldade escalonada dos DIRACs, resgate/plantio da carga pelos aliados, placar de combate no fim de rodada
- [x] **14** — Conteúdo e longevidade: segundo mapa (PALCO), seleção de mapa, IA e minimapa agnósticos de mapa (MapDef)
- [x] **15** — Cliente de jogo: splash de entrada, HUB com artes dos operadores e perfil/carreira persistentes, galeria de agentes, ajustes com vibração e briefing no hub
- [x] **16** — Arsenal & Campo de Provas: escopeta GLISSANDO (8 balins, corredera animada), operador VIBRATO com CADÊNCIA/RITARDANDO e modo treino com dB infinito
- [x] **17** — Frente climática & progressão: clima por partida (NOITE/NEBLINA com impacto no combate), 3º Traço por kit (SURDINA/MARCA/POSTURA/ACORDE), missões diárias e 10 conquistas
- [x] **18** — Terceiro mapa ESTÚDIO: complexo de gravação fechado por salas, console na MISTURA e o CONTROLE — caixa de vidro entre os sites que deixa VER mas corta bala e visão dos DIRACs
- [x] **19** — Ranking sazonal: patente em decibéis (30–120) com calibração, divisões e a escada da dinâmica musical (SILENTE→PULSO), tela de patente no hub e cartão de dB no fim da partida
- [x] **20** — Arsenal & Dossiê: galeria de armas com arte por arma e ficha técnica real do motor (DPS, salvas, economia), dossiê do operador com 12 stats de carreira, etiquetas de estilo derivadas e progresso de conquistas
- [x] **21** — Cliente premium: transições crossfade entre todas as telas (a anterior recua em profundidade), splash cinematográfica em sequência, arte do hub em deriva Ken Burns, brilho varrendo o botão JOGAR e toque unificado com vibração (tap) em toda a interface
- [x] **22** — Entrada de partida: cartão de entrada (mapa, clima, esquadrão, dicas rotativas) cobrindo a montagem do motor 3D, com saída em crossfade no primeiro quadro renderizado e guarda de 8s
- [x] **23** — Operadores humanoides: pernas com ciclo de caminhada, braços com fuzil, capacete e óculos táticos para aliados e inimigos — hitboxes intocadas e ~10 meshes por personagem
- [x] **24** — Arsenal vivo: submetralhadora TREMOLANDO (800 rpm, pente 32) e rifle de precisão FERMATA com luneta de verdade (FOV 32°, sensibilidade reduzida, penalidade de quadril e ferreirinho animado)
- [ ] **25+** — modo espectador de replay, quarto mapa, novos Traços de agente

## 🔧 Como o APK é feito (automático)

Push de uma **tag** `vX.Y.Z` → GitHub Actions roda `npm ci` → `expo prebuild` (a assinatura release é injetada pelo plugin `plugins/with-signing.js`, que liga o keystore de `signing/`) → `gradlew assembleRelease` → APK publicado em **Releases**. Também dá rodar manualmente na aba **Actions → APK → Run workflow** (o APK sai como artifact). Ninguém precisa de PC: o build acontece na nuvem do GitHub.

## 🛠️ Stack

- Expo SDK 57 / React Native 0.86 / React 19 / TypeScript
- three.js **0.162** (última com suporte WebGL1 — o `expo-gl` nativo só expõe WebGL1; versões mais novas causam crash de render 3D)
- expo-gl + expo-three (render nativo, não WebView)
- UI 100% overlay RN com ponte por objetos mutáveis (zero re-render por frame)

## 🔐 Nota sobre a assinatura

O repositório é público e o keystore de assinatura está versionado em `signing/` (com senha aleatória forte). Para um jogo sem publicação em lojas o risco é desprezível, mas se o PULSO crescer, migre o keystore para *GitHub Secrets* e gere um novo.
