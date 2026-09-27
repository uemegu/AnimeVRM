import type { AvatarTransition, CameraPose, CameraShot, SceneTransition } from '@anime-vrm/scenario';
import type { StudioData } from '../../data/useStudioData';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { EffectFields } from './EffectFields';

const SHOTS: CameraShot[] = ['wide', 'medium', 'speaker', 'close'];
const EXPRESSIONS = ['neutral', 'happy', 'relaxed', 'sad', 'angry', 'surprised'] as const;
const LOOK_AT = ['player', 'camera', 'partner', 'speaker', 'forward'] as const;

/** 値が undefined なら項目ごと消す */
function withField<T extends object>(obj: T, key: keyof T, value: unknown): T {
  const copy = { ...obj } as Record<string, unknown>;
  if (value === undefined || value === '') delete copy[key as string];
  else copy[key as string] = value;
  return copy as T;
}

interface Props {
  kind: 'camera' | 'avatar';
  value: AvatarTransition | SceneTransition;
  data: StudioData;
  castIds: string[];
  /** カメラを手で動かしているときの位置（「今のカメラを使う」） */
  currentPose: CameraPose | null;
  onChange: (value: AvatarTransition | SceneTransition) => void;
  onDelete: () => void;
}

/** 選んだキーの編集（時刻・表情・モーション・視線・表示、またはカメラ） */
export function KeyEditor({ kind, value, data, castIds, currentPose, onChange, onDelete }: Props) {
  const { t } = useI18n();
  const tl = t.scenarios.timeline;
  const set = (key: string, v: unknown) => onChange(withField(value, key as keyof typeof value, v));

  const atField = (
    <label className="field key-at">
      <span className="field-label">{tl.at}</span>
      <input className="input" type="number" min={0} step={0.05} value={value.at} onChange={(e) => set('at', Math.max(0, Number(e.target.value)))} />
    </label>
  );

  if (kind === 'camera') {
    const key = value as SceneTransition;
    const mode = key.cameraPose ? 'pose' : 'shot';
    return (
      <div className="key-editor">
        {atField}
        <label className="field">
          <span className="field-label">{t.scenarios.camera}</span>
          <select
            className="select"
            value={mode === 'pose' ? 'pose' : (key.camera ?? '')}
            onChange={(e) => {
              const v = e.target.value;
              let next = withField(withField(key, 'camera', undefined), 'cameraPose', undefined);
              if (v === 'pose') next = { ...next, cameraPose: currentPose ?? key.cameraPose ?? { position: [0, 1.3, 1.6], target: [0, 1.2, 0] } };
              else if (v) next = { ...next, camera: v as CameraShot };
              onChange(next);
            }}
          >
            <option value="">{tl.none}</option>
            {SHOTS.map((s) => (
              <option key={s} value={s}>
                {`${tl.shot}: ${t.viewer.shots[s]}`}
              </option>
            ))}
            <option value="pose">{tl.pose}</option>
          </select>
        </label>
        {mode === 'pose' && (
          <div className="field">
            <span className="field-label">{tl.pose}</span>
            <span className="inspector-mono">
              {key.cameraPose!.position.join(', ')} → {key.cameraPose!.target.join(', ')}
            </span>
            <button type="button" className="btn" disabled={!currentPose} onClick={() => currentPose && set('cameraPose', currentPose)}>
              {tl.useCurrentCamera}
            </button>
          </div>
        )}
        <label className="field key-at">
          <span className="field-label">{tl.duration}</span>
          <input
            className="input"
            type="number"
            min={0}
            step={0.1}
            value={key.cameraTransitionDuration ?? ''}
            placeholder="0.6"
            onChange={(e) => set('cameraTransitionDuration', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span className="field-label">{t.scenarios.focusLines}</span>
          <select className="select" value={key.focusLines === undefined ? '' : key.focusLines ? 'on' : 'off'} onChange={(e) => set('focusLines', e.target.value === '' ? undefined : e.target.value === 'on')}>
            <option value="">{tl.none}</option>
            <option value="on">{tl.show}</option>
            <option value="off">{tl.hide}</option>
          </select>
        </label>
        <DeleteButton onDelete={onDelete} />
      </div>
    );
  }

  const key = value as AvatarTransition;
  return (
    <div className="key-editor">
      {atField}
      <label className="field">
        <span className="field-label">{t.scenarios.expression}</span>
        <select className="select" value={key.expression ?? ''} onChange={(e) => onChange(withField(withField(key, 'expression', e.target.value || undefined), 'expressionWeight', e.target.value ? 1 : undefined))}>
          <option value="">{tl.none}</option>
          {EXPRESSIONS.map((ex) => (
            <option key={ex} value={ex}>
              {t.viewer.expressions[ex]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">{t.scenarios.motion}</span>
        <div className="cast-motion">
          <select className="select" value={key.motion ?? ''} onChange={(e) => onChange(withField(withField(key, 'motion', e.target.value || undefined), 'motionLoop', e.target.value ? !!data.motions[e.target.value]?.loop : undefined))}>
            <option value="">{tl.none}</option>
            {data.animations.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {key.motion && (
            <label className="inspector-check compact">
              <input type="checkbox" checked={!!key.motionLoop} onChange={(e) => set('motionLoop', e.target.checked)} />
              {t.scenarios.loop}
            </label>
          )}
        </div>
      </label>
      <label className="field">
        <span className="field-label">{tl.gaze}</span>
        <select className="select" value={key.lookAtTarget ?? ''} onChange={(e) => set('lookAtTarget', e.target.value || undefined)}>
          <option value="">{tl.none}</option>
          {LOOK_AT.map((l) => (
            <option key={l} value={l}>
              {t.scenarios.lookAtTargets[l]}
            </option>
          ))}
          {castIds.map((id) => (
            <option key={id} value={id}>
              {data.characters.characters.find((c) => c.id === id)?.name.ja ?? id}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">{tl.headTurn}</span>
        <div className="cast-motion">
          <input className="schema-range" type="range" min={0} max={1} step={0.05} value={key.headTurn ?? 0.5} onChange={(e) => set('headTurn', Number(e.target.value))} />
          <span className="inspector-mono">{(key.headTurn ?? 0.5).toFixed(2)}</span>
        </div>
      </label>
      <label className="field">
        <span className="field-label">{tl.visible}</span>
        <select className="select" value={key.visible === undefined ? '' : key.visible ? 'show' : 'hide'} onChange={(e) => set('visible', e.target.value === '' ? undefined : e.target.value === 'show')}>
          <option value="">{tl.none}</option>
          <option value="show">{tl.show}</option>
          <option value="hide">{tl.hide}</option>
        </select>
      </label>
      <EffectFields value={key} unsetLabel={() => tl.none} onChange={set} />
      <DeleteButton onDelete={onDelete} />
    </div>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const { t } = useI18n();
  return (
    <div className="key-delete">
      <button type="button" className="btn danger" onClick={onDelete}>
        <Icon name="trash" size={14} />
        {t.scenarios.timeline.deleteKey}
      </button>
    </div>
  );
}
