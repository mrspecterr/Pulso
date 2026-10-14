// MissionsScreen (Etapa 17) — o quadro de progressão do PULSO: as 3 MISSÕES
// DIÁRIAS (renascem à meia-noite, XP direto na carreira) e a parede de
// CONQUISTAS (marcos permanentes). Mesma linguagem visual do hub: vidro
// escuro, monoespaçada, barras de progresso honestas.
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CSS } from '../config/constants';
import { ART } from './art';
import { FadeSlide, MONO, XpBar } from './parts';
import {
  achievementViews,
  getDailyMissions,
  getProfile,
  careerXp,
  levelInfo,
  rankTitle,
} from './profile';
import { SFX } from '../game/Audio';

export default function MissionsScreen({ onBack }: { onBack: () => void }) {
  const profile = getProfile();
  const missions = getDailyMissions();
  const achievements = achievementViews(profile.career);
  const doneCount = achievements.filter((a) => a.done).length;
  const xp = careerXp(profile.career);
  const { level } = levelInfo(xp);

  return (
    <View style={ms.root}>
      <Image source={ART[profile.agent]} style={ms.bg} resizeMode="cover" />
      <View style={ms.shade} />

      {/* ---- topo: voltar · título · patente ---- */}
      <View style={ms.topRow}>
        <Pressable
          style={ms.back}
          onPress={() => { SFX.play('ui', 0.45); onBack(); }}
        >
          <Text style={ms.backTxt}>◂ VOLTAR</Text>
        </Pressable>
        <Text style={ms.title}>MISSÕES & CONQUISTAS</Text>
        <Text style={ms.rank}>NV {level} · {rankTitle(level)}</Text>
      </View>

      <View style={ms.panel}>
        <ScrollView contentContainerStyle={ms.scroll}>
          {/* ================= MISSÕES DIÁRIAS ================= */}
          <Text style={ms.section}>MISSÕES DIÁRIAS</Text>
          <Text style={ms.sectionSub}>
            a safra vira à meia-noite · o XP cai direto na carreira
          </Text>

          {missions.map((m, i) => (
            <FadeSlide key={m.id} delay={60 + i * 70}>
              <View style={[ms.mission, m.done && ms.missionDone]}>
                <View style={ms.missionHead}>
                  <Text style={[ms.missionLabel, m.done && { color: CSS.TEAL }]}>
                    {m.done ? '✓ ' : ''}{m.label.toUpperCase()}
                  </Text>
                  <Text style={[ms.missionXp, m.done && { color: CSS.TEAL }]}>
                    +{m.xp} XP
                  </Text>
                </View>
                <View style={ms.missionRow}>
                  <XpBar into={m.cur} need={m.target} width={296} />
                  <Text style={ms.missionCount}>
                    {m.cur}/{m.target}
                  </Text>
                </View>
              </View>
            </FadeSlide>
          ))}

          {/* ================= CONQUISTAS ================= */}
          <Text style={[ms.section, { marginTop: 16 }]}>CONQUISTAS</Text>
          <Text style={ms.sectionSub}>
            marcos permanentes · {doneCount}/{achievements.length} selados
          </Text>

          <View style={ms.grid}>
            {achievements.map((a, i) => (
              <FadeSlide key={a.id} delay={120 + i * 45} style={ms.achWrap}>
                <View style={[ms.ach, a.done && ms.achDone]}>
                  <View style={ms.achHead}>
                    <Text style={[ms.achGlyph, { color: a.done ? CSS.TEAL : CSS.TEXT_DIM }]}>
                      {a.done ? '★' : '☆'}
                    </Text>
                    <Text style={[ms.achName, a.done && { color: CSS.TEAL }]} numberOfLines={1}>
                      {a.nome}
                    </Text>
                  </View>
                  <Text style={ms.achDesc} numberOfLines={1}>{a.desc}</Text>
                  <View style={ms.achBar}>
                    <XpBar into={a.cur} need={a.goal} width={124} />
                    <Text style={ms.achCount}>{a.cur}/{a.goal}</Text>
                  </View>
                </View>
              </FadeSlide>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const ms = StyleSheet.create({
  root: { flex: 1, backgroundColor: CSS.BG },
  bg: { position: 'absolute', width: '100%', height: '100%' },
  shade: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(5,8,12,0.90)',
  },

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
  rank: { fontFamily: MONO, fontSize: 8.5, letterSpacing: 2, color: CSS.TEAL },

  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 56,
    bottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.30)',
    backgroundColor: 'rgba(9,13,18,0.94)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scroll: { paddingBottom: 8 },

  section: {
    fontFamily: MONO,
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 4,
    color: CSS.TEAL,
    marginTop: 4,
  },
  sectionSub: {
    fontFamily: MONO,
    fontSize: 7.5,
    letterSpacing: 1.5,
    color: CSS.TEXT_DIM,
    marginTop: 2,
    marginBottom: 6,
  },

  // -- missões --
  mission: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.28)',
    backgroundColor: 'rgba(11,15,20,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  missionDone: { borderColor: 'rgba(45,226,198,0.55)' },
  missionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  missionLabel: { fontFamily: MONO, fontSize: 11, fontWeight: 'bold', letterSpacing: 2, color: '#E8F4F8' },
  missionXp: { fontFamily: MONO, fontSize: 9, letterSpacing: 1, color: '#B9D8CE' },
  missionRow: { flexDirection: 'row', alignItems: 'center' },
  missionCount: { fontFamily: MONO, fontSize: 9, color: CSS.TEXT_DIM, marginLeft: 10, width: 52 },

  // -- conquistas --
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  // a largura percentual precisa estar no WRAPPER do FadeSlide (o Animated.View
  // pai do card) — no card ela cedia para a largura automática do wrapper
  // e os cards colapsavam para ~80px
  achWrap: { width: '48.6%' },
  ach: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.22)',
    backgroundColor: 'rgba(11,15,20,0.66)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 6,
    opacity: 0.72,
  },
  achDone: { borderColor: 'rgba(45,226,198,0.5)', opacity: 1 },
  achHead: { flexDirection: 'row', alignItems: 'center' },
  achGlyph: { fontFamily: MONO, fontSize: 11, marginRight: 6 },
  achName: { fontFamily: MONO, fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, color: '#E8F4F8', flex: 1 },
  achDesc: { fontFamily: MONO, fontSize: 7.5, letterSpacing: 0.5, color: CSS.TEXT_DIM, marginTop: 2 },
  achBar: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  achCount: { fontFamily: MONO, fontSize: 7.5, color: CSS.TEXT_DIM, marginLeft: 8 },
});
