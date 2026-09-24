import React, { useEffect, useRef } from 'react';
import { SupportedLanguage, resolveLocalizedText } from '../../types/scenario';
import { HeroineCommunicationStatus, HeroineId } from '../../types/communication';
import { CHARACTERS } from '../../data/characters';
import { soundManager } from '../../services/audio/SoundManager';
import './Phone.css';

export interface PhoneNotificationCardProps {
  status: HeroineCommunicationStatus;
  lang: SupportedLanguage;
  onAnswerCall: (characterId: HeroineId) => void;
  onRejectCall: (characterId: HeroineId) => void;
  onOpenMail: (characterId: HeroineId) => void;
  onDismissMail: (characterId: HeroineId) => void;
}

export const PhoneNotificationCard: React.FC<PhoneNotificationCardProps> = ({
  status,
  lang,
  onAnswerCall,
  onRejectCall,
  onOpenMail,
  onDismissMail,
}) => {
  const char = CHARACTERS[status.characterId];
  const charName = char ? resolveLocalizedText(char.name, lang) : status.characterId;
  const heroineColor = char?.themeColor || '#38bdf8';
  const avatarImgUrl = `/assets/characters/${status.characterId}_normal.avif`;

  const stopVibeRef = useRef<(() => void) | null>(null);
  const playedMailScenarioRef = useRef<string | null>(null);

  // 着信バイブ音のループ再生制御
  useEffect(() => {
    if (!status.hasIncomingCall) return;
    const stop = soundManager.playLoopSe('/sounds/phone_vibe.mp3');
    stopVibeRef.current = stop;
    return () => {
      stop();
      stopVibeRef.current = null;
    };
  }, [status.hasIncomingCall]);

  // 新着メール通知音（添付音声ファイル）の単発再生制御
  useEffect(() => {
    if (status.unreadMailCount > 0 && status.activeMailScenario) {
      const scenarioKey = `${status.characterId}_${status.activeMailScenario.id}`;
      if (playedMailScenarioRef.current !== scenarioKey) {
        playedMailScenarioRef.current = scenarioKey;
        soundManager.playSe('/sounds/mail_notification.mp3');
      }
    }
  }, [status.unreadMailCount, status.activeMailScenario, status.characterId]);

  const stopAudio = () => {
    stopVibeRef.current?.();
    stopVibeRef.current = null;
  };

  const handleAnswer = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    stopAudio();
    onAnswerCall(status.characterId);
  };

  const handleReject = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopAudio();
    onRejectCall(status.characterId);
  };

  // 1. TV電話の着信（メッセージ文は非表示で、受話ボタンを表示）
  if (status.hasIncomingCall) {
    return (
      <div
        className="phone-notification-card is-calling"
        style={{ '--heroine-color': heroineColor } as React.CSSProperties}
        onClick={handleAnswer}
        role="alert"
        aria-label={lang === 'ja' ? `${charName}からの着信` : `Incoming call from ${charName}`}
      >
        <div className="phone-notif-avatar-box">
          <img
            src={avatarImgUrl}
            alt={charName}
            className="phone-notif-avatar-img"
          />
        </div>

        <div className="phone-notif-body">
          <div className="phone-notif-header">
            <span className="phone-notif-name">{charName}</span>
          </div>
          <div className="phone-notif-call-label">
            <span>{lang === 'ja' ? '着信中...' : 'Incoming Call...'}</span>
          </div>
        </div>

        <div className="phone-notif-actions">
          <button
            type="button"
            className="phone-notif-btn-answer"
            onClick={handleAnswer}
          >
            {lang === 'ja' ? '応答' : 'Answer'}
          </button>
          <button
            type="button"
            className="phone-notif-btn-close"
            onClick={handleReject}
            aria-label={lang === 'ja' ? '閉じる' : 'Dismiss'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // 2. メールの新着通知（メッセージ文プレビューを表示）
  if (status.unreadMailCount > 0 && status.activeMailScenario) {
    const previewText = resolveLocalizedText(status.activeMailScenario.previewText, lang);
    return (
      <div
        className="phone-notification-card"
        style={{ '--heroine-color': heroineColor } as React.CSSProperties}
        onClick={() => onOpenMail(status.characterId)}
        role="alert"
        aria-label={lang === 'ja' ? `${charName}からの新着メール` : `New message from ${charName}`}
      >
        <div className="phone-notif-avatar-box">
          <img
            src={avatarImgUrl}
            alt={charName}
            className="phone-notif-avatar-img"
          />
        </div>

        <div className="phone-notif-body">
          <div className="phone-notif-header">
            <span className="phone-notif-name">{charName}</span>
            <span className="phone-notif-icon-tag" aria-hidden="true">
              {/* メールアイコン */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
            </span>
            <span className="phone-notif-time">{status.activeMailScenario.time}</span>
          </div>
          <div className="phone-notif-text">{previewText}</div>
        </div>

        <div className="phone-notif-actions">
          <button
            type="button"
            className="phone-notif-btn-close"
            onClick={(e) => {
              e.stopPropagation();
              onDismissMail(status.characterId);
            }}
            aria-label={lang === 'ja' ? '閉じる' : 'Dismiss'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return null;
};
