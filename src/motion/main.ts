import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { MotionEngine, sources, masks, newLayer, validateRecipe, validateSaved, totalDuration, type Recipe, type SavedMotion } from './engine';
import { basics } from './basics';
import { exportFBX } from './fbx';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#motion-app')!;
app.innerHTML = `
<header><a class="brand" href="${import.meta.env.BASE_URL}"><span class="mark">m</span> Motion Mixer <small>動きを、重ねよう。</small></a><div class="header-actions"><button id="import">レシピを開く</button><button id="save">レシピ保存</button><button id="export" class="primary" disabled>↓ FBXを書き出す</button></div></header>
<main><aside class="library"><div class="eyebrow">01 / MOTION LIBRARY</div><h2>動作を選ぶ</h2><p>クリックして、動きをひとつ追加。</p><input id="search" placeholder="動作を検索…" aria-label="動作を検索"><select id="category" aria-label="動作の分類"><option value="all">すべての動作</option><option value="motion">既存モーション</option><option value="basic">基本動作</option><option value="saved">自分の動作</option></select><button id="add-library" class="library-save">＋ 今の合成を動作として保存</button><div id="library"></div><div class="hint">✦ 自由にアレンジ<br>既存モーションと基本ポーズを組み合わせます。髪をかきあげる動作は近似ポーズです。</div></aside>
<section class="workspace"><div class="preview-pane"><div class="stage-head"><div><div class="eyebrow">LIVE PREVIEW</div><h1>小さな動作から、ひとつの表現へ。</h1></div><label class="toggle"><input id="skeleton" type="checkbox"> 骨格表示</label></div><div id="stage"><div class="stage-badge">● <span id="model-state">モデルを準備中</span></div><div class="stage-help">ドラッグで回転 · スクロールでズーム</div></div><div class="transport"><button id="play" class="play" disabled aria-label="再生">▶</button><button id="rewind" aria-label="先頭へ">↤</button><output id="time">0.00 / 6.00 s</output><input id="seek" type="range" min="0" max="6" step="0.001" value="0" aria-label="再生位置"><label>長さ <input id="duration" type="number" min="0.5" max="60" step="0.5" value="6"> 秒</label><select id="fps" aria-label="出力FPS"><option>24</option><option selected>30</option><option>60</option></select><span>fps</span></div>
</div><div class="editor-pane"><div class="loop-settings"><label><input id="global-loop" type="checkbox"> 全体をループ</label><label>最初の姿勢につなぐ時間 <input id="transition" type="number" min="0" max="10" step="0.1" value="1"> 秒</label><output id="total-length"></output><small>本編の後ろに戻り動作を追加。FBXにも含まれます。</small></div><div class="composition"><div class="composition-head"><div><div class="eyebrow">02 / COMPOSITION</div><h2>動きを重ねる <span id="count">0</span></h2></div><div class="presets"><span>まずは試す</span><button data-preset="greet">歩きながら挨拶</button><button data-preset="bow">丁寧なお辞儀</button><button data-preset="hair">髪をかきあげる</button><button data-preset="metronome">左右に2秒ずつ</button></div></div><p class="description">下のカードほど優先。重なった部位は「強さ」でブレンドします。</p><div id="layers"></div></div></div></section></main><p id="storage-warning" role="alert" hidden></p><footer><span id="status" role="status" aria-live="polite">モーションを読み込んでいます…</span><span>Mixamo skeleton · Binary FBX 7.4 · ローカル処理</span></footer><input id="file" type="file" accept=".json" hidden><dialog id="save-dialog"><form id="save-form"><h2 id="save-title">合成を動作として保存</h2><p>保存した動作は、別の動作に重ねて再利用できます。</p><label>動作の名前<input id="motion-name" maxlength="60" required placeholder="例：挨拶しながら首を傾ける"></label><p id="save-error" role="alert"></p><div class="dialog-actions"><button type="button" id="cancel-save">キャンセル</button><button type="submit" class="primary">保存する</button></div></form></dialog>`;
const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;
const engine = new MotionEngine();
let recipe: Recipe = { version: 1, duration: 6, fps: 30, layers: [] };
const closedDetails = new Set<string>();
const categoryOpen = new Map<string, boolean>();
let selected = '', time = 0, playing = false, ready = false, busy = false;
let solo: { id: string; frame: number } | null = null, renameId: string | null = null;
const escapeHTML = (text: string) => text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const bundle = () => ({ ...recipe, motions: [...engine.custom.values()].filter(m => recipe.layers.some(l => l.source === m.id)) });
const status = (message: string) => { $('status').textContent = message; };
const nameOf = (key: string) => escapeHTML(engine.custom.get(key)?.name ?? sources.find(s => s[0] === key)?.[1] ?? key);
const persist = () => { try { localStorage.setItem('motion-mixer-v1', JSON.stringify(bundle())); $('storage-warning').hidden = true; } catch { $('storage-warning').hidden = false; $('storage-warning').textContent = '自動保存できませんでした。ブラウザの保存容量を確認するか、レシピ保存でファイルに退避してください。'; } };
function download(data: BlobPart, name: string, type: string) { const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
async function action(fn: () => Promise<void>) { if (busy || !ready) return; busy = true; $('export').setAttribute('disabled', ''); try { await fn(); } catch (e) { status(`エラー: ${e instanceof Error ? e.message : e}`); } finally { busy = false; $('export').removeAttribute('disabled'); } }
function library() {
  const query = $<HTMLInputElement>('search').value.toLowerCase(), category = $<HTMLSelectElement>('category').value;
  const items = [...sources, ...[...engine.custom.values()].map(m => [m.id, m.name, m.mask])];
  const filtered = items.filter(s => `${s[0]} ${s[1]}`.toLowerCase().includes(query) && (category === 'all' || (s[0].startsWith('saved:') ? 'saved' : s[0].startsWith('@') ? 'basic' : 'motion') === category));
  const groupOf = (s: string[]) => s[0].startsWith('saved:') ? '自分の動作' : !s[0].startsWith('@') ? '全身モーション' : s[2].startsWith('右手') ? '右手・手首' : s[2].startsWith('左手') ? '左手・手首' : s[2];
  const groups = ['全身モーション', '全身', '頭', '体幹', '右腕', '左腕', '右手・手首', '左手・手首', '下半身', '右脚', '左脚', '自分の動作'];
  $('library').innerHTML = groups.map(group => { const rows = filtered.filter(s => groupOf(s) === group); if (!rows.length) return ''; return `<details class="motion-category" data-group="${group}" ${query || categoryOpen.get(group) !== false ? 'open' : ''}><summary>${group}<span>${rows.length}</span></summary><div class="category-items">` + rows.map((s, index) => `<div class="library-row"><button class="motion-card" data-source="${s[0]}"><span class="motion-icon">${s[0].startsWith('saved:') ? '◇' : s[0].startsWith('@') ? '✦' : ['↟', '↗', '≈', '⌁'][index % 4]}</span><span><b>${escapeHTML(s[1])}</b><small>${s[0].startsWith('saved:') ? '自分の動作' : s[0].startsWith('@') ? '基本動作' : 'モーション'} · ${s[2]}</small></span><span class="add">＋</span></button>${s[0].startsWith('saved:') ? `<div class="saved-actions"><button data-rename="${s[0]}" aria-label="名前を変更">名前</button><button data-remove="${s[0]}" aria-label="保存動作を削除">削除</button></div>` : ''}</div>`).join('') + '</div></details>'; }).join('');
  $('library').querySelectorAll<HTMLDetailsElement>('.motion-category').forEach(details => details.ontoggle = () => { if (!query) categoryOpen.set(details.dataset.group!, details.open); });
}
$('category').onchange = library;
$('search').oninput = library; library();
$('library').onclick = event => {
  const target = event.target as HTMLElement, rename = target.closest<HTMLElement>('[data-rename]'), remove = target.closest<HTMLElement>('[data-remove]');
  if (rename) { openSave(rename.dataset.rename!); return; }
  if (remove) { void action(async () => {
    const id = remove.dataset.remove!;
    if (recipe.layers.some(l => l.source === id)) throw new Error('タイムラインで使用中です。先にそのカードを削除してください');
    localStorage.setItem('motion-mixer-library-v1', JSON.stringify([...engine.custom.values()].filter(m => m.id !== id)));
    engine.removeSaved(id); library(); status('保存動作を削除しました');
  }); return; }
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-source]'); if (button) void action(async () => { const source = button.dataset.source!; status(`${nameOf(source)}を読み込み中…`); await engine.load(source); if (recipe.layers.length >= 32) throw new Error('動作は32個まで追加できます'); const layer = newLayer(source, engine, recipe.duration); recipe.layers.push(layer); selected = layer.id; render(); status(`${nameOf(source)}を追加しました`); }); };
function render(save = true) {
  if (solo && !recipe.layers.some(l => l.id === solo!.id)) solo = null;
  $<HTMLInputElement>('global-loop').checked = recipe.loop ?? false;
  $<HTMLInputElement>('transition').value = String(recipe.transition ?? 1);
  $<HTMLInputElement>('transition').disabled = !recipe.loop;
  $('total-length').textContent = `本編 ${recipe.duration.toFixed(1)}秒 + つなぎ ${recipe.loop ? (recipe.transition ?? 1).toFixed(1) : '0'}秒 = ${totalDuration(recipe).toFixed(1)}秒`;
  $('count').textContent = String(recipe.layers.length);
  $<HTMLInputElement>('duration').value = String(recipe.duration); $<HTMLSelectElement>('fps').value = String(recipe.fps); $<HTMLInputElement>('seek').max = String(totalDuration(recipe));
  $('layers').innerHTML = recipe.layers.length ? recipe.layers.map((l, index) => `<article class="layer ${l.id === selected ? 'selected' : ''} ${l.enabled ? '' : 'muted'}" data-id="${l.id}"><div class="layer-top"><input data-field="enabled" type="checkbox" ${l.enabled ? 'checked' : ''} aria-label="${nameOf(l.source)}を有効にする"><button class="layer-title" data-action="select" aria-expanded="${!closedDetails.has(l.id)}"><span class="number">${String(index + 1).padStart(2, '0')}</span>${nameOf(l.source)}</button><select data-field="mask" aria-label="適用部位">${masks.map(m => `<option ${l.mask === m ? 'selected' : ''}>${m}</option>`).join('')}</select><label class="weight">強さ <input data-field="weight" type="range" min="0" max="1" step=".01" value="${l.weight}" aria-label="強さ"><output>${Math.round(l.weight * 100)}%</output></label><button data-action="up" aria-label="上へ移動" ${index === 0 ? 'disabled' : ''}>↑</button><button data-action="down" aria-label="下へ移動" ${index === recipe.layers.length - 1 ? 'disabled' : ''}>↓</button><button data-action="copy" aria-label="複製">⧉</button><button data-action="delete" aria-label="削除">×</button></div>${placement(l.id)}${!closedDetails.has(l.id) ? `<div class="details">${numeric('区間の長さ', 'duration', l.duration, .1, 60, .1, '秒')}${numeric('速度', 'speed', l.speed, .1, 3, .1, '×')}${numeric('元の開始', 'from', l.from, 0, l.to - 1, 1, 'f')}${numeric('元の終了', 'to', l.to, l.from + 1, engine.frames(l.source), 1, 'f')}${numeric('フェード', 'fade', l.fade, 0, 5, .1, '秒')}<label><input data-field="loop" type="checkbox" ${l.loop ? 'checked' : ''}>素材を繰り返す</label>${(l.source.startsWith('@') || l.source.startsWith('saved:')) && l.mask === '全身' ? `<label><input data-field="balance" type="checkbox" ${l.balance !== false ? 'checked' : ''}>全身のバランス補助</label>` : ''}${l.source.startsWith('@') ? `<label>基本動作の再生<select data-field="poseMode" aria-label="基本動作の再生"><option value="motion" ${l.poseMode !== 'hold' ? 'selected' : ''}>動作として再生</option><option value="hold" ${l.poseMode === 'hold' ? 'selected' : ''}>最後の姿勢を使う</option></select></label>` : ''}${l.source === '@hair' || basics[l.source]?.reach?.contact ? `<label class="contact-gap">体から離す距離（cm）<input data-field="contactGap" aria-label="体から離す距離" type="range" min="-10" max="20" step=".5" value="${l.contactGap ?? 0}"><output>${(l.contactGap ?? 0).toFixed(1)} cm</output></label>` : ''}<small>元のフレームは30fps換算。素材の繰り返しと、タイムライン上の区間の繰り返しは別々に設定できます。</small>${trimControls(l.id)}</div>` : ''}</article>`).join('') : '<div class="empty">左から動作を追加してみましょう。<br><small>プリセットなら、ワンクリックで始められます。</small></div>';
  if (save) persist();
}
function numeric(label: string, key: string, value: number, min: number, max: number, step: number, unit: string) { return `<label>${label}<span><input data-field="${key}" aria-label="${label}" type="number" min="${min}" max="${max}" step="${step}" value="${value}"> ${unit}</span></label>`; }
$('layers').addEventListener('input', event => {
  const input = event.target as HTMLInputElement; const article = input.closest<HTMLElement>('[data-id]'); const layer = recipe.layers.find(l => l.id === article?.dataset.id); if (!layer || !input.dataset.field) return;
  const key = input.dataset.field;
  if (key === 'trim-frame') { solo = { id: layer.id, frame: Number(input.value) }; playing = false; syncPlay(); article!.querySelector('.trim-position')!.textContent = `${solo.frame}f / ${(solo.frame / 30).toFixed(2)}秒`; return; }
  if (key === 'start' || key === 'end') {
    if (!Number.isFinite(input.valueAsNumber)) return;
    const end = layer.start + layer.duration;
    if (key === 'start') { layer.start = T.MathUtils.clamp(input.valueAsNumber, 0, Math.min(recipe.duration - .1, end - .1)); layer.duration = end - layer.start; }
    else layer.duration = T.MathUtils.clamp(input.valueAsNumber, layer.start + .1, recipe.duration) - layer.start;
    if (layer.repeatEvery) layer.repeatEvery = Math.max(layer.repeatEvery, layer.duration);
    solo = null; persist(); return;
  }
  if (key === 'repeat-enabled') { layer.repeatEvery = input.checked ? Math.min(60, layer.duration * 2) : 0; }
  else if (key === 'envelope') layer.envelope = input.value as 'flat' | 'sine';
  else if (key === 'poseMode') layer.poseMode = input.value as 'hold' | 'motion';
  else if (key === 'mask') layer.mask = input.value;
  else if (key === 'enabled' || key === 'loop' || key === 'balance') layer[key] = input.checked;
  else if (['weight', 'duration', 'speed', 'from', 'to', 'fade', 'repeatEvery', 'contactGap'].includes(key) && input.value !== '' && Number.isFinite(input.valueAsNumber)) {
    const v = T.MathUtils.clamp(input.valueAsNumber, Number(input.min), Number(input.max)); (layer as unknown as Record<string, unknown>)[key] = v;
    if (key === 'from' || key === 'to') { layer.fade = 0; solo = { id: layer.id, frame: v }; playing = false; syncPlay(); }
    if (key === 'contactGap') input.nextElementSibling!.textContent = `${v.toFixed(1)} cm`;
    if (key === 'duration' && layer.repeatEvery) layer.repeatEvery = Math.max(layer.repeatEvery, layer.duration);
    if (key === 'weight') input.nextElementSibling!.textContent = `${Math.round(v * 100)}%`;
  }
  persist();
});
$('layers').addEventListener('change', () => render());
$('layers').onclick = event => {
  const target = event.target as HTMLElement, article = target.closest<HTMLElement>('[data-id]'); if (!article) return;
  const index = recipe.layers.findIndex(l => l.id === article.dataset.id), layer = recipe.layers[index];
  const act = target.closest<HTMLElement>('[data-action]')?.dataset.action;
  if (act === 'cut-tail') { if (time <= layer.start) { status('カードの開始より後に再生位置を合わせてください'); return; } layer.duration = Math.max(.1, Math.min(time, recipe.duration, layer.start + layer.duration) - layer.start); solo = null; status('この再生位置で区間の後ろをカットしました。ほかのカードの長さは変わりません。'); }
  if (act === 'append') { if (recipe.layers.length >= 32) return; const start = layer.start + layer.duration; if (start >= recipe.duration) { status('本編の長さを延ばすと、後ろに配置できます'); return; } const copy = { ...layer, id: crypto.randomUUID(), start, duration: Math.min(layer.duration, recipe.duration - start), repeatEvery: 0 }; recipe.layers.splice(index + 1, 0, copy); selected = copy.id; }
  if (act === 'trim-preview') { solo = { id: layer.id, frame: layer.from }; playing = false; syncPlay(); }
  if (act === 'trim-start' || act === 'trim-end') {
    const frame = solo?.id === layer.id ? solo.frame : layer.from;
    if (act === 'trim-start') layer.from = Math.min(frame, layer.to - 1); else layer.to = Math.max(layer.from + 1, Math.min(frame, engine.frames(layer.source)));
    layer.fade = 0;
  }
  if (act === 'trim-apply') { layer.duration = T.MathUtils.clamp((layer.to - layer.from) / 30 / layer.speed, .1, 60); layer.fade = 0; if (layer.repeatEvery) layer.repeatEvery = Math.max(layer.repeatEvery, layer.duration); solo = null; time = layer.start; status('選んだ範囲を適用しました。開始直後から切り出した姿勢になります。'); }
  if (act === 'trim-back') { solo = null; time = layer.start; }
  if (act === 'delete') recipe.layers.splice(index, 1);
  if (act === 'copy' && recipe.layers.length < 32) { const copy = { ...layer, id: crypto.randomUUID() }; recipe.layers.splice(index + 1, 0, copy); selected = copy.id; }
  if (act === 'up' && index > 0) [recipe.layers[index - 1], recipe.layers[index]] = [layer, recipe.layers[index - 1]];
  if (act === 'down' && index < recipe.layers.length - 1) [recipe.layers[index + 1], recipe.layers[index]] = [layer, recipe.layers[index + 1]];
  if (act === 'select') { selected = layer.id; if (closedDetails.has(layer.id)) closedDetails.delete(layer.id); else closedDetails.add(layer.id); }
  if (act) render();
};
document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button => button.onclick = () => void action(async () => {
  if (button.dataset.preset === 'metronome') {
    recipe.duration = 8; recipe.loop = true; recipe.transition = 0;
    recipe.layers = ['@lean-right', '@lean-left'].map((source, i) => ({ ...newLayer(source, engine, 2), start: i * 2, repeatEvery: 4, envelope: 'sine', poseMode: 'hold', fade: 0 }));
    selected = recipe.layers[0].id; solo = null; time = 0; render(); status('右0〜2秒、左2〜4秒を4秒周期で配置しました。滑らかに左右へ揺れます。'); return;
  }
  const names = button.dataset.preset === 'greet' ? ['Walking', 'Standing Greeting'] : button.dataset.preset === 'bow' ? ['Standing Idle', 'Quick Formal Bow'] : ['Standing Idle', '@hair', '@twist'];
  await Promise.all(names.map(name => engine.load(name)));
  recipe.layers = names.map(name => newLayer(name, engine, recipe.duration));
  recipe.layers[0].mask = button.dataset.preset === 'greet' ? '下半身' : '全身';
  recipe.layers[1].start = button.dataset.preset === 'greet' ? Math.min(2, recipe.duration - .1) : Math.min(1, recipe.duration - .1); recipe.layers[1].duration = button.dataset.preset === 'greet' ? Math.min(2, recipe.duration - recipe.layers[1].start) : Math.max(.1, recipe.duration - recipe.layers[1].start); recipe.layers[1].loop = false;
  if (recipe.layers[2]) recipe.layers[2].weight = .25;
  selected = recipe.layers[1].id; solo = null; time = 0; render(); status('プリセットを読み込みました。強さやタイミングを自由に調整できます。');
}));
$('duration').onchange = () => { const input = $<HTMLInputElement>('duration'); recipe.duration = T.MathUtils.clamp(Number(input.value) || 6, .5, 60); time = Math.min(time, totalDuration(recipe)); render(); };
$('fps').onchange = () => { recipe.fps = Number($<HTMLSelectElement>('fps').value); persist(); };
function syncPlay() { $('play').textContent = playing ? 'Ⅱ' : '▶'; $('play').setAttribute('aria-label', playing ? '一時停止' : '再生'); }
$('play').onclick = () => { solo = null; if (time >= totalDuration(recipe)) time = 0; playing = !playing; syncPlay(); };
$('global-loop').onchange = () => { recipe.loop = $<HTMLInputElement>('global-loop').checked; time = Math.min(time, totalDuration(recipe)); render(); };
$('transition').onchange = () => { recipe.transition = T.MathUtils.clamp(Number($<HTMLInputElement>('transition').value) || 0, 0, 10); time = Math.min(time, totalDuration(recipe)); render(); };
$('rewind').onclick = () => { solo = null; time = 0; };
$('seek').oninput = () => { solo = null; time = Number($<HTMLInputElement>('seek').value); };
$('save').onclick = () => download(JSON.stringify(bundle(), null, 2), 'motion-recipe.json', 'application/json');
$('import').onclick = () => { if (ready && !busy) $<HTMLInputElement>('file').click(); };
$('file').onchange = () => void action(async () => {
  const input = $<HTMLInputElement>('file'), file = input.files?.[0]; input.value = ''; if (!file) return;
  if (file.size > 25000000) throw new Error('レシピのファイルが大きすぎます');
  const data = JSON.parse(await file.text()); const assets = validateSaved(data.motions ?? []); const next = validateRecipe(data, new Set([...engine.custom.keys(), ...assets.map(m => m.id)]));
  await Promise.all([...new Set(next.layers.map(l => l.source))].filter(name => !name.startsWith('saved:')).map(name => engine.load(name)));
  for (const l of next.layers) { const asset = assets.find(m => m.id === l.source); if (l.to > (asset ? Math.floor(asset.duration * 30) : engine.frames(l.source))) throw new Error('元の終了フレームがモーションの範囲を超えています'); }
  for (const m of assets) engine.registerSaved(m);
  recipe = next; library(); solo = null; selected = recipe.layers[0]?.id ?? ''; time = 0; render(); status('レシピを開きました');
});
$('export').onclick = () => void action(async () => {
  status('全フレームを合成してFBXを書き出しています…'); await new Promise(resolve => requestAnimationFrame(resolve));
  const data = exportFBX(engine, recipe);
  const check = new FBXLoader().parse(data, '');
  if (!check.animations[0]?.tracks.length || Math.abs(check.animations[0].duration - totalDuration(recipe)) > 1 / recipe.fps) throw new Error('FBXの再読み込み検証に失敗しました');
  download(data, 'motion-mix.fbx', 'application/octet-stream'); status(`FBXを書き出しました · ${totalDuration(recipe)}秒 / ${recipe.fps}fps · 再読み込み確認済み`);
});

