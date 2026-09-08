const $ = (id) => document.getElementById(id);
let token, connected = false, busy = false, before = false, angle = 0, zoom = 1;
const sliders = ['flatness', 'length', 'thickness', 'blink'];
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
  document.querySelectorAll('button,input').forEach(e => { e.disabled = value || (!connected && e.id !== 'connect'); });
  $('canvas').classList.toggle('busy', value);
}
async function run(action) {
  if (busy) return;
  lock(true);
  try { await action(); } catch (e) { message(e.message, true); } finally { lock(false); }
}
function values() { return Object.fromEntries(sliders.map(id => [id, Number($(id).value) / 100])); }
function labels() {
  for (const id of sliders) $(id + '-value').textContent = id === 'thickness' ? (Number($(id).value) / 100).toFixed(2) : $(id).value + '%';
}
function synchronize(params) {
  for (const id of sliders) $(id).value = Math.round(params[id] * 100);
  before = params.before;
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
  synchronize(result.params);
  $('connection').textContent = result.model + ' に接続中';
  $('dot').classList.add('live');
  await api('view', { angle, zoom });
  await screenshot();
  message('接続しました。スライダーを動かして、目もとを調整してください。');
});
for (const id of sliders) {
  $(id).oninput = labels;
  $(id).onchange = () => run(() => apply());
}
$('suggest').onclick = () => run(() => apply({ flatness: .85, length: .85, thickness: .55, blink: 0 }));
$('reset').onclick = () => run(() => apply({ flatness: 0, length: 0, thickness: .45, blink: 0 }));
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
