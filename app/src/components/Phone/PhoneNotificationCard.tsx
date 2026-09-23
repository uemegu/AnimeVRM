import React, { useEffect, useRef } from 'react';
import { SupportedLanguage, resolveLocalizedText } from '../../types/scenario';
import { HeroineCommunicationStatus, HeroineId } from '../../types/communication';
import { CHARACTERS } from '../../data/characters';
import './Phone.css';

export interface PhoneNotificationCardProps {
  status: HeroineCommunicationStatus;
  lang: SupportedLanguage;
  isMuted?: boolean;
  onAnswerCall: (characterId: HeroineId) => void;
  onRejectCall: (characterId: HeroineId) => void;
  onOpenMail: (characterId: HeroineId) => void;
  onDismissMail: (characterId: HeroineId) => void;
}

export const PhoneNotificationCard: React.FC<PhoneNotificationCardProps> = ({
  status,
  lang,
  isMuted = false,
  onAnswerCall,
  onRejectCall,
  onOpenMail,
  onDismissMail,
}) => {
  const char = CHARACTERS[status.characterId];
  const charName = char ? resolveLocalizedText(char.name, lang) : status.characterId;
  const heroineColor = char?.themeColor || '#38bdf8';
  const avatarImgUrl = `/assets/characters/${status.characterId}_normal.avif`;

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 着信バイブ音のループ再生制御
  useEffect(() => {
    if (status.hasIncomingCall && !isMuted) {
      const audio = new Audio('/sounds/phone_vibe.mp3');
      audio.loop = true;
      audio.play().catch(() => {
        // ユーザーインタラクション制限等による自動再生ブロックのフォールバック
      });
      audioRef.current = audio;

      return () => {
        audio.pause();
        audio.currentTime = 0;
        audioRef.current = null;
      };
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, [status.hasIncomingCall, isMuted]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
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
          <div className="phone-notif-call-badge" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 15.5c-1.2 0-2.4-.2-3.6-.6-.3-.1-.7 0-1 .2l-2.2 2.2c-2.8-1.4-5.1-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.4-1.1-.6-2.3-.6-3.5 0-.6-.4-1-1-1H4c-.6 0-1 .4-1 1 0 9.4 7.6 17 17 17 .6 0 1-.4 1-1v-3.5c0-.6-.4-1-1-1z" />
            </svg>
          </div>
        </div>

        <div className="phone-notif-body">
          <div className="phone-notif-header">
            <span className="phone-notif-name">{charName}</span>
            <span className="phone-notif-icon-tag" aria-hidden="true">
              {/* ビデオ通話アイコン */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
              </svg>
            </span>
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
