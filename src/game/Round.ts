// RoundManager — máquina de estados da partida (Etapa 5).
//
// Fases:
//   buy  → compras em dB (10s, ou botão PRONTO)
//   live → ação: plantar o Diapasão no SITE A/B e proteger a carga (75s)
//          plantado → carga do PULSO (40s) → ponto CORO
//          tempo esgotado sem plant → ponto DIRAC
//          Diapasão silenciado por um DIRAC → ponto DIRAC (Etapa 7)
//   end  → banner do resultado (5s)
//   over → partida encerrada (primeiro a 7)

import { ECONOMY, ROUND } from '../config/constants';
import { gameStats, hudEvents, inputState, playerVitals, roundState } from '../core/state';

interface Hooks {
  /** chamado no início de cada rodada: resetar player, alvos, arma */
  onRoundStart: () => void;
  /** chamado quando o Diapasão é plantado com sucesso */
  onPlanted: (site: 'A' | 'B') => void;
}

export class RoundManager {
  private hooks: Hooks;
  private lastPlantTick = 0; // Etapa 11: cadência dos pings do canal de plantio

  constructor(hooks: Hooks) {
    this.hooks = hooks;
    this.resetMatch();
  }

  resetMatch() {
    roundState.roundNum = 1;
    roundState.scoreCORO = 0;
    roundState.scoreDIRAC = 0;
    roundState.dB = ECONOMY.START_DB;
    roundState.weapon = 'STACCATO'; // grátis, sempre disponível
    roundState.shield = 0;
    playerVitals.hp = 100;
    playerVitals.shield = 0;
    roundState.matchWinner = null;
    roundState.outcome = null;
    this.startRound();
  }

  private startRound() {
    roundState.phase = 'buy';
    roundState.phaseEndsAt = performance.now() + ROUND.BUY_MS;
    roundState.carrying = true;
    roundState.planted = false;
    roundState.plantSite = null;
    roundState.plantProgress = 0;
    roundState.inSite = null;
    roundState.outcome = null;
    gameStats.defusing = false;
    gameStats.defuseProgress = 0;
    playerVitals.hp = 100;
    playerVitals.shield = roundState.shield;
    this.hooks.onRoundStart();
  }

  /** Chamado todo frame pelo loop de jogo. */
  update(now: number, dtMs: number, moved: boolean) {
    switch (roundState.phase) {
      case 'buy': {
        if (inputState.readyQueued || now >= roundState.phaseEndsAt) {
          inputState.readyQueued = false;
          roundState.phase = 'live';
          roundState.phaseEndsAt = now + ROUND.LIVE_MS;
        }
        break;
      }

      case 'live': {
        if (roundState.planted) {
          // carga do PULSO em andamento
          if (now >= roundState.chargeEndsAt) {
            this.endRound('pulse');
          }
          break;
        }

        // canal de plantio: precisa segurar o botão dentro do site,
        // sem se mover (mover cancela e decai o progresso) e estar vivo
        const canPlant =
          inputState.plantHeld &&
          roundState.inSite !== null &&
          roundState.carrying &&
          !moved &&
          playerVitals.hp > 0;
        if (canPlant) {
          roundState.plantProgress += dtMs / ROUND.PLANT_MS;
          // Etapa 11: o Diapasão canta enquanto é plantado (ping a cada 650 ms)
          if (now - this.lastPlantTick >= 650) {
            this.lastPlantTick = now;
            hudEvents.emit({ type: 'plantTick' });
          }
          if (roundState.plantProgress >= 1) {
            roundState.plantProgress = 1;
            this.plant(now);
          }
        } else if (roundState.plantProgress > 0) {
          roundState.plantProgress = Math.max(0, roundState.plantProgress - dtMs / 900);
        }

        // tempo da fase de ação
        if (!roundState.planted && now >= roundState.phaseEndsAt) {
          this.endRound('time');
        }
        break;
      }

      case 'end': {
        if (now >= roundState.phaseEndsAt) {
          if (roundState.matchWinner) {
            roundState.phase = 'over';
          } else {
            roundState.roundNum++;
            this.startRound();
          }
        }
        break;
      }

      default:
        break;
    }

    // reinício pedido pela tela de fim de partida
    if (roundState.phase === 'over' && inputState.restartQueued) {
      inputState.restartQueued = false;
      this.resetMatch();
    }
  }

  private plant(now: number) {
    const site = roundState.inSite as 'A' | 'B';
    roundState.planted = true;
    roundState.plantSite = site;
    roundState.carrying = false;
    roundState.chargeEndsAt = now + ROUND.CHARGE_MS;
    hudEvents.emit({ type: 'planted', site });
    this.hooks.onPlanted(site);
  }

  /** Jogador abatido em combate — encerra a rodada com ponto DIRAC. */
  killPlayer() {
    if (roundState.phase === 'live') {
      this.endRound('elim');
    }
  }

  /** Um operador DIRAC silenciou o Diapasão (Etapa 7) — ponto DIRAC. */
  silence() {
    if (roundState.phase === 'live' && roundState.planted) {
      this.endRound('silenced');
    }
  }

  private endRound(outcome: 'pulse' | 'time' | 'elim' | 'silenced') {
    roundState.phase = 'end';
    roundState.outcome = outcome;
    roundState.phaseEndsAt = performance.now() + ROUND.END_MS;

    if (outcome === 'pulse') {
      roundState.scoreCORO++;
      roundState.dB += ECONOMY.WIN_DB;
    } else {
      roundState.scoreDIRAC++;
      roundState.dB += ECONOMY.LOSS_DB;
    }
    roundState.dB = Math.min(ECONOMY.MAX_DB, roundState.dB);

    hudEvents.emit({
      type: 'roundEnd',
      outcome,
      coro: roundState.scoreCORO,
      dirac: roundState.scoreDIRAC,
      dB: roundState.dB,
    });

    if (
      roundState.scoreCORO >= ROUND.ROUNDS_TO_WIN ||
      roundState.scoreDIRAC >= ROUND.ROUNDS_TO_WIN
    ) {
      roundState.matchWinner = roundState.scoreCORO > roundState.scoreDIRAC ? 'CORO' : 'DIRAC';
      hudEvents.emit({ type: 'matchOver', winner: roundState.matchWinner });
    }
  }

  /** Abate confirmado (campo de tiro) — paga dB durante a fase de ação. */
  payKill() {
    if (roundState.phase !== 'live') return;
    roundState.dB = Math.min(ECONOMY.MAX_DB, roundState.dB + ECONOMY.KILL_DB);
  }
}
