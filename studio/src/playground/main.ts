/**
 * 布の試し場（studio/playground.html）。中庭（簡易3D）にアオイ（aoi-breaking.vrm）を立たせ、キーで歩く・走る・
 * ジャンプ・ダンスをさせて、スカートと上着の布の動きを見る。
 *
 * 布にする服はこのページで指定する（下の GARMENTS。キャラ設定には書いていない）。
 * モーションは assets/animations の FBX（Walking・Jogging・Jump・Northern Soul Floor Combo は Mixamo のもので、
 * リポジトリには入っていない。手元に置いて使う）。
 */
import '@anime-vrm/content/register';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { LocationVisualPreset, TimeOfDayPreset } from '@anime-vrm/engine/schema/visual';
import type { GarmentSpec } from '@anime-vrm/engine/cloth/vrm';
import { StageManager } from '@anime-vrm/engine/stage/StageManager';
import { motionUrl } from '@anime-vrm/engine/utils/path';

const MODEL = '/models/aoi/aoi-breaking.vrm';
const LOCATION = 'courtyard';

/** 布にする服：スカートはスーツ地、上着（腰まで届く上着）は天竺ニット（外衣）で、裾はスカートの外に乗る */
const GARMENTS: Record<string, GarmentSpec> = {
  N00_001_03_Bottoms_01_CLOTH: { fabric: 'suiting' },
  N00_004_01_Tops_01_CLOTH: { fabric: 'jerseyOuter', over: ['N00_001_03_Bottoms_01_CLOTH'] },
};

const MOTIONS = {
  idle: 'Standing Idle',
  walk: 'Walking',
  run: 'Jogging',
  jump: 'Jump',
  dance: 'Northern Soul Floor Combo',
} as const;

/** 移動の速さ（m/s）。Mixamo の歩き・走りの足の運びに合わせた目安 */
const WALK_SPEED = 1.3;
const RUN_SPEED = 3.2;
/** 向きを変える速さ（1/s。大きいほど速く向く） */
const TURN_RATE = 10;

