"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/browser";
import { BrandMark } from "@/components/BrandMark";
import {
  getStaffStrings,
  readStaffLocale,
  storeStaffLocale,
  STAFF_LOCALES,
} from "@/lib/i18n/staff";

/**
 * The one staff chrome: dark sidebar, navigation, user card, day/night
 * toggle, sign out. The floor, Insights and Settings all render inside
 * it, so navigation and theming are identical everywhere — a page can
 * no longer invent its own chrome and drift.
 *
 * The theme is remembered per device under the same key the floor has
 * always used, so an existing night-mode choice carries over.
 */

const THEME_KEY = "mtv-floor-theme";

export type StaffShellSection = "overview" | "layout" | "insights" | "settings";

type Props = {
  active: StaffShellSection;
  displayName: string;
  role: string;
  /** The venue this device is working as. */
  venueId?: string;
  /** All venues on this account; two or more shows the switcher. */
  venues?: { venueId: string; venueName: string }[];
  /** Extra element next to the brand — the floor puts its Live badge here. */
  badge?: ReactNode;
  children: ReactNode;
};

const NAV: {
  key: StaffShellSection;
  href: string;
  managerOnly: boolean;
  icon: () => ReactNode;
}[] = [
  { key: "overview", href: "/staff/floor", managerOnly: false, icon: OverviewIcon },
  { key: "layout", href: "/staff/layout", managerOnly: true, icon: LayoutIcon },
  { key: "insights", href: "/staff/insights", managerOnly: true, icon: ChartIcon },
  { key: "settings", href: "/staff/settings", managerOnly: true, icon: GearIcon },
];

export function StaffShell({
  active,
  displayName,
  role,
  venueId,
  venues,
  badge,
  children,
}: Props) {
  const [theme, setTheme] = useState<"day" | "night">("day");

  // SSR renders English; the cookie (or browser language) takes over
  // after hydration — same pattern as the theme.
  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getStaffStrings(locale);
  const changeLocale = useCallback((next: string) => {
    storeStaffLocale(next);
    // Full reload so server-rendered pages re-resolve too.
    window.location.reload();
  }, []);

  // Restore the per-device theme after hydration; SSR always says day.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(THEME_KEY) === "night") {
        setTheme("night");
      }
    } catch {
      // Private browsing: live with the default.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "day" ? "night" : "day";
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        // Best effort only.
      }
      return next;
    });
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/staff/sign-in";
  }, []);

  // Switching venue is a full context change: set the device cookie,
  // then reload onto the floor so every page, subscription and cached
  // payload rebuilds for the new venue. No half-switched states.
  const switchVenue = useCallback(async (nextVenueId: string) => {
    try {
      const response = await fetch("/api/staff/venue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: nextVenueId }),
      });
      if (response.ok) {
        window.location.href = "/staff/floor";
      }
    } catch {
      // Connection trouble: stay on the current venue.
    }
  }, []);

  const isManager = role === "owner" || role === "manager";

  const initials = displayName
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mtv-floor" data-theme={theme}>
      <aside className="mtv-sidebar">
        <div className="mtv-sidebar-head">
          <BrandMark className="mtv-sidebar-brand" />
          {badge}
        </div>

        {venues && venues.length > 1 ? (
          <label className="mtv-venue-switch">
            <span>{t.shell.venue}</span>
            <select
              value={venueId}
              onChange={(event) => void switchVenue(event.target.value)}
            >
              {venues.map((venue) => (
                <option key={venue.venueId} value={venue.venueId}>
                  {venue.venueName}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {role === "owner" ? (
          <Link
            href="/staff/add-venue"
            prefetch={false}
            className="mtv-add-venue"
          >
            {t.shell.addRestaurant}
          </Link>
        ) : null}

        <nav className="mtv-sidebar-nav" aria-label={t.shell.staffNav}>
          {NAV.filter((item) => isManager || !item.managerOnly).map((item) =>
            item.key === active ? (
              <span key={item.key} className="mtv-nav-item" data-active="true">
                {item.icon()}
                {t.shell[item.key]}
              </span>
            ) : (
              <Link
                key={item.key}
                href={item.href}
                prefetch={false}
                className="mtv-nav-item"
              >
                {item.icon()}
                {t.shell[item.key]}
              </Link>
            )
          )}
        </nav>

        <div className="mtv-sidebar-foot">
          <div className="mtv-user-card">
            <span className="mtv-user-avatar" aria-hidden="true">
              {initials}
            </span>
            <span>
              <span className="mtv-user-name">{displayName}</span>
              <span className="mtv-user-role">
                {role === "owner"
                  ? t.shell.roleOwner
                  : role === "manager"
                    ? t.shell.roleManager
                    : t.shell.roleWaiter}
              </span>
            </span>
          </div>
          <button
            type="button"
            className="mtv-theme-toggle"
            onClick={toggleTheme}
            aria-pressed={theme === "night"}
          >
            {theme === "night" ? <SunIcon /> : <MoonIcon />}
            {theme === "night" ? t.shell.dayMode : t.shell.nightMode}
          </button>
          <label className="mtv-lang-pick">
            <span className="sr-only">{t.shell.language}</span>
            <select
              value={locale}
              onChange={(event) => changeLocale(event.target.value)}
              aria-label={t.shell.language}
            >
              {STAFF_LOCALES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="mtv-signout"
            onClick={() => void signOut()}
          >
            <LogoutIcon />
            {t.shell.logOut}
          </button>
        </div>
      </aside>

      <div className="mtv-main">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------- icons */

function OverviewIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mtv-nav-icon" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1.2" />
      <rect x="11" y="3" width="6" height="6" rx="1.2" />
      <rect x="3" y="11" width="6" height="6" rx="1.2" />
      <rect x="11" y="11" width="6" height="6" rx="1.2" />
    </svg>
  );
}

function LayoutIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mtv-nav-icon" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="1.6" />
      <path d="M3 8h14M8 8v9" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mtv-nav-icon" aria-hidden="true">
      <path d="M3 17h14M5 17v-5M10 17V7M15 17v-8" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mtv-nav-icon" aria-hidden="true">
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 3v2.2M10 14.8V17M3 10h2.2M14.8 10H17M5.05 5.05l1.56 1.56M13.4 13.4l1.55 1.55M14.95 5.05l-1.56 1.56M6.6 13.4l-1.55 1.55" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mtv-nav-icon" aria-hidden="true">
      <path d="M12 3H5v14h7M9 10h8M14 7l3 3-3 3" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mtv-nav-icon" aria-hidden="true">
      <path d="M16 12.2A6.8 6.8 0 0 1 7.8 4a6.8 6.8 0 1 0 8.2 8.2Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mtv-nav-icon" aria-hidden="true">
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 2.2v2M10 15.8v2M2.2 10h2M15.8 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M15.5 4.5l-1.4 1.4M5.9 14.1l-1.4 1.4" />
    </svg>
  );
}
