import { test } from '@playwright/test';

test('simulate improved formant extraction and vowel targets', async ({ page }) => {
  await page.goto('lipsync.html');
  await page.waitForTimeout(2000);

  const testReport = await page.evaluate(async () => {
    const files = [
      { name: 'female_a', url: 'voices/lipsync_female_a.wav', target: 'aa' },
      { name: 'female_i', url: 'voices/lipsync_female_i.wav', target: 'ih' },
      { name: 'female_u', url: 'voices/lipsync_female_u.wav', target: 'ou' },
      { name: 'female_e', url: 'voices/lipsync_female_e.wav', target: 'ee' },
      { name: 'female_o', url: 'voices/lipsync_female_o.wav', target: 'oh' },
    ];

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const Meyda = (window as any).Meyda || (await import('meyda')).default;

    function findFormantPeaksImproved(
      spectrum: ArrayLike<number>,
      sampleRate: number,
      bufferSize: number,
      gender: 'female' | 'male'
    ) {
      const binWidth = sampleRate / bufferSize;
      const numBins = spectrum.length;

      // 1. Pre-emphasis: compensate -6dB/oct spectral tilt so high formants (F2 of E/I) stand out over low harmonics
      const emphasized = new Float32Array(numBins);
      for (let i = 0; i < numBins; i++) {
        const freq = i * binWidth;
        // Boost high frequencies proportional to sqrt(freq)
        const boost = Math.sqrt(Math.max(300, freq) / 300);
        emphasized[i] = spectrum[i] * boost;
      }

      // 2. Wide smoothing window (~400 Hz for female, ~250 Hz for male) to eliminate pitch harmonics (F0 ~ 300-350Hz)
      const smoothWindowHz = gender === 'female' ? 420 : 260;
      const smoothRadius = Math.max(3, Math.round(smoothWindowHz / (2 * binWidth)));
      const smoothed = new Float32Array(numBins);

      for (let i = 0; i < numBins; i++) {
        let sum = 0, count = 0;
        for (let w = -smoothRadius; w <= smoothRadius; w++) {
          const idx = i + w;
          if (idx >= 0 && idx < numBins) {
            sum += emphasized[idx];
            count++;
          }
        }
        smoothed[i] = sum / (count || 1);
      }

      const isFemale = gender === 'female';
      const f1MinBin = Math.round((isFemale ? 280 : 220) / binWidth);
      const f1MaxBin = Math.round((isFemale ? 1150 : 950) / binWidth);

      let f1PeakIdx = -1, f1MaxVal = -1;
      for (let i = f1MinBin; i <= f1MaxBin; i++) {
        if (smoothed[i] > f1MaxVal) {
          if ((i === f1MinBin || smoothed[i] >= smoothed[i - 1]) &&
              (i === f1MaxBin || smoothed[i] >= smoothed[i + 1])) {
            f1MaxVal = smoothed[i];
            f1PeakIdx = i;
          }
        }
      }

      // F2 peak search:
      // Minimum separation above F1
      const f2MinHz = isFemale ? 850 : 750;
      const f2MaxHz = isFemale ? 3600 : 3200;
      const f2MinBin = Math.max(
        f1PeakIdx + Math.round(250 / binWidth),
        Math.round(f2MinHz / binWidth)
      );
      const f2MaxBin = Math.round(f2MaxHz / binWidth);

      let f2PeakIdx = -1, f2MaxVal = -1;
      for (let i = f2MinBin; i <= f2MaxBin; i++) {
        if (smoothed[i] > f2MaxVal) {
          if ((i === f2MinBin || smoothed[i] >= smoothed[i - 1]) &&
              (i === f2MaxBin || smoothed[i] >= smoothed[i + 1])) {
            f2MaxVal = smoothed[i];
            f2PeakIdx = i;
          }
        }
      }

      const f1 = f1PeakIdx > 0 ? f1PeakIdx * binWidth : (isFemale ? 550 : 450);
      const f2 = f2PeakIdx > 0 ? f2PeakIdx * binWidth : (isFemale ? 1600 : 1400);

      return { f1, f2 };
    }

    // Improved Targets based on acoustic phonetic measurements of Japanese vowels:
    // Female/Anime:
    // aa: F1~1000Hz, F2~1550Hz (distinctive high F1)
    // ih: F1~340Hz, F2~3000Hz (low F1, ultra high F2)
    // ou: F1~380Hz, F2~1350Hz (low F1, low-mid F2)
    // ee: F1~520Hz, F2~2500Hz (mid F1, high F2 > 2000Hz)
    // oh: F1~620Hz, F2~1150Hz (mid-high F1, low-mid F2 < 1400Hz)
    const improvedTargets = {
      female: {
        aa: { f1: 1050, f2: 1550, weightF1: 1.3, weightF2: 0.8 },
        ih: { f1: 340,  f2: 3000, weightF1: 1.1, weightF2: 1.1 },
        ou: { f1: 360,  f2: 1350, weightF1: 1.2, weightF2: 1.0 },
        ee: { f1: 520,  f2: 2500, weightF1: 1.0, weightF2: 1.2 },
        oh: { f1: 620,  f2: 1150, weightF1: 1.1, weightF2: 1.1 },
      },
    };

    const summary: Record<string, any> = {};

    for (const f of files) {
      const resp = await fetch(f.url);
      const arrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const channelData = audioBuffer.getChannelData(0);
      const bufferSize = 1024;
      Meyda.bufferSize = bufferSize;
      Meyda.sampleRate = audioBuffer.sampleRate;

      const counts: Record<string, number> = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0, nn: 0 };
      const f1s: number[] = [];
      const f2s: number[] = [];

      for (let i = 0; i + bufferSize <= channelData.length; i += 512) {
        const frame = channelData.subarray(i, i + bufferSize);
        const features = Meyda.extract(['rms', 'powerSpectrum'], frame);
        if (!features || features.rms < 0.02) {
          counts.nn++;
          continue;
        }

        const { f1, f2 } = findFormantPeaksImproved(
          features.powerSpectrum,
          audioBuffer.sampleRate,
          bufferSize,
          'female'
        );

        f1s.push(f1);
        f2s.push(f2);

        let bestP = 'nn';
        let minDist = Infinity;
        const targets = improvedTargets.female;

        for (const [p, target] of Object.entries(targets)) {
          const dF1 = Math.log(f1 / target.f1) * target.weightF1;
          const dF2 = Math.log(f2 / target.f2) * target.weightF2;
          let dist = Math.sqrt(dF1 * dF1 + dF2 * dF2);

          // Priority rule: 'aa' must have high F1 (>750Hz) to prevent 'oh' from stealing
          if (p === 'aa' && f1 < 800) {
            dist += 0.5; // penalize aa if jaw is not widely open
          }
          // 'ee' and 'ih' must have high F2 (>1800Hz)
          if ((p === 'ee' || p === 'ih') && f2 < 1800) {
            dist += 0.8;
          }
          // 'oh' and 'ou' must have lower F2 (<1700Hz)
          if ((p === 'oh' || p === 'ou') && f2 > 1700) {
            dist += 0.8;
          }

          if (dist < minDist) {
            minDist = dist;
            bestP = p;
          }
        }

        counts[bestP]++;
      }

      f1s.sort((a, b) => a - b);
      f2s.sort((a, b) => a - b);

      summary[f.name] = {
        target: f.target,
        medianF1: Math.round(f1s[Math.floor(f1s.length / 2)] || 0),
        medianF2: Math.round(f2s[Math.floor(f2s.length / 2)] || 0),
        classification: counts,
      };
    }

    return summary;
  });

  console.log('--- IMPROVED SIMULATION RESULTS ---');
  console.log(JSON.stringify(testReport, null, 2));
});
