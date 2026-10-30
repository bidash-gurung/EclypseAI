import {
  Activity,
  Beaker,
  Building2,
  ClipboardList,
  FlaskConical,
  Globe2,
} from "lucide-react";
import "./css/Overview.css";

function MetricCard({ label, icon: Icon, tone, value, summary, note }) {
  return (
    <article className="overview-metric">
      <div className="overview-metric__top">
        <span>{label}</span>
        <span
          className={`overview-metric__icon overview-metric__icon--${tone}`}
        >
          <Icon size={18} />
        </span>
      </div>
      <strong className="overview-metric__value">{value}</strong>
      <div className="overview-metric__foot">
        <span>{summary}</span>
        <small>{note}</small>
      </div>
    </article>
  );
}

export default function Overview({ hasSearched, totalCount, metrics }) {
  return (
    <section className="overview" aria-labelledby="overview-title">
      <div className="overview__heading">
        <div>
          <div className="overview__kicker">
            <FlaskConical size={15} /> Clinical research intelligence
          </div>
          <h1 id="overview-title">Clinical Trial Explorer</h1>
          <p>
            Discover clinical studies, explore research locations, and uncover
            insights across the clinical research landscape.
          </p>
        </div>
        <div className="overview__source">
          <span /> Powered by ClinicalTrials.gov
        </div>
      </div>

      <div className="overview__metrics" aria-label="Search metrics">
        <MetricCard
          label="Matching studies"
          icon={ClipboardList}
          tone="blue"
          value={hasSearched ? totalCount.toLocaleString() : "—"}
          summary={
            <>
              <Activity size={13} /> Total matches
            </>
          }
          note="Current search"
        />
        <MetricCard
          label="Countries represented"
          icon={Globe2}
          tone="violet"
          value={hasSearched ? metrics.countries : "—"}
          summary="Unique countries"
          note="Current page"
        />
        <MetricCard
          label="Study phases"
          icon={Beaker}
          tone="green"
          value={hasSearched ? metrics.phases : "—"}
          summary="Unique phases"
          note="Current page"
        />
        <MetricCard
          label="Study sponsors"
          icon={Building2}
          tone="amber"
          value={hasSearched ? metrics.sponsors : "—"}
          summary="Unique sponsors"
          note="Current page"
        />
      </div>
    </section>
  );
}
