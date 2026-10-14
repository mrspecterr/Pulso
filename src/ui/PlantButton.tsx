import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BTN, CSS } from '../config/constants';
import { inputState, roundState } from '../core/state';

const MONO = 'monospace';

/**
 * PlantButton — canal de plantio do Diapasão (Etapa 5).
 * APENAS VISUAL (Etapa 10): o toque vem da camada única de input; a barra
 * acompanha o progresso real do canal e o brilho segue o dedo (plantHeld).
 */
export default function PlantButton() {
  const [prog, setProg] = useState(0);
  const [site, setSite] = useState<'A' | 'B' | null>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setProg(roundState.plantProgress);
      setSite(roundState.inSite);
      setHeld(inputState.plantHeld);
    }, 80);
    return () => clearInterval(id);
  }, []);

  return (
    <View pointerEvents="none" style={[styles.btn, prog > 0 || held ? styles.btnOn : styles.btnIdle]}>
      <Text style={styles.label}>
        PLANTAR{site ? ` · SITE ${site}` : ''}
      </Text>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${Math.min(1, prog) * 100}%` }]} />
      </View>
      <Text style={styles.hint}>segure sem mover</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: BTN.PLANT.right,
    bottom: BTN.PLANT.bottom,
    width: BTN.PLANT.w,
    minHeight: BTN.PLANT.h,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: CSS.TEAL,
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
