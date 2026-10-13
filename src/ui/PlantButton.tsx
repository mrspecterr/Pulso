import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CSS } from '../config/constants';
import { inputState, roundState } from '../core/state';

const MONO = 'monospace';

/**
 * PlantButton — canal de plantio do Diapasão (Etapa 5).
 * Aparece quando o jogador está numa zona de site na fase de ação.
 * Segurar planta; mover ou soltar cancela (o progresso decai no loop).
 */
export default function PlantButton() {
  const [prog, setProg] = useState(0);
  const [site, setSite] = useState<'A' | 'B' | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setProg(roundState.plantProgress);
      setSite(roundState.inSite);
    }, 80);
    return () => clearInterval(id);
  }, []);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        prog > 0 || pressed ? styles.btnOn : styles.btnIdle,
      ]}
      onPressIn={() => {
        inputState.plantHeld = true;
      }}
      onPressOut={() => {
        inputState.plantHeld = false;
      }}
    >
      <Text style={styles.label}>
        PLANTAR{site ? ` · SITE ${site}` : ''}
      </Text>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${Math.min(1, prog) * 100}%` }]} />
      </View>
      <Text style={styles.hint}>segure sem mover</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: 150,
    bottom: 128,
    width: 150,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: CSS.TEAL,
    backgroundColor: 'rgba(9,13,18,0.85)',
    alignItems: 'center',
    paddingVertical: 10,
  },
  btnIdle: { backgroundColor: 'rgba(45,226,198,0.12)' },
  btnOn: { backgroundColor: 'rgba(45,226,198,0.35)' },
  label: { fontFamily: MONO, fontSize: 13, fontWeight: 'bold', letterSpacing: 2, color: CSS.TEAL },
  barBg: {
    width: '86%',
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(45,226,198,0.18)',
    marginTop: 7,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: CSS.TEAL },
  hint: { fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: CSS.TEXT_DIM, marginTop: 5 },
});
