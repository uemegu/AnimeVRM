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
        {/* ヘッダーエリア */}
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
            <div className="affinity-panel-inner">
              <div className="affinity-panel-title">
                <span className="affinity-panel-badge">STATUS</span>
                <span>
                  {lang === 'ja' ? 'ヒロイン好感度' : 'Heroine Affinities'}
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
          </div>

          {/* コマンドカード群（ActionSelectModalと同等のUIスタイル） */}
          <div className="room-card-list">
            {/* 就寝する - 最重要アクション */}
            <div
              className="room-menu-card card-sleep"
              role="button"
              tabIndex={0}
              onClick={onSleep}
              onKeyDown={(e) => e.key === 'Enter' && onSleep()}
            >
              <div className="room-card-inner">
                <div className="room-card-main">
                  <span className="room-card-title">
                    {lang === 'ja' ? '就寝する' : 'Sleep'}
                  </span>
                  <span className="room-badge badge-sleep">SLEEP</span>
                </div>
                <div className="room-hint-box">
                  <span className="room-hint-label">INFO</span>
                  <span className="room-hint-text">
                    {lang === 'ja'
                      ? '一日を終えて翌日へ進む'
                      : 'End the day and wake up tomorrow'}
                  </span>
                </div>
              </div>
            </div>

            {/* ゲームをセーブする */}
            <div
              className="room-menu-card"
              role="button"
              tabIndex={0}
              onClick={onSave}
              onKeyDown={(e) => e.key === 'Enter' && onSave()}
            >
              <div className="room-card-inner">
                <div className="room-card-main">
                  <span className="room-card-title">
                    {lang === 'ja' ? 'ゲームをセーブする' : 'Save Game'}
                  </span>
                  <span className="room-badge badge-save">SAVE</span>
                </div>
                <div className="room-hint-box">
                  <span className="room-hint-label">INFO</span>
                  <span className="room-hint-text">
                    {lang === 'ja'
                      ? '現在の進行状況を保存する'
                      : 'Save current progress'}
                  </span>
                </div>
              </div>
            </div>

            {/* セーブデータをロードする */}
            <div
              className="room-menu-card"
              role="button"
              tabIndex={0}
              onClick={onLoad}
              onKeyDown={(e) => e.key === 'Enter' && onLoad()}
            >
              <div className="room-card-inner">
                <div className="room-card-main">
                  <span className="room-card-title">
                    {lang === 'ja' ? 'セーブデータをロードする' : 'Load Game'}
                  </span>
                  <span className="room-badge badge-load">LOAD</span>
                </div>
                <div className="room-hint-box">
                  <span className="room-hint-label">INFO</span>
                  <span className="room-hint-text">
                    {lang === 'ja'
                      ? '保存したデータから再開する'
                      : 'Resume from saved data'}
                  </span>
                </div>
              </div>
            </div>

            {/* この1日をやり直す */}
            <div
              className="room-menu-card card-rollback"
              role="button"
              tabIndex={0}
              onClick={onRollbackDay}
              onKeyDown={(e) => e.key === 'Enter' && onRollbackDay()}
            >
              <div className="room-card-inner">
                <div className="room-card-main">
                  <span className="room-card-title">
                    {lang === 'ja'
                      ? 'この1日をやり直す'
                      : 'Restart Day'}
                  </span>
                  <span className="room-badge badge-rollback">REWIND</span>
                </div>
                <div className="room-hint-box">
                  <span className="room-hint-label">INFO</span>
                  <span className="room-hint-text">
                    {lang === 'ja'
                      ? '今朝の開始時点へ巻き戻す'
                      : 'Rewind to this morning'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
