/** 録音の RMS から口の開きを決める共通基準。再生音量・ミュートには依存しない。 */
export const VOICE_SILENCE_RMS = 0.003;
/** 既存ボイスの有声区間の上位音量を基準にする。ファイルごとの最大値では正規化しない。 */
export const VOICE_REFERENCE_RMS = 0.28;
export const WHISPER_MOUTH_SCALE = 0.4;
/** WASM 側でも柔らかい声を抑えているため、ASMR の追加補正は動きが見える程度に留める。 */
export const ASMR_MOUTH_SCALE = 0.65;

/** asmr_ で始まるファイルは囁き声。既存のカット指定と重なっても二重に縮めない。 */
export function getVoiceMouthScale(url?: string | null, whisper = false): number {
  let filename = url?.split(/[?#]/, 1)[0]?.split('/').pop() ?? '';
  try { filename = decodeURIComponent(filename); } catch { /* 未エンコードのファイル名を使う */ }
  if (filename.toLowerCase().startsWith('asmr_')) return ASMR_MOUTH_SCALE;
  return whisper ? WHISPER_MOUTH_SCALE : 1;
}

/** 時間ベースの平滑化で、描画のフレームレートにかかわらず素早く開き、滑らかに閉じる。 */
export class VoiceMouthEnvelope {
  private value = 0;
  private previousTime: number | undefined;

  update(rms: number, timeSeconds: number): number {
    const level = Number.isFinite(rms) ? Math.max(0, rms) : 0;
    const target = Math.min(1, Math.max(0, (level - VOICE_SILENCE_RMS) / (VOICE_REFERENCE_RMS - VOICE_SILENCE_RMS)));
    const elapsed = this.previousTime === undefined ? 1 / 60 : Math.max(0, timeSeconds - this.previousTime);
    this.previousTime = timeSeconds;
    const duration = target > this.value ? 0.025 : 0.08;
    this.value += (target - this.value) * (1 - Math.exp(-elapsed / duration));
    if (this.value < 0.001) this.value = 0;
    return this.value;
  }

  reset(): void {
    this.value = 0;
    this.previousTime = undefined;
  }
}
