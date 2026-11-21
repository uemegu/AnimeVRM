import * as THREE from 'three';

/** 大型送風機。正面はローカル +Z、回転するのはガードの内側の羽根だけ。 */
export function createFan() {
  const frame = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x29434b, roughness: 0.5 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xe3a438, roughness: 0.42 });
  const blade = new THREE.MeshStandardMaterial({ color: 0x82b2ac, side: THREE.DoubleSide, roughness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x202c30 });
  const rotor = new THREE.Group();
  const head = new THREE.Group();
  head.position.y = 1.05;
  frame.add(head);
  head.add(rotor);

  const mesh = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const radius = 0.72;
  const drum = mesh(head, new THREE.CylinderGeometry(radius, radius, 0.36, 48, 1, true), metal, 0, 0, 0);
  drum.rotation.x = Math.PI / 2;
  for (const z of [-0.18, 0.18]) {
    mesh(head, new THREE.TorusGeometry(radius, 0.028, 8, 48), rim, 0, 0, z);
  }
  // 同心円と放射状のスポークをひとつの線メッシュにまとめる。
  const wire: number[] = [];
  for (const z of [-0.18, 0.18]) {
    for (let ring = 1; ring <= 5; ring++) {
      const r = radius * ring / 6;
      for (let i = 0; i < 48; i++) {
        const a = i * Math.PI / 24, b = (i + 1) * Math.PI / 24;
        wire.push(r * Math.cos(a), r * Math.sin(a), z, r * Math.cos(b), r * Math.sin(b), z);
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      wire.push(0, 0, z, radius * Math.cos(a), radius * Math.sin(a), z);
    }
  }
  const grille = new THREE.BufferGeometry();
  grille.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  head.add(new THREE.LineSegments(grille, new THREE.LineBasicMaterial({ color: 0x526366 })));
  const shape = new THREE.Shape();
  shape.moveTo(0.06, 0);
  shape.quadraticCurveTo(0.25, -0.17, 0.61, -0.12);
  shape.quadraticCurveTo(0.71, 0.02, 0.61, 0.22);
  shape.quadraticCurveTo(0.32, 0.09, 0.08, 0.11);
  shape.closePath();
  const fin = new THREE.ShapeGeometry(shape);
  for (let i = 0; i < 5; i++) mesh(rotor, fin, blade, 0, 0, 0).rotation.z = i * Math.PI * 2 / 5;
  mesh(rotor, new THREE.SphereGeometry(0.14, 20, 12), rim, 0, 0, 0.06);
  for (const x of [-0.76, 0.76]) {
    mesh(frame, new THREE.BoxGeometry(0.055, 0.95, 0.065), metal, x, 0.59, 0);
    mesh(frame, new THREE.BoxGeometry(0.09, 0.08, 0.76), metal, x, 0.13, 0);
    for (const z of [-0.29, 0.29]) mesh(frame, new THREE.SphereGeometry(0.09, 12, 8), dark, x, 0.09, z);
  }
  mesh(frame, new THREE.BoxGeometry(1.55, 0.07, 0.08), metal, 0, 0.16, 0);
  return { frame, rotor };
}
