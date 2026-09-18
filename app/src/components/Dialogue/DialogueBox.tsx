import React, { useState, useEffect, useRef, useCallback } from 'react';
import './DialogueBox.css';

export interface DialogueBoxProps {
  speaker?: string;
  text: string;
  locationName?: string;
  isAuto?: boolean;
  onToggleAuto?: (isAuto: boolean) => void;
  onTypingComplete?: () => void;
  onClick: () => void;
}

export const DialogueBox: React.FC<DialogueBoxProps> = ({
  speaker,
  text,
  locationName,
  isAuto = false,
  onToggleAuto,
  onTypingComplete,
  onClick,
}) => {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  // マウント時フェードイン
  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // テキスト更新時にタイピング初期化
  useEffect(() => {
    setDisplayedLength(0);
    setIsTyping(true);

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!text) {
      setIsTyping(false);
      return;
    }

    let current = 0;
    const typingSpeedMs = 24;

    const step = () => {
      if (current < text.length) {
        current++;
        setDisplayedLength(current);
        timerRef.current = window.setTimeout(step, typingSpeedMs);
      } else {
        setIsTyping(false);
        onTypingComplete?.();
      }
    };

    timerRef.current = window.setTimeout(step, typingSpeedMs);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [text, onTypingComplete]);

  // クリック時の挙動
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isTyping) {
        // タイピング中なら一括全文表示
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setDisplayedLength(text.length);
        setIsTyping(false);
        onTypingComplete?.();
      } else {
        // すでに全文表示されていれば次へ進行
        onClick();
      }
    },
    [isTyping, text.length, onClick, onTypingComplete]
  );

  // AUTOボタン切り替え
  const handleAutoClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleAuto?.(!isAuto);
    },
    [isAuto, onToggleAuto]
  );

  const displayedText = text.slice(0, displayedLength);

  // 「」などのカギ括弧のスタイリング
  const renderFormattedText = (raw: string) => {
    return raw.split('\n').map((line, idx) => {
      // 「 と 」 をハイライト
      const parts = line.split(/(「|」)/g);
      return (
        <React.Fragment key={idx}>
          {idx > 0 && <br />}
          {parts.map((p, pIdx) => {
            if (p === '「' || p === '」') {
              return (
                <span key={pIdx} className="adv-quote-mark">
                  {p}
                </span>
              );
            }
            return p;
          })}
        </React.Fragment>
      );
    });
  };

  return (
    <>
      {/* ロケーションバッジ (左上) */}
      {locationName && (
        <div className={`adv-location-badge ${isVisible ? 'visible' : ''}`}>
          <span>📍</span>
          <span>{locationName}</span>
        </div>
      )}

      {/* AUTOボタン (右上) */}
      {onToggleAuto && (
        <div className={`adv-top-controls ${isVisible ? 'visible' : ''}`}>
          <button
            type="button"
            className={`adv-auto-btn ${isAuto ? 'active' : ''}`}
            onClick={handleAutoClick}
          >
            <span className="adv-auto-icon">▶</span>
            <span>AUTO</span>
          </button>
        </div>
      )}

      {/* メッセージウィンドウ (下部) */}
      <div
        className={`adv-message-container ${isVisible ? 'visible' : ''}`}
        onClick={handleClick}
      >
        <div className="adv-message-body">
          {speaker && (
            <div className="adv-speaker-name">
              <span>{speaker}</span>
            </div>
          )}

          <div>{renderFormattedText(displayedText)}</div>

          {/* 次へ送りインジケーター（全文表示時に表示） */}
          <div className={`adv-next-indicator ${!isTyping ? 'show' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
              <path d="M480-83 240-323l56-56 184 183 184-183 56 56L480-83Zm0-238L240-561l56-56 184 183 184-183 56 56-240 240Zm0-238L240-799l56-56 184 183 184-183 56 56-240 240Z" />
            </svg>
          </div>
        </div>
      </div>
    </>
  );
};
