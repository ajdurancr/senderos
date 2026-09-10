const paths: Record<string, React.ReactNode> = {
  inbox: <><path d="M4 5.5h16v13H4z"/><path d="M4 14h4l2 2h4l2-2h4"/></>,
  nodes: <><rect x="3.5" y="4" width="6" height="5" rx="1"/><rect x="14.5" y="15" width="6" height="5" rx="1"/><path d="M9.5 6.5h4a3 3 0 0 1 3 3V15"/></>,
  target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></>,
  activity: <path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>,
  check: <><path d="M5 4.5h14v15H5z"/><path d="m8 12 2.5 2.5L16.5 8"/></>,
  spark: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="m18 16 .7 2.3L21 19l-2.3.7L18 22l-.7-2.3L15 19l2.3-.7z"/></>,
  clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15 6l-.3-2.5h-4L10.4 6A8 8 0 0 0 8.8 7L6.5 6.1l-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 1.6 1l.3 2.6h4l.3-2.6a8 8 0 0 0 1.6-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"/></>,
  branch: <><circle cx="7" cy="6" r="2"/><circle cx="17" cy="18" r="2"/><path d="M7 8v5a5 5 0 0 0 5 5h3M17 16V9a3 3 0 0 0-3-3H9"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  search: <><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/></>,
  x: <path d="m6 6 12 12M18 6 6 18"/>,
  arrow: <path d="m9 6 6 6-6 6"/>,
  pulse: <><path d="M4 18V9M9 18V5M14 18v-7M19 18V3"/></>,
  database: <><ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6M4.5 11.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/></>,
};

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <svg className={`ui-icon ${className}`} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export function SenderosMark() {
  return <span className="senderos-mark"><svg viewBox="0 0 44 44"><path d="M7 33.5 18.7 8.7c1.2-2.5 4.7-2.5 5.9 0L37 34.8"/><path d="m12.7 22.2 8.9 7.1 9.6-8.6"/><circle cx="21.7" cy="29.2" r="2.7"/></svg></span>;
}
