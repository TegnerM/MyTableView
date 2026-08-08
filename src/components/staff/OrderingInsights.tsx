import { getOrderingStrings } from "@/lib/i18n/ordering";
import { pickLocale, type LocaleMap } from "@/lib/i18n/guest";

/**
 * The service clock — Ordering's section on Insights.
 *
 * Presentational; the page computes the numbers. The one insight this
 * screen must land: WHERE the minutes go. Preparation and pickup are
 * separated everywhere, because "kitchen is slow" and "food waits on
 * the pass" have opposite fixes.
 */

export type OrderingHourPoint = {
  label: string;
  count: number;
  avgPrepSeconds: number | null;
  avgPickupSeconds: number | null;
};

export type OrderingInsightsData = {
  orders: number;
  avgKitchenSeconds: number | null;
  avgBarSeconds: number | null;
  avgPickupSeconds: number | null;
  hours: OrderingHourPoint[];
  /** Orders per guest across the window (the bar's "rounds"). */
  roundsPerGuest: number | null;
  /** Areas ranked by order count, top 3. */
  busiestAreas: { name: LocaleMap; count: number }[];
};

const PICKUP_WARN_SECONDS = 4 * 60;

function minutes(seconds: number | null): string {
  if (seconds === null) {
    return "—";
  }
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function OrderingInsights({
  data,
  locale = "en",
}: {
  data: OrderingInsightsData;
  locale?: string;
}) {
  const t = getOrderingStrings(locale);

  const maxHourSeconds = Math.max(
    1,
    ...data.hours.map(
      (hour) => (hour.avgPrepSeconds ?? 0) + (hour.avgPickupSeconds ?? 0)
    )
  );

  const pickupWarn =
    data.avgPickupSeconds !== null && data.avgPickupSeconds >= PICKUP_WARN_SECONDS;

  return (
    <section className="mtv-insights mtv-ordins">
      <header className="mtv-insights-header">
        <div>
          <h2 className="mtv-ordins-title">{t.insights.title}</h2>
          <p>{t.insights.sub}</p>
        </div>
      </header>

      {data.orders === 0 ? (
        <p className="mtv-insights-empty">{t.insights.noData}</p>
      ) : (
        <>
          <div className="mtv-ordins-kpis">
            <div className="mtv-ordins-kpi">
              <span className="mtv-ordins-value">{data.orders}</span>
              <span className="mtv-ordins-label">{t.insights.orders}</span>
            </div>
            <div className="mtv-ordins-kpi">
              <span className="mtv-ordins-value">
                {minutes(data.avgKitchenSeconds)}
                <small> {t.insights.minutes}</small>
              </span>
              <span className="mtv-ordins-label">{t.insights.kitchenAvg}</span>
            </div>
            <div className="mtv-ordins-kpi">
              <span className="mtv-ordins-value">
                {minutes(data.avgBarSeconds)}
                <small> {t.insights.minutes}</small>
              </span>
              <span className="mtv-ordins-label">{t.insights.barAvg}</span>
            </div>
            <div className="mtv-ordins-kpi" data-warn={pickupWarn ? "true" : "false"}>
              <span className="mtv-ordins-value">
                {minutes(data.avgPickupSeconds)}
                <small> {t.insights.minutes}</small>
              </span>
              <span className="mtv-ordins-label">
                {t.insights.pickupAvg}
                {pickupWarn ? ` — ${t.insights.pickupWarn}` : ""}
              </span>
            </div>
            {data.roundsPerGuest !== null ? (
              <div className="mtv-ordins-kpi">
                <span className="mtv-ordins-value">
                  {data.roundsPerGuest.toFixed(1)}
                </span>
                <span className="mtv-ordins-label">{t.insights.roundsPerGuest}</span>
              </div>
            ) : null}
          </div>

          {data.busiestAreas.length > 0 ? (
            <>
              <h3 className="mtv-ordins-byhour">{t.insights.busiestAreas}</h3>
              <div className="mtv-ordins-areas">
                {data.busiestAreas.map((area, index) => (
                  <div key={index} className="mtv-ordins-area">
                    <span className="mtv-ordins-area-rank">{index + 1}</span>
                    <span className="mtv-ordins-area-name">
                      {pickLocale(area.name, locale) || "—"}
                    </span>
                    <span className="mtv-ordins-area-count">
                      {area.count} <i>{t.insights.orders.toLowerCase()}</i>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <h3 className="mtv-ordins-byhour">{t.insights.byHour}</h3>
          <div className="mtv-ordins-bars">
            {data.hours.map((hour, index) => {
              const prep = hour.avgPrepSeconds ?? 0;
              const pickup = hour.avgPickupSeconds ?? 0;
              return (
                <div key={`${index}-${hour.label}`} className="mtv-ordins-bar">
                  <span className="mtv-ordins-bar-label">{hour.label}</span>
                  <span className="mtv-ordins-bar-track">
                    <span
                      className="mtv-ordins-bar-prep"
                      style={{ width: `${(prep / maxHourSeconds) * 100}%` }}
                    />
                    <span
                      className="mtv-ordins-bar-pickup"
                      style={{ width: `${(pickup / maxHourSeconds) * 100}%` }}
                    />
                  </span>
                  <span className="mtv-ordins-bar-value">
                    {minutes(prep + pickup || null)}
                    <i> · {hour.count}</i>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mtv-ordins-legend">
            <span data-series="prep">{t.insights.prep}</span>
            <span data-series="pickup">{t.insights.pickup}</span>
          </div>
        </>
      )}
      {/* Locale note: numbers format the same in all 8 languages. */}
      <span className="sr-only">{locale}</span>
    </section>
  );
}
