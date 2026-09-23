/** Keep acting direction visible to ardy-mini while Jev supplies structured quality hints. */
export function addActingDirection(prompt: string, actingNote?: string): string {
  const note = actingNote?.trim();
  return note ? `${prompt.trim()}\nActing direction: ${note}` : prompt;
}
