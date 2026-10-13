// Arma em primeira pessoa (viewmodel) do PULSO.
//
// O modelo é montado com primitivas (caixas/cilindros) + textura procedural
// de gunmetal — o mesmo padrão visual do resto do jogo, sem assets externos.
// Fica pendurado na CÂMERA (a câmera precisa estar na cena para renderizar
// filhos). Animações: sway pela mira, bob ao andar, recuo no tiro, mergulho
// na recarga e clarão na boca.

import * as THREE from 'three';
import { glowTexture, gunmetalTexture } from '../core/textures';
import type { WeaponId } from '../config/constants';

export interface WeaponAnimState {
  moving: boolean;
  lookDX: number; // delta de yaw do frame (rad)
  lookDY: number; // delta de pitch do frame (rad)
  alive: boolean;
  reloading: boolean;
  reloadK: number; // 0..1
  weapon: WeaponId;
}

const BASE_POS = new THREE.Vector3(0.24, -0.19, -0.46);

export class WeaponSystem {
  readonly root = new THREE.Group();
  private rifle = new THREE.Group();
  private pistol = new THREE.Group();
  private muzzleRifle = new THREE.Object3D();
  private muzzlePistol = new THREE.Object3D();
  private flash: THREE.Mesh;
  private flashT = 0;
  private recoil = 0;
  private swayX = 0;
  private swayY = 0;
  private bobT = 0;
  private cur: WeaponId = 'LEGATO';
  private camera: THREE.PerspectiveCamera;
  // cápsulas ejetadas (pool — game feel)
  private shells: Array<{
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    spin: THREE.Vector3;
    life: number;
  }> = [];
  private shellIdx = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    const metalTex = gunmetalTexture();
    // SEM envmap no WebGL1: metalness alto = silhueta preta. Metal "pintado".
    const gunMetal = new THREE.MeshStandardMaterial({
      map: metalTex,
      color: 0xd6dce6,
      roughness: 0.48,
      metalness: 0.28,
    });
    const polymer = new THREE.MeshStandardMaterial({
      color: 0x363d46,
      roughness: 0.82,
      metalness: 0.08,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: 0x4a525c,
      roughness: 0.55,
      metalness: 0.2,
    });
    const dot = new THREE.MeshBasicMaterial({ color: 0x6bf7dd });

    const box = (
      g: THREE.Group,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      m: THREE.Material,
      rx = 0
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      if (rx !== 0) mesh.rotation.x = rx;
      g.add(mesh);
      return mesh;
    };

