import { EffectTextPreset, SweatMode, type SceneAvatarConfig } from '@anime-vrm/scenario';
import { useI18n } from '../../i18n';
import { textJa } from './scenarioEdit';

/** 演出の項目（カットのキャラ指定とタイムラインのキーで共通） */
export type EffectValues = Pick<SceneAvatarConfig, 'blush' | 'redface' | 'tearyEyes' | 'awawaMouth' | 'anger' | 'tears' | 'fastMotion' | 'eyeWander' | 'motionSpeed' | 'effectText' | 'sweat'>;
type Key = keyof EffectValues;

const TOGGLES = ['blush', 'redface', 'tearyEyes', 'awawaMouth', 'anger', 'tears', 'fastMotion'] as const;
const WANDER_LEVELS = [0, 0.6, 1, 1.6] as const;

interface Props {
  value: EffectValues;
  /** 未指定のときの選択肢の文言（カットでは引き継ぐ値、キーでは「変えない」） */
  unsetLabel: (key: Key) => string;
  onChange: (key: Key, value: EffectValues[Key] | undefined) => void;
  /** 高速アクション（カットでだけ指定できる） */
  withFastMotion?: boolean;
}

/**
 * 感情演出の入力欄（頬赤・赤面・涙目・あわあわ口・怒りマーク・涙・残像・目が泳ぐ・モーション速度・文字演出・汗）。
 * 置いた先のグリッドにそのまま並ぶよう、欄だけを返す
 */
export function EffectFields({ value, unsetLabel, onChange, withFastMotion = false }: Props) {
  const { t } = useI18n();
  const fx = t.scenarios.effects;
  const text = value.effectText;
  const preset = text === undefined ? '' : typeof text === 'string' ? text : text.preset;
  const customText = text !== undefined && typeof text !== 'string' ? textJa(text.text) : '';
  const wander = value.eyeWander === undefined ? '' : String(value.eyeWander === true ? 1 : value.eyeWander === false ? 0 : value.eyeWander);

  const setText = (nextPreset: string, nextText: string) => {
    if (!nextPreset) return onChange('effectText', undefined);
    const p = nextPreset as EffectTextPreset;
    // 英語の文字があれば残す
    const en = text !== undefined && typeof text !== 'string' && typeof text.text === 'object' ? text.text.en : undefined;
    const duration = text !== undefined && typeof text !== 'string' ? text.duration : undefined;
    if (!nextText && duration === undefined) return onChange('effectText', p);
    onChange('effectText', {
      preset: p,
      ...(nextText ? { text: en ? { ja: nextText, en } : nextText } : {}),
      ...(duration !== undefined ? { duration } : {}),
    });
  };

  return (
    <>
      {TOGGLES.filter((key) => withFastMotion || key !== 'fastMotion').map((key) => (
        <label key={key} className="field">
          <span className="field-label">{fx[key]}</span>
          <select
            className="select"
            value={value[key] === undefined ? '' : value[key] ? 'on' : 'off'}
            onChange={(e) => onChange(key, e.target.value === '' ? undefined : e.target.value === 'on')}
          >
            <option value="">{unsetLabel(key)}</option>
            <option value="on">{fx.on}</option>
            <option value="off">{fx.off}</option>
          </select>
        </label>
      ))}
      <label className="field">
        <span className="field-label">{fx.eyeWander}</span>
        <select className="select" value={wander} onChange={(e) => onChange('eyeWander', e.target.value === '' ? undefined : Number(e.target.value))}>
          <option value="">{unsetLabel('eyeWander')}</option>
          {WANDER_LEVELS.map((level) => (
            <option key={level} value={String(level)}>
              {fx.wanderLevels[level]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">{fx.motionSpeed}</span>
        <input
          className="input"
          type="number"
          min={0.1}
          max={4}
          step={0.1}
          value={value.motionSpeed ?? ''}
          placeholder={unsetLabel('motionSpeed')}
          onChange={(e) => onChange('motionSpeed', e.target.value === '' ? undefined : Math.max(0.1, Number(e.target.value)))}
        />
      </label>
      <label className="field">
        <span className="field-label">{fx.effectText}</span>
        <select className="select" value={preset} onChange={(e) => setText(e.target.value, customText)}>
          <option value="">{fx.nothing}</option>
          {EffectTextPreset.options.map((p) => (
            <option key={p} value={p}>
              {fx.presets[p]}
            </option>
          ))}
        </select>
      </label>
      {preset && (
        <label className="field">
          <span className="field-label">{fx.customText}</span>
          <input className="input" value={customText} placeholder={fx.presets[preset as EffectTextPreset]} onChange={(e) => setText(preset, e.target.value)} />
        </label>
      )}
      <label className="field">
        <span className="field-label">{fx.sweat}</span>
        <select className="select" value={value.sweat ?? ''} onChange={(e) => onChange('sweat', (e.target.value || undefined) as SweatMode | undefined)}>
          <option value="">{fx.nothing}</option>
          {SweatMode.options.map((mode) => (
            <option key={mode} value={mode}>
              {fx.sweatModes[mode]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
