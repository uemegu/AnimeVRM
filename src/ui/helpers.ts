import { Phoneme } from '../AudioLipSync';
import { getLanguage, t } from '../i18n';

let panelOpenCallback: (open: boolean) => void = () => {};

export function registerPanelOpenCallback(cb: (open: boolean) => void): void {
  panelOpenCallback = cb;
}

export function setPanelOpen(open: boolean): void {
  panelOpenCallback(open);
}

export function updateAnimationPlayStateUI(isPlaying: boolean): void {
  const playBtn = document.getElementById('anim-play-btn');
  if (playBtn) {
    playBtn.textContent = isPlaying ? '⏹ 再生中 (停止/再開)' : '▶ アニメーション再生';
    playBtn.style.background = isPlaying ? '#ea580c' : '#4772b3';
  }

  const panel = document.getElementById('panel-container');
  const gearBtn = document.getElementById('settings-open-btn');

  if (isPlaying) {
    if (panel) panel.style.display = 'none';
    if (gearBtn) gearBtn.style.display = 'none';
  } else {
    setPanelOpen(true);
  }
}

export function updateScenarioPlayStateUI(
  isPlayerPlaying: boolean,
  isEnginePlaying: boolean,
  isMultiAvatarScenarioActive: boolean
): void {
  const playBtn = document.getElementById('scenario-play-btn');
  const confessionBtn = document.getElementById('scenario-confession-btn');
  const twogirlsBtn = document.getElementById('scenario-twogirls-btn');
  const statusBox = document.getElementById('scenario-status-box');
  const panel = document.getElementById('panel-container');
  const gearBtn = document.getElementById('settings-open-btn');
  const tr = t();

  if (playBtn) {
    playBtn.textContent = isPlayerPlaying ? `⏹ ${tr.common.stop}` : tr.scenario.playSequence;
    playBtn.style.background = isPlayerPlaying ? '#ea580c' : '#4772b3';
  }
  if (confessionBtn) {
    const isConfessionPlaying = isEnginePlaying && !isMultiAvatarScenarioActive;
    confessionBtn.textContent = isConfessionPlaying ? `⏹ ${tr.common.stop}` : tr.scenario.playConfession;
    confessionBtn.style.background = isConfessionPlaying
      ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
      : 'linear-gradient(135deg, #db2777 0%, #be185d 100%)';
  }
  if (twogirlsBtn) {
    const isTwoGirlsPlaying = isEnginePlaying && isMultiAvatarScenarioActive;
    twogirlsBtn.textContent = isTwoGirlsPlaying ? `⏹ ${tr.common.stop}` : tr.scenario.playTwoGirls;
    twogirlsBtn.style.background = isTwoGirlsPlaying
      ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
      : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
  }
  if (statusBox) {
    statusBox.style.display = isPlayerPlaying ? 'block' : 'none';
  }

  const isAnyPlaying = isPlayerPlaying || isEnginePlaying;
  if (isAnyPlaying) {
    if (panel) panel.style.display = 'none';
    if (gearBtn) gearBtn.style.display = 'none';
  } else {
    setPanelOpen(true);
  }
}

export function updateScenarioStepUI(index: number, step: { text: string; motionUrl?: string; expression?: string }): void {
  const stepLabel = document.getElementById('scenario-current-step');
  const stepText = document.getElementById('scenario-current-text');
  const tr = t();
  if (stepLabel) {
    const stepNames = [tr.scenario.steps.step1Title, tr.scenario.steps.step2Title, tr.scenario.steps.step3Title];
    stepLabel.textContent = stepNames[index] || `Step ${index + 1}`;
  }
  if (stepText) {
    stepText.textContent = `「${step.text}」`;
  }
}

export function updateScenarioDebugUI(scene: any, state: any): void {
  const sceneLabel = document.getElementById('scenario-engine-scene-id');
  const speakerLabel = document.getElementById('scenario-engine-speaker');
  const flagsLabel = document.getElementById('scenario-engine-flags');
  const textLabel = document.getElementById('scenario-engine-text');
  const tr = t();
  if (sceneLabel) sceneLabel.textContent = scene.id || '-';
  if (speakerLabel) speakerLabel.textContent = scene.speaker || (getLanguage() === 'en' ? '(Narration)' : '(地の文/ナレーション)');
  if (flagsLabel) {
    const flagArray = Array.from(state.flags as Set<string>);
    flagsLabel.textContent = flagArray.length > 0 ? flagArray.join(', ') : tr.scenario.noneFlags;
  }
  if (textLabel) textLabel.textContent = scene.text || '';
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function updateLipSyncPhonemeDisplay(phoneme: Phoneme | 'nn' | undefined): void {
  const pTags = document.querySelectorAll<HTMLElement>('.phoneme-tag');
  pTags.forEach((el) => {
    const p = el.getAttribute('data-phoneme');
    if (phoneme === p || (!phoneme && p === 'nn')) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

export function updatePlayStateUI(isPlaying: boolean): void {
  const playBtn = document.getElementById('audio-play-pause-btn');
  if (playBtn) {
    playBtn.textContent = isPlaying ? '⏸ 一時停止' : '▶ 再生';
    playBtn.style.background = isPlaying ? '#ea580c' : '#4772b3';
  }
}

export function updateAudioTimeUI(currentTime: number, duration: number): void {
  const timeLabel = document.getElementById('audio-time');
  const seekbar = document.getElementById('audio-seekbar') as HTMLInputElement | null;

  if (timeLabel) {
    timeLabel.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  }
  if (seekbar && duration > 0 && !seekbar.matches(':active')) {
    seekbar.value = ((currentTime / duration) * 100).toString();
  }
}

export function syncBgButtons(showBackgroundImage: boolean, backgroundImageUrl?: string): void {
  const bgButtons = document.querySelectorAll<HTMLButtonElement>('.bg-btn');
  bgButtons.forEach((b) => {
    const val = b.getAttribute('data-bg');
    if (!showBackgroundImage) {
      b.classList.toggle('active', val === 'none');
    } else {
      b.classList.toggle('active', val === backgroundImageUrl);
    }
  });
}
