// HomeScreen (Etapa 15) — o HUB do PULSO, no padrão dos grandes: a splash
// art do operador selecionado dominando a tela, perfil e carreira reais no
// topo, coluna de módulos à esquerda, o botão JOGAR respirando no centro
// e o seletor de mapa ao lado. Tudo persiste no perfil do jogador.
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AGENTS, CSS, ROUND, type AgentId } from '../config/constants';
import { MAPS, WEATHERS, WEATHER_ORDER, type MapId, type WeatherId } from '../config/maps';
import { ART } from './art';
import { FadeSlide, KenBurns, MenuButton, MONO, Pulsing, Shine, tap, XpBar } from './parts';
import {
  achievementViews,
  careerXp,
  getDailyMissions,
  getProfile,
  levelInfo,
  rankTitle,
  saveProfile,
} from './profile';
import { PLACEMENTS, tierAt, tierLabel } from './ranked';
import { sessionState } from '../core/state';

const MAP_ORDER: MapId[] = ['SUBSOLO', 'PALCO', 'ESTUDIO'];

export default function HomeScreen({
  onPlay,
  onTraining,
  onAgents,
  onArsenal,
  onCareer,
  onSettings,
  onMissions,
  onRank,
}: {
  onPlay: () => void;
  onTraining: () => void;
  onAgents: () => void;
  onArsenal: () => void;
  onCareer: () => void;
  onSettings: () => void;
  onMissions: () => void;
  onRank: () => void;
}) {
  const [briefing, setBriefing] = useState(false);
  const [mapTick, setMapTick] = useState(0); // re-render quando troca o mapa
  const [wxTick, setWxTick] = useState(0); // ...ou o clima (Etapa 17)
  const profile = getProfile();
  const agent = profile.agent;
  const A = AGENTS[agent];
  const M = MAPS[profile.map];
  const W = WEATHERS[profile.weather];
  const xp = careerXp(profile.career);
  const { level, into, need } = levelInfo(xp);
  const c = profile.career;
  const missions = getDailyMissions();
  const missionsDone = missions.filter((m) => m.done).length;
  const achievements = achievementViews(c);
  const achDone = achievements.filter((a) => a.done).length;

  // Etapa 19: a patente sazonal vive no rodapé do hub e na coluna de módulos
  const rk = profile.ranked;
  const rkTier = tierAt(rk.rating);
  const rkSub =
    rk.played < PLACEMENTS
      ? `calibração ${rk.played}/${PLACEMENTS}`
      : `${tierLabel(rk.rating)} · ${rk.rating} dB`;

  const cycleMap = () => {
    const i = MAP_ORDER.indexOf(sessionState.map);
    const next = MAP_ORDER[(i + 1) % MAP_ORDER.length] as MapId;
    sessionState.map = next;
    tap();
    saveProfile();
    setMapTick((t) => t + 1); // re-render com o mapa novo
  };
  void mapTick; // leitura explícita (evita warning de variável não usada)

  // Etapa 17: o clima da partida — arte e combate mudam junto
  const cycleWeather = () => {
    const i = WEATHER_ORDER.indexOf(sessionState.weather);
    const next = WEATHER_ORDER[(i + 1) % WEATHER_ORDER.length] as WeatherId;
    sessionState.weather = next;
    tap();
    saveProfile();
    setWxTick((t) => t + 1);
  };
  void wxTick;

  return (
    <View style={hs.root}>
      {/* splash art do operador — o herói do lobby. Etapa 21: a arte
          DERIVA (Ken Burns) — o hub nunca está parado */}
      <KenBurns style={hs.art}>
        <Image key={agent} source={ART[agent]} style={hs.artInner} resizeMode="cover" />
      </KenBurns>
      {/* leitura: escurece a esquerda (menus) e o rodapé */}
      <LinearGradient
        colors={['rgba(7,10,15,0.96)', 'rgba(7,10,15,0.78)', 'rgba(7,10,15,0.12)']}
        locations={[0, 0.44, 0.78]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={hs.art}
      />
      <LinearGradient
        colors={['rgba(7,10,15,0)', 'rgba(7,10,15,0.85)']}
        locations={[0.72, 1]}
        style={hs.art}
      />

      {/* ---- topo: perfil (esq, abre o dossiê) · briefing · engrenagem (dir) ---- */}
      <View style={hs.topRow}>
        <FadeSlide delay={80}>
          {/* Etapa 20: o cartão de perfil é a porta do DOSSIÊ DO OPERADOR */}
          <Pressable
            style={({ pressed }) => [hs.profile, pressed && hs.profileP]}
            onPress={() => { tap(); onCareer(); }}
          >
            <View style={[hs.avatar, { borderColor: A.corCss }]}>
              <Text style={[hs.avatarTxt, { color: A.corCss }]}>{agent[0]}</Text>
            </View>
            <View>
              <View style={hs.profileNameRow}>
                <Text style={hs.profileName}>OPERADOR</Text>
                <Text style={hs.profileArrow}>▸</Text>
              </View>
              <Text style={hs.profileRank}>
                NV {level} · {rankTitle(level)}
              </Text>
              <XpBar into={into} need={need} width={124} />
            </View>
          </Pressable>
        </FadeSlide>

        <FadeSlide delay={140}>
          <View style={hs.topBtns}>
            {/* briefing de missão — como jogar, a um toque do topo */}
            <Pressable style={hs.gear} onPress={() => { tap(); setBriefing(true); }}>
              <Text style={hs.gearGlyph}>?</Text>
            </Pressable>
            <Pressable style={hs.gear} onPress={() => { tap(); onSettings(); }}>
              <Text style={hs.gearGlyph}>⚙</Text>
            </Pressable>
          </View>
        </FadeSlide>
      </View>

      {/* ---- coluna esquerda: módulos (Etapa 20: ARSENAL entra, BRIEFING
           subiu pro topo — a coluna continua com 5 degraus) ---- */}
      <View style={hs.menuCol}>
        <FadeSlide delay={220}>
          <MenuButton
            glyph="◈"
            label="AGENTES"
            sub={`operador atual: ${agent}`}
            accent={A.corCss}
            onPress={() => { tap(); onAgents(); }}
          />
        </FadeSlide>
        <FadeSlide delay={300}>
          <MenuButton
            glyph="⌖"
            label="ARSENAL"
            sub="armas · trajes · economia"
            accent="#FFD37A"
            onPress={() => { tap(); onArsenal(); }}
          />
        </FadeSlide>
        <FadeSlide delay={380}>
          <MenuButton
            glyph="✦"
            label="MISSÕES"
            sub={`diárias ${missionsDone}/${missions.length} · conquistas ${achDone}/${achievements.length}`}
            accent={missionsDone < 3 ? '#FFD37A' : CSS.TEAL}
            onPress={() => { tap(); onMissions(); }}
          />
        </FadeSlide>
        <FadeSlide delay={460}>
          <MenuButton
            glyph="♪"
            label="PATENTE"
            sub={rkSub}
            accent={rkTier.corCss}
            onPress={() => { tap(); onRank(); }}
          />
        </FadeSlide>
        <FadeSlide delay={540}>
          <MenuButton
            glyph="⚙"
            label="AJUSTES"
            sub="sens · gráficos · som"
            onPress={() => { tap(); onSettings(); }}
          />
        </FadeSlide>
      </View>

      {/* ---- assinatura do operador, sobre a arte ---- */}
      <View style={hs.agentSign}>
        <Text style={[hs.agentName, { color: A.corCss, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 10 }]}>
          {agent}
        </Text>
        <View style={[hs.agentRole, { borderColor: A.corCss }]}>
          <Text style={[hs.agentRoleTxt, { color: A.corCss }]}>{A.funcao}</Text>
        </View>
      </View>

      {/* ---- centro-baixo: mapa + clima + JOGAR ---- */}
      <View style={hs.playBlock}>
        <FadeSlide delay={460}>
          <View style={hs.chipRow}>
            <Pressable style={hs.mapChip} onPress={cycleMap}>
              <Text style={hs.mapArrow}>◂</Text>
              <Text style={[hs.mapName, { color: M.corCss }]}>{M.nome}</Text>
              <Text style={hs.mapArrow}>▸</Text>
            </Pressable>
            {/* Etapa 17: o clima ao lado do mapa — a partida muda de cara */}
            <Pressable style={hs.mapChip} onPress={cycleWeather}>
              <Text style={hs.mapArrow}>{W.glyph}</Text>
              <Text style={[hs.mapName, { color: W.corCss }]}>{W.nome}</Text>
              <Text style={hs.mapArrow}>▸</Text>
            </Pressable>
          </View>
          <Text style={hs.wxHint} numberOfLines={1}>{W.tagline}</Text>
        </FadeSlide>

        <FadeSlide delay={540}>
          <Pulsing>
            <Pressable
              style={({ pressed }) => [hs.play, pressed && hs.playP]}
              onPress={() => { tap(true); onPlay(); }}
            >
              {/* Etapa 21 — o brilho de aço varrendo o CTA */}
              <Shine />
              <Text style={hs.playTxt}>JOGAR</Text>
              <Text style={hs.playSub}>
                PARTIDA 5v5 · PRIMEIRO A {ROUND.ROUNDS_TO_WIN}
              </Text>
            </Pressable>
          </Pulsing>
        </FadeSlide>

        {/* Etapa 16: campo de provas — treino livre ao lado da partida real */}
        <FadeSlide delay={620}>
          <Pressable
            style={({ pressed }) => [hs.trainBtn, pressed && hs.trainBtnP]}
            onPress={() => { tap(); onTraining(); }}
          >
            <Text style={hs.trainTxt}>▸ CAMPO DE PROVAS</Text>
            <Text style={hs.trainSub}>TREINO LIVRE · dB INFINITO · ARSENAL ABERTO</Text>
          </Pressable>
        </FadeSlide>
      </View>

      {/* ---- rodapé: temporada · carreira ---- */}
      <View style={hs.footer}>
        <Text style={[hs.footSeason, { color: rkTier.corCss }]}>
          TEMPORADA 1 · {tierLabel(rk.rating)}
        </Text>
        <Text style={hs.footCareer}>
          {c.matches} partidas · {c.wins} vitórias · {c.kills} abates · recorde {c.bestKills}
        </Text>
        <Text style={hs.footVer}>v0.23 · mrspecterr/Pulso</Text>
      </View>

      {/* ---- briefing: como jogar ---- */}
      {briefing && (
        <View style={hs.briefWrap} pointerEvents="box-none">
          <Pressable style={hs.briefShade} onPress={() => setBriefing(false)} />
          <View style={hs.briefPanel}>
            <Text style={hs.briefTitle}>BRIEFING · OPERAÇÃO RISSONÂNCIA</Text>
            <ScrollView style={hs.briefScroll}>
              <Text style={hs.briefH}>OBJETIVO</Text>
              <Text style={hs.briefP}>
                CORO contra DIRAC, 5 contra 5. Plante o DIAPASÃO no site A ou B e proteja a
                carga até a detonação — ou elimine todo o esquadrão inimigo. Primeiro a{' '}
                {ROUND.ROUNDS_TO_WIN} rodadas vence a partida.
              </Text>
              <Text style={hs.briefH}>A RODADA</Text>
              <Text style={hs.briefP}>
                Compra (10s): gaste seus decibéis em armas e trajes e aperte PRONTO. Ação
                (75s): infiltre-se até um site. Carga (40s): o Diapasão plantado canta cada
                vez mais rápido até o PULSO final.
              </Text>
              <Text style={hs.briefH}>O DIAPASÃO</Text>
              <Text style={hs.briefP}>
                Parado dentro da moldura do site, segure PLANTAR por 3,5s. Andar cancela o
                canal. Se você cair carregando, o aliado mais próximo resgata a carga e
                conclui a missão por você.
              </Text>
              <Text style={hs.briefH}>ECONOMIA</Text>
              <Text style={hs.briefP}>
                Comece com 800 dB. Abate +200 · vitória +2900 · derrota
                +1900. Perder a rodada também custa a arma na mão — às vezes vale poupar
                para comprar o LEGATO na rodada seguinte.
              </Text>
              <Text style={hs.briefH}>CONTROLES</Text>
              <Text style={hs.briefP}>
                Joystick esquerdo move; arraste a metade direita para mirar; o botão de fogo
                aceita arrastar (mire enquanto atira). Os dois TRAÇOS do operador ficam
                empilhados à direita; recarregue acima da munição.
              </Text>
              <Text style={hs.briefP}>
                DIRACs se adaptam: cada ponto deles no placar deixa o inimigo mais afiado.
                O minimapa não é wallhack — inimigos só acendem ao atirar, ao levar dano
                ou sob SONAR.
              </Text>
            </ScrollView>
            <Pressable style={hs.briefClose} onPress={() => { tap(); setBriefing(false); }}>
              <Text style={hs.briefCloseTxt}>ENTENDIDO</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const hs = StyleSheet.create({
  root: { flex: 1, backgroundColor: CSS.BG },
  art: { position: 'absolute', width: '100%', height: '100%' },
  // a arte dentro da jaula do Ken Burns preenche a jaula inteira
  artInner: { width: '100%', height: '100%' },

  // -- topo --
  topRow: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  profile: { flexDirection: 'row', alignItems: 'center' },
  profileP: { opacity: 0.85 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center' },
  profileArrow: {
    fontFamily: MONO,
    fontSize: 9,
    color: CSS.TEXT_DIM,
    marginLeft: 5,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    backgroundColor: 'rgba(11,15,20,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  avatarTxt: { fontFamily: MONO, fontSize: 18, fontWeight: 'bold' },
  profileName: { fontFamily: MONO, fontSize: 13, fontWeight: 'bold', letterSpacing: 3, color: '#E8F4F8' },
  profileRank: { fontFamily: MONO, fontSize: 8, letterSpacing: 2, color: CSS.TEXT_DIM, marginTop: 1 },
  gear: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.35)',
    backgroundColor: 'rgba(11,15,20,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  gearGlyph: { fontFamily: MONO, fontSize: 17, color: '#CFE2EA' },
  topBtns: { flexDirection: 'row' },

  // -- coluna esquerda --
  menuCol: {
    position: 'absolute',
    left: 14,
    top: 76,
  },

  // -- assinatura do agente (direita-baixo, sobre a arte) --
  agentSign: { position: 'absolute', right: 18, bottom: 64, alignItems: 'flex-end' },
  agentName: {
    fontFamily: MONO,
    fontSize: 30,
    fontWeight: 'bold',
    letterSpacing: 10,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  agentRole: {
    borderRadius: 5,
    borderWidth: 1,
    backgroundColor: 'rgba(7,10,15,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  agentRoleTxt: { fontFamily: MONO, fontSize: 8.5, letterSpacing: 3 },

  // -- centro-baixo --
  playBlock: {
    position: 'absolute',
    bottom: 44,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.35)',
    backgroundColor: 'rgba(11,15,20,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  wxHint: {
    fontFamily: MONO,
    fontSize: 7.5,
    letterSpacing: 1.5,
    color: CSS.TEXT_DIM,
    marginTop: 4,
    marginBottom: 5,
    textAlign: 'center',
  },
  mapArrow: { fontFamily: MONO, fontSize: 11, color: CSS.TEXT_DIM, marginHorizontal: 8 },
  mapName: { fontFamily: MONO, fontSize: 11, fontWeight: 'bold', letterSpacing: 3 },
  play: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: CSS.TEAL,
    backgroundColor: 'rgba(45,226,198,0.16)',
    paddingHorizontal: 46,
    paddingVertical: 11,
    alignItems: 'center',
    overflow: 'hidden', // Etapa 21 — corta o brilho do Shine na borda
  },
  playP: { backgroundColor: 'rgba(45,226,198,0.4)' },
  playTxt: {
    fontFamily: MONO,
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 12,
    color: CSS.TEAL,
    textShadowColor: 'rgba(45,226,198,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
    marginRight: -12,
  },
  playSub: { fontFamily: MONO, fontSize: 8, letterSpacing: 3, color: '#BFE9DF', marginTop: 3 },

  // -- campo de provas (Etapa 16) --
  trainBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.45)',
    backgroundColor: 'rgba(11,15,20,0.66)',
    paddingHorizontal: 30,
    paddingVertical: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  trainBtnP: { borderColor: 'rgba(45,226,198,0.55)', backgroundColor: 'rgba(45,226,198,0.12)' },
  trainTxt: { fontFamily: MONO, fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: '#B9D8CE' },
  trainSub: { fontFamily: MONO, fontSize: 7, letterSpacing: 2, color: CSS.TEXT_DIM, marginTop: 2 },

  // -- rodapé --
  footer: {
    position: 'absolute',
    bottom: 10,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footSeason: { fontFamily: MONO, fontSize: 8.5, letterSpacing: 2, color: CSS.TEAL },
  footCareer: { fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: CSS.TEXT_DIM },
  footVer: { fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: CSS.TEXT_DIM },

  // -- briefing --
  briefWrap: { position: 'absolute', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  briefShade: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(4,6,10,0.78)',
  },
  briefPanel: {
    width: 460,
    maxHeight: '82%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(45,226,198,0.4)',
    backgroundColor: 'rgba(9,13,18,0.97)',
    padding: 14,
  },
  briefTitle: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 3,
    color: CSS.TEAL,
    marginBottom: 8,
  },
  briefScroll: { marginBottom: 8 },
  briefH: { fontFamily: MONO, fontSize: 9, fontWeight: 'bold', letterSpacing: 3, color: '#CFE2EA', marginTop: 8 },
  briefP: { fontFamily: MONO, fontSize: 9, color: '#9FB4C2', lineHeight: 14, marginTop: 2 },
  briefClose: {
    alignSelf: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CSS.TEAL,
    backgroundColor: 'rgba(45,226,198,0.14)',
    paddingHorizontal: 22,
    paddingVertical: 6,
  },
  briefCloseTxt: { fontFamily: MONO, fontSize: 10, fontWeight: 'bold', letterSpacing: 3, color: CSS.TEAL },
});
