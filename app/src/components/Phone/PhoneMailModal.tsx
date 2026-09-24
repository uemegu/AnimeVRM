import React, { useState, useRef, useEffect } from 'react';
import { SupportedLanguage, resolveLocalizedText } from '../../types/scenario';
import { MailScenario, MailReplyOption, MailMessage } from '../../types/communication';
import { CHARACTERS } from '../../data/characters';
import { soundManager } from '../../services/audio/SoundManager';
import './Phone.css';

export interface PhoneMailModalProps {
  scenario: MailScenario;
  lang: SupportedLanguage;
  alreadyReplied?: boolean;
  onClose: (flagsToUpdate?: Record<string, boolean | number | string>, affinityDelta?: Record<string, number>) => void;
}

export const PhoneMailModal: React.FC<PhoneMailModalProps> = ({
  scenario,
  lang,
  alreadyReplied = false,
  onClose,
}) => {
  const [messages, setMessages] = useState<MailMessage[]>(() => [...scenario.messages]);
  const [isReplied, setIsReplied] = useState<boolean>(alreadyReplied);
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const accumulatedFlagsRef = useRef<Record<string, boolean | number | string>>({
    [`night_mail_read_day${scenario.day}_${scenario.characterId}`]: true,
  });
  const accumulatedAffinityRef = useRef<Record<string, number>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const char = CHARACTERS[scenario.characterId];
  const charName = char ? resolveLocalizedText(char.name, lang) : scenario.characterId;
  const heroineColor = char?.themeColor || '#38bdf8';
  const avatarImgUrl = `/assets/characters/${scenario.characterId}_normal.avif`;

  // 最下部自動スクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // 返信選択ハンドラー
  const handleSelectReply = (option: MailReplyOption) => {
    if (isReplied) return;

    // 1. プレイヤーの返信メッセージを追加
    const playerMsg: MailMessage = {
      id: `player_reply_${Date.now()}`,
      sender: 'player',
      text: option.text,
      time: '23:43',
    };

    setMessages((prev) => [...prev, playerMsg]);
    setIsReplied(true);

    if (option.setFlags) {
      Object.assign(accumulatedFlagsRef.current, option.setFlags);
    }
    accumulatedFlagsRef.current[`night_mail_replied_day${scenario.day}_${scenario.characterId}`] = true;

    if (option.addAffinity) {
      for (const [key, val] of Object.entries(option.addAffinity)) {
        accumulatedAffinityRef.current[key] = (accumulatedAffinityRef.current[key] || 0) + val;
      }
    }

    // 2. 相手からのリアクション返信（入力中演出を挟んで追加）
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const heroineReactionMsg: MailMessage = {
        id: `heroine_react_${Date.now()}`,
        sender: 'heroine',
        text: option.reactionText,
        time: option.reactionTime || '23:44',
      };
      setMessages((prev) => [...prev, heroineReactionMsg]);

      soundManager.playSe('/sounds/mail_notification.mp3');
    }, 1100);
  };

  const handleBack = () => {
    onClose(accumulatedFlagsRef.current, accumulatedAffinityRef.current);
  };

  return (
    <div className="phone-modal-overlay">
      <div
        className="phone-device-frame"
        style={{ '--heroine-color': heroineColor } as React.CSSProperties}
      >
        {/* Dynamic Island / Top Notch */}
        <div className="phone-screen-notch">
          <div className="phone-notch-lens" />
        </div>

        {/* Top Status Bar */}
        <div className="phone-status-bar" style={{ background: '#ffffff', color: '#0f172a' }}>
          <span className="phone-status-left">23:42</span>
          <div className="phone-status-right">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98A16.88 16.88 0 0 0 12 4z" />
            </svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" />
            </svg>
          </div>
        </div>

        {/* Messaging Container */}
        <div className="phone-mail-container">
          {/* Header */}
          <div className="phone-mail-header">
            <button
              type="button"
              className="phone-mail-btn-back"
              onClick={handleBack}
              aria-label={lang === 'ja' ? '戻る' : 'Back'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <img
              src={avatarImgUrl}
              alt={charName}
              className="phone-mail-target-avatar"
            />
            <div className="phone-mail-target-info">
              <span className="phone-mail-target-name">{charName}</span>
              <span className="phone-mail-target-sub">
                {lang === 'ja' ? 'オンライン' : 'Online'}
              </span>
            </div>
          </div>

          {/* Messages Timeline */}
          <div className="phone-mail-messages-area">
            <div className="phone-mail-date-divider">
              {lang === 'ja' ? '今日' : 'Today'}
            </div>

            {messages.map((msg) => {
              const isHeroine = msg.sender === 'heroine';
              const text = resolveLocalizedText(msg.text, lang);

              if (isHeroine) {
                return (
                  <div key={msg.id} className="phone-msg-row heroine">
                    <img
                      src={avatarImgUrl}
                      alt={charName}
                      className="phone-mail-target-avatar"
                      style={{ width: 28, height: 28 }}
                    />
                    <div className="phone-msg-bubble heroine">
                      {text}
                    </div>
                    <span className="phone-msg-time">{msg.time}</span>
                  </div>
                );
              } else {
                return (
                  <div key={msg.id} className="phone-msg-row player">
                    <div className="phone-msg-bubble player">
                      {text}
                    </div>
                    <div className="phone-msg-meta player">
                      <span className="phone-msg-read-mark">
                        {lang === 'ja' ? '既読' : 'Read'}
                      </span>
                      <span className="phone-msg-time">{msg.time}</span>
                    </div>
                  </div>
                );
              }
            })}

            {isTyping && (
              <div className="phone-msg-row heroine">
                <img
                  src={avatarImgUrl}
                  alt={charName}
                  className="phone-mail-target-avatar"
                  style={{ width: 28, height: 28 }}
                />
                <div className="phone-msg-bubble heroine" style={{ color: '#94a3b8' }}>
                  {lang === 'ja' ? '入力中...' : 'typing...'}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Reply Area */}
          <div className="phone-mail-reply-box">
            {!isReplied && scenario.replyOptions && scenario.replyOptions.length > 0 ? (
              <>
                <div className="phone-mail-reply-label">
                  {lang === 'ja' ? '返信メッセージを選択' : 'Select Reply Message'}
                </div>
                <div className="phone-mail-reply-options">
                  {scenario.replyOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="phone-mail-reply-btn"
                      onClick={() => handleSelectReply(opt)}
                    >
                      {resolveLocalizedText(opt.text, lang)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="phone-mail-already-replied">
                {lang === 'ja' ? '返信済み' : 'Already Replied'}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Home Indicator */}
        <div className="phone-home-indicator" style={{ background: '#000000' }} />
      </div>
    </div>
  );
};
