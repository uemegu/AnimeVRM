import * as THREE from 'three';
import type { WindConfig } from '../Config';

interface ParticleData {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  rotSpeedX: number;
  rotSpeedY: number;
  rotSpeedZ: number;
  flutterPhase: number;
  flutterFreq: number;
  flutterAmp: number;
}

/**
 * Creates a delicate curved 3D petal / leaf geometry.
 */
function createPetalGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();

  // 3D curved teardrop petal shape (curved slightly like a real petal)
  // Dimensions around 0.02m x 0.035m (2cm x 3.5cm) before instance scaling
  const vertices: number[] = [
    // 0: Base / Stem
    0, -0.018, 0.001,
    // 1: Lower left
    -0.009, -0.006, 0.0025,
    // 2: Mid left (widest)
    -0.014, 0.009, 0.004,
    // 3: Upper left
    -0.008, 0.022, 0.002,
    // 4: Tip (pointed)
    0, 0.028, 0.0005,
    // 5: Upper right
    0.008, 0.022, 0.002,
    // 6: Mid right (widest)
    0.014, 0.009, 0.004,
    // 7: Lower right
    0.009, -0.006, 0.0025,
    // 8: Center crease (concave curve)
    0, 0.006, -0.002,
  ];

  const indices = [
    0, 1, 8,
    1, 2, 8,
    2, 3, 8,
    3, 4, 8,
    4, 5, 8,
    5, 6, 8,
    6, 7, 8,
    7, 0, 8,
  ];

  geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

export class WindParticles {
  public group: THREE.Group;
  private petalMesh: THREE.InstancedMesh | null = null;
  private sparkleMesh: THREE.InstancedMesh | null = null;
  private petalMaterial: THREE.MeshBasicMaterial;
  private sparkleMaterial: THREE.MeshBasicMaterial;

  private particles: ParticleData[] = [];
  private dummy: THREE.Object3D = new THREE.Object3D();
  private count: number = 160;

  private readonly boxSize = {
    x: 4.5,
    y: 3.2,
    z: 4.5,
  };
  private readonly boxCenter = {
    x: 0,
    y: 1.3,
    z: 0,
  };

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'WindParticlesGroup';

