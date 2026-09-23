import React, { useState, useMemo } from 'react';
import { SupportedLanguage } from '../../types/scenario';
import { CHARACTERS } from '../../data/characters';
import { HeroineId, CallScenario, MailScenario } from '../../types/communication';
import {
  CALL_SCENARIOS,
  MAIL_SCENARIOS,
  getHeroineCommunicationStatuses,
} from '../../data/communicationData';
import { PhoneNotificationCard } from '../../components/Phone/PhoneNotificationCard';
import { PhoneCallModal } from '../../components/Phone/PhoneCallModal';
import { PhoneMailModal } from '../../components/Phone/PhoneMailModal';
import '../../components/Room/NightRoomView.css';

export interface NightRoomPageProps {
  day: number;
  affinities: Record<string, number>;
  flags?: Record<string, boolean | number | string>;
  scenarioHistory?: Array<{ scenarioId: string; day: number; type: 'choice' | 'completed'; choiceId?: string }>;
  lang: SupportedLanguage;
  isMuted?: boolean;
  onSave: () => void;
  onLoad: () => void;
  onRollbackDay: () => void;
  onSleep: () => void;
  onUpdateFlags?: (flags: Record<string, boolean | number | string>) => void;
  onUpdateAffinity?: (charId: string, delta: number) => void;
}

// 好感度最大値の目安（ゲージ計算用）
const MAX_AFFINITY_SCALE = 10;

