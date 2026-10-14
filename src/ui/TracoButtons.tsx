import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AGENTS, BTN, CSS, type TracoKey } from '../config/constants';
import { sessionState, tracoState } from '../core/state';

const MONO = 'monospace';

// cor de destaque por Traço (borda, glifo e texto quando pronto)
const TRACO_COLOR: Record<TracoKey, string> = {
  cenzura: '#F2FBFF',
  barreira: CSS.TEAL,
  impulso: CSS.TEAL,
  sonar: '#9FD8E8',
  couraca: '#FFB454',
  onda: CSS.MAGENTA,
  cadencia: '#B48CFF',
  ritardando: '#8FB7FF',
};

interface Snap {
  uses: Record<TracoKey, number>;
  cdLeft: Record<TracoKey, number>;
}

function read(): Snap {
  const now = performance.now();
  const uses = { ...tracoState.uses } as Record<TracoKey, number>;
  const cdLeft = {} as Record<TracoKey, number>;
  for (const k of Object.keys(uses) as TracoKey[]) {
    cdLeft[k] = Math.max(0, tracoState.readyAt[k] - now);
  }
  return { uses, cdLeft };
}

/**
 * TracoButtons (Etapa 7/8) — APENAS VISUAL (Etapa 10).
 * Os toques chegam pela camada única de input; aqui refletimos usos e
 * recarga por polling (mesma cadência de antes).
 */
export default function TracoButtons() {
  const [s, setS] = useState<Snap>(() => read());
  const [agentKey] = useState(() => sessionState.agent);
  const A = AGENTS[agentKey];

  useEffect(() => {
    const id = setInterval(() => setS(read()), 100);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {A.tracos.map((spec, i) => {
        const ready = s.uses[spec.key] > 0 && s.cdLeft[spec.key] <= 0;
        const color = TRACO_COLOR[spec.key];
        const pos = i === 0 ? BTN.TRACO1 : BTN.TRACO2;
        return (
          <View
            key={spec.key}
            pointerEvents="none"
            style={[
              styles.btn,
              { right: pos.right, bottom: pos.bottom, width: pos.w, height: pos.h },
              { borderColor: ready ? color : 'rgba(122,139,153,0.35)' },
              !ready && styles.off,
            ]}
          >
            <Text style={[styles.glyph, { color: ready ? color : CSS.TEXT_DIM }]}>
              {spec.glyph}
            </Text>
            <Text style={[styles.label, { color: ready ? color : CSS.TEXT_DIM }]}>
              {spec.label}
            </Text>
            {s.cdLeft[spec.key] > 0 && s.uses[spec.key] > 0 ? (
              <Text style={styles.cd}>{(s.cdLeft[spec.key] / 1000).toFixed(1)}s</Text>
            ) : (
              <Text style={styles.uses}>×{s.uses[spec.key]}</Text>
            )}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,13,18,0.82)',
  },
  off: { opacity: 0.55 },
  glyph: { fontSize: 18, lineHeight: 22 },
  label: { fontFamily: MONO, fontSize: 8, letterSpacing: 1, marginTop: 1 },
  uses: { fontFamily: MONO, fontSize: 9, color: '#AFC2CE', marginTop: 1 },
  cd: { fontFamily: MONO, fontSize: 9, color: CSS.MAGENTA, marginTop: 1 },
});