    // ---------------- FUZIL LEGATO ----------------
    // receiver + guarda-mão
    box(this.rifle, 0.09, 0.11, 0.36, 0, 0, 0, gunMetal);
    box(this.rifle, 0.078, 0.088, 0.42, 0, -0.004, -0.38, polymer);
    // cano + freio de boca
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 10), accent);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.012, -0.72);
    this.rifle.add(barrel);
    box(this.rifle, 0.046, 0.05, 0.1, 0, 0.012, -0.85, gunMetal);
    // trilho superior + massas de mira
    box(this.rifle, 0.05, 0.02, 0.62, 0, 0.066, -0.28, gunMetal);
    box(this.rifle, 0.014, 0.05, 0.014, 0, 0.096, -0.5, gunMetal);
    // red-dot + ponto teal
    box(this.rifle, 0.05, 0.05, 0.09, 0, 0.1, 0.02, polymer);
    box(this.rifle, 0.013, 0.013, 0.012, 0, 0.118, -0.02, dot);
    // carregador + punho + coronha
    box(this.rifle, 0.058, 0.22, 0.08, 0, -0.15, -0.1, gunMetal, 0.14);
    box(this.rifle, 0.052, 0.14, 0.06, 0, -0.13, 0.12, polymer, -0.32);
    box(this.rifle, 0.06, 0.09, 0.2, 0, -0.005, 0.28, polymer);
    box(this.rifle, 0.072, 0.12, 0.03, 0, -0.02, 0.38, polymer);
    // janela de ejeção (painel mais claro)
    box(this.rifle, 0.02, 0.035, 0.1, 0.047, 0.012, -0.04, accent);
    this.muzzleRifle.position.set(0, 0.012, -0.92);
    this.rifle.add(this.muzzleRifle);

    // ---------------- PISTOLA STACCATO ----------------
    box(this.pistol, 0.052, 0.062, 0.27, 0, 0.02, -0.09, gunMetal);
    box(this.pistol, 0.046, 0.036, 0.22, 0, -0.02, -0.07, polymer);
    box(this.pistol, 0.05, 0.15, 0.056, 0, -0.1, 0.0, polymer, -0.22);
    box(this.pistol, 0.012, 0.012, 0.06, 0, -0.048, -0.075, polymer); // guarda-mato
    box(this.pistol, 0.012, 0.02, 0.012, 0, -0.055, -0.11, polymer);
    box(this.pistol, 0.012, 0.018, 0.012, 0, 0.062, -0.21, gunMetal); // massa de mira
    box(this.pistol, 0.03, 0.02, 0.02, 0, 0.06, 0.03, gunMetal);
    box(this.pistol, 0.01, 0.01, 0.01, 0, 0.075, -0.045, dot);
    this.muzzlePistol.position.set(0, 0.028, -0.24);
    this.pistol.add(this.muzzlePistol);

    this.rifle.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    this.pistol.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });

    // clarão de boca — quad aditivo na ponta do cano
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.24),
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.flash.visible = false;
    this.root.add(this.flash);

    this.rifle.visible = true;
    this.pistol.visible = false;
    this.root.add(this.rifle, this.pistol);
    this.root.position.copy(BASE_POS);
    this.root.rotation.y = -0.07;
    camera.add(this.root);

    // pool de cápsulas (caem no espaço do mundo a partir da janela de ejeção)
    const shellGeo = new THREE.BoxGeometry(0.012, 0.012, 0.03);
    const shellMat = new THREE.MeshBasicMaterial({ color: 0xd9a94f });
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(shellGeo, shellMat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.shells.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 });
    }
  }

  /** adiciona as cápsulas à cena (chamado pelo Game após construir). */
  attachShells(scene: THREE.Scene) {
    for (const s of this.shells) scene.add(s.mesh);
  }

  setWeapon(id: WeaponId) {
    if (id === this.cur) return;
    this.cur = id;
    this.rifle.visible = id === 'LEGATO';
    this.pistol.visible = id === 'STACCATO';
    this.recoil = 0.55; // "sacudida" de troca
    this.flashT = 0;
  }

  /** Chamado a cada tiro: recuo + clarão + cápsula ejetada. */
  onFire() {
    this.recoil = Math.min(1, this.recoil + 0.55);
    this.flashT = 0.05;
    this.flash.rotation.z = Math.random() * Math.PI;
    const s = 1.0 + Math.random() * 0.6;
    this.flash.scale.setScalar(this.cur === 'LEGATO' ? s : s * 0.75);
    this.ejectShell();
  }

  private ejectShell() {
    const sh = this.shells[this.shellIdx];
    this.shellIdx = (this.shellIdx + 1) % this.shells.length;
    if (!sh || !sh.mesh.parent) return;
    // janela de ejeção em espaço da câmera → mundo
    const origin = sh.mesh.position;
    origin.set(0.047, 0.012, -0.04).applyMatrix4(this.camera.matrixWorld);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    sh.vel
      .copy(right)
      .multiplyScalar(1.4 + Math.random() * 0.9)
      .addScaledVector(up, 1.6 + Math.random() * 0.8)
      .addScaledVector(fwd, -0.25 + Math.random() * 0.3);
    sh.spin.set(
      (Math.random() - 0.5) * 22,
      (Math.random() - 0.5) * 22,
      (Math.random() - 0.5) * 22
    );
    sh.life = 0.55 + Math.random() * 0.15;
    sh.mesh.visible = true;
    sh.mesh.rotation.set(0, 0, 0);
  }

  /** Posição mundial da boca da arma (para tracer/luz). */
  muzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    const m = this.cur === 'LEGATO' ? this.muzzleRifle : this.muzzlePistol;
    return m.getWorldPosition(out);
  }

  update(dt: number, st: WeaponAnimState) {
    this.setWeapon(st.weapon);

    // sway: a arma "atrasa" em relação à mira
    const tx = THREE.MathUtils.clamp(-st.lookDX * 5.5, -0.05, 0.05);
    const ty = THREE.MathUtils.clamp(st.lookDY * 5.5, -0.05, 0.05);
    this.swayX += (tx - this.swayX) * Math.min(1, dt * 9);
    this.swayY += (ty - this.swayY) * Math.min(1, dt * 9);

    // bob de caminhada
    let bobX = 0;
    let bobY = 0;
    if (st.moving) {
      this.bobT += dt * 9.4;
      bobX = Math.sin(this.bobT) * 0.0085;
      bobY = -Math.abs(Math.cos(this.bobT)) * 0.007;
    } else {
      this.bobT = 0;
      // respiração parado
      bobY = Math.sin(performance.now() / 900) * 0.0022;
    }

    // recuo decai exponencial
    this.recoil *= Math.exp(-dt * 13);

    // animação de recarga: mergulha, rola e volta
    let dipY = 0;
    let roll = 0;
    let pitch = 0;
    if (st.reloading) {
      const k = Math.max(0, Math.min(1, st.reloadK));
      dipY = -0.17 * Math.sin(Math.PI * k);
      roll = 0.55 * Math.sin(Math.PI * k);
      pitch = -0.4 * Math.sin(Math.PI * k);
    }

    this.root.visible = st.alive;
    this.root.position.set(
      BASE_POS.x + this.swayX + bobX,
      BASE_POS.y + this.swayY + bobY + dipY,
      BASE_POS.z + this.recoil * 0.075
    );
    this.root.rotation.set(
      this.recoil * 0.11 + pitch + this.swayY * 1.6,
      -0.07 + this.swayX * 2.2,
      roll + this.swayX * 0.8
    );

    // clarão preso à boca da arma ativa
    const m = this.cur === 'LEGATO' ? this.muzzleRifle : this.muzzlePistol;
    const mp = this.flash.position;
    mp.set(m.position.x, m.position.y, m.position.z - 0.05);
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.visible = this.flashT > 0;
      (this.flash.material as THREE.MeshBasicMaterial).opacity = Math.max(0.15, this.flashT / 0.05);
    } else {
      this.flash.visible = false;
    }

    // cápsulas: gravidade + rotação + some no chão
    for (const sh of this.shells) {
      if (!sh.mesh.visible) continue;
      sh.life -= dt;
      if (sh.life <= 0) {
        sh.mesh.visible = false;
        continue;
      }
      sh.vel.y -= 9.8 * dt;
      sh.mesh.position.addScaledVector(sh.vel, dt);
      if (sh.mesh.position.y < 0.012) {
        sh.mesh.position.y = 0.012;
        sh.vel.set(0, 0, 0);
        sh.spin.multiplyScalar(0.82);
      }
      sh.mesh.rotation.x += sh.spin.x * dt;
      sh.mesh.rotation.y += sh.spin.y * dt;
      sh.mesh.rotation.z += sh.spin.z * dt;
    }
  }
}
