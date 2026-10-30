import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  FlaskConical,
  MapPin,
  Search,
} from "lucide-react";
import { formatDate, formatStatus } from "./trialFormatters";
import "./css/TrialsTable.css";

function hasMapCoordinates(location) {
  if (location?.latitude == null || location?.longitude == null) return false;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export default function TrialsTable({
  error,
  loading,
  hasSearched,
  trials,
  totalCount,
  nextPageToken,
  onNextPage,
  onSelectTrial,
  onOpenLocation,
  showOfficialSite = false,
}) {
  return (
    <section
      className="trials-results"
      id="trials"
      aria-labelledby="trials-title"
      aria-busy={loading}
    >
      <div className="trials-results__heading">
        <div className="trials-results__heading-main">
          <span className="trials-results__icon">
            <Search size={18} />
          </span>
          <div>
            <h2 id="trials-title">Clinical studies</h2>
            <p>
              {loading
                ? "Searching clinical studies..."
                : hasSearched
                  ? `${totalCount.toLocaleString()} matching records found`
                  : "Search to view matching records"}
            </p>
          </div>
        </div>
        {hasSearched && (
          <span className="trials-results__count">
            {loading
              ? "Updating results"
              : `${trials.length} shown on this page`}
          </span>
        )}
      </div>

      {error && (
        <div className="trials-results__error" role="alert">
          <CircleHelp size={18} />
          <span>{error}</span>
        </div>
      )}
      {loading && (
        <div className="trials-results__scroll trials-results__skeleton-wrap">
          <span className="sr-only" role="status">
            Searching clinical studies
          </span>
          <table className="trials-results__table" aria-hidden="true">
            <thead>
              <tr>
                <th>Study</th>
                <th>Status</th>
                <th>Phase</th>
                <th>Start date</th>
                <th>Completion</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }, (_, index) => (
                <tr className="trials-results__skeleton-row" key={index}>
                  <td>
                    <span className="skeleton-block skeleton-block--title" />
                    <span className="skeleton-block skeleton-block--id" />
                  </td>
                  <td>
                    <span className="skeleton-block skeleton-block--status" />
                  </td>
                  <td>
                    <span className="skeleton-block skeleton-block--phase" />
                  </td>
                  <td>
                    <span className="skeleton-block skeleton-block--date" />
                  </td>
                  <td>
                    <span className="skeleton-block skeleton-block--date" />
                  </td>
                  <td>
                    <span className="skeleton-block skeleton-block--location" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && hasSearched && trials.length === 0 && (
        <div className="trials-results__state">
          <span className="trials-results__empty-icon">
            <Search size={22} />
          </span>
          <h3>No studies found</h3>
          <p>Try another condition, intervention, or date range.</p>
        </div>
      )}
      {!hasSearched && (
        <div className="trials-results__state">
          <span className="trials-results__empty-icon">
            <FlaskConical size={22} />
          </span>
          <h3>Your research starts here</h3>
          <p>
            Set your search filters above to explore clinical studies from the
            ClinicalTrials.gov database.
          </p>
        </div>
      )}

      {!loading && trials.length > 0 && (
        <>
          <div className="trials-results__scroll">
            <table className="trials-results__table">
              <thead>
                <tr>
                  <th>Study</th>
                  <th>Status</th>
                  <th>Phase</th>
                  <th>Start date</th>
                  <th>Completion</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {trials.map((trial) => {
                  const locations = trial.locations || [];
                  const location = (onOpenLocation ? locations.find(hasMapCoordinates) : null) ||
                    locations.find((item) => item.city || item.country);
                  const canOpenOnMap = hasMapCoordinates(location);
                  return (
                    <tr
                      key={trial.nctId}
                      tabIndex={0}
                      onClick={() => onSelectTrial(trial)}
                      onKeyDown={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          onSelectTrial(trial);
                        }
                      }}
                    >
                      <td className="trials-results__study">
                        <button
                          type="button"
                          className="trials-results__study-link"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectTrial(trial);
                          }}
                        >
                          {trial.title || "Untitled study"}
                        </button>
                        <span className="trials-results__study-id">
                          {trial.nctId}
                        </span>
                        {showOfficialSite && trial.nctId && (
                          <a
                            className="trials-results__official-link"
                            href={`https://clinicaltrials.gov/study/${encodeURIComponent(trial.nctId)}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Official site <ExternalLink size={12} />
                          </a>
                        )}
                      </td>
                      <td>
                        <span
                          className={`trials-results__status trials-results__status--${(trial.status || "unknown").toLowerCase()}`}
                        >
                          <i />
                          {formatStatus(trial.status)}
                        </span>
                      </td>
                      <td className="trials-results__phase">
                        {trial.phases?.length
                          ? trial.phases.join(", ").replaceAll("_", " ")
                          : "â€”"}
                      </td>
                      <td className="trials-results__date">
                        {formatDate(trial.startDate)}
                      </td>
                      <td className="trials-results__date">
                        {formatDate(trial.completionDate)}
                      </td>
                      <td className="trials-results__location">
                        {location ? (
                          onOpenLocation && canOpenOnMap ? (
                            <button
                              type="button"
                              className="trials-results__location-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenLocation(trial, location);
                              }}
                              title="Open this site on the map"
                            >
                              <MapPin size={15} />
                              <span>{[location.city, location.country].filter(Boolean).join(", ") || "Open map"}</span>
                            </button>
                          ) : (
                            <span>
                              <MapPin size={15} />
                              {[location.city, location.country].filter(Boolean).join(", ") || "Not reported"}
                            </span>
                          )
                        ) : (
                          <span className="trials-results__muted">Not reported</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="trials-results__footer">
            <span>
              Showing {trials.length} of {totalCount.toLocaleString()} matching
              studies
            </span>
            <div className="trials-results__pagination">
              <button type="button" disabled aria-label="Previous page">
                <ChevronLeft size={17} />
              </button>
              <span>Current page</span>
              <button
                type="button"
                disabled={!nextPageToken || loading}
                onClick={onNextPage}
                aria-label="Next page"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
