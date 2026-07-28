import type { ReactElement } from "react";

/**
 * Icons for guest request buttons.
 *
 * Inline SVG rather than an icon package: the guest screen is the most
 * performance-sensitive surface in the product — a stranger's phone on
 * venue wifi — and five inline paths cost less than a library import.
 *
 * `icon` on request_types maps to a key here. Unknown keys fall back to
 * the bell, so a venue adding a custom request type always gets
 * something sensible.
 */

export type IconKey =
  | "wine"
  | "cake"
  | "coffee"
  | "receipt"
  | "bell"
  | "menu";

type IconProps = {
  className?: string;
};

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Wine({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...strokeProps} d="M7 3h10l-1.2 6.2a4.9 4.9 0 0 1-7.6 0Z" />
      <path {...strokeProps} d="M12 13.5V21" />
      <path {...strokeProps} d="M8.5 21h7" />
    </svg>
  );
}

function Cake({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...strokeProps} d="M4 19.5h16" />
      <path {...strokeProps} d="M5.5 19.5v-6.8L18.5 8v11.5" />
      <path {...strokeProps} d="M5.5 15.9h13" />
      <circle {...strokeProps} cx="19.3" cy="5.4" r="1.1" />
    </svg>
  );
}

function Coffee({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...strokeProps} d="M4 9h12v5.5A4.5 4.5 0 0 1 11.5 19h-3A4.5 4.5 0 0 1 4 14.5Z" />
      <path {...strokeProps} d="M16 10.5h1.8a2.2 2.2 0 0 1 0 4.4H16" />
      <path {...strokeProps} d="M7 3v2.5" />
      <path {...strokeProps} d="M11 3v2.5" />
    </svg>
  );
}

function Receipt({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        {...strokeProps}
        d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21Z"
      />
      <path {...strokeProps} d="M14 8.2a3.1 3.1 0 1 0 0 6.2" />
      <path {...strokeProps} d="M9.6 10.2h3.4" />
      <path {...strokeProps} d="M9.6 12.4h3.4" />
    </svg>
  );
}

function Bell({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...strokeProps} d="M4 17h16" />
      <path {...strokeProps} d="M5.5 17a6.5 6.5 0 0 1 13 0" />
      <path {...strokeProps} d="M12 7.2V5.5" />
      <circle {...strokeProps} cx="12" cy="4.4" r="1.1" />
    </svg>
  );
}

function Menu({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...strokeProps} d="M5 4h9a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2Z" />
      <path {...strokeProps} d="M16 6h3v12a2 2 0 0 1-2 2h-1" />
      <path {...strokeProps} d="M8.5 9h5" />
      <path {...strokeProps} d="M8.5 13h5" />
    </svg>
  );
}

const ICONS: Record<IconKey, (props: IconProps) => ReactElement> = {
  wine: Wine,
  cake: Cake,
  coffee: Coffee,
  receipt: Receipt,
  bell: Bell,
  menu: Menu,
};

/**
 * Venues name their request types freely, so icon/code values arrive
 * in many spellings. Aliases route the common ones to the right
 * drawing; only genuinely unknown types fall back to the cloche.
 */
const ALIASES: Record<string, IconKey> = {
  wine: "wine",
  drinks: "wine",
  drink: "wine",
  cocktail: "wine",
  bar: "wine",
  cake: "cake",
  dessert: "cake",
  desserts: "cake",
  coffee: "coffee",
  espresso: "coffee",
  tea: "coffee",
  receipt: "receipt",
  bill: "receipt",
  pay: "receipt",
  payment: "receipt",
  check: "receipt",
  bell: "bell",
  assist: "bell",
  assistance: "bell",
  help: "bell",
  service: "bell",
  waiter: "bell",
  menu: "menu",
  order: "menu",
  food: "menu",
};

export function RequestIcon({
  name,
  className,
}: {
  name: string | null;
  className?: string;
}) {
  const key = name ? ALIASES[name.trim().toLowerCase()] : undefined;
  const Component = (key && ICONS[key]) || ICONS.bell;
  return <Component className={className} />;
}
