import React, { useState, useEffect, useMemo } from 'react';
import { ActionLocationId, ActionLocationOption, DayPhase } from '../../types/game';
import { CHARACTERS } from '../../data/characters';
import { LOCATION_VISUAL_PRESETS } from '../../data/locationVisualPresets';
import { ConfirmModal } from '../Common/ConfirmModal';
import { soundManager } from '../../services/audio/SoundManager';
import './ActionSelectModal.css';
import { useLanguage } from '../../contexts/LanguageContext';

interface ActionSelectModalProps {
  options: ActionLocationOption[];
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

// 休日の街マップ上のロケーション座標（画像に対するパーセンテージ）
const HOLIDAY_LOCATION_COORDINATES: Record<string, { left: string; top: string }> = {
  amusement_park: { left: '15.50%', top: '9.00%' }, // 観覧車
  shopping_street: { left: '32.00%', top: '33.50%' }, // アーケード
  cinema: { left: '70.50%', top: '38.50%' }, // 大型ビル
  home: { left: '15.00%', top: '46.00%' }, // 住宅街
  park: { left: '49.00%', top: '55.50%' }, // 噴水
  aquarium: { left: '70.50%', top: '75.00%' }, // 海辺のドーム（右下のヒロイン枠と重ならない位置）
  shrine: { left: '49.00%', top: '6.00%' }, // 丘の上の社
  aoi_house: { left: '27.00%', top: '52.00%' }, // 住宅街（自宅の近所）
};

export const ActionSelectModal: React.FC<ActionSelectModalProps> = ({
  options,
  onSelectLocation,
  phase = 'morning_action',
  affinities = {},
}) => {
  const { lang } = useLanguage();
  const isHolidayMap = phase === 'holiday_action';
  const locationCoordinates = isHolidayMap ? HOLIDAY_LOCATION_COORDINATES : LOCATION_COORDINATES;

  // ホバー・キーボードフォーカスの連動（カード ⇔ マップピン）
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const activeId = hoveredId ?? focusedId;

  // 決定確認ダイアログ用の選択中ロケーション
  const [pendingOption, setPendingOption] = useState<ActionLocationOption | null>(null);

  // マウント時に表示SE再生
  useEffect(() => {
    soundManager.playUiSe('shown');
  }, []);

  // ホバー音
  const handleMouseEnter = (id: string) => {
    setHoveredId(id);
    soundManager.playUiSe('hover');
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
    soundManager.playUiSe('hover');
    setPendingOption(opt);
  };

  // YES/NOダイアログで「はい」確定
  const handleConfirmMove = () => {
    if (!pendingOption) return;
    const targetId = pendingOption.id;
    setPendingOption(null);
    soundManager.playUiSe('select');
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

  // 帯にはカードのヒント文を繰り返さず、場所名と相手の様子を出す
  const focusBannerText = useMemo(() => {
    if (!focusHeroineInfo) return null;
    if (focusHeroineInfo.type === 'unknown') {
      return lang === 'ja' ? '誰がいるかは、行ってみないと分からない。' : "You won't know who's there until you go.";
    }
    const name = focusHeroineInfo.name;
    const moods = {
      good: { ja: `${name}は機嫌がよさそうだ。`, en: `${name} seems to be in a good mood.` },
      normal: { ja: `${name}はいつも通りの様子だ。`, en: `${name} seems the same as always.` },
      bad: { ja: `${name}は少し元気がないようだ。`, en: `${name} seems a little down.` },
    };
    return moods[focusHeroineInfo.emotion][lang === 'ja' ? 'ja' : 'en'];
  }, [focusHeroineInfo, lang]);

  return (
    <div className={`action-select-overlay phase-${phase}`}>
      {/* 左側 / 中央: 学校俯瞰マップ表示エリア */}
      <div className="action-map-area">
        <div className="action-map-wrapper">
          <div className="action-map-clip">
            <img
              src={isHolidayMap ? '/assets/backgrounds/town_map.avif' : '/assets/backgrounds/school_aerial.avif'}
              alt={
                isHolidayMap
                  ? lang === 'ja' ? '街の俯瞰マップ' : 'Town aerial map'
                  : lang === 'ja' ? '学校の俯瞰マップ' : 'School aerial map'
              }
              className="action-map-img"
            />

            {/* マップ上の各ロケーションピン（インタラクティブラベル） */}
            {options.map((opt) => {
              const coord = locationCoordinates[opt.id];
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
          {hoveredOption && focusBannerText && (
            <div
              key={`focus_info_${activeId}`}
              className="action-focus-info-banner"
            >
              <div className="action-focus-info-banner-inner">
                <span className="focus-info-label">{hoveredOption.name[lang] || hoveredOption.name.ja}</span>
                <span className="focus-info-text">{focusBannerText}</span>
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
                    alt=""
                    className="heroine-preview-img"
                  />
                  <span className="heroine-preview-name">
                    <span className="heroine-preview-name-main">{focusHeroineInfo.name}</span>
                    <span className="heroine-preview-name-en" aria-hidden="true">{CHARACTERS[focusHeroineInfo.charId]?.name.en}</span>
                  </span>
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
            {isHolidayMap
              ? lang === 'ja' ? '休日の行き先' : 'Holiday Plans'
              : lang === 'ja' ? '移動場所の選択' : 'Choose Destination'}
          </h2>
          <p className="action-sidebar-description">
            {isHolidayMap
              ? lang === 'ja' ? '今日は学校が休み。出かける先を1つ選んでください。' : 'No school today. Choose one place to go.'
              : lang === 'ja' ? '行きたい場所を選んでください。' : 'Choose where you would like to go.'}
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
