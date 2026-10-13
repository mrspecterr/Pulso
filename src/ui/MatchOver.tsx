import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CSS, ROUND } from '../config/constants';
import { gameStats, inputState, roundState } from '../core/state';

const MONO = 'monospace';

/**
 * MatchOver — fim de partida (primeiro a 7). Mostra o resultado e
 * estatísticas; REINICIAR recomeça a partida do zero.
 */
export default function MatchOver() {
  const win = roundState.matchWinner === 'CORO';
  const acc = gameStats.shots > 0 ? Math.round((gameStats.hits / gameStats.shots) * 100) : 0;

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

      <View style={styles.rowBtns}>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnP]}
          onPress={() => {
            inputState.restartQueued = true;
          }}
        >
          <Text style={styles.btnTxt}>⟲ NOVA PARTIDA</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btnAlt, pressed && styles.btnAltP]}
          onPress={() => {
            inputState.agentSelectQueued = true;
          }}
        >
          <Text style={styles.btnAltTxt}>⇄ TROCAR AGENTE</Text>
        </Pressable>
      </View>
    </View>
  );
}

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
