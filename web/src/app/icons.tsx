// Icons ported verbatim (same paths, stroke-width 2.75) from the design mock
// (front-end/Intercom Dashboard.dc.html) — kept as one shared file since the
// same handful of glyphs repeat across every screen.
interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

function Svg({ size = 15, color = "currentColor", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function LogoMark({ size = 24, color = "white" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.75" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </Svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </Svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <rect x="4" y="4" width="11" height="11" rx="2" />
    </Svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 12h14" />
      <path d="M13 6l6 6-6 6" />
    </Svg>
  );
}

export function ReplyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a4 4 0 014 4v2" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12l5 5L20 6" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 5l14 14" />
      <path d="M19 5L5 19" />
    </Svg>
  );
}
