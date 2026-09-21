import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ActionLocationId, ActionLocationOption, DayPhase } from '../../types/game';
import { SupportedLanguage } from '../../types/scenario';
import { CHARACTERS } from '../../data/characters';
import { LOCATION_VISUAL_PRESETS } from '../../data/locationVisualPresets';
import { ConfirmModal } from '../Common/ConfirmModal';
import './ActionSelectModal.css';

interface ActionSelectModalProps {
  options: ActionLocationOption[];
  lang: SupportedLanguage;
  onSelectLocation: (locationId: ActionLocationId) => void;
  phase?: DayPhase;
  affinities?: Record<string, number>;
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
  phase = 'morning_action',
  affinities = {},
}) => {
  // ホバー・キーボードフォーカスの連動（カード ⇔ マップピン）
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const activeId = hoveredId ?? focusedId;

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

  const handleFocusLocation = (id: string) => {
    setFocusedId(id);
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

  // ホバー中のロケーション対象
  const hoveredOption = useMemo(
    () => options.find((opt) => opt.id === activeId),
    [options, activeId]
  );

  // ホバー中ロケーションのINFO文字列
  const hoveredHintText = useMemo(() => {
    if (!hoveredOption?.hintText) return null;
    return hoveredOption.hintText[lang] || hoveredOption.hintText.ja || null;
  }, [hoveredOption, lang]);

  // フォーカス時のヒロインポップアップ情報（感情判定・パステル背景色・「？」対応）
  const focusHeroineInfo = useMemo(() => {
    if (!hoveredOption) return null;

    const charIds = hoveredOption.hintCharacterIds || [];
    if (charIds.length > 0) {
      const charId = charIds[0];
      const affinityVal = affinities[charId] || 0;

      // 感情状態の判定: 5以上でgood、0未満でbad、それ以外はnormal
      let emotion: 'normal' | 'good' | 'bad' = 'normal';
      if (affinityVal >= 5) {
        emotion = 'good';
      } else if (affinityVal < 0) {
        emotion = 'bad';
      } else {
        emotion = 'normal';
      }

      return {
        type: 'character' as const,
        charId,
        name: CHARACTERS[charId]?.name[lang] || CHARACTERS[charId]?.name.ja || charId,
        emotion,
        imgUrl: `/assets/characters/${charId}_${emotion}.avif`,
        bgClass: `heroine-bg-${charId}`,
      };
    } else if (hoveredOption.hintText) {
      // 誰かいそうだが不特定（？）
      return {
        type: 'unknown' as const,
        bgClass: 'heroine-bg-unknown',
      };
    }

    // 誰も出会わない選択肢の場合は非表示
    return null;
  }, [hoveredOption, affinities, lang]);

  return (
    <div className={`action-select-overlay phase-${phase}`}>
      {/* 左側 / 中央: 学校俯瞰マップ表示エリア */}
      <div className="action-map-area">
        <div className="action-map-wrapper">
          <div className="action-map-clip">
            <img
              src="/assets/backgrounds/school_aerial.avif"
              alt={lang === 'ja' ? '学校の俯瞰マップ' : 'School aerial map'}
              className="action-map-img"
            />

            {/* マップ上の各ロケーションピン（インタラクティブラベル） */}
            {options.map((opt) => {
              const coord = LOCATION_COORDINATES[opt.id];
              if (!coord) return null;

              const locName = opt.name[lang] || opt.name.ja;
              const isHighlighted = activeId === opt.id;

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
                <button
                  type="button"
                  key={`pin_${opt.id}`}
                  className={`action-map-pin ${isHighlighted ? 'highlighted' : ''}`}
                  style={{ left: `clamp(40px, ${coord.left}, calc(100% - 40px))`, top: coord.top }}
                  onMouseEnter={() => handleMouseEnter(opt.id)}
                  onMouseLeave={handleMouseLeave}
                  onFocus={() => handleFocusLocation(opt.id)}
                  onBlur={() => setFocusedId(null)}
                  onClick={() => handleClickLocation(opt)}
                  title={locName}
                >
                  {/* キャラクター遭遇インジケーター */}
                  {charBadgeClass && (
                    <span className={`pin-char-badge ${charBadgeClass}`}>
                      {charBadgeText}
                    </span>
                  )}

                  <span className="action-map-pin-inner">
                    <span className="action-map-pin-name">{locName}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* ロケーションフォーカス時のINFO帯表示（地図下側・ヒロイン画像左側） */}
          {focusHeroineInfo && hoveredHintText && (
            <div
              key={`focus_info_${activeId}`}
              className="action-focus-info-banner"
            >
              <div className="action-focus-info-banner-inner">
                <span className="focus-info-label">INFO</span>
                <span className="focus-info-text">{hoveredHintText}</span>
              </div>
            </div>
          )}

          {/* ロケーションフォーカス時のヒロイン画像ポップアップ（地図右下はみ出し表示） */}
          {focusHeroineInfo && (
            <div
              key={`focus_${activeId}`}
              className={`action-focus-heroine-box ${focusHeroineInfo.bgClass}`}
            >
              {focusHeroineInfo.type === 'character' ? (
                <>
                  <img
                    src={focusHeroineInfo.imgUrl}
                    alt={focusHeroineInfo.name}
                    className="heroine-preview-img"
                  />
                  <span className="heroine-preview-name">{focusHeroineInfo.name}</span>
                </>
              ) : (
                <span className="heroine-preview-unknown">?</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 右側: 行動選択サイドバー */}
      <aside className="action-sidebar">
        <header className="action-sidebar-header">
          <h2 className="action-sidebar-title">
            {lang === 'ja' ? '移動場所の選択' : 'Choose Destination'}
          </h2>
          <p className="action-sidebar-description">
            {lang === 'ja' ? '行きたい場所を選んでください。' : 'Choose where you would like to go.'}
          </p>
        </header>

        {/* サイドバー内のカードリスト（小さい画面ではスクロール） */}
        <div className="action-sidebar-list">
          {options.map((opt) => {
            const locName = opt.name[lang] || opt.name.ja;
            const hintText = opt.hintText
              ? opt.hintText[lang] || opt.hintText.ja
              : null;
            const isHighlighted = activeId === opt.id;
            const thumbnailUrl = LOCATION_VISUAL_PRESETS[opt.id]?.layers.background?.url;

            return (
              <button
                type="button"
                key={opt.id}
                className={`location-item-card ${isHighlighted ? 'highlighted' : ''}`}
                onMouseEnter={() => handleMouseEnter(opt.id)}
                onMouseLeave={handleMouseLeave}
                onFocus={() => handleFocusLocation(opt.id)}
                onBlur={() => setFocusedId(null)}
                onClick={() => handleClickLocation(opt)}
              >
                {thumbnailUrl && (
                  <img className="location-thumbnail" src={thumbnailUrl} alt="" />
                )}
                <span className="location-card-content">
                  <span className="location-item-main">
                    <span className="location-name">{locName}</span>

                    {opt.hintCharacterIds && opt.hintCharacterIds.length > 0 && (
                      <span className="character-hints">
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
                                '--character-color': char?.themeColor || '#64748b',
                              } as React.CSSProperties}
                            >
                              <span>{charName}</span>
                            </span>
                          );
                        })}
                      </span>
                    )}
                  </span>

                  {/* 場所のサムネイルに添えるヒント */}
                  {hintText ? (
                    <span className="location-hint-box">
                      <span className="hint-text">{hintText}</span>
                    </span>
                  ) : (
                    <span className="location-hint-box placeholder" aria-hidden="true">
                      <span className="hint-text">-</span>
                    </span>
                  )}
                </span>
              </button>
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
