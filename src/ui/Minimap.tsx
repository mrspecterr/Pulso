import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CSS } from '../config/constants';
import { minimapState } from '../core/state';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

// Geometria do mapa da sessão (Etapa 14): chega com as paredes quando o
// mundo 3D termina de construir. A escala encaixa o mapa numa caixa de
// ~176×150 px qualquer que seja a planta.
const MAX_W = 176;
const MAX_H = 150;

interface Layout {
  walls: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
  W: number;
  H: number;
  A: { x: number; z: number };
  B: { x: number; z: number };
}

const readLayout = (): Layout => ({
  walls: minimapState.walls,
  W: minimapState.worldW,
  H: minimapState.worldH,
  A: minimapState.siteA,
  B: minimapState.siteB,
});

interface Frame {
  px: number;
  pz: number;
  yawDeg: number;
  allies: Array<{ x: number; z: number; alive: boolean }>;
  enemies: Array<{ x: number; z: number; show: boolean }>;
  planted: 'A' | 'B' | null;
  carrierIdx: number;
}

function readFrame(): Frame {
  const m = minimapState;
  return {
    px: m.px,
    pz: m.pz,
    // yaw + gira o mundo p/ esquerda; a seta gira p/ esquerda = graus negativos
    yawDeg: ((-m.yaw * 180) / Math.PI) % 360,
    allies: m.allies.map((a) => ({ x: a.x, z: a.z, alive: a.alive })),
    enemies: m.enemies.map((e) => ({ x: e.x, z: e.z, show: e.show })),
    planted: m.planted,
    carrierIdx: m.carrierIdx,
  };
}

/**
 * Minimapa tático (Etapa 13) — planta do mapa da sessão vista de cima
 * (norte = -Z = topo). Paredes e colunas são o footprint real dos
 * colisores do mapa. Etapa 14: desenha qualquer planta — SUBSOLO ou PALCO.
 *
 * Legenda: seta teal = você · pontos teal = esquadrão · ◈ = quem carrega o
 * Diapasão · pontos magenta = DIRAC aceso (atirou, levou dano ou revelado
 * pelo SONAR — não é wallhack) · A/B = sites de plantio.
 *
 * Polling próprio a 150 ms — não depende do resto do HUD.
 */
export default function Minimap() {
  const [f, setF] = useState<Frame>(() => readFrame());
  const [lay, setLay] = useState<Layout>(() => readLayout());

  useEffect(() => {
    const id = setInterval(() => {
      setF(readFrame());
      // a geometria chega quando o mundo 3D termina de construir
      if (lay.walls.length === 0 && minimapState.walls.length > 0) {
        setLay(readLayout());
      }
    }, 150);
    return () => clearInterval(id);
  }, [lay.walls.length]);

  // escala: px por metro (o mapa inteiro cabe na caixa)
  const S = Math.min(4.4, MAX_W / lay.W, MAX_H / lay.H);
  const BW = lay.W * S;
  const BH = lay.H * S;
  const toX = (x: number) => (x + lay.W / 2) * S;
  const toY = (z: number) => (z + lay.H / 2) * S;
  const sitePos = f.planted ? (f.planted === 'A' ? lay.A : lay.B) : null;

  return (
    <View pointerEvents="none" style={[styles.box, { width: BW, height: BH }]}>
      {/* paredes, colunas e caixotes (footprint dos colisores) */}
      {lay.walls.map((w, i) => (
        <View
          key={i}
          style={[
            styles.wall,
            {
              left: toX(w.minX),
              top: toY(w.minZ),
              width: Math.max(1.5, (w.maxX - w.minX) * S),
              height: Math.max(1.5, (w.maxZ - w.minZ) * S),
            },
          ]}
        />
      ))}

      {/* sites de plantio */}
      <Text style={[styles.site, styles.siteA, { left: toX(lay.A.x) - 4, top: toY(lay.A.z) - 8 }]}>
        A
      </Text>
      <Text style={[styles.site, styles.siteB, { left: toX(lay.B.x) - 4, top: toY(lay.B.z) - 8 }]}>
        B
      </Text>

      {/* Diapasão plantado: losango pulsando no site */}
      {sitePos ? (
        <View
          style={[
            styles.plantedWrap,
            { left: toX(sitePos.x) - 9, top: toY(sitePos.z) - 9 },
          ]}
        >
          <View style={styles.plantedRing} />
          <View style={styles.plantedCore} />
        </View>
      ) : null}

      {/* esquadrão CORO (sempre visível) */}
      {f.allies.map((a, i) =>
        a.alive ? (
          <View key={i} style={[styles.dot, styles.ally, { left: toX(a.x) - 3.5, top: toY(a.z) - 3.5 }]} />
        ) : null
      )}

      {/* portador do Diapasão (aliado com a carga, Etapa 13) */}
      {f.carrierIdx >= 0 && f.allies[f.carrierIdx]?.alive ? (
        <Text
          style={[
            styles.carrierGlyph,
            {
              left: toX(f.allies[f.carrierIdx].x) - 12,
              top: toY(f.allies[f.carrierIdx].z) - 16,
            },
          ]}
        >
          ◈
        </Text>
      ) : null}

      {/* operadores DIRAC acesos (não é wallhack) */}
      {f.enemies.map((e, i) =>
        e.show ? (
          <View key={i} style={[styles.dot, styles.enemy, { left: toX(e.x) - 3, top: toY(e.z) - 3 }]} />
        ) : null
      )}

      {/* você: seta apontando para onde olha */}
      <View style={[styles.arrowWrap, { left: toX(f.px) - 6, top: toY(f.pz) - 6 }]}>
        <View style={[styles.arrow, { transform: [{ rotate: `${f.yawDeg}deg` }] }]} />
      </View>

      {/* moldura */}
      <View style={styles.frame} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    right: 22,
    top: 78,
    backgroundColor: 'rgba(8,12,17,0.72)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  frame: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(45,226,198,0.35)',
    borderRadius: 6,
  },
  wall: {
    position: 'absolute',
    backgroundColor: 'rgba(122,139,153,0.55)',
  },
  site: {
    position: 'absolute',
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: 'bold',
  },
  siteA: { color: CSS.TEAL },
  siteB: { color: CSS.MAGENTA },
  dot: {
    position: 'absolute',
    borderRadius: 4,
  },
  ally: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: CSS.TEAL,
  },
  enemy: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CSS.MAGENTA,
    shadowColor: CSS.MAGENTA,
    shadowRadius: 3,
    shadowOpacity: 0.9,
  },
  carrierGlyph: {
    position: 'absolute',
    fontFamily: MONO,
    fontSize: 10,
    color: CSS.TEAL,
    textShadowColor: CSS.TEAL,
    textShadowRadius: 4,
  },
  arrowWrap: {
    position: 'absolute',
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#F2FBFF',
  },
  plantedWrap: {
    position: 'absolute',
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plantedRing: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: CSS.MAGENTA,
    opacity: 0.8,
  },
  plantedCore: {
    width: 7,
    height: 7,
    borderRadius: 2,
    backgroundColor: CSS.MAGENTA,
  },
});
