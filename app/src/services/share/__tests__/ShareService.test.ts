import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShareService } from '../ShareService';

describe('ShareService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateShareText', () => {
    it('日本語のシェアテキストを正しく生成すること', () => {
      const text = ShareService.generateShareText({
        day: 3,
        phase: 'lunch_action',
        locationName: '屋上',
        lang: 'ja',
      });
      expect(text).toContain('AnimeVRM Day 3（昼休み）【屋上】をプレイ中！');
      expect(text).toContain('#AnimeVRM');
    });

    it('ロケーション名がない場合も日本語テキストを生成できること', () => {
      const text = ShareService.generateShareText({
        day: 1,
        phase: 'morning',
        lang: 'ja',
      });
      expect(text).toContain('AnimeVRM Day 1（朝）をプレイ中！');
      expect(text).toContain('#AnimeVRM');
    });

    it('英語のシェアテキストを正しく生成すること', () => {
      const text = ShareService.generateShareText({
        day: 5,
        phase: 'afterschool_action',
        locationName: 'Courtyard',
        lang: 'en',
      });
      expect(text).toContain('Playing AnimeVRM: Day 5 (After School) at Courtyard!');
      expect(text).toContain('#AnimeVRM');
    });
  });

  describe('isMobileDevice', () => {
    it('iPhone の UserAgent で true を返すこと', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      });
      expect(ShareService.isMobileDevice()).toBe(true);
    });

    it('Mac デスクトップの UserAgent で false を返すこと', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        maxTouchPoints: 0,
      });
      expect(ShareService.isMobileDevice()).toBe(false);
    });
  });

  describe('wrapText', () => {
    it('指定幅を超える場合にテキストを適切に折り返すこと', () => {
      const mockCtx = {
        measureText: vi.fn((str: string) => ({ width: str.length * 10 })),
      } as unknown as CanvasRenderingContext2D;

      // maxWidth = 40 (4文字分)
      const lines = ShareService.wrapText(mockCtx, 'あいうえおかきくけこ', 40);
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.join('')).toBe('あいうえおかきくけこ');
    });
  });

  describe('shareToX', () => {
    it('モバイル端末で navigator.canShare がサポートされている場合に navigator.share を呼び出すこと', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      const mockCanShare = vi.fn().mockReturnValue(true);

      const fakeCanvas = {
        width: 800,
        height: 600,
        getContext: vi.fn().mockReturnValue(null),
        toBlob: vi.fn((cb: (b: Blob) => void) => cb(new Blob(['dummy'], { type: 'image/png' }))),
      };

      vi.stubGlobal('document', {
        querySelector: vi.fn().mockReturnValue(fakeCanvas),
        createElement: vi.fn().mockReturnValue(fakeCanvas),
      });

      vi.stubGlobal('navigator', {
        canShare: mockCanShare,
        share: mockShare,
        userAgent: 'iPhone',
      });

      vi.stubGlobal('window', {
        location: { href: 'https://example.com' },
      });

      const result = await ShareService.shareToX({
        day: 1,
        phase: 'morning',
        lang: 'ja',
        forceNativeShare: true,
      });

      expect(mockCanShare).toHaveBeenCalled();
      expect(mockShare).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.mode).toBe('native');
    });

    it('デスクトップ環境では直接 Web Intent とクリップボードコピーを行うこと', async () => {
      vi.useFakeTimers();
      const mockOpen = vi.fn();
      const mockClipboardWrite = vi.fn().mockResolvedValue(undefined);

      const fakeCanvas = {
        width: 800,
        height: 600,
        getContext: vi.fn().mockReturnValue(null),
        toBlob: vi.fn((cb: (b: Blob) => void) => cb(new Blob(['dummy'], { type: 'image/png' }))),
      };

      vi.stubGlobal('document', {
        querySelector: vi.fn().mockReturnValue(fakeCanvas),
        createElement: vi.fn().mockReturnValue(fakeCanvas),
      });

      vi.stubGlobal('window', {
        location: { href: 'https://example.com' },
        open: mockOpen,
        setTimeout: globalThis.setTimeout,
      });

      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        maxTouchPoints: 0,
        clipboard: {
          write: mockClipboardWrite,
        },
      });

      const result = await ShareService.shareToX({
        day: 2,
        phase: 'night',
        lang: 'ja',
        dialogue: {
          speaker: 'アオイ',
          text: 'テストセリフです',
        },
        openDelayMs: 1500,
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('clipboard');
      expect(result.tweetUrl).toContain('https://twitter.com/intent/tweet');

      // 1.5秒経過前はまだ開かれていない
      expect(mockOpen).not.toHaveBeenCalled();

      // 1.5秒経過後に window.open が呼ばれる
      vi.advanceTimersByTime(1500);
      expect(mockOpen).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
