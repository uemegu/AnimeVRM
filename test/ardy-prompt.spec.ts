import { expect, test } from '@playwright/test';
import { addActingDirection } from '../src/ai/motion/ardy/prompt';

test('adds an acting note to the ardy-mini prompt without changing an empty-note prompt', () => {
  expect(addActingDirection('A person waves.', ' feminine, gentle '))
    .toBe('A person waves.\nActing direction: feminine, gentle');
  expect(addActingDirection('A person waves.', '  ')).toBe('A person waves.');
});
