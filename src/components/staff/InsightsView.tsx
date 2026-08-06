import { getStaffStrings } from "@/lib/i18n/staff";

/**
 * Guest satisfaction results — the first Insights module. Reads like a
 * scoreboard, not a spreadsheet: two averages an owner can quote, and
 * a weekly trend that shows drift before it becomes a review.
 *
 * Presentational only; the page assembles the numbers (and resolves the
 * staff locale) so this can be previewed and screenshotted with mock
 * data.
 */

const FACES = ["😖", "🙁", "😐", "🙂", "😍"];

export type WeeklyPoint = {
  label: string;
  food: number | null;
  service: number | null;
  count: number;
};

export type InsightsData = {
  venueName: string;
  responses: number;
  avgFood: number | null;
  avgService: number | null;
  weeks: WeeklyPoint[];
};

export function InsightsView({
  data,
  locale = "en",
}: {
  data: InsightsData;
  locale?: string;
}) {
  const t = getStaffStrings(locale);

  return (
    <main className="mtv-insights">
      <header className="mtv-insights-header">
        <div>
          <h1>{t.shell.insights}</h1>
          <p>{data.venueName}</p>
        </div>
      </header>

      <section className="mtv-insights-cards">
        <ScoreCard title={t.insights.food} value={data.avgFood} />
        <ScoreCard title={t.insights.service} value={data.avgService} />
        <div className="mtv-score-card" data-kind="count">
          <span className="mtv-score-value">{data.responses}</span>
          <span className="mtv-score-title">
            {data.responses === 1
              ? t.insights.responseSingular
              : t.insights.responsePlural}{" "}
            · {t.insights.last90Days}
          </span>
        </div>
      </section>

      <section className="mtv-insights-trend">
        <h2>{t.insights.recentWeeks}</h2>
        {data.weeks.every((week) => week.count === 0) ? (
          <p className="mtv-insights-empty">{t.insights.noRatings}</p>
        ) : (
          <div className="mtv-trend-grid">
            {data.weeks.map((week) => (
              <div key={week.label} className="mtv-trend-col">
                <div className="mtv-trend-bars">
                  <span
                    className="mtv-trend-bar"
                    data-series="food"
                    style={{ height: `${((week.food ?? 0) / 5) * 100}%` }}
                    title={
                      week.food !== null
                        ? t.insights.foodScore.replace(
                            "{score}",
                            String(week.food)
                          )
                        : undefined
                    }
                  />
                  <span
                    className="mtv-trend-bar"
                    data-series="service"
                    style={{ height: `${((week.service ?? 0) / 5) * 100}%` }}
                    title={
                      week.service !== null
                        ? t.insights.serviceScore.replace(
                            "{score}",
                            String(week.service)
                          )
                        : undefined
                    }
                  />
                </div>
                <span className="mtv-trend-label">{week.label}</span>
                <span className="mtv-trend-count">
                  {week.count > 0 ? week.count : "–"}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mtv-trend-legend">
          <span data-series="food">{t.insights.food}</span>
          <span data-series="service">{t.insights.service}</span>
        </div>
      </section>
    </main>
  );
}

function ScoreCard({ title, value }: { title: string; value: number | null }) {
  const face =
    value === null ? "–" : FACES[Math.min(4, Math.max(0, Math.round(value) - 1))];

  return (
    <div className="mtv-score-card">
      <span className="mtv-score-face" aria-hidden="true">
        {face}
      </span>
      <span className="mtv-score-value">
        {value === null ? "—" : value.toFixed(1)}
        {value !== null ? <small> / 5</small> : null}
      </span>
      <span className="mtv-score-title">{title}</span>
    </div>
  );
}
