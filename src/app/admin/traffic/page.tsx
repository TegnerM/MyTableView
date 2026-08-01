import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { AdminShell } from "@/components/admin/AdminShell";
import "../admin.css";

/**
 * Traffic & conversion. Data: our own visits table (deduped per
 * visitor/day/source) + accounts acquisition columns. Charts are two
 * single-series small multiples (visits, signups) — same scale rules,
 * one axis each, series color #0fa090 validated against the card
 * surface (chroma, lightness, contrast all pass).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const DAYS = 30;
const BAR_COLOR = "#0fa090";

type VisitRow = {
  visit_date: string;
  source_kind: string;
  source_key: string;
  referrer: string | null;
};

type AccountRow = {
  created_at: string;
  billing_status: string;
  acquired_source_kind: string | null;
  acquired_source_key: string | null;
};

export default async function AdminTrafficPage() {
  const gate = await requireAdmin();

  if (!gate.ok) {
    if (gate.reason === "no_session") redirect("/admin/sign-in");
    if (gate.reason === "mfa_enroll" || gate.reason === "mfa_required")
      redirect("/admin/mfa");
    notFound();
  }

  const service = getServiceClient();
  const since = new Date(Date.now() - DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [visitsResult, accountsResult] = await Promise.all([
    service
      .from("visits")
      .select("visit_date, source_kind, source_key, referrer")
      .gte("visit_date", since)
      .limit(20000)
      .returns<VisitRow[]>(),
    service
      .from("accounts")
      .select(
        "created_at, billing_status, acquired_source_kind, acquired_source_key"
      )
      .returns<AccountRow[]>(),
  ]);

  const visits = visitsResult.data ?? [];
  const accounts = accountsResult.data ?? [];

  // Day series, oldest → newest.
  const days: string[] = [];
  for (let i = DAYS - 1; i >= 0; i -= 1) {
    days.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  }

  const visitsByDay = new Map<string, number>(days.map((d) => [d, 0]));
  for (const visit of visits) {
    if (visitsByDay.has(visit.visit_date)) {
      visitsByDay.set(visit.visit_date, (visitsByDay.get(visit.visit_date) ?? 0) + 1);
    }
  }

  const signupsByDay = new Map<string, number>(days.map((d) => [d, 0]));
  const sinceMs = Date.now() - DAYS * 86_400_000;
  let signups30 = 0;
  for (const account of accounts) {
    const day = account.created_at.slice(0, 10);
    if (signupsByDay.has(day)) {
      signupsByDay.set(day, (signupsByDay.get(day) ?? 0) + 1);
      if (Date.parse(account.created_at) >= sinceMs) signups30 += 1;
    }
  }

  const visits7 = days
    .slice(-7)
    .reduce((sum, d) => sum + (visitsByDay.get(d) ?? 0), 0);
  const visits30 = visits.length;

  // Source breakdown: visits + signups + conversion per source.
  const sourceVisits = new Map<string, number>();
  for (const visit of visits) {
    const label =
      visit.source_kind === "organic"
        ? "organic"
        : `${visit.source_kind}:${visit.source_key}`;
    sourceVisits.set(label, (sourceVisits.get(label) ?? 0) + 1);
  }

  const sourceSignups = new Map<string, number>();
  for (const account of accounts) {
    const label = account.acquired_source_kind
      ? `${account.acquired_source_kind}:${account.acquired_source_key ?? ""}`
      : "organic";
    sourceSignups.set(label, (sourceSignups.get(label) ?? 0) + 1);
  }

  const sourceRows = Array.from(
    new Set([...sourceVisits.keys(), ...sourceSignups.keys()])
  )
    .map((label) => ({
      label,
      visits: sourceVisits.get(label) ?? 0,
      signups: sourceSignups.get(label) ?? 0,
    }))
    .sort((a, b) => b.visits - a.visits || b.signups - a.signups);

  // Top external referrers.
  const referrers = new Map<string, number>();
  for (const visit of visits) {
    if (!visit.referrer) continue;
    try {
      const host = new URL(visit.referrer).hostname.replace(/^www\./, "");
      if (host && !host.includes("mytableview")) {
        referrers.set(host, (referrers.get(host) ?? 0) + 1);
      }
    } catch {
      // unparseable referrer — skip
    }
  }
  const topReferrers = Array.from(referrers.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const conversion =
    visits30 > 0 ? `${((signups30 / visits30) * 100).toFixed(1)}%` : "—";

  const kpis = [
    { label: "Visits · 7d", value: String(visits7) },
    { label: "Visits · 30d", value: String(visits30) },
    { label: "Signups · 30d", value: String(signups30) },
    { label: "Visit → signup", value: conversion },
  ];

  return (
    <AdminShell active="traffic" email={gate.email}>
      <header className="mtv-admin-head">
        <h1>Traffic</h1>
        <p>
          Deduped per visitor per day. Sources: campaign posts (rmc),
          influencers (ref), invites, UTM tags, organic.
        </p>
      </header>

      <div className="mtv-kpis">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="mtv-kpi">
            <p className="mtv-kpi-label">{kpi.label}</p>
            <p className="mtv-kpi-value">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="mtv-traffic-charts">
        <div className="mtv-admin-card">
          <h2 className="mtv-admin-card-title">Visits per day — last 30 days</h2>
          <DayBars days={days} values={visitsByDay} />
        </div>
        <div className="mtv-admin-card">
          <h2 className="mtv-admin-card-title">Signups per day — last 30 days</h2>
          <DayBars days={days} values={signupsByDay} />
        </div>
      </div>

      <div className="mtv-traffic-tables">
        <div className="mtv-admin-card">
          <h2 className="mtv-admin-card-title">Sources — last 30 days</h2>
          <table className="mtv-admin-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Visits</th>
                <th>Signups</th>
                <th>Conversion</th>
              </tr>
            </thead>
            <tbody>
              {sourceRows.length === 0 ? (
                <tr>
                  <td colSpan={4}>No visits recorded yet.</td>
                </tr>
              ) : (
                sourceRows.map((row) => (
                  <tr key={row.label}>
                    <td className="mtv-cell-title">{row.label}</td>
                    <td>{row.visits}</td>
                    <td>{row.signups}</td>
                    <td>
                      {row.visits > 0
                        ? `${((row.signups / row.visits) * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mtv-admin-card">
          <h2 className="mtv-admin-card-title">Top referrers — last 30 days</h2>
          <table className="mtv-admin-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Visits</th>
              </tr>
            </thead>
            <tbody>
              {topReferrers.length === 0 ? (
                <tr>
                  <td colSpan={2}>No external referrers yet.</td>
                </tr>
              ) : (
                topReferrers.map(([host, count]) => (
                  <tr key={host}>
                    <td className="mtv-cell-title">{host}</td>
                    <td>{count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

/**
 * Single-series daily bar chart, server-rendered SVG. Thin bars with
 * rounded data-ends and 2px gaps; recessive gridlines; native tooltip
 * per bar; the max day carries the one direct label. The table beside
 * it is the accessible view of the same data.
 */