    // Petal material (Double-sided for tumbling petals, delicate translucency)
    this.petalMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffe4eb'),
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Sparkle / Spore material for small floating glowing motes
    this.sparkleMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.rebuild(160);
    scene.add(this.group);
  }

  /**
   * Rebuild meshes if count changes
   */
  public rebuild(count: number): void {
    if (this.petalMesh) {
      this.group.remove(this.petalMesh);
      this.petalMesh.geometry.dispose();
      this.petalMesh = null;
    }
    if (this.sparkleMesh) {
      this.group.remove(this.sparkleMesh);
      this.sparkleMesh.geometry.dispose();
      this.sparkleMesh = null;
    }

    this.count = Math.max(10, Math.min(600, count));
    const petalCount = Math.floor(this.count * 0.8);
    const sparkleCount = this.count - petalCount;

    // Petal geometry (delicate curved 3D petal)
    const petalGeo = createPetalGeometry();
    this.petalMesh = new THREE.InstancedMesh(petalGeo, this.petalMaterial, petalCount);
    this.petalMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.petalMesh);

    // Sparkle geometry (tiny soft particle)
    const sparkleGeo = new THREE.SphereGeometry(0.008, 4, 4);
    this.sparkleMesh = new THREE.InstancedMesh(sparkleGeo, this.sparkleMaterial, sparkleCount);
    this.sparkleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.sparkleMesh);

    // Initialize particle data
    this.particles = [];
    for (let i = 0; i < this.count; i++) {
      this.particles.push(this.createParticle(true));
    }
  }

  private createParticle(randomizeLife = false): ParticleData {
    const minX = this.boxCenter.x - this.boxSize.x * 0.5;
    const maxX = this.boxCenter.x + this.boxSize.x * 0.5;
    const minY = this.boxCenter.y - this.boxSize.y * 0.5;
    const maxY = this.boxCenter.y + this.boxSize.y * 0.5;
    const minZ = this.boxCenter.z - this.boxSize.z * 0.5;
    const maxZ = this.boxCenter.z + this.boxSize.z * 0.5;

    const maxLife = 2.0 + Math.random() * 2.5;
    const life = randomizeLife ? Math.random() * maxLife : 0;

    return {
      position: new THREE.Vector3(
        minX + Math.random() * (maxX - minX),
        minY + Math.random() * (maxY - minY),
        minZ + Math.random() * (maxZ - minZ)
      ),
      velocity: new THREE.Vector3(),
      life,
      maxLife,
      scale: 0.5 + Math.random() * 0.7, // Random variation per petal
      rotX: Math.random() * Math.PI * 2,
      rotY: Math.random() * Math.PI * 2,
      rotZ: Math.random() * Math.PI * 2,
      rotSpeedX: (Math.random() - 0.5) * 4.0,
      rotSpeedY: (Math.random() - 0.5) * 5.0,
      rotSpeedZ: (Math.random() - 0.5) * 3.5,
      flutterPhase: Math.random() * Math.PI * 2,
      flutterFreq: 2.0 + Math.random() * 3.0,
      flutterAmp: 0.12 + Math.random() * 0.18,
    };
  }

  /**
   * Reset a particle to windward boundary
   */
  private respawnWindward(p: ParticleData, windDir: THREE.Vector3): void {
    p.life = 0;
    p.maxLife = 2.0 + Math.random() * 2.5;
    p.scale = 0.5 + Math.random() * 0.7;

    p.rotX = Math.random() * Math.PI * 2;
    p.rotY = Math.random() * Math.PI * 2;
    p.rotZ = Math.random() * Math.PI * 2;
    p.rotSpeedX = (Math.random() - 0.5) * 4.0;
    p.rotSpeedY = (Math.random() - 0.5) * 5.0;
    p.rotSpeedZ = (Math.random() - 0.5) * 3.5;

    // Determine spawn position on the boundary facing towards incoming wind
    const halfX = this.boxSize.x * 0.5;
    const halfY = this.boxSize.y * 0.5;
    const halfZ = this.boxSize.z * 0.5;

    p.position.set(
      this.boxCenter.x + (Math.random() - 0.5) * this.boxSize.x - windDir.x * halfX * 0.85,
      this.boxCenter.y + (Math.random() - 0.5) * this.boxSize.y - windDir.y * halfY * 0.85,
      this.boxCenter.z + (Math.random() - 0.5) * this.boxSize.z - windDir.z * halfZ * 0.85
    );
  }

  /**
   * Update particle positions and matrix transforms
   */
  public update(delta: number, elapsed: number, config: WindConfig, windVector: THREE.Vector3): void {
    const isEnabled = config.enabled && config.particles.enabled && windVector.lengthSq() > 0.0001;

    this.group.visible = isEnabled;
    if (!isEnabled) return;

    // Check count rebuild
    if (config.particles.count !== this.count) {
      this.rebuild(config.particles.count);
    }

    // Update material colors & opacity
    this.petalMaterial.color.set(config.particles.color);
    this.petalMaterial.opacity = config.particles.opacity * 0.9;

    this.sparkleMaterial.color.set(config.particles.color);
    this.sparkleMaterial.opacity = config.particles.opacity * 0.75;

    const windSpeed = windVector.length();
    const normalizedWind = windSpeed > 0.001 ? windVector.clone().normalize() : new THREE.Vector3(1, 0, 0);
    const speedFactor = config.particles.speedFactor * 1.2;
    const baseSize = config.particles.size;

    const petalCount = Math.floor(this.count * 0.8);

    const halfX = this.boxSize.x * 0.5;
    const halfY = this.boxSize.y * 0.5;
    const halfZ = this.boxSize.z * 0.5;

    // Cross vector for horizontal flutter relative to wind
    const upVector = new THREE.Vector3(0, 1, 0);
    const windCross = new THREE.Vector3().crossVectors(normalizedWind, upVector).normalize();
    if (windCross.lengthSq() < 0.01) {
      windCross.set(1, 0, 0);
    }

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life += delta;

      if (p.life >= p.maxLife) {
        this.respawnWindward(p, normalizedWind);
      }

      // Fluttering (side-to-side sway and gentle falling/rising drift)
      const flutterTime = elapsed * p.flutterFreq + p.flutterPhase;
      const swayLateral = Math.sin(flutterTime) * p.flutterAmp;
      const swayVertical = Math.cos(flutterTime * 1.3) * (p.flutterAmp * 0.6) - 0.04; // Slight downward gravitational fall

      p.velocity.copy(windVector)
        .multiplyScalar(speedFactor)
        .addScaledVector(windCross, swayLateral)
        .add(new THREE.Vector3(0, swayVertical, 0));

      p.position.addScaledVector(p.velocity, delta);

      // Boundary check
      if (
        Math.abs(p.position.x - this.boxCenter.x) > halfX ||
        Math.abs(p.position.y - this.boxCenter.y) > halfY ||
        Math.abs(p.position.z - this.boxCenter.z) > halfZ
      ) {
        this.respawnWindward(p, normalizedWind);
      }

      // Life curve (smooth fade in, hold, fade out)
      const progress = p.life / p.maxLife;
      let alpha = 1.0;
      if (progress < 0.15) {
        alpha = progress / 0.15;
      } else if (progress > 0.75) {
        alpha = (1.0 - progress) / 0.25;
      }
      alpha = Math.max(0, Math.min(1, alpha));

      // Delicate scale: baseSize (~0.035) * p.scale * alpha * 1.2
      const particleScale = p.scale * (baseSize * 25.0) * alpha * 0.45;

      this.dummy.position.copy(p.position);

      if (i < petalCount) {
        // Tumbling rotation around multiple axes as the petal flutters in the air
        const speedBoost = 1.0 + windSpeed * 0.8;
        p.rotX += p.rotSpeedX * speedBoost * delta;
        p.rotY += p.rotSpeedY * speedBoost * delta;
        p.rotZ += p.rotSpeedZ * speedBoost * delta;

        this.dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
        this.dummy.scale.set(particleScale, particleScale, particleScale);
        this.dummy.updateMatrix();

        if (this.petalMesh) {
          this.petalMesh.setMatrixAt(i, this.dummy.matrix);
        }
      } else {
        // Sparkle / glowing specks (small round motes drifting)
        const sparkleIndex = i - petalCount;
        this.dummy.rotation.set(0, 0, 0);
        const sparkleScale = particleScale * 0.6;
        this.dummy.scale.set(sparkleScale, sparkleScale, sparkleScale);
        this.dummy.updateMatrix();

        if (this.sparkleMesh) {
          this.sparkleMesh.setMatrixAt(sparkleIndex, this.dummy.matrix);
        }
      }
    }

    if (this.petalMesh) {
      this.petalMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.sparkleMesh) {
      this.sparkleMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    if (this.petalMesh) {
      this.group.remove(this.petalMesh);
      this.petalMesh.geometry.dispose();
    }
    if (this.sparkleMesh) {
      this.group.remove(this.sparkleMesh);
      this.sparkleMesh.geometry.dispose();
    }
    this.petalMaterial.dispose();
    this.sparkleMaterial.dispose();
  }
}
