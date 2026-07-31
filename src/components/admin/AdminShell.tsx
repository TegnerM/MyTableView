"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { getBrowserClient } from "@/lib/supabase/browser";

/**
 * Admin chrome: dark brand sidebar, warm content column. Rendered only
 * AFTER the server page has passed requireAdmin() — this component
 * contains no secrets and no authority of its own.
 */

const NAV: { key: string; label: string; href: string }[] = [
  { key: "dashboard", label: "Dashboard", href: "/admin" },
  { key: "restaurants", label: "Restaurants", href: "/admin/restaurants" },
  // Phase 2+: traffic, campaigns, groups, post-now, history,
  // influencers, invites — added as they ship.
];

type Props = {
  active: string;
  email: string | null;
  children: ReactNode;
};

export function AdminShell({ active, email, children }: Props) {
  const signOut = async () => {
    const supabase = getBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/admin/sign-in";
  };

  return (
    <div className="mtv-admin">
      <aside className="mtv-admin-sidebar">
        <div className="mtv-admin-brand">
          <BrandMark className="mtv-brand" />
          <span className="mtv-admin-chip">Admin</span>
        </div>

        <nav className="mtv-admin-nav" aria-label="Admin">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              prefetch={false}
              data-active={item.key === active}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mtv-admin-foot">
          <span>{email ?? ""}</span>
          <button
            type="button"
            className="mtv-admin-signout"
            onClick={() => void signOut()}
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="mtv-admin-main">{children}</main>
    </div>
  );
}
