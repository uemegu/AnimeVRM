import * as THREE from 'three';
import { box, canvasTexture, paint } from '../shopping-street/materials';

export { box, canvasTexture, paint };

export type ShrineMaterials = {
  copper: THREE.Material; kawara: THREE.Material; gable: THREE.Material;
  wood: THREE.Material; darkWood: THREE.Material; plaster: THREE.Material;
  stone: THREE.Material; gold: THREE.Material; rope: THREE.Material; shide: THREE.Material;
  bamboo: THREE.Material; water: THREE.Material; ema: THREE.Material;
};

/**
 * Convex planar polygon. UVs are world-sized (one repeat per `tile` metres) along the horizontal
 * tangent and the slope, so roof seams run downhill on every face.
 */
export function polygon(parent: THREE.Object3D, name: string, points: Array<[number, number, number]>,
  material: THREE.Material, tile = 2, uvs?: Array<[number, number]>): THREE.Mesh {
  const p = points.map(v => new THREE.Vector3(...v));
  const normal = new THREE.Vector3().crossVectors(p[1].clone().sub(p[0]), p[2].clone().sub(p[0])).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const u = Math.abs(normal.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3().crossVectors(up, normal).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u);
  const position: number[] = [], uv: number[] = [];
  for (let i = 1; i < p.length - 1; i++) for (const k of [0, i, i + 1]) {
    position.push(p[k].x, p[k].y, p[k].z);
    if (uvs) uv.push(...uvs[k]); else uv.push(p[k].dot(u) / tile, p[k].dot(v) / tile);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material); mesh.name = name; parent.add(mesh);
  return mesh;
}

/** A beam between two points (used for bargeboards, rafters and diagonal braces). */
export function beam(parent: THREE.Object3D, name: string, from: [number, number, number], to: [number, number, number],
  width: number, height: number, material: THREE.Material): THREE.Mesh {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, a.distanceTo(b)), material);
  mesh.name = name; parent.add(mesh); mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize());
  return mesh;
}

export function cylinder(parent: THREE.Object3D, name: string, top: number, bottom: number, height: number,
  at: [number, number, number], material: THREE.Material, segments = 12): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), material);
  mesh.name = name; mesh.position.set(...at); parent.add(mesh); return mesh;
}

/** A sagging straw rope with zigzag paper streamers (shimenawa and shide). */
export function shimenawa(parent: THREE.Object3D, m: ShrineMaterials, from: [number, number, number], to: [number, number, number],
  sag: number, thickness: number, streamers: number, streamerLength = 0.5): void {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const point = (t: number) => a.clone().lerp(b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0));
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => point(i / 8)));
  const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, thickness, 8, false), m.rope);
  rope.name = 'Shimenawa straw rope'; parent.add(rope);
  const direction = b.clone().sub(a); direction.y = 0;
  const yaw = Math.atan2(direction.x, direction.z) - Math.PI / 2;
  for (let i = 0; i < streamers; i++) {
    const at = point((i + 0.5) / streamers);
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(streamerLength * 0.42, streamerLength), m.shide);
    paper.name = 'Shide paper streamer'; paper.position.set(at.x, at.y - thickness - streamerLength / 2, at.z);
    paper.rotation.y = yaw; parent.add(paper);
  }
}

export function ropeTexture(): THREE.Texture {
  const map = canvasTexture(128, 64, ctx => {
    ctx.fillStyle = '#c9ad6e'; ctx.fillRect(0, 0, 128, 64);
    for (let x = -64; x < 192; x += 10) {
      ctx.strokeStyle = 'rgba(112,82,38,0.55)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 64); ctx.stroke();
      ctx.strokeStyle = 'rgba(245,226,170,0.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 4, 0); ctx.lineTo(x + 44, 64); ctx.stroke();
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(12, 1);
  return map;
}

/** Zigzag cut white paper on a transparent card. */
export function shideTexture(): THREE.Texture {
  return canvasTexture(64, 160, ctx => {
    ctx.fillStyle = '#fbfaf4'; ctx.strokeStyle = '#c9c6bb'; ctx.lineWidth = 2;
    const steps = [[18, 0], [46, 0], [46, 36], [60, 36], [60, 74], [32, 74], [32, 112], [46, 112], [46, 160], [8, 160], [8, 124], [20, 124], [20, 86], [4, 86], [4, 46], [18, 46]];
    ctx.beginPath(); steps.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); ctx.stroke();
  });
}

export function waterTexture(): THREE.Texture {
  return canvasTexture(256, 128, ctx => {
    const g = ctx.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#5f8d94'); g.addColorStop(1, '#2f5560');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(220,245,240,${0.12 + (i % 5) * 0.04})`; ctx.lineWidth = 1.5;
      const x = (i * 53) % 256, y = (i * 29) % 128;
      ctx.beginPath(); ctx.ellipse(x, y, 14 + i % 9, 3, 0, 0, Math.PI * 2); ctx.stroke();
    }
  });
}

/** Rescale box/cylinder UVs to world size (one repeat per `tile` metres) so tiled stone and timber never stretch. */
export function worldUvs(root: THREE.Object3D, materials: Set<THREE.Material>, tile: number): void {
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material) || !materials.has(o.material)) return;
    const uv = o.geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
    if (!uv) return;
    if (o.geometry instanceof THREE.BoxGeometry) {
      const { width: x, height: y, depth: z } = o.geometry.parameters;
      const faces: Array<[number, number]> = [[z, y], [z, y], [x, z], [x, z], [x, y], [x, y]];
      for (const group of o.geometry.groups) {
        const [su, sv] = faces[group.materialIndex ?? 0];
        const index = o.geometry.index!;
        const seen = new Set<number>();
        for (let i = group.start; i < group.start + group.count; i++) {
          const v = index.getX(i); if (seen.has(v)) continue; seen.add(v);
          uv.setXY(v, uv.getX(v) * su / tile, uv.getY(v) * sv / tile);
        }
      }
      uv.needsUpdate = true;
    } else if (o.geometry instanceof THREE.CylinderGeometry) {
      const { radiusTop, radiusBottom, height } = o.geometry.parameters;
      const around = Math.PI * (radiusTop + radiusBottom);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * around / tile, uv.getY(i) * height / tile);
      uv.needsUpdate = true;
    }
  });
}
