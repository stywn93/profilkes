import type { ComponentProps } from "react";

type IconProps = ComponentProps<"svg">;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export function IconOverview(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

export function IconMother(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="6" r="2.5" />
      <path d="M9 8.5c-2.2 0-4 1.8-4 4V20h8v-7.5" />
      <path d="M17 14c1.4-1.2 2.5-2.4 2.5-3.8A2.2 2.2 0 0 0 17 8a2.2 2.2 0 0 0-2.5 2.2c0 1.4 1.1 2.6 2.5 3.8Z" />
    </svg>
  );
}

export function IconBaby(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="7" r="3" />
      <path d="M8.5 21v-3.5A3.5 3.5 0 0 1 12 14a3.5 3.5 0 0 1 3.5 3.5V21" />
      <path d="M10 7h.01M14 7h.01" />
    </svg>
  );
}

export function IconCause(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6h9M4 12h16M4 18h6" />
      <circle cx="17" cy="6" r="2" />
      <circle cx="13" cy="18" r="2" />
    </svg>
  );
}

export function IconData(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}
