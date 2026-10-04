import * as THREE from 'three';

export const paint = (color: string, map?: THREE.Texture) =>
  new THREE.MeshBasicMaterial({ color, map, toneMapped: false, fog: false });

export function box(parent: THREE.Object3D, name: string, size: [number, number, number],
  at: [number, number, number], material: THREE.Material | THREE.Material[]): THREE.Mesh {
  const object = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  object.name = name;
  object.position.set(...at);
  parent.add(object);
  return object;
}

export function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('商店街の素材を描画できません');
  draw(ctx);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

/** Painted slate strokes and staggered seams, used on the actual pitched roofs. */
export function roofTexture(): THREE.Texture {
  const map = canvasTexture(256, 256, ctx => {
    ctx.fillStyle = '#414e59'; ctx.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) for (let column = -1; column < 9; column++) {
      const x = column * 32 + (row % 2) * 16, y = row * 32;
      const shade = 72 + Math.round(Math.sin(row * 7.3 + column * 3.1) * 9);
      ctx.fillStyle = `rgb(${shade},${shade + 13},${shade + 23})`;
      ctx.fillRect(x + 1, y + 1, 30, 30);
      ctx.fillStyle = '#81909b'; ctx.globalAlpha = 0.3;
      ctx.fillRect(x + 2, y + 2, 29, 2);
      ctx.globalAlpha = 1;
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);
  return map;
}

export function timberTexture(): THREE.Texture {
  const map = canvasTexture(256, 128, ctx => {
    ctx.fillStyle = '#a77b49'; ctx.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 100; i++) {
      ctx.strokeStyle = i % 3 ? 'rgba(71,42,24,0.18)' : 'rgba(238,205,147,0.24)';
      const y = (i * 37) % 128;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.032 + i) * 2);
      ctx.stroke();
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}
