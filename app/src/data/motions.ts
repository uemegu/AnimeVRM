/**
 * モーション（public/animations/<名前>.fbx）の再生方法
 * 待機・歩行など、繰り返して自然なものだけループする。身振りは1回再生して待機モーションに戻る
 */
export const LOOPING_MOTIONS = new Set([
  'Standing Idle',
  'Idle',
  'Walking',
  'Jogging',
  'chin_rest',
  'clasp_hands_front',
  'mob_chat_gesture',
  'mob_listen_nod',
  'ardy_pray',
  'ardy_shiver',
  'ardy_fan',
  'ardy_shy_cover',
]);
