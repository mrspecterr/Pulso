import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { AGENTS, BTN, CSS, PLAYER_HP, QUALITY, WEAPONS } from '../config/constants';
import {
  gameStats,
  lookState,
  playerVitals,
  roundState,
  sessionState,
  settings,
} from '../core/state';
import type { Phase } from '../core/state';
import InputLayer from '../core/InputLayer';
import BuyMenu from './BuyMenu';
import Crosshair from './Crosshair';
import DamageVignette from './DamageVignette';
import FireButton from './FireButton';
import Hitmarker from './Hitmarker';
import Joystick from './Joystick';
import MatchOver from './MatchOver';
import PlantButton from './PlantButton';
import ReloadButton from './ReloadButton';
import TracoButtons from './TracoButtons';
import TracoFlash from './TracoFlash';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

interface Snap {
  ammo: number;
  reloading: boolean;
  reloadProgress: number;
  shots: number;
  hits: number;
  kills: number;
  headshots: number;
  phase: Phase;
  roundNum: number;
  coro: number;
  dirac: number;
  dB: number;
  weapon: string;
  mag: number;
  carrying: boolean;
  planted: boolean;
  inSite: 'A' | 'B' | null;
  plantProgress: number;
  outcome: 'pulse' | 'time' | 'elim' | 'silenced' | null;
  matchWinner: 'CORO' | 'DIRAC' | null;
  hp: number;
  shield: number;
  shieldBonus: number; // escudo temporal da COURAÇA (GRAVE, Etapa 8)
  enemies: number; // operadores DIRAC em campo
  defusing: boolean; // um DIRAC silenciando o Diapasão (Etapa 7)
  defuseProgress: number; // 0..1 do canal
  secLeft: number; // segundos da fase/carga atual
  fps: number; // quadros por segundo (Etapa 10)
  sens: number; // multiplicador de sensibilidade vigente
  quality: string; // rótulo da qualidade gráfica vigente
  vol: number; // volume do áudio vigente (Etapa 11)
}

