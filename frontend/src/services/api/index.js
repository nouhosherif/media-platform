import { apiConfig } from "./config.js";
import { createApiClient } from "./client.js";
import { createSessionStorage } from "./session.js";

export const session = createSessionStorage(window.localStorage);

const API = createApiClient({
  baseURL: apiConfig.baseURL,
  session,
  onSessionExpired: () => window.location.assign("/"),
});

export default API;
