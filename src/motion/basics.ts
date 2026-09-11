export interface BasicPose {
  label: string; mask: string;
  rotations?: [string, number, number, number][];
  reach?: { side: 'Right' | 'Left'; anchor: string; offset: [number, number, number]; contact?: 'head' | 'front' | 'hip' };
  shoulder?: { side?: 'Right' | 'Left'; elevation: number; forward: number; circle?: boolean };
  wrist?: { side: 'Right' | 'Left'; x: number; y: number; z: number; circle?: boolean };
  leg?: { side?: 'Right' | 'Left'; offset?: [number, number, number]; squat?: number; float?: number };
  fingers?: { side: 'Right' | 'Left'; open: string[] };
}
export const basics: Record<string, BasicPose> = {};
for (const [id, label, x, y, z] of [
  ['look-down', '首を下に向ける', .55, 0, 0], ['look-up', '首を上に向ける', -.45, 0, 0],
  ['look-left', '首を左に向ける', 0, .7, 0], ['look-right', '首を右に向ける', 0, -.7, 0],
  ['tilt-left', '首を左に傾ける', 0, 0, -.4], ['tilt-right', '首を右に傾ける', 0, 0, .4],
] as const) basics[`@${id}`] = { label, mask: '頭', rotations: [['Neck', x * .4, y * .4, z * .4], ['Head', x * .6, y * .6, z * .6]] };
for (const [id, label, x, y, z] of [
  ['lean-back', '上体を反らす', -.35, 0, 0], ['lean-left', '上体を左に倒す', 0, 0, -.35],
  ['lean-right', '上体を右に倒す', 0, 0, .35], ['twist-left', '上体を左に捻る', 0, .65, 0],
  ['twist-right', '上体を右に捻る', 0, -.65, 0], ['small-bow', '軽く会釈する', .3, 0, 0],
] as const) basics[`@${id}`] = { label, mask: '体幹', rotations: [['Spine', x * .5, y * .5, z * .5], ['Spine1', x * .5, y * .5, z * .5]] };
for (const side of ['Right', 'Left'] as const) {
  const sign = side === 'Right' ? -1 : 1, ja = side === 'Right' ? '右' : '左', mask = `${ja}腕`;
  for (const [id, label, anchor, offset] of [
    ['forward', '腕を前に突き出す', `${side}Arm`, [sign * 6, -2, 58]],
    ['up', '腕を上に伸ばす', `${side}Arm`, [sign * 8, 60, 1]],
    ['side', '腕を横に伸ばす', `${side}Arm`, [sign * 60, 0, 0]],
    ['diagonal', '腕を斜め上に伸ばす', `${side}Arm`, [sign * 40, 40, 8]],
    ['mouth', '手を口元に寄せる', 'Head', [sign * 3, -10, 24]],
    ['cheek', '手を頬に添える', 'Head', [sign * 18, -5, 8]],
    ['chest', '手を胸に当てる', 'Spine2', [sign * 12, 0, 22]],
    ['hip', '手を腰に当てる', 'Hips', [sign * 24, 12, 2]],
    ['offer', '手を前に差し出す', `${side}Arm`, [sign * 12, -20, 35]],
  ] as [string, string, string, [number, number, number]][]) basics[`@${side.toLowerCase()}-${id}`] = { label: `${ja}${label}`, mask, reach: { side, anchor, offset, contact: id === 'cheek' ? 'head' : id === 'hip' ? 'hip' : id === 'chest' || id === 'mouth' ? 'front' : undefined } };
  for (const [id, label, open] of [
    ['index', '人差し指を立てる', ['Index']], ['peace', 'ピースをする', ['Index', 'Middle']],
    ['thumb', '親指を立てる', ['Thumb']], ['fist', '握りこぶしにする', []],
    ['open', '手を開く', ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']], ['three', '指を3本立てる', ['Index', 'Middle', 'Ring']],
  ] as [string, string, string[]][]) basics[`@${side.toLowerCase()}-${id}`] = { label: `${ja}手：${label}`, mask: `${ja}手`, fingers: { side, open } };
}

for (const side of ['Right', 'Left'] as const) {
  const ja = side === 'Right' ? '右' : '左', sign = side === 'Right' ? -1 : 1;
  for (const [id, label, x, y, z] of [
    ['bend', '手首を内側に曲げる', .7, 0, 0], ['extend', '手首を反らす', -.65, 0, 0],
    ['turn-in', '手のひらを内向きに回す', 0, .9 * sign, 0], ['turn-out', '手のひらを外向きに回す', 0, -.9 * sign, 0],
    ['tilt-in', '手首を小指側に倒す', 0, 0, .4], ['tilt-out', '手首を親指側に倒す', 0, 0, -.35],
    ['circle', '手首を回す', 0, 0, 0],
  ] as [string, string, number, number, number][]) basics[`@${side.toLowerCase()}-wrist-${id}`] = { label: `${ja}${label}`, mask: `${ja}手首`, wrist: { side, x, y, z, circle: id === 'circle' } };
  for (const [id, label, offset] of [
    ['knee-up', '膝を上げる', [0, 26, 13]], ['heel-back', '膝を曲げて踵を後ろへ', [0, 22, -22]],
    ['step-forward', '足を一歩前に出す', [0, 0, 22]], ['step-side', '足を横に開く', [sign * 20, 0, 0]],
  ] as [string, string, [number, number, number]][]) basics[`@${side.toLowerCase()}-${id}`] = { label: `${ja}${label}`, mask: `${ja}脚`, leg: { side, offset } };
}
basics['@crouch'] = { label: '両膝を曲げてしゃがむ', mask: '下半身', leg: { squat: 22 } };
basics['@small-crouch'] = { label: '膝を軽くゆるめる', mask: '下半身', leg: { squat: 8 } };
basics['@float'] = { label: '宙に浮かぶ', mask: '全身', leg: { float: 25 } };


for (const side of ['Right', 'Left', 'Both'] as const) {
  const ja = side === 'Right' ? '右肩' : side === 'Left' ? '左肩' : '両肩';
  for (const [id, label, elevation, forward] of [
    ['up', 'を上げる（すくめる）', .35, 0], ['down', 'を下げる', -.2, 0],
    ['forward', 'を前に出す', 0, .3], ['back', 'を後ろに引く', 0, -.3],
    ['circle', 'を回す', 0, 0],
  ] as [string, string, number, number][]) basics[`@${side.toLowerCase()}-shoulder-${id}`] = {
    label: ja + label, mask: ja, shoulder: { side: side === 'Both' ? undefined : side, elevation, forward, circle: id === 'circle' },
  };
}
