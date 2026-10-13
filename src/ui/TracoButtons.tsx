import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CSS, TRACOS } from '../config/constants';
import { inputState, tracoState } from '../core/state';

const MONO = 'monospace';

interface Snap {
  cenzura: number;
  barreira: number;
  cdLeft: number; // ms restantes do cooldown da CENZURA
}

function read(): Snap {
  return {
    cenzura: tracoState.cenzura,
    barreira: tracoState.barreira,
    cdLeft: Math.max(0, tracoState.cenzuraReadyAt - performance.now()),
  };
}

/**
 * TracoButtons (Etapa 7) — botões dos Traços do agente.
 *
 *   ◈ CENZURA — cega operadores DIRAC com linha de visão (2 usos, 8s de
 *               recarga entre usos); interrompe silenciamento.
 *   ▤ BARREIRA — muro de ressonância que bloqueia visão, balas e
 *               passagem por 5s (1 uso).
 */
export default function TracoButtons() {
  const [s, setS] = useState<Snap>(() => read());

  useEffect(() => {
    const id = setInterval(() => setS(read()), 100);
    return () => clearInterval(id);
  }, []);

  const cenzReady = s.cenzura > 0 && s.cdLeft <= 0;
  const barrReady = s.barreira > 0;

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          cenzReady ? styles.cenzOn : styles.off,
          pressed && cenzReady ? styles.pressed : null,
        ]}
        onPressIn={() => {
          if (cenzReady) inputState.tracoQueued = 'cenzura';
        }}
      >
        <Text style={[styles.glyph, cenzReady ? styles.cenzGlyph : styles.dimGlyph]}>◈</Text>
        <Text style={[styles.label, cenzReady ? styles.cenzTxt : styles.dimTxt]}>CENZURA</Text>
        {s.cdLeft > 0 && s.cenzura > 0 ? (
          <Text style={styles.cd}>{(s.cdLeft / 1000).toFixed(1)}s</Text>
        ) : (
          <Text style={styles.uses}>×{s.cenzura}</Text>
        )}
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.btn,
          styles.barr,
          barrReady ? styles.barrOn : styles.off,
          pressed && barrReady ? styles.pressed : null,
        ]}
        onPressIn={() => {
          if (barrReady) inputState.tracoQueued = 'barreira';
        }}
      >
        <Text style={[styles.glyph, barrReady ? styles.barrGlyph : styles.dimGlyph]}>▤</Text>
        <Text style={[styles.label, barrReady ? styles.barrTxt : styles.dimTxt]}>BARREIRA</Text>
        <Text style={styles.uses}>×{s.barreira}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: 34,
    width: 72,
    height: 72,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,13,18,0.82)',
  },
  // CENZURA acima (junto da munição), BARREIRA logo acima dela
  cenzOn: { bottom: 208, borderColor: '#F2FBFF' },
  barr: { bottom: 290 },
  barrOn: { borderColor: CSS.TEAL },
  off: { borderColor: 'rgba(122,139,153,0.35)', opacity: 0.55 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  glyph: { fontSize: 18, lineHeight: 22 },
  cenzGlyph: { color: '#F2FBFF' },
  barrGlyph: { color: CSS.TEAL },
  dimGlyph: { color: CSS.TEXT_DIM },
  label: { fontFamily: MONO, fontSize: 8, letterSpacing: 1, marginTop: 1 },
  cenzTxt: { color: '#F2FBFF' },
  barrTxt: { color: CSS.TEAL },
  dimTxt: { color: CSS.TEXT_DIM },
  uses: { fontFamily: MONO, fontSize: 9, color: '#AFC2CE', marginTop: 1 },
  cd: { fontFamily: MONO, fontSize: 9, color: CSS.MAGENTA, marginTop: 1 },
});
