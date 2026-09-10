const $ = (id) => document.getElementById(id);
let resetParams;
let token, connected = false, busy = false, before = false, angle = 0, zoom = 1;
const placementDefaults = { eye_x: 0, eye_z: 0, eye_width: 1, eye_height: 1, iris_x: 0, iris_z: 0, iris_width: 1, iris_height: 1 };
const browDefaults = { brow_x: 0, brow_z: 0, brow_peak: 0, brow_curve: 0 };
const contourDefaults = { jaw_roundness: 0, face_slim: 0 };
const sliders = ['flatness', 'length', 'thickness', 'corner_ratio', 'corner_angle', ...Object.keys(contourDefaults), 'upper_peak', 'blink', ...Object.keys(placementDefaults), ...Object.keys(browDefaults)];
const session = fetch('/api/session').then(r => r.json()).then(r => { token = r.token; });

async function api(path, data = {}) {
  await session;
  const response = await fetch(`/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Eye-Token': token }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '通信に失敗しました。');
  return result;
}
function message(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function lock(value) {
  busy = value;
  document.querySelectorAll('button,input,select').forEach(e => { e.disabled = value || (!connected && e.id !== 'connect'); });
  $('canvas').classList.toggle('busy', value);
}
async function run(action) {
  if (busy) return;
  lock(true);
  try { await action(); } catch (e) { message(e.message, true); } finally { lock(false); }
}
function values() { return { ...Object.fromEntries(sliders.map(id => [id, Number($(id).value) / 100])), expression: $('expression').value }; }
function labels() {
  for (const id of sliders) $(id + '-value').textContent = id === 'thickness' ? (Number($(id).value) / 100).toFixed(2) : $(id).value + '%';
  const tilt = Number($('corner_angle').value);
  $('corner_angle-value').textContent = tilt === 0 ? '元の角度' : `${(tilt * .35).toFixed(1)}°`;
  const peak = Number($('upper_peak').value);
  $('upper_peak-value').textContent = peak === 0 ? '元の位置' : `${peak < 0 ? '目頭' : '目尻'} ${Math.abs(peak)}%`;
  for (const id of ['eye_x', 'eye_z', 'iris_x', 'iris_z', 'brow_x', 'brow_z', 'brow_peak', 'brow_curve']) {
    const value = Number($(id).value);
    const direction = (id.endsWith('_x') || id === 'brow_peak') ? (value < 0 ? '内側' : '外側') : (value < 0 ? '下' : '上');
    $(id + '-value').textContent = value === 0 ? (id === 'brow_curve' ? '元の形' : '元の位置') : `${direction} ${Math.abs(value)}%`;
  }
}
function synchronize(params) {
  for (const id of sliders) $(id).value = Math.round(params[id] * 100);
  before = params.before;
  $('expression').value = params.expression || 'none';
  $('compare').textContent = before ? '編集中の顔に戻る' : '変更前を見る';
  $('compare').setAttribute('aria-pressed', String(before));
  $('preview-label').textContent = before ? 'BEFORE / 元の顔' : 'AFTER / 調整中';
  labels();
}
async function screenshot() {
  const result = await api('screenshot');
  const img = new Image();
  img.src = 'data:image/png;base64,' + result.image;
  await img.decode();
  $('preview').src = img.src;
  $('preview').hidden = false;
  $('empty').hidden = true;
}
async function apply(params = values()) {
  message('目もとを調整しています…');
  const result = await api('update', { ...params, before: false });
  synchronize(result.params);
  await screenshot();
  message('反映しました。正面・斜めからの見え方も確認できます。');
}
$('connect').onclick = () => run(async () => {
  message('モデルの目の縁を読み取っています…');
  const result = await api('connect');
  connected = true;
  resetParams = result.reset_params;
  const expressionLabels = { happy: 'happy / 喜び', angry: 'angry / 怒り', sad: 'sad / 悲しみ', relaxed: 'relaxed / リラックス', surprised: 'surprised / 驚き', aa: 'aa / あ', ih: 'ih / い', ou: 'ou / う', ee: 'ee / え', oh: 'oh / お' };
  $('expression').replaceChildren(new Option('通常の顔', 'none'));
  for (const name of result.expression_names || []) {
    if (!name.startsWith('blink') && !name.startsWith('look')) $('expression').add(new Option(expressionLabels[name] || name, name));
  }
  synchronize(result.params);
  $('connection').textContent = result.model + ' に接続中';
  $('dot').classList.add('live');
  await api('view', { angle, zoom });
  await screenshot();
  message(result.rebased ? '出力済みVRMに接続しました。現在の顔を基準に続けて編集できます。' : '接続しました。スライダーを動かして、目もとを調整してください。');
});
for (const id of sliders) {
  $(id).oninput = labels;
  $(id).onchange = () => run(() => apply());
}
$('expression').onchange = () => run(() => apply());
$('suggest').onclick = () => run(() => apply({ flatness: .85, length: .85, thickness: .7, corner_ratio: .15, upper_peak: .5, blink: 0, expression: 'none' }));
$('reset').onclick = () => run(() => apply(resetParams || { flatness: 0, length: 0, thickness: .45, corner_ratio: .18, corner_angle: 0, ...contourDefaults, upper_peak: 0, blink: 0, expression: 'none', ...placementDefaults, ...browDefaults }));
$('reset-contour').onclick = () => run(() => apply(contourDefaults));
$('suggest-contour').onclick = () => run(() => apply({ jaw_roundness: .65, face_slim: .35 }));
$('reset-brow').onclick = () => run(() => apply(browDefaults));
$('reset-eye').onclick = () => run(() => apply(Object.fromEntries(Object.entries(placementDefaults).filter(([k]) => k.startsWith('eye_')))));
$('reset-iris').onclick = () => run(() => apply(Object.fromEntries(Object.entries(placementDefaults).filter(([k]) => k.startsWith('iris_')))));
$('compare').onclick = () => run(async () => {
  const result = await api('update', { before: !before });
  synchronize(result.params);
  await screenshot();
  message(before ? '変更前の顔を表示中です（まばたき確認は調整後の顔に適用されます）。' : '調整後の顔を表示しています。');
});
document.querySelectorAll('[data-angle]').forEach(button => { button.onclick = () => run(async () => {
  angle = Number(button.dataset.angle);
  await api('view', { angle, zoom });
  await screenshot();
  document.querySelectorAll('[data-angle]').forEach(b => b.classList.toggle('selected', b === button));
}); });
$('zoom').onclick = () => run(async () => {
  zoom = zoom === 1 ? 1.65 : 1;
  await api('view', { angle, zoom });
  await screenshot();
  $('zoom').textContent = zoom === 1 ? '拡大' : '全体';
});
$('refresh').onclick = () => run(screenshot);
$('save').onclick = () => run(async () => {
  message('モデルを別ファイルに保存しています…');
  const result = await api('save');
  message('保存しました：' + result.path);
});
$('export').onclick = () => run(async () => {
  message('VRMを書き出し、表情の接続を検証しています…');
  const result = await api('export');
  message(`VRMを保存しました（表情バインド ${result.validation.bindings} 件を検証）：${result.path}`);
});
$('export-settings').onclick = () => run(async () => {
  const settings = await api('settings/export');
  const blob = new Blob([JSON.stringify(settings, null, 2) + '\n'], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `eye-atelier-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  message('設定JSONのダウンロードを開始しました。別のモデルへの再適用に使えます。');
});
$('import-settings').onclick = () => { $('settings-file').value = ''; $('settings-file').click(); };
$('settings-file').onchange = () => run(async () => {
  const file = $('settings-file').files[0];
  if (!file) return;
  if (file.size > 8192) throw new Error('設定ファイルは8KB以下のJSONを選んでください。');
  let document;
  try { document = JSON.parse(await file.text()); }
  catch { throw new Error('JSONを読み取れませんでした。設定は変更していません。'); }
  message('設定を検証してモデルに適用しています…');
  const result = await api('settings/import', document);
  synchronize(result.params);
  await screenshot();
  message(`「${file.name}」を適用しました。新しいモデルの顔立ちに合わせて見た目を確認してください。`);
});
