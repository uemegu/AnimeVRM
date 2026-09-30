import type { ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n';
import './cameraAdjust.css';

interface ToggleProps {
  active: boolean;
  onToggle: (active: boolean) => void;
}

/** プレビュー右上の「カメラを調整」ボタン。親はプレビューの枠（position: relative） */
export function CameraAdjustToggle({ active, onToggle }: ToggleProps) {
  const { t } = useI18n();
  return (
    <button type="button" className={`camera-adjust-toggle${active ? ' active' : ''}`} aria-pressed={active} onClick={() => onToggle(!active)}>
      <Icon name="camera" size={14} />
      {active ? t.cameraAdjust.finish : t.cameraAdjust.start}
    </button>
  );
}

interface Props extends ToggleProps {
  /** 操作の説明 */
  hint: string;
  /** 今の値（見出しと値の組） */
  readout?: Array<[string, string]>;
  /** 反映・戻すなどのボタン */
  children?: ReactNode;
}

/**
 * プレビューの上に重ねる、カメラ調整の切り替えボタンと操作パネル。親はプレビューの枠（position: relative）
 */
export function CameraAdjust({ active, onToggle, hint, readout, children }: Props) {
  return (
    <>
      <CameraAdjustToggle active={active} onToggle={onToggle} />
      {active && (
        <div className="camera-adjust-panel">
          <p className="camera-adjust-hint">{hint}</p>
          {readout && readout.length > 0 && (
            <dl className="camera-adjust-readout">
              {readout.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {children && <div className="camera-adjust-actions">{children}</div>}
        </div>
      )}
    </>
  );
}
