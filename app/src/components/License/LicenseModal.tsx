import React, { useState, useMemo } from 'react';
import { SupportedLanguage } from '../../types/scenario';
import { AppLicensesData, LibraryLicense, AssetCredit } from '../../types/license';
import rawLicensesData from '../../data/licenses.json';
import './LicenseModal.css';

const licensesData = rawLicensesData as unknown as AppLicensesData;

export interface LicenseModalProps {
  isOpen: boolean;
  lang: SupportedLanguage;
  onClose: () => void;
}

type LicenseTab = 'assets' | 'libraries';

export const LicenseModal: React.FC<LicenseModalProps> = ({
  isOpen,
  lang,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LicenseTab>('assets');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLibs, setExpandedLibs] = useState<Record<string, boolean>>({});

  // ライブラリ検索フィルタ
  const filteredLibraries = useMemo(() => {
    if (!searchQuery.trim()) {
      return licensesData.libraries || [];
    }
    const query = searchQuery.toLowerCase().trim();
    return (licensesData.libraries || []).filter((lib: LibraryLicense) =>
      lib.name.toLowerCase().includes(query) ||
      lib.licenseType.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const toggleExpand = (name: string) => {
    setExpandedLibs((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  if (!isOpen) {
    return null;
  }

  const isJa = lang === 'ja';

  return (
    <div
      className="license-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="license-modal-title"
    >
      <div className="license-modal-card">
        <div className="license-modal-inner">
          {/* ヘッダー */}
          <header className="license-modal-header">
            <div className="license-modal-title-area">
              <h2 id="license-modal-title" className="license-modal-title">
                {isJa ? 'ライセンス・クレジット' : 'Licenses & Credits'}
              </h2>
              <span className="license-modal-subtitle">
                {isJa ? 'オープンソースソフトウェアおよび使用素材' : 'Open Source Software & Asset Credits'}
              </span>
            </div>
            <button
              type="button"
              className="license-modal-close-btn"
              onClick={onClose}
              aria-label={isJa ? '閉じる' : 'Close'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          {/* タブ切り替えバー */}
          <nav className="license-tabs" aria-label="License category tabs">
            <button
              type="button"
              className={`license-tab-btn ${activeTab === 'assets' ? 'active' : ''}`}
              onClick={() => setActiveTab('assets')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>{isJa ? '使用素材・アセット' : 'Assets & Media'}</span>
            </button>
            <button
              type="button"
              className={`license-tab-btn ${activeTab === 'libraries' ? 'active' : ''}`}
              onClick={() => setActiveTab('libraries')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <span>{isJa ? 'ソフトウェアライブラリ' : 'Software Libraries'}</span>
              <span className="license-badge badge-ver">
                {licensesData.libraries?.length || 0}
              </span>
            </button>
          </nav>

          {/* スクロール本文エリア */}
          <div className="license-modal-body">
            {activeTab === 'assets' ? (
              // アセットクレジット表示
              <>
                {(licensesData.assets || []).map((asset: AssetCredit, index: number) => {
                  const categoryName = asset.name[lang] || asset.name.ja;
                  const desc = asset.description[lang] || asset.description.ja;
                  const note = asset.licenseNote ? (asset.licenseNote[lang] || asset.licenseNote.ja) : '';

                  return (
                    <article key={`asset-${index}`} className="license-asset-card">
                      <div className="license-asset-header">
                        <span className="license-asset-category">
                          {asset.category.toUpperCase()}
                        </span>
                        {asset.url && (
                          <a
                            href={asset.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="license-asset-link"
                          >
                            <span>Website</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        )}
                      </div>
                      <h3 className="license-asset-name">
                        <span>{categoryName}</span>
                        <span className="license-asset-provider">({asset.provider})</span>
                      </h3>
                      <p className="license-asset-desc">{desc}</p>
                      {note && <p className="license-asset-note">{note}</p>}
                    </article>
                  );
                })}
              </>
            ) : (
              // ソフトウェアライブラリ表示
              <>
                {/* 検索入力 */}
                <div className="license-search-bar">
                  <span className="license-search-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isJa ? 'ライブラリ名またはライセンス種別で検索...' : 'Filter by library name or license...'}
                    className="license-search-input"
                  />
                </div>

                {filteredLibraries.map((lib: LibraryLicense) => {
                  const isExpanded = !!expandedLibs[lib.name];

                  return (
                    <article key={lib.name} className="license-lib-card">
                      <div className="license-lib-summary">
                        <div className="license-lib-title-area">
                          <span className="license-lib-name">{lib.name}</span>
                          <span className="license-badge badge-ver">v{lib.version}</span>
                          <span className="license-badge badge-type">{lib.licenseType}</span>
                        </div>
                        <div className="license-lib-actions">
                          {lib.repository && (
                            <a
                              href={lib.repository}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="license-repo-link"
                            >
                              <span>Repository</span>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            </a>
                          )}
                          {lib.licenseText && (
                            <button
                              type="button"
                              className="license-toggle-btn"
                              onClick={() => toggleExpand(lib.name)}
                              aria-expanded={isExpanded}
                            >
                              <span>
                                {isExpanded
                                  ? (isJa ? '閉じる' : 'Hide Text')
                                  : (isJa ? '全文表示' : 'View Text')}
                              </span>
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                  transform: isExpanded ? 'rotate(180deg)' : 'none',
                                  transition: 'transform 0.18s ease',
                                }}
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ライセンス全文展開アコーディオン */}
                      {isExpanded && lib.licenseText && (
                        <div className="license-text-container">
                          <pre className="license-text-content">{lib.licenseText}</pre>
                        </div>
                      )}
                    </article>
                  );
                })}

                {filteredLibraries.length === 0 && (
                  <p className="license-footer-note" style={{ textAlign: 'center', padding: '24px 0' }}>
                    {isJa ? '一致するライブラリが見つかりません' : 'No matching libraries found'}
                  </p>
                )}
              </>
            )}
          </div>

          {/* フッター */}
          <footer className="license-modal-footer">
            <p className="license-footer-note">
              &copy; AnimeVRM Project. All rights reserved.
            </p>
            <button
              type="button"
              className="license-close-action-btn"
              onClick={onClose}
            >
              {isJa ? '閉じる' : 'Close'}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
};