function readState(): Snap {
  const now = performance.now();
  const end =
    roundState.phase === 'live' && roundState.planted
      ? roundState.chargeEndsAt
      : roundState.phaseEndsAt;
  return {
    ammo: gameStats.ammo,
    reloading: gameStats.reloading,
    reloadProgress: gameStats.reloadProgress,
    shots: gameStats.shots,
    hits: gameStats.hits,
    kills: gameStats.kills,
    headshots: gameStats.headshots,
    phase: roundState.phase,
    roundNum: roundState.roundNum,
    coro: roundState.scoreCORO,
    dirac: roundState.scoreDIRAC,
    dB: roundState.dB,
    weapon: roundState.weapon,
    mag: WEAPONS[roundState.weapon].MAG,
    carrying: roundState.carrying,
    planted: roundState.planted,
    inSite: roundState.inSite,
    plantProgress: roundState.plantProgress,
    outcome: roundState.outcome,
    matchWinner: roundState.matchWinner,
    hp: playerVitals.hp,
    shield: playerVitals.shield,
    shieldBonus: playerVitals.shieldBonus,
    enemies: gameStats.enemiesAlive,
    defusing: gameStats.defusing,
    defuseProgress: gameStats.defuseProgress,
    secLeft: Math.max(0, Math.ceil((end - now) / 1000)),
    fps: gameStats.fps,
    sens: settings.sensMultiplier,
    quality: QUALITY[settings.quality].label,
    vol: settings.volume,
  };
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const PHASE_LABEL: Record<Phase, string> = {
  buy: 'COMPRA',
  live: 'AÇÃO',
  end: 'FIM DE RODADA',
  over: 'PARTIDA ENCERRADA',
};

/**
 * Hud — overlay sobre a cena 3D (Etapa 5): placar de rodadas CORO × DIRAC,
 * fases com timer, economia em dB, vitais, loja, plantio e fim de partida.
 */
export default function Hud() {
  const [s, setS] = useState<Snap>(() => readState());
  // kit fixo da partida — o HUD lê direto da sessão (Etapa 8)
  const A = AGENTS[sessionState.agent];
  const tracoHint = A.tracos.map((t) => `${t.glyph} ${t.label}`).join(' · ');
  const shieldTotal = s.shield + s.shieldBonus;

  useEffect(() => {
    const id = setInterval(() => setS(readState()), 100);
    return () => clearInterval(id);
  }, []);

  const showCombat = s.phase === 'live' || s.phase === 'end';
  const modalOpen = s.phase === 'buy' || s.phase === 'over';
  const showPlant =
    s.phase === 'live' && s.carrying && s.inSite !== null && !s.planted && s.hp > 0;
  const timerCritical = s.phase === 'live' && s.secLeft <= 10;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {/* ==== topo esquerdo: identidade + economia ==== */}
      <View style={styles.tl}>
        <Text style={styles.title}>PULSO</Text>
        <Text style={styles.sub}>
          RODADA {s.roundNum} · v0.11
        </Text>
        <Text style={[styles.agent, { color: A.corCss }]}>
          {A.nome} · {A.funcao}
        </Text>
        <Text style={styles.db}>{s.dB} dB</Text>
        <Text style={styles.gun}>{s.weapon}</Text>
        {s.carrying && s.phase === 'live' ? (
          <View style={styles.chip}>
            <Text style={styles.chipTxt}>◈ DIAPASÃO</Text>
          </View>
        ) : null}
      </View>

      {/* ==== topo centro: placar + fase + timer ==== */}
      <View style={styles.tc}>
        <View style={styles.scoreRow}>
          <View style={[styles.scoreSide, styles.coroSide]}>
            <Text style={styles.scoreName}>CORO</Text>
            <Text style={styles.scoreNum}>{s.coro}</Text>
          </View>
          <Text style={styles.scoreDash}>×</Text>
          <View style={[styles.scoreSide, styles.diracSide]}>
            <Text style={styles.scoreName}>DIRAC</Text>
            <Text style={styles.scoreNum}>{s.dirac}</Text>
          </View>
        </View>
        <Text style={styles.phaseLabel}>
          {s.phase === 'live' && s.planted ? 'DIAPASÃO ATIVO' : PHASE_LABEL[s.phase]}
        </Text>
        {s.phase !== 'over' ? (
          <Text
            style={[
              styles.timer,
              s.phase === 'live' && s.planted ? styles.timerPulse : null,
              timerCritical && !s.planted ? styles.timerCrit : null,
            ]}
          >
            {mmss(s.secLeft)}
          </Text>
        ) : null}
        {/* vitais: hp + escudo */}
        <View style={styles.vitals}>
          <View style={styles.hpBg}>
            <View style={[styles.hpFill, { width: `${(s.hp / PLAYER_HP) * 100}%` }]} />
          </View>
          {shieldTotal > 0 ? (
            <View style={styles.shBg}>
              <View
                style={[
                  styles.shFill,
                  s.shieldBonus > 0 && styles.shBonus,
                  { width: `${Math.min(100, (shieldTotal / 100) * 100)}%` },
                ]}
              />
            </View>
          ) : null}
        </View>
      </View>

      {/* topo direito: leitura + ameaça + FPS */}
      <View style={styles.tr}>
        <Text style={styles.readout}>
          {Math.round((lookState.yaw * 180) / Math.PI)}° ·{' '}
          {Math.round((lookState.pitch * 180) / Math.PI)}°
        </Text>
        <Text style={styles.enemyCount}>{s.enemies} DIRAC EM CAMPO</Text>
        <Text style={styles.fpsTag}>{s.fps} FPS</Text>
      </View>
      {/* SENS e GRAF: coluna esquerda, posição/tamanho FIXOS (BTN) —
          tocados via camada de input */}
      <View pointerEvents="none" style={styles.sensBtn}>
        <Text style={styles.sensTxt}>SENS {s.sens.toFixed(1)}×</Text>
      </View>
      <View pointerEvents="none" style={styles.grafBtn}>
        <Text style={styles.grafTxt}>GRAF {s.quality}</Text>
      </View>
      <View pointerEvents="none" style={styles.sndBtn}>
        <Text style={styles.sndTxt}>
          SOM {s.vol > 0 ? `${Math.round(s.vol * 100)}%` : 'MUDO'}
        </Text>
      </View>

      {/* ==== dicas contextuais ==== */}
      {s.phase === 'buy' ? (
        <View style={styles.bc}>
          <Text style={styles.hint}>compre equipamento e confirme PRONTO</Text>
          <Text style={styles.hintDim}>abates rendem +200 dB · Traços: {tracoHint}</Text>
        </View>
      ) : null}
      {s.phase === 'live' && !s.planted ? (
        <View style={styles.bc}>
          <Text style={styles.hint}>
            {s.carrying
              ? 'leve o Diapasão ao SITE A ou B e segure PLANTAR'
              : 'proteja a carga até completar o PULSO'}
          </Text>
          <Text style={styles.hintDim}>
            operadores DIRAC defendem os sites · mover cancela o plantio
          </Text>
        </View>
      ) : null}
      {s.phase === 'live' && s.planted ? (
        <View style={styles.bc}>
          <Text style={styles.hintTeal}>
            defenda o site — os DIRAC vão tentar silenciar o Diapasão
          </Text>
        </View>
      ) : null}

      {/* ==== alerta de silenciamento em andamento (Etapa 7) ==== */}
      {s.phase === 'live' && s.planted && s.defusing ? (
        <View style={styles.defuseBox}>
          <Text style={styles.defuseTitle}>DIAPASÃO SOB SILENCIAMENTO</Text>
          <View style={styles.defuseBg}>
            <View style={[styles.defuseFill, { width: `${s.defuseProgress * 100}%` }]} />
          </View>
          <Text style={styles.defuseSub}>acerte o operador para interromper</Text>
        </View>
      ) : null}

      {/* ==== banner de fim de rodada ==== */}
      {s.phase === 'end' && s.outcome ? (
        <View style={styles.banner}>
          <Text style={[styles.bannerTitle, s.outcome === 'pulse' ? styles.teal : styles.magenta]}>
            {s.outcome === 'pulse'
              ? 'PULSO ESTABELECIDO'
              : s.outcome === 'elim'
                ? 'VOCÊ FOI ELIMINADO'
                : s.outcome === 'silenced'
                  ? 'DIAPASÃO SILENCIADO'
                  : 'TEMPO ESGOTADO'}
          </Text>
          <Text style={styles.bannerSub}>
            ponto para {s.outcome === 'pulse' ? 'CORO' : 'DIRAC'} · próxima rodada em {s.secLeft}s
          </Text>
        </View>
      ) : null}

      {/* ==== munição (acima do botão de tiro) ==== */}
      {showCombat ? (
        <View style={styles.ammoBox}>
          <Text style={styles.ammoGun}>{s.weapon}</Text>
          <Text style={[styles.ammoCount, s.ammo <= 5 ? styles.ammoLow : null]}>
            {s.ammo} / {s.mag}
          </Text>
        </View>
      ) : null}

      {/* barra de recarga sob a mira */}
      {s.reloading ? (
        <View style={styles.reloadWrap}>
          <Text style={styles.reloadTxt}>RECARREGANDO</Text>
          <View style={styles.reloadBarBg}>
            <View style={[styles.reloadBarFill, { width: `${s.reloadProgress * 100}%` }]} />
          </View>
        </View>
      ) : null}

      {/* ==== controles (fases de combate) ==== */}
      {showCombat ? (
        <>
          <Crosshair />
          <Hitmarker />
          <FireButton />
          <ReloadButton />
          <TracoButtons />
        </>
      ) : null}
      {showPlant ? <PlantButton /> : null}
      <Joystick />

      {/* ==== camada única de entrada (Etapa 10: multi-touch real) ==== */}
      <InputLayer active={!modalOpen} />

      {/* ==== loja / fim de partida (acima da camada de entrada) ==== */}
      {s.phase === 'buy' ? <BuyMenu /> : null}
      {s.phase === 'over' ? <MatchOver /> : null}

      {/* dano recebido (sempre montado; invisível quando parado) */}
      <DamageVignette />
      {/* feedback dos Traços (sempre montado; invisível quando parado) */}
      <TracoFlash />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  tl: { position: 'absolute', top: 14, left: 22 },
  tc: { position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center' },
  tr: { position: 'absolute', top: 14, right: 22, alignItems: 'flex-end' },
  bc: { position: 'absolute', bottom: 18, left: 0, right: 0, alignItems: 'center' },
  title: {
    fontFamily: MONO,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 8,
    color: CSS.TEAL,
  },
  sub: { fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: CSS.TEXT_DIM, marginTop: 2 },
  agent: { fontFamily: MONO, fontSize: 10, letterSpacing: 2, fontWeight: 'bold', marginTop: 3 },
  db: { fontFamily: MONO, fontSize: 15, fontWeight: 'bold', color: '#F2FBFF', marginTop: 6 },
  gun: { fontFamily: MONO, fontSize: 10, letterSpacing: 3, color: CSS.TEXT_DIM, marginTop: 2 },
  chip: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(45,226,198,0.6)',
    backgroundColor: 'rgba(45,226,198,0.10)',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chipTxt: { fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: CSS.TEAL },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  scoreSide: { alignItems: 'center', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 4 },
  coroSide: { backgroundColor: 'rgba(45,226,198,0.12)', borderColor: 'rgba(45,226,198,0.4)', borderWidth: 1 },
  diracSide: { backgroundColor: 'rgba(255,61,142,0.12)', borderColor: 'rgba(255,61,142,0.4)', borderWidth: 1 },
  scoreName: { fontFamily: MONO, fontSize: 9, letterSpacing: 3, color: CSS.TEXT_DIM },
  scoreNum: { fontFamily: MONO, fontSize: 22, fontWeight: 'bold', color: '#F2FBFF' },
  scoreDash: { fontFamily: MONO, fontSize: 16, color: CSS.TEXT_DIM, marginHorizontal: 12 },
  phaseLabel: { fontFamily: MONO, fontSize: 9, letterSpacing: 4, color: CSS.TEXT_DIM, marginTop: 5 },
  timer: { fontFamily: MONO, fontSize: 24, fontWeight: 'bold', color: '#F2FBFF', marginTop: 1 },
  timerPulse: { color: CSS.TEAL },
  timerCrit: { color: CSS.MAGENTA },
  vitals: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  hpBg: {
    width: 170,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,61,142,0.18)',
    overflow: 'hidden',
  },
  hpFill: { height: '100%', backgroundColor: CSS.MAGENTA },
  shBg: {
    width: 80,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
    backgroundColor: 'rgba(122,139,153,0.18)',
    overflow: 'hidden',
  },
  shFill: { height: '100%', backgroundColor: '#9FD8E8' },
  shBonus: { backgroundColor: '#FFB454' }, // COURAÇA ativa (âmbar)
  readout: { fontFamily: MONO, fontSize: 10, color: CSS.TEXT_DIM },
  fpsTag: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 1,
    color: 'rgba(122,139,153,0.7)',
    marginTop: 4,
  },
  enemyCount: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(255,61,142,0.85)',
    marginTop: 4,
  },
  sensBtn: {
    position: 'absolute',
    left: BTN.SENS.left,
    top: BTN.SENS.top,
    width: BTN.SENS.w,
    height: BTN.SENS.h,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(45,226,198,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sensTxt: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: CSS.TEAL },
  grafBtn: {
    position: 'absolute',
    left: BTN.GRAF.left,
    top: BTN.GRAF.top,
    width: BTN.GRAF.w,
    height: BTN.GRAF.h,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grafTxt: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: '#AFC2CE' },
  sndBtn: {
    position: 'absolute',
    left: BTN.SND.left,
    top: BTN.SND.top,
    width: BTN.SND.w,
    height: BTN.SND.h,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(242,251,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sndTxt: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: '#EAF6F2' },
  hint: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, color: '#AFC2CE' },
  hintDim: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 1,
    color: CSS.TEXT_DIM,
    marginTop: 3,
  },
  hintTeal: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, color: CSS.TEAL },
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '38%',
    alignItems: 'center',
  },
  bannerTitle: { fontFamily: MONO, fontSize: 26, fontWeight: 'bold', letterSpacing: 6 },
  teal: { color: CSS.TEAL },
  magenta: { color: CSS.MAGENTA },
  bannerSub: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: '#AFC2CE', marginTop: 6 },
  defuseBox: {
    position: 'absolute',
    left: '50%',
    marginLeft: -130,
    top: '22%',
    width: 260,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,61,142,0.7)',
    backgroundColor: 'rgba(9,13,18,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  defuseTitle: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: CSS.MAGENTA,
  },
  defuseBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,61,142,0.2)',
    overflow: 'hidden',
    marginTop: 8,
  },
  defuseFill: { height: '100%', backgroundColor: CSS.MAGENTA },
  defuseSub: {
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 1,
    color: CSS.TEXT_DIM,
    marginTop: 5,
  },
  ammoBox: {
    position: 'absolute',
    right: 34,
    bottom: 134,
    alignItems: 'flex-end',
  },
  ammoGun: { fontFamily: MONO, fontSize: 10, letterSpacing: 3, color: CSS.TEXT_DIM },
  ammoCount: {
    fontFamily: MONO,
    fontSize: 26,
    fontWeight: 'bold',
    color: '#F2FBFF',
    letterSpacing: 1,
  },
  ammoLow: { color: CSS.MAGENTA },
  reloadWrap: {
    position: 'absolute',
    left: '50%',
    top: '58%',
    marginLeft: -90,
    width: 180,
    alignItems: 'center',
  },
  reloadTxt: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 3,
    color: CSS.MAGENTA,
    marginBottom: 5,
  },
  reloadBarBg: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,61,142,0.25)',
    overflow: 'hidden',
  },
  reloadBarFill: { height: '100%', backgroundColor: CSS.MAGENTA },
});
