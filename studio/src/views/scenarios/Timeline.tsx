import { useRef, useState, type PointerEvent } from 'react';
import type { CharacterBook, ScenarioScene } from '@anime-vrm/scenario';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { keyKinds, laneKeys, type KeyRef, type LaneId } from './timelineEdit';

const KIND_COLORS: Record<string, string> = {
  expression: '#f59e0b',
  motion: '#2563eb',
  gaze: '#10b981',
  visible: '#64748b',
  camera: '#db2777',
  effect: '#8b5cf6',
};

interface Props {
  scene: ScenarioScene;
  /** タイムラインに出すキャラ（そのカットで舞台にいる人） */
  castIds: string[];
  characters: CharacterBook;
  duration: number;
  /** ボイスの長さ（秒）。なければ null */
  voiceDuration: number | null;
  time: number;
  selected: KeyRef | null;
  onSeek: (time: number) => void;
  onSelect: (ref: KeyRef | null) => void;
  onAddKey: (lane: LaneId) => void;
  onMoveKey: (ref: KeyRef, at: number) => void;
}

const sameRef = (a: KeyRef | null, b: KeyRef) =>
  !!a && a.index === b.index && a.lane.kind === b.lane.kind && (a.lane.kind === 'camera' || (b.lane.kind === 'avatar' && a.lane.id === b.lane.id));

/**
 * カット内のタイムライン。行はカメラとキャラごと。目盛りをクリック・ドラッグで頭出し、
 * キー（◆）をクリックで選択・ドラッグで時刻を動かす
 */
export function Timeline({ scene, castIds, characters, duration, voiceDuration, time, selected, onSeek, onSelect, onAddKey, onMoveKey }: Props) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ ref: KeyRef; at: number } | null>(null);

  const timeAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
  };
  const percent = (sec: number) => `${(sec / duration) * 100}%`;

  const onRulerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onSeek(timeAt(e.clientX));
  };
  const onRulerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.buttons & 1) onSeek(timeAt(e.clientX));
  };

  const ticks: number[] = [];
  const step = duration > 12 ? 1 : 0.5;
  for (let s = 0; s <= duration + 1e-6; s += step) ticks.push(Math.round(s * 10) / 10);

  const lanes: Array<{ lane: LaneId; label: string; color: string }> = [
    { lane: { kind: 'camera' }, label: t.scenarios.timeline.camera, color: KIND_COLORS.camera },
    ...castIds.map((id) => {
      const character = characters.characters.find((c) => c.id === id);
      return { lane: { kind: 'avatar' as const, id }, label: character?.name.ja ?? id, color: character?.themeColor ?? '#94a3b8' };
    }),
  ];

  return (
    <div className="timeline">
      <div className="timeline-row ruler">
        <div className="timeline-label" />
        <div className="timeline-track" ref={trackRef} onPointerDown={onRulerDown} onPointerMove={onRulerMove}>
          {ticks.map((s) => (
            <span key={s} className={`timeline-tick${Number.isInteger(s) ? ' major' : ''}`} style={{ left: percent(s) }}>
              {Number.isInteger(s) ? `${s}s` : ''}
            </span>
          ))}
        </div>
      </div>

      {voiceDuration !== null && (
        <div className="timeline-row">
          <div className="timeline-label">{t.scenarios.timeline.voice}</div>
          <div className="timeline-track">
            <span className="timeline-voice" style={{ width: percent(Math.min(voiceDuration, duration)) }} />
          </div>
        </div>
      )}

      {lanes.map(({ lane, label, color }) => {
        const keys = laneKeys(scene, lane);
        return (
          <div key={lane.kind === 'camera' ? 'camera' : lane.id} className="timeline-row">
            <div className="timeline-label">
              <span className="timeline-swatch" style={{ background: color }} />
              <span className="timeline-label-text">{label}</span>
              <button type="button" className="timeline-add" title={t.scenarios.timeline.addKey} onClick={() => onAddKey(lane)}>
                <Icon name="plus" size={12} />
              </button>
            </div>
            <div className="timeline-track" onPointerDown={(e) => e.target === e.currentTarget && onSelect(null)}>
              {keys.map((key, index) => {
                const ref: KeyRef = { lane, index };
                const at = dragging && sameRef(dragging.ref, ref) ? dragging.at : key.at;
                const kinds = keyKinds(key);
                return (
                  <button
                    key={index}
                    type="button"
                    className={`timeline-key${sameRef(selected, ref) ? ' selected' : ''}`}
                    style={{ left: percent(at), background: kinds.length === 1 ? KIND_COLORS[kinds[0]] : kinds.length ? '#475569' : '#cbd5e1' }}
                    title={`${at.toFixed(2)}s ${kinds.join(' / ')}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      onSelect(ref);
                      setDragging({ ref, at: key.at });
                    }}
                    onPointerMove={(e) => {
                      if (dragging && sameRef(dragging.ref, ref) && e.buttons & 1) setDragging({ ref, at: timeAt(e.clientX) });
                    }}
                    onPointerUp={() => {
                      if (dragging && sameRef(dragging.ref, ref) && Math.abs(dragging.at - key.at) > 0.01) onMoveKey(ref, dragging.at);
                      setDragging(null);
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="timeline-playhead-layer">
        <div className="timeline-label" />
        <div className="timeline-track">
          <span className="timeline-playhead" style={{ left: percent(Math.min(time, duration)) }} />
        </div>
      </div>
    </div>
  );
}
