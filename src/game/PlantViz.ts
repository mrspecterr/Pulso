// Visual do Diapasão plantado (Etapa 14 — extraído do SubsoloScene para
// compartilhar entre os mapas).
//
// O núcleo viaja com o jogador (invisível) e ASSUME o site quando é
// plantado: icosaedro teal girando + anel magenta + octaedro brilhante,
// com um anel de pulso que expande do chão em loop.
// A resolução de sombra é responsabilidade da cena; isto é só o objeto.

import * as THREE from 'three';
import { COLORS } from '../config/constants';

export class PlantViz {
  private group = new THREE.Group();
  private core = new THREE.Mesh();
  private outer = new THREE.LineSegments();
  private ring = new THREE.Mesh();
  private pulseRing: THREE.Mesh;
  private pulseT = 0;

  constructor(scene: THREE.Scene) {
    const diapOuter = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.62, 0)),
      new THREE.LineBasicMaterial({ color: COLORS.TEAL, transparent: true, opacity: 0.85 })
    );
    const diapRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.44, 0.02, 8, 40),
      new THREE.MeshBasicMaterial({ color: COLORS.MAGENTA })
    );
    const diapCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.15, 0),
      new THREE.MeshBasicMaterial({ color: 0xd9fff4 })
    );
    this.group.add(diapOuter, diapRing, diapCore);
    this.group.visible = false; // o Diapasão viaja com o jogador
    this.outer = diapOuter;
    this.ring = diapRing;
    this.core = diapCore;
    scene.add(this.group);

    // anel de pulso que expande do Diapasão plantado
    this.pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.82, 48),
      new THREE.MeshBasicMaterial({
        color: COLORS.TEAL,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.pulseRing.rotation.x = -Math.PI / 2;
    this.pulseRing.visible = false;
    scene.add(this.pulseRing);
  }

  /** Posiciona o Diapasão num site e acorda o anel de pulso. */
  plant(x: number, z: number) {
    this.group.visible = true;
    this.group.position.set(x, 1.15, z);
    this.pulseRing.visible = true;
    this.pulseRing.position.set(x, 0.05, z);
    this.pulseT = 0;
  }

  /** Remove o Diapasão plantado (início de rodada). */
  clearPlant() {
    this.group.visible = false;
    this.pulseRing.visible = false;
  }

  /** Animações por frame (chamar com dt do loop e t em segundos). */
  update(dt: number, t: number) {
    this.outer.rotation.y += dt * 0.5;
    this.outer.rotation.x += dt * 0.13;
    this.ring.rotation.x += dt * 1.1;
    this.ring.rotation.y -= dt * 0.7;
    this.group.position.y = 1.15 + Math.sin(t * 1.7) * 0.1;
    this.core.scale.setScalar(0.9 + Math.sin(t * 3.4) * 0.28);
    this.core.rotation.y += dt * 2.2;

    // anel plantado: expande em loop
    if (this.pulseRing.visible) {
      this.pulseT += dt * 0.55;
      if (this.pulseT > 1) this.pulseT -= 1;
      this.pulseRing.scale.setScalar(0.6 + this.pulseT * 3.2);
      (this.pulseRing.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - this.pulseT);
    }
  }
}
