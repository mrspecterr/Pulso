// KillFeed (Etapa 12) — o feed de abates do 5v5.
//
// Coluna no canto superior direito: "QUEM ▸ QUEM CAIU", CORES em teal,
// DIRAC em magenta. Mantém no máximo 4 entradas; cada uma some sozinha
// depois de 4,5s. Componente puro de HUD (assina o event-bus).

import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CSS } from '../config/constants';
import { hudEvents } from '../core/state';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

// quem é do lado CORO (o resto é DIRAC)
const CORO_SIDE = new Set(['VOCÊ', 'TENOR', 'ALTO', 'BAIXO', 'CONTRA']);

interface Entry {
  id: number;
  killer: string;
  victim: string;
}

let nextId = 1;

export default function KillFeed() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const off = hudEvents.subscribe((e) => {
      if (e.type !== 'feed') return;
      const entry: Entry = { id: nextId++, killer: e.killer, victim: e.victim };
      setEntries((prev) => [entry, ...prev].slice(0, 4));
      setTimeout(() => {
        setEntries((prev) => prev.filter((p) => p.id !== entry.id));
      }, 4500);
    });
    return off;
  }, []);

  if (entries.length === 0) return null;

  return (
    <View pointerEvents="none" style={styles.col}>
      {entries.map((en) => (
        <View key={en.id} style={styles.row}>
          <Text style={[styles.name, CORO_SIDE.has(en.killer) ? styles.teal : styles.magenta]}>
            {en.killer}
          </Text>
          <Text style={styles.arrow}> ▸ </Text>
          <Text style={[styles.name, CORO_SIDE.has(en.victim) ? styles.teal : styles.magenta]}>
            {en.victim}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  col: {
    position: 'absolute',
    top: 226, // abaixo do minimapa tático (Etapa 13)
    right: 18,
    alignItems: 'flex-end',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  name: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  teal: { color: CSS.TEAL },
  magenta: { color: CSS.MAGENTA },
  arrow: { fontFamily: MONO, fontSize: 10, color: CSS.TEXT_DIM },
});
