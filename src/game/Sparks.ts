// Faíscas de impacto — pool de quads aditivos com velocidade, gravidade e fade.
// Barato por design: geometria compartilhada, 1 material por partícula
// (necessário para opacidade individual), billboard preso à câmera.

import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vel: THREE.Vector3;
  life: number;
  ttl: number;
  size: number;
}

export class Sparks {
  private parts: Particle[] = [];
  private cursor = 0;

  constructor(scene: THREE.Scene, count = 56) {
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 50;
      scene.add(mesh);
      this.parts.push({
        mesh,
        mat,
        vel: new THREE.Vector3(),
        life: 0,
        ttl: 1,
        size: 0.05,
      });
    }
  }

  /**
   * Explosão de faíscas. `normal` (espaço mundial, ex: da face atingida)
   * orienta o cone; sem normal, esfera aleatória.
   */
  burst(
    pos: THREE.Vector3,
    normal: THREE.Vector3 | null,
    color: number,
    count = 7,
    speed = 3
  ) {
    for (let i = 0; i < count; i++) {
      const p = this.parts[this.cursor];
      this.cursor = (this.cursor + 1) % this.parts.length;
      p.mesh.position.copy(pos);
      const nx = normal ? normal.x : Math.random() * 2 - 1;
      const ny = normal ? normal.y : Math.random() * 2 - 1;
      const nz = normal ? normal.z : Math.random() * 2 - 1;
      p.vel
        .set(
          nx + (Math.random() * 2 - 1) * 1.3,
          ny + (Math.random() * 2 - 1) * 1.3,
          nz + (Math.random() * 2 - 1) * 1.3
        )
        .normalize()
        .multiplyScalar(speed * (0.35 + Math.random()));
      p.ttl = 0.14 + Math.random() * 0.22;
      p.life = p.ttl;
      p.size = 0.042 + Math.random() * 0.058;
      p.mat.color.setHex(color);
      p.mat.opacity = 1;
      p.mesh.visible = true;
    }
  }

  update(dt: number, camera: THREE.Camera) {
    for (const p of this.parts) {
      if (!p.mesh.visible) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      const k = p.life / p.ttl;
      p.vel.y -= 7.5 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.quaternion.copy(camera.quaternion);
      p.mesh.scale.setScalar(p.size * (0.35 + k * 0.85));
      p.mat.opacity = k;
    }
  }
}
