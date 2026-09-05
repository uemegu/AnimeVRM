import * as THREE from 'three';

/**
 * Generates smooth normals and curvature attributes for a given BufferGeometry.
 * Groups coincident vertices within a spatial tolerance (1e-4) and averages their normals.
 * Stores original normal in 'origNormal' and smooth normal in 'smoothNormal'.
 */
export function computeSmoothNormalsAndCurvature(geometry: THREE.BufferGeometry): void {
  const positionAttr = geometry.getAttribute('position');
  const normalAttr = geometry.getAttribute('normal');

  if (!positionAttr || !normalAttr) return;

  // Preserve original normal attribute if not already preserved
  if (!geometry.getAttribute('origNormal')) {
    geometry.setAttribute('origNormal', normalAttr.clone());
  }

  const vertexCount = positionAttr.count;
  const smoothNormals = new Float32Array(vertexCount * 3);
  const curvatures = new Float32Array(vertexCount);

  // Use a spatial hash map with 0.0001 precision (10000 cells per unit)
  const PRECISION = 10000;
  const vertexMap = new Map<string, number[]>();

  const p = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < vertexCount; i++) {
    p.fromBufferAttribute(positionAttr, i);
    const key = `${Math.round(p.x * PRECISION)},${Math.round(p.y * PRECISION)},${Math.round(p.z * PRECISION)}`;
    
    let list = vertexMap.get(key);
    if (!list) {
      list = [];
      vertexMap.set(key, list);
    }
    list.push(i);
  }

  // Calculate average normal for each spatial cluster
  const tempNormal = new THREE.Vector3();
  const clusterAverageNormals = new Map<string, THREE.Vector3>();

  vertexMap.forEach((indices, key) => {
    tempNormal.set(0, 0, 0);
    for (const idx of indices) {
      n.fromBufferAttribute(normalAttr, idx);
      tempNormal.add(n);
    }

    if (tempNormal.lengthSq() > 1e-6) {
      tempNormal.normalize();
    } else {
      tempNormal.fromBufferAttribute(normalAttr, indices[0]);
    }

    clusterAverageNormals.set(key, tempNormal.clone());
  });

  // Assign smooth normals and estimate curvature
  for (let i = 0; i < vertexCount; i++) {
    p.fromBufferAttribute(positionAttr, i);
    n.fromBufferAttribute(normalAttr, i);
    const key = `${Math.round(p.x * PRECISION)},${Math.round(p.y * PRECISION)},${Math.round(p.z * PRECISION)}`;
    const avgNormal = clusterAverageNormals.get(key) || n;

    smoothNormals[i * 3 + 0] = avgNormal.x;
    smoothNormals[i * 3 + 1] = avgNormal.y;
    smoothNormals[i * 3 + 2] = avgNormal.z;

    const dotVal = THREE.MathUtils.clamp(n.dot(avgNormal), -1.0, 1.0);
    const curvature = THREE.MathUtils.clamp((1.0 - dotVal) * 2.0, 0.0, 1.0);
    curvatures[i] = curvature;
  }

  const smoothNormalAttr = new THREE.BufferAttribute(smoothNormals, 3);
  geometry.setAttribute('smoothNormal', smoothNormalAttr);
  geometry.setAttribute('curvature', new THREE.BufferAttribute(curvatures, 1));
}

/**
 * Traverses a VRM / scene hierarchy and computes smooth normals for all mesh geometries.
 * Runs once per model load.
 */
export function applySmoothNormalsToHierarchy(root: THREE.Object3D): void {
  const processedGeometries = new Set<THREE.BufferGeometry>();

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry && !processedGeometries.has(mesh.geometry)) {
        processedGeometries.add(mesh.geometry);
        computeSmoothNormalsAndCurvature(mesh.geometry);
      }
    }
  });
}

/**
 * Flattens normals around the eye socket / inner corner of the eyes on face skin meshes.
 * In anime-style rendering, steep normals along the eye orbit crease catch lateral light
 * and create unwanted dark shadow lines (crease shadows) near the inner eye corner.
 * Flattening these normals towards the front (+Z) prevents premature shadowing.
 */
