import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CSS, SITES, WORLD } from '../config/constants';
import { minimapState } from '../core/state';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

// escala do mundo para o retângulo do minimapa (px por metro)
const S = 4.4;
const W = WORLD.W * S; // 40 m → 176 px
const H = WORLD.H * S; // 32 m → ~141 px

const toX = (x: number) => (x + WORLD.W / 2) * S;
const toY = (z: number) => (z + WORLD.H / 2) * S;

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
 * Minimapa tático (Etapa 13) — planta do SUBSOLO vista de cima (norte = -Z
 * = topo). Paredes e colunas são o footprint real dos colisores do mapa.
 *
 * Legenda: seta teal = você · pontos teal = esquadrão · ◈ = quem carrega o
 * Diapasão · pontos magenta = DIRAC aceso (atirou, levou dano ou revelado
 * pelo SONAR — não é wallhack) · A/B = sites de plantio.
 *
 * Polling próprio a 150 ms — não depende do resto do HUD.
 */
export default function Minimap() {
  const [f, setF] = useState<Frame>(() => readFrame());
  const [walls, setWalls] = useState(minimapState.walls);

  useEffect(() => {
    const id = setInterval(() => {
      setF(readFrame());
      // as paredes chegam quando o mundo 3D termina de construir
      if (walls.length === 0 && minimapState.walls.length > 0) {
        setWalls(minimapState.walls);
      }
    }, 150);
    return () => clearInterval(id);
  }, [walls.length]);

  return (
    <View pointerEvents="none" style={styles.box}>
      {/* paredes, colunas e caixotes (footprint dos colisores) */}
      {walls.map((w, i) => (
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
      <Text style={[styles.site, styles.siteA, { left: toX(SITES.A.x) - 4, top: toY(SITES.A.z) - 8 }]}>
        A
      </Text>
      <Text style={[styles.site, styles.siteB, { left: toX(SITES.B.x) - 4, top: toY(SITES.B.z) - 8 }]}>
        B
      </Text>

      {/* Diapasão plantado: losango pulsando no site */}
      {f.planted ? (
        <View
          style={[
            styles.plantedWrap,
            { left: toX(SITES[f.planted].x) - 9, top: toY(SITES[f.planted].z) - 9 },
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
    width: W,
    height: H,
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
