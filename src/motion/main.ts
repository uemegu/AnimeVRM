import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { MotionEngine, sources, masks, newLayer, validateRecipe, type Recipe } from './engine';
import { exportFBX } from './fbx';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#motion-app')!;
app.innerHTML = `
<header><a class="brand" href="${import.meta.env.BASE_URL}"><span class="mark">m</span> Motion Mixer <small>動きを、重ねよう。</small></a><div class="header-actions"><button id="import">レシピを開く</button><button id="save">レシピ保存</button><button id="export" class="primary" disabled>↓ FBXを書き出す</button></div></header>
<main><aside class="library"><div class="eyebrow">01 / MOTION LIBRARY</div><h2>動作を選ぶ</h2><p>クリックして、動きをひとつ追加。</p><input id="search" placeholder="動作を検索…" aria-label="動作を検索"><div id="library"></div><div class="hint">✦ 自由にアレンジ<br>既存モーションと基本ポーズを組み合わせます。髪をかきあげる動作は近似ポーズです。</div></aside>
<section class="workspace"><div class="stage-head"><div><div class="eyebrow">LIVE PREVIEW</div><h1>小さな動作から、ひとつの表現へ。</h1></div><label class="toggle"><input id="skeleton" type="checkbox"> 骨格表示</label></div><div id="stage"><div class="stage-badge">● <span id="model-state">モデルを準備中</span></div><div class="stage-help">ドラッグで回転 · スクロールでズーム</div></div><div class="transport"><button id="play" class="play" disabled aria-label="再生">▶</button><button id="rewind" aria-label="先頭へ">↤</button><output id="time">0.00 / 6.00 s</output><input id="seek" type="range" min="0" max="6" step="0.001" value="0" aria-label="再生位置"><label>長さ <input id="duration" type="number" min="0.5" max="60" step="0.5" value="6"> 秒</label><select id="fps" aria-label="出力FPS"><option>24</option><option selected>30</option><option>60</option></select><span>fps</span></div>
<div class="composition"><div class="composition-head"><div><div class="eyebrow">02 / COMPOSITION</div><h2>動きを重ねる <span id="count">0</span></h2></div><div class="presets"><span>まずは試す</span><button data-preset="greet">歩きながら挨拶</button><button data-preset="bow">丁寧なお辞儀</button><button data-preset="hair">髪をかきあげる</button></div></div><p class="description">下のカードほど優先。重なった部位は「強さ」でブレンドします。</p><div id="layers"></div></div></section></main><footer><span id="status" role="status" aria-live="polite">モーションを読み込んでいます…</span><span>Mixamo skeleton · Binary FBX 7.4 · ローカル処理</span></footer><input id="file" type="file" accept=".json" hidden>`;
const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;
const engine = new MotionEngine();
let recipe: Recipe = { version: 1, duration: 6, fps: 30, layers: [] };
let selected = '', time = 0, playing = false, ready = false, busy = false;
const status = (message: string) => { $('status').textContent = message; };
const nameOf = (key: string) => sources.find(s => s[0] === key)?.[1] ?? key;
const persist = () => { try { localStorage.setItem('motion-mixer-v1', JSON.stringify(recipe)); } catch { /* Private browsing may disable local storage. */ } };
function download(data: BlobPart, name: string, type: string) { const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
async function action(fn: () => Promise<void>) { if (busy || !ready) return; busy = true; $('export').setAttribute('disabled', ''); try { await fn(); } catch (e) { status(`エラー: ${e instanceof Error ? e.message : e}`); } finally { busy = false; $('export').removeAttribute('disabled'); } }
function library() {
  const query = $<HTMLInputElement>('search').value;
  $('library').innerHTML = sources.filter(s => `${s[0]} ${s[1]}`.toLowerCase().includes(query.toLowerCase())).map((s, index) => `<button class="motion-card" data-source="${s[0]}"><span class="motion-icon">${s[0].startsWith('@') ? '✦' : ['↟', '↗', '≈', '⌁'][index % 4]}</span><span><b>${s[1]}</b><small>${s[0].startsWith('@') ? '基本ポーズ' : 'モーション'} · ${s[2]}</small></span><span class="add">＋</span></button>`).join('');
}
$('search').oninput = library; library();
$('library').onclick = event => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-source]'); if (button) void action(async () => { const source = button.dataset.source!; status(`${nameOf(source)}を読み込み中…`); await engine.load(source); if (recipe.layers.length >= 32) throw new Error('動作は32個まで追加できます'); const layer = newLayer(source, engine, recipe.duration); recipe.layers.push(layer); selected = layer.id; render(); status(`${nameOf(source)}を追加しました`); }); };
function render() {
  $('count').textContent = String(recipe.layers.length);
  $<HTMLInputElement>('duration').value = String(recipe.duration); $<HTMLSelectElement>('fps').value = String(recipe.fps); $<HTMLInputElement>('seek').max = String(recipe.duration);
  $('layers').innerHTML = recipe.layers.length ? recipe.layers.map((l, index) => `<article class="layer ${l.id === selected ? 'selected' : ''} ${l.enabled ? '' : 'muted'}" data-id="${l.id}"><div class="layer-top"><input data-field="enabled" type="checkbox" ${l.enabled ? 'checked' : ''} aria-label="${nameOf(l.source)}を有効にする"><button class="layer-title" data-action="select"><span class="number">${String(index + 1).padStart(2, '0')}</span>${nameOf(l.source)}</button><select data-field="mask" aria-label="適用部位">${masks.map(m => `<option ${l.mask === m ? 'selected' : ''}>${m}</option>`).join('')}</select><label class="weight">強さ <input data-field="weight" type="range" min="0" max="1" step=".01" value="${l.weight}" aria-label="強さ"><output>${Math.round(l.weight * 100)}%</output></label><button data-action="up" aria-label="上へ移動" ${index === 0 ? 'disabled' : ''}>↑</button><button data-action="down" aria-label="下へ移動" ${index === recipe.layers.length - 1 ? 'disabled' : ''}>↓</button><button data-action="copy" aria-label="複製">⧉</button><button data-action="delete" aria-label="削除">×</button></div><div class="timeline" title="クリックで開始位置を変更"><div class="clip" style="left:${Math.min(100, l.start / recipe.duration * 100)}%;width:${Math.max(0, Math.min(l.duration, recipe.duration - l.start) / recipe.duration * 100)}%">${l.start.toFixed(1)}s — ${(l.start + l.duration).toFixed(1)}s</div></div>${selected === l.id ? `<div class="details">${numeric('開始', 'start', l.start, 0, recipe.duration, .1, '秒')}${numeric('再生時間', 'duration', l.duration, .1, 60, .1, '秒')}${numeric('速度', 'speed', l.speed, .1, 3, .1, '×')}${numeric('元の開始', 'from', l.from, 0, l.to - 1, 1, 'f')}${numeric('元の終了', 'to', l.to, l.from + 1, engine.frames(l.source), 1, 'f')}${numeric('フェード', 'fade', l.fade, 0, 5, .1, '秒')}<label><input data-field="loop" type="checkbox" ${l.loop ? 'checked' : ''}>ループ</label><small>元のフレームは30fps換算。クリックした位置から動作が始まります。</small></div>` : ''}</article>`).join('') : '<div class="empty">左から動作を追加してみましょう。<br><small>プリセットなら、ワンクリックで始められます。</small></div>';
  persist();
}
function numeric(label: string, key: string, value: number, min: number, max: number, step: number, unit: string) { return `<label>${label}<span><input data-field="${key}" aria-label="${label}" type="number" min="${min}" max="${max}" step="${step}" value="${value}"> ${unit}</span></label>`; }
$('layers').addEventListener('input', event => {
  const input = event.target as HTMLInputElement; const article = input.closest<HTMLElement>('[data-id]'); const layer = recipe.layers.find(l => l.id === article?.dataset.id); if (!layer || !input.dataset.field) return;
  const key = input.dataset.field;
  if (key === 'mask') layer.mask = input.value;
  else if (key === 'enabled' || key === 'loop') layer[key] = input.checked;
  else if (['weight', 'start', 'duration', 'speed', 'from', 'to', 'fade'].includes(key) && input.value !== '' && Number.isFinite(input.valueAsNumber)) {
    const v = T.MathUtils.clamp(input.valueAsNumber, Number(input.min), Number(input.max)); (layer as unknown as Record<string, unknown>)[key] = v;
    if (key === 'weight') input.nextElementSibling!.textContent = `${Math.round(v * 100)}%`;
  }
  persist();
});
$('layers').addEventListener('change', () => render());
$('layers').onclick = event => {
  const target = event.target as HTMLElement, article = target.closest<HTMLElement>('[data-id]'); if (!article) return;
  const index = recipe.layers.findIndex(l => l.id === article.dataset.id), layer = recipe.layers[index];
  const act = target.closest<HTMLElement>('[data-action]')?.dataset.action;
  if (act === 'delete') recipe.layers.splice(index, 1);
  if (act === 'copy' && recipe.layers.length < 32) { const copy = { ...layer, id: crypto.randomUUID() }; recipe.layers.splice(index + 1, 0, copy); selected = copy.id; }
  if (act === 'up' && index > 0) [recipe.layers[index - 1], recipe.layers[index]] = [layer, recipe.layers[index - 1]];
  if (act === 'down' && index < recipe.layers.length - 1) [recipe.layers[index + 1], recipe.layers[index]] = [layer, recipe.layers[index + 1]];
  if (act === 'select') selected = selected === layer.id ? '' : layer.id;
  const timeline = target.closest<HTMLElement>('.timeline'); if (timeline) { const rect = timeline.getBoundingClientRect(); layer.start = Math.round(T.MathUtils.clamp((event.clientX - rect.left) / rect.width * recipe.duration, 0, recipe.duration - .1) * 10) / 10; }
  if (act || timeline) render();
};
document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button => button.onclick = () => void action(async () => {
  const names = button.dataset.preset === 'greet' ? ['Walking', 'Standing Greeting'] : button.dataset.preset === 'bow' ? ['Standing Idle', 'Quick Formal Bow'] : ['Standing Idle', '@hair', '@twist'];
  await Promise.all(names.map(name => engine.load(name)));
  recipe.layers = names.map(name => newLayer(name, engine, recipe.duration));
  recipe.layers[0].mask = button.dataset.preset === 'greet' ? '下半身' : '全身';
  recipe.layers[1].start = 1; recipe.layers[1].duration = Math.max(.1, recipe.duration - 1); recipe.layers[1].loop = false;
  if (recipe.layers[2]) recipe.layers[2].weight = .25;
  selected = recipe.layers[1].id; time = 0; render(); status('プリセットを読み込みました。強さやタイミングを自由に調整できます。');
}));
$('duration').onchange = () => { const input = $<HTMLInputElement>('duration'); recipe.duration = T.MathUtils.clamp(Number(input.value) || 6, .5, 60); time = Math.min(time, recipe.duration); render(); };
$('fps').onchange = () => { recipe.fps = Number($<HTMLSelectElement>('fps').value); persist(); };
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Ⅱ' : '▶'; $('play').setAttribute('aria-label', playing ? '一時停止' : '再生'); };
$('rewind').onclick = () => { time = 0; };
$('seek').oninput = () => { time = Number($<HTMLInputElement>('seek').value); };
$('save').onclick = () => download(JSON.stringify(recipe, null, 2), 'motion-recipe.json', 'application/json');
$('import').onclick = () => { if (ready && !busy) $<HTMLInputElement>('file').click(); };
$('file').onchange = () => void action(async () => {
  const input = $<HTMLInputElement>('file'), file = input.files?.[0]; input.value = ''; if (!file) return;
  if (file.size > 1000000) throw new Error('レシピのファイルが大きすぎます');
  const next = validateRecipe(JSON.parse(await file.text())); await Promise.all([...new Set(next.layers.map(l => l.source))].map(name => engine.load(name)));
  for (const l of next.layers) if (l.to > engine.frames(l.source)) throw new Error('元の終了フレームがモーションの範囲を超えています');
  recipe = next; selected = recipe.layers[0]?.id ?? ''; time = 0; render(); status('レシピを開きました');
});
$('export').onclick = () => void action(async () => {
  status('全フレームを合成してFBXを書き出しています…'); await new Promise(resolve => requestAnimationFrame(resolve));
  const data = exportFBX(engine, recipe);
  const check = new FBXLoader().parse(data, '');
  if (!check.animations[0]?.tracks.length || Math.abs(check.animations[0].duration - recipe.duration) > 1 / recipe.fps) throw new Error('FBXの再読み込み検証に失敗しました');
  download(data, 'motion-mix.fbx', 'application/octet-stream'); status(`FBXを書き出しました · ${recipe.duration}秒 / ${recipe.fps}fps · 再読み込み確認済み`);
});