const status = document.querySelector<HTMLDivElement>('#status')!;
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} を読めません`);
  return res.json() as Promise<T>;
}

const [locations, timeOfDay] = await Promise.all([
  json<{ presets: Record<string, LocationVisualPreset> }>('/studio/locations.json'),
  json<{ presets: Record<string, TimeOfDayPreset> }>('/studio/time-of-day.json'),
]);

// 風は止める（布の動きが風によるものか分からなくならないよう。場所の設定ファイルは変えない）
const { wind: _wind, ...calmLocation } = locations.presets[LOCATION];
const stage = new StageManager({
  canvas,
  presets: { timeOfDay: timeOfDay.presets, locations: { ...locations.presets, [LOCATION]: calmLocation } },
  initialTimeOfDay: 'day',
  initialLocationId: LOCATION,
  quality: { skirtCloth: true },
  garments: (url) => (url === MODEL ? GARMENTS : undefined),
});
const resize = () => stage.resize(canvas.clientWidth, canvas.clientHeight);
new ResizeObserver(resize).observe(canvas);
resize();

await stage.setCast([{ id: 'aoi', modelUrl: MODEL, slot: 'center', rotationY: 0, expression: 'neutral', expressionWeight: 1, motion: MOTIONS.idle, motionLoop: true }]);
const avatar = await stage.loadAvatar('aoi', MODEL);
const root = avatar.vrm!.scene;
stage.setCameraShot('wide', 'aoi');

// ---- カメラ：マウスで回す。注視点はキャラに付いていく ----
const controls = new OrbitControls(stage.viewCamera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 0.8;
controls.maxDistance = 8;
const lookHeight = 0.9;
stage.setFreeCamera(true);
// キャラの正面 2.6m、少し上から
const front = new THREE.Vector3(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y));
controls.target.set(root.position.x, root.position.y + lookHeight, root.position.z);
stage.viewCamera.position.set(root.position.x + front.x * 2.6, root.position.y + 1.25, root.position.z + front.z * 2.6);
controls.update();
// 調べる用（開発者ツールから）
Object.assign(window, { playground: { stage, avatar } });

// ---- キー ----
const keys = new Set<string>();
addEventListener('keydown', (event) => {
  if (event.repeat) return;
  keys.add(event.code);
  if (event.code === 'Space') { event.preventDefault(); jump(); }
  if (event.code === 'KeyE') toggleDance();
});
addEventListener('keyup', (event) => keys.delete(event.code));
addEventListener('blur', () => keys.clear());

// ---- 動き：今のモーション（同じなら当て直さない）----
// 読み込みは非同期なので、1 つずつ順に当てる。読み込み中に別のモーションを頼まれたら、終わってから最後に頼まれたものを当てる
// （頼んだ順と読み込みが終わる順が逆になると、歩きが後から当たって、待機に戻れなくなっていた）
type Mode = 'idle' | 'walk' | 'run' | 'jump' | 'dance';
let mode: Mode = 'idle';
let playing = '';   // 当てた（当てている途中の）モーション
let wanted: { name: string; loop: boolean; fade: number; done: (action: THREE.AnimationAction | null) => void } | null = null;
let loading = false;
function play(name: string, loop = true, fade = 0.25): Promise<THREE.AnimationAction | null> {
  if (!wanted && !loading && playing === name && loop) return Promise.resolve(null);
  if (wanted && wanted.name === name && loop) return Promise.resolve(null);
  return new Promise((done) => {
    wanted?.done(null);   // 当てる前に別のものを頼まれた
    wanted = { name, loop, fade, done };
    if (!loading) void next();
  });
}
async function next(): Promise<void> {
  loading = true;
  while (wanted) {
    const job = wanted; wanted = null;
    if (playing === job.name && job.loop) { job.done(null); continue; }
    playing = job.name;
    job.done(await avatar.playAnimation(motionUrl(job.name), job.loop, job.fade));
  }
  loading = false;
}

let jumpUntil = 0;
function jump(): void {
  if (mode === 'jump' || mode === 'dance') return;
  mode = 'jump';
  void play(MOTIONS.jump, false, 0.15).then((action) => {
    const length = action?.getClip().duration ?? 1;
    jumpUntil = performance.now() + length * 1000;
  });
  jumpUntil = performance.now() + 5000;   // 長さが分かるまでの仮
}
function toggleDance(): void {
  if (mode === 'jump') return;
  if (mode === 'dance') { mode = 'idle'; return; }
  mode = 'dance';
  void play(MOTIONS.dance, true, 0.3);
}

// ---- 毎フレーム ----
// キャラの移動・向き・カメラは、舞台がこのアバターを更新するとき（布の計算より前）に、舞台と同じ経過時間で行う。
// 自前の描画ループで別の時計を使って動かすと、布が計算する時点のキャラの位置が「1 つ前のコマの長さ」ぶん動いた位置になり、
// コマの長さが不揃いだと、布から見た体の速さがコマごとに揺れて、胸の前の布が震えた（2026-11-16）
const move = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
let heading = root.rotation.y;

function steer(dt: number): void {
  // カメラの向きを前に、押しているキーの向き
  stage.viewCamera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, up).normalize();
  move.set(0, 0, 0);
  if (keys.has('KeyW') || keys.has('ArrowUp')) move.add(forward);
  if (keys.has('KeyS') || keys.has('ArrowDown')) move.sub(forward);
  if (keys.has('KeyD') || keys.has('ArrowRight')) move.add(right);
  if (keys.has('KeyA') || keys.has('ArrowLeft')) move.sub(right);
  const moving = move.lengthSq() > 0;
  const running = keys.has('ShiftLeft') || keys.has('ShiftRight');

  if (mode === 'jump' && performance.now() >= jumpUntil) mode = 'idle';
  if (moving && mode === 'dance') mode = 'idle';   // 動き出したらダンスをやめる
  if (mode !== 'jump' && mode !== 'dance') {
    mode = moving ? (running ? 'run' : 'walk') : 'idle';
    void play(MOTIONS[mode]);
  }

  // 移動と向き（ジャンプ中も、押していればそのまま進む）
  if (moving && mode !== 'dance') {
    move.normalize();
    const speed = mode === 'run' || (mode === 'jump' && running) ? RUN_SPEED : WALK_SPEED;
    root.position.addScaledVector(move, speed * dt);
    const goal = Math.atan2(move.x, move.z);
    let diff = goal - heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    heading += diff * Math.min(1, TURN_RATE * dt);
    root.rotation.y = heading;
  }

  // カメラの注視点をキャラに付ける（カメラも同じだけ動かして、見る角度と距離を保つ）
  const tx = root.position.x - controls.target.x, tz = root.position.z - controls.target.z, ty = root.position.y + lookHeight - controls.target.y;
  controls.target.x += tx; controls.target.y += ty; controls.target.z += tz;
  stage.viewCamera.position.x += tx; stage.viewCamera.position.y += ty; stage.viewCamera.position.z += tz;
  controls.update();
  stage.setFreeCameraTarget(controls.target);
}
const updateAvatar = avatar.update.bind(avatar);
avatar.update = (delta, frameInfo) => {
  steer(delta);
  updateAvatar(delta, frameInfo);
};

// 表示だけは自前の描画ループで
function showStatus(): void {
  const skirt = avatar.skirtCloth, tops = avatar.otherCloths;
  status.textContent = `動き：${{ idle: '待機', walk: '歩く', run: '走る', jump: 'ジャンプ', dance: 'ダンス' }[mode]}\n`
    + `布：スカート ${skirt ? (skirt.sleeping ? '休止中' : `${skirt.cloth.stats.ms.toFixed(1)}ms`) : 'なし'}`
    + `・上着 ${tops.length ? tops.map((c) => ((c as unknown as { knit?: { sleeping: boolean } }).knit?.sleeping ? '休止中' : '計算中')).join('・') : 'なし'}`;
  requestAnimationFrame(showStatus);
}
requestAnimationFrame(showStatus);
