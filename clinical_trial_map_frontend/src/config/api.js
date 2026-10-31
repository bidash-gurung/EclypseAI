// Keep the app renderable when deployment configuration is missing. Requests
// will fail through the normal UI paths, which can show a helpful message.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export const API_URLS = {
  trials: `${API_BASE_URL}/trials`,
  map: `${API_BASE_URL}/trials/map`,
  analytics: `${API_BASE_URL}/analytics`,
  aiSearch: `${API_BASE_URL}/ai/search`,
  enums: `${API_BASE_URL}/clinical-trials/studies/enums`,
  apiVersion: `${API_BASE_URL}/clinical-trials/version`,
  yearRange: `${API_BASE_URL}/clinical-trials/year-range`,
  countries: `${API_BASE_URL}/clinical-trials/countries`,
};

export default API_URLS;