function DayBars({
  days,
  values,
}: {
  days: string[];
  values: Map<string, number>;
}) {
  const width = 560;
  const height = 150;
  const padTop = 18;
  const padBottom = 20;
  const plotH = height - padTop - padBottom;
  const gap = 2;
  const barW = (width - gap * (days.length - 1)) / days.length;

  const max = Math.max(1, ...days.map((d) => values.get(d) ?? 0));
  const maxDay = days.reduce(
    (best, d) => ((values.get(d) ?? 0) > (values.get(best) ?? 0) ? d : best),
    days[0]
  );

  const gridYs = [0.5, 1].map((f) => padTop + plotH - plotH * f);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Daily counts, last 30 days"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {gridYs.map((y, index) => (
        <line
          key={index}
          x1={0}
          x2={width}
          y1={y}
          y2={y}
          stroke="#e0dace"
          strokeWidth={1}
        />
      ))}

      {days.map((day, index) => {
        const value = values.get(day) ?? 0;
        const h = value === 0 ? 0 : Math.max(3, (value / max) * plotH);
        const x = index * (barW + gap);
        const y = padTop + plotH - h;
        return (
          <g key={day}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 0.001)}
              rx={value === 0 ? 0 : 2}
              fill={value === 0 ? "#efece5" : "#0fa090"}
            >
              <title>{`${day}: ${value}`}</title>
            </rect>
            {value === 0 ? (
              <rect
                x={x}
                y={padTop + plotH - 1}
                width={barW}
                height={1}
                fill="#e0dace"
              />
            ) : null}
            {day === maxDay && value > 0 ? (
              <text
                x={x + barW / 2}
                y={y - 5}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill="#16293d"
              >
                {value}
              </text>
            ) : null}
          </g>
        );
      })}

      <line
        x1={0}
        x2={width}
        y1={padTop + plotH}
        y2={padTop + plotH}
        stroke="#d4cdbf"
        strokeWidth={1}
      />
      <text x={0} y={height - 6} fontSize={9} fill="#5c6b7a">
        {days[0]}
      </text>
      <text
        x={width}
        y={height - 6}
        fontSize={9}
        fill="#5c6b7a"
        textAnchor="end"
      >
        {days[days.length - 1]}
      </text>
    </svg>
  );
}
