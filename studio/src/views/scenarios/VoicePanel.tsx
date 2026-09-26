import { useEffect, useState } from 'react';
import { api, type TtsJob, type TtsLine } from '../../api/client';
import { Icon } from '../../components/Icon';
import { format, useI18n } from '../../i18n';
import { useAudioPreview } from '../characters/useAudioPreview';

interface Props {
  category: string;
  scenarioId: string;
  lineId: string;
  voiceUrl: string | undefined;
  baseUrl: string;
  /** 未保存の変更があるか（サーバーは保存済みのシナリオから生成する） */
  dirty: boolean;
  /** 採用してシナリオが書き換わったとき（読み直す） */
  onAdopted: () => void;
}

/**
 * セリフのボイス。今のボイスの試聴と、Irodori-TTS での生成（候補を作って試聴し、1つを採用）
 */
export function VoicePanel({ category, scenarioId, lineId, voiceUrl, baseUrl, dirty, onAdopted }: Props) {
  const { t } = useI18n();
  const tt = t.scenarios.tts;
  const audio = useAudioPreview();
  const [line, setLine] = useState<TtsLine | null>(null);
  const [caption, setCaption] = useState('');
  const [count, setCount] = useState(2);
  const [job, setJob] = useState<TtsJob | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // セリフから決まる既定の話者・声の説明（保存済みの内容）
  useEffect(() => {
    setJob(null);
    setMessage(null);
    api
      .ttsLine(category, scenarioId, lineId)
      .then((l) => {
        setLine(l);
        setCaption(l.caption);
      })
      .catch(() => setLine(null));
  }, [category, scenarioId, lineId, dirty]);

  // ジョブの状態を見に行く
  useEffect(() => {
    if (!job || job.status === 'done' || job.status === 'error') return;
    const timer = window.setTimeout(() => api.ttsJob(job.id).then(setJob).catch(() => {}), 1500);
    return () => window.clearTimeout(timer);
  }, [job]);

  const current = voiceUrl ? (voiceUrl.startsWith('/') ? voiceUrl : `${baseUrl}${voiceUrl}`) : null;
  const canGenerate = !dirty && !!line?.speaker && (!job || job.status === 'done' || job.status === 'error');

  const generate = async () => {
    setMessage(null);
    try {
      setJob(await api.ttsStart({ category, id: scenarioId, lineId, candidates: count, caption }));
    } catch (err) {
      setMessage(`${tt.failed}: ${String(err)}`);
    }
  };

  const adopt = async (index: number) => {
    if (!job) return;
    try {
      await api.ttsAdopt(job.id, index);
      audio.stop();
      setJob(null);
      setMessage(tt.adopted);
      onAdopted();
    } catch (err) {
      setMessage(`${tt.failed}: ${String(err)}`);
    }
  };

  return (
    <div className="voice-panel">
      <div className="voice-current">
        <span className="inspector-mono">{voiceUrl ?? t.scenarios.noVoice}</span>
        {current && (
          <button type="button" className="btn icon" title={t.common.play} onClick={() => audio.toggle(current)}>
            <Icon name={audio.playingUrl === current ? 'stop' : 'play'} size={14} />
          </button>
        )}
      </div>

      {dirty ? (
        <p className="field-hint">{tt.saveFirst}</p>
      ) : line && !line.speaker ? (
        <p className="field-hint">{tt.noSpeaker}</p>
      ) : (
        <>
          <label className="field">
            <span className="field-label">{tt.caption}</span>
            <textarea className="textarea" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </label>
          <div className="voice-generate">
            <label className="field voice-count">
              <span className="field-label">{tt.candidates}</span>
              <select className="select" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn primary" disabled={!canGenerate} onClick={generate}>
              <Icon name="mic" size={14} />
              {tt.generate}
            </button>
          </div>
        </>
      )}

      {job && (job.status === 'queued' || job.status === 'running') && <p className="field-hint">{job.status === 'queued' ? tt.queued : tt.running}</p>}
      {job?.status === 'error' && <p className="inspector-error">{`${tt.failed}: ${job.error ?? ''}`}</p>}
      {job?.status === 'done' && (
        <ul className="voice-candidates">
          {job.candidates.map((index) => {
            const url = `/api/tts/jobs/${job.id}/candidates/${index}`;
            return (
              <li key={index}>
                <button type="button" className="btn icon" title={t.common.play} onClick={() => audio.toggle(url)}>
                  <Icon name={audio.playingUrl === url ? 'stop' : 'play'} size={14} />
                </button>
                <span>{format(tt.candidate, { n: index + 1 })}</span>
                <button type="button" className="btn" onClick={() => adopt(index)}>
                  {tt.adopt}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {message && <p className="field-hint">{message}</p>}
    </div>
  );
}
