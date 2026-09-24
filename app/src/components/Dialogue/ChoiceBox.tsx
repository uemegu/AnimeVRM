import React, { useState, useEffect, useRef } from 'react';
import { soundManager } from '../../services/audio/SoundManager';
import './ChoiceBox.css';

export interface ChoiceBoxProps {
  choices: Array<{
    text: string;
    goto: string;
  }>;
  onSelect: (index: number) => void;
  /** 制限時間（秒）。省略時は10秒 */
  timeLimitSec?: number;
  /** 時間切れ時。省略時は1番目の選択肢を選ぶ */
  onTimeout?: () => void;
}

export const ChoiceBox: React.FC<ChoiceBoxProps> = ({ choices, onSelect, timeLimitSec = 10, onTimeout }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [countdown, setCountdown] = useState(timeLimitSec);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isTick, setIsTick] = useState(false);
  const timerRef = useRef<number | null>(null);

  // マウント時にフェードイン & 表示SE
  useEffect(() => {
    const animId = requestAnimationFrame(() => setIsVisible(true));
    soundManager.playUiSe('shown');

    return () => cancelAnimationFrame(animId);
  }, []);

  // タイムアウト時の自動選択は最新の onSelect を呼ぶ（再描画で関数が変わってもタイマーを巻き戻さない）
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
  const choicesKey = choices.map((choice) => `${choice.goto}:${choice.text}`).join('|');

  // カウントダウンタイマー。選択肢が変わったときだけ最初から数え直す
  useEffect(() => {
    setCountdown(timeLimitSec);
    setIsUrgent(false);

    timerRef.current = window.setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [choicesKey, timeLimitSec]);

  // 1秒ごとの演出と、0秒になったら1番目の選択肢を自動選択
  useEffect(() => {
    if (countdown >= timeLimitSec) return;
    setIsTick(true);
    const tickTimer = window.setTimeout(() => setIsTick(false), 220);
    if (countdown <= 3) setIsUrgent(true);

    if (countdown === 0) {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      soundManager.playUiSe('select');
      if (onTimeoutRef.current) {
        onTimeoutRef.current();
      } else {
        onSelectRef.current(0);
      }
    }
    return () => window.clearTimeout(tickTimer);
  }, [countdown, timeLimitSec]);

  // 選択肢クリックハンドラ
  const handleSelect = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    soundManager.playUiSe('select');
    onSelect(idx);
  };

  // ホバー音
  const handleMouseEnter = () => {
    soundManager.playUiSe('hover');
  };

  // 吹き出し矢印SVGの計算
  const getSpeechTailY = (index: number, total: number) => {
    if (total === 1) return 30;
    if (index === 0) return 56;
    if (index === 1) return 16;
    return -14;
  };

  // ペルソナ風タイトル文字の定義
  const personaWords = [
    {
      letters: [
        { ch: 'M', cls: 'accent', rot: -6, delay: 0.08 },
        { ch: 'a', cls: '', rot: 3, delay: 0.118 },
        { ch: 'k', cls: '', rot: -4, delay: 0.156 },
        { ch: 'e', cls: '', rot: 2, delay: 0.194 },
      ],
    },
    {
      letters: [
        { ch: 'Y', cls: 'accent-cyan', rot: 4, delay: 0.232 },
        { ch: 'o', cls: '', rot: -3, delay: 0.27 },
        { ch: 'u', cls: '', rot: 5, delay: 0.308 },
        { ch: 'r', cls: '', rot: -2, delay: 0.346 },
      ],
    },
    {
      letters: [
        { ch: 'C', cls: 'accent', rot: -5, delay: 0.384 },
        { ch: 'h', cls: '', rot: 3, delay: 0.422 },
        { ch: 'o', cls: '', rot: -3, delay: 0.46 },
        { ch: 'i', cls: '', rot: 4, delay: 0.498 },
        { ch: 'c', cls: '', rot: -4, delay: 0.536 },
        { ch: 'e', cls: '', rot: 3, delay: 0.574 },
        { ch: '!', cls: 'bang', rot: -6, delay: 0.612 },
        { ch: '!', cls: 'bang', rot: 6, delay: 0.65 },
      ],
    },
  ];

  // Thinking Time 文字アニメーション
  const renderAnimatedLetters = (word: string, startDelay: number, step = 0.03) => {
    return word.split('').map((ch, i) => (
      <span
        key={i}
        className="adv-tt-char"
        style={{ animationDelay: `${(startDelay + i * step).toFixed(3)}s` }}
      >
        {ch}
      </span>
    ));
  };

  return (
    <div className={`adv-choices-backdrop ${isVisible ? 'visible' : ''}`}>
      {/* 1. Dynamic Prominent VFX (スピードライン & レーザービーム) */}
      <div className="adv-vfx-speedlines">
        <div className="adv-vfx-band b1" />
        <div className="adv-vfx-band b2" />
        <div className="adv-vfx-band b3" />
        <div className="adv-vfx-beam m1" />
        <div className="adv-vfx-beam m2" />
        <div className="adv-vfx-beam m3" />
        <div className="adv-vfx-line l1" />
        <div className="adv-vfx-line l2" />
        <div className="adv-vfx-line l3" />
        <div className="adv-vfx-line l4" />
      </div>

      {/* ショックウェーブリング */}
      <div className="adv-vfx-rings">
        <div className="adv-vfx-ring r1" />
        <div className="adv-vfx-ring r2" />
        <div className="adv-vfx-ring r3" />
      </div>

      {/* 2. Persona Dynamic Cutout Typography Title */}
      <div className="adv-persona-title-container">
        <div className="adv-p-bg-slash" />
        <div className="adv-persona-text-row">
          {personaWords.map((word, wIdx) => (
            <div key={wIdx} className="adv-p-word">
              {word.letters.map((item, lIdx) => (
                <span
                  key={lIdx}
                  className={`adv-p-char ${item.cls}`}
                  style={
                    {
                      animationDelay: `${item.delay}s`,
                      '--rot': `${item.rot}deg`,
                    } as React.CSSProperties
                  }
                >
                  {item.ch}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Left Character: Hero with dark blue silhouette shadow */}
      <div className="adv-cutin-char adv-cutin-left">
        <div className="adv-char-shadow">
          <img src="/img/hero.avif" alt="" />
        </div>
        <div className="adv-char-main">
          <img src="/img/hero.avif" alt="Hero" />
        </div>
      </div>

      {/* 4. Right Side Graphic Stage */}
      <div className="adv-right-stage">
        <div className="adv-right-slash s1" />
        <div className="adv-right-slash s2" />
        <div className="adv-right-slash s3" />
      </div>

      {/* 5. Thinking Time Stylish Widget (Bottom Right) */}
      <div className="adv-thinking-widget">
        <div className="adv-tt-spin-ring" />
        <div className="adv-tt-spin-ring-inner" />

        <div className="adv-countdown-container">
          <div className="adv-countdown-ribbon">COUNTDOWN</div>
          <div className={`adv-countdown-box ${isUrgent ? 'urgent' : ''} ${isTick ? 'tick' : ''}`}>
            <span className="adv-countdown-digits">
              {String(Math.max(0, countdown)).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="adv-thinking-circle-badge">
          <div className="adv-tt-line adv-tt-line1">
            {renderAnimatedLetters('Thinking', 0.1, 0.026)}
          </div>
          <div className="adv-tt-line adv-tt-line2">
            {renderAnimatedLetters('Time', 0.32, 0.035)}
          </div>
        </div>
      </div>

      {/* 6. Front Bottom Accent Bar */}
      <div className="adv-vfx-bottom-bar" />

      {/* 7. Choices Container (Center) */}
      <div className={`adv-choices-container ${isVisible ? 'visible' : ''}`}>
        {choices.map((choice, index) => {
          const targetY = getSpeechTailY(index, choices.length);
          return (
            <button
              key={`${choice.goto}_${index}`}
              type="button"
              className="adv-choice-btn slam-in"
              style={{ animationDelay: `${(0.26 + index * 0.09).toFixed(2)}s` }}
              onMouseEnter={handleMouseEnter}
              onClick={(e) => handleSelect(index, e)}
            >
              {/* ホバー時に伸びる吹き出しの矢印 */}
              <div className="adv-choice-speech-tail">
                <svg
                  className="adv-speech-tail-svg"
                  viewBox="0 0 150 60"
                  preserveAspectRatio="none"
                >
                  <polygon points={`150,16 150,44 0,${targetY}`} fill="#ffffff" />
                  <path
                    d={`M 150,16 L 0,${targetY} L 150,44`}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* 飛び出す番号バッジ */}
              <span className="adv-choice-badge">0{index + 1}</span>

              {/* 選択肢テキスト */}
              <span className="adv-choice-text">{choice.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
