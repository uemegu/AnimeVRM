import type { CameraShift } from '@anime-vrm/scenario';
import { useI18n } from '../i18n';
import './ShiftPicker.css';

/** 3x3 の並び（null が真ん中） */
const CELLS: (CameraShift | null)[] = ['up_left', 'up', 'up_right', 'left', null, 'right', 'down_left', 'down', 'down_right'];

interface Props {
  value: CameraShift | null | undefined;
  onChange: (shift: CameraShift | null) => void;
}

/** 構図からカメラをずらす位置を 3x3 の升目から選ぶ（真ん中がずらさない） */
export function ShiftPicker({ value, onChange }: Props) {
  const { t } = useI18n();
  const current = value ?? null;
  return (
    <div className="shift-picker" role="radiogroup" aria-label={t.viewer.cameraShift}>
      {CELLS.map((cell) => {
        const label = t.viewer.cameraShifts[cell ?? 'center'];
        return (
          <button
            key={cell ?? 'center'}
            type="button"
            role="radio"
            aria-checked={cell === current}
            className={cell === current ? 'active' : ''}
            title={`${t.viewer.cameraShift}: ${label}`}
            onClick={() => onChange(cell)}
          />
        );
      })}
    </div>
  );
}
