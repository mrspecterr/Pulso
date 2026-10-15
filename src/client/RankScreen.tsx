// RankScreen (Etapa 19) — o quadro de honra da TEMPORADA. A patente do
// PULSO é medida em decibéis (30..120) e segue a dinâmica musical, de
// SILENTE (pp) a PULSO (fff). Aqui o operador vê o emblema da patente
// atual, o dB, a escada completa da temporada e os números que o
// levaram até ali. Mesma linguagem do hub: vidro escuro, monoespaçada,
// entradas FadeSlide e o equalizer pulsando na cor da patente.
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CSS } from '../config/constants';
import { ART } from './art';
import { Equalizer, FadeSlide, MONO, XpBar } from './parts';
import { getProfile } from './profile';
import {
  PLACEMENTS,
  SEASON,
  SEASON_NAME,
  TIERS,
  seasonDaysLeft,
  tierAt,
  tierLabel,
  tierProgress,
} from './ranked';
import { SFX } from '../game/Audio';

export default function RankScreen({ onBack }: { onBack: () => void }) {
  const profile = getProfile();
  const r = profile.ranked;
  const tier = tierAt(r.rating);
  const label = tierLabel(r.rating);
  const { into, need } = tierProgress(r.rating);
  const calibrating = r.played < PLACEMENTS;
  const total = r.wins + r.losses;
  const winrate = total > 0 ? Math.round((r.wins / total) * 100) : 0;
  const days = seasonDaysLeft();

  // a escada desce do PULSO ao SILENTE — o topo primeiro
  const ladder = [...TIERS].reverse();
  const nextTier = TIERS[TIERS.findIndex((t) => t.nome === tier.nome) + 1];

  return (
    <View style={rs.root}>
      <Image source={ART[profile.agent]} style={rs.bg} resizeMode="cover" />
      <View style={rs.shade} />

      {/* ---- topo: voltar · título · temporada ---- */}
      <View style={rs.topRow}>
        <Pressable style={rs.back} onPress={() => { SFX.play('ui', 0.45); onBack(); }}>
          <Text style={rs.backTxt}>◂ VOLTAR</Text>
        </Pressable>
        <Text style={rs.title}>PATENTE · TEMPORADA {SEASON}</Text>
        <Text style={rs.seasonTxt}>
          {SEASON_NAME} · {days}d restantes
        </Text>
      </View>

      <View style={rs.body}>
        {/* ================= coluna esquerda: o emblema ================= */}
        <View style={rs.leftCol}>
          <FadeSlide delay={60}>
            <View style={rs.emblemBlock}>
              {/* halo + losango + glifo (a dinâmica musical) */}
              <View style={[rs.halo, { borderColor: tier.corCss + '55' }]}>
                <View style={[rs.embFrame, { borderColor: tier.corCss }]}>
                  <View style={rs.embInner}>
                    <Text style={[rs.embGlyph, { color: tier.corCss }]}>{tier.glyph}</Text>
                  </View>
                </View>
              </View>
            </View>
          </FadeSlide>

          <FadeSlide delay={140}>
            <Text style={[rs.tierName, { color: tier.corCss }]}>{label}</Text>
            <Text style={rs.rating}>
              {r.rating} <Text style={rs.dbUnit}>dB</Text>
            </Text>

            {calibrating ? (
              <View style={rs.calib}>
                <Text style={rs.calibTxt}>
                  CALIBRAÇÃO · PARTIDA {r.played + 1}/{PLACEMENTS}
                </Text>
                <Text style={rs.calibSub}>passos largos até achar a faixa</Text>
              </View>
            ) : (
              <>
                <View style={rs.progRow}>
                  <XpBar into={into} need={need} width={168} />
                  <Text style={rs.progTxt}>
                    {tier.nome === 'PULSO' ? 'TOPO' : `faltam ${need - into}`}
                  </Text>
                </View>
                <Text style={rs.progNext}>
                  {tier.nome === 'PULSO'
                    ? 'o limiar da dor — o próprio PULSO'
                    : `dB p/ ${nextTier ? nextTier.nome : 'PULSO'}`}
                </Text>
              </>
            )}
          </FadeSlide>

          <FadeSlide delay={220}>
            <View style={rs.statsCard}>
              <View style={rs.statsRow}>
                <View style={rs.statCell}>
                  <Text style={rs.statVal}>{r.wins}</Text>
                  <Text style={rs.statLbl}>VITÓRIAS</Text>
                </View>
                <View style={rs.statCell}>
                  <Text style={rs.statVal}>{r.losses}</Text>
                  <Text style={rs.statLbl}>DERROTAS</Text>
                </View>
                <View style={rs.statCell}>
                  <Text style={rs.statVal}>{winrate}%</Text>
                  <Text style={rs.statLbl}>APROVEIT.</Text>
                </View>
              </View>
              <View style={[rs.statsRow, { marginTop: 8 }]}>
                <View style={rs.statCell}>
                  <Text style={rs.statVal}>
                    {r.streak > 0 ? `+${r.streak}` : r.streak}
                  </Text>
                  <Text style={rs.statLbl}>SEQUÊNCIA</Text>
                </View>
                <View style={rs.statCell}>
                  <Text style={rs.statVal}>{r.bestStreak}</Text>
                  <Text style={rs.statLbl}>MELHOR SEQ.</Text>
                </View>
                <View style={rs.statCell}>
                  <Text style={rs.statVal}>{r.peak}</Text>
                  <Text style={rs.statLbl}>PICO dB</Text>
                </View>
              </View>
            </View>
          </FadeSlide>

          <FadeSlide delay={300}>
            <View style={rs.eqRow}>
              <Equalizer color={tier.corCss} bars={26} width={218} height={16} barW={3} />
            </View>
          </FadeSlide>
        </View>

        {/* ================= coluna direita: a escada ================= */}
        <View style={rs.rightCol}>
          <ScrollView contentContainerStyle={rs.scroll} showsVerticalScrollIndicator={false}>
            <Text style={rs.section}>A ESCADA DA TEMPORADA</Text>
            <Text style={rs.sectionSub}>
              dinâmica musical, do sussurro ao limiar da dor
            </Text>

            {ladder.map((t, i) => {
              const mine = t.nome === tier.nome;
              const range =
                t.nome === 'PULSO' ? '120 dB' : `${t.min}–${t.min + 14} dB`;
              return (
                <FadeSlide key={t.nome} delay={90 + i * 55}>
                  <View style={[rs.rung, mine && { borderColor: t.corCss, backgroundColor: t.corCss + '1A' }]}>
                    <Text style={[rs.rungGlyph, { color: t.corCss }]}>{t.glyph}</Text>
                    <Text style={[rs.rungNome, { color: mine ? t.corCss : '#E8F4F8' }]}>
                      {t.nome}
                    </Text>
                    <Text style={rs.rungRange}>{range}</Text>
                    {mine && <Text style={[rs.rungYou, { color: t.corCss }]}>▸ VOCÊ</Text>}
                  </View>
                </FadeSlide>
              );
            })}

            <Text style={rs.rules}>
              vitória soma dB — margem de rodadas, desempenho e embalo pesam;{'\n'}
              derrota subtrai pelo placar. 3 partidas de calibração abrem a{'\n'}
              temporada; o piso de 30 dB sempre deixa caminho de volta.
            </Text>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const rs = StyleSheet.create({
  root: { flex: 1, backgroundColor: CSS.BG },
  bg: { position: 'absolute', width: '100%', height: '100%' },
  shade: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(5,8,12,0.92)',
  },

  // -- topo --
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
  seasonTxt: { fontFamily: MONO, fontSize: 8.5, letterSpacing: 2, color: CSS.TEAL },

  // -- corpo em duas colunas --
  body: {
    position: 'absolute',
    top: 52,
    left: 14,
    right: 14,
    bottom: 12,
    flexDirection: 'row',
  },
  leftCol: { width: 268 },
  rightCol: { flex: 1, marginLeft: 14 },
  scroll: { paddingBottom: 6 },

  // -- emblema --
  emblemBlock: { alignItems: 'center', marginTop: 8, marginBottom: 8 },
  halo: {
    width: 118,
    height: 118,
    borderWidth: 1,
    borderRadius: 10,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  embFrame: {
    width: 92,
    height: 92,
    borderWidth: 2.5,
    borderRadius: 8,
    backgroundColor: 'rgba(9,13,18,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  embInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-45deg' }],
  },
  embGlyph: {
    fontFamily: MONO,
    fontSize: 25,
    fontWeight: 'bold',
    letterSpacing: -1,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },

  // -- patente + dB --
  tierName: {
    fontFamily: MONO,
    fontSize: 19,
    fontWeight: 'bold',
    letterSpacing: 6,
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  rating: {
    fontFamily: MONO,
    fontSize: 34,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#F2FBFF',
    textAlign: 'center',
    marginTop: 1,
  },
  dbUnit: { fontSize: 15, color: CSS.TEXT_DIM, letterSpacing: 4 },

  calib: { alignItems: 'center', marginTop: 6 },
  calibTxt: { fontFamily: MONO, fontSize: 9.5, fontWeight: 'bold', letterSpacing: 2.5, color: '#FFD37A' },
  calibSub: { fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.5, color: CSS.TEXT_DIM, marginTop: 2 },

  progRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, alignSelf: 'center' },
  progTxt: { fontFamily: MONO, fontSize: 8.5, letterSpacing: 1, color: '#B9D8CE', marginLeft: 10 },
  progNext: {
    fontFamily: MONO,
    fontSize: 7.5,
    letterSpacing: 1.5,
    color: CSS.TEXT_DIM,
    textAlign: 'center',
    marginTop: 2,
  },

  // -- stats da temporada --
  statsCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.28)',
    backgroundColor: 'rgba(11,15,20,0.72)',
    padding: 10,
    marginTop: 10,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statCell: { alignItems: 'center' },
  statVal: { fontFamily: MONO, fontSize: 15, fontWeight: 'bold', color: '#E8F4F8' },
  statLbl: { fontFamily: MONO, fontSize: 6.5, letterSpacing: 1.5, color: CSS.TEXT_DIM, marginTop: 1 },

  eqRow: { alignItems: 'center', marginTop: 10 },

  // -- escada --
  section: {
    fontFamily: MONO,
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 4,
    color: CSS.TEAL,
    marginTop: 2,
  },
  sectionSub: {
    fontFamily: MONO,
    fontSize: 7.5,
    letterSpacing: 1.5,
    color: CSS.TEXT_DIM,
    marginTop: 2,
    marginBottom: 6,
  },
  rung: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.22)',
    backgroundColor: 'rgba(11,15,20,0.66)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 5,
  },
  rungGlyph: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: 'bold',
    width: 34,
    letterSpacing: -0.5,
  },
  rungNome: { fontFamily: MONO, fontSize: 11, fontWeight: 'bold', letterSpacing: 3, flex: 1 },
  rungRange: { fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: CSS.TEXT_DIM },
  rungYou: { fontFamily: MONO, fontSize: 8, fontWeight: 'bold', letterSpacing: 2, marginLeft: 12 },

  rules: {
    fontFamily: MONO,
    fontSize: 7.5,
    lineHeight: 12,
    letterSpacing: 0.5,
    color: CSS.TEXT_DIM,
    marginTop: 8,
  },
});
