import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createPaintedClassroom, disposePaintedClassroom } from './PaintedClassroom';

/** All surfaces use the embedded original painting, with portable glTF UVs. */
export async function exportPaintedClassroom(): Promise<ArrayBuffer> {
  const room = await createPaintedClassroom();
  try {
    return await new GLTFExporter().parseAsync(room, { binary: true, onlyVisible: true }) as ArrayBuffer;
  } finally {
    disposePaintedClassroom(room);
  }
}
