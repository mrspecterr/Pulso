import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AGENTS, CSS, type TracoKey } from '../config/constants';
import { inputState, sessionState, tracoState } from '../core/state';

const MONO = 'monospace';

// cor de destaque por Traço (borda, glifo e texto quando pronto)
const TRACO_COLOR: Record<TracoKey, string> = {
  cenzura: '#F2FBFF',
  barreira: CSS.TEAL,
  impulso: CSS.TEAL,
  sonar: '#9FD8E8',
  couraca: '#FFB454',
  onda: CSS.MAGENTA,
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
 * TracoButtons (Etapa 7/8) — botões dos dois Traços do agente em jogo.
 * O kit vem do agente escolhido na sessão (MUDO, ECO ou GRAVE); cada botão
 * mostra usos restantes e o cooldown, quando houver.
 */
export default function TracoButtons() {
  const [s, setS] = useState<Snap>(() => read());
  // agente fixo por partida; useState inicial evita re-render se mudar
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
        return (
          <Pressable
            key={spec.key}
            style={({ pressed }) => [
              styles.btn,
              i === 0 ? styles.first : styles.second,
              { borderColor: ready ? color : 'rgba(122,139,153,0.35)' },
              !ready && styles.off,
              pressed && ready ? styles.pressed : null,
            ]}
            onPressIn={() => {
              if (ready) inputState.tracoQueued = spec.key;
            }}
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
          </Pressable>
        );
      })}
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
  // primeiro Traço junto da munição; segundo logo acima
  first: { bottom: 208 },
  second: { bottom: 290 },
  off: { opacity: 0.55 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  glyph: { fontSize: 18, lineHeight: 22 },
  label: { fontFamily: MONO, fontSize: 8, letterSpacing: 1, marginTop: 1 },
  uses: { fontFamily: MONO, fontSize: 9, color: '#AFC2CE', marginTop: 1 },
  cd: { fontFamily: MONO, fontSize: 9, color: CSS.MAGENTA, marginTop: 1 },
});
