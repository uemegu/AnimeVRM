import { expect, test } from '@playwright/test';
import { createJevMotionPlan } from '../scripts/lib/jev-motion-plan.ts';

function answerSet(overrides: Record<string, { choice?: string; score?: number; confidence?: number }> = {}) {
  const choiceAnswer = (choice: string) => ({ type: 'choice', choice, confidence: .92 });
  const scoreAnswer = (score: number) => ({ type: 'score', score, confidence: .88 });
  return {
    action: choiceAnswer('face_touch'),
    side: choiceAnswer('left'),
    target: choiceAnswer('cheek'),
    target_side: choiceAnswer('left'),
    onset: choiceAnswer('early'),
    approach: scoreAnswer(2),
    hold: scoreAnswer(2),
    style: choiceAnswer('soft_compact'),
    style_strength: scoreAnswer(2),
    ...overrides,
  };
}

test('asks many typed questions in one Jev call and composes a reviewable motion plan', async () => {
  let requestCount = 0;
  let request: Record<string, any> | undefined;
  const result = await createJevMotionPlan({
    prompt: 'A person touches their left cheek and pauses.',
    actingNote: 'gentle and shy',
    duration: 4,
    apiKey: 'test-key',
    fetchImpl: async (input, init) => {
      requestCount++;
      expect(String(input)).toBe('https://api.typesafe.ai/v1/systemone');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
      request = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ model: 'jev-1.test', answers: answerSet() }), { status: 200 });
    },
  });

  expect(requestCount).toBe(1);
  expect(request?.model).toBe('jev-latest');
  expect(Object.keys(request?.questions ?? {})).toHaveLength(9);
  expect(result.plan.timingSource).toBe('template');
  expect(result.plan.style).toBe('soft-compact');
  expect(result.plan.contacts[0]).toMatchObject({ kind: 'face', side: 'left', target: 'cheek', targetSide: 'left' });
  expect(result.plan.contacts[0].start).toBeLessThan(result.plan.contacts[0].holdStart);
  expect(result.plan.contacts[0].holdEnd).toBeLessThan(result.plan.contacts[0].end);
  expect(Object.keys(result.confidence)).toHaveLength(9);
  expect(JSON.stringify(request)).not.toContain('test-key');
});

test('does not guess when a required Jev judgment has low confidence', async () => {
  await expect(createJevMotionPlan({
    prompt: 'Maybe make some kind of gesture.',
    duration: 4,
    apiKey: 'test-key',
    fetchImpl: async () => new Response(JSON.stringify({ answers: answerSet({ action: { choice: 'none', confidence: .51 } }) }), { status: 200 }),
})).rejects.toThrow('not confident enough');
});

test('uses safe deterministic defaults for low-confidence timing and acting strength', async () => {
  const answers = answerSet({
    onset: { choice: 'late', confidence: .4 },
    approach: { score: 3, confidence: .4 },
    hold: { score: 3, confidence: .4 },
    style: { choice: 'soft_compact', confidence: .4 },
    style_strength: { score: 3, confidence: .4 },
  });
  const result = await createJevMotionPlan({
    prompt: 'The actor touches her left cheek.', duration: 4, apiKey: 'test-key',
    fetchImpl: async () => new Response(JSON.stringify({ answers }), { status: 200 }),
  });
  expect(result.plan.contacts[0].start).toBeCloseTo(.27 * 4);
  expect(result.plan.style).toBe('neutral');
  expect(result.note).toContain('onset, approach, hold, style, style_strength');
});

test('does not require irrelevant hand and face answers for a palms-together action', async () => {
  const answers = answerSet({
    action: { choice: 'palms_together', confidence: .9 },
    side: { choice: 'unspecified', confidence: .1 },
    target: { choice: 'unspecified', confidence: .1 },
  });
  const result = await createJevMotionPlan({
    prompt: 'The actor brings both palms together.', duration: 4, apiKey: 'test-key',
    fetchImpl: async () => new Response(JSON.stringify({ answers }), { status: 200 }),
  });
  expect(result.plan.contacts[0].kind).toBe('palmsTogether');
});

test('does not claim contact style correction for unsupported non-contact actions', async () => {
  const result = await createJevMotionPlan({
    prompt: 'She waves twice with her right hand.', actingNote: 'feminine, graceful', duration: 4, apiKey: 'test-key',
    fetchImpl: async () => new Response(JSON.stringify({ answers: answerSet({
      action: { choice: 'none', confidence: .95 },
    }) }), { status: 200 }),
  });
  expect(result.plan.contacts).toEqual([]);
  expect(result.plan.style).toBe('neutral');
  expect(result.plan.styleStrength).toBe(0);
  expect(result.note).toContain('motion and acting note will still be sent to ardy-mini');
});

test('rejects malformed Jev scores and unavailable credentials before making a request', async () => {
  let calls = 0;
  await expect(createJevMotionPlan({
    prompt: 'Touch a cheek.', duration: 4, apiKey: 'test-key',
    fetchImpl: async () => {
      calls++;
      return new Response(JSON.stringify({ answers: answerSet({ hold: { score: 8, confidence: .99 } }) }), { status: 200 });
    },
  })).rejects.toThrow('invalid “hold” score');
  expect(calls).toBe(1);
  await expect(createJevMotionPlan({ prompt: 'Touch a cheek.', duration: 4, apiKey: '' })).rejects.toThrow('JEV_API_KEY');
});

test('uses JEV_API_KEY from the environment when no explicit key is passed', async () => {
  const previousJevKey = process.env.JEV_API_KEY;
  const previousTypesafeKey = process.env.TYPESAFE_API_KEY;
  process.env.JEV_API_KEY = 'test-jev-key';
  delete process.env.TYPESAFE_API_KEY;
  let authorization = '';
  try {
    await createJevMotionPlan({
      prompt: 'The actor raises her left hand to her right cheek.', duration: 4,
      fetchImpl: async (_input, init) => {
        authorization = new Headers(init?.headers).get('Authorization') ?? '';
        return new Response(JSON.stringify({ model: 'jev-1.test', answers: answerSet() }), { status: 200 });
      },
    });
  } finally {
    if (previousJevKey === undefined) delete process.env.JEV_API_KEY;
    else process.env.JEV_API_KEY = previousJevKey;
    if (previousTypesafeKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = previousTypesafeKey;
  }
  expect(authorization).toBe('Bearer test-jev-key');
});

test('requires an explicit hand and face region when Jev identifies a face-contact action', async () => {
  await expect(createJevMotionPlan({
    prompt: 'A person touches their face.', duration: 4, apiKey: 'test-key',
    fetchImpl: async () => new Response(JSON.stringify({ answers: answerSet({ side: { choice: 'unspecified', confidence: .9 } }) }), { status: 200 }),
  })).rejects.toThrow('single hand and face target');
});

test('keeps the moving hand side separate from the cheek side', async () => {
  const result = await createJevMotionPlan({
    prompt: 'The actor touches her own left cheek with her right hand.', duration: 4, apiKey: 'test-key',
    fetchImpl: async () => new Response(JSON.stringify({ answers: answerSet({
      side: { choice: 'right', confidence: .95 },
      target_side: { choice: 'left', confidence: .97 },
    }) }), { status: 200 }),
  });
  expect(result.plan.contacts[0]).toMatchObject({ side: 'right', targetSide: 'left' });
});
