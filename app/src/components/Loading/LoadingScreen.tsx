import React, { useState, useCallback } from 'react';
import { AssetPreloader, PreloadProgress } from '../../services/loader/AssetPreloader';
import './LoadingScreen.css';
import { useLanguage } from '../../contexts/LanguageContext';

export interface LoadingScreenProps {
  onStartLoading?: () => void; // ユーザーがSTARTを押した時（AudioContextアンロック等）
  onComplete: () => void;      // ロード完了時
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  onStartLoading,
  onComplete,
}) => {
  const { lang } = useLanguage();
  const [phase, setPhase] = useState<'prompt' | 'loading' | 'completed'>('prompt');
  const [progress, setProgress] = useState<PreloadProgress>({
    loadedBytes: 0,
    totalBytes: AssetPreloader.getTotalPreloadBytes(),
    percentage: 0,
    currentItem: null,
  });

  const handleStart = useCallback(async () => {
    onStartLoading?.();
    setPhase('loading');

    try {
      await AssetPreloader.preloadInitialAssets((p) => {
        setProgress(p);
      });
      setPhase('completed');
      setTimeout(() => {
        onComplete();
      }, 500);
    } catch (e) {
      console.error('Preload failed:', e);
      // エラー時もゲーム進行不能を防ぐため完了とする
      setPhase('completed');
      setTimeout(() => {
        onComplete();
      }, 500);
    }
  }, [onStartLoading, onComplete]);

  const totalMb = Math.round(progress.totalBytes / (1024 * 1024));
  const currentMb = (progress.loadedBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="loading-screen-overlay">
      {/* 背景装飾ジオメトリック */}
      <div className="loading-bg-decoration" />

      <div className="loading-card">
        <div className="loading-header">
          <div className="loading-brand-sub">ANIME VRM INTERACTIVE ADVENTURE</div>
          <h1 className="loading-title">5秒で告白</h1>
          <div className="loading-badge">DATA LOAD</div>
        </div>

        {phase === 'prompt' && (
          <div className="loading-prompt-content">
            <div className="loading-notice-box">
              <div className="loading-notice-header">
                <svg
                  className="loading-info-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span className="loading-notice-title">
                  {lang === 'ja' ? 'データ読み込みのご案内' : 'Data Loading Notice'}
                </span>
              </div>
              <p className="loading-notice-text">
                {lang === 'ja'
                  ? `本作品をプレイするには、約 ${totalMb} MB 程度の読み込みが必要です。`
                  : `Approximately ${totalMb} MB of data needs to be loaded to play.`}
              </p>
              <div className="loading-wifi-note">
                {lang === 'ja'
                  ? '※ 高速なWi-Fi環境でのプレイを推奨いたします。'
                  : '* Recommended to play over a high-speed Wi-Fi connection.'}
              </div>
            </div>

            <div className="loading-button-container">
              <button
                type="button"
                className="loading-start-btn"
                onClick={handleStart}
                autoFocus
              >
                <span className="loading-btn-main">
                  START
                </span>
                <svg
                  className="loading-btn-arrow"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <div className="loading-progress-content">
            <div className="loading-status-row">
              <span className="loading-status-label">
                {lang === 'ja' ? 'データを読み込み中...' : 'Loading data...'}
              </span>
              <span className="loading-percentage-text">{progress.percentage}%</span>
            </div>

            <div className="loading-bar-track">
              <div
                className="loading-bar-fill"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>

            <div className="loading-meta-row">
              <span className="loading-size-text">
                {currentMb} MB / {totalMb} MB
              </span>
              <span className="loading-tip-text">
                {lang === 'ja' ? '準備中です。少々お待ちください...' : 'Loading assets, please wait...'}
              </span>
            </div>
          </div>
        )}

        {phase === 'completed' && (
          <div className="loading-completed-content">
            <div className="loading-status-row">
              <span className="loading-status-label">
                {lang === 'ja' ? '準備完了' : 'Ready'}
              </span>
              <span className="loading-percentage-text">100%</span>
            </div>
            <div className="loading-bar-track">
              <div className="loading-bar-fill" style={{ width: '100%' }} />
            </div>
            <div className="loading-ready-msg">
              {lang === 'ja' ? 'ゲームを開始します...' : 'Starting game...'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
