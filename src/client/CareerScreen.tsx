// CareerScreen (Etapa 20) — o DOSSIÊ do operador: tudo que a carreira
// (profile.ts) acumulou, organizado como num jogo de verdade — grade de
// estatísticas, ETIQUETAS DE ESTILO derivadas dos próprios números (o
// jogo te lê e devolve um retrato), patente da temporada e o rumo das
// conquistas. Zero gameplay: leitura pura do perfil salvo.
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AGENTS, CSS } from '../config/constants';
import { TITLE_BG } from './art';
import { FadeSlide, MONO, XpBar } from './parts';
import {
  achievementViews,
  careerXp,
  getProfile,
  levelInfo,
  rankTitle,
} from './profile';
import { PLACEMENTS, tierAt, tierLabel, tierProgress } from './ranked';
import { SFX } from '../game/Audio';

const AMBER = '#FFD37A';

export default function CareerScreen({ onBack }: { onBack: () => void }) {
  const profile = getProfile();
  const c = profile.career;
  const A = AGENTS[profile.agent];
  const xp = careerXp(c);
  const { level, into, need } = levelInfo(xp);

  // ---- razões honestas (denominador zero nunca divide) ----
  const acc = c.shots > 0 ? Math.round((100 * c.hits) / c.shots) : 0;
  const kd = c.deaths > 0 ? (c.kills / c.deaths).toFixed(2) : `${c.kills}.00`;
  const winrate = c.matches > 0 ? Math.round((100 * c.wins) / c.matches) : 0;
  const hsRate = c.hits > 0 ? Math.round((100 * c.headshots) / c.hits) : 0;
  const avgKills = c.matches > 0 ? (c.kills / c.matches).toFixed(1).replace('.', ',') : '0';

  // ---- patente sazonal (Etapa 19, resumida) ----
  const rk = profile.ranked;
  const tier = tierAt(rk.rating);
  const prog = tierProgress(rk.rating);
  const rkSub =
    rk.played < PLACEMENTS
      ? `calibração ${rk.played}/${PLACEMENTS}`
      : `${rk.wins}V · ${rk.losses}D · sequência ${rk.streak > 0 ? `+${rk.streak}` : rk.streak}`;

  // ---- ETIQUETAS DE ESTILO: o jogo lê a carreira e devolve um retrato ----
  type Tag = { nome: string; desc: string };
  const tags: Tag[] = [];
  if (c.matches > 0) {
    if (c.kills / c.matches >= 6) tags.push({ nome: 'VIRTUOSE', desc: 'média de 6+ abates por partida' });
    if (hsRate >= 20) tags.push({ nome: 'CIRÚRGICO', desc: '1 em 5 acertos é headshot' });
    if (acc >= 30) tags.push({ nome: 'AFINADO', desc: 'precisão de carreira acima de 30%' });
    if (c.matches >= 5 && c.plants / c.matches >= 0.5) {
      tags.push({ nome: 'SEMEADOR', desc: 'planta o Diapasão na maioria das partidas' });
    }
    if (c.flawless >= 3) tags.push({ nome: 'ÍNTEGRO', desc: `${c.flawless} vitórias sem cair` });
    if (c.matches >= 25) tags.push({ nome: 'VETERANO', desc: `${c.matches} partidas no subsolo` });
    if (c.matches >= 5 && winrate >= 60) tags.push({ nome: 'IMBATÍVEL', desc: 'aproveitamento acima de 60%' });
  }
  const shown = tags.slice(0, 4);

  // ---- conquistas ----
  const ach = achievementViews(c);
  const achDone = ach.filter((a) => a.done).length;
  const pending = ach.filter((a) => !a.done).slice(0, 3);

  const cells: Array<[string, string, string]> = [
    // [valor, rótulo, cor]
    [String(c.matches), 'PARTIDAS', '#E8F4F8'],
    [String(c.wins), 'VITÓRIAS', '#E8F4F8'],
    [`${winrate}%`, 'APROVEITAMENTO', winrate >= 50 ? CSS.TEAL : AMBER],
    [kd, 'K/D', parseFloat(kd) >= 1 ? CSS.TEAL : '#E8F4F8'],
    [String(c.kills), 'ABATES', '#E8F4F8'],
    [String(c.deaths), 'QUEDAS', '#E8F4F8'],
    [avgKills, 'ABATES/PARTIDA', '#E8F4F8'],
    [String(c.bestKills), 'MELHOR PARTIDA', AMBER],
    [String(c.headshots), 'HEADSHOTS', '#E8F4F8'],
    [`${acc}%`, 'PRECISÃO', acc >= 30 ? CSS.TEAL : '#E8F4F8'],
    [String(c.plants), 'PLANTIOS', '#E8F4F8'],
    [String(c.flawless), 'IMACULADAS', '#E8F4F8'],
  ];

  return (
    <View style={cs.root}>
      <Image source={TITLE_BG} style={cs.art} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(7,10,15,0.97)', 'rgba(7,10,15,0.80)', 'rgba(7,10,15,0.30)']}
        locations={[0, 0.52, 0.9]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={cs.art}
      />
      <LinearGradient
        colors={['rgba(7,10,15,0)', 'rgba(7,10,15,0.85)']}
        locations={[0.66, 1]}
        style={cs.art}
      />

      {/* ---- topo: voltar · título ---- */}
      <View style={cs.topRow}>
        <FadeSlide delay={60}>
          <Pressable style={cs.back} onPress={() => { SFX.play('ui', 0.45); onBack(); }}>
            <Text style={cs.backTxt}>◂ HUB</Text>
          </Pressable>
        </FadeSlide>
        <FadeSlide delay={100}>
          <Text style={cs.title}>DOSSIÊ DO OPERADOR</Text>
        </FadeSlide>
      </View>

      {/* ---- esquerda: identidade + patente ---- */}
      <View style={cs.leftCol}>
        <FadeSlide delay={160}>
          <View style={cs.idCard}>
            <View style={[cs.avatar, { borderColor: A.corCss }]}>
              <Text style={[cs.avatarTxt, { color: A.corCss }]}>{profile.agent[0]}</Text>
            </View>
            <View style={cs.idTxt}>
              <Text style={cs.idName}>OPERADOR</Text>
              <Text style={cs.idRank}>NV {level} · {rankTitle(level)}</Text>
              <XpBar into={into} need={need} width={228} />
              <Text style={cs.idXp}>
                {xp.toLocaleString('pt-BR')} XP · faltam {(need - into).toLocaleString('pt-BR')} p/ NV {level + 1}
              </Text>
            </View>
          </View>
        </FadeSlide>

        <FadeSlide delay={240}>
          <View style={[cs.rankCard, { borderColor: tier.corCss + '66' }]}>
            <Text style={cs.rankTitle}>PATENTE · TEMPORADA 1</Text>
            <Text style={[cs.rankTier, { color: tier.corCss }]}>{tierLabel(rk.rating)} · {rk.rating} dB</Text>
            <Text style={cs.rankSub}>{rkSub} · pico {rk.peak} dB</Text>
            <XpBar into={prog.into} need={prog.need} width={228} />
          </View>
        </FadeSlide>

        <FadeSlide delay={320}>
          <View style={cs.agentCard}>
            <Text style={cs.agentLab}>AGENTE PADRÃO</Text>
            <Text style={[cs.agentNome, { color: A.corCss }]}>
              {profile.agent} · {A.funcao}
            </Text>
            <Text style={cs.agentBio} numberOfLines={2}>{A.bio}</Text>
          </View>
        </FadeSlide>
      </View>

      {/* ---- direita: números + estilo + conquistas ---- */}
      <View style={cs.rightCol}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={cs.rightFlow}>
          {/* grade de estatísticas */}
          <FadeSlide delay={200}>
            <View style={cs.grid}>
              {cells.map(([val, lab, col], i) => (
                <View key={lab} style={[cs.cell, i % 4 !== 0 && cs.cellGap]}>
                  <Text style={[cs.cellVal, { color: col }]} numberOfLines={1}>{val}</Text>
                  <Text style={cs.cellLab} numberOfLines={1}>{lab}</Text>
                </View>
              ))}
            </View>
          </FadeSlide>

          {/* estilo de operação — o retrato que a carreira pinta */}
          <FadeSlide delay={300}>
            <View style={cs.styleCard}>
              <Text style={cs.styleTitle}>ESTILO DE OPERAÇÃO</Text>
              {shown.length > 0 ? (
                <View style={cs.tagWrap}>
                  {shown.map((t) => (
                    <View key={t.nome} style={[cs.tag, { borderColor: CSS.TEAL + '77' }]}>
                      <Text style={cs.tagNome}>{t.nome}</Text>
                      <Text style={cs.tagDesc} numberOfLines={1}>{t.desc}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={cs.styleEmpty}>
                  {c.matches === 0
                    ? 'sem registro — jogue partidas para o jogo afinar seu retrato'
                    : 'em calibração — a carreira ainda está encontrando sua voz'}
                </Text>
              )}
            </View>
          </FadeSlide>

          {/* conquistas: o que falta ---- */}
          <FadeSlide delay={400}>
            <View style={cs.achCard}>
              <View style={cs.achHead}>
                <Text style={cs.achTitle}>CONQUISTAS</Text>
                <Text style={cs.achCount}>{achDone}/{ach.length}</Text>
              </View>
              <XpBar into={achDone} need={ach.length} width={228} />
              {pending.length > 0 ? (
                <View style={cs.achList}>
                  {pending.map((a) => (
                    <View key={a.id} style={cs.achRow}>
                      <View style={cs.achLine}>
                        <Text style={cs.achNome}>{a.nome}</Text>
                        <Text style={cs.achProg}>{a.cur}/{a.goal}</Text>
                      </View>
                      <Text style={cs.achDesc} numberOfLines={1}>{a.desc}</Text>
                      <XpBar into={a.cur} need={a.goal} width={'100%'} />
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={cs.achDone}>todas seladas — a lenda é sua</Text>
              )}
            </View>
          </FadeSlide>
        </ScrollView>
      </View>
    </View>
  );
}

const cs = StyleSheet.create({
  root: { flex: 1, backgroundColor: CSS.BG },
  art: { position: 'absolute', width: '100%', height: '100%' },

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

  // -- coluna esquerda --
  leftCol: {
    position: 'absolute',
    left: 14,
    top: 56,
    bottom: 12,
    width: 264,
  },
  idCard: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.28)',
    backgroundColor: 'rgba(8,12,17,0.92)',
    padding: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    backgroundColor: 'rgba(11,15,20,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontFamily: MONO, fontSize: 20, fontWeight: 'bold' },
  idTxt: { marginLeft: 10, flex: 1 },
  idName: { fontFamily: MONO, fontSize: 13, fontWeight: 'bold', letterSpacing: 3, color: '#E8F4F8' },
  idRank: { fontFamily: MONO, fontSize: 8, letterSpacing: 2, color: CSS.TEXT_DIM, marginTop: 1 },
  idXp: { fontFamily: MONO, fontSize: 7, letterSpacing: 1, color: CSS.TEXT_DIM, marginTop: 3 },

  rankCard: {
    borderRadius: 11,
    borderWidth: 1,
    backgroundColor: 'rgba(8,12,17,0.92)',
    padding: 12,
    marginTop: 8,
  },
  rankTitle: { fontFamily: MONO, fontSize: 7.5, fontWeight: 'bold', letterSpacing: 3, color: CSS.TEXT_DIM },
  rankTier: { fontFamily: MONO, fontSize: 14, fontWeight: 'bold', letterSpacing: 2, marginTop: 2 },
  rankSub: { fontFamily: MONO, fontSize: 7.5, letterSpacing: 1, color: CSS.TEXT_DIM, marginTop: 2, marginBottom: 4 },

  agentCard: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.28)',
    backgroundColor: 'rgba(8,12,17,0.92)',
    padding: 12,
    marginTop: 8,
  },
  agentLab: { fontFamily: MONO, fontSize: 7.5, fontWeight: 'bold', letterSpacing: 3, color: CSS.TEXT_DIM },
  agentNome: { fontFamily: MONO, fontSize: 12, fontWeight: 'bold', letterSpacing: 2.5, marginTop: 2 },
  agentBio: { fontFamily: MONO, fontSize: 7.5, color: '#9FB4C2', lineHeight: 11, marginTop: 3 },

  // -- região direita --
  rightCol: {
    position: 'absolute',
    left: 292,
    right: 14,
    top: 56,
    bottom: 12,
  },
  rightFlow: { paddingBottom: 4 },

  // grade 4×3
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.26)',
    backgroundColor: 'rgba(8,12,17,0.92)',
    padding: 8,
  },
  cell: { width: '25%', paddingHorizontal: 4, paddingVertical: 6 },
  cellGap: { borderLeftWidth: 0 },
  cellVal: { fontFamily: MONO, fontSize: 15, fontWeight: 'bold', letterSpacing: 1 },
  cellLab: { fontFamily: MONO, fontSize: 6, letterSpacing: 1, color: CSS.TEXT_DIM, marginTop: 2 },

  // estilo
  styleCard: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(45,226,198,0.38)',
    backgroundColor: 'rgba(8,12,17,0.92)',
    padding: 11,
    marginTop: 8,
  },
  styleTitle: { fontFamily: MONO, fontSize: 8.5, fontWeight: 'bold', letterSpacing: 3, color: CSS.TEAL },
  styleEmpty: { fontFamily: MONO, fontSize: 8, color: CSS.TEXT_DIM, letterSpacing: 1, marginTop: 5, lineHeight: 12 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  tag: {
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(11,18,22,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  tagNome: { fontFamily: MONO, fontSize: 9.5, fontWeight: 'bold', letterSpacing: 2, color: '#E8F4F8' },
  tagDesc: { fontFamily: MONO, fontSize: 6.5, letterSpacing: 1, color: CSS.TEXT_DIM, marginTop: 1 },

  // conquistas
  achCard: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,211,122,0.30)',
    backgroundColor: 'rgba(8,12,17,0.92)',
    padding: 11,
    marginTop: 8,
  },
  achHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  achTitle: { fontFamily: MONO, fontSize: 8.5, fontWeight: 'bold', letterSpacing: 3, color: AMBER },
  achCount: { fontFamily: MONO, fontSize: 8.5, color: AMBER, letterSpacing: 1 },
  achList: { marginTop: 7 },
  achRow: { paddingVertical: 4 },
  achLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  achNome: { fontFamily: MONO, fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5, color: '#DCEAF2' },
  achDesc: { fontFamily: MONO, fontSize: 6.5, color: CSS.TEXT_DIM, marginTop: 1 },
  achProg: { fontFamily: MONO, fontSize: 7, color: CSS.TEXT_DIM, marginLeft: 6 },
  achDone: { fontFamily: MONO, fontSize: 8, color: AMBER, letterSpacing: 1, marginTop: 6 },
});
