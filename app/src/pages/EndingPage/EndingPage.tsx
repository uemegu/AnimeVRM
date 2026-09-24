import React from 'react';
import { CHARACTERS } from '../../data/characters';
import { useLanguage } from '../../contexts/LanguageContext';

export interface EndingPageProps {
  affinities: Record<string, number>;
  onRestart: () => void;
}

export const EndingPage: React.FC<EndingPageProps> = ({
  affinities,
  onRestart,
}) => {
  const { lang } = useLanguage();
  return (
    <div className="ending-overlay">
      <div className="ending-card">
        <h1 className="ending-title">ENDING</h1>
        <p className="ending-subtitle">
          {lang === 'ja'
            ? '全28日間の学園生活が終了しました。プレイいただきありがとうございました。'
            : 'All 28 days of school life have concluded. Thank you for playing.'}
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
          {lang === 'ja' ? 'タイトルへ戻る' : 'Return to Title'}
        </button>
      </div>
    </div>
  );
};
