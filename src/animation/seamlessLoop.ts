import * as THREE from 'three';

/** Longest stretch of a clip cross-faded into its start. */
const MAX_BLEND_SECONDS = 0.8;
/** A loop whose first and last poses differ by less than this is left as authored. */
const SEAM_TOLERANCE_RADIANS = THREE.MathUtils.degToRad(2);
const SEAM_TOLERANCE_METERS = 0.01;
const RESAMPLE_FPS = 30;

const seamlessClips = new WeakMap<THREE.AnimationClip, THREE.AnimationClip>();

/**
 * Returns a version of the clip that repeats without a jump at the loop point.
 * Clips that already loop cleanly (Mixamo idles, walk cycles) come back unchanged;
 * results are cached per clip, so every avatar playing the same clip shares one.
 */
export function getSeamlessLoopClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  let seamless = seamlessClips.get(clip);
  if (!seamless) {
    seamless = makeSeamlessLoop(clip);
    seamlessClips.set(clip, seamless);
  }
  return seamless;
}

/** Whether the clip's last pose differs visibly from its first. */
function hasLoopSeam(clip: THREE.AnimationClip): boolean {
  const first = new THREE.Quaternion();
  const last = new THREE.Quaternion();
  return clip.tracks.some((track) => {
    const size = track.getValueSize();
    const values = track.values;
    const end = values.length - size;
    if (size === 4) {
      return first.fromArray(values, 0).angleTo(last.fromArray(values, end)) > SEAM_TOLERANCE_RADIANS;
    }
    let distance = 0;
    for (let k = 0; k < size; k += 1) distance += (values[end + k] - values[k]) ** 2;
    return Math.sqrt(distance) > SEAM_TOLERANCE_METERS;
  });
}

/**
 * Makes a clip loop without a jump: the last `blend` seconds are cut off and
 * cross-faded into the start, so the loop point passes through the clip's own
 * motion instead of snapping from its last pose back to its first.
 * The looped clip is `blend` seconds shorter than the original.
 */
function makeSeamlessLoop(clip: THREE.AnimationClip): THREE.AnimationClip {
  if (clip.duration < 0.4 || !hasLoopSeam(clip)) return clip;

  const blend = Math.min(MAX_BLEND_SECONDS, clip.duration * 0.25);
  const duration = clip.duration - blend;
  const frameCount = Math.max(2, Math.round(duration * RESAMPLE_FPS) + 1);
  const times = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i += 1) {
    times[i] = Math.min(duration, i / RESAMPLE_FPS);
  }

  const quatTail = new THREE.Quaternion();
  const quatHead = new THREE.Quaternion();
  const tracks = clip.tracks.map((track) => {
    const size = track.getValueSize();
    const interpolant = (track as THREE.KeyframeTrack & { createInterpolant(): THREE.Interpolant })
      .createInterpolant();
    const values = new Float32Array(frameCount * size);
    const head = new Float32Array(size);
    for (let i = 0; i < frameCount; i += 1) {
      const t = times[i];
      head.set(interpolant.evaluate(t));
      if (t < blend) {
        // Start from where the cut-off tail leaves off, easing into the clip's own start.
        const tail = Float32Array.from(interpolant.evaluate(t + duration));
        const w = THREE.MathUtils.smoothstep(t / blend, 0, 1);
        if (size === 4) {
          quatTail.fromArray(tail).slerp(quatHead.fromArray(head), w).toArray(values, i * 4);
        } else {
          for (let k = 0; k < size; k += 1) {
            values[i * size + k] = tail[k] + (head[k] - tail[k]) * w;
          }
        }
      } else {
        values.set(head, i * size);
      }
    }
    const TrackType = track.constructor as new (
      name: string, times: ArrayLike<number>, values: ArrayLike<number>
    ) => THREE.KeyframeTrack;
    return new TrackType(track.name, times, values);
  });
  return new THREE.AnimationClip(`${clip.name} (seamless loop)`, duration, tracks);
}
