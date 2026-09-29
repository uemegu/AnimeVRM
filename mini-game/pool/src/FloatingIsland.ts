import * as THREE from 'three';

/** 浮島上面の明るい黄色＆赤い斑点・相撲サークルテクスチャを動的生成 */
function createIslandTopTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const cx = 256;
  const cy = 256;
  const r = 248;

  // 1. ベースの明るい黄色（中心が明るく温かみのあるクリームイエロー）
  const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, r);
  grad.addColorStop(0, '#fef9c3');    // 明るいパステルイエロー
  grad.addColorStop(0.7, '#fef08a');  // 温かみのあるイエロー
  grad.addColorStop(1, '#fde047');    // 鮮やかなサンシャインイエロー

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 2. 外周の赤い相撲土俵ボーダーリング
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, 228, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 218, 0, Math.PI * 2);
  ctx.stroke();

  // 3. 内側の赤いサークル
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, 140, 0, Math.PI * 2);
  ctx.stroke();

  // 4. 赤い斑点（ポルカドット）模様
  // 外周と内周の間に16個の赤い斑点を等間隔に配置
  const numDotsOuter = 16;
  for (let i = 0; i < numDotsOuter; i++) {
    const angle = (i / numDotsOuter) * Math.PI * 2;
    const dotX = cx + Math.cos(angle) * 184;
    const dotY = cy + Math.sin(angle) * 184;

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(dotX, dotY, 13, 0, Math.PI * 2);
    ctx.fill();

    // 斑点の白いハイライト
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(dotX - 3, dotY - 3, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 内側にも8個の小さな赤い斑点
  const numDotsInner = 8;
  for (let i = 0; i < numDotsInner; i++) {
    const angle = ((i + 0.5) / numDotsInner) * Math.PI * 2;
    const dotX = cx + Math.cos(angle) * 95;
    const dotY = cy + Math.sin(angle) * 95;

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(dotX, dotY, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. 中央の赤いダブルリング（仕切り線）
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 42, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, Math.PI * 2);
  ctx.stroke();

  // 中心点
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export class FloatingIsland {
  public group = new THREE.Group();
  public readonly radius = 1.55; // 島の半径 (1.55m)
  public readonly height = 0.22; // 浮島の厚み

  private mesh: THREE.Mesh;
  private topMesh: THREE.Mesh;
  private borderMesh: THREE.Mesh;
  private baseCenter = new THREE.Vector3(0, 0.08, 0); // 水面より少し上

  // 物理シミュレーション用（傾き・上下揺れ）
  public tiltX = 0; // X軸回りの傾き (ラジアン)
  public tiltZ = 0; // Z軸回りの傾き (ラジアン)
  private velTiltX = 0;
  private velTiltZ = 0;

  public offsetY = 0; // 上下ボビング
  private velY = 0;

  private time = 0;

  constructor(scene: THREE.Scene) {
    // 浮島の本体（円柱側面・底面）
    const islandGeo = new THREE.CylinderGeometry(this.radius, this.radius, this.height, 48);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.05,
    });
    this.mesh = new THREE.Mesh(islandGeo, islandMat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    // 浮島上面（明るい黄色 ＆ 赤い斑点・相撲模様）
    const topGeo = new THREE.CircleGeometry(this.radius - 0.02, 48);
    const topTexture = createIslandTopTexture();
    const topMat = new THREE.MeshStandardMaterial({
      map: topTexture,
      roughness: 0.85,
      metalness: 0.0,
    });
    this.topMesh = new THREE.Mesh(topGeo, topMat);
    this.topMesh.rotation.x = -Math.PI / 2;
    this.topMesh.position.y = this.height / 2 + 0.002;
    this.topMesh.receiveShadow = true;
    this.group.add(this.topMesh);

    // 浮島の外周ボーダー（鮮やかなブルーのリングバンパー）
    const borderGeo = new THREE.TorusGeometry(this.radius, 0.045, 16, 48);
    const borderMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.15,
      metalness: 0.15,
    });
    this.borderMesh = new THREE.Mesh(borderGeo, borderMat);
    this.borderMesh.rotation.x = Math.PI / 2;
    this.borderMesh.position.y = this.height / 2;
    this.group.add(this.borderMesh);

    scene.add(this.group);
  }

  /** アバターの衝撃など外力を加える */
  public applyImpulse(impulse: THREE.Vector3, atPos: THREE.Vector3) {
    // トルク τ = r × F
    const torqueX = atPos.z * impulse.y - atPos.y * impulse.z;
    const torqueZ = atPos.x * impulse.y - atPos.y * impulse.x;

    this.velTiltX += torqueX * 0.12;
    this.velTiltZ -= torqueZ * 0.12;
    this.velY += impulse.y * 0.08;
  }

  /** 2人の位置から重心モーメントを計算し、バネ物理で傾きを更新 */
  public updatePhysics(delta: number, posAoi: THREE.Vector3, posEmili: THREE.Vector3, isAoiOn: boolean, isEmiliOn: boolean) {
    this.time += delta;

    // 1. 乗っているキャラクターの重心による目標傾き
    let targetTiltX = 0;
    let targetTiltZ = 0;
    let riders = 0;

    if (isAoiOn) {
      targetTiltX += (posAoi.z / this.radius) * 0.22;
      targetTiltZ += (-posAoi.x / this.radius) * 0.22;
      riders++;
    }
    if (isEmiliOn) {
      targetTiltX += (posEmili.z / this.radius) * 0.22;
      targetTiltZ += (-posEmili.x / this.radius) * 0.22;
      riders++;
    }

    // 2. 波による穏やかな揺らぎ
    const waveBobbing = Math.sin(this.time * 2.2) * 0.02 + Math.cos(this.time * 1.7) * 0.015;
    const waveTiltX = Math.sin(this.time * 1.5) * 0.03;
    const waveTiltZ = Math.cos(this.time * 1.8) * 0.03;

    targetTiltX += waveTiltX;
    targetTiltZ += waveTiltZ;

    // 3. バネ・ダンパー計算 (スプリング剛性 k=25, 減衰 c=5)
    const springK = 28.0;
    const dampingC = 5.5;

    const forceX = (targetTiltX - this.tiltX) * springK - this.velTiltX * dampingC;
    const forceZ = (targetTiltZ - this.tiltZ) * springK - this.velTiltZ * dampingC;

    this.velTiltX += forceX * delta;
    this.velTiltZ += forceZ * delta;

    this.tiltX += this.velTiltX * delta;
    this.tiltZ += this.velTiltZ * delta;

    // 最大傾斜の制限 (約18度)
    const maxTilt = 0.32;
    this.tiltX = THREE.MathUtils.clamp(this.tiltX, -maxTilt, maxTilt);
    this.tiltZ = THREE.MathUtils.clamp(this.tiltZ, -maxTilt, maxTilt);

    // 4. 上下ボビング
    const targetY = waveBobbing - (riders * 0.03); // 乗客の重さで少し沈む
    const forceY = (targetY - this.offsetY) * 35.0 - this.velY * 6.0;
    this.velY += forceY * delta;
    this.offsetY += this.velY * delta;

    // 5. グループのTransformを更新
    this.group.position.set(this.baseCenter.x, this.baseCenter.y + this.offsetY, this.baseCenter.z);
    this.group.rotation.set(this.tiltX, 0, this.tiltZ);
  }

  /** 島のデッキ表面上のローカル座標からワールド座標（高さ・傾き）を計算 */
  public getSurfaceHeightAt(worldX: number, worldZ: number): number {
    // 平面の方程式 z_rot, x_rot から傾斜した面の y を求める
    // y = islandY + height/2 - tiltX * z + tiltZ * x
    const baseY = this.group.position.y + this.height / 2;
    const diffZ = worldZ - this.group.position.z;
    const diffX = worldX - this.group.position.x;
    return baseY - Math.tan(this.tiltX) * diffZ + Math.tan(this.tiltZ) * diffX;
  }

  /** 島の中心からの水平距離 */
  public getDistanceFromCenter(pos: THREE.Vector3): number {
    const dx = pos.x - this.group.position.x;
    const dz = pos.z - this.group.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /** 島の外に出た（落ちた）かどうか */
  public isOutOfIsland(pos: THREE.Vector3): boolean {
    return this.getDistanceFromCenter(pos) > this.radius;
  }
}