const stage = $('stage'), scene = new T.Scene(); scene.background = new T.Color('#eceee9'); scene.fog = new T.Fog('#eceee9', 7, 18);
const camera = new T.PerspectiveCamera(35, 1, .01, 100); camera.position.set(1.8, 1.5, 3.2);
const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = T.SRGBColorSpace; stage.prepend(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, .9, 0); controls.enableDamping = true; controls.minDistance = 1; controls.maxDistance = 9;
scene.add(new T.HemisphereLight(0xffffff, 0x758779, 2.5)); const light = new T.DirectionalLight(0xfff8ef, 3); light.position.set(2, 5, 3); scene.add(light);
const grid = new T.GridHelper(20, 40, 0xb8c3b7, 0xd6dbd2); grid.position.y = -.01; scene.add(grid);
const pad = new T.Mesh(new T.CylinderGeometry(.78, .78, .025, 80), new T.MeshStandardMaterial({ color: 0xdfe5db, roughness: 1 })); pad.position.y = -.03; scene.add(pad);
const resize = () => { renderer.setSize(stage.clientWidth, stage.clientHeight); camera.aspect = stage.clientWidth / stage.clientHeight; camera.updateProjectionMatrix(); }; new ResizeObserver(resize).observe(stage); resize();
let vrm: VRM | undefined, helper: T.SkeletonHelper;
const boneMap: Record<string, string> = { Hips: 'hips', Spine: 'spine', Spine1: 'chest', Spine2: 'upperChest', Neck: 'neck', Head: 'head' };
for (const side of ['Left', 'Right']) for (const [source, target] of Object.entries({ Shoulder: 'Shoulder', Arm: 'UpperArm', ForeArm: 'LowerArm', Hand: 'Hand', UpLeg: 'UpperLeg', Leg: 'LowerLeg', Foot: 'Foot', ToeBase: 'Toes' })) boneMap[side + source] = side.toLowerCase() + target;
for (const side of ['Left', 'Right']) for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) for (let joint = 1; joint <= 3; joint++) boneMap[`${side}Hand${finger}${joint}`] = side.toLowerCase() + (finger === 'Pinky' ? 'Little' : finger) + (finger === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'])[joint - 1];
let hipsHeight = 1;
function poseVRM(delta: number) {
  if (!vrm) return;
  for (const [name, r] of engine.rest) {
    const target = vrm.humanoid.getNormalizedBoneNode(boneMap[name] as VRMHumanBoneName); if (!target) continue;
    target.quaternion.copy(r.node.quaternion).premultiply(r.parentWorld).multiply(r.world.clone().invert());
    if (vrm.meta.metaVersion === '0') { target.quaternion.x *= -1; target.quaternion.z *= -1; }
    if (name === 'Hips') target.position.y = hipsHeight * r.node.position.y / r.p.y;
  }
  vrm.update(delta);
}
async function init() {
  await engine.init();
  const skeletonGroup = new T.Group(); skeletonGroup.scale.setScalar(.01); scene.add(skeletonGroup);
  const bones = engine.root.children.filter(n => (n as T.Bone).isBone); for (const bone of bones) skeletonGroup.add(bone);
  helper = new T.SkeletonHelper(skeletonGroup); scene.add(helper); helper.visible = true;
  try { const saved = localStorage.getItem('motion-mixer-v1'); if (saved) { const next = validateRecipe(JSON.parse(saved)); await Promise.all([...new Set(next.layers.map(l => l.source))].map(name => engine.load(name))); recipe = next; } } catch { status('保存レシピを復元できなかったため、新規で開始します'); }
  if (!recipe.layers.length) { await engine.load('Walking'); recipe.layers = [newLayer('Walking', engine, 6)]; }
  selected = recipe.layers[0]?.id ?? ''; ready = true; render(); $('play').removeAttribute('disabled'); $('export').removeAttribute('disabled'); status('動作を追加して、オリジナルのモーションを作りましょう');
  try {
    const loader = new GLTFLoader(); loader.register(parser => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/girl.vrm`); vrm = gltf.userData.vrm as VRM; VRMUtils.rotateVRM0(vrm); scene.add(vrm.scene);
    hipsHeight = vrm.humanoid.getNormalizedBoneNode('hips')!.position.y; helper.visible = $<HTMLInputElement>('skeleton').checked; $('model-state').textContent = 'VRMプレビュー';
  } catch { $('model-state').textContent = '骨格プレビュー'; status('VRMを読み込めませんでした。骨格で編集・FBX出力できます。'); }
}
$('skeleton').onchange = () => { if (helper) helper.visible = $<HTMLInputElement>('skeleton').checked || !vrm; if (vrm) vrm.scene.visible = !$<HTMLInputElement>('skeleton').checked; };
let previous = performance.now();
function tick(now: number) { requestAnimationFrame(tick); const delta = Math.min((now - previous) / 1000, .05); previous = now;
  if (ready) { if (playing) time = (time + delta) % recipe.duration; engine.sample(recipe, time); poseVRM(delta); $<HTMLInputElement>('seek').value = String(time); $('time').textContent = `${time.toFixed(2)} / ${recipe.duration.toFixed(2)} s`; }
  controls.update(); renderer.render(scene, camera);
}
requestAnimationFrame(tick); void init().catch(e => status(`初期化エラー: ${e.message}。ページを再読み込みしてください。`));
// Expose the composition for reproducible export/preview integration checks.
(window as unknown as { motionMixer: unknown }).motionMixer = { engine, get recipe() { return recipe; }, get vrm() { return vrm; }, exportFBX: () => exportFBX(engine, recipe) };
