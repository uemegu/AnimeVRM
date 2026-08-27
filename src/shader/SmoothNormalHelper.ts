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
  
  // Apply smooth normals directly to normal attribute for clean outline hull extrusion
  geometry.setAttribute('normal', smoothNormalAttr);
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
