# PULSO

**FPS tático 5v5 para Android** — conceito original inspirado na mecânica e na linguagem visual do Valorant, construído do zero em React Native + three.js (render 3D nativo via OpenGL).

> Duas facções em guerra pelo subsolo: **CORO** (atacantes) contra **DIRAC** (defensores). Plante o **Diapasão**, faça a carga ressoar e estabeleça o Pulso — ou elimine todos que se colocarem no caminho.

---

## 📥 Como jogar (sem PC, sem Expo Go)

1. Abra **[github.com/mrspecterr/Pulso/releases](https://github.com/mrspecterr/Pulso/releases)** no navegador do celular.
2. Baixe o arquivo `PULSO-vX.Y.Z.apk` da versão mais recente.
3. Toque no arquivo baixado. Se o Android pedir, permita **instalar apps de fontes desconhecidas**.
4. Jogue. 🎮

Cada push na branch `main` gera automaticamente um APK novo via GitHub Actions — é só voltar na aba Releases pra atualizar (instala por cima da versão anterior, mantendo a mesma assinatura).

## 🎮 Controles

| Ação | Toque |
|---|---|
| Mover | Joystick na metade esquerda |
| Mirar | Arrastar na metade direita |
| Atirar | Segurar o botão de fogo (automático) |
| Recarregar | Botão `R` |
| Plantar Diapasão | Segurar o botão `◈` dentro do site |
| Comprar | Loja durante a fase de compra |

## 🧩 Sistemas do jogo

- **Agentes CORO (v0.8)** — escolha o operador antes da partida; cada kit tem dois Traços e uma velocidade própria:
  - **MUDO · TÁTICO** — ◈ CENZURA cega operadores com linha de visão · ▤ BARREIRA ergue muro de ressonância
  - **ECO · BATEDORA** (+10% velocidade) — ⇢ IMPULSO arremesso de 8,5m · ◎ SONAR revela inimigos através de paredes
  - **GRAVE · VANGUARDA** (−6% velocidade) — ⛨ COURAÇA escudo temporal de 50 · ✸ ONDA DE CHOQUE fere e arremessa quem está perto
- **Economia dB** — créditos por abates, vitórias e derrotas (cap 9.000); compre arsenais (STACCATO, LEGATO) e trajes com escudo.
- **Rodadas** — fase de compra → ação → desfecho; primeira facção a 7 rodadas vence a partida.
- **Diapasão** — o objetivo: plante no Site A ou B e proteja a carga por 40s.
- **LEGATO** — rifle com padrão de spray determinístico (treino de recuo real); STACCATO — pistola grátis de 12 balas.
- **Operadores DIRAC** — bots com visão em cone, audição de tiros, strafe em combate, retake e silenciamento do Diapasão.
- **Mapa SUBSOLO** — 40×32m com corredores, sites A/B, caixotes e colisão real.

## 🗺️ Roadmap

- [x] **1** — Motor 3D (OpenGL nativo, câmera FPS)
- [x] **2** — Controles mobile (joystick, mira por arrasto, fogo)
- [x] **3** — Mapa SUBSOLO com colisão AABB e balas por raycast
- [x] **4** — Gunplay do LEGATO (spray, recarga, dano/headshot, alvos)
- [x] **5** — Economia dB, rodadas, plantio do Diapasão, loja
- [x] **6** — Bots DIRAC com IA (patrulha, percepção, combate)
- [x] **7** — Traços (◈ CENZURA cega · ▤ BARREIRA ergue muro) + DIRACs que silenciam o Diapasão
- [x] **8** — Agentes jogáveis com kits próprios (MUDO, ECO, GRAVE) + troca de agente entre partidas
- [ ] **9+** — Áudio e feedback, matchmaking 5v5, polimento

## 🔧 Como o APK é feito (automático)

Push na `main` → GitHub Actions roda `npm ci` → `expo prebuild` → `gradlew assembleRelease` (assinado) → APK publicado em **Releases**. Ninguém precisa de PC: o build acontece na nuvem do GitHub.

## 🛠️ Stack

- Expo SDK 57 / React Native 0.86 / React 19 / TypeScript
- three.js **0.162** (última com suporte WebGL1 — o `expo-gl` nativo só expõe WebGL1; versões mais novas causam crash de render 3D)
- expo-gl + expo-three (render nativo, não WebView)
- UI 100% overlay RN com ponte por objetos mutáveis (zero re-render por frame)

## 🔐 Nota sobre a assinatura

O repositório é público e o keystore de assinatura está versionado em `signing/` (com senha aleatória forte). Para um jogo sem publicação em lojas o risco é desprezível, mas se o PULSO crescer, migre o keystore para *GitHub Secrets* e gere um novo.
