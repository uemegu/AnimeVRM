/** 線画のアイコン（24px グリッド）。絵文字は使わない */
const PATHS = {
  viewer: 'M12 5c-6 0-9.5 7-9.5 7s3.5 7 9.5 7 9.5-7 9.5-7-3.5-7-9.5-7Zm0 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z',
  scenes: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6',
  scenarios: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7',
  player: 'M7 4.5v15l12.5-7.5z',
  characters: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8a7.5 7.5 0 0 1 15 0',
  motions: 'M13 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM9.5 21l2-7 2.5 2.5V21M6 12l4-4 3.5 1.5L16 13l3 1',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  play: 'M8 5.5v13l10.5-6.5z',
  stop: 'M7 7h10v10H7z',
  chevron: 'M9 6l6 6-6 6',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  back: 'M15 6l-6 6 6 6',
  soundOn: 'M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  soundOff: 'M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3ZM5 11a7 7 0 0 0 14 0M12 18v3',
  chart: 'M6 6.5a2 2 0 1 0 0 .01ZM18 6.5a2 2 0 1 0 0 .01ZM12 18a2 2 0 1 0 0 .01ZM7.6 8l3.5 8M16.4 8l-3.5 8M8 6.5h8',
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
