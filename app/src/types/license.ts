import { SupportedLanguage } from './scenario';

/**
 * ライブラリ（npm パッケージ）のライセンス情報
 */
export interface LibraryLicense {
  name: string;
  version: string;
  licenseType: string;
  author: string;
  repository: string;
  licenseText: string;
}

/**
 * 外部アセット（BGM, SE, 音声, 背景等）のクレジット・ライセンス情報
 */
export interface AssetCredit {
  category: 'bgm' | 'se' | 'voice' | 'background' | 'other';
  name: Record<SupportedLanguage, string>;
  provider: string;
  url?: string;
  description: Record<SupportedLanguage, string>;
  licenseNote?: Record<SupportedLanguage, string>;
}

/**
 * アプリ全体のライセンス・クレジット情報全体構造
 */
export interface AppLicensesData {
  generatedAt: string;
  assets: AssetCredit[];
  libraries: LibraryLicense[];
}
