// Vite exposes these values to the browser. Never put secrets in VITE_* variables.
export const normalizeApiBaseURL = (value) => {
  const configuredURL = value?.trim();
  if (!configuredURL) return "/api/";
  const baseURL = configuredURL.replace(/\/+$/, "");
  return baseURL.endsWith("/api") ? `${baseURL}/` : `${baseURL}/api/`;
};

export const apiConfig = {
  baseURL: normalizeApiBaseURL(import.meta.env?.VITE_API_BASE_URL),
};
