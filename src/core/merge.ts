// Merge de geometrias (Etapa 10 — desempenho).
//
// No React Native + expo-gl, CADA draw call é uma cadeia de chamadas
// JavaScript→OpenGL na thread do app. Um cenário com ~170 meshes estáticos
// paga esse preço duas vezes: na passada da câmera e na da sombra.
// Fundindo as malhas estáticas que dividem material (e flags de sombra) numa
// única BufferGeometry, o cenário inteiro cai para ~25 draw calls.
//
// Como funciona: cada mesh candidato já tem posição/rotação final; aplicamos
// a matriz de mundo dele numa cópia da geometria e concatenamos os atributos
// (position/normal/uv) com os índices reoffsetados. WebGL1-safe: nada além
// de BufferGeometry padrão (índice Uint16 quando cabe).

import * as THREE from 'three';

/** Funde as geometrias (com transform de mundo já aplicado) numa só. */
export function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  if (geos.length === 0) return out;

  let vTotal = 0;
  let iTotal = 0;
  const metas: THREE.BufferGeometry[] = [];
  for (const g of geos) {
    const a = g.attributes;
    if (!a.position || !a.normal || !a.uv) continue; // pula geometria exótica
    const vc = (a.position as THREE.BufferAttribute).count;
    vTotal += vc;
    iTotal += g.index ? g.index.count : 0;
    metas.push(g);
  }
  if (metas.length === 0) return out;

  const pos = new Float32Array(vTotal * 3);
  const nor = new Float32Array(vTotal * 3);
  const uv = new Float32Array(vTotal * 2);
  // Uint16 quando cabe (WebGL1 puro não exige OES_element_index_uint)
  const use32 = vTotal > 65535;
  const idx: Uint16Array | Uint32Array = use32
    ? new Uint32Array(iTotal)
    : new Uint16Array(iTotal);

  let vOff = 0;
  let iOff = 0;
  for (const m of metas) {
    const at = m.attributes;
    const vc = (at.position as THREE.BufferAttribute).count;
    pos.set(at.position.array as ArrayLike<number>, vOff * 3);
    nor.set(at.normal.array as ArrayLike<number>, vOff * 3);
    uv.set(at.uv.array as ArrayLike<number>, vOff * 2);
    if (m.index) {
      const src = m.index.array as ArrayLike<number>;
      for (let i = 0; i < src.length; i++) {
        idx[iOff + i] = src[i] + vOff;
      }
      iOff += src.length;
    } else {
      // sem índice: gera sequência direta
      for (let i = 0; i < vc; i++) idx[iOff + i] = i;
      iOff += vc;
    }
    vOff += vc;
  }

  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

interface BucketEntry {
  geo: THREE.BufferGeometry; // cópia com transform aplicado
  original: THREE.BufferGeometry; // geometria original (para descartar)
}

/**
 * Coletor de malhas estáticas por (material × flags de sombra × renderOrder).
 *
 * Cada `add` aplica a matriz de mundo do mesh numa cópia da geometria;
 * `build()` devolve UMA mesh fundida por chave. As meshes originais NUNCA
 * entram na cena — apenas o resultado do build.
 */
export class StaticBuckets {
  private buckets = new Map<string, { mat: THREE.Material; cast: boolean; recv: boolean; ro: number; list: BucketEntry[] }>();
  private sink: THREE.Object3D;

  constructor(sink: THREE.Object3D) {
    this.sink = sink;
  }

  add(mesh: THREE.Mesh) {
    mesh.updateMatrixWorld(true); // filhos da cena-raiz: matrix == matrixWorld
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    const mat = mesh.material as THREE.Material;
    const cast = mesh.castShadow;
    const recv = mesh.receiveShadow;
    const ro = mesh.renderOrder;
    const key = `${mat.uuid}|${cast ? 1 : 0}${recv ? 1 : 0}|${ro}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = { mat, cast, recv, ro, list: [] };
      this.buckets.set(key, b);
    }
    b.list.push({ geo, original: mesh.geometry });
  }

  /** Constrói uma mesh fundida por bucket e pendura cada uma na sink. */
  build(): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    this.buckets.forEach((b) => {
      const merged = mergeGeometries(b.list.map((e) => e.geo));
      const m = new THREE.Mesh(merged, b.mat);
      m.castShadow = b.cast;
      m.receiveShadow = b.recv;
      m.renderOrder = b.ro;
      this.sink.add(m);
      out.push(m);
      for (const e of b.list) {
        e.geo.dispose(); // as cópias já vivem dentro da fundida
        e.original.dispose(); // originais nunca serão usadas
      }
    });
    this.buckets.clear();
    return out;
  }
}
