import { CAMERA_MOVE_DEFAULT_SEC, CameraMoveType, type CameraMove } from '@anime-vrm/scenario';
import { useI18n } from '../i18n';

const STOP = '__stop__';

interface Props {
  value: CameraMove | false | undefined;
  /** キーでは「止める」も選べる */
  allowStop?: boolean;
  onChange: (value: CameraMove | false | undefined) => void;
}

/** カメラの動き（種類・秒数・大きさ）。秒数・大きさが既定のままなら種類だけを書く */
export function CameraMoveFields({ value, allowStop = false, onChange }: Props) {
  const { t } = useI18n();
  const spec = value === false || value === undefined ? null : typeof value === 'string' ? { type: value } : value;
  const write = (type: CameraMoveType, duration?: number, amount?: number) =>
    onChange(duration === undefined && amount === undefined ? type : { type, ...(duration !== undefined && { duration }), ...(amount !== undefined && { amount }) });
  const number = (text: string) => (text === '' ? undefined : Number(text));

  return (
    <div className="field">
      <span className="field-label">{t.scenarios.cameraMove}</span>
      <select
        className="select"
        value={value === false ? STOP : (spec?.type ?? '')}
        onChange={(e) => {
          const v = e.target.value;
          if (v === STOP) onChange(false);
          else if (!v) onChange(undefined);
          else write(v as CameraMoveType, spec?.duration, spec?.amount);
        }}
      >
        <option value="">{t.scenarios.cameraMoveNone}</option>
        {allowStop && <option value={STOP}>{t.scenarios.cameraMoveStop}</option>}
        {CameraMoveType.options.map((type) => (
          <option key={type} value={type}>
            {t.scenarios.cameraMoves[type]}
          </option>
        ))}
      </select>
      {spec && (
        <span className="camera-shot-row">
          {spec.type !== 'handheld' && (
            <label className="field key-at">
              <span className="field-label">{t.scenarios.cameraMoveDuration}</span>
              <input
                className="input"
                type="number"
                min={0.1}
                step={0.1}
                value={spec.duration ?? ''}
                placeholder={String(CAMERA_MOVE_DEFAULT_SEC[spec.type])}
                onChange={(e) => write(spec.type, number(e.target.value), spec.amount)}
              />
            </label>
          )}
          <label className="field key-at">
            <span className="field-label">{t.scenarios.cameraMoveAmount}</span>
            <input
              className="input"
              type="number"
              min={0.1}
              max={3}
              step={0.1}
              value={spec.amount ?? ''}
              placeholder="1"
              onChange={(e) => write(spec.type, spec.duration, number(e.target.value))}
            />
          </label>
        </span>
      )}
    </div>
  );
}
