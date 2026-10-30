import { useEffect, useState } from "react";
import {
  Beaker,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { API_URLS } from "../config/api";
import "./css/SearchFilters.css";

const ENUMS_API_URL = API_URLS.enums;

export default function SearchFilters({
  filters,
  onChange,
  onSearch,
  onReset,
  loading,
}) {
  const [statusOptions, setStatusOptions] = useState([]);
  const [phaseOptions, setPhaseOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [countryOptions, setCountryOptions] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    async function fetchCountries() {
      try {
        const response = await fetch(API_URLS.countries, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.countries)) {
          throw new Error("Invalid response from the countries API");
        }

        setCountryOptions(result.countries);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Failed to load countries:", error);
        }
      }
    }
    async function fetchEnums() {
      try {
        setOptionsLoading(true);
        setOptionsError("");

        const response = await fetch(ENUMS_API_URL, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch enums: HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.data)) {
          throw new Error("Invalid response from the enums API");
        }

        const statusEnum = result.data.find((item) => item.type === "Status");

        const phaseEnum = result.data.find((item) => item.type === "Phase");

        if (!Array.isArray(statusEnum?.values)) {
          throw new Error("Status options were not found");
        }

        if (!Array.isArray(phaseEnum?.values)) {
          throw new Error("Phase options were not found");
        }

        setStatusOptions(statusEnum.values);
        setPhaseOptions(phaseEnum.values);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Error loading trial filter options:", error);
          setOptionsError("Could not load filter options. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setOptionsLoading(false);
        }
      }
    }
    fetchCountries();
    fetchEnums();

    return () => {
      controller.abort();
    };
  }, []);

  async function handleRetryOptions() {
    try {
      setOptionsLoading(true);
      setOptionsError("");

      const response = await fetch(ENUMS_API_URL);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !Array.isArray(result.data)) {
        throw new Error("Invalid response from the enums API");
      }

      const statusEnum = result.data.find((item) => item.type === "Status");

      const phaseEnum = result.data.find((item) => item.type === "Phase");

      if (
        !Array.isArray(statusEnum?.values) ||
        !Array.isArray(phaseEnum?.values)
      ) {
        throw new Error("Status or phase options were not found");
      }

      setStatusOptions(statusEnum.values);
      setPhaseOptions(phaseEnum.values);
    } catch (error) {
      console.error("Error retrying filter options:", error);
      setOptionsError("Could not load filter options. Please try again.");
    } finally {
      setOptionsLoading(false);
    }
  }

  return (
    <section className="search-filters" aria-labelledby="filter-title">
      <div className="search-filters__heading">
        <div className="search-filters__heading-main">
          <span className="search-filters__icon">
            <SlidersHorizontal size={18} />
          </span>

          <div>
            <h2 id="filter-title">Find clinical studies</h2>
            <p>Refine your search using study details and dates.</p>
          </div>
        </div>

        <button
          className="search-filters__reset"
          type="button"
          onClick={onReset}
          disabled={loading}
        >
          Reset filters
        </button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(event);
        }}
      >
        <div className="search-filters__grid">
          {/* Condition */}
          <label className="search-filters__field">
            <span>Condition or disease</span>

            <div className="search-filters__control">
              <Search size={17} />

              <input
                name="condition"
                value={filters.condition ?? ""}
                onChange={onChange}
                placeholder="e.g. Type 2 diabetes"
              />
            </div>
          </label>

          {/* Drug or intervention */}
          <label className="search-filters__field">
            <span>Drug or intervention</span>

            <div className="search-filters__control">
              <Beaker size={17} />

              <input
                name="drug"
                value={filters.drug ?? ""}
                onChange={onChange}
                placeholder="e.g. insulin"
              />
            </div>
          </label>
          {/* Country */}
          <label className="search-filters__field">
            <span>Country</span>

            <div className="search-filters__control">
              <input
                type="text"
                name="country"
                list="country-options"
                value={filters.country ?? ""}
                onChange={onChange}
                placeholder="Search a country..."
                autoComplete="off"
              />

              <datalist id="country-options">
                {countryOptions.map((country) => (
                  <option key={country} value={country} />
                ))}
              </datalist>
            </div>
          </label>
          {/* Dynamic recruitment status */}
          <label className="search-filters__field">
            <span>Recruitment status</span>

            <div className="search-filters__control search-filters__control--select">
              <select
                name="status"
                value={filters.status ?? ""}
                onChange={onChange}
                disabled={optionsLoading || loading}
              >
                <option value="">
                  {optionsLoading ? "Loading statuses..." : "All statuses"}
                </option>

                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.legacyValue || status.value}
                  </option>
                ))}
              </select>

              <ChevronDown size={16} />
            </div>
          </label>

          {/* Dynamic study phase */}
          <label className="search-filters__field">
            <span>Study phase</span>

            <div className="search-filters__control search-filters__control--select">
              <select
                name="phase"
                value={filters.phase || ""}
                onChange={onChange}
                disabled={optionsLoading || loading}
              >
                <option value="">
                  {optionsLoading ? "Loading phases..." : "All phases"}
                </option>

                {phaseOptions.map((phase) => (
                  <option key={phase.value} value={phase.value}>
                    {phase.legacyValue || phase.value}
                  </option>
                ))}
              </select>

              <ChevronDown size={16} />
            </div>
          </label>

          {/* Start year */}
          <label className="search-filters__field">
            <span>Start year</span>

            <div className="search-filters__control">
              <CalendarDays size={17} />

              <input
                type="number"
                name="startYear"
                min="1900"
                max="2100"
                value={filters.startYear ?? ""}
                onChange={onChange}
                placeholder="e.g. 2020"
              />
            </div>
          </label>

          {/* End year */}
          <label className="search-filters__field">
            <span>End year</span>

            <div className="search-filters__control">
              <CalendarDays size={17} />

              <input
                type="number"
                name="endYear"
                min="1900"
                max="2100"
                value={filters.endYear ?? ""}
                onChange={onChange}
                placeholder="e.g. 2025"
              />
            </div>
          </label>
        </div>

        {optionsError && (
          <div className="search-filters__status-error" role="alert">
            <span>{optionsError}</span>

            <button
              type="button"
              onClick={handleRetryOptions}
              disabled={optionsLoading}
            >
              {optionsLoading ? "Retrying..." : "Retry"}
            </button>
          </div>
        )}

        <div className="search-filters__footer">
          <p>
            <CircleHelp size={15} />
            Date ranges apply to study start dates.
          </p>

          <button
            className="search-filters__submit"
            type="submit"
            disabled={loading}
          >
            <Search size={17} />
            {loading ? "Searching..." : "Search studies"}
          </button>
        </div>
      </form>
    </section>
  );
}
