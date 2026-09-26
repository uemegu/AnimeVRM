/** 線画のアイコン（24px グリッド）。絵文字は使わない */
const PATHS = {
  viewer: 'M12 5c-6 0-9.5 7-9.5 7s3.5 7 9.5 7 9.5-7 9.5-7-3.5-7-9.5-7Zm0 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z',
  scenes: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6',
  scenarios: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7',
  player: 'M7 4.5v15l12.5-7.5z',
  characters: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8a7.5 7.5 0 0 1 15 0',
  motions: 'M13 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM9.5 21l2-7 2.5 2.5V21M6 12l4-4 3.5 1.5L16 13l3 1',
  tools: 'M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.4-.6-.6-2.4Z',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  play: 'M8 5.5v13l10.5-6.5z',
  stop: 'M7 7h10v10H7z',
  chevron: 'M9 6l6 6-6 6',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const filled = name === 'play' || name === 'stop' || name === 'player';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
