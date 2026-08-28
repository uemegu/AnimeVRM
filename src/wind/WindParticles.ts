import * as THREE from 'three';
import type { WindConfig } from '../Config';

interface ParticleData {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
  aspect: number;
  rotZ: number;
}

export class WindParticles {
  public group: THREE.Group;
  private streakMesh: THREE.InstancedMesh | null = null;
  private glowMesh: THREE.InstancedMesh | null = null;
  private streakMaterial: THREE.MeshBasicMaterial;
  private glowMaterial: THREE.MeshBasicMaterial;

  private particles: ParticleData[] = [];
  private dummy: THREE.Object3D = new THREE.Object3D();
  private count: number = 160;

  private readonly boxSize = {
    x: 4.0,
    y: 3.0,
    z: 4.0,
  };
  private readonly boxCenter = {
    x: 0,
    y: 1.3,
    z: 0,
  };

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'WindParticlesGroup';

    // Streak material (additive blending for glowing anime wind lines)
    this.streakMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#e0f7fa'),
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Glow dot material
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#bbf7d0'),
      transparent: true,
      opacity: 0.6,
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
    if (this.streakMesh) {
      this.group.remove(this.streakMesh);
      this.streakMesh.geometry.dispose();
      this.streakMesh = null;
    }
    if (this.glowMesh) {
      this.group.remove(this.glowMesh);
      this.glowMesh.geometry.dispose();
      this.glowMesh = null;
    }

    this.count = Math.max(10, Math.min(600, count));
    const streakCount = Math.floor(this.count * 0.7);
    const glowCount = this.count - streakCount;

    // Streak geometry (elongated smooth capsule/cylinder for wind streaks)
    const streakGeo = new THREE.CylinderGeometry(0.015, 0.005, 0.45, 6);
    streakGeo.rotateX(Math.PI / 2); // Orient along Z axis

    this.streakMesh = new THREE.InstancedMesh(streakGeo, this.streakMaterial, streakCount);
    this.streakMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.streakMesh);

    // Glow geometry (small diamond/sphere for floating wind motes)
    const glowGeo = new THREE.SphereGeometry(0.02, 6, 6);
    this.glowMesh = new THREE.InstancedMesh(glowGeo, this.glowMaterial, glowCount);
    this.glowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.glowMesh);

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

    const maxLife = 1.5 + Math.random() * 2.0;
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
      scale: 0.6 + Math.random() * 0.8,
      aspect: 0.8 + Math.random() * 1.5,
      rotZ: Math.random() * Math.PI * 2,
    };
  }

  /**
   * Reset a particle to windward boundary
   */
  private respawnWindward(p: ParticleData, windDir: THREE.Vector3): void {
    p.life = 0;
    p.maxLife = 1.5 + Math.random() * 2.0;
    p.scale = 0.6 + Math.random() * 0.8;

    // Determine spawn position on the boundary facing away from wind direction
    const halfX = this.boxSize.x * 0.5;
    const halfY = this.boxSize.y * 0.5;
    const halfZ = this.boxSize.z * 0.5;

    p.position.set(
      this.boxCenter.x + (Math.random() - 0.5) * this.boxSize.x - windDir.x * halfX * 0.8,
      this.boxCenter.y + (Math.random() - 0.5) * this.boxSize.y - windDir.y * halfY * 0.8,
      this.boxCenter.z + (Math.random() - 0.5) * this.boxSize.z - windDir.z * halfZ * 0.8
    );
  }

  /**
   * Update particle positions and matrix transforms
   */
  public update(delta: number, elapsed: number, config: WindConfig, windVector: THREE.Vector3): void {
    const isEnabled = config.enabled && config.particles.enabled && windVector.lengthSq() > 0.001;

    this.group.visible = isEnabled;
    if (!isEnabled) return;

    // Check count rebuild
    if (config.particles.count !== this.count) {
      this.rebuild(config.particles.count);
    }

    // Update material colors & opacity
    this.streakMaterial.color.set(config.particles.color);
    this.streakMaterial.opacity = config.particles.opacity * 0.85;

    this.glowMaterial.color.set(config.particles.color);
    this.glowMaterial.opacity = config.particles.opacity * 0.6;

    const windSpeed = windVector.length();
    const normalizedWind = windVector.clone().normalize();
    const speedFactor = config.particles.speedFactor * 1.8;
    const baseSize = config.particles.size;

    const streakCount = Math.floor(this.count * 0.7);

    // Look rotation for streaks (align with wind direction)
    const targetQuat = new THREE.Quaternion();
    if (windSpeed > 0.001) {
      const up = new THREE.Vector3(0, 1, 0);
      const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), normalizedWind, up);
      targetQuat.setFromRotationMatrix(m);
    }

    const halfX = this.boxSize.x * 0.5;
    const halfY = this.boxSize.y * 0.5;
    const halfZ = this.boxSize.z * 0.5;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life += delta;

      if (p.life >= p.maxLife) {
        this.respawnWindward(p, normalizedWind);
      }

      // Sine wave swirl drift
      const t = elapsed * 3.0 + i;
      const swirlX = Math.sin(t * 1.4) * 0.15;
      const swirlY = Math.cos(t * 1.7) * 0.1;
      const swirlZ = Math.sin(t * 1.1 + 1.0) * 0.15;

      p.velocity.copy(windVector)
        .multiplyScalar(speedFactor)
        .add(new THREE.Vector3(swirlX, swirlY, swirlZ));

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
      if (progress < 0.2) {
        alpha = progress / 0.2;
      } else if (progress > 0.7) {
        alpha = (1.0 - progress) / 0.3;
      }
      alpha = Math.max(0, Math.min(1, alpha));

      const particleScale = p.scale * baseSize * 25.0 * alpha;

      this.dummy.position.copy(p.position);

      if (i < streakCount) {
        // Streaks: stretch with wind speed
        this.dummy.quaternion.copy(targetQuat);
        const stretchZ = Math.max(0.5, windSpeed * 0.8 * p.aspect);
        this.dummy.scale.set(particleScale, particleScale, particleScale * stretchZ);
        this.dummy.updateMatrix();

        if (this.streakMesh) {
          this.streakMesh.setMatrixAt(i, this.dummy.matrix);
        }
      } else {
        // Glow dots
        const glowIndex = i - streakCount;
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(particleScale * 1.2, particleScale * 1.2, particleScale * 1.2);
        this.dummy.updateMatrix();

        if (this.glowMesh) {
          this.glowMesh.setMatrixAt(glowIndex, this.dummy.matrix);
        }
      }
    }

    if (this.streakMesh) {
      this.streakMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.glowMesh) {
      this.glowMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    if (this.streakMesh) {
      this.group.remove(this.streakMesh);
      this.streakMesh.geometry.dispose();
    }
    if (this.glowMesh) {
      this.group.remove(this.glowMesh);
      this.glowMesh.geometry.dispose();
    }
    this.streakMaterial.dispose();
    this.glowMaterial.dispose();
  }
}
