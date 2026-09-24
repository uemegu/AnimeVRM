import React from 'react';
import { CHARACTERS, HEROINE_IDS } from '../../data/characters';
import { useLanguage } from '../../contexts/LanguageContext';

export interface EndingPageProps {
  affinities: Record<string, number>;
  /** 到達したエンディングのタイトル（エンディングを経ずに期限を迎えた場合は null） */
  endingTitle?: string | null;
  onRestart: () => void;
}

export const EndingPage: React.FC<EndingPageProps> = ({
  affinities,
  endingTitle,
  onRestart,
}) => {
  const { lang } = useLanguage();
  return (
    <div className="ending-overlay">
      <div className="ending-card">
        <h1 className="ending-title">ENDING</h1>
        {endingTitle && <h2 className="ending-name">{endingTitle}</h2>}
        <p className="ending-subtitle">
          {lang === 'ja'
            ? '女神に告げられた21日間が終わりました。プレイいただきありがとうございました。'
            : 'The 21 days set by the Goddess have ended. Thank you for playing.'}
        </p>

        <div className="ending-results">
          <h3>{lang === 'ja' ? '最終好感度結果' : 'Final Affinity Results'}</h3>
          <div className="affinity-list">
            {HEROINE_IDS.map((charId) => {
                  const char = CHARACTERS[charId];
              const val = affinities[charId] || 0;
              const name = char.name[lang] || char.name.ja;
              return (
                <div key={charId} className="affinity-item">
                  <span className="affinity-name" style={{ color: char.themeColor }}>
                    {name}
                  </span>
                  <span className="affinity-val">Lv: {val}</span>
                </div>
              );
            })}
          </div>
        </div>

        <button className="ending-restart-btn" onClick={onRestart}>
          {lang === 'ja' ? 'タイトルへ戻る' : 'Return to Title'}
        </button>
      </div>
    </div>
  );
};
