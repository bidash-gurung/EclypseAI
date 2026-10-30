const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("Missing VITE_API_BASE_URL in your .env file");
}

export const API_URLS = {
  trials: `${API_BASE_URL}/trials`,
  map: `${API_BASE_URL}/trials/map`,
  analytics: `${API_BASE_URL}/analytics`,
  aiSearch: `${API_BASE_URL}/ai/search`,
  enums: `${API_BASE_URL}/clinical-trials/studies/enums`,
  apiVersion: `${API_BASE_URL}/clinical-trials/version`,
  countries: `${API_BASE_URL}/clinical-trials/countries`,
};

export default API_URLS;