function placement(id: string) {
  const layer = recipe.layers.find(l => l.id === id)!;
  const intervals: number[] = [layer.start];
  if (layer.repeatEvery) for (let start = layer.start + layer.repeatEvery; start < recipe.duration && intervals.length < 600; start += layer.repeatEvery) intervals.push(start);
  const clips = intervals.map((start, index) => `<div class="clip ${index ? 'repeat-clip' : ''}" ${index ? '' : 'data-drag="move"'} style="left:${Math.min(100, start / recipe.duration * 100)}%;width:${Math.max(0, Math.min(layer.duration, recipe.duration - start) / recipe.duration * 100)}%">${index ? '' : '<span class="clip-handle left" data-drag="start" title="開始をドラッグ">❘</span>'}<span>${start.toFixed(1)} — ${Math.min(recipe.duration, start + layer.duration).toFixed(1)}秒</span>${index ? '' : '<span class="clip-handle right" data-drag="end" title="終了をドラッグ">❘</span>'}</div>`).join('');
  return `<div class="placement"><span>タイムラインで使う区間</span>${numeric('開始', 'start', layer.start, 0, Math.min(recipe.duration - .1, layer.start + layer.duration - .1), .1, '秒')}${numeric('終了', 'end', Number((layer.start + layer.duration).toFixed(3)), layer.start + .1, recipe.duration, .1, '秒')}<button data-action="cut-tail">再生位置で後ろをカット</button><button data-action="append">次に複製</button></div><div class="timeline" title="両端をドラッグで切り詰め、中央をドラッグで移動">${clips}</div><div class="repeat-settings"><label><input data-field="repeat-enabled" type="checkbox" ${layer.repeatEvery ? 'checked' : ''}>この区間を繰り返す</label>${layer.repeatEvery ? `${numeric('繰り返し周期', 'repeatEvery', layer.repeatEvery, layer.duration, 60, .1, '秒')}<select data-field="envelope" aria-label="区間の強さの変化"><option value="flat" ${layer.envelope !== 'sine' ? 'selected' : ''}>一定の強さ</option><option value="sine" ${layer.envelope === 'sine' ? 'selected' : ''}>山なりに変化（往復向き）</option></select>` : ''}</div>`;
}
let drag: { id: string; kind: string; x: number; width: number; start: number; end: number } | null = null;
$('layers').onpointerdown = event => {
  const target = event.target as HTMLElement, handle = target.closest<HTMLElement>('[data-drag]'), timeline = target.closest<HTMLElement>('.timeline');
  if (!timeline) return;
  const rect = timeline.getBoundingClientRect();
  if (!handle) { solo = null; time = T.MathUtils.clamp((event.clientX - rect.left) / rect.width * recipe.duration, 0, recipe.duration); return; }
  const id = handle.closest<HTMLElement>('[data-id]')!.dataset.id!, layer = recipe.layers.find(l => l.id === id)!;
  drag = { id, kind: handle.dataset.drag!, x: event.clientX, width: rect.width, start: layer.start, end: layer.start + layer.duration };
  $('layers').setPointerCapture(event.pointerId); event.preventDefault();
};
$('layers').onpointermove = event => {
  if (!drag) return;
  const layer = recipe.layers.find(l => l.id === drag!.id); if (!layer) return;
  const offset = Math.round((event.clientX - drag.x) / drag.width * recipe.duration * 10) / 10;
  if (drag.kind === 'end') layer.duration = T.MathUtils.clamp(drag.end + offset, drag.start + .1, recipe.duration) - drag.start;
  else if (drag.kind === 'start') { layer.start = T.MathUtils.clamp(drag.start + offset, 0, Math.min(recipe.duration - .1, drag.end - .1)); layer.duration = drag.end - layer.start; }
  else { layer.start = T.MathUtils.clamp(drag.start + offset, 0, Math.max(0, recipe.duration - (drag.end - drag.start))); }
  if (layer.repeatEvery) layer.repeatEvery = Math.max(layer.repeatEvery, layer.duration);
  solo = null; render(false);
};
$('layers').onpointerup = $('layers').onpointercancel = event => { if (!drag) return; drag = null; if ($('layers').hasPointerCapture(event.pointerId)) $('layers').releasePointerCapture(event.pointerId); render(); };

