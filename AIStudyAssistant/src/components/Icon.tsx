// Simple line icons drawn for this project (24×24, stroke = currentColor).
const PATHS = {
  logo: "M12 3 3 7.5l9 4.5 9-4.5L12 3Zm-6 6.6V15c0 1.7 2.7 3.5 6 3.5s6-1.8 6-3.5V9.6M21 7.5V13",
  home: "M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z",
  ask: "M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm4.5 4a2.5 2.5 0 1 1 3.4 2.3c-.5.2-.9.6-.9 1.2M12 14h.01",
  solve: "M5 4h14v16H5zM8 8h8M8 12h2m2 0h0m2 0h2M8 16h2m2 0h0m2 0h2",
  code: "m8 8-4 4 4 4m8-8 4 4-4 4M14 5l-4 14",
  file: "M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 0v5h5M9 13h6m-6 4h6",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 9.5h.01",
  history: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4m4-1v5l3 2",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.5 2.6 3.5 5.6 3.5 9s-1 6.4-3.5 9c-2.5-2.6-3.5-5.6-3.5-9s1-6.4 3.5-9Z",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  copy: "M9 9h10v11H9zM5 15V4h10",
  save: "M6 4h12v16l-6-4-6 4V4Z",
  download: "M12 4v11m-5-5 5 5 5-5M5 20h14",
  refresh: "M20 11a8 8 0 0 0-14.3-4.9L4 8m0-4v4h4m-4 5a8 8 0 0 0 14.3 4.9L20 16m0 4v-4h-4",
  send: "M4 12 20 4l-6 16-3-7-7-1Z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4",
  trash: "M5 7h14M10 7V4h4v3m-7 0 1 13h8l1-13",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  check: "m5 12 5 5 9-10",
  alert: "M12 4 2.5 20h19L12 4Zm0 6v4m0 3h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-11v6m0-9h.01",
  upload: "M12 16V5m-5 5 5-5 5 5M5 20h14",
  spark: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6",
  arrow: "M5 12h14m-5-5 5 5-5 5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
