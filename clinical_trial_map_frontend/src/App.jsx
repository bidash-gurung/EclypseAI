import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Map as MapIcon,
  Moon,
  PanelLeft,
  Sparkles,
  Sun,
} from "lucide-react";

import SearchFilters from "./components/SearchFilters";
import TrialsTable from "./components/TrialsTable";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import { formatDate, formatStatus } from "./components/trialFormatters";
import ClinicalTrialMap from "./components/ClinicalTrialMap";
import AIWorkspace from "./components/AIWorkspace";
import { userFacingError } from "./components/userFacingErrors";
import { API_URLS } from "./config/api";

import "./App.css";

const API_URL = API_URLS.trials;
const MAP_API_URL = API_URLS.map;
const ANALYTICS_URL = API_URLS.analytics;
const API_VERSION_URL = API_URLS.apiVersion;

const INITIAL_FILTERS = {
  condition: "",
  drug: "",
  status: "",
  startYear: "",
  endYear: "",
  phase: "",
};

function getInitialTheme() {
  if (typeof window === "undefined") return "light";

  try {
    const savedTheme = window.localStorage.getItem("clintrial-theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  } catch {
    // Continue with the operating system preference if storage is unavailable.
  }

  return "light";
}

const NAV_ITEMS = [
  {
    id: "trials",
    label: "Clinical Trials",
    icon: ClipboardList,
  },
  {
    id: "analytics",
    label: "Clinical Trial Analytics",
    icon: BarChart3,
  },
  {
    id: "map",
    label: "Clinical Trial Map",
    icon: MapIcon,
  },
  {
    id: "ai-workspace",
    label: "AI Workspace",
    icon: Sparkles,
  },
];

const DASHBOARD_ITEMS = NAV_ITEMS.filter((item) => item.id !== "ai-workspace");

function getInitialView() {
  if (typeof window === "undefined") return "trials";

  try {
    const savedView = window.sessionStorage.getItem("clintrial-active-view");
    return NAV_ITEMS.some((item) => item.id === savedView)
      ? savedView
      : "trials";
  } catch {
    return "trials";
  }
}

function getInitialNavigationMode() {
  if (typeof window === "undefined") return "workspace";

  try {
    return window.sessionStorage.getItem("clintrial-navigation-mode") ===
      "dashboard"
      ? "dashboard"
      : "workspace";
  } catch {
    return "workspace";
  }
}

function App() {
  const [activeView, setActiveView] = useState(getInitialView);
  const [navigationMode, setNavigationMode] = useState(
    getInitialNavigationMode,
  );
  const [theme, setTheme] = useState(getInitialTheme);
  const [showSplash, setShowSplash] = useState(true);
  const [apiVersion, setApiVersion] = useState("");
  const [yearRange, setYearRange] = useState(null);
  const [yearRangeLoading, setYearRangeLoading] = useState(true);
  const [yearRangeError, setYearRangeError] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.matchMedia("(min-width: 761px)").matches,
  );

  // Filters currently being edited in the search form.
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });

  // Filters last submitted by the user for the map.
  const [appliedMapFilters, setAppliedMapFilters] = useState({
    ...INITIAL_FILTERS,
  });

  // Clinical trials table state.
  const [trials, setTrials] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");
  const [selectedTrial, setSelectedTrial] = useState(null);

  // Analytics state.
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsView, setAnalyticsView] = useState("charts");

  const analyticsRequestId = useRef(0);
  const appliedAnalyticsFilters = useRef(null);

  // Aggregated map API state.
  const [mapData, setMapData] = useState({
    points: [],
    totalTrials: 0,
    totalLocations: 0,
    totalClusters: 0,
  });

  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState("");
  const mapRequestId = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    try {
      window.localStorage.setItem("clintrial-theme", theme);
    } catch {
      // The selected theme still works for this session if storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadApiVersion() {
      try {
        const response = await fetch(API_VERSION_URL, {
          signal: controller.signal,
        });
        const result = await response.json();

        if (response.ok && result.success && result.data?.apiVersion) {
          setApiVersion(result.data.apiVersion);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          // The app remains usable if version metadata is unavailable.
        }
      }
    }

    loadApiVersion();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadYearRange() {
      setYearRangeLoading(true);
      setYearRangeError("");
      try {
        const response = await fetch(API_URLS.yearRange, {
          signal: controller.signal,
        });
        const result = await response.json();
        const { minYear, maxYear } = result.data || {};
        if (!response.ok || !result.success || !Number.isInteger(minYear) || !Number.isInteger(maxYear) || minYear > maxYear) {
          throw new Error("Could not load the available study year range.");
        }
        setYearRange({ minYear, maxYear });
      } catch (err) {
        if (err.name !== "AbortError") {
          setYearRangeError("Year limits are temporarily unavailable. Please try again shortly.");
        }
      } finally {
        if (!controller.signal.aborted) setYearRangeLoading(false);
      }
    }

    loadYearRange();
    return () => controller.abort();
  }, []);

  // Load the initial table and analytics data.
  useEffect(() => {
    const initialFilters = { ...INITIAL_FILTERS };
    const startedAt = Date.now();
    let cancelled = false;
    let minimumDurationTimer;
    const maximumDurationTimer = window.setTimeout(
      () => setShowSplash(false),
      2000,
    );

    Promise.allSettled([
      fetchTrials("", initialFilters),
      fetchAnalytics(initialFilters),
    ]).then(() => {
      if (cancelled) return;
      window.clearTimeout(maximumDurationTimer);

      const remainingMinimumDuration = Math.max(
        0,
        2000 - (Date.now() - startedAt),
      );

      minimumDurationTimer = window.setTimeout(
        () => setShowSplash(false),
        remainingMinimumDuration,
      );
    });

    // Initial data and splash timing are intentionally started only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      cancelled = true;
      window.clearTimeout(maximumDurationTimer);
      window.clearTimeout(minimumDurationTimer);
    };
  }, []);

  function selectView(view) {
    setActiveView(view);

    try {
      window.sessionStorage.setItem("clintrial-active-view", view);
    } catch {
      // Keep navigation working if session storage is unavailable.
    }

    if (window.matchMedia("(max-width: 760px)").matches) {
      setSidebarOpen(false);
    }
  }

  function toggleNavigationMode() {
    const nextMode = navigationMode === "workspace" ? "dashboard" : "workspace";
    setNavigationMode(nextMode);

    try {
      window.sessionStorage.setItem("clintrial-navigation-mode", nextMode);
    } catch {
      // Keep the mode switch available if session storage is unavailable.
    }
  }

  function handleDashboardTabKeyDown(event, currentIndex) {
    let nextIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % DASHBOARD_ITEMS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + DASHBOARD_ITEMS.length) % DASHBOARD_ITEMS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = DASHBOARD_ITEMS.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextView = DASHBOARD_ITEMS[nextIndex].id;
    selectView(nextView);
    document.getElementById(`dashboard-tab-${nextView}`)?.focus();
  }

  // Load aggregated geographic data only when the map is active.
  // Changing form fields alone does not trigger a map request.
  useEffect(() => {
    if (activeView !== "map") return undefined;

    const requestId = ++mapRequestId.current;
    const controller = new AbortController();

    async function loadMapData() {
      setMapLoading(true);
      setMapError("");

      try {
        const params = new URLSearchParams();

        Object.entries(appliedMapFilters).forEach(([key, value]) => {
          if (typeof value === "string" && value.trim() !== "") {
            params.set(key, value.trim());
          }
        });

        const query = params.toString();
        const url = query ? `${MAP_API_URL}?${query}` : MAP_API_URL;

        const response = await fetch(url, {
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            userFacingError(data.message, "We couldn't load map data. Please try again."),
          );
        }

        if (requestId === mapRequestId.current) {
          setMapData({
            points: data.points || [],
            totalTrials: data.totalTrials || 0,
            totalLocations: data.totalLocations || 0,
            totalClusters: data.totalClusters ?? (data.points || []).length,
          });
        }
      } catch (err) {
        if (err.name !== "AbortError" && requestId === mapRequestId.current) {
          setMapError(userFacingError(err.message, "We couldn't load map data. Please try again."));
        }
      } finally {
        if (requestId === mapRequestId.current) {
          setMapLoading(false);
        }
      }
    }

    loadMapData();

    return () => {
      controller.abort();
      mapRequestId.current++;
    };
  }, [activeView, appliedMapFilters]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function fetchTrials(pageToken = "", appliedFilters = filters) {
    setLoading(true);
    setError("");
    setHasSearched(true);

    try {
      const params = new URLSearchParams();

      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (typeof value === "string" && value.trim() !== "") {
          params.set(key, value.trim());
        }
      });

      params.set("pageSize", "10");

      if (pageToken) {
        params.set("pageToken", pageToken);
      }

      const response = await fetch(`${API_URL}?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(userFacingError(data.message, "We couldn't load clinical studies. Please try again."));
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(userFacingError(data.message, "We couldn't load clinical studies. Please try again."));
      }

      setTrials(data.trials || []);
      setTotalCount(data.totalCount || 0);
      setNextPageToken(data.nextPageToken || null);
      setSelectedTrial(null);

      return data;
    } catch (err) {
      setError(userFacingError(err.message, "We couldn't load clinical studies. Please try again."));

      setTrials([]);
      setTotalCount(0);
      setNextPageToken(null);

      return null;
    } finally {
      setLoading(false);
    }
  }

  async function fetchAnalytics(appliedFilters) {
    const requestId = ++analyticsRequestId.current;

    const signature = JSON.stringify(
      Object.fromEntries(
        Object.entries(appliedFilters).map(([key, value]) => [
          key,
          typeof value === "string" ? value.trim() : value,
        ]),
      ),
    );

    if (signature !== appliedAnalyticsFilters.current) {
      setAnalyticsData(null);
    }

    appliedAnalyticsFilters.current = signature;
    setAnalyticsLoading(true);
    setAnalyticsError("");

    try {
      const params = new URLSearchParams();

      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (typeof value === "string" && value.trim() !== "") {
          params.set(key, value.trim());
        }
      });

      const query = params.toString();
      const url = query ? `${ANALYTICS_URL}?${query}` : ANALYTICS_URL;

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(userFacingError(result.message, "We couldn't load analytics. Please try again."));
      }

      if (requestId === analyticsRequestId.current) {
        setAnalyticsData(result);
      }
    } catch (err) {
      if (requestId === analyticsRequestId.current) {
        setAnalyticsError(userFacingError(err.message, "We couldn't load analytics. Please try again."));
      }
    } finally {
      if (requestId === analyticsRequestId.current) {
        setAnalyticsLoading(false);
      }
    }
  }

  function handleSearch(event) {
    event.preventDefault();

    const startYear = filters.startYear.trim();
    const endYear = filters.endYear.trim();

    if ((startYear || endYear) && yearRangeLoading) {
      setError("Year limits are still loading. Please try again in a moment.");
      return;
    }

    if ((startYear || endYear) && !yearRange) {
      setError(yearRangeError || "Year limits are temporarily unavailable. Please try again shortly.");
      return;
    }

    if (startYear && !/^\d{4}$/.test(startYear)) {
      setError("Enter the start year as a four-digit year.");
      return;
    }

    if (endYear && !/^\d{4}$/.test(endYear)) {
      setError("Enter the end year as a four-digit year.");
      return;
    }

    if (yearRange && [startYear, endYear].filter(Boolean).some((year) => Number(year) < yearRange.minYear || Number(year) > yearRange.maxYear)) {
      setError(`Enter a year between ${yearRange.minYear} and ${yearRange.maxYear}.`);
      return;
    }

    if (endYear && !startYear) {
      setError("Enter a start year when you specify an end year.");
      return;
    }

    if (
      startYear &&
      endYear &&
      Number(endYear) < Number(startYear)
    ) {
      setError(
        "The end year must be the same as or later than the start year.",
      );
      return;
    }

    const appliedFilters = { ...filters };

    setError("");

    // Update the filters used by the map.
    setAppliedMapFilters(appliedFilters);

    // Load the first page of table results.
    fetchTrials("", appliedFilters);

    // Load analytics independently.
    fetchAnalytics(appliedFilters);
  }

  function resetFilters() {
    const reset = { ...INITIAL_FILTERS };

    setFilters(reset);
    setAppliedMapFilters(reset);
    setError("");
  }

  const activeNavItem = NAV_ITEMS.find((item) => item.id === activeView);

  return (
    <div
      data-theme={theme}
      className={`dashboard ${
        sidebarOpen ? "sidebar-open" : "sidebar-collapsed"
      }`}
    >
      <aside className="sidebar" id="primary-navigation">
        <a
          className="brand"
          href="#trials"
          aria-label="ClinTrial home"
          onClick={(event) => {
            event.preventDefault();
            selectView("trials");
          }}
        >
          <span className="brand-mark">
            <img
              className="brand-mark__image"
              src="/favicon.svg"
              alt=""
              aria-hidden="true"
            />
          </span>

          <span className="brand-copy">
            <strong>ClinTrial</strong>
            <small>RESEARCH INTELLIGENCE</small>
          </span>
        </a>

        <div className="sidebar-nav-heading">
          <span className="sidebar-label">
            {navigationMode === "workspace" ? "WORKSPACE" : "DASHBOARD"}
          </span>
          <button
            className="nav-mode-toggle"
            type="button"
            aria-pressed={navigationMode === "dashboard"}
            aria-label={`Switch to ${navigationMode === "workspace" ? "Dashboard" : "Workspace"} navigation`}
            title={`Switch to ${navigationMode === "workspace" ? "Dashboard" : "Workspace"} navigation`}
            onClick={toggleNavigationMode}
          >
            {navigationMode === "workspace" ? (
              <LayoutDashboard size={15} />
            ) : (
              <PanelLeft size={15} />
            )}
            <span>
              {navigationMode === "workspace"
                ? "Group views"
                : "Separate views"}
            </span>
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigationMode === "workspace" ? (
            NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item ${isActive ? "active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => selectView(item.id)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })
          ) : (
            <>
              <button
                type="button"
                className={`nav-item ${activeView !== "ai-workspace" ? "active" : ""}`}
                aria-current={activeView !== "ai-workspace" ? "page" : undefined}
                onClick={() => selectView("trials")}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </button>
              {NAV_ITEMS.filter((item) => item.id === "ai-workspace").map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${isActive ? "active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => selectView(item.id)}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </>
          )}
        </nav>

        {/* <div className="sidebar-label explore-label">EXPLORE</div>

        <div className="sidebar-feature">
          <div className="feature-icon">
            <Sparkles size={17} />
          </div>

          <div>
            <strong>Research insights</strong>
            <p>Explore study trends and global research activity.</p>
          </div>
        </div> */}

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <CircleHelp size={17} />
            <div className="sidebar-help__copy">
              <span>ClinicalTrials.gov data</span>
              {apiVersion && <small>API v{apiVersion}</small>}
            </div>
          </div>

          {/* <div className="profile">
            <div className="avatar">TS</div>

            <div className="profile-copy">
              <strong>Research workspace</strong>
              <small>Clinical data explorer</small>
            </div>

            <ChevronDown size={16} className="profile-chevron" />
          </div> */}
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-leading">
            <button
              className="menu-toggle"
              type="button"
              aria-controls="primary-navigation"
              aria-expanded={sidebarOpen}
              aria-label={
                sidebarOpen ? "Hide navigation menu" : "Show navigation menu"
              }
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <Menu size={21} strokeWidth={2} />
            </button>

            <div className="breadcrumbs">
              Workspace
              <ChevronRight size={14} />
              <span>{activeNavItem?.label || "Clinical Trial Analytics"}</span>
            </div>
          </div>

          <div className="topbar-right">
            <button
              className="theme-toggle"
              type="button"
              aria-pressed={theme === "dark"}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              onClick={() =>
                setTheme((currentTheme) =>
                  currentTheme === "dark" ? "light" : "dark",
                )
              }
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              <span className="sr-only">
                {theme === "dark" ? "Use light theme" : "Use dark theme"}
              </span>
            </button>
          </div>
        </header>

        <div className="page-content">
          {activeView !== "ai-workspace" && (
            <SearchFilters
              filters={filters}
              onChange={handleChange}
              onSearch={handleSearch}
              onReset={resetFilters}
              loading={loading || analyticsLoading || mapLoading}
              yearRange={yearRange}
              yearRangeLoading={yearRangeLoading}
              yearRangeError={yearRangeError}
            />
          )}

          {navigationMode === "dashboard" && (
            <nav
              className="dashboard-tabs"
              aria-label="Dashboard sections"
              role="tablist"
            >
              {DASHBOARD_ITEMS.map((item, index) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;

                return (
                  <button
                    key={item.id}
                    id={`dashboard-tab-${item.id}`}
                    className={`dashboard-tab ${isActive ? "active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls="dashboard-view-panel"
                    tabIndex={isActive ? 0 : -1}
                    onKeyDown={(event) =>
                      handleDashboardTabKeyDown(event, index)
                    }
                    onClick={() => selectView(item.id)}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          <div
            className={
              navigationMode === "dashboard"
                ? "dashboard-view-panel"
                : undefined
            }
            id="dashboard-view-panel"
            role={
              navigationMode === "dashboard" && activeView !== "ai-workspace"
                ? "tabpanel"
                : undefined
            }
            aria-labelledby={
              navigationMode === "dashboard" && activeView !== "ai-workspace"
                ? `dashboard-tab-${activeView}`
                : undefined
            }
            tabIndex={
              navigationMode === "dashboard" && activeView !== "ai-workspace"
                ? 0
                : undefined
            }
          >
            {error && activeView !== "trials" && activeView !== "ai-workspace" && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}

            <AIWorkspace
              isActive={activeView === "ai-workspace"}
              onSelectTrial={setSelectedTrial}

            />

            {activeView === "analytics" && (
              <AnalyticsDashboard
                data={analyticsData}
                loading={analyticsLoading}
                error={analyticsError}
                view={analyticsView}
                onViewChange={setAnalyticsView}
                filters={filters}
              />
            )}

            {activeView === "trials" && (
              <TrialsTable
                error={error}
                loading={loading}
                hasSearched={hasSearched}
                trials={trials}
                totalCount={totalCount}
                nextPageToken={nextPageToken}
                onNextPage={() => fetchTrials(nextPageToken, appliedMapFilters)}
                onSelectTrial={setSelectedTrial}
              />
            )}

            {activeView === "map" && (
              <ClinicalTrialMap
                mapData={mapData}
                trials={[]}
                onSelectTrial={setSelectedTrial}
                loading={mapLoading}
                error={mapError}
                clusterDetailsUrl={`${API_URLS.map}/cluster-details`}
                filters={appliedMapFilters}
              />
            )}
          </div>

          <footer className="page-footer">
            <span>
              <Activity size={14} />
              ClinTrial Research Workspace
            </span>

            <span>Data source: ClinicalTrials.gov API v2</span>
          </footer>
        </div>
      </main>

      {selectedTrial && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedTrial(null);
            }
          }}
        >
          <section
            className="detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
          >
            <div className="modal-header">
              <div>
                <span className="study-id">{selectedTrial.nctId}</span>
                <h2 id="detail-title">Study details</h2>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedTrial(null)}
                aria-label="Close study details"
              >
                {"\u00D7"}
              </button>
            </div>

            <h3 className="modal-study-title">{selectedTrial.title}</h3>

            <div className="detail-grid">
              <div>
                <span>Status</span>
                <strong>{formatStatus(selectedTrial.status)}</strong>
              </div>

              <div>
                <span>Study type</span>
                <strong>{selectedTrial.studyType || "Not reported"}</strong>
              </div>

              <div>
                <span>Start date</span>
                <strong>{formatDate(selectedTrial.startDate)}</strong>
              </div>

              <div>
                <span>Completion date</span>
                <strong>{formatDate(selectedTrial.completionDate)}</strong>
              </div>

              <div>
                <span>Phases</span>
                <strong>
                  {selectedTrial.phases?.join(", ") || "Not applicable"}
                </strong>
              </div>

              <div>
                <span>Sponsor</span>
                <strong>{selectedTrial.sponsor || "Not reported"}</strong>
              </div>
            </div>

            <div className="modal-section">
              <h4>Conditions</h4>

              <div className="tags">
                {(selectedTrial.conditions || []).map((condition) => (
                  <span className="tag" key={condition}>
                    {condition}
                  </span>
                ))}

                {!selectedTrial.conditions?.length && (
                  <span className="muted-cell">No conditions reported</span>
                )}
              </div>
            </div>

            <div className="modal-section">
              <h4>Interventions</h4>

              {(selectedTrial.interventions || []).length ? (
                <ul className="detail-list">
                  {selectedTrial.interventions.map((item, index) => (
                    <li key={`${item.name}-${index}`}>
                      <strong>{item.name}</strong>
                      <span>{item.type || "Type not reported"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="modal-muted">No interventions reported.</p>
              )}
            </div>

            <div className="modal-section">
              <h4>Study locations</h4>

              {(selectedTrial.locations || []).length ? (
                <ul className="detail-list">
                  {selectedTrial.locations.map((item, index) => (
                    <li key={`${item.facility}-${index}`}>
                      <strong>
                        {item.facility || "Facility not reported"}
                      </strong>

                      <span>
                        {[item.city, item.state, item.country]
                          .filter(Boolean)
                          .join(", ") || "Location details unavailable"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="modal-muted">No locations reported.</p>
              )}
            </div>

            <a
              className="external-link"
              href={`https://clinicaltrials.gov/study/${encodeURIComponent(
                selectedTrial.nctId,
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              View official study record
              <ArrowUpRight size={16} />
            </a>
          </section>
        </div>
      )}

      {showSplash && (
        <div
          className="startup-splash"
          role="status"
          aria-live="polite"
          aria-label="Loading ClinTrial"
        >
          <div className="startup-splash__content">
            <div className="startup-splash__mark">
              <img src="/favicon.svg" alt="" aria-hidden="true" />
            </div>
            <span className="startup-splash__eyebrow">
              CLINICAL RESEARCH INTELLIGENCE
            </span>
            <h1>ClinTrial</h1>
            <p>Preparing your research workspace</p>
            <span className="startup-splash__loader" aria-hidden="true" />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
