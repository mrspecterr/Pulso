import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AGENTS, CSS, ROUND, type AgentId } from '../config/constants';
import { MAPS, type MapId } from '../config/maps';
import { SFX } from '../game/Audio';
import { sessionState } from '../core/state';

const MONO = 'monospace';
const ORDER: AgentId[] = ['MUDO', 'ECO', 'GRAVE'];
const MAP_ORDER: MapId[] = ['SUBSOLO', 'PALCO'];

/**
 * AgentSelect (Etapa 8) — tela de escolha do operador CORO antes da
 * partida. Etapa 14: o MAPA também se escolhe aqui — cada agente tem função
 * própria e cada mapa pede uma leitura diferente do campo. A escolha vale a
 * partida inteira.
 */
export default function AgentSelect({ onPick }: { onPick: (a: AgentId, m: MapId) => void }) {
  const [sel, setSel] = useState<AgentId>('MUDO');
  const [map, setMap] = useState<MapId>(sessionState.map);
  const A = AGENTS[sel];
  const M = MAPS[map];

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.title}>PULSO</Text>
        <Text style={styles.sub}>ESCOLHA SEU OPERADOR CORO</Text>
      </View>

      <View style={styles.row}>
        {ORDER.map((id) => {
          const ag = AGENTS[id];
          const active = sel === id;
          return (
            <Pressable
              key={id}
              style={({ pressed }) => [
                styles.card,
                { borderColor: active ? ag.corCss : 'rgba(122,139,153,0.30)' },
                active && styles.cardOn,
                pressed && styles.cardP,
              ]}
              onPress={() => {
                if (sel !== id) SFX.play('ui', 0.45); // Etapa 11: navegação sonora sutil
                setSel(id);
              }}
            >
              <Text style={[styles.nome, { color: ag.corCss }]}>{ag.nome}</Text>
              <Text style={styles.funcao}>{ag.funcao}</Text>
              <Text style={styles.bio} numberOfLines={3}>
                {ag.bio}
              </Text>

              <View style={styles.tracoList}>
                {ag.tracos.map((t) => (
                  <View key={t.key} style={styles.tracoRow}>
                    <Text style={[styles.tracoGlyph, { color: ag.corCss }]}>{t.glyph}</Text>
                    <View style={styles.tracoTxt}>
                      <Text style={styles.tracoLabel}>{t.label}</Text>
                      <Text style={styles.tracoDesc} numberOfLines={2}>
                        {t.desc}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={styles.speed}>
                VELOCIDADE {ag.speedMul === 1 ? 'PADRÃO' : `${ag.speedMul > 1 ? '+' : ''}${Math.round((ag.speedMul - 1) * 100)}%`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Etapa 14: seletor de mapa */}
      <View style={styles.mapRow}>
        {MAP_ORDER.map((id) => {
          const m = MAPS[id];
          const active = map === id;
          return (
            <Pressable
              key={id}
              style={({ pressed }) => [
                styles.mapCard,
                { borderColor: active ? m.corCss : 'rgba(122,139,153,0.30)' },
                active && styles.mapCardOn,
                pressed && styles.mapCardP,
              ]}
              onPress={() => {
                if (map !== id) SFX.play('ui', 0.45);
                setMap(id);
              }}
            >
              <Text style={[styles.mapNome, { color: m.corCss }]}>{m.nome}</Text>
              <Text style={styles.mapTag}>{m.tagline}</Text>
              <Text style={styles.mapBio} numberOfLines={2}>
                {m.bio}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={({ pressed }) => [styles.go, pressed && styles.goP]}
        onPress={() => onPick(sel, map)}
      >
        <Text style={styles.goTxt}>ENTRAR NO {M.nome} COM {A.nome}</Text>
      </Pressable>
      <Text style={styles.foot}>
        5v5 no {M.nome.toLowerCase()} · primeiro a {ROUND.ROUNDS_TO_WIN} rodadas vence · a escolha vale a partida
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CSS.BG,
    paddingHorizontal: 26,
    paddingVertical: 14,
  },
  head: { alignItems: 'center' },
  title: {
    fontFamily: MONO,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 10,
    color: CSS.TEAL,
  },
  sub: { fontFamily: MONO, fontSize: 10, letterSpacing: 4, color: CSS.TEXT_DIM, marginTop: 3 },
  row: { flex: 1, flexDirection: 'row', marginTop: 10, marginBottom: 8 },
  mapRow: { flexDirection: 'row', marginBottom: 10 },
  mapCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: 'rgba(18,26,34,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginHorizontal: 7,
  },
  mapCardOn: { backgroundColor: 'rgba(24,34,44,1)' },
  mapCardP: { opacity: 0.85 },
  mapNome: { fontFamily: MONO, fontSize: 13, fontWeight: 'bold', letterSpacing: 3 },
  mapTag: { fontFamily: MONO, fontSize: 7, letterSpacing: 2, color: CSS.TEXT_DIM, marginTop: 1 },
  mapBio: { fontFamily: MONO, fontSize: 7.5, color: '#8FA3B2', marginTop: 3, lineHeight: 10 },
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: 'rgba(18,26,34,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 7,
  },
  cardOn: { backgroundColor: 'rgba(24,34,44,1)' },
  cardP: { opacity: 0.85 },
  nome: { fontFamily: MONO, fontSize: 20, fontWeight: 'bold', letterSpacing: 4 },
  funcao: { fontFamily: MONO, fontSize: 8, letterSpacing: 3, color: CSS.TEXT_DIM, marginTop: 1 },
  bio: { fontFamily: MONO, fontSize: 8.5, color: '#8FA3B2', marginTop: 5, lineHeight: 12 },
  tracoList: { marginTop: 'auto', marginBottom: 4 },
  tracoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  tracoGlyph: { fontSize: 15, width: 20, textAlign: 'center' },
  tracoTxt: { flex: 1, marginLeft: 4 },
  tracoLabel: { fontFamily: MONO, fontSize: 9, fontWeight: 'bold', letterSpacing: 2, color: '#DCEAF2' },
  tracoDesc: { fontFamily: MONO, fontSize: 7.5, color: CSS.TEXT_DIM, lineHeight: 10, marginTop: 1 },
  speed: {
    fontFamily: MONO,
    fontSize: 7.5,
    letterSpacing: 2,
    color: CSS.TEXT_DIM,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,139,153,0.20)',
    paddingTop: 5,
  },
  go: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: CSS.TEAL,
    backgroundColor: 'rgba(45,226,198,0.14)',
    paddingVertical: 10,
    paddingHorizontal: 30,
    alignSelf: 'center',
  },
  goP: { backgroundColor: 'rgba(45,226,198,0.35)' },
  goTxt: { fontFamily: MONO, fontSize: 13, fontWeight: 'bold', letterSpacing: 3, color: CSS.TEAL },
  foot: {
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 2,
    color: CSS.TEXT_DIM,
    alignSelf: 'center',
    marginTop: 6,
  },
});
