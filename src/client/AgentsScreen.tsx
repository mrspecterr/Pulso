// AgentsScreen (Etapa 15) — a galeria de operadores. A splash art domina
// a direita; à esquerda, os cards de seleção e o dossiê do operador (bio,
// os dois TRAÇOS do kit e o perfil de velocidade). Substitui o antigo
// AgentSelect com a mesma linguagem do hub. O mapa ficou no hub — aqui é
// gente.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AGENTS, CSS, type AgentId } from '../config/constants';
import { ART, TITLE_BG } from './art';
import { FadeSlide, MONO } from './parts';
import { getProfile, saveProfile } from './profile';
import { sessionState } from '../core/state';
import { SFX } from '../game/Audio';

// Etapa 16: VIBRATO entra na galeria (4 operadores)
const ORDER: AgentId[] = ['MUDO', 'ECO', 'GRAVE', 'VIBRATO'];

const OPEN_AS: Record<AgentId, string> = {
  MUDO: 'controle',
  ECO: 'infiltração',
  GRAVE: 'linha de frente',
  VIBRATO: 'regência do esquadrão',
};

export default function AgentsScreen({ onBack }: { onBack: () => void }) {
  const current = getProfile().agent;
  const [sel, setSel] = useState<AgentId>(current);
  const A = AGENTS[sel];
  const isCurrent = sel === current;

  // crossfade da arte ao trocar de operador: a nova entra por cima da
  // anterior (fundo neutro por baixo garante que nunca haja "flash")
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    const a = Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [sel, fade]);

  const pick = (id: AgentId) => {
    if (sel !== id) SFX.play('ui', 0.45);
    setSel(id);
  };

  const confirm = () => {
    sessionState.agent = sel; // o motor lê daqui ao montar a partida
    saveProfile();
    SFX.play('ui', 0.8);
    onBack();
  };

  return (
    <View style={ag.root}>
      {/* base neutra + arte do operador com crossfade */}
      <Image source={TITLE_BG} style={ag.art} resizeMode="cover" />
      <Animated.View style={[ag.artLayer, { opacity: fade }]}>
        <Image source={ART[sel]} style={ag.art} resizeMode="cover" />
      </Animated.View>
      <LinearGradient
        colors={['rgba(7,10,15,0.97)', 'rgba(7,10,15,0.82)', 'rgba(7,10,15,0.10)']}
        locations={[0, 0.52, 0.86]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={ag.art}
      />

      {/* ---- topo: voltar · título ---- */}
      <View style={ag.topRow}>
        <FadeSlide delay={60}>
          <Pressable style={ag.back} onPress={() => { SFX.play('ui', 0.45); onBack(); }}>
            <Text style={ag.backTxt}>◂ HUB</Text>
          </Pressable>
        </FadeSlide>
        <FadeSlide delay={100}>
          <Text style={ag.title}>OPERADORES CORO</Text>
        </FadeSlide>
      </View>

      {/* ---- esquerda: cards dos operadores + dossiê (fluxo rolável — com
           4 operadores o conjunto pode passar da altura útil da tela) ---- */}
      <View style={ag.leftCol}>
        <ScrollView contentContainerStyle={ag.leftFlow} showsVerticalScrollIndicator={false}>
          {ORDER.map((id, i) => {
          const g = AGENTS[id];
          const active = sel === id;
          return (
            <FadeSlide key={id} delay={180 + i * 80}>
              <Pressable
                style={({ pressed }) => [
                  ag.card,
                  { borderColor: active ? g.corCss : 'rgba(122,139,153,0.30)' },
                  active && { backgroundColor: 'rgba(24,34,44,0.95)' },
                  pressed && ag.cardP,
                ]}
                onPress={() => pick(id)}
              >
                <View style={[ag.cardAvatar, { borderColor: g.corCss }]}>
                  <Text style={[ag.cardAvatarTxt, { color: g.corCss }]}>{id[0]}</Text>
                </View>
                <View style={ag.cardTxt}>
                  <Text style={[ag.cardNome, active && { color: g.corCss }]}>{g.nome}</Text>
                  <Text style={ag.cardFuncao}>{g.funcao}</Text>
                </View>
                <Text style={[ag.cardGlyph, { color: g.corCss }]}>{active ? '◉' : '○'}</Text>
              </Pressable>
            </FadeSlide>
          );
        })}

        <FadeSlide delay={500}>
          <View style={[ag.dossier, { borderColor: A.corCss + '66' }]}>
            <Text style={[ag.bioName, { color: A.corCss }]}>{A.nome} · {A.funcao}</Text>
            <Text style={ag.bio}>{A.bio}</Text>

            {A.tracos.map((t) => (
              <View key={t.key} style={ag.tracoRow}>
                <Text style={[ag.tracoGlyph, { color: A.corCss }]}>{t.glyph}</Text>
                <View style={ag.tracoTxt}>
                  <Text style={ag.tracoLabel}>{t.label}</Text>
                  <Text style={ag.tracoDesc} numberOfLines={1}>{t.desc}</Text>
                </View>
                <Text style={ag.tracoUses}>{t.uses}×</Text>
              </View>
            ))}

            <Text style={ag.speed}>
              VELOCIDADE {A.speedMul === 1 ? 'PADRÃO' : `${A.speedMul > 1 ? '+' : ''}${Math.round((A.speedMul - 1) * 100)}%`}
              {'  ·  '}abre a partida como {OPEN_AS[A.nome]}
            </Text>
          </View>
        </FadeSlide>
        </ScrollView>
      </View>

      {/* ---- confirmar, sobre a arte ---- */}
      <View style={ag.confirmBlock}>
        <Pressable
          style={({ pressed }) => [
            ag.confirm,
            { borderColor: A.corCss, backgroundColor: A.corCss + (isCurrent ? '0d' : '22') },
            pressed && { backgroundColor: A.corCss + '44' },
          ]}
          onPress={confirm}
        >
          <Text style={[ag.confirmTxt, { color: A.corCss }]}>
            {isCurrent ? 'SELECIONADO ✓  ·  VOLTAR' : `SELECIONAR ${A.nome}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const ag = StyleSheet.create({
  root: { flex: 1, backgroundColor: CSS.BG },
  art: { position: 'absolute', width: '100%', height: '100%' },
  artLayer: { position: 'absolute', width: '100%', height: '100%' },

  topRow: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  back: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.35)',
    backgroundColor: 'rgba(11,15,20,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  backTxt: { fontFamily: MONO, fontSize: 10, letterSpacing: 3, color: '#CFE2EA' },
  title: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 6,
    color: '#E8F4F8',
    marginRight: -6,
  },

  leftCol: {
    position: 'absolute',
    left: 14,
    top: 56,
    bottom: 12,
    width: 300,
  },
  leftFlow: { paddingBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 196,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: 'rgba(11,15,20,0.80)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  cardP: { opacity: 0.85 },
  cardAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    backgroundColor: 'rgba(9,13,18,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cardAvatarTxt: { fontFamily: MONO, fontSize: 13, fontWeight: 'bold' },
  cardTxt: { flex: 1 },
  cardNome: { fontFamily: MONO, fontSize: 12.5, fontWeight: 'bold', letterSpacing: 2.5, color: '#E8F4F8' },
  cardFuncao: { fontFamily: MONO, fontSize: 7, letterSpacing: 2, color: CSS.TEXT_DIM, marginTop: 1 },
  cardGlyph: { fontFamily: MONO, fontSize: 10 },

  dossier: {
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(8,12,17,0.90)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
  },
  bioName: { fontFamily: MONO, fontSize: 11, fontWeight: 'bold', letterSpacing: 2.5 },
  bio: { fontFamily: MONO, fontSize: 8, color: '#9FB4C2', lineHeight: 12, marginTop: 2 },
  tracoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  tracoGlyph: { fontFamily: MONO, fontSize: 14, width: 20, textAlign: 'center' },
  tracoTxt: { flex: 1, marginLeft: 4 },
  tracoLabel: { fontFamily: MONO, fontSize: 9, fontWeight: 'bold', letterSpacing: 2, color: '#DCEAF2' },
  tracoDesc: { fontFamily: MONO, fontSize: 7.5, color: CSS.TEXT_DIM, marginTop: 1 },
  tracoUses: { fontFamily: MONO, fontSize: 9, color: CSS.TEXT_DIM, marginLeft: 6 },
  speed: {
    fontFamily: MONO,
    fontSize: 7.5,
    letterSpacing: 1.5,
    color: CSS.TEXT_DIM,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,139,153,0.20)',
    paddingTop: 5,
  },

  confirmBlock: { position: 'absolute', right: 18, bottom: 18 },
  confirm: {
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 26,
    paddingVertical: 10,
  },
  confirmTxt: { fontFamily: MONO, fontSize: 12, fontWeight: 'bold', letterSpacing: 2.5 },
});
