import React from 'react';
import { SupportedLanguage } from '../../types/scenario';
import { CHARACTERS } from '../../data/characters';

interface NightRoomViewProps {
  day: number;
  affinities: Record<string, number>;
  lang: SupportedLanguage;
  onSave: () => void;
  onLoad: () => void;
  onRollbackDay: () => void;
  onSleep: () => void;
}

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
    <div className="room-menu-card">
      <div className="room-card-header">
        <h3 style={{ margin: 0, fontSize: '1.4rem' }}>
          🌙 {lang === 'ja' ? `自室（第${day}日 夜）` : `My Room (Day ${day} Night)`}
        </h3>
        <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
          {lang === 'ja'
            ? '今日の出来事を振り返り、明日への準備を整えましょう。'
            : 'Reflect on today and prepare for tomorrow.'}
        </p>
      </div>

      {/* 現在の親愛度ステータス */}
      <div className="affinity-status-panel">
        <div className="affinity-panel-title">
          {lang === 'ja' ? '❤️ キャラクター好感度' : '❤️ Character Affinities'}
        </div>
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

      {/* コマンドボタン群 */}
      <div className="room-button-group">
        <button className="room-menu-button primary" onClick={onSave}>
          💾 {lang === 'ja' ? 'ゲームをセーブする' : 'Save Game'}
        </button>
        <button className="room-menu-button" onClick={onLoad}>
          📂 {lang === 'ja' ? 'セーブデータをロード' : 'Load Game'}
        </button>
        <button className="room-menu-button warning" onClick={onRollbackDay}>
          ⏪ {lang === 'ja' ? 'この1日をやり直す（朝へ巻き戻し）' : 'Restart This Day'}
        </button>
        <button className="room-menu-button success" onClick={onSleep}>
          🛏️ {lang === 'ja' ? '就寝する（翌日へ）' : 'Sleep (Next Day)'}
        </button>
      </div>
    </div>
  );
};
