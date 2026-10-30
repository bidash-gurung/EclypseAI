import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import {
  MapPin,
  Globe2,
  ArrowLeft,
  ArrowUpRight,
  LoaderCircle,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./css/ClinicalTrialMap.css";

const DEFAULT_CENTER = [20, 0];
const DEFAULT_ZOOM = 2;
const CLUSTER_DETAIL_LIMIT = 50;

const STATUS_COLORS = {
  RECRUITING: "#16a34a",
  ACTIVE_NOT_RECRUITING: "#2563eb",
  COMPLETED: "#64748b",
  NOT_YET_RECRUITING: "#d97706",
  TERMINATED: "#dc2626",
  WITHDRAWN: "#9333ea",
  SUSPENDED: "#ea580c",
  ENROLLING_BY_INVITATION: "#0891b2",
  NOT_RECRUITING: "#64748b",
};

function getStatusColor(status) {
  return STATUS_COLORS[status] || "#0d9488";
}

function formatStatus(status) {
  if (!status) return "Not reported";

  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(date) {
  return date || "Not reported";
}

function getCoordinates(location = {}) {
  const latitude = location.latitude ?? location.lat ?? location.geoPoint?.lat;

  const longitude =
    location.longitude ??
    location.lng ??
    location.lon ??
    location.geoPoint?.lon ??
    location.geoPoint?.lng;

  if (
    latitude == null ||
    longitude == null ||
    String(latitude).trim() === "" ||
    String(longitude).trim() === ""
  ) {
    return { type: "missing" };
  }

  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (
    !Number.isFinite(parsedLatitude) ||
    !Number.isFinite(parsedLongitude) ||
    parsedLatitude < -90 ||
    parsedLatitude > 90 ||
    parsedLongitude < -180 ||
    parsedLongitude > 180
  ) {
    return { type: "invalid" };
  }

  return {
    type: "valid",
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  };
}

function MapBounds({ locations }) {
  const map = useMap();

  useEffect(() => {
    if (!locations.length) return;

    const bounds = L.latLngBounds(
      locations.map((location) => [location.latitude, location.longitude]),
    );

    if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
      map.setView(bounds.getCenter(), 8, { animate: true });
    } else {
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 10,
        animate: true,
      });
    }
  }, [locations, map]);

  return null;
}