export function flattenEyeOrbitNormals(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    if (!mesh.geometry) return;

    const isFaceMesh = /Face/i.test(mesh.name);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const hasSkinMaterial = materials.some((m) => m && /Face.*SKIN|Face|顔/i.test(m.name || ''));

    if (!isFaceMesh && !hasSkinMaterial) return;

    const geo = mesh.geometry;
    const posAttr = geo.getAttribute('position');
    const normAttr = geo.getAttribute('normal');
    if (!posAttr || !normAttr) return;

    let eyeMinY = Infinity, eyeMaxY = -Infinity;
    let eyeMinX = Infinity, eyeMaxX = -Infinity;
    let eyeMinZ = Infinity, eyeMaxZ = -Infinity;
    let eyeCount = 0;

    if (geo.groups && geo.groups.length > 0) {
      for (const group of geo.groups) {
        const mat = materials[group.materialIndex ?? 0];
        if (mat && /EyeWhite|EyeIris|Eye/i.test(mat.name || '') && !/Eyeline|Eyelash/i.test(mat.name || '')) {
          const indexAttr = geo.index;
          const start = group.start;
          const end = start + group.count;
          for (let i = start; i < end; i++) {
            const idx = indexAttr ? indexAttr.getX(i) : i;
            const x = posAttr.getX(idx);
            const y = posAttr.getY(idx);
            const z = posAttr.getZ(idx);
            eyeMinX = Math.min(eyeMinX, Math.abs(x));
            eyeMaxX = Math.max(eyeMaxX, Math.abs(x));
            eyeMinY = Math.min(eyeMinY, y);
            eyeMaxY = Math.max(eyeMaxY, y);
            eyeMinZ = Math.min(eyeMinZ, z);
            eyeMaxZ = Math.max(eyeMaxZ, z);
            eyeCount++;
          }
        }
      }
    }

    if (eyeCount === 0) {
      eyeMinX = 0.015;
      eyeMaxX = 0.060;
      eyeMinY = 1.415;
      eyeMaxY = 1.465;
      eyeMinZ = 0.035;
      eyeMaxZ = 0.065;
    } else {
      eyeMinX = Math.max(0.010, eyeMinX - 0.006);
      eyeMaxX = eyeMaxX + 0.008;
      eyeMinY = eyeMinY - 0.008;
      eyeMaxY = eyeMaxY + 0.008;
    }

    const count = posAttr.count;
    let modified = false;

    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i);
      const absX = Math.abs(x);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);

      if (absX >= eyeMinX && absX <= eyeMaxX && y >= eyeMinY && y <= eyeMaxY && z >= eyeMinZ - 0.01) {
        let nx = normAttr.getX(i);
        let ny = normAttr.getY(i);
        let nz = normAttr.getZ(i);

        // Proximity to inner corner (where absX is closest to eyeMinX)
        const innerFactor = Math.max(0, 1.0 - (absX - eyeMinX) / (eyeMaxX - eyeMinX));
        const blend = 0.55 + 0.4 * innerFactor; // 55% to 95% front-facing
        nx = nx * (1 - blend);
        ny = ny * (1 - blend);
        nz = nz * (1 - blend) + blend * 1.0;

        const len = Math.hypot(nx, ny, nz);
        if (len > 1e-5) {
          normAttr.setXYZ(i, nx / len, ny / len, nz / len);
          modified = true;
        }
      }
    }

    if (modified) {
      normAttr.needsUpdate = true;
    }
  });
}

/**
 * Toggles between smooth normals and original normals in-place across all meshes in the scene.
 */
export function toggleSmoothNormalsInHierarchy(root: THREE.Object3D, useSmooth: boolean): void {
  const processedGeometries = new Set<THREE.BufferGeometry>();

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      const geo = mesh.geometry;
      if (geo && !processedGeometries.has(geo)) {
        processedGeometries.add(geo);
        const smoothNormal = geo.getAttribute('smoothNormal');
        const origNormal = geo.getAttribute('origNormal');
        if (smoothNormal && origNormal) {
          geo.setAttribute('normal', useSmooth ? smoothNormal : origNormal);
          geo.attributes.normal.needsUpdate = true;
        }
      }
    }
  });
}
