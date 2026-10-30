import {
  Activity,
  ClipboardList,
  FlaskConical,
  Globe2,
  Users,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import "./css/AnalyticsDashboard.css";

const CHART_COLORS = [
  "#6366f1",
  "#14b8a6",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#84cc16",
];

function ChartCard({ title, description, children }) {
  return (
    <article className="analytics-chart-card">
      <div className="analytics-chart-card__heading">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {children}
    </article>
  );
}

function EmptyChart({ message = "No data available for this chart." }) {
  return <div className="analytics-chart-empty">{message}</div>;
}

function formatLabel(value = "") {
  return String(value)
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Normalize phase names so that "PHASE2", "Phase 2",
// and "phase_2" can be compared consistently.
function normalizePhase(value = "") {
  return String(value)
    .toUpperCase()
    .replace(/[\s_-]/g, "");
}

function KpiCard({ label, value, detail, icon: Icon, tone }) {
  return (
    <article className="analytics-kpi-card">
      <div className="analytics-kpi-card__top">
        <span>{label}</span>

        <span
          className={`analytics-kpi-card__icon analytics-kpi-card__icon--${tone}`}
        >
          <Icon size={17} />
        </span>
      </div>

      <strong className="analytics-kpi-card__value">
        {Number(value || 0).toLocaleString()}
      </strong>

      <span className="analytics-kpi-card__detail">{detail}</span>
    </article>
  );
}

function CompactSummary({ title, items = [] }) {
  const rankedItems = [...items].sort(
    (first, second) => second.count - first.count,
  );

  const total = rankedItems.reduce((sum, item) => sum + item.count, 0);

  return (
    <article className="analytics-kpi-panel">
      <h3>{title}</h3>

      {rankedItems.length > 0 ? (
        <div className="analytics-kpi-breakdown">
          {rankedItems.map((item) => {
            const percent = total ? Math.round((item.count / total) * 100) : 0;

            return (
              <div className="analytics-kpi-breakdown__row" key={item.name}>
                <div className="analytics-kpi-breakdown__label">
                  <span>{formatLabel(item.name)}</span>
                  <strong>{Number(item.count || 0).toLocaleString()}</strong>
                </div>

                <div
                  className="analytics-kpi-breakdown__track"
                  aria-label={`${percent}%`}
                >
                  <span style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyChart message={`No ${title.toLowerCase()} reported.`} />
      )}
    </article>
  );
}

function KpiView({ analytics, summary, displayedPhaseCounts }) {
  const topSponsors = [...(analytics.topSponsors || [])]
    .sort((first, second) => second.count - first.count)
    .slice(0, 8);

  return (
    <div className="analytics-kpi-view">
      <div className="analytics-kpi-cards">
        <KpiCard
          label="Matching trials"
          value={summary.totalMatchingTrials}
          detail="Studies found by the current search"
          icon={ClipboardList}
          tone="blue"
        />

        <KpiCard
          label="Analyzed trials"
          value={summary.analyzedTrials}
          detail={summary.complete ? "Complete sample" : "Analyzed sample"}
          icon={FlaskConical}
          tone="green"
        />

        <KpiCard
          label="Countries"
          value={analytics.countryCounts?.length}
          detail="Represented in analyzed studies"
          icon={Globe2}
          tone="violet"
        />

        <KpiCard
          label="Sponsors"
          value={analytics.topSponsors?.length}
          detail="In the ranked sponsor list"
          icon={Users}
          tone="amber"
        />
      </div>

      <div className="analytics-kpi-details">
        <CompactSummary
          title="Recruitment status"
          items={analytics.statusCounts || []}
        />

        <CompactSummary title="Study phases" items={displayedPhaseCounts} />

        <article className="analytics-kpi-panel analytics-kpi-panel--sponsors">
          <div className="analytics-kpi-panel__heading">
            <div>
              <h3>Top sponsors</h3>
              <p>Ranked by number of matching studies</p>
            </div>

            <span>Top {topSponsors.length}</span>
          </div>

          {topSponsors.length > 0 ? (
            <ol className="analytics-sponsor-ranking">
              {topSponsors.map((sponsor, index) => (
                <li key={sponsor.name}>
                  <span className="analytics-sponsor-ranking__position">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="analytics-sponsor-ranking__name">
                    {sponsor.name}
                  </span>

                  <strong>{Number(sponsor.count || 0).toLocaleString()}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyChart message="No sponsor data available." />
          )}
        </article>
      </div>
    </div>
  );
}

function AnalyticsSkeleton({ view }) {
  return (
    <div
      className={`analytics-skeleton analytics-skeleton--${view}`}
      role="status"
      aria-label="Loading clinical trial analytics"
    >
      {view === "kpis" ? (
        <>
          <div className="analytics-kpi-cards" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <article className="analytics-kpi-card" key={index}>
                <span className="analytics-skeleton__block analytics-skeleton__block--label" />
                <span className="analytics-skeleton__block analytics-skeleton__block--value" />
                <span className="analytics-skeleton__block analytics-skeleton__block--detail" />
              </article>
            ))}
          </div>
          <div className="analytics-kpi-details" aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => (
              <article className="analytics-kpi-panel" key={index}>
                <span className="analytics-skeleton__block analytics-skeleton__block--panel-title" />
                {Array.from({ length: index === 2 ? 5 : 4 }, (_, row) => (
                  <div className="analytics-skeleton__row" key={row}>
                    <span className="analytics-skeleton__block analytics-skeleton__block--row" />
                    <span className="analytics-skeleton__block analytics-skeleton__block--count" />
                  </div>
                ))}
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="analytics-skeleton__summary" aria-hidden="true">
            <span className="analytics-skeleton__block analytics-skeleton__block--summary" />
            <span className="analytics-skeleton__block analytics-skeleton__block--summary" />
            <span className="analytics-skeleton__block analytics-skeleton__block--summary-short" />
          </div>
          <div className="analytics-chart-grid" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <article className="analytics-chart-card" key={index}>
                <div className="analytics-chart-card__heading">
                  <span className="analytics-skeleton__block analytics-skeleton__block--chart-title" />
                  <span className="analytics-skeleton__block analytics-skeleton__block--chart-caption" />
                </div>
                <div className="analytics-skeleton__chart">
                  {[40, 66, 52, 82, 60, 92, 72].map((height, barIndex) => (
                    <span
                      className="analytics-skeleton__block analytics-skeleton__bar"
                      key={barIndex}
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AnalyticsDashboard({
  data,
  loading,
  error,
  view,
  onViewChange,
  filters = {},
}) {
  // Safely handle an API response that has not arrived yet.
  const analytics = data?.analytics ?? {};
  const summary = data?.summary ?? {};

  const statusCounts = analytics.statusCounts ?? [];
  const totalStatusCount = statusCounts.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0,
  );
  const phaseCounts = analytics.phaseCounts ?? [];
  const trialsByYear = analytics.trialsByYear ?? [];
  const topSponsors = analytics.topSponsors ?? [];
  const countryCounts = analytics.countryCounts ?? [];

  // When a phase is selected, display only that phase.
  // With no phase filter, display all reported phases.
  const displayedPhaseCounts = filters.phase
    ? phaseCounts.filter(
        (item) => normalizePhase(item.name) === normalizePhase(filters.phase),
      )
    : phaseCounts;

  const hasAnalytics = Boolean(data?.analytics && data?.summary);

  return (
    <section className="analytics-dashboard" id="analytics">
      <div className="analytics-dashboard__heading">
        <div>
          <span className="analytics-dashboard__eyebrow">
            RESEARCH INSIGHTS
          </span>

          <h2>Clinical Trial Analytics</h2>

          <p>
            Explore recruitment status, study phases, research activity,
            sponsors, and geographic distribution.
          </p>
        </div>

        <label className="analytics-dashboard__view-select">
          <span>Display</span>

          <select
            value={view}
            onChange={(event) => onViewChange(event.target.value)}
          >
            <option value="charts">Graphical view</option>
            <option value="kpis">KPI card view</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="analytics-dashboard__error" role="alert">
          {error}
        </div>
      )}

      {!data && !loading && !error && (
        <div className="analytics-dashboard__empty">
          <Activity size={24} />
          <p>
            Search for clinical studies to generate matching trial analytics.
          </p>
        </div>
      )}

      {loading && !hasAnalytics && (
        <AnalyticsSkeleton view={view} />
      )}

      {loading && hasAnalytics && (
        <div className="analytics-dashboard__refreshing" role="status">
          Updating analytics for the applied search...
        </div>
      )}

      {hasAnalytics && (
        <>
          {view === "charts" && (
            <div className="analytics-dashboard__summary">
              <span>
                <strong>
                  {Number(summary.totalMatchingTrials || 0).toLocaleString()}
                </strong>{" "}
                matching trials
              </span>

              <span>
                <strong>
                  {Number(summary.analyzedTrials || 0).toLocaleString()}
                </strong>{" "}
                analyzed
              </span>

              <span>
                {summary.complete ? "Analysis complete" : "Partial analysis"}
              </span>
            </div>
          )}

          {view === "charts" ? (
            <div className="analytics-chart-grid">
              {/* Recruitment Status */}
              <ChartCard
                title="Recruitment Status"
                description="Distribution of trials by recruitment status"
              >
                {statusCounts.length > 0 ? (
                  <div className="analytics-status-chart">
                    <div className="analytics-status-chart__plot">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart
                          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                        >
                          <Pie
                            data={statusCounts}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius="78%"
                            innerRadius="52%"
                            paddingAngle={1.5}
                          >
                            {statusCounts.map((entry, index) => (
                              <Cell
                                key={`${entry.name}-${index}`}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>

                          <Tooltip
                            formatter={(value, name) => {
                              const count = Number(value || 0);
                              const percentage = totalStatusCount
                                ? ((count / totalStatusCount) * 100).toFixed(1)
                                : "0.0";
                              return [
                                `${percentage}% (${count.toLocaleString()} trials)`,
                                formatLabel(name),
                              ];
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <ul
                      className="analytics-status-legend"
                      aria-label="Recruitment status legend"
                    >
                      {statusCounts.map((entry, index) => (
                        <li
                          key={`${entry.name}-${index}`}
                          title={formatLabel(entry.name)}
                        >
                          <span
                            className="analytics-status-legend__swatch"
                            style={{
                              backgroundColor:
                                CHART_COLORS[index % CHART_COLORS.length],
                            }}
                            aria-hidden="true"
                          />
                          <span className="analytics-status-legend__name">
                            {formatLabel(entry.name)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <EmptyChart />
                )}
              </ChartCard>

              {/* Study Phases */}
              <ChartCard
                title="Study Phases"
                description={
                  filters.phase
                    ? `Trials reported for ${formatLabel(filters.phase)}`
                    : "Number of trials in each reported phase"
                }
              >
                {displayedPhaseCounts.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={displayedPhaseCounts}
                      margin={{
                        top: 12,
                        right: 12,
                        left: 0,
                        bottom: 28,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />

                      <XAxis
                        dataKey="name"
                        angle={-20}
                        textAnchor="end"
                        interval={0}
                        height={55}
                        tick={{ fontSize: 11 }}
                        label={{ value: "Study phase", position: "insideBottom", offset: -8 }}
                      />

                      <YAxis
                        allowDecimals={false}
                        label={{ value: "Number of trials", angle: -90, position: "insideLeft", style: { textAnchor: "middle" } }}
                      />
                      <Tooltip />

                      <Bar
                        dataKey="count"
                        name="Trials"
                        fill="#6366f1"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart
                    message={
                      filters.phase
                        ? `No phase data available for ${formatLabel(filters.phase)}.`
                        : undefined
                    }
                  />
                )}
              </ChartCard>

              {/* Trials by Start Year */}
              <ChartCard
                title="Trials by Start Year"
                description="Research activity based on trial start dates"
              >
                {trialsByYear.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={trialsByYear}
                      margin={{
                        top: 12,
                        right: 12,
                        left: 0,
                        bottom: 8,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />

                      <XAxis
                        dataKey="year"
                        tick={{ fontSize: 11 }}
                        label={{ value: "Start year", position: "insideBottom", offset: -4 }}
                      />

                      <YAxis
                        allowDecimals={false}
                        label={{ value: "Number of trials", angle: -90, position: "insideLeft", style: { textAnchor: "middle" } }}
                      />
                      <Tooltip />

                      <Bar
                        dataKey="count"
                        name="Trials"
                        fill="#14b8a6"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </ChartCard>

              {/* Top Sponsors */}
              <ChartCard
                title="Top Sponsors"
                description="Sponsors with the most trials in the analyzed sample"
              >
                {topSponsors.length > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height={340}
                  >
                    <BarChart
                      data={topSponsors}
                      layout="vertical"
                      margin={{
                        top: 4,
                        right: 20,
                        left: 12,
                        bottom: 4,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />

                      <XAxis
                        type="number"
                        allowDecimals={false}
                        label={{ value: "Number of trials", position: "insideBottom", offset: -2 }}
                      />

                      <YAxis
                        type="category"
                        dataKey="name"
                        width={125}
                        tick={{ fontSize: 11 }}
                        label={{ value: "Sponsor", angle: -90, position: "insideLeft", style: { textAnchor: "middle" } }}
                      />

                      <Tooltip />

                      <Bar
                        dataKey="count"
                        name="Trials"
                        fill="#f59e0b"
                        radius={[0, 5, 5, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </ChartCard>

              {/* Top Countries */}
              <ChartCard
                title="Top Countries"
                description="Geographic distribution of analyzed trials"
              >
                {countryCounts.length > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height={340}
                  >
                    <BarChart
                      data={[...countryCounts]
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 10)}
                      layout="vertical"
                      margin={{
                        top: 4,
                        right: 20,
                        left: 12,
                        bottom: 4,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />

                      <XAxis
                        type="number"
                        allowDecimals={false}
                        label={{ value: "Number of trials", position: "insideBottom", offset: -2 }}
                      />

                      <YAxis
                        type="category"
                        dataKey="name"
                        width={115}
                        tick={{ fontSize: 11 }}
                        label={{ value: "Country", angle: -90, position: "insideLeft", style: { textAnchor: "middle" } }}
                      />

                      <Tooltip />

                      <Bar
                        dataKey="count"
                        name="Trials"
                        fill="#8b5cf6"
                        radius={[0, 5, 5, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </ChartCard>

              {/* Geographic Overview */}
              <ChartCard
                title="Geographic Overview"
                description="Countries represented in the analyzed sample"
              >
                {countryCounts.length > 0 ? (
                  <div className="analytics-country-list">
                    {[...countryCounts]
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 8)
                      .map((country) => (
                        <div
                          className="analytics-country-row"
                          key={country.name}
                        >
                          <span>
                            <Globe2 size={15} />
                            {country.name}
                          </span>

                          <strong>{country.count}</strong>
                        </div>
                      ))}
                  </div>
                ) : (
                  <EmptyChart />
                )}
              </ChartCard>
            </div>
          ) : (
            <KpiView
              analytics={analytics}
              summary={summary}
              displayedPhaseCounts={displayedPhaseCounts}
            />
          )}

          <p className="analytics-dashboard__footnote">
            Analytics represent the analyzed sample, not necessarily every
            matching trial.{" "}
            {summary.complete
              ? "All available pages were fetched within the configured page limit."
              : "The backend page limit was reached, so the analysis may be partial."}
          </p>
        </>
      )}
    </section>
  );
}