function trimControls(id: string) {
  const layer = recipe.layers.find(l => l.id === id)!;
  const frame = solo?.id === id ? solo.frame : layer.from;
  return `<div class="trim-panel"><div><b>✂ 動作のトリミング</b><span>${(layer.from / 30).toFixed(2)}秒 → ${(layer.to / 30).toFixed(2)}秒を使用</span></div><p>素材を見ながら切り出す位置を選べます。適用すると再生時間が範囲に合い、フェードは0になります。</p><div class="trim-scrub"><button data-action="trim-preview">素材を見る</button><input data-field="trim-frame" type="range" min="0" max="${engine.frames(layer.source)}" step="1" value="${frame}" aria-label="素材のフレーム"><output class="trim-position">${frame}f / ${(frame / 30).toFixed(2)}秒</output></div><div class="trim-actions"><button data-action="trim-start">このフレームから</button><button data-action="trim-end">このフレームまで</button><button data-action="trim-apply">範囲を適用</button><button data-action="trim-back">合成に戻る</button></div></div>`;
}
function openSave(id: string | null = null) {
  if (!ready || busy) return;
  renameId = id; $('save-title').textContent = id ? '動作の名前を変更' : '合成を動作として保存';
  $<HTMLInputElement>('motion-name').value = id ? engine.custom.get(id)!.name : '';
  $('save-error').textContent = ''; $<HTMLDialogElement>('save-dialog').showModal(); $<HTMLInputElement>('motion-name').focus();
}
$('add-library').onclick = () => openSave();
$('cancel-save').onclick = () => $<HTMLDialogElement>('save-dialog').close();
$('save-form').onsubmit = event => { event.preventDefault(); void action(async () => {
  const name = $<HTMLInputElement>('motion-name').value.trim(); if (!name) { $('save-error').textContent = '名前を入力してください'; return; }
  try {
    const motion: SavedMotion = renameId ? { ...engine.custom.get(renameId)!, name } : engine.bakeSaved(recipe, name);
    const next = [...engine.custom.values()].filter(m => m.id !== motion.id); next.push(motion);
    if (next.length > 80) throw new Error('保存動作は80個までです');
    localStorage.setItem('motion-mixer-library-v1', JSON.stringify(next));
    engine.registerSaved(motion); persist(); library(); render(); $<HTMLDialogElement>('save-dialog').close(); status(`「${name}」を動作ライブラリに保存しました`);
  } catch (error) { $('save-error').textContent = error instanceof DOMException && error.name === 'QuotaExceededError' ? '保存容量が不足しています。不要な保存動作を削除してください。' : error instanceof Error ? error.message : String(error); }
}); };

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
function syncVRMPose() {
  if (!vrm) return;
  for (const [name, r] of engine.rest) {
    const target = vrm.humanoid.getNormalizedBoneNode(boneMap[name] as VRMHumanBoneName); if (!target) continue;
    target.quaternion.copy(r.node.quaternion).premultiply(r.parentWorld).multiply(r.world.clone().invert());
    if (vrm.meta.metaVersion === '0') { target.quaternion.x *= -1; target.quaternion.z *= -1; }
    if (name === 'Hips') { const ratio = hipsHeight / r.p.y, sign = vrm.meta.metaVersion === '0' ? -1 : 1; target.position.set(r.node.position.x * ratio * sign, r.node.position.y * ratio, r.node.position.z * ratio * sign); }
  }
  vrm.humanoid.getNormalizedBoneNode('hips')!.updateWorldMatrix(true, true);
}
function poseVRM(delta: number) { syncVRMPose(); vrm?.update(delta); }
async function init() {
  await engine.init();
  const skeletonGroup = new T.Group(); skeletonGroup.scale.setScalar(.01); scene.add(skeletonGroup);
  const bones = engine.root.children.filter(n => (n as T.Bone).isBone); for (const bone of bones) skeletonGroup.add(bone);
  helper = new T.SkeletonHelper(skeletonGroup); scene.add(helper); helper.visible = true;
  let restored = false;
  try {
    const libraryData = localStorage.getItem('motion-mixer-library-v1'); if (libraryData) for (const m of validateSaved(JSON.parse(libraryData))) engine.registerSaved(m);
    const saved = localStorage.getItem('motion-mixer-v1'); if (saved) {
      const data = JSON.parse(saved); for (const m of validateSaved(data.motions ?? [])) engine.registerSaved(m);
      const next = validateRecipe(data, new Set(engine.custom.keys())); await Promise.all([...new Set(next.layers.map(l => l.source))].map(name => engine.load(name))); recipe = next; restored = true;
    }
  } catch { status('保存レシピを復元できなかったため、新規で開始します'); }
  if (!restored && !recipe.layers.length) { await engine.load('Walking'); recipe.layers = [newLayer('Walking', engine, 6)]; }
  selected = recipe.layers[0]?.id ?? ''; ready = true; library(); render(); $('play').removeAttribute('disabled'); $('export').removeAttribute('disabled'); status('動作を追加して、オリジナルのモーションを作りましょう');
  try {
    const loader = new GLTFLoader(); loader.register(parser => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/girl.vrm`); vrm = gltf.userData.vrm as VRM; VRMUtils.rotateVRM0(vrm); scene.add(vrm.scene);
    hipsHeight = vrm.humanoid.getNormalizedBoneNode('hips')!.position.y;
    const soleHeight = () => Math.min(...(['rightFoot', 'leftFoot', 'rightToes', 'leftToes'] as VRMHumanBoneName[]).map(name => vrm!.humanoid.getNormalizedBoneNode(name)?.getWorldPosition(new T.Vector3()).y ?? Infinity));
    engine.sample({ version: 1, duration: 6, fps: 30, layers: [] }, 0); syncVRMPose(); const ground = soleHeight();
    engine.groundAdjustment = () => { syncVRMPose(); return (ground - soleHeight()) * engine.rest.get('Hips')!.p.y / hipsHeight; };
 helper.visible = $<HTMLInputElement>('skeleton').checked; $('model-state').textContent = 'VRMプレビュー';
  } catch { $('model-state').textContent = '骨格プレビュー'; status('VRMを読み込めませんでした。骨格で編集・FBX出力できます。'); }
}
$('skeleton').onchange = () => { if (helper) helper.visible = $<HTMLInputElement>('skeleton').checked || !vrm; if (vrm) vrm.scene.visible = !$<HTMLInputElement>('skeleton').checked; };
let previous = performance.now();
function tick(now: number) { requestAnimationFrame(tick); const delta = Math.min((now - previous) / 1000, .05); previous = now;
  if (ready) {
    const total = totalDuration(recipe);
    if (playing) { time += delta; if (time > total) { if (recipe.loop) time %= total; else { time = total; playing = false; syncPlay(); } } }
    const layer = solo && recipe.layers.find(l => l.id === solo!.id);
    if (layer && solo) {
      engine.sample({ version: 1, duration: engine.frames(layer.source) / 30, fps: 30, layers: [{ ...layer, start: 0, from: 0, to: engine.frames(layer.source), duration: engine.frames(layer.source) / 30, fade: 0, weight: 1, speed: 1, loop: false, enabled: true, repeatEvery: 0, envelope: 'flat', poseMode: 'motion' }] }, solo.frame / 30);
      $('model-state').textContent = `素材プレビュー · ${solo.frame}f / ${(solo.frame / 30).toFixed(2)}秒`;
    } else { engine.sample(recipe, time); $('model-state').textContent = time > recipe.duration ? '最初の姿勢へ接続中' : vrm ? 'VRMプレビュー' : '骨格プレビュー'; }
    poseVRM(delta); $<HTMLInputElement>('seek').value = String(time); $('time').textContent = `${time.toFixed(2)} / ${total.toFixed(2)} s`;
  }
  controls.update(); renderer.render(scene, camera);
}
requestAnimationFrame(tick); void init().catch(e => status(`初期化エラー: ${e.message}。ページを再読み込みしてください。`));
// Expose the composition for reproducible export/preview integration checks.
(window as unknown as { motionMixer: unknown }).motionMixer = { engine, get recipe() { return recipe; }, get vrm() { return vrm; }, syncPose: () => poseVRM(0), exportFBX: () => exportFBX(engine, recipe) };
