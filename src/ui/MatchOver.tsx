import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CSS, ROUND } from '../config/constants';
import { gameStats, inputState, roundState } from '../core/state';
import { getLastRewards } from '../client/profile';
import { SFX } from '../game/Audio';
import type { RankedOutcome } from '../client/ranked';

const MONO = 'monospace';

/**
 * MatchOver — fim de partida (primeiro a 7). Mostra o resultado e
 * estatísticas; REINICIAR recomeça a partida do zero.
 * Etapa 17: as missões/conquistas que a partida acabou de fechar
 * aparecem aqui mesmo — a recompensa na hora em que ela acontece.
 * Etapa 19: o cartão da PATENTE — dB ganho/perdido, promoção e
 * rebaixamento, tudo na cor da patente nova.
 */
export default function MatchOver() {
  const win = roundState.matchWinner === 'CORO';
  const acc = gameStats.shots > 0 ? Math.round((gameStats.hits / gameStats.shots) * 100) : 0;
  const rewards = getLastRewards();
  const anyReward =
    rewards.unlocked.length > 0 || rewards.missionsDone.length > 0;
  const rk = rewards.ranked;

  return (
    <View style={styles.root}>
      <Text style={[styles.result, win ? styles.teal : styles.magenta]}>
        {win ? 'VITÓRIA CORO' : 'DERROTA · DIRAC'}
      </Text>
      <Text style={styles.score}>
        {roundState.scoreCORO} — {roundState.scoreDIRAC}
      </Text>
      <Text style={styles.line}>primeiro a {ROUND.ROUNDS_TO_WIN} selou a partida</Text>

      <View style={styles.stats}>
        <Text style={styles.statLine}>
          abates {gameStats.kills} · headshots {gameStats.headshots} · precisão {acc}%
        </Text>
        <Text style={styles.statLine}>disparos {gameStats.shots}</Text>
      </View>

      {/* Etapa 17: o que esta partida desbloqueou */}
      {anyReward && (
        <View style={styles.rewards}>
          {rewards.unlocked.map((nome) => (
            <Text key={nome} style={styles.rewardLine}>
              ★ CONQUISTA · {nome}
            </Text>
          ))}
          {rewards.missionsDone.map((label) => (
            <Text key={label} style={styles.rewardMission}>
              ✓ MISSÃO · {label}
            </Text>
          ))}
          {rewards.xpGained > 0 && (
            <Text style={styles.rewardXp}>+{rewards.xpGained} XP DE MISSÕES</Text>
          )}
        </View>
      )}

      {/* Etapa 19: a patente — o que a partida fez com o dB */}
      {rk && <RankedCard rk={rk} />}

      <View style={styles.rowBtns}>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnP]}
          onPress={() => {
            SFX.play('ui', 0.8);
            inputState.restartQueued = true;
          }}
        >
          <Text style={styles.btnTxt}>⟲ NOVA PARTIDA</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btnAlt, pressed && styles.btnAltP]}
          onPress={() => {
            SFX.play('ui', 0.8);
            inputState.agentSelectQueued = true;
          }}
        >
          <Text style={styles.btnAltTxt}>⌂ VOLTAR AO HUB</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Cartão de patente pós-partida (Etapa 19). */
function RankedCard({ rk }: { rk: RankedOutcome }) {
  const up = rk.delta >= 0;
  return (
    <View style={rk2.card}>
      <View style={rk2.head}>
        <Text style={[rk2.tier, { color: rk.corAfter }]}>{rk.labelAfter}</Text>
        <Text style={[rk2.delta, { color: up ? CSS.TEAL : CSS.MAGENTA }]}>
          {up ? '+' : ''}{rk.delta} dB
        </Text>
      </View>
      <Text style={rk2.ratings}>
        {rk.ratingBefore} → {rk.ratingAfter} dB
        {rk.calibrating ? ` · calibração ${rk.placementsLeft === 0 ? 'concluída' : `restam ${rk.placementsLeft}`}` : ''}
      </Text>
      {rk.placedNow && (
        <Text style={rk2.placed}>AFINAÇÃO CONCLUÍDA — PATENTE SELADA</Text>
      )}
      {rk.promoted && !rk.placedNow && (
        <Text style={[rk2.move, { color: CSS.TEAL }]}>▲ SUBIU DE PATENTE</Text>
      )}
      {rk.demoted && (
        <Text style={[rk2.move, { color: CSS.MAGENTA }]}>▼ CAIU DE PATENTE</Text>
      )}
    </View>
  );
}

const rk2 = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.3)',
    backgroundColor: 'rgba(11,15,20,0.8)',
    paddingHorizontal: 22,
    paddingVertical: 9,
    marginTop: 16,
    alignItems: 'center',
  },
  head: { flexDirection: 'row', alignItems: 'baseline' },
  tier: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 4,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  delta: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginLeft: 12,
  },
  ratings: { fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, color: '#9FB4C2', marginTop: 3 },
  placed: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#FFD37A',
    marginTop: 4,
  },
  move: {
    fontFamily: MONO,
    fontSize: 9.5,
    fontWeight: 'bold',
    letterSpacing: 2.5,
    marginTop: 4,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(5,8,12,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  result: { fontFamily: MONO, fontSize: 30, fontWeight: 'bold', letterSpacing: 8 },
  teal: { color: CSS.TEAL },
  magenta: { color: CSS.MAGENTA },
  score: { fontFamily: MONO, fontSize: 40, fontWeight: 'bold', color: '#F2FBFF', marginTop: 8 },
  line: { fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: CSS.TEXT_DIM, marginTop: 4 },
  stats: { marginTop: 22, alignItems: 'center' },
  statLine: { fontFamily: MONO, fontSize: 12, color: '#AFC2CE', letterSpacing: 1, marginTop: 3 },
  rewards: { marginTop: 16, alignItems: 'center' },
  rewardLine: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: CSS.TEAL,
    marginTop: 4,
    textShadowColor: 'rgba(45,226,198,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  rewardMission: { fontFamily: MONO, fontSize: 10, letterSpacing: 1.5, color: '#FFD37A', marginTop: 3 },
  rewardXp: { fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: CSS.TEXT_DIM, marginTop: 6 },
  rowBtns: { flexDirection: 'row', alignItems: 'center', marginTop: 26 },
  btn: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: CSS.TEAL,
    backgroundColor: 'rgba(45,226,198,0.15)',
    paddingVertical: 12,
    paddingHorizontal: 34,
  },
  btnP: { backgroundColor: 'rgba(45,226,198,0.4)' },
  btnTxt: { fontFamily: MONO, fontSize: 15, fontWeight: 'bold', letterSpacing: 4, color: CSS.TEAL },
  btnAlt: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(159,216,232,0.6)',
    backgroundColor: 'rgba(159,216,232,0.10)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginLeft: 12,
  },
  btnAltP: { backgroundColor: 'rgba(159,216,232,0.3)' },
  btnAltTxt: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 3,
    color: '#9FD8E8',
  },
});
