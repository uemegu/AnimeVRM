import React, { useEffect, useCallback } from 'react';
import { ActionLocationId, ActionLocationOption } from '../../types/game';
import { SupportedLanguage } from '../../types/scenario';
import { CHARACTERS } from '../../data/characters';
import './ActionSelectModal.css';

interface ActionSelectModalProps {
  options: ActionLocationOption[];
  lang: SupportedLanguage;
  onSelectLocation: (locationId: ActionLocationId) => void;
}

export const ActionSelectModal: React.FC<ActionSelectModalProps> = ({
  options,
  lang,
  onSelectLocation,
}) => {
  // 効果音再生ヘルパー（ChoiceBoxと共通のSE）
  const playSE = useCallback((url: string, volume = 0.5) => {
    try {
      const audio = new Audio(url);
      audio.volume = volume;
      audio.play().catch(() => {});
    } catch {
      // Audio play catch
    }
  }, []);

  // マウント時に表示SE再生
  useEffect(() => {
    playSE('/se/items_shown.mp3', 0.6);
  }, [playSE]);

  // ホバー音
  const handleMouseEnter = () => {
    playSE('/se/items_hover.mp3', 0.45);
  };

  // 決定音＆選択
  const handleCardClick = (locId: ActionLocationId) => {
    playSE('/se/items_chose.mp3', 0.65);
    onSelectLocation(locId);
  };

  return (
    <div className="action-select-overlay">
      <div className="action-select-card">
        <header className="action-select-header">
          <div className="action-select-ribbon">
            <span>DESTINATION</span>
          </div>
          <h2 className="action-select-title">
            <span>
              {lang === 'ja' ? '移動場所の選択' : 'Choose Destination'}
            </span>
          </h2>
          <p className="action-select-subtitle">
            {lang === 'ja'
              ? 'どこへ向かいますか？ 周囲の様子や気配を確認してみましょう。'
              : 'Where will you go? Check who might be around.'}
          </p>
        </header>

        <div className="location-grid">
          {options.map((opt, index) => {
            const locName = opt.name[lang] || opt.name.ja;
            const locDesc = opt.description
              ? opt.description[lang] || opt.description.ja
              : '';
            const hintText = opt.hintText
              ? opt.hintText[lang] || opt.hintText.ja
              : null;
            const badgeNumber = String(index + 1).padStart(2, '0');

            return (
              <div
                key={opt.id}
                className="location-item-card"
                style={{ animationDelay: `${(0.08 + index * 0.07).toFixed(2)}s` }}
                onMouseEnter={handleMouseEnter}
                onClick={() => handleCardClick(opt.id)}
              >
                {/* 選択肢画面スタイルのナンバリングバッジ */}
                <span className="location-number-badge">{badgeNumber}</span>

                <div className="location-card-content">
                  <div className="location-item-header">
                    <div className="location-name-area">
                      <span className="location-name">{locName}</span>
                    </div>
                    {opt.hintCharacterIds && opt.hintCharacterIds.length > 0 && (
                      <div className="character-hints">
                        {opt.hintCharacterIds.map((charId) => {
                          const char = CHARACTERS[charId];
                          const charName = char
                            ? char.name[lang] || char.name.ja
                            : charId;
                          return (
                            <span
                              key={charId}
                              className="character-badge"
                              style={{
                                backgroundColor: char?.themeColor || '#64748b',
                              }}
                            >
                              <span className="character-badge-dot" />
                              <span>{charName}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="location-desc">{locDesc}</div>

                  {hintText && (
                    <div className="location-hint-box">
                      <span className="hint-label">INFO</span>
                      <span>{hintText}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