function TrialDetails({ trial, onSelectTrial }) {
  const location = trial.location || {};

  const phases =
    Array.isArray(trial.phases) && trial.phases.length
      ? trial.phases.join(", ").replaceAll("_", " ")
      : Array.isArray(trial.phase) && trial.phase.length
        ? trial.phase.join(", ").replaceAll("_", " ")
        : trial.phase || "Not reported";

  return (
    <div className="trial-map-popup">
      <span className="trial-map-popup-id">{trial.nctId || "No NCT ID"}</span>

      <h3>{trial.title || "Untitled clinical trial"}</h3>

      <p>
        <strong>Status:</strong>{" "}
        <span style={{ color: getStatusColor(trial.status) }}>
          {formatStatus(trial.status)}
        </span>
      </p>

      <p>
        <strong>Phase:</strong> {phases}
      </p>

      <p>
        <strong>Sponsor:</strong> {trial.sponsor || "Not reported"}
      </p>

      <p>
        <strong>Start date:</strong> {formatDate(trial.startDate)}
      </p>

      <p>
        <strong>Completion date:</strong> {formatDate(trial.completionDate)}
      </p>

      <p>
        <strong>Site:</strong> {location.facility || "Facility not reported"}
      </p>

      <p>
        <strong>Location:</strong>{" "}
        {[location.city, location.state, location.country]
          .filter(Boolean)
          .join(", ") || "Location not reported"}
      </p>

      {onSelectTrial && (
        <button
          type="button"
          className="trial-map-details-button"
          onClick={() => onSelectTrial(trial)}
        >
          View full details
        </button>
      )}

      {trial.nctId && (
        <a
          className="trial-map-official-link"
          href={`https://clinicaltrials.gov/study/${encodeURIComponent(
            trial.nctId,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View official study record
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

function TrialMarker({ location, trial, onSelectTrial }) {
  const color = getStatusColor(trial.status);

  const icon = useMemo(
    () =>
      L.divIcon({
        className: "clinical-site-pin-host",
        html: `<span class="clinical-site-pin" style="--pin-color:${color}"><span></span></span>`,
        iconSize: [28, 36],
        iconAnchor: [14, 34],
        popupAnchor: [0, -32],
      }),
    [color],
  );

  return (
    <Marker
      position={[location.latitude, location.longitude]}
      icon={icon}
      riseOnHover
      keyboard
    >
      <Popup minWidth={260} maxWidth={340}>
        <TrialDetails
          trial={{ ...trial, location }}
          onSelectTrial={onSelectTrial}
        />
      </Popup>
    </Marker>
  );
}

function createClusterIcon(cluster) {
  return L.divIcon({
    html: `<span class="clinical-site-cluster">${cluster.getChildCount()}</span>`,
    className: "clinical-site-cluster-host",
    iconSize: [42, 42],
  });
}

function ClinicalTrialMap({
  trials = [],
  mapData,
  onSelectTrial,
  loading = false,
  error = "",
  clusterDetailsUrl,
  filters = {},
}) {
  const isAggregated = mapData != null;

  const [selectedCluster, setSelectedCluster] = useState(null);
  const [clusterDetails, setClusterDetails] = useState(null);
  const [clusterLoading, setClusterLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [clusterError, setClusterError] = useState("");

  // A ref prevents outdated requests from replacing newer results.
  const requestVersion = useRef(0);

  const aggregatePoints = useMemo(
    () =>
      (Array.isArray(mapData?.points) ? mapData.points : [])
        .map((point) => ({
          ...point,
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
        }))
        .filter(
          (point) =>
            Number.isFinite(point.latitude) &&
            Number.isFinite(point.longitude) &&
            point.latitude >= -90 &&
            point.latitude <= 90 &&
            point.longitude >= -180 &&
            point.longitude <= 180,
        ),
    [mapData],
  );

  const aggregateTrialCount = Number(mapData?.totalTrials) || 0;
  const aggregateLocationCount = Number(mapData?.totalLocations) || 0;

  const {
    locations,
    coordinateIssues,
    missingCoordinates,
    invalidCoordinates,
  } = useMemo(() => {
    const result = [];
    const issues = [];

    trials.forEach((trial) => {
      (trial.locations || []).forEach((location, index) => {
        const coordinates = getCoordinates(location);

        if (coordinates.type !== "valid") {
          issues.push({
            key: `${trial.nctId || "trial"}-${index}-${coordinates.type}`,
            trial,
            location,
            type: coordinates.type,
          });
          return;
        }

        result.push({
          key: `${trial.nctId || "trial"}-${coordinates.latitude}-${coordinates.longitude}-${index}`,
          trial,
          location: {
            ...location,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          },
        });
      });
    });

    return {
      locations: result,
      coordinateIssues: issues,
      missingCoordinates: issues.filter((item) => item.type === "missing")
        .length,
      invalidCoordinates: issues.filter((item) => item.type === "invalid")
        .length,
    };
  }, [trials]);

  const countries = useMemo(
    () =>
      new Set(locations.map(({ location }) => location.country).filter(Boolean))
        .size,
    [locations],
  );

  const fitCoordinates = useMemo(
    () => [
      ...new Map(
        locations.map(({ location }) => [
          `${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`,
          location,
        ]),
      ).values(),
    ],
    [locations],
  );

  // Convert every loaded trial location into a map pin.
  const clusterLocations = useMemo(() => {
    if (!clusterDetails || !Array.isArray(clusterDetails.trials)) {
      return [];
    }

    return clusterDetails.trials.flatMap((trial, index) => {
      const location = trial.location || {};
      const coordinates = getCoordinates(location);

      if (coordinates.type !== "valid") return [];

      return [
        {
          key: `${trial.nctId || "trial"}-${coordinates.latitude}-${coordinates.longitude}-${index}`,
          trial,
          location: {
            ...location,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          },
        },
      ];
    });
  }, [clusterDetails]);

  const drillDown = isAggregated && selectedCluster !== null;

  const mapCoordinates = drillDown
    ? clusterLocations.map(({ location }) => location)
    : isAggregated
      ? aggregatePoints
      : fitCoordinates;

  const hasMapItems = drillDown
    ? clusterLocations.length > 0
    : isAggregated
      ? aggregatePoints.length > 0
      : locations.length > 0;

  // Fetch one page of locations. Append subsequent pages to the existing data.
  async function fetchClusterPage(point, offset, append) {
    if (!clusterDetailsUrl) {
      setClusterError("Cluster details API URL is not configured.");
      return;
    }

    const currentRequest = ++requestVersion.current;

    if (append) {
      setLoadingMore(true);
    } else {
      setClusterLoading(true);
    }

    setClusterError("");

    try {
      const params = new URLSearchParams();

      params.set("latitude", String(point.latitude));
      params.set("longitude", String(point.longitude));
      params.set("limit", String(CLUSTER_DETAIL_LIMIT));
      params.set("offset", String(offset));

      Object.entries(filters).forEach(([key, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
        ) {
          params.set(key, String(value).trim());
        }
      });

      const separator = clusterDetailsUrl.includes("?") ? "&" : "?";

      const response = await fetch(
        `${clusterDetailsUrl}${separator}${params.toString()}`,
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load cluster details.");
      }

      // Ignore results from a cluster that is no longer selected.
      if (currentRequest !== requestVersion.current) return;

      setClusterDetails((previous) => {
        const previousTrials =
          append && Array.isArray(previous?.trials) ? previous.trials : [];

        const newTrials = Array.isArray(data.trials) ? data.trials : [];

        // The API's offset pagination can have overlapping results if Redis
        // set iteration order changes. Avoid adding duplicate site records.
        const combined = [...previousTrials];
        const seen = new Set(
          combined.map((trial) => {
            const loc = trial.location || {};
            return [
              trial.nctId || "",
              loc.facility || "",
              loc.city || "",
              loc.state || "",
              loc.country || "",
              loc.latitude ?? loc.lat ?? "",
              loc.longitude ?? loc.lng ?? loc.lon ?? "",
            ].join("|");
          }),
        );

        for (const trial of newTrials) {
          const loc = trial.location || {};
          const key = [
            trial.nctId || "",
            loc.facility || "",
            loc.city || "",
            loc.state || "",
            loc.country || "",
            loc.latitude ?? loc.lat ?? "",
            loc.longitude ?? loc.lng ?? loc.lon ?? "",
          ].join("|");

          if (!seen.has(key)) {
            combined.push(trial);
            seen.add(key);
          }
        }

        return {
          ...data,
          trials: combined,
          returnedLocations: combined.length,
        };
      });
    } catch (err) {
      if (currentRequest === requestVersion.current) {
        setClusterError(err.message || "Unable to load cluster details.");
      }
    } finally {
      if (currentRequest === requestVersion.current) {
        setClusterLoading(false);
        setLoadingMore(false);
      }
    }
  }

  async function handleClusterClick(point) {
    setSelectedCluster(point);
    setClusterDetails(null);
    setClusterError("");
    setLoadingMore(false);

    await fetchClusterPage(point, 0, false);
  }

  async function handleShowMore() {
    if (!selectedCluster || !clusterDetails?.hasMore || loadingMore) {
      return;
    }

    // The next offset is the number of records already fetched.
    const nextOffset = clusterDetails.trials?.length || 0;

    await fetchClusterPage(selectedCluster, nextOffset, true);
  }

  function returnToClusters() {
    // Invalidate any in-flight request.
    requestVersion.current += 1;

    setSelectedCluster(null);
    setClusterDetails(null);
    setClusterError("");
    setClusterLoading(false);
    setLoadingMore(false);
  }

  const statusLegend = [
    { label: "Recruiting", color: STATUS_COLORS.RECRUITING },
    {
      label: "Active, not recruiting",
      color: STATUS_COLORS.ACTIVE_NOT_RECRUITING,
    },
    { label: "Completed", color: STATUS_COLORS.COMPLETED },
    {
      label: "Not yet recruiting",
      color: STATUS_COLORS.NOT_YET_RECRUITING,
    },
    { label: "Terminated", color: STATUS_COLORS.TERMINATED },
    { label: "Withdrawn", color: STATUS_COLORS.WITHDRAWN },
  ];

  return (
    <section className="clinical-map-page">
      <div className="clinical-map-heading">
        <div>
          <div className="clinical-map-eyebrow">
            <Globe2 size={15} />
            GLOBAL RESEARCH
          </div>

          <h1>Clinical Trial Map</h1>

          <p>
            Explore clinical trial sites by location, recruitment status, and
            study phase.
          </p>
        </div>

        <div className="clinical-map-heading-icon">
          <MapPin size={24} />
        </div>
      </div>

      <div className="clinical-map-stats">
        {loading ? (
          Array.from(
            { length: (drillDown || isAggregated) ? 3 : 4 },
            (_, index) => (
              <div
                className="clinical-map-stat clinical-map-stat--skeleton"
                key={index}
                aria-hidden="true"
              >
                <span className="clinical-map-skeleton-line clinical-map-skeleton-line--label" />
                <span className="clinical-map-skeleton-line clinical-map-skeleton-line--value" />
              </div>
            ),
          )
        ) : drillDown ? (
          <>
            <div className="clinical-map-stat">
              <span>Cluster sites</span>
              <strong>
                {(clusterDetails?.totalLocations ?? 0).toLocaleString()}
              </strong>
            </div>

            <div className="clinical-map-stat">
              <span>Loaded site records</span>
              <strong>{clusterDetails?.trials?.length ?? 0}</strong>
            </div>

            <div className="clinical-map-stat">
              <span>Sites with coordinates</span>
              <strong>{clusterLocations.length}</strong>
            </div>
          </>
        ) : isAggregated ? (
          <>
            <div className="clinical-map-stat">
              <span>Matching trials</span>
              <strong>{aggregateTrialCount.toLocaleString()}</strong>
            </div>

            <div className="clinical-map-stat">
              <span>Trial sites</span>
              <strong>{aggregateLocationCount.toLocaleString()}</strong>
            </div>

            <div className="clinical-map-stat">
              <span>Geographic clusters</span>
              <strong>{aggregatePoints.length.toLocaleString()}</strong>
            </div>
          </>
        ) : (
          <>
            <div className="clinical-map-stat">
              <span>Trials loaded</span>
              <strong>{trials.length}</strong>
            </div>

            <div className="clinical-map-stat">
              <span>Sites with coordinates</span>
              <strong>{locations.length}</strong>
            </div>

            <div className="clinical-map-stat">
              <span>Countries represented</span>
              <strong>{countries}</strong>
            </div>

            <div className="clinical-map-stat clinical-map-stat--unmapped">
              <span>Sites not mapped</span>
              <strong>{coordinateIssues.length}</strong>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="clinical-map-error" role="alert">
          {error}
        </div>
      )}

      {clusterError && (
        <div className="clinical-map-error" role="alert">
          {clusterError}
        </div>
      )}

      {loading && (
        <div className="clinical-map-loading" role="status">
          Loading map data...
        </div>
      )}

      {clusterLoading && (
        <div className="clinical-map-loading" role="status">
          <LoaderCircle size={17} />
          Loading individual trial sites...
        </div>
      )}

      <div className="clinical-map-legend">
        <strong>Recruitment status</strong>

        {statusLegend.map((item) => (
          <span key={item.label} className="clinical-map-legend-item">
            <span
              className="clinical-map-legend-dot"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>

      {drillDown && (
        <div className="clinical-map-drilldown-toolbar">
          <button
            type="button"
            className="trial-map-details-button"
            onClick={returnToClusters}
          >
            <ArrowLeft size={16} />
            Back to clusters
          </button>

          <span>
            Individual trial pins
            {selectedCluster
              ? ` · ${selectedCluster.latitude}, ${selectedCluster.longitude}`
              : ""}
          </span>
        </div>
      )}

      <div className="clinical-map-container">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          minZoom={2}
          scrollWheelZoom
          worldCopyJump
          className="clinical-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapBounds locations={mapCoordinates} />

          {drillDown ? (
            clusterLocations.length > 0 ? (
              <MarkerClusterGroup
                chunkedLoading
                chunkInterval={100}
                removeOutsideVisibleBounds
                spiderfyOnMaxZoom
                showCoverageOnHover={false}
                maxClusterRadius={(zoom) =>
                  zoom < 5 ? 90 : zoom < 8 ? 65 : 45
                }
                iconCreateFunction={createClusterIcon}
              >
                {clusterLocations.map(({ key, trial, location }) => (
                  <TrialMarker
                    key={key}
                    trial={trial}
                    location={location}
                    onSelectTrial={onSelectTrial}
                  />
                ))}
              </MarkerClusterGroup>
            ) : null
          ) : isAggregated ? (
            aggregatePoints.map((point, index) => (
              <CircleMarker
                key={`${point.latitude}-${point.longitude}-${index}`}
                center={[point.latitude, point.longitude]}
                radius={Math.min(
                  8 + Math.log2((point.locationCount || 0) + 1) * 2,
                  22,
                )}
                pathOptions={{
                  color: "#0f766e",
                  fillColor: "#14b8a6",
                  fillOpacity: 0.65,
                  weight: 1,
                }}
                eventHandlers={{
                  click: () => handleClusterClick(point),
                }}
              >
                <Popup>
                  <div className="trial-map-popup">
                    <h3>Clinical trial cluster</h3>

                    <p>
                      <strong>Trials:</strong>{" "}
                      {point.trialCount ?? "Not reported"}
                    </p>

                    <p>
                      <strong>Sites:</strong>{" "}
                      {point.locationCount ?? "Not reported"}
                    </p>

                    <p>Click the cluster to load individual trial pins.</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))
          ) : (
            <MarkerClusterGroup
              chunkedLoading
              chunkInterval={100}
              removeOutsideVisibleBounds
              spiderfyOnMaxZoom
              showCoverageOnHover={false}
              maxClusterRadius={(zoom) => (zoom < 5 ? 90 : zoom < 8 ? 65 : 45)}
              iconCreateFunction={createClusterIcon}
            >
              {locations.map(({ key, trial, location }) => (
                <TrialMarker
                  key={key}
                  trial={trial}
                  location={location}
                  onSelectTrial={onSelectTrial}
                />
              ))}
            </MarkerClusterGroup>
          )}
        </MapContainer>

        {!hasMapItems && !loading && !clusterLoading && (
          <div className="clinical-map-empty">
            <MapPin size={26} />

            <strong>
              {drillDown
                ? "No individual trial sites returned"
                : "No mappable sites in this search"}
            </strong>

            <p>
              {drillDown
                ? "This cluster may contain sites without valid coordinates, or the API returned no matching records."
                : isAggregated
                  ? "No geographic clusters were returned for these filters."
                  : "Sites without valid coordinates are excluded from the map."}
            </p>

            {drillDown && (
              <button
                type="button"
                className="trial-map-details-button"
                onClick={returnToClusters}
              >
                Back to clusters
              </button>
            )}
          </div>
        )}
      </div>

      {drillDown && clusterDetails && (
        <div className="clinical-map-pagination">
          <div className="clinical-map-pagination-info">
            <strong>
              Showing {clusterLocations.length.toLocaleString()} of{" "}
              {(clusterDetails.totalLocations ?? 0).toLocaleString()} locations
            </strong>

            <span>
              {clusterDetails.hasMore
                ? "More locations are available in this cluster."
                : "All available locations in this cluster have been loaded."}
            </span>
          </div>

          {clusterDetails.hasMore && (
            <button
              type="button"
              className="trial-map-details-button"
              onClick={handleShowMore}
              disabled={loadingMore || clusterLoading}
            >
              {loadingMore ? (
                <>
                  <LoaderCircle size={16} className="clinical-map-spinner" />
                  Loading more locations...
                </>
              ) : (
                "Show more locations"
              )}
            </button>
          )}
        </div>
      )}

      <div className="clinical-map-footer">
        {drillDown ? (
          <>
            <span>
              Showing {clusterLocations.length.toLocaleString()} individual site
              pins
            </span>
            <span>Click a colored pin to view its trial details</span>
          </>
        ) : isAggregated ? (
          <>
            <span>
              Showing {aggregatePoints.length.toLocaleString()} geographic
              clusters
            </span>
            <span>Click a circle to inspect individual trials</span>
          </>
        ) : (
          <>
            <span>
              Showing {locations.length} site markers across {countries}{" "}
              countries
            </span>

            <span>
              {missingCoordinates} missing coordinates · {invalidCoordinates}{" "}
              invalid coordinates
            </span>
          </>
        )}
      </div>

      {!isAggregated && coordinateIssues.length > 0 && (
        <details className="clinical-map-unmapped">
          <summary>
            Sites without map coordinates ({coordinateIssues.length})
          </summary>

          <p>
            These sites are excluded from the map instead of being placed at a
            guessed location.
          </p>

          <ul>
            {coordinateIssues
              .slice(0, 25)
              .map(({ key, trial, location, type }) => {
                const place = [location.city, location.state, location.country]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <li key={key}>
                    <span>{location.facility || "Facility not reported"}</span>

                    <small>
                      {trial.nctId} · {place || "Location not reported"} ·{" "}
                      {type === "missing"
                        ? "Coordinates missing"
                        : "Invalid coordinates"}
                    </small>
                  </li>
                );
              })}

            {coordinateIssues.length > 25 && (
              <li className="clinical-map-unmapped-more">
                {coordinateIssues.length - 25} additional sites are not listed.
              </li>
            )}
          </ul>
        </details>
      )}
    </section>
  );
}

export default ClinicalTrialMap;
