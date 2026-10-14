// AudioBridge (Etapa 11) — traduz eventos do jogo em SOM e vibração.
//
// Componente sem visual: assina o event-bus do HUD e dispara o motor de
// áudio (SFX) e o expo-haptics. Centralizar aqui mantém o game loop limpo
// de dependências de feedback. A haptics tem rate-limit: rajadas do DIRAC
// não transformam o celular num massificador.

import { useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { hudEvents, roundState } from './state';
import { SFX } from '../game/Audio';

const HAPTIC_MIN_MS = 130; // intervalo mínimo entre vibrações
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export default function AudioBridge() {
  useEffect(() => {
    let lastHaptic = 0;

    const buzz = (style: Haptics.ImpactFeedbackStyle) => {
      const now = performance.now();
      if (now - lastHaptic < HAPTIC_MIN_MS) return;
      lastHaptic = now;
      Haptics.impactAsync(style).catch(() => {});
    };

    const off = hudEvents.subscribe((e) => {
      switch (e.type) {
        case 'shot':
          SFX.play(
            roundState.weapon === 'LEGATO' ? 'fire_legato' : 'fire_staccato',
            0.9,
            rand(0.94, 1.07) // variação de timbre por tiro
          );
          break;

        case 'botShot': {
          // tiro inimigo: mais perto, mais alto
          const vol = Math.max(0.16, 1 - e.dist / 30) * 0.8;
          SFX.play('fire_bot', vol, rand(0.9, 1.05));
          break;
        }

        case 'hit':
          buzz(Haptics.ImpactFeedbackStyle.Light);
          SFX.play(e.head ? 'headshot' : 'hit', 0.8, rand(0.96, 1.08));
          break;

        case 'kill':
          buzz(Haptics.ImpactFeedbackStyle.Medium);
          SFX.play('kill', 0.95);
          break;

        case 'reload':
          SFX.play('reload_click', 0.8);
          break;

        case 'reloadDone':
          SFX.play('reload_slam', 0.85);
          break;

        case 'dry':
          SFX.play('dry', 0.75);
          break;

        case 'planted':
          buzz(Haptics.ImpactFeedbackStyle.Heavy);
          SFX.play('planted', 1);
          break;

        case 'plantTick':
          SFX.play('plant_tick', 0.7);
          break;

        case 'playerHit':
          buzz(Haptics.ImpactFeedbackStyle.Heavy);
          SFX.play('hurt', 0.95);
          break;

        case 'traco':
          buzz(Haptics.ImpactFeedbackStyle.Light);
          SFX.play('traco', 0.85);
          break;

        case 'roundEnd': {
          if (e.outcome === 'pulse') {
            // o PULSO estabeleceu: detonação e, depois do estrondo, o motivo
            buzz(Haptics.ImpactFeedbackStyle.Heavy);
            SFX.play('detonate', 1);
            setTimeout(() => SFX.play('round_win', 0.9), 1500);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } else {
            if (e.outcome === 'silenced') SFX.play('silenced', 0.9);
            setTimeout(() => SFX.play('round_lose', 0.9), e.outcome === 'silenced' ? 700 : 250);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          }
          break;
        }

        case 'matchOver':
          setTimeout(() => SFX.play(e.winner === 'CORO' ? 'round_win' : 'round_lose', 1), 2600);
          break;
      }
    });
    return off;
  }, []);

  return null;
}
