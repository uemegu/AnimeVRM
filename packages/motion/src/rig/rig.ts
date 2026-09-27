import type { VRMHumanBoneName } from '@pixiv/three-vrm';

/** The Mixamo source rig used by both the editor preview and generated motion imports. */
export const MIXAMO_VRM_BONES: Record<string, VRMHumanBoneName> = {
  Hips: 'hips', Spine: 'spine', Spine1: 'chest', Spine2: 'upperChest', Neck: 'neck', Head: 'head',
};
for (const side of ['Left', 'Right']) {
  for (const [source, target] of Object.entries({ Shoulder: 'Shoulder', Arm: 'UpperArm', ForeArm: 'LowerArm', Hand: 'Hand', UpLeg: 'UpperLeg', Leg: 'LowerLeg', Foot: 'Foot', ToeBase: 'Toes' })) {
    MIXAMO_VRM_BONES[side + source] = (side.toLowerCase() + target) as VRMHumanBoneName;
  }
  for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
    for (let joint = 1; joint <= 3; joint++) {
      const segment = (finger === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'])[joint - 1];
      MIXAMO_VRM_BONES[`${side}Hand${finger}${joint}`] = (side.toLowerCase() + (finger === 'Pinky' ? 'Little' : finger) + segment) as VRMHumanBoneName;
    }
  }
}
