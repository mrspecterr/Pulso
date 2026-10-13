import * as THREE from 'three';
import { COLORS } from '../config/constants';
import { TARGET_HP, TARGET_RESPAWN_MS } from '../config/constants';
import { StaticBuckets } from '../core/merge';

type DummyState = 'alive' | 'dying' | 'dead' | 'spawning';

interface Dummy {
  id: number;
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  bar: THREE.Mesh;
  barMat: THREE.MeshBasicMaterial;
  bodyMat: THREE.MeshStandardMaterial;
  headMat: THREE.MeshStandardMaterial;
  hp: number;
  state: DummyState;
  stateT: number; // timestamp de entrada no estado
  flash: number; // 0..1 brilho de dano
}

/**
 * Campo de tiro — bonecos DIRAC com cabeça (headshot) e corpo, barra de
 * vida flutuante, morte por dano e respawn automático.
 */
export class TargetRange {
  readonly dummies: Dummy[] = [];
  /** malhas vivas para o raycast das balas */
  readonly meshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, spots: Array<[number, number]>) {
    const bodyGeo = new THREE.CapsuleGeometry(0.26, 0.92, 6, 12);
    const headGeo = new THREE.SphereGeometry(0.18, 16, 12);
    const barGeo = new THREE.PlaneGeometry(0.72, 0.075);

    // peças de armadura compartilhadas (não entram no raycast — só corpo e
    // cabeça são malhas de acerto)
    const armorGeo = new THREE.BoxGeometry(0.36, 0.44, 0.2);
    const packGeo = new THREE.BoxGeometry(0.32, 0.42, 0.15);
    const shoulderGeo = new THREE.BoxGeometry(0.15, 0.1, 0.24);
    const beltGeo = new THREE.BoxGeometry(0.54, 0.09, 0.4);
    const visorGeo = new THREE.BoxGeometry(0.2, 0.05, 0.05);
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x3a4450,
      roughness: 0.55,
      metalness: 0.2,
    });
    const packMat = new THREE.MeshStandardMaterial({
      color: 0x2c343f,
      roughness: 0.68,
      metalness: 0.12,
    });
    const trimGlowMat = new THREE.MeshBasicMaterial({ color: COLORS.TEAL });

    spots.forEach(([x, z], id) => {
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x2a3542,
        roughness: 0.7,
        metalness: 0.2,
        emissive: COLORS.MAGENTA,
        emissiveIntensity: 0.12,
      });
      const headMat = new THREE.MeshStandardMaterial({
        color: 0x37424f,
        roughness: 0.6,
        metalness: 0.25,
        emissive: COLORS.MAGENTA,
        emissiveIntensity: 0.22,
      });

      const group = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.98;
      body.castShadow = true;

      // armadura do boneco de treino — fundida por material (Etapa 10):
      // peças fixas entre si → 2 meshes em vez de 5
      const armor = new StaticBuckets(body);
      const chest = new THREE.Mesh(armorGeo, armorMat);
      chest.position.set(0, 0.14, 0.13);
      const pack = new THREE.Mesh(packGeo, packMat);
      pack.position.set(0, 0.12, -0.21);
      const shL = new THREE.Mesh(shoulderGeo, armorMat);
      shL.position.set(-0.3, 0.36, 0);
      const shR = new THREE.Mesh(shoulderGeo, armorMat);
      shR.position.set(0.3, 0.36, 0);
      const belt = new THREE.Mesh(beltGeo, armorMat);
      belt.position.set(0, -0.44, 0);
      for (const piece of [chest, pack, shL, shR, belt]) {
        piece.castShadow = true;
        armor.add(piece);
      }
      armor.build();

      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.66;
      head.castShadow = true;
      const visor = new THREE.Mesh(visorGeo, trimGlowMat);
      visor.position.set(0, 0.02, 0.16);
      head.add(visor);

      // pedestal (visual, ancora o boneco no chão)
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.4, 0.12, 12),
        new THREE.MeshStandardMaterial({ color: 0x212b36, roughness: 0.85 })
      );
      base.position.y = 0.06;
      base.castShadow = true;

      const barMat = new THREE.MeshBasicMaterial({
        color: COLORS.TEAL,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.y = 2.0;

      group.add(base, body, head, bar);
      group.position.set(x, 0, z);
      scene.add(group);

      // etiquetas para o raycast saber quem foi atingido e onde
      body.userData = { dummyId: id, part: 'body' };
      head.userData = { dummyId: id, part: 'head' };

      const d: Dummy = {
        id,
        group,
        body,
        head,
        bar,
        barMat,
        bodyMat,
        headMat,
        hp: TARGET_HP,
        state: 'alive',
        stateT: 0,
        flash: 0,
      };
      this.dummies.push(d);
      this.meshes.push(body, head);
    });
  }

  /** Reinicia todos os bonecos (início de rodada). */
  reset() {
    const now = performance.now();
    for (const d of this.dummies) {
      d.hp = TARGET_HP;
      d.state = 'alive';
      d.stateT = now;
      d.flash = 0;
      d.group.visible = true;
      d.group.rotation.x = 0;
      d.group.scale.setScalar(1);
      d.bar.visible = true;
      d.bodyMat.emissiveIntensity = 0.12;
      d.headMat.emissiveIntensity = 0.22;
      this.updateBar(d);
    }
  }

  /** Consulta rápida: a malha pertence a um boneco vivo? */
  dummyOf(mesh: THREE.Object3D): Dummy | null {
    const ud = mesh.userData as { dummyId?: number; part?: string } | undefined;
    if (ud == null || ud.dummyId == null) return null;
    const d = this.dummies[ud.dummyId];
    if (!d || d.state !== 'alive') return null;
    return d;
  }

  /**
   * Aplica dano a um boneco. Retorna o resultado para feedback de HUD.
   */
  damage(d: Dummy, amount: number, isHead: boolean): { killed: boolean; hp: number } {
    d.hp -= amount;
    d.flash = 1;
    if (d.hp <= 0) {
      d.hp = 0;
      d.state = 'dying';
      d.stateT = performance.now();
      this.updateBar(d);
      return { killed: true, hp: 0 };
    }
    this.updateBar(d);
    return { killed: false, hp: d.hp };
  }

  private updateBar(d: Dummy) {
    const k = d.hp / TARGET_HP;
    d.bar.scale.x = Math.max(0.02, k);
    // teal (cheio) → âmbar (meio) → magenta (crítico)
    const c = new THREE.Color(COLORS.TEAL).lerp(new THREE.Color(COLORS.MAGENTA), 1 - k);
    d.barMat.color.copy(c);
  }

  update(dt: number, camera: THREE.Camera) {
    const now = performance.now();
    for (const d of this.dummies) {
      // barra sempre de frente pra câmera
      d.bar.quaternion.copy(camera.quaternion);

      // decaimento do brilho de dano
      if (d.flash > 0) {
        d.flash = Math.max(0, d.flash - dt * 8);
        const glow = 0.12 + d.flash * 1.6;
        d.bodyMat.emissiveIntensity = glow;
        d.headMat.emissiveIntensity = 0.22 + d.flash * 1.8;
      }

      switch (d.state) {
        case 'dying': {
          // tomba para frente em 450ms
          const k = Math.min(1, (now - d.stateT) / 450);
          d.group.rotation.x = (k * k) * (Math.PI / 2) * 0.92;
          d.bar.visible = false;
          if (k >= 1) {
            d.state = 'dead';
            d.stateT = now;
            d.group.visible = false;
          }
          break;
        }
        case 'dead': {
          if (now - d.stateT >= TARGET_RESPAWN_MS) {
            d.state = 'spawning';
            d.stateT = now;
            d.hp = TARGET_HP;
            d.group.visible = true;
            d.group.rotation.x = 0;
            d.group.scale.setScalar(0.01);
            d.bar.visible = true;
            this.updateBar(d);
          }
          break;
        }
        case 'spawning': {
          // cresce de 0 → 1 em 350ms
          const k = Math.min(1, (now - d.stateT) / 350);
          d.group.scale.setScalar(0.2 + 0.8 * k);
          if (k >= 1) {
            d.state = 'alive';
            d.group.scale.setScalar(1);
          }
          break;
        }
        default:
          break;
      }
    }
  }
}