export const NightRoomPage: React.FC<NightRoomPageProps> = ({
  day,
  affinities,
  flags = {},
  lang,
  isMuted = false,
  onSave,
  onLoad,
  onRollbackDay,
  onSleep,
  onUpdateFlags,
  onUpdateAffinity,
}) => {
  // モーダル管理
  const [activeCallScenario, setActiveCallScenario] = useState<CallScenario | null>(null);
  const [activeMailScenario, setActiveMailScenario] = useState<MailScenario | null>(null);

  // 通知カードの非表示セット（ユーザーが×を押したもの）
  const [dismissedNotifIds, setDismissedNotifIds] = useState<Set<string>>(new Set());

  // 各ヒロインの夜のコミュニケーション状態を計算
  const heroineStatuses = useMemo(() => {
    return getHeroineCommunicationStatuses(day, flags);
  }, [day, flags]);

  // モーダルが開いている間は通知カードを非表示にする
  const isModalOpen = Boolean(activeCallScenario || activeMailScenario);

  // 現在アクティブな着信またはメール通知の決定
  const activeNotificationStatus = useMemo(() => {
    if (isModalOpen) return null;

    // 1. 着信が最優先
    for (const status of Object.values(heroineStatuses)) {
      if (status.hasIncomingCall && !dismissedNotifIds.has(`call_${status.characterId}`)) {
        return status;
      }
    }
    // 2. 新着メール
    for (const status of Object.values(heroineStatuses)) {
      if (status.unreadMailCount > 0 && !dismissedNotifIds.has(`mail_${status.characterId}`)) {
        return status;
      }
    }
    return null;
  }, [heroineStatuses, dismissedNotifIds, isModalOpen]);

  // 通話開始ハンドラー
  const handleAnswerCall = (characterId: HeroineId) => {
    const scenario = CALL_SCENARIOS[`${characterId}_day${day}_call`] || CALL_SCENARIOS.aoi_day1_call;
    setActiveCallScenario(scenario);
  };

  // 着信拒否ハンドラー（×ボタン）
  const handleRejectCall = (characterId: HeroineId) => {
    setDismissedNotifIds((prev) => new Set(prev).add(`call_${characterId}`));
    onUpdateFlags?.({
      [`night_call_rejected_day${day}_${characterId}`]: true,
    });
  };

  // メールを開くハンドラー
  const handleOpenMail = (characterId: HeroineId) => {
    const scenario = MAIL_SCENARIOS[`${characterId}_day${day}_mail`] || MAIL_SCENARIOS.aoi_day1_mail;
    setActiveMailScenario(scenario);
  };

  // メール通知閉じるハンドラー
  const handleDismissMail = (characterId: HeroineId) => {
    setDismissedNotifIds((prev) => new Set(prev).add(`mail_${characterId}`));
  };

  // 通話終了
  const handleCloseCallModal = (
    flagsToUpdate?: Record<string, boolean | number | string>,
    affinityDelta?: Record<string, number>
  ) => {
    if (flagsToUpdate && onUpdateFlags) {
      onUpdateFlags(flagsToUpdate);
    }
    if (affinityDelta && onUpdateAffinity) {
      for (const [charId, delta] of Object.entries(affinityDelta)) {
        onUpdateAffinity(charId, delta);
      }
    }
    setActiveCallScenario(null);
  };

  // メール終了
  const handleCloseMailModal = (
    flagsToUpdate?: Record<string, boolean | number | string>,
    affinityDelta?: Record<string, number>
  ) => {
    if (flagsToUpdate && onUpdateFlags) {
      onUpdateFlags(flagsToUpdate);
    }
    if (affinityDelta && onUpdateAffinity) {
      for (const [charId, delta] of Object.entries(affinityDelta)) {
        onUpdateAffinity(charId, delta);
      }
    }
    setActiveMailScenario(null);
  };

  return (
    <div className="room-overlay">
      {/* 左側 / 中央: 自室画像表示エリア */}
      <div className="room-main-area">
        <div className="room-image-wrapper">
          <div className="room-image-clip">
            <img
              src="/textures/myroom-night_far.avif"
              alt={lang === 'ja' ? '自室' : 'My Room'}
              className="room-main-img"
            />
          </div>
        </div>

        {/* 画面下部: 着信または新着メール通知カード */}
        {activeNotificationStatus && (
          <PhoneNotificationCard
            status={activeNotificationStatus}
            lang={lang}
            isMuted={isMuted}
            onAnswerCall={handleAnswerCall}
            onRejectCall={handleRejectCall}
            onOpenMail={handleOpenMail}
            onDismissMail={handleDismissMail}
          />
        )}
      </div>

      {/* 右側: 夜の自室コマンド・ステータスサイドバー（元の構成） */}
      <aside className="room-sidebar">
        {/* ヘッダーエリア */}
        <header className="room-sidebar-header">
          <p className="room-sidebar-eyebrow">DAY {day} / NIGHT</p>
          <h2 className="room-sidebar-title">
            {lang === 'ja' ? '自室' : 'My Room'}
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
                <span>
                  {lang === 'ja' ? 'ヒロイン好感度' : 'Heroine Affinities'}
                </span>
              </div>
              <div className="affinity-list">
                {Object.entries(CHARACTERS).map(([charId, char]) => {
                  if (charId === 'god') return null; // ヒロイン3人のみ表示
                  const val = affinities[charId] || 0;
                  const name = char.name[lang] || char.name.ja;
                  const percent = Math.min(100, Math.round((val / MAX_AFFINITY_SCALE) * 100));

                  return (
                    <div
                      key={charId}
                      className="affinity-item"
                      style={{ '--affinity-color': char.themeColor } as React.CSSProperties}
                    >
                      <div className="affinity-item-header">
                        <span className="affinity-name">{name}</span>
                        <span className="affinity-val">Lv. {val}</span>
                      </div>
                      <div className="affinity-bar-track">
                        <div
                          className="affinity-bar-fill"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* コマンドカード群（元の構成） */}
          <div className="room-card-list">
            {/* 就寝する */}
            <button
              type="button"
              className="room-menu-card card-sleep"
              onClick={onSleep}
            >
              <svg className="room-sleep-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.9 13.3A8.8 8.8 0 0 1 10.7 3.1 9 9 0 1 0 20.9 13.3Z" />
              </svg>
              <span className="room-card-inner">
                <span className="room-card-main">
                  <span className="room-card-title">
                    {lang === 'ja' ? '就寝する' : 'Sleep'}
                  </span>
                </span>
                <span className="room-hint-box">
                  <span className="room-hint-text">
                    {lang === 'ja'
                      ? '一日を終えて翌日へ進む'
                      : 'End the day and wake up tomorrow'}
                  </span>
                </span>
              </span>
              <span className="room-card-arrow" aria-hidden="true">›</span>
            </button>

            {/* ゲームをセーブする */}
            <button
              type="button"
              className="room-menu-card"
              onClick={onSave}
            >
              <span className="room-card-inner">
                <span className="room-card-main">
                  <span className="room-card-title">
                    {lang === 'ja' ? 'ゲームをセーブする' : 'Save Game'}
                  </span>
                </span>
                <span className="room-hint-box">
                  <span className="room-hint-text">
                    {lang === 'ja'
                      ? '現在の進行状況を保存する'
                      : 'Save current progress'}
                  </span>
                </span>
              </span>
              <span className="room-card-arrow" aria-hidden="true">›</span>
            </button>

            {/* セーブデータをロードする */}
            <button
              type="button"
              className="room-menu-card"
              onClick={onLoad}
            >
              <span className="room-card-inner">
                <span className="room-card-main">
                  <span className="room-card-title">
                    {lang === 'ja' ? 'セーブデータをロードする' : 'Load Game'}
                  </span>
                </span>
                <span className="room-hint-box">
                  <span className="room-hint-text">
                    {lang === 'ja'
                      ? '保存したデータから再開する'
                      : 'Resume from saved data'}
                  </span>
                </span>
              </span>
              <span className="room-card-arrow" aria-hidden="true">›</span>
            </button>

            {/* この1日をやり直す */}
            <button
              type="button"
              className="room-menu-card card-rollback"
              onClick={onRollbackDay}
            >
              <span className="room-card-inner">
                <span className="room-card-main">
                  <span className="room-card-title">
                    {lang === 'ja'
                      ? 'この1日をやり直す'
                      : 'Restart Day'}
                  </span>
                </span>
                <span className="room-hint-box">
                  <span className="room-hint-text">
                    {lang === 'ja'
                      ? '今朝の開始時点へ巻き戻す'
                      : 'Rewind to this morning'}
                  </span>
                </span>
              </span>
              <span className="room-card-arrow" aria-hidden="true">›</span>
            </button>
          </div>
        </div>
      </aside>

      {/* TV電話モーダル */}
      {activeCallScenario && (
        <PhoneCallModal
          scenario={activeCallScenario}
          lang={lang}
          onClose={handleCloseCallModal}
        />
      )}

      {/* メールモーダル */}
      {activeMailScenario && (
        <PhoneMailModal
          scenario={activeMailScenario}
          lang={lang}
          alreadyReplied={Boolean(flags[`night_mail_replied_day${activeMailScenario.day}_${activeMailScenario.characterId}`])}
          onClose={handleCloseMailModal}
        />
      )}
    </div>
  );
};
