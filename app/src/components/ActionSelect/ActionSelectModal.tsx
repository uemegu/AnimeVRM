import React from 'react';
import { ActionLocationId, ActionLocationOption } from '../../types/game';
import { SupportedLanguage } from '../../types/scenario';
import { CHARACTERS } from '../../data/characters';

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
  return (
    <div className="action-select-overlay">
      <div className="action-select-card">
        <h2 className="action-select-title">
          {lang === 'ja' ? '📍 移動場所の選択' : '📍 Choose Destination'}
        </h2>
        <p className="action-select-subtitle">
          {lang === 'ja'
            ? 'どこへ向かいますか？ 周囲の様子や気配を確認してみましょう。'
            : 'Where will you go? Check who might be around.'}
        </p>

        <div className="location-grid">
          {options.map((opt) => {
            const locName = opt.name[lang] || opt.name.ja;
            const locDesc = opt.description ? opt.description[lang] || opt.description.ja : '';
            const hintText = opt.hintText ? opt.hintText[lang] || opt.hintText.ja : null;

            return (
              <div
                key={opt.id}
                className="location-item-card"
                onClick={() => onSelectLocation(opt.id)}
              >
                <div className="location-item-header">
                  <span className="location-name">{locName}</span>
                  {opt.hintCharacterIds && opt.hintCharacterIds.length > 0 && (
                    <div className="character-hints">
                      {opt.hintCharacterIds.map((charId) => {
                        const char = CHARACTERS[charId];
                        const charName = char ? char.name[lang] || char.name.ja : charId;
                        return (
                          <span
                            key={charId}
                            className="character-badge"
                            style={{ backgroundColor: char?.themeColor || '#64748b' }}
                          >
                            👤 {charName}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="location-desc">{locDesc}</div>

                {hintText && (
                  <div className="location-hint-box">
                    <span className="hint-icon">💡</span>
                    <span>{hintText}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
