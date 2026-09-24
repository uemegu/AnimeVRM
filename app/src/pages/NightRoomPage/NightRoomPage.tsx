import React, { useState, useMemo, useEffect } from 'react';
import { CHARACTERS, HEROINE_IDS } from '../../data/characters';
import { CallScenario, CommunicationResult, MailScenario, NightCommunication } from '../../types/communication';
import { scenarioRepository } from '../../services/scenario/ScenarioRepository';
import { PhoneNotificationCard } from '../../components/Phone/PhoneNotificationCard';
import { PhoneCallModal } from '../../components/Phone/PhoneCallModal';
import { PhoneMailModal } from '../../components/Phone/PhoneMailModal';
import '../../components/Room/NightRoomView.css';
import { useLanguage } from '../../contexts/LanguageContext';

export interface NightRoomPageProps {
  day: number;
  affinities: Record<string, number>;
  /** 今夜届く電話・メール（ScheduleManager.getNightCommunications） */
  communications: NightCommunication[];
  onSave: () => void;
  onLoad: () => void;
  onRollbackDay: () => void;
  onSleep: () => void;
  /** 電話に出終えた・着信を拒否した・メールを閉じたとき */
  onCommunicationFinished: (result: CommunicationResult) => void;
  /** 電話・メール本文の読み込みに失敗したとき */
  onLoadError: (error: unknown) => void;
}

// 好感度最大値の目安（ゲージ計算用）
const MAX_AFFINITY_SCALE = 10;

export const NightRoomPage: React.FC<NightRoomPageProps> = ({
  day,
  affinities,
  communications,
  onSave,
  onLoad,
  onRollbackDay,
  onSleep,
  onCommunicationFinished,
  onLoadError,
}) => {
  const { lang } = useLanguage();
  // モーダル管理
  const [activeCallScenario, setActiveCallScenario] = useState<CallScenario | null>(null);
  const [activeMailScenario, setActiveMailScenario] = useState<MailScenario | null>(null);

  // 通知カードの非表示セット（ユーザーが×を押したメール）
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // 通知が出ている電話・メールの本文を先読みしておく
  useEffect(() => {
    for (const communication of communications) {
      if (communication.done) continue;
      const loading =
        communication.kind === 'call'
          ? scenarioRepository.loadCall(communication.id)
          : scenarioRepository.loadMail(communication.id);
      loading.catch(() => {});
    }
  }, [communications]);

  // モーダルが開いている間は通知カードを非表示にする
  const isModalOpen = Boolean(activeCallScenario || activeMailScenario);

  // 表示する通知（着信を優先し、次に未読メール）
  const activeNotification = useMemo(() => {
    if (isModalOpen) return null;
    const pending = communications.filter((c) => !c.done && !dismissedIds.has(c.id));
    return pending.find((c) => c.kind === 'call') ?? pending.find((c) => c.kind === 'mail') ?? null;
  }, [communications, dismissedIds, isModalOpen]);

  // 通話開始
  const handleAnswerCall = (communication: NightCommunication) => {
    scenarioRepository.loadCall(communication.id).then(setActiveCallScenario, onLoadError);
  };

  // 着信拒否（×ボタン）。拒否も「今夜の1件」として完了扱いにする
  const handleRejectCall = (communication: NightCommunication) => {
    onCommunicationFinished({ id: communication.id, flags: {}, affinityDelta: {}, choiceIds: ['rejected'] });
  };

  // メールを開く
  const handleOpenMail = (communication: NightCommunication) => {
    scenarioRepository.loadMail(communication.id).then(setActiveMailScenario, onLoadError);
  };

  // メール通知を閉じる（未読のまま。今夜は再表示しない）
  const handleDismissMail = (communication: NightCommunication) => {
    setDismissedIds((prev) => new Set(prev).add(communication.id));
  };

  const handleCloseCallModal = (result: Omit<CommunicationResult, 'id'>) => {
    if (activeCallScenario) onCommunicationFinished({ id: activeCallScenario.id, ...result });
    setActiveCallScenario(null);
  };

  const handleCloseMailModal = (result: Omit<CommunicationResult, 'id'>) => {
    if (activeMailScenario) onCommunicationFinished({ id: activeMailScenario.id, ...result });
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
        {activeNotification && (
          <PhoneNotificationCard
            key={activeNotification.id}
            communication={activeNotification}
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
                {HEROINE_IDS.map((charId) => {
                  const char = CHARACTERS[charId];
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
          onClose={handleCloseCallModal}
        />
      )}

      {/* メールモーダル */}
      {activeMailScenario && (
        <PhoneMailModal
          scenario={activeMailScenario}
          onClose={handleCloseMailModal}
        />
      )}
    </div>
  );
};
