import { test } from '@playwright/test';

test('diagnose formant frequencies and vowel classification errors', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('lipsync.html');
  await page.waitForTimeout(3000);

  // Expose evaluation function to test any audio file
  const results = await page.evaluate(async () => {
    const files = [
      { name: 'female_a', url: 'voices/lipsync_female_a.wav', target: 'aa', gender: 'female' },
      { name: 'female_i', url: 'voices/lipsync_female_i.wav', target: 'ih', gender: 'female' },
      { name: 'female_u', url: 'voices/lipsync_female_u.wav', target: 'ou', gender: 'female' },
      { name: 'female_e', url: 'voices/lipsync_female_e.wav', target: 'ee', gender: 'female' },
      { name: 'female_o', url: 'voices/lipsync_female_o.wav', target: 'oh', gender: 'female' },
      { name: 'female_vowels', url: 'voices/lipsync_vowels_female.wav', target: 'all', gender: 'female' },
    ];

    const logs: Record<string, any> = {};

    // Get AudioLipSync instance from window (we can inspect or fetch audio buffer)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();

    for (const f of files) {
      const resp = await fetch(f.url);
      const arrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Analyze offline using same Meyda extraction and formant finding
      const Meyda = (window as any).Meyda || (await import('meyda')).default;
      const channelData = audioBuffer.getChannelData(0);
      const bufferSize = 1024;
      Meyda.bufferSize = bufferSize;
      Meyda.sampleRate = audioBuffer.sampleRate;

      const f1List: number[] = [];
      const f2List: number[] = [];
      const phonemeCounts: Record<string, number> = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0, nn: 0 };
      const frameDistances: Array<{ phoneme: string; f1: number; f2: number; dists: any }> = [];

      // Step through frames
      const step = 512;
      for (let i = 0; i + bufferSize <= channelData.length; i += step) {
        const frame = channelData.subarray(i, i + bufferSize);
        const features = Meyda.extract(['rms', 'powerSpectrum'], frame);
        if (!features || features.rms < 0.02) {
          phonemeCounts.nn++;
          continue;
        }

        // Call AudioLipSync's findFormantPeaks logic
        const spectrum = features.powerSpectrum;
        const binWidth = audioBuffer.sampleRate / bufferSize;
        const numBins = spectrum.length;
        const smoothRadius = Math.max(2, Math.round(180 / (2 * binWidth)));
        const smoothed = new Float32Array(numBins);
        for (let b = 0; b < numBins; b++) {
          let sum = 0, count = 0;
          for (let w = -smoothRadius; w <= smoothRadius; w++) {
            const idx = b + w;
            if (idx >= 0 && idx < numBins) {
              sum += spectrum[idx];
              count++;
            }
          }
          smoothed[b] = sum / (count || 1);
        }

        const isFemale = f.gender === 'female';
        const f1MinBin = Math.round((isFemale ? 260 : 200) / binWidth);
        const f1MaxBin = Math.round((isFemale ? 1250 : 1050) / binWidth);
        let f1PeakIdx = -1, f1MaxVal = -1;
        for (let b = f1MinBin; b <= f1MaxBin; b++) {
          if (smoothed[b] > f1MaxVal) {
            if ((b === f1MinBin || smoothed[b] >= smoothed[b - 1]) &&
                (b === f1MaxBin || smoothed[b] >= smoothed[b + 1])) {
              f1MaxVal = smoothed[b];
              f1PeakIdx = b;
            }
          }
        }

        const f2MinHz = isFemale ? 800 : 700;
        const f2MaxHz = isFemale ? 3800 : 3400;
        const f2MinBin = Math.max(f1PeakIdx + Math.round(200 / binWidth), Math.round(f2MinHz / binWidth));
        const f2MaxBin = Math.round(f2MaxHz / binWidth);
        let f2PeakIdx = -1, f2MaxVal = -1;
        for (let b = f2MinBin; b <= f2MaxBin; b++) {
          if (smoothed[b] > f2MaxVal) {
            if ((b === f2MinBin || smoothed[b] >= smoothed[b - 1]) &&
                (b === f2MaxBin || smoothed[b] >= smoothed[b + 1])) {
              f2MaxVal = smoothed[b];
              f2PeakIdx = b;
            }
          }
        }

        const f1 = f1PeakIdx > 0 ? f1PeakIdx * binWidth : (isFemale ? 550 : 450);
        const f2 = f2PeakIdx > 0 ? f2PeakIdx * binWidth : (isFemale ? 1600 : 1400);

        f1List.push(f1);
        f2List.push(f2);

        // Calculate distances with current targets
        const targets = {
          aa: { f1: 950, f2: 1550, weightF1: 1.0, weightF2: 0.85 },
          ih: { f1: 340, f2: 2950, weightF1: 1.1, weightF2: 1.0 },
          ou: { f1: 380, f2: 1100, weightF1: 1.1, weightF2: 0.95 },
          ee: { f1: 580, f2: 2350, weightF1: 1.0, weightF2: 1.0 },
          oh: { f1: 540, f2: 950, weightF1: 1.0, weightF2: 0.95 },
        };

        let bestP = 'nn';
        let minDist = Infinity;
        const dists: Record<string, number> = {};
        for (const [p, target] of Object.entries(targets)) {
          const dF1 = Math.log(f1 / target.f1) * target.weightF1;
          const dF2 = Math.log(f2 / target.f2) * target.weightF2;
          const dist = Math.sqrt(dF1 * dF1 + dF2 * dF2);
          dists[p] = Math.round(dist * 100) / 100;
          if (dist < minDist) {
            minDist = dist;
            bestP = p;
          }
        }

        phonemeCounts[bestP] = (phonemeCounts[bestP] || 0) + 1;
        if (frameDistances.length < 5) {
          frameDistances.push({ phoneme: bestP, f1: Math.round(f1), f2: Math.round(f2), dists });
        }
      }

      // Median F1 and F2
      f1List.sort((a, b) => a - b);
      f2List.sort((a, b) => a - b);
      const medF1 = f1List[Math.floor(f1List.length / 2)] || 0;
      const medF2 = f2List[Math.floor(f2List.length / 2)] || 0;

      logs[f.name] = {
        target: f.target,
        frames: f1List.length,
        medianF1: Math.round(medF1),
        medianF2: Math.round(medF2),
        classification: phonemeCounts,
        sampleFrames: frameDistances,
      };
    }

    return logs;
  });

  console.log('--- DIAGNOSTIC RESULTS ---');
  console.log(JSON.stringify(results, null, 2));
});
