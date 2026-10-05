import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import './InterludeOverlay.css';

export interface InterludeTransitionOptions {
  title?: string;
  subtitle?: string;
  onCovered?: () => Promise<void> | void;
  holdDurationMs?: number;
}

export interface InterludeOverlayHandle {
  playTransition: (options?: InterludeTransitionOptions) => Promise<void>;
  isRunning: () => boolean;
}

export const InterludeOverlay = forwardRef<InterludeOverlayHandle>(
  (_props, ref) => {
    const { lang } = useLanguage();
    const [isVisible, setIsVisible] = useState(false);
    const [isCovered, setIsCovered] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');

    const isRunningRef = useRef(false);
    /** 実行中の幕間。途中で次の幕間が頼まれたら、終わってから続けて流す（捨てると画面の切り替えが止まる） */
    const queueRef = useRef<Promise<void>>(Promise.resolve());

    const play = async (options: InterludeTransitionOptions) => {
      isRunningRef.current = true;

      const defaultTitle = lang === 'ja' ? '5秒で告白' : '5 Seconds Confession';
      const defaultSubtitle = '5 SECONDS CONFESSION';

      setTitle(options.title ?? defaultTitle);
      setSubtitle(options.subtitle ?? defaultSubtitle);

      const holdMs = options.holdDurationMs ?? 320;

      // 1. 表示開始
      setIsExiting(false);
      setIsCovered(false);
      setIsVisible(true);

      // 次フレームでスライドインアニメーション開始
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      setIsCovered(true);

      // 2. スライドイン完了待ち (420ms + バッファ)
      await new Promise((resolve) => setTimeout(resolve, 430));

      // 3. 画面全体が覆われた状態でコールバック実行
      if (options.onCovered) {
        try {
          await options.onCovered();
        } catch (err) {
          console.error('Error during interlude onCovered:', err);
        }
      }

      // 4. タイトルを読み取れるようホールド
      await new Promise((resolve) => setTimeout(resolve, holdMs));

      // 5. スライドアウト開始
      setIsCovered(false);
      setIsExiting(true);

      // スライドアウト完了待ち
      await new Promise((resolve) => setTimeout(resolve, 430));

      // 6. リセット
      setIsVisible(false);
      setIsExiting(false);
      isRunningRef.current = false;
    };

    useImperativeHandle(ref, () => ({
      isRunning: () => isRunningRef.current,
      playTransition: (options: InterludeTransitionOptions = {}) => {
        const next = queueRef.current.then(() => play(options));
        queueRef.current = next.catch(() => {});
        return next;
      },
    }));

    if (!isVisible) return null;

    const containerClasses = [
      'interlude-overlay-container',
      isVisible ? 'visible' : '',
      isCovered ? 'covered' : '',
      isExiting ? 'exiting' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={containerClasses}>
        <div className="interlude-slice interlude-slice-1" />
        <div className="interlude-slice interlude-slice-2">
          <div className="interlude-content">
            <span className="interlude-subtitle">{subtitle}</span>
            <h2 className="interlude-title">{title}</h2>
            <div className="interlude-deco-bar" />
          </div>
        </div>
        <div className="interlude-slice interlude-slice-3" />
        <div className="interlude-slice interlude-slice-4" />
      </div>
    );
  }
);

InterludeOverlay.displayName = 'InterludeOverlay';
