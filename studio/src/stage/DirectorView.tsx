import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DEFAULT_BACKDROP, DEFAULT_SLOT_POSITIONS, type LocationVisualPreset } from '@anime-vrm/scenario';
import type { StageManager } from '@anime-vrm/engine/stage/StageManager';
import { disposeEnvironment, loadEnvironment, placeEnvironment } from '@anime-vrm/engine/stage/environments';

interface Props {
  manager: StageManager | null;
  location: LocationVisualPreset | undefined;
  /** キャラ ID → 表示色 */
  colors: Record<string, string>;
}

const SLOT_COLORS = { left: '#3b82f6', center: '#64748b', right: '#f97316' } as const;
/** 画面に貼る遠景を、カメラの前のどこに描くか（見やすさのための距離） */
const SCREEN_BACKDROP_DISTANCE = 5;

/**
 * 舞台を俯瞰する簡易3D表示。キャラはテーマ色のカプセル、背景は画像を貼った板、カメラは視野の線で描く。
 * 実際の描画（StageManager）からはカメラとキャラの配置を読むだけで、描画には関わらない
 */
export function DirectorView({ manager, location, colors }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ manager, location, colors });
  propsRef.current = { manager, location, colors };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor('#f1f5f9');

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#cbd5e1', 2.2));
    const grid = new THREE.GridHelper(12, 24, '#94a3b8', '#cbd5e1');
    scene.add(grid);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
    camera.position.set(4.2, 3.2, 5.2);
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 0.9, -0.5);
    controls.update();

    // 立ち位置の目印
    const slotMarkers = Object.fromEntries(
      (Object.keys(SLOT_COLORS) as Array<keyof typeof SLOT_COLORS>).map((slot) => {
        const marker = new THREE.Mesh(
          new THREE.RingGeometry(0.16, 0.22, 32),
          new THREE.MeshBasicMaterial({ color: SLOT_COLORS[slot], side: THREE.DoubleSide })
        );
        marker.rotation.x = -Math.PI / 2;
        scene.add(marker);
        return [slot, marker];
      })
    ) as unknown as Record<keyof typeof SLOT_COLORS, THREE.Mesh>;

    // 実際のカメラの視野
    const viewCamera = new THREE.PerspectiveCamera();
    const cameraHelper = new THREE.CameraHelper(viewCamera);
    scene.add(cameraHelper);

    // 背景の板（遠景・中景・近景）
    const loader = new THREE.TextureLoader();
    const textures = new Map<string, THREE.Texture>();
    const textureFor = (url: string | undefined) => {
      if (!url) return null;
      let texture = textures.get(url);
      if (!texture) {
        texture = loader.load(url);
        texture.colorSpace = THREE.SRGBColorSpace;
        textures.set(url, texture);
      }
      return texture;
    };
    const makePlane = (opacity: number) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false })
      );
      scene.add(mesh);
      return mesh;
    };
    const backdrop = makePlane(0.95);
    const midground = makePlane(0.9);
    const nearground = makePlane(0.9);
    const setPlane = (mesh: THREE.Mesh, url: string | undefined, width: number, height: number) => {
      const material = mesh.material as THREE.MeshBasicMaterial;
      const texture = textureFor(url);
      mesh.visible = texture !== null;
      if (material.map !== texture) {
        material.map = texture;
        material.needsUpdate = true;
      }
      mesh.scale.set(width, height, 1);
    };

    // 3D背景（実際の描画と同じセットを読み込む）
    let environment: { model: string; object: THREE.Object3D | null } | null = null;
    const updateEnvironment = (settings: LocationVisualPreset['environment']) => {
      if (environment && environment.model !== settings?.model) {
        if (environment.object) {
          scene.remove(environment.object);
          disposeEnvironment(environment.model, environment.object);
        }
        environment = null;
      }
      if (!settings) return;
      if (environment) {
        if (environment.object) placeEnvironment(environment.object, settings);
        return;
      }
      const entry: { model: string; object: THREE.Object3D | null } = { model: settings.model, object: null };
      environment = entry;
      loadEnvironment(settings.model)
        .then((object) => {
          if (environment !== entry) {
            disposeEnvironment(settings.model, object);
            return;
          }
          entry.object = object;
          scene.add(object);
        })
        .catch(() => {});
    };

    // キャラの代わりのカプセル
    const proxies = new Map<string, THREE.Mesh>();
    const proxyMaterial = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.6 });

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas.parentElement ?? canvas;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement ?? canvas);
    resize();

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const { manager: stage, location: loc, colors: palette } = propsRef.current;
      const stageSettings = loc?.stage;
      updateEnvironment(loc?.environment);

      for (const slot of Object.keys(slotMarkers) as Array<keyof typeof SLOT_COLORS>) {
        const [x, y, z] = stageSettings?.slots?.[slot] ?? DEFAULT_SLOT_POSITIONS[slot];
        slotMarkers[slot].position.set(x, y + 0.005, z);
      }

      // カメラの視野（実際の描画のカメラを写す）
      const source = stage?.viewCamera;
      if (source) {
        viewCamera.position.copy(source.position);
        viewCamera.quaternion.copy(source.quaternion);
        viewCamera.fov = source.fov;
        viewCamera.aspect = source.aspect;
        viewCamera.near = 0.2;
        viewCamera.far = SCREEN_BACKDROP_DISTANCE;
        viewCamera.updateProjectionMatrix();
        viewCamera.updateMatrixWorld();
        cameraHelper.update();
      }
      cameraHelper.visible = !!source;

      // 遠景：画面に貼るならカメラの視野いっぱいに、3D空間に置くなら設定した位置に
      const settings = { ...DEFAULT_BACKDROP, ...stageSettings?.backdrop };
      const backgroundUrl = loc?.layers.background.url;
      const image = textureFor(backgroundUrl)?.image as { width?: number; height?: number } | undefined;
      const imageAspect = image?.width && image?.height ? image.width / image.height : 16 / 9;
      if (settings.mode === 'world') {
        backdrop.position.set(0, settings.offsetY, -settings.distance);
        backdrop.quaternion.identity();
        setPlane(backdrop, backgroundUrl, settings.height * imageAspect, settings.height);
      } else if (source) {
        const height = 2 * SCREEN_BACKDROP_DISTANCE * Math.tan(THREE.MathUtils.degToRad(source.fov / 2));
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(source.quaternion);
        backdrop.position.copy(source.position).addScaledVector(forward, SCREEN_BACKDROP_DISTANCE);
        backdrop.quaternion.copy(source.quaternion);
        setPlane(backdrop, backgroundUrl, height * source.aspect, height);
      }

      for (const [mesh, layer] of [
        [midground, loc?.layers.midground],
        [nearground, loc?.layers.nearground],
      ] as const) {
        if (layer?.url) {
          mesh.position.set(layer.position.x, layer.position.y, layer.position.z);
          mesh.quaternion.identity();
          // 実際の描画の中景・近景は 3 × 2 の板
          setPlane(mesh, layer.url, 3 * layer.scale, 2 * layer.scale);
        } else {
          mesh.visible = false;
        }
      }

      // キャラ
      const layout = stage?.getCastLayout() ?? [];
      const present = new Set(layout.map((c) => c.id));
      for (const [id, mesh] of proxies) {
        if (!present.has(id)) {
          scene.remove(mesh);
          proxies.delete(id);
        }
      }
      for (const member of layout) {
        let mesh = proxies.get(member.id);
        const height = member.headHeight + 0.14;
        if (!mesh) {
          mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1, 8, 16), proxyMaterial(palette[member.id] ?? '#94a3b8'));
          scene.add(mesh);
          proxies.set(member.id, mesh);
        }
        // 全長 1.32 のカプセルを背丈に合わせて伸ばす
        mesh.scale.set(1, height / 1.32, 1);
        mesh.position.set(member.position[0], member.position[1] + height / 2, member.position[2]);
        mesh.rotation.y = member.rotationY;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      textures.forEach((t) => t.dispose());
      if (environment?.object) disposeEnvironment(environment.model, environment.object);
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />;
}
