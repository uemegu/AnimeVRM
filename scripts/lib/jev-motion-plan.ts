import type { MotionQualityPlan, Style } from '../../packages/motion/src/quality/types.ts';
import { validateMotionQualityPlan } from '../../packages/motion/src/quality/validate.ts';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MIN_CONFIDENCE = 0.65;

const QUESTIONS = {
  action: {
    type: 'choice',
    instructions: 'Which supported body-contact action is explicitly requested in `motion_request` or `acting_note`?',
    criteria: {
      face_touch: 'One hand gently touches the actor\'s own cheek, mouth, or chin.',
      palms_together: 'Both palms meet in front of the chest, such as a prayer or greeting pose.',
      none: 'Neither supported body-contact action is clearly requested.',
    },
  },
  side: {
    type: 'choice',
    instructions: 'For a one-hand face touch, which actor-relative hand is explicitly requested? Choose unspecified when the request does not say.',
    criteria: {
      left: 'The actor uses their own left hand.',
      right: 'The actor uses their own right hand.',
      unspecified: 'The request does not specify which hand.',
    },
  },
  target: {
    type: 'choice',
    instructions: 'For a one-hand face touch, which face region is explicitly requested? Choose unspecified when the request does not say.',
    criteria: {
      cheek: 'Touch the cheek.', mouth: 'Touch near the mouth.', chin: 'Touch the chin.',
      unspecified: 'The request does not specify cheek, mouth, or chin.',
    },
  },
  target_side: {
    type: 'choice',
    instructions: 'For a cheek touch, which side of the actor\'s own face is touched? This is distinct from which hand moves. Choose unspecified if a cheek was not specified.',
    criteria: {
      left: 'Touch the actor\'s own left cheek.',
      right: 'Touch the actor\'s own right cheek.',
      center: 'Touch a centered face region such as the mouth or chin.',
      unspecified: 'The request does not say which cheek.',
    },
  },
  onset: {
    type: 'choice',
    instructions: 'When should the contact begin within the full motion? Choose from explicit timing when present; otherwise choose middle.',
    criteria: {
      early: 'The contact begins in the first quarter of the motion.',
      middle: 'The contact begins around the middle of the motion.',
      late: 'The contact begins in the final third of the motion.',
    },
  },
  approach: {
    type: 'score',
    instructions: 'How long should the hand take to approach the contact target?',
    criteria: [
      'Very quick approach, with little anticipation.',
      'Brief, controlled approach.',
      'Moderate, clearly readable approach.',
      'Slow, gentle approach with visible anticipation.',
    ],
  },
  hold: {
    type: 'score',
    instructions: 'How long should the hand remain at the contact target?',
    criteria: [
      'A brief tap; release almost immediately.',
      'A short contact.',
      'A moderate, readable hold.',
      'A long, deliberate hold.',
    ],
  },
  style: {
    type: 'choice',
    instructions: 'Which supported arm presentation best matches the requested acting direction? If the text explicitly asks for feminine, graceful, gentle, shy, or restrained acting, choose soft_compact. Never infer a gender from the actor or avatar.',
    criteria: {
      neutral: 'Use the neutral arm path.',
      soft_compact: 'Use a softer, graceful, more compact elbow path while preserving the contact target.',
    },
  },
  style_strength: {
    type: 'score',
    instructions: 'How strongly does `acting_note` or `motion_request` ask for a softer, more compact arm presentation?',
    criteria: [
      'No soft or compact presentation is requested.',
      'Only a subtle soft and compact presentation is requested.',
      'A clearly soft and compact presentation is requested.',
      'A very strongly soft and compact presentation is requested.',
    ],
  },
} as const;

type FetchLike = typeof fetch;
interface ConfidencePolicy<T> {
  required?: boolean;
  fallback?: T;
  fallbacks?: string[];
}

interface JevAnswer {
  type?: string;
  choice?: string;
  score?: number;
  confidence?: number;
}
interface JevResponse {
  answers?: Record<string, JevAnswer>;
}

export interface JevPlanResult {
  plan: MotionQualityPlan;
  confidence: Record<string, number>;
  model: string;
  note: string;
}

