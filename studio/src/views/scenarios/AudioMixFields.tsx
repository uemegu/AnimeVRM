import type { AudioPan } from '@anime-vrm/scenario';
import { useI18n } from '../../i18n';

const PANS: AudioPan[] = ['stereo', 'left', 'right'];

interface Props {
  /** このカットで指定した値（未指定なら undefined） */
  volume: number | undefined;
  pan: AudioPan | undefined;
  /** 未指定のときに効く値（BGM なら前のカットから引き継いだ値） */
  fallback: { volume: number; pan: AudioPan };
  /** 指定を消すボタンの文言 */
  clearLabel: string;
  onChange: (volume: number | undefined, pan: AudioPan | undefined) => void;
}

/** 音量の倍率とチャネル（ステレオ・左・右）。既定のままなら項目を書かない */
export function AudioMixFields({ volume, pan, fallback, clearLabel, onChange }: Props) {
  const { t } = useI18n();
  const ts = t.scenarios;
  const shownVolume = volume ?? fallback.volume;
  const shownPan = pan ?? fallback.pan;
  const specified = volume !== undefined || pan !== undefined;
  return (
    <div className={`audio-mix${specified ? '' : ' unset'}`}>
      <span className="audio-mix-label">{ts.volume}</span>
      <input type="range" min={0} max={1} step={0.05} value={shownVolume} onChange={(e) => onChange(Number(e.target.value), pan)} />
      <span className="audio-mix-value">{Math.round(shownVolume * 100)}%</span>
      <span className="audio-mix-label">{ts.pan}</span>
      <div className="audio-mix-pan" role="radiogroup">
        {PANS.map((p) => (
          <button key={p} type="button" role="radio" aria-checked={shownPan === p} className={shownPan === p ? 'active' : ''} onClick={() => onChange(volume, p)}>
            {ts.pans[p]}
          </button>
        ))}
      </div>
      <button type="button" className="audio-mix-clear" disabled={!specified} onClick={() => onChange(undefined, undefined)}>
        {clearLabel}
      </button>
    </div>
  );
}
