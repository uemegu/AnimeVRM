import { AvatarConfig, deepAssign } from '../Config';
import {
  ScenePresetId,
  TimeOfDayId,
  LocationId,
  getScenePreset,
  getTimeOfDayPreset,
  getLocationPreset,
  SCENE_PRESETS,
  TIME_OF_DAY_PRESETS,
  createCombinedSceneConfig,
} from '../presets/ScenePresets';
import { t } from '../i18n';
import { showToast } from '../ui/components/Toast';
import { syncBgButtons } from '../ui/helpers';

export class ScenePresetManager {
  private config: AvatarConfig;
  private onConfigChange: (cfg: AvatarConfig) => void;
  private onInspectorsUpdate: () => void;

  constructor(options: {
    config: AvatarConfig;
    onConfigChange: (cfg: AvatarConfig) => void;
    onInspectorsUpdate: () => void;
  }) {
    this.config = options.config;
    this.onConfigChange = options.onConfigChange;
    this.onInspectorsUpdate = options.onInspectorsUpdate;
  }

  public getActiveTimeOfDay(): TimeOfDayId {
    const tod = this.config.activeScene?.timeOfDay as TimeOfDayId;
    if (tod && tod in TIME_OF_DAY_PRESETS) {
      return tod;
    }
    return 'morning';
  }

  public getScenePresetIdFromState(tod: TimeOfDayId, loc?: string): ScenePresetId {
    if (loc === 'school_gate') {
      if (tod === 'morning') return 'morning_school';
      if (tod === 'day') return 'day_school';
      if (tod === 'evening') return 'evening_school';
      if (tod === 'rainy') return 'rainy_school';
    } else if (loc === 'classroom') {
      if (tod === 'dark_indoor') return 'dark_indoor';
      return 'bright_indoor';
    }
    if (tod === 'morning') return 'morning_park';
    if (tod === 'day') return 'day_park';
    if (tod === 'evening') return 'evening_park';
    if (tod === 'rainy') return 'rainy_park';
    if (tod === 'dark_indoor') return 'dark_indoor';
    if (tod === 'bright_indoor') return 'bright_indoor';
    return 'morning_park';
  }

  public getActivePresetId(): ScenePresetId {
    if (this.config.activeScene?.presetId && this.config.activeScene.presetId in SCENE_PRESETS) {
      return this.config.activeScene.presetId as ScenePresetId;
    }
    const tod = this.getActiveTimeOfDay();
    const loc = this.config.activeScene?.location;
    return this.getScenePresetIdFromState(tod, loc);
  }

  public syncTimeOfDayButtons(): void {
    const activeTod = this.getActiveTimeOfDay();
    const todButtons = document.querySelectorAll<HTMLButtonElement>('.timeofday-btn');
    todButtons.forEach((btn) => {
      const id = btn.getAttribute('data-timeofday');
      btn.classList.toggle('active', id === activeTod);
    });
  }

  public applySceneConfig(combined: {
    environment: AvatarConfig['environment'];
    lighting: AvatarConfig['lighting'];
    postProcessing: AvatarConfig['postProcessing'];
    materials: AvatarConfig['materials'];
    outline: AvatarConfig['outline'];
    wind: AvatarConfig['wind'];
    rain: AvatarConfig['rain'];
  }): void {
    deepAssign(this.config.environment, combined.environment);
    deepAssign(this.config.lighting, combined.lighting);
    deepAssign(this.config.postProcessing, combined.postProcessing);
    deepAssign(this.config.materials, combined.materials);
    deepAssign(this.config.outline, combined.outline);
    deepAssign(this.config.wind, combined.wind);
    if (combined.rain) {
      if (!this.config.rain) this.config.rain = JSON.parse(JSON.stringify(combined.rain));
      else deepAssign(this.config.rain, combined.rain);
    }

    this.onConfigChange(this.config);
    this.onInspectorsUpdate();
    this.syncTimeOfDayButtons();
    syncBgButtons(this.config.environment.showBackgroundImage, this.config.environment.backgroundImageUrl);
  }

  public switchTimeOfDay(timeOfDayId: TimeOfDayId, notify = true): void {
    const currentLoc = (this.config.activeScene?.location || 'modern_park') as LocationId;
    const currentPresetId = this.getScenePresetIdFromState(timeOfDayId, currentLoc);
    this.config.activeScene = {
      presetId: currentPresetId,
      timeOfDay: timeOfDayId,
      location: currentLoc,
    };

    const combined = createCombinedSceneConfig(timeOfDayId, currentLoc);
    this.applySceneConfig(combined);

    const todPreset = getTimeOfDayPreset(timeOfDayId);
    if (notify) {
      showToast(`${t().toasts.sceneChanged}${todPreset.name}`);
    }
  }

  public switchLocation(locationId: LocationId, notify = false): void {
    const currentTod = (this.config.activeScene?.timeOfDay || 'morning') as TimeOfDayId;
    const currentPresetId = this.getScenePresetIdFromState(currentTod, locationId);
    this.config.activeScene = {
      presetId: currentPresetId,
      timeOfDay: currentTod,
      location: locationId,
    };

    const combined = createCombinedSceneConfig(currentTod, locationId);
    this.applySceneConfig(combined);

    const loc = getLocationPreset(locationId);
    if (notify) {
      showToast(`${loc.name}`);
    }
  }

  public switchScene(presetId: ScenePresetId, notify = true): void {
    const preset = getScenePreset(presetId);
    const tod = (presetId.startsWith('morning')
      ? 'morning'
      : presetId.startsWith('day')
      ? 'day'
      : presetId.startsWith('evening')
      ? 'evening'
      : presetId.startsWith('rainy')
      ? 'rainy'
      : presetId === 'bright_indoor'
      ? 'bright_indoor'
      : presetId === 'dark_indoor'
      ? 'dark_indoor'
      : 'morning') as TimeOfDayId;

    const loc = (presetId.includes('school')
      ? 'school_gate'
      : presetId.includes('indoor')
      ? 'classroom'
      : 'modern_park') as LocationId;

    this.config.activeScene = {
      presetId,
      location: loc,
      timeOfDay: tod,
    };

    const combined = createCombinedSceneConfig(tod, loc);
    this.applySceneConfig(combined);

    if (notify) {
      showToast(`${t().toasts.sceneChanged}${preset.name}`);
    }
  }
}
