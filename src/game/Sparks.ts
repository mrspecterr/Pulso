// Faíscas de impacto — UM único THREE.Points com shader próprio (Etapa 10).
//
// Antes: 56 meshes individuais com 56 materiais (opacidade por partícula
// exigia material próprio) = até 56 draw calls por rajada. Agora: UM draw
// call — cor e tamanho por vértice, brilho aditivo, e o "billboard" é
// gratuito (points são desenhados virados para a tela).

import * as THREE from 'three';

const VERT = `
attribute float aSize;
attribute vec3 aColor;
varying vec3 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (170.0 / max(0.1, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
precision mediump float;
varying vec3 vColor;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float a = 1.0 - r;
  gl_FragColor = vec4(vColor, a * a);
}`;

interface Particle {
  vel: THREE.Vector3;
  life: number;
  ttl: number;
  size: number;
  color: THREE.Color;
}

export class Sparks {
  private points: THREE.Points;
  private posAttr: THREE.BufferAttribute;
  private colAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;
  private parts: Particle[] = [];
  private cursor = 0;
  private count: number;

  constructor(scene: THREE.Scene, count = 56) {
    this.count = count;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    this.posAttr = new THREE.BufferAttribute(positions, 3);
    this.colAttr = new THREE.BufferAttribute(colors, 3);
    this.sizeAttr = new THREE.BufferAttribute(sizes, 1);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aColor', this.colAttr);
    geo.setAttribute('aSize', this.sizeAttr);

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 50;
    scene.add(this.points);

    for (let i = 0; i < count; i++) {
      this.parts.push({
        vel: new THREE.Vector3(),
        life: 0,
        ttl: 1,
        size: 0.05,
        color: new THREE.Color(0xffffff),
      });
      sizes[i] = 0; // todas nascem apagadas
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
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const p = this.parts[this.cursor];
      const i3 = this.cursor * 3;
      this.cursor = (this.cursor + 1) % this.parts.length;
      this.posAttr.setXYZ(i3 / 3, pos.x, pos.y, pos.z);
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
      p.color.copy(c);
    }
  }

  update(dt: number, _camera: THREE.Camera) {
    const pos = this.posAttr.array as Float32Array;
    const col = this.colAttr.array as Float32Array;
    const sz = this.sizeAttr.array as Float32Array;
    let anyAlive = false;

    for (let i = 0; i < this.count; i++) {
      const p = this.parts[i];
      if (p.life <= 0) {
        sz[i] = 0;
        continue;
      }
      anyAlive = true;
      p.life -= dt;
      const k = Math.max(0, p.life / p.ttl);
      p.vel.y -= 7.5 * dt;
      const i3 = i * 3;
      pos[i3] += p.vel.x * dt;
      pos[i3 + 1] += p.vel.y * dt;
      pos[i3 + 2] += p.vel.z * dt;
      // aditivo: escurecer = sumir (fade barato, sem alpha por partícula)
      col[i3] = p.color.r * k;
      col[i3 + 1] = p.color.g * k;
      col[i3 + 2] = p.color.b * k;
      sz[i] = p.size * (0.35 + k * 0.85);
    }

    this.points.visible = anyAlive;
    if (anyAlive) {
      this.posAttr.needsUpdate = true;
      this.colAttr.needsUpdate = true;
      this.sizeAttr.needsUpdate = true;
    }
  }
}
