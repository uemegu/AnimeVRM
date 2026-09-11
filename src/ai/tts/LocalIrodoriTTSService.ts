export interface LocalIrodoriTTSSynthesizeOptions {
  ref?: string;
  steps?: number;
  play?: boolean;
}

export class LocalIrodoriTTSService {
  private serverUrl: string = '/irodori-api/tts';
  private defaultRef: string = '~/git/practice/vrm-view/vrm-genshin-like/voices/001.wav';
  private defaultSteps: number = 8;

  constructor(serverUrl?: string, defaultRef?: string) {
    if (serverUrl) {
      this.serverUrl = serverUrl;
    }
    if (defaultRef) {
      this.defaultRef = defaultRef;
    }
  }

  public setServerUrl(url: string): void {
    this.serverUrl = url.trim();
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  public setDefaultRef(ref: string): void {
    this.defaultRef = ref.trim();
  }

  public getDefaultRef(): string {
    return this.defaultRef;
  }

  public setDefaultSteps(steps: number): void {
    this.defaultSteps = Math.max(1, Math.min(32, Math.round(steps)));
  }

  public getDefaultSteps(): number {
    return this.defaultSteps;
  }

  /**
   * Synthesize speech using the local Irodori-TTS server.
   * Sends POST /tts with JSON payload: { text, ref, steps, play: false }
   * Returns audio/wav Blob.
   */
  public async synthesize(
    text: string,
    options: LocalIrodoriTTSSynthesizeOptions = {}
  ): Promise<Blob> {
    const trimmedText = text.trim();
    if (!trimmedText) {
      throw new Error('音声合成するテキストが空です。');
    }

    const payload = {
      text: trimmedText,
      ref: options.ref ?? this.defaultRef,
      steps: options.steps ?? this.defaultSteps,
      play: options.play ?? false,
    };

    // Attempt direct request first, then fallback to proxy (/irodori-api) if CORS or network error occurs
    try {
      return await this.postJson(this.serverUrl, payload);
    } catch (directErr: any) {
      if (this.serverUrl.includes('8080')) {
        const proxyUrl = this.serverUrl.replace(
          /https?:\/\/(localhost|127\.0\.0\.1):8080/,
          '/irodori-api'
        );
        console.warn(
          `[LocalIrodoriTTSService] Direct request failed (${directErr.message}), trying proxy ${proxyUrl}...`
        );
        try {
          return await this.postJson(proxyUrl, payload);
        } catch (proxyErr: any) {
          throw new Error(
            `Irodori-TTSサーバーへの接続に失敗しました (Direct & Proxy): ${directErr.message} / ${proxyErr.message}`
          );
        }
      }
      throw directErr;
    }
  }

  private async postJson(url: string, payload: Record<string, any>): Promise<Blob> {
    console.log(`[LocalIrodoriTTSService] Sending synthesize request to ${url}...`, payload);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error) errMsg = errJson.error;
      } catch {
        // ignore
      }
      throw new Error(`TTSサーバーエラー (${response.status}): ${errMsg}`);
    }

    const durationHeader = response.headers.get('X-Audio-Duration');
    const synthTimeHeader = response.headers.get('X-Synthesize-Time');
    if (durationHeader) {
      console.log(
        `[LocalIrodoriTTSService] Generated audio duration: ${durationHeader}s, synth time: ${synthTimeHeader ?? '?'}s`
      );
    }

    const wavBlob = await response.blob();
    return wavBlob;
  }
}
