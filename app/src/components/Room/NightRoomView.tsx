import React from 'react';
import { SupportedLanguage } from '../../types/scenario';
import { CHARACTERS } from '../../data/characters';
import './NightRoomView.css';

interface NightRoomViewProps {
  day: number;
  affinities: Record<string, number>;
  lang: SupportedLanguage;
  onSave: () => void;
  onLoad: () => void;
  onRollbackDay: () => void;
  onSleep: () => void;
}

// 好感度最大値の目安（ゲージ計算用）
const MAX_AFFINITY_SCALE = 10;

export const NightRoomView: React.FC<NightRoomViewProps> = ({
  day,
  affinities,
  lang,
  onSave,
  onLoad,
  onRollbackDay,
  onSleep,
}) => {
  return (
    <div className="room-overlay">
      {/* 左側 / 中央: 自室画像表示エリア */}
      <div className="room-main-area">
        <div className="room-image-wrapper">
          <img
            src="/textures/myroom-night_far.avif"
            alt={lang === 'ja' ? '自室' : 'My Room'}
            className="room-main-img"
          />
        </div>
      </div>

      {/* 右側: 夜の自室コマンド・ステータスサイドバー */}
      <aside className="room-sidebar">
        {/* ヘッダーエリア（NIGHT PHASEラベルは削除） */}
        <header className="room-sidebar-header">
          <h2 className="room-sidebar-title">
            {lang === 'ja'
              ? `自室（第${day}日 夜）`
              : `My Room (Day ${day} Night)`}
          </h2>
          <p className="room-sidebar-subtitle">
            {lang === 'ja'
              ? '今日の出来事を振り返り、明日への準備を整えましょう。'
              : 'Reflect on today and prepare for tomorrow.'}
          </p>
        </header>

        <div className="room-sidebar-content">
          {/* 現在の親愛度ステータス（好感度メーター付き） */}
          <div className="affinity-status-panel">
            <div className="affinity-panel-title">
              <span>
                {lang === 'ja' ? 'キャラクター好感度' : 'Character Affinities'}
              </span>
            </div>
            <div className="affinity-list">
              {Object.entries(CHARACTERS).map(([charId, char]) => {
                const val = affinities[charId] || 0;
                const name = char.name[lang] || char.name.ja;
                const percent = Math.min(100, Math.round((val / MAX_AFFINITY_SCALE) * 100));

                return (
                  <div key={charId} className="affinity-item">
                    <div className="affinity-item-header">
                      <span
                        className="affinity-name"
                        style={{ color: char.themeColor }}
                      >
                        {name}
                      </span>
                      <span className="affinity-val">Lv. {val}</span>
                    </div>
                    {/* 好感度プログレスバー */}
                    <div className="affinity-bar-track">
                      <div
                        className="affinity-bar-fill"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: char.themeColor || '#ec4899',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* コマンドボタン群 */}
          <div className="room-button-group">
            {/* 就寝する（翌日へ）- 最重要アクション */}
            <button
              type="button"
              className="room-menu-button success"
              onClick={onSleep}
            >
              <div className="room-btn-inner">
                <span className="room-btn-text">
                  {lang === 'ja' ? '就寝する（翌日へ進む）' : 'Sleep (Next Day)'}
                </span>
              </div>
            </button>

            {/* セーブ */}
            <button
              type="button"
              className="room-menu-button primary"
              onClick={onSave}
            >
              <div className="room-btn-inner">
                <span className="room-btn-text">
                  {lang === 'ja' ? 'ゲームをセーブする' : 'Save Game'}
                </span>
              </div>
            </button>

            {/* ロード */}
            <button
              type="button"
              className="room-menu-button"
              onClick={onLoad}
            >
              <div className="room-btn-inner">
                <span className="room-btn-text">
                  {lang === 'ja' ? 'セーブデータをロード' : 'Load Game'}
                </span>
              </div>
            </button>

            {/* やり直し */}
            <button
              type="button"
              className="room-menu-button warning"
              onClick={onRollbackDay}
            >
              <div className="room-btn-inner">
                <span className="room-btn-text">
                  {lang === 'ja'
                    ? 'この1日をやり直す（朝へ巻き戻し）'
                    : 'Restart This Day'}
                </span>
              </div>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
