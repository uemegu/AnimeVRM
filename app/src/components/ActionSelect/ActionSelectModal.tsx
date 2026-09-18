import React, { useState, useEffect, useCallback } from 'react';
import { ActionLocationId, ActionLocationOption } from '../../types/game';
import { SupportedLanguage } from '../../types/scenario';
import { CHARACTERS } from '../../data/characters';
import { ConfirmModal } from '../Common/ConfirmModal';
import './ActionSelectModal.css';

interface ActionSelectModalProps {
  options: ActionLocationOption[];
  lang: SupportedLanguage;
  onSelectLocation: (locationId: ActionLocationId) => void;
}

// 学校俯瞰マップ上のロケーション座標（画像に対するパーセンテージ）
const LOCATION_COORDINATES: Record<string, { left: string; top: string }> = {
  rooftop: { left: '27.90%', top: '10.30%' }, // 赤丸: 屋上
  classroom: { left: '47.32%', top: '15.12%' }, // 青丸: 教室
  library: { left: '73.63%', top: '22.80%' }, // 緑丸: 図書室
  cafeteria: { left: '26.54%', top: '27.04%' }, // 黄色丸: 購買・学食
  courtyard: { left: '40.82%', top: '39.25%' }, // 紫丸: 中庭
  sports_ground: { left: '6.12%', top: '40.12%' }, // 水色丸: 運動場
};

export const ActionSelectModal: React.FC<ActionSelectModalProps> = ({
  options,
  lang,
  onSelectLocation,
}) => {
  // ホバー状態の連動（カード ⇔ マップピン）
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // 決定確認ダイアログ用の選択中ロケーション
  const [pendingOption, setPendingOption] = useState<ActionLocationOption | null>(null);

  // 効果音再生ヘルパー（ChoiceBoxと共通）
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
  const handleMouseEnter = (id: string) => {
    setHoveredId(id);
    playSE('/se/items_hover.mp3', 0.45);
  };

  const handleMouseLeave = () => {
    setHoveredId(null);
  };

  // 場所クリック時: 直接決定ではなく自作YES/NOダイアログを表示
  const handleClickLocation = (opt: ActionLocationOption) => {
    playSE('/se/items_hover.mp3', 0.5);
    setPendingOption(opt);
  };

  // YES/NOダイアログで「はい」確定
  const handleConfirmMove = () => {
    if (!pendingOption) return;
    const targetId = pendingOption.id;
    setPendingOption(null);
    playSE('/se/items_chose.mp3', 0.65);
    onSelectLocation(targetId);
  };

  // ダイアログキャンセル
  const handleCancelMove = () => {
    setPendingOption(null);
  };

  return (
    <div className="action-select-overlay">
      {/* 左側 / 中央: 学校俯瞰マップ表示エリア */}
      <div className="action-map-area">
        <div className="action-map-wrapper">
          <img
            src="/assets/backgrounds/school_aerial.avif"
            alt="School Aerial View"
            className="action-map-img"
          />

          {/* マップ上の各ロケーションピン（インタラクティブラベル） */}
          {options.map((opt) => {
            const coord = LOCATION_COORDINATES[opt.id];
            if (!coord) return null;

            const locName = opt.name[lang] || opt.name.ja;
            const isHighlighted = hoveredId === opt.id;

            // 会える人物インジケーター（特定: 黄(あおい)・赤(エミリ)・青(しおん)、不特定: ?）
            const charIds = opt.hintCharacterIds || [];
            let charBadgeClass = '';
            let charBadgeText = '';

            if (charIds.includes('aoi')) {
              charBadgeClass = 'pin-char-aoi'; // 黄色丸: あおい
            } else if (charIds.includes('emili')) {
              charBadgeClass = 'pin-char-emili'; // 赤丸: エミリ
            } else if (charIds.includes('shion')) {
              charBadgeClass = 'pin-char-shion'; // 青丸: しおん
            } else if (opt.hintText) {
              charBadgeClass = 'pin-char-unknown'; // 誰かいそう: ?
              charBadgeText = '?';
            }

            return (
              <div
                key={`pin_${opt.id}`}
                className={`action-map-pin ${isHighlighted ? 'highlighted' : ''}`}
                style={{ left: coord.left, top: coord.top }}
                onMouseEnter={() => handleMouseEnter(opt.id)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleClickLocation(opt)}
                title={locName}
              >
                {/* キャラクター遭遇インジケーター */}
                {charBadgeClass && (
                  <span className={`pin-char-badge ${charBadgeClass}`}>
                    {charBadgeText}
                  </span>
                )}

                <div className="action-map-pin-inner">
                  <span className="action-map-pin-name">{locName}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 右側: 行動選択サイドバー */}
      <aside className="action-sidebar">
        <header className="action-sidebar-header">
          <h2 className="action-sidebar-title">
            {lang === 'ja' ? '移動場所の選択' : 'Choose Destination'}
          </h2>
        </header>

        {/* サイドバー内のカードリスト（スクロールなし・コンパクト一覧） */}
        <div className="action-sidebar-list">
          {options.map((opt) => {
            const locName = opt.name[lang] || opt.name.ja;
            const hintText = opt.hintText
              ? opt.hintText[lang] || opt.hintText.ja
              : null;
            const isHighlighted = hoveredId === opt.id;

            return (
              <div
                key={opt.id}
                className={`location-item-card ${isHighlighted ? 'highlighted' : ''}`}
                onMouseEnter={() => handleMouseEnter(opt.id)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleClickLocation(opt)}
              >
                <div className="location-card-content">
                  <div className="location-item-main">
                    <span className="location-name">{locName}</span>

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

                  {/* INFO ヒントテキスト（2行固定高さ・上下中央揃え） */}
                  {hintText ? (
                    <div className="location-hint-box">
                      <span className="hint-label">INFO</span>
                      <span className="hint-text">{hintText}</span>
                    </div>
                  ) : (
                    <div className="location-hint-box placeholder" aria-hidden="true">
                      <span className="hint-label">INFO</span>
                      <span className="hint-text">-</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* 行動選択前の自作YES/NO確認ダイアログ */}
      <ConfirmModal
        isOpen={pendingOption !== null}
        title={lang === 'ja' ? '行き先の決定' : 'Confirm Destination'}
        message={
          pendingOption
            ? lang === 'ja'
              ? `「${pendingOption.name[lang] || pendingOption.name.ja}」へ移動しますか？`
              : `Go to ${pendingOption.name[lang] || pendingOption.name.ja}?`
            : ''
        }
        confirmText={lang === 'ja' ? 'はい' : 'YES'}
        cancelText={lang === 'ja' ? 'いいえ' : 'NO'}
        onConfirm={handleConfirmMove}
        onCancel={handleCancelMove}
      />
    </div>
  );
};
