import React from 'react';
import { SupportedLanguage } from '../../types/scenario';
import { CHARACTERS } from '../../data/characters';

interface EndingViewProps {
  affinities: Record<string, number>;
  lang: SupportedLanguage;
  onRestart: () => void;
}

export const EndingView: React.FC<EndingViewProps> = ({
  affinities,
  lang,
  onRestart,
}) => {
  return (
    <div className="ending-overlay">
      <div className="ending-card">
        <h1 className="ending-title">🎉 ENDING 🎉</h1>
        <p className="ending-subtitle">
          {lang === 'ja'
            ? '全28日間の学園生活が終了しました！お疲れ様でした！'
            : 'All 28 days of school life have come to an end! Thank you for playing!'}
        </p>

        <div className="ending-results">
          <h3>{lang === 'ja' ? '最終好感度結果' : 'Final Affinity Results'}</h3>
          <div className="affinity-list">
            {Object.entries(CHARACTERS).map(([charId, char]) => {
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

        <button className="room-menu-button primary" onClick={onRestart}>
          🔄 {lang === 'ja' ? '最初からやり直す' : 'Start from Day 1'}
        </button>
      </div>
    </div>
  );
};
