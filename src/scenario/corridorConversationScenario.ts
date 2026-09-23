import { ScenarioPackage } from './types';
import { resolveAssetUrl } from '../utils/path';

export const CORRIDOR_CONVERSATION_SCENARIO: ScenarioPackage = {
  id: 'corridor_conversation',
  title: '休み時間の廊下 〜賑わう教室と2人の約束〜',
  characters: [
    {
      id: 'aoi',
      character: resolveAssetUrl('/models/aoi/aoi-school.vrm'),
      position: [0.3, 0, -0.45],
      rotationY: -0.2,
    },
  ],
  bgmUrl: resolveAssetUrl('/bgm/bgm.mp3'),
  bgmVolume: 0.2,
  chapters: [
    {
      id: 'main',
      title: '休み時間の廊下',
      scenes: [
        // ============================================================
        // Scene 1: 賑わう廊下でアオイと遭遇
        // ============================================================
        {
          id: 'corridor_1',
          speaker: 'アオイ',
          speakerCharacterId: 'aoi',
          dialogueTarget: 'player',
          location: '2階・教室前の廊下',
          scenePreset: 'bright_indoor',
          background: resolveAssetUrl('/textures/school-corridor-far.avif'),
          text: '「あ、見つけた！休み時間になったのに教室にいなかったから、探しに来ちゃった。」',
          crowd: {
            enabled: true,
            preset: 'corridor',
            opacity: 0.6,
          },
          cameraZoom: 'wide',
          cameraDistance: 1.15,
          cameraTransitionDuration: 0,
          cameraTransitionEasing: 'cut',
          cameraPreset: 'hold',
          avatars: {
            aoi: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [0.3, 0, -0.45],
              rotationY: -0.2,
              lookAtCamera: true,
            },
          },
        },
        // ============================================================
        // Scene 2: 移動教室の誘い
        // ============================================================
        {
          id: 'corridor_2',
          speaker: 'アオイ',
          speakerCharacterId: 'aoi',
          dialogueTarget: 'player',
          location: '2階・教室前の廊下',
          scenePreset: 'bright_indoor',
          background: resolveAssetUrl('/textures/school-corridor-far.avif'),
          text: '「次の時間は理科室で実験だよ。ほら、廊下もみんな移動で賑わってきたし、一緒に行こ？」',
          crowd: {
            enabled: true,
            preset: 'corridor',
            opacity: 0.6,
          },
          cameraZoom: 'medium',
          cameraDistance: 1.0,
          cameraTransitionDuration: 0.6,
          cameraTransitionEasing: 'smooth',
          cameraPreset: 'pushIn',
          avatars: {
            aoi: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Greeting.fbx'),
              expression: 'happy',
              expressionWeight: 1.0,
              position: [0.3, 0, -0.45],
              rotationY: -0.2,
              lookAtCamera: true,
            },
          },
        },
        // ============================================================
        // Scene 3: 一緒に出発
        // ============================================================
        {
          id: 'corridor_3',
          speaker: 'アオイ',
          speakerCharacterId: 'aoi',
          dialogueTarget: 'player',
          location: '2階・教室前の廊下',
          scenePreset: 'bright_indoor',
          background: resolveAssetUrl('/textures/school-corridor-far.avif'),
          text: '「ふふっ、よし！ノート持った？教科書は忘れてない？……じゃあ、出発！」',
          crowd: {
            enabled: true,
            preset: 'corridor',
            opacity: 0.6,
          },
          cameraZoom: 'speaker',
          cameraDistance: 0.95,
          cameraTransitionDuration: 0.5,
          cameraTransitionEasing: 'smooth',
          cameraPreset: 'hold',
          avatars: {
            aoi: {
              visible: true,
              motion: resolveAssetUrl('/animations/Standing Idle.fbx'),
              expression: 'smile',
              expressionWeight: 1.0,
              position: [0.3, 0, -0.45],
              rotationY: -0.2,
              lookAtCamera: true,
            },
          },
        },
      ],
    },
  ],
};

export function getCorridorConversationScenario(): ScenarioPackage {
  return CORRIDOR_CONVERSATION_SCENARIO;
}

