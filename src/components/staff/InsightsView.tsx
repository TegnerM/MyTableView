/**
 * Guest satisfaction results — the first Insights module. Reads like a
 * scoreboard, not a spreadsheet: two averages an owner can quote, and
 * a weekly trend that shows drift before it becomes a review.
 *
 * Presentational only; the page assembles the numbers so this can be
 * previewed and screenshotted with mock data.
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

export function InsightsView({ data }: { data: InsightsData }) {
  return (
    <main className="mtv-insights">
      <header className="mtv-insights-header">
        <div>
          <h1>Insights</h1>
          <p>{data.venueName}</p>
        </div>
      </header>

      <section className="mtv-insights-cards">
        <ScoreCard title="Food" value={data.avgFood} />
        <ScoreCard title="Service" value={data.avgService} />
        <div className="mtv-score-card" data-kind="count">
          <span className="mtv-score-value">{data.responses}</span>
          <span className="mtv-score-title">
            {data.responses === 1 ? "response" : "responses"} · last 90 days
          </span>
        </div>
      </section>

      <section className="mtv-insights-trend">
        <h2>Recent weeks</h2>
        {data.weeks.every((week) => week.count === 0) ? (
          <p className="mtv-insights-empty">
            No ratings yet. Guests are asked two quick questions when
            they request the bill — results collect here.
          </p>
        ) : (
          <div className="mtv-trend-grid">
            {data.weeks.map((week) => (
              <div key={week.label} className="mtv-trend-col">
                <div className="mtv-trend-bars">
                  <span
                    className="mtv-trend-bar"
                    data-series="food"
                    style={{ height: `${((week.food ?? 0) / 5) * 100}%` }}
                    title={week.food !== null ? `Food ${week.food}` : undefined}
                  />
                  <span
                    className="mtv-trend-bar"
                    data-series="service"
                    style={{ height: `${((week.service ?? 0) / 5) * 100}%` }}
                    title={
                      week.service !== null
                        ? `Service ${week.service}`
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
          <span data-series="food">Food</span>
          <span data-series="service">Service</span>
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
