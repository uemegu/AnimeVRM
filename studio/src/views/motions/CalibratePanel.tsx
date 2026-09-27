import { useEffect, useMemo, useRef, useState } from 'react';
import { CALIBRATION_TARGETS, ContactCalibrator, type CalibrationState, type CalibrationTarget } from '@anime-vrm/motion/quality/calibrator';
import { resolveAssetUrl } from '@anime-vrm/engine/utils/path';
import { api } from '../../api/client';
import type { StudioData } from '../../data/useStudioData';
import { format, useI18n } from '../../i18n';
import { profilePathFor } from './GeneratePanel';

/**
 * 接触点の校正。VRM の顔・胸の前・手のひらをクリックして記録し、assets/motion-profiles/ に保存する
 */
export function CalibratePanel({ data }: { data: StudioData }) {
  const { t } = useI18n();
  const tm = t.motions;
  const viewportRef = useRef<HTMLDivElement>(null);
  const calibratorRef = useRef<ContactCalibrator | null>(null);
  const avatars = useMemo(
    () => data.characters.characters.flatMap((c) => c.models.map((m) => ({ url: m.url, label: `${c.name.ja}（${m.label.ja}）` }))),
    [data]
  );
  const [avatarUrl, setAvatarUrl] = useState(avatars[0]?.url ?? '/models/aoi/aoi-school.vrm');
  const [state, setState] = useState<CalibrationState>({ avatarSha256: null, recorded: [] });
  const [target, setTarget] = useState<CalibrationTarget>('leftCheek');
  const [faceGap, setFaceGap] = useState(0.015);
  const [palmGap, setPalmGap] = useState(0.006);
  const [message, setMessage] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    const calibrator = new ContactCalibrator(viewportRef.current!, (next) => {
      setState(next);
      setTarget(calibrator.target);
      if (next.notice === 'missSurface') setMessage(tm.missSurface);
      else if (next.notice === 'missingBone') setMessage(tm.missingBone);
      else if (next.notice === 'recorded') setMessage(null);
    });
    calibratorRef.current = calibrator;
    return () => {
      calibrator.dispose();
      calibratorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setMessage(null);
    calibratorRef.current?.load(avatarUrl).catch((err) => setMessage(String(err)));
    fetch(resolveAssetUrl(`/motion-profiles/${profilePathFor(avatarUrl)}`), { cache: 'no-store' })
      .then((res) => setHasProfile(res.ok))
      .catch(() => setHasProfile(false));
  }, [avatarUrl]);

  const choose = (id: CalibrationTarget) => {
    setTarget(id);
    if (calibratorRef.current) calibratorRef.current.target = id;
  };

  const save = async () => {
    try {
      const profile = calibratorRef.current!.buildProfile(faceGap, palmGap);
      const path = profilePathFor(avatarUrl);
      await api.saveMotionProfile(path, profile);
      setHasProfile(true);
      setMessage(format(tm.calibrateSaved, { path: `motion-profiles/${path}` }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="motion-calibrate">
      <aside className="motion-form">
        <label className="field">
          <span className="field-label">{tm.avatar}</span>
          <select className="select" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}>
            {avatars.map((a) => (
              <option key={a.url} value={a.url}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        {hasProfile && <p className="field-hint">{tm.existingProfile}</p>}
        <p className="field-hint">{tm.calibrateHint}</p>
        <ul className="calibrate-targets">
          {CALIBRATION_TARGETS.map((id) => (
            <li key={id}>
              <button type="button" className={`calibrate-target${target === id ? ' active' : ''}`} onClick={() => choose(id)}>
                <span className={`calibrate-dot${state.recorded.includes(id) ? ' done' : ''}`} />
                {tm.calibrateTargets[id]}
              </button>
            </li>
          ))}
        </ul>
        <p className="field-hint">{format(tm.calibrateProgress, { count: state.recorded.length })}</p>
        <div className="motion-row">
          <label className="field">
            <span className="field-label">{tm.faceGap}</span>
            <input className="input" type="number" min={0} max={0.15} step={0.001} value={faceGap} onChange={(e) => setFaceGap(Number(e.target.value))} />
          </label>
          <label className="field">
            <span className="field-label">{tm.palmGap}</span>
            <input className="input" type="number" min={0} max={0.15} step={0.001} value={palmGap} onChange={(e) => setPalmGap(Number(e.target.value))} />
          </label>
        </div>
        <div className="motion-row">
          <button type="button" className="btn primary" disabled={state.recorded.length !== CALIBRATION_TARGETS.length} onClick={save}>
            {tm.calibrateSave}
          </button>
          <button type="button" className="btn" onClick={() => calibratorRef.current?.clear()}>
            {tm.calibrateReset}
          </button>
        </div>
        {message && <p className="field-hint">{message}</p>}
      </aside>
      <section className="motion-stage">
        <div className="motion-canvas" ref={viewportRef} />
      </section>
    </div>
  );
}
