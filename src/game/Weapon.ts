// Arma em primeira pessoa (viewmodel) do PULSO.
//
// O modelo é montado com primitivas (caixas/cilindros) + textura procedural
// de gunmetal — o mesmo padrão visual do resto do jogo, sem assets externos.
// Fica pendurado na CÂMERA (a câmera precisa estar na cena para renderizar
// filhos). Animações: sway pela mira, bob ao andar, recuo no tiro, mergulho
// na recarga e clarão na boca.

import * as THREE from 'three';
import { glowTexture, gunmetalTexture } from '../core/textures';
import { StaticBuckets } from '../core/merge';
import type { WeaponId } from '../config/constants';

export interface WeaponAnimState {
  moving: boolean;
  lookDX: number; // delta de yaw do frame (rad)
  lookDY: number; // delta de pitch do frame (rad)
  alive: boolean;
  reloading: boolean;
  reloadK: number; // 0..1
  weapon: WeaponId;
  scoped: boolean; // Etapa 24: luneta da FERMATA aberta (viewmodel some)
}

const BASE_POS = new THREE.Vector3(0.24, -0.19, -0.46);

export class WeaponSystem {
  readonly root = new THREE.Group();
  private rifle = new THREE.Group();
  private pistol = new THREE.Group();
  private shotgun = new THREE.Group();
  private smg = new THREE.Group();
  private sniper = new THREE.Group();
  private muzzleRifle = new THREE.Object3D();
  private muzzlePistol = new THREE.Object3D();
  private muzzleShotgun = new THREE.Object3D();
  private muzzleSmg = new THREE.Object3D();
  private muzzleSniper = new THREE.Object3D();
  // corredera da GLISSANDO: peça MÓVEL (desliza p/ trás e volta após o tiro)
  private pumpHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.064, 0.17),
    new THREE.MeshStandardMaterial({ color: 0x2c333c, roughness: 0.85, metalness: 0.1 })
  );
  private pumpT = 0; // contagem regressiva da animação de bombeamento (s)
  // ferreirinho da FERMATA (Etapa 24): a alavanca sobe, puxa e fecha
  private boltLever = new THREE.Group();
  private boltT = 0; // contagem regressiva do ciclo do ferrolho (s)
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

    // peças fundidas por material (Etapa 10): o fuzil inteiro desenha em
    // ~4 chamadas (antes eram 13); a pistola em ~3 (antes 8). As peças
    // nunca se movem entre si — só o conjunto anima (sway/bob/recuo).
    const box = (
      g: StaticBuckets,
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
    const rifleParts = new StaticBuckets(this.rifle);
    // receiver + guarda-mão
    box(rifleParts, 0.09, 0.11, 0.36, 0, 0, 0, gunMetal);
    box(rifleParts, 0.078, 0.088, 0.42, 0, -0.004, -0.38, polymer);
    // cano + freio de boca
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 10), accent);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.012, -0.72);
    rifleParts.add(barrel);
    box(rifleParts, 0.046, 0.05, 0.1, 0, 0.012, -0.85, gunMetal);
    // trilho superior + massas de mira
    box(rifleParts, 0.05, 0.02, 0.62, 0, 0.066, -0.28, gunMetal);
    box(rifleParts, 0.014, 0.05, 0.014, 0, 0.096, -0.5, gunMetal);
    // red-dot + ponto teal
    box(rifleParts, 0.05, 0.05, 0.09, 0, 0.1, 0.02, polymer);
    box(rifleParts, 0.013, 0.013, 0.012, 0, 0.118, -0.02, dot);
    // carregador + punho + coronha
    box(rifleParts, 0.058, 0.22, 0.08, 0, -0.15, -0.1, gunMetal, 0.14);
    box(rifleParts, 0.052, 0.14, 0.06, 0, -0.13, 0.12, polymer, -0.32);
    box(rifleParts, 0.06, 0.09, 0.2, 0, -0.005, 0.28, polymer);
    box(rifleParts, 0.072, 0.12, 0.03, 0, -0.02, 0.38, polymer);
    // janela de ejeção (painel mais claro)
    box(rifleParts, 0.02, 0.035, 0.1, 0.047, 0.012, -0.04, accent);
    rifleParts.build();
    this.muzzleRifle.position.set(0, 0.012, -0.92);
    this.rifle.add(this.muzzleRifle);

    // ---------------- PISTOLA STACCATO ----------------
    const pistolParts = new StaticBuckets(this.pistol);
    box(pistolParts, 0.052, 0.062, 0.27, 0, 0.02, -0.09, gunMetal);
    box(pistolParts, 0.046, 0.036, 0.22, 0, -0.02, -0.07, polymer);
    box(pistolParts, 0.05, 0.15, 0.056, 0, -0.1, 0.0, polymer, -0.22);
    box(pistolParts, 0.012, 0.012, 0.06, 0, -0.048, -0.075, polymer); // guarda-mato
    box(pistolParts, 0.012, 0.02, 0.012, 0, -0.055, -0.11, polymer);
    box(pistolParts, 0.012, 0.018, 0.012, 0, 0.062, -0.21, gunMetal); // massa de mira
    box(pistolParts, 0.03, 0.02, 0.02, 0, 0.06, 0.03, gunMetal);
    box(pistolParts, 0.01, 0.01, 0.01, 0, 0.075, -0.045, dot);
    pistolParts.build();
    this.muzzlePistol.position.set(0, 0.028, -0.24);
    this.pistol.add(this.muzzlePistol);

    // ---------------- ESCOPETA GLISSANDO (Etapa 16) ----------------
    const shotParts = new StaticBuckets(this.shotgun);
    // receiver robusto + trilho
    box(shotParts, 0.082, 0.1, 0.3, 0, 0, -0.04, gunMetal);
    box(shotParts, 0.05, 0.02, 0.34, 0, 0.06, -0.1, gunMetal);
    // cano longo + anel do choke
    const shotBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.019, 0.46, 10),
      accent
    );
    shotBarrel.rotation.x = Math.PI / 2;
    shotBarrel.position.set(0, 0.03, -0.6);
    shotParts.add(shotBarrel);
    box(shotParts, 0.045, 0.045, 0.05, 0, 0.03, -0.84, gunMetal);
    // tubo de munição sob o cano
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.38, 10),
      gunMetal
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -0.014, -0.56);
    shotParts.add(tube);
    // massa de mira (bead) + alça em anel fantasma
    box(shotParts, 0.01, 0.014, 0.012, 0, 0.056, -0.8, dot);
    box(shotParts, 0.03, 0.03, 0.014, 0, 0.062, -0.2, gunMetal);
    // coronha de madeira pintada + punho
    box(shotParts, 0.055, 0.095, 0.2, 0, -0.012, 0.2, polymer);
    box(shotParts, 0.062, 0.13, 0.032, 0, -0.03, 0.31, polymer);
    box(shotParts, 0.05, 0.12, 0.06, 0, -0.09, 0.05, polymer, -0.3);
    // porta de carga + extração (painéis de destaque)
    box(shotParts, 0.02, 0.03, 0.09, 0.042, -0.005, -0.02, accent);
    shotParts.build();
    // corredera: peça viva sobre o tubo (não fundida — ela se move)
    this.pumpHand.position.set(0, -0.014, -0.5);
    this.shotgun.add(this.pumpHand);
    this.muzzleShotgun.position.set(0, 0.03, -0.87);
    this.shotgun.add(this.muzzleShotgun);

    // ---------------- SMG TREMOLANDO (Etapa 24) ----------------
    // Compacta, pente longo, cano curto: a arma que vive na mão.
    const smgParts = new StaticBuckets(this.smg);
    // receiver curto e alto + trilho
    box(smgParts, 0.088, 0.115, 0.3, 0, 0, -0.02, gunMetal);
    box(smgParts, 0.04, 0.018, 0.3, 0, 0.07, -0.04, gunMetal);
    // cano curto + rosca do silenciador curto
    const smgBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.22, 10),
      accent
    );
    smgBarrel.rotation.x = Math.PI / 2;
    smgBarrel.position.set(0, 0.01, -0.28);
    smgParts.add(smgBarrel);
    box(smgParts, 0.036, 0.036, 0.07, 0, 0.01, -0.41, gunMetal);
    // pente LONGO e reto (a assinatura da SMG) — no material da arma
    box(smgParts, 0.044, 0.26, 0.075, 0, -0.19, -0.04, gunMetal);
    // punho vertical + guarda-mão com painéis
    box(smgParts, 0.05, 0.13, 0.058, 0, -0.12, 0.09, polymer, -0.26);
    box(smgParts, 0.08, 0.07, 0.2, 0, -0.02, -0.14, polymer);
    box(smgParts, 0.02, 0.03, 0.12, 0.044, -0.012, -0.12, accent);
    // coronha de arame dobrável (fininha, característica)
    box(smgParts, 0.012, 0.012, 0.26, 0.03, 0.03, 0.24, accent);
    box(smgParts, 0.012, 0.012, 0.26, -0.03, 0.03, 0.24, accent);
    box(smgParts, 0.075, 0.03, 0.024, 0, 0.028, 0.37, polymer);
    box(smgParts, 0.075, 0.045, 0.02, 0, -0.005, 0.37, polymer);
    // mira: aro fantasma + ponto teal
    box(smgParts, 0.03, 0.028, 0.014, 0, 0.066, -0.16, gunMetal);
    box(smgParts, 0.011, 0.011, 0.011, 0, 0.08, -0.02, dot);
    smgParts.build();
    this.muzzleSmg.position.set(0, 0.01, -0.45);
    this.smg.add(this.muzzleSmg);

    // ---------------- RIFLE DE PRECISÃO FERMATA (Etapa 24) ----------------
    // O cano comprido, a luneta em cima e o ferrolho: a nota longa.
    const snipParts = new StaticBuckets(this.sniper);
    // receiver robusto + trilho longo
    box(snipParts, 0.09, 0.12, 0.4, 0, 0, 0.0, gunMetal);
    box(snipParts, 0.05, 0.022, 0.44, 0, 0.072, -0.02, gunMetal);
    // cano PESADO e comprido + freio de boca em duas câmaras
    const snipBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.019, 0.55, 10),
      accent
    );
    snipBarrel.rotation.x = Math.PI / 2;
    snipBarrel.position.set(0, 0.014, -0.62);
    snipParts.add(snipBarrel);
    box(snipParts, 0.05, 0.05, 0.06, 0, 0.014, -0.9, gunMetal);
    box(snipParts, 0.056, 0.056, 0.05, 0, 0.014, -0.955, gunMetal);
    // a LUNETA: tubo principal + objetiva + ocular + lente teal
    const scopeTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.3, 12),
      gunMetal
    );
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.115, -0.08);
    snipParts.add(scopeTube);
    const scopeObj = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.033, 0.07, 12),
      gunMetal
    );
    scopeObj.rotation.x = Math.PI / 2;
    scopeObj.position.set(0, 0.115, -0.26);
    snipParts.add(scopeObj);
    const scopeEye = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.03, 0.06, 12),
      gunMetal
    );
    scopeEye.rotation.x = Math.PI / 2;
    scopeEye.position.set(0, 0.115, 0.08);
    snipParts.add(scopeEye);
    box(snipParts, 0.011, 0.011, 0.011, 0, 0.115, -0.295, dot);
    // torres de ajuste da luneta
    box(snipParts, 0.02, 0.045, 0.02, 0, 0.148, -0.08, gunMetal);
    box(snipParts, 0.045, 0.02, 0.02, 0, 0.122, -0.08, gunMetal);
    // pente caja + punho + coronha esculpida (a “cama” do calibre)
    box(snipParts, 0.052, 0.14, 0.09, 0, -0.12, -0.06, gunMetal, 0.1);
    box(snipParts, 0.052, 0.14, 0.06, 0, -0.12, 0.14, polymer, -0.3);
    box(snipParts, 0.062, 0.1, 0.3, 0, -0.028, 0.32, polymer);
    box(snipParts, 0.075, 0.115, 0.032, 0, -0.045, 0.47, polymer);
    // bochecha da coronha + porta de ejeção
    box(snipParts, 0.066, 0.045, 0.16, 0, 0.035, 0.3, polymer);
    box(snipParts, 0.02, 0.04, 0.11, 0.047, 0.012, -0.02, accent);
    // bipé dobrado sob o cano
    box(snipParts, 0.012, 0.012, 0.16, 0.024, -0.012, -0.72, accent, 0.5);
    box(snipParts, 0.012, 0.012, 0.16, -0.024, -0.012, -0.72, accent, 0.5);
    snipParts.build();
    // ferreirinho: alavanca MÓVEL na lateral direita do receiver
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0x9aa6b2,
      roughness: 0.35,
      metalness: 0.5,
    });
    const boltShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.085, 8),
      boltMat
    );
    boltShaft.rotation.z = Math.PI / 2; // ao longo do X (pra fora da arma)
    boltShaft.position.set(0.06, 0.02, 0.03);
    const boltKnob = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 10, 8),
      boltMat
    );
    boltKnob.position.set(0.105, 0.02, 0.03);
    this.boltLever.add(boltShaft, boltKnob);
    this.sniper.add(this.boltLever);
    this.muzzleSniper.position.set(0, 0.014, -0.99);
    this.sniper.add(this.muzzleSniper);

    this.rifle.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    this.pistol.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    this.shotgun.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    this.smg.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    this.sniper.traverse((o) => {
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
    this.shotgun.visible = false;
    this.smg.visible = false;
    this.sniper.visible = false;
    this.root.add(this.rifle, this.pistol, this.shotgun, this.smg, this.sniper);
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
    this.shotgun.visible = id === 'GLISSANDO';
    this.smg.visible = id === 'TREMOLANDO';
    this.sniper.visible = id === 'FERMATA';
    this.recoil = 0.55; // "sacudida" de troca
    this.flashT = 0;
    this.pumpT = 0; // trocou de arma: corredera em repouso
    this.boltT = 0; // ...e ferrolho fechado
  }

  /** Chamado a cada tiro: recuo + clarão + cápsula ejetada (+ corredera/ferrolho). */
  onFire() {
    this.recoil = Math.min(
      1,
      this.recoil +
        (this.cur === 'GLISSANDO'
          ? 0.95
          : this.cur === 'FERMATA'
            ? 1.0
            : this.cur === 'TREMOLANDO'
              ? 0.34
              : 0.55)
    );
    this.flashT = 0.05;
    this.flash.rotation.z = Math.random() * Math.PI;
    const s = 1.0 + Math.random() * 0.6;
    this.flash.scale.setScalar(
      this.cur === 'LEGATO'
        ? s
        : this.cur === 'GLISSANDO'
          ? s * 1.4
          : this.cur === 'FERMATA'
            ? s * 1.6
            : this.cur === 'TREMOLANDO'
              ? s * 0.7
              : s * 0.75
    );
    if (this.cur === 'GLISSANDO') this.pumpT = 0.44; // bombeia depois do tiro
    if (this.cur === 'FERMATA') this.boltT = 0.5; // ciclo do ferrolho
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
    const m = this.muzzleOf();
    return m.getWorldPosition(out);
  }

  private muzzleOf(): THREE.Object3D {
    switch (this.cur) {
      case 'LEGATO':
        return this.muzzleRifle;
      case 'GLISSANDO':
        return this.muzzleShotgun;
      case 'TREMOLANDO':
        return this.muzzleSmg;
      case 'FERMATA':
        return this.muzzleSniper;
      default:
        return this.muzzlePistol;
    }
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

    // corredera da GLISSANDO: puxa p/ trás (40% do tempo) e retorna (60%)
    if (this.pumpT > 0) {
      this.pumpT = Math.max(0, this.pumpT - dt);
      const p = 1 - this.pumpT / 0.44; // 0..1 do ciclo
      const k =
        p < 0.4
          ? Math.sin((p / 0.4) * (Math.PI / 2)) // acelera p/ trás
          : 1 - (p - 0.4) / 0.6; // desliza de volta
      this.pumpHand.position.z = -0.5 + k * 0.085;
    } else {
      this.pumpHand.position.z = -0.5;
    }

    // ferreirinho da FERMATA (Etapa 24): a alavanca gira p/ cima (25%),
    // puxa o ferrolho p/ trás (até 55%) e fecha — 0,5 s de ciclo
    if (this.boltT > 0) {
      this.boltT = Math.max(0, this.boltT - dt);
      const p = 1 - this.boltT / 0.5; // 0..1 do ciclo
      const lift = p < 0.25 ? Math.sin((p / 0.25) * (Math.PI / 2)) : 1;
      const pull = p < 0.25 ? 0 : p < 0.55 ? (p - 0.25) / 0.3 : 1 - (p - 0.55) / 0.45;
      this.boltLever.rotation.z = -lift * 1.1; // sobe a alavanca
      this.boltLever.position.z = pull * 0.075; // puxa o corpo p/ trás
    } else {
      this.boltLever.rotation.z = 0;
      this.boltLever.position.z = 0;
    }

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

    // Etapa 24: luneta aberta = ótica no olho, arma fora do quadro —
    // o retículo da HUD é a mira de verdade
    this.root.visible = st.alive && !st.scoped;
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
    const m = this.muzzleOf();
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