function answerRecord(value: unknown, id: string): JevAnswer {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Jev did not return the required “${id}” answer.`);
  }
  return value as JevAnswer;
}

function isConfident(answer: JevAnswer, id: string, confidences: Record<string, number>, required: boolean): boolean {
  const raw = answer.confidence;
  const confidence = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0;
  confidences[id] = confidence;
  if (required && confidence < MIN_CONFIDENCE) {
    throw new Error(`Jev was not confident enough about “${id}”; review the acting note and try again.`);
  }
  return confidence >= MIN_CONFIDENCE;
}

function choice(
  answers: Record<string, JevAnswer>,
  id: string,
  allowed: readonly string[],
  confidences: Record<string, number>,
  policy: ConfidencePolicy<string> = {},
): string {
  const answer = answerRecord(answers[id], id);
  if (!allowed.includes(String(answer.choice))) throw new Error(`Jev returned an unsupported “${id}” choice.`);
  const confident = isConfident(answer, id, confidences, policy.required ?? true);
  if (!confident && policy.fallback !== undefined) {
    policy.fallbacks?.push(id);
    return policy.fallback;
  }
  return answer.choice!;
}

function score(
  answers: Record<string, JevAnswer>,
  id: string,
  max: number,
  confidences: Record<string, number>,
  policy: ConfidencePolicy<number> = {},
): number {
  const answer = answerRecord(answers[id], id);
  if (typeof answer.score !== 'number' || !Number.isFinite(answer.score) || answer.score < 0 || answer.score > max) {
    throw new Error(`Jev returned an invalid “${id}” score.`);
  }
  const confident = isConfident(answer, id, confidences, policy.required ?? true);
  if (!confident && policy.fallback !== undefined) {
    policy.fallbacks?.push(id);
    return policy.fallback;
  }
  return answer.score;
}

function onsetRatio(value: string): number {
  return value === 'early' ? 0.15 : value === 'late' ? 0.42 : 0.27;
}

/** Ask Jev many small typed questions in one System One request, then compose a bounded plan in code. */
export async function createJevMotionPlan(
  options: {
    prompt: string;
    actingNote?: string;
    duration: number;
    apiKey?: string;
    fetchImpl?: FetchLike;
  },
): Promise<JevPlanResult> {
  const apiKey = options.apiKey ?? process.env.JEV_API_KEY ?? process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error('Jev planning needs JEV_API_KEY (or TYPESAFE_API_KEY) in the environment.');
  if (!Number.isFinite(options.duration) || options.duration < 2 || options.duration > 8) {
    throw new RangeError('Jev planning duration must be between 2 and 8 seconds.');
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'jev-latest',
      state: { motion_request: options.prompt, acting_note: options.actingNote ?? '' },
      questions: QUESTIONS,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Jev request failed with HTTP ${response.status}.`);
  const body = await response.json() as JevResponse;
  if (!body.answers || typeof body.answers !== 'object') throw new Error('Jev returned no typed answers.');

  const confidence: Record<string, number> = {};
  const fallbacks: string[] = [];
  const action = choice(body.answers, 'action', ['face_touch', 'palms_together', 'none'], confidence);
  const contactNeedsHandAndFace = action === 'face_touch';
  const side = choice(body.answers, 'side', ['left', 'right', 'unspecified'], confidence, { required: contactNeedsHandAndFace });
  const target = choice(body.answers, 'target', ['cheek', 'mouth', 'chin', 'unspecified'], confidence, { required: contactNeedsHandAndFace });
  const targetSide = choice(body.answers, 'target_side', ['left', 'right', 'center', 'unspecified'], confidence, { required: contactNeedsHandAndFace && target === 'cheek' });
  const onset = choice(body.answers, 'onset', ['early', 'middle', 'late'], confidence, { required: false, fallback: 'middle', fallbacks });
  const approach = score(body.answers, 'approach', 3, confidence, { required: false, fallback: 1.5, fallbacks });
  const hold = score(body.answers, 'hold', 3, confidence, { required: false, fallback: 1.5, fallbacks });
  const jevStyle = choice(body.answers, 'style', ['neutral', 'soft_compact'], confidence, { required: false, fallback: 'neutral', fallbacks });
  const styleLevel = score(body.answers, 'style_strength', 3, confidence, { required: false, fallback: 1, fallbacks });

  if (action === 'face_touch' && (side === 'unspecified' || target === 'unspecified' || (target === 'cheek' && targetSide !== 'left' && targetSide !== 'right'))) {
    throw new Error('Jev could not determine a single hand and face target side. Add them to --acting-note before generating.');
  }

  const duration = options.duration;
  const start = duration * onsetRatio(onset);
  const holdStart = start + duration * (0.07 + approach / 3 * 0.12);
  const holdDuration = duration * (0.04 + hold / 3 * 0.18);
  const holdEnd = Math.min(duration - duration * 0.12, holdStart + holdDuration);
  const end = Math.min(duration, holdEnd + duration * 0.12);
  const contacts: MotionQualityPlan['contacts'] = action === 'none' ? [] : action === 'palms_together'
    ? [{ kind: 'palmsTogether', start, holdStart, holdEnd, end }]
    : target === 'cheek'
      ? [{ kind: 'face', side: side as 'left' | 'right', target: 'cheek', targetSide: targetSide as 'left' | 'right', start, holdStart, holdEnd, end }]
      : [{ kind: 'face', side: side as 'left' | 'right', target: target as 'mouth' | 'chin', start, holdStart, holdEnd, end }];
  const style: Style = action !== 'none' && jevStyle === 'soft_compact' && styleLevel > 0 ? 'soft-compact' : 'neutral';
  const plan = validateMotionQualityPlan({
    version: 1,
    duration,
    style,
    styleStrength: style === 'soft-compact' ? styleLevel / 3 : 0,
    timingSource: 'template',
    contacts,
  });
  return {
    plan,
    confidence,
    model: typeof (body as JevResponse & { model?: unknown }).model === 'string'
      ? (body as JevResponse & { model: string }).model
      : 'jev-latest',
    note: [
      options.actingNote?.trim() || 'No additional acting note was provided.',
      fallbacks.length ? `Used deterministic defaults for low-confidence fields: ${fallbacks.join(', ')}.` : '',
      action === 'none' ? 'No supported body-contact correction was selected; the motion and acting note will still be sent to ardy-mini.' : '',
    ].filter(Boolean).join(' '),
  };
}
