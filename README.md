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
| Plantar Diapasão | Segurar o botão `◈` dentro do site |
| Comprar | Loja durante a fase de compra |
| Traços | Botões `◈` `⇢` `⛨` (kit do agente) |
| Som | Botão `SOM` (100% · 50% · mudo) |

## 🧩 Sistemas do jogo

- **Cliente de jogo real (v0.15)** — entrada, hub e telas no padrão dos grandes (Free Fire, Wild Rift, Mobile Legends):
  - **Splash de entrada** — a estação vazia na neblina, o logo respirando e o equalizador de ressonância vivo; toque para entrar (o perfil carrega nesse tempo)
  - **HUB** — a **splash art do operador selecionado** dominando a tela (arte ilustrada por personagem), perfil com **nível/XP e patente reais** (RECRUTA → LENDA DO SUBSOLO — sobem jogando), carreira no rodapé, coluna de módulos (AGENTES · BRIEFING · AJUSTES), seletor de mapa e o botão **JOGAR** respirando no centro
  - **Galeria de operadores** — cada CORO com arte própria em destaque, crossfade ao trocar, dossiê com bio, Traços e papel tático
  - **Ajustes** — sensibilidade (BAIXA · PADRÃO · ALTA · MÁXIMA), gráficos, áudio, **vibração** e zerar dados — tudo persistido
  - **Perfil persistente (AsyncStorage)** — agente e mapa favoritos, configurações e carreira (partidas, vitórias, abates, headshots, precisão, recorde de abates) sobrevivem ao fechar o app
  - **BRIEFING** — o manual da Operação Rissonância dentro do hub (objetivo, fases, economia, controles)
- **Agentes CORO (v0.8)** — escolha o operador antes da partida; cada kit tem dois Traços e uma velocidade própria:
  - **MUDO · TÁTICO** — ◈ CENZURA cega operadores com linha de visão · ▤ BARREIRA ergue muro de ressonância
  - **ECO · BATEDORA** (+10% velocidade) — ⇢ IMPULSO arremesso de 8,5m · ◎ SONAR revela inimigos através de paredes
  - **GRAVE · VANGUARDA** (−6% velocidade) — ⛨ COURAÇA escudo temporal de 50 · ✸ ONDA DE CHOQUE fere e arremessa quem está perto
- **Economia dB** — créditos por abates, vitórias e derrotas (cap 9.000); compre arsenais (STACCATO, LEGATO) e trajes com escudo.
- **Rodadas** — fase de compra → ação → desfecho; primeira facção a 7 rodadas vence a partida.
- **Diapasão** — o objetivo: plante no Site A ou B e proteja a carga por 40s.
- **LEGATO** — rifle com padrão de spray determinístico (treino de recuo real); STACCATO — pistola grátis de 12 balas.
- **Operadores DIRAC** — bots com visão em cone, audição de tiros, strafe em combate, retake e silenciamento do Diapasão.
- **Esquadrão 5v5 (v0.12)** — quatro aliados CORO (TENOR, ALTO, BAIXO, CONTRA) lutam ao seu lado: seguem sua formação, engajam DIRACs à vista, defendem o site plantado e caçam sozinhos se você cair. Kill feed no canto, barra do esquadrão no HUD, modo espectador quando você é abatido e vitória por varrida (`DIRAC VARRIDO DO MAPA`). Os DIRACs também cresceram para cinco — e agora revidam quando baleados durante o retake.
- **Polimento e equilíbrio (v0.13)** — **minimapa tático** com a planta real do SUBSOLO (paredes dos colisores, seta de orientação, esquadrão, sites e Diapasão plantado; DIRACs acendem ao atirar, levar dano ou serem revelados pelo SONAR — sem wallhack); **dificuldade escalonada**: cada ponto DIRAC no placar deixa o esquadrão inimigo um nível mais afiado (precisão, reação, dano, percepção e retake — indicador `AMEAÇA` no HUD); **resgate da carga**: se você cair com o Diapasão, o aliado mais próximo pega a carga e planta por você (`◈ TENOR LEVA A CARGA`) — e se ele cair, outro assume; **placar de combate** no fim de cada rodada (abates por operador, CORO × DIRAC).
- **Dois mapas + seleção (v0.14)** — escolha o campo antes da partida na mesma tela do operador:
  - **SUBSOLO** — estação de metrô desativada, 40×32m, três lanes simétricas e corredores curtos
  - **PALCO** — casa de espetáculos desativada, 44×34m, assimétrica: foyer com três portas, plateia coberta de poltronas, camarins a oeste, galeria a leste e o site B em cima do palco atrás de uma mureta baixa de 1,1m (dá para atirar por cima, não para passar)
  - toda a IA (rotas de patrulha, retakes, defesa e resgate da carga) e o minimapa leem a planta do mapa — `config/maps.ts` é a fonte da verdade; as cenas cuidam só da arte
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
- [ ] **16+** — Mais armas/agentes, modo treino dedicado, clima/variantes de mapa

## 🔧 Como o APK é feito (automático)

Push de uma **tag** `vX.Y.Z` → GitHub Actions roda `npm ci` → `expo prebuild` (a assinatura release é injetada pelo plugin `plugins/with-signing.js`, que liga o keystore de `signing/`) → `gradlew assembleRelease` → APK publicado em **Releases**. Também dá rodar manualmente na aba **Actions → APK → Run workflow** (o APK sai como artifact). Ninguém precisa de PC: o build acontece na nuvem do GitHub.

## 🛠️ Stack

- Expo SDK 57 / React Native 0.86 / React 19 / TypeScript
- three.js **0.162** (última com suporte WebGL1 — o `expo-gl` nativo só expõe WebGL1; versões mais novas causam crash de render 3D)
- expo-gl + expo-three (render nativo, não WebView)
- UI 100% overlay RN com ponte por objetos mutáveis (zero re-render por frame)

## 🔐 Nota sobre a assinatura

O repositório é público e o keystore de assinatura está versionado em `signing/` (com senha aleatória forte). Para um jogo sem publicação em lojas o risco é desprezível, mas se o PULSO crescer, migre o keystore para *GitHub Secrets* e gere um novo.
