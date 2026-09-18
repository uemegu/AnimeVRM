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
      <div className="room-menu-card">
        {/* ヘッダーエリア */}
        <div className="room-card-header">
          <div className="room-ribbon">
            <span>NIGHT PHASE</span>
          </div>
          <h3 className="room-title">
            <span>
              {lang === 'ja'
                ? `自室（第${day}日 夜）`
                : `My Room (Day ${day} Night)`}
            </span>
          </h3>
          <p className="room-subtitle">
            {lang === 'ja'
              ? '今日の出来事を振り返り、明日への準備を整えましょう。'
              : 'Reflect on today and prepare for tomorrow.'}
          </p>
        </div>

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
          {/* 就寝する（翌日へ）- 最重要アクションのため一番上へ配置 */}
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
    </div>
  );
};
