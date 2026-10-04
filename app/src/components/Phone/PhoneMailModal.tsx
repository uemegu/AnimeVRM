import React, { useState, useRef, useEffect } from 'react';
import { resolveLocalizedText } from '../../types/scenario';
import { MailScenario, MailReplyOption, MailContent, MailReaction, CommunicationResult } from '../../types/communication';
import { availableChoices, type ChoiceContext } from '@anime-vrm/scenario';
import { resolveAssetUrl } from '../../utils/path';
import { CHARACTERS } from '../../data/characters';
import { soundManager } from '../../services/audio/SoundManager';
import './Phone.css';
import { useLanguage } from '../../contexts/LanguageContext';

export interface PhoneMailModalProps {
  scenario: MailScenario;
  alreadyReplied?: boolean;
  /** 返信の出現条件の判定に使うフラグ・好感度 */
  context?: ChoiceContext;
  /** 閉じたときの結果（フラグ・好感度・選んだ選択肢）。完了の記録は呼び出し側で行う */
  onClose: (result: Omit<CommunicationResult, 'id'>) => void;
}

/** 画面に出す1通（届いた順に並べる） */
interface ShownMessage extends MailContent {
  key: string;
  sender: 'heroine' | 'player';
  time: string;
  retracted?: boolean;
}

/** 反応が続けて届くときの間（ミリ秒） */
const REACTION_INTERVAL_MS = 1100;

export const PhoneMailModal: React.FC<PhoneMailModalProps> = ({
  scenario,
  alreadyReplied = false,
  context,
  onClose,
}) => {
  const { lang } = useLanguage();
  const [messages, setMessages] = useState<ShownMessage[]>(() =>
    scenario.messages.map((m) => ({ ...m, key: m.id }))
  );
  const [isReplied, setIsReplied] = useState<boolean>(alreadyReplied);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const timersRef = useRef<number[]>([]);

  const accumulatedFlagsRef = useRef<Record<string, boolean | number | string>>({});
  const accumulatedAffinityRef = useRef<Record<string, number>>({});
  const chosenIdsRef = useRef<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const char = CHARACTERS[scenario.characterId];
  const charName = char ? resolveLocalizedText(char.name, lang) : scenario.characterId;
  const heroineColor = char?.themeColor || '#38bdf8';
  const avatarImgUrl = `/assets/characters/${scenario.characterId}_normal.avif`;
  const replyOptions = availableChoices(scenario.replyOptions, context ?? { flags: {} });

  const later = (ms: number, run: () => void) => {
    timersRef.current.push(window.setTimeout(run, ms));
  };
  useEffect(() => () => timersRef.current.forEach((t) => window.clearTimeout(t)), []);

  /** 届いてから決まった秒数で「送信を取り消しました」に変える */
  const scheduleRetract = (list: ShownMessage[]) => {
    for (const m of list) {
      if (m.retractAfterSec === undefined || m.retracted) continue;
      later(m.retractAfterSec * 1000, () =>
        setMessages((prev) => prev.map((x) => (x.key === m.key ? { ...x, retracted: true } : x)))
      );
    }
  };
  useEffect(() => {
    // 返信済みで開き直したときは、取り消し済みの状態から見せる
    if (alreadyReplied) {
      setMessages((prev) => prev.map((m) => (m.retractAfterSec !== undefined ? { ...m, retracted: true } : m)));
    } else {
      scheduleRetract(messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const lastTime = messages[messages.length - 1]?.time ?? scenario.time;
    setMessages((prev) => [...prev, { key: `player_reply_${option.id}`, sender: 'player', text: option.text, time: lastTime }]);
    setIsReplied(true);

    if (option.setFlags) {
      Object.assign(accumulatedFlagsRef.current, option.setFlags);
    }
    chosenIdsRef.current.push(option.id);

    if (option.addAffinity) {
      for (const [key, val] of Object.entries(option.addAffinity)) {
        accumulatedAffinityRef.current[key] = (accumulatedAffinityRef.current[key] || 0) + val;
      }
    }

    // 2. 相手からの反応（入力中演出を挟んで1通ずつ追加）
    const reactions: MailReaction[] = option.reactions ?? (option.reactionText ? [{ text: option.reactionText, time: option.reactionTime }] : []);
    reactions.forEach((reaction, index) => {
      later(REACTION_INTERVAL_MS * index, () => setIsTyping(true));
      later(REACTION_INTERVAL_MS * (index + 1) - 100, () => {
        setIsTyping(false);
        const shown: ShownMessage = {
          ...reaction,
          key: `heroine_react_${option.id}_${index}`,
          sender: 'heroine',
          time: reaction.time ?? option.reactionTime ?? lastTime,
        };
        setMessages((prev) => [...prev, shown]);
        scheduleRetract([shown]);
        soundManager.playUiSe('mailNotification');
      });
    });
  };

  const handleBack = () => {
    onClose({
      flags: accumulatedFlagsRef.current,
      affinityDelta: accumulatedAffinityRef.current,
      choiceIds: chosenIdsRef.current,
    });
  };

  /** 吹き出しの中身（取り消し・スタンプ・写真・本文） */
  const renderContent = (msg: ShownMessage, side: 'heroine' | 'player') => {
    if (msg.retracted) {
      return (
        <div className="phone-msg-retracted">
          {lang === 'ja' ? `${side === 'heroine' ? charName : 'あなた'}が送信を取り消しました` : 'Message unsent'}
        </div>
      );
    }
    const text = msg.text !== undefined ? resolveLocalizedText(msg.text, lang) : '';
    return (
      <>
        {msg.stamp && <img className="phone-msg-stamp" src={resolveAssetUrl(msg.stamp)} alt="" />}
        {msg.image && <img className={`phone-msg-photo ${side}`} src={resolveAssetUrl(msg.image)} alt="" />}
        {text && <div className={`phone-msg-bubble ${side}`}>{text}</div>}
      </>
    );
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
              if (msg.sender === 'heroine') {
                return (
                  <div key={msg.key} className="phone-msg-row heroine">
                    <img
                      src={avatarImgUrl}
                      alt={charName}
                      className="phone-mail-target-avatar"
                      style={{ width: 28, height: 28 }}
                    />
                    <div className="phone-msg-stack">{renderContent(msg, 'heroine')}</div>
                    <span className="phone-msg-time">{msg.time}</span>
                  </div>
                );
              }
              return (
                <div key={msg.key} className="phone-msg-row player">
                  <div className="phone-msg-stack player">{renderContent(msg, 'player')}</div>
                  <div className="phone-msg-meta player">
                    <span className="phone-msg-read-mark">{lang === 'ja' ? '既読' : 'Read'}</span>
                    <span className="phone-msg-time">{msg.time}</span>
                  </div>
                </div>
              );
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
            {!isReplied && replyOptions.length > 0 ? (
              <>
                <div className="phone-mail-reply-label">
                  {lang === 'ja' ? '返信メッセージを選択' : 'Select Reply Message'}
                </div>
                <div className="phone-mail-reply-options">
                  {replyOptions.map((opt) => (
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
