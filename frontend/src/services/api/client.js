import axios from "axios";

const AUTH_FREE_PATHS = ["/users/login/", "/users/register/", "/users/token/refresh/"];

export const isAuthFreeRequest = (config = {}) => {
  if (config.skipAuth) return true;
  const pathname = String(config.url || "").split(/[?#]/)[0];
  return AUTH_FREE_PATHS.some((path) => `/${pathname.replace(/^\/+/, "")}`.endsWith(path));
};

// A factory keeps transport/session behavior testable without a browser or server.
export const createApiClient = ({ baseURL, session, onSessionExpired, adapter, refreshAdapter }) => {
  const client = axios.create({ baseURL, ...(adapter && { adapter }) });
  const refreshClient = axios.create({ baseURL, ...(refreshAdapter && { adapter: refreshAdapter }) });
  let refreshPromise = null;
  let refreshFor = null;
  let expirationNotified = false;

  const expireSession = (expectedRefresh) => {
    if (session.getRefresh() !== expectedRefresh) return;
    session.clear();
    if (!expirationNotified) {
      expirationNotified = true;
      onSessionExpired?.();
    }
  };

  client.interceptors.request.use((request) => {
    if (isAuthFreeRequest(request)) {
      request.headers.delete("Authorization");
    } else {
      const access = session.getAccess();
      if (access) {
        expirationNotified = false;
        request.headers.set("Authorization", `Bearer ${access}`);
      } else {
        request.headers.delete("Authorization");
      }
    }
    return request;
  });

  client.interceptors.response.use((response) => response, async (error) => {
    const request = error.config;
    if (error.response?.status !== 401 || !request || isAuthFreeRequest(request)) {
      throw error;
    }
    const refresh = session.getRefresh();
    if (request._retry) {
      expireSession(refresh);
      throw error;
    }
    request._retry = true;

    // A slower response may belong to the token that another request already refreshed.
    const latestAccess = session.getAccess();
    if (latestAccess && request.headers.get("Authorization") !== `Bearer ${latestAccess}`) {
      return client(request);
    }
    if (!refresh) {
      expireSession(refresh);
      throw error;
    }

    if (!refreshPromise || refreshFor !== refresh) {
      refreshFor = refresh;
      const pending = refreshClient.post("users/token/refresh/", { refresh }).then(({ data }) => {
        if (session.getRefresh() !== refresh) {
          throw new axios.CanceledError("Session changed during token refresh.");
        }
        if (!data.access) throw new Error("Refresh response did not include an access token.");
        session.setTokens(data);
        return data.access;
      });
      refreshPromise = pending;
      // Clear only the flight we started, including failures, without an unhandled finally promise.
      pending.then(
        () => { if (refreshPromise === pending) refreshPromise = null; },
        () => { if (refreshPromise === pending) refreshPromise = null; },
      );
    }

    try {
      await refreshPromise;
    } catch (refreshError) {
      if ([400, 401, 403].includes(refreshError.response?.status)) expireSession(refresh);
      // A network outage must not silently discard a valid refresh token.
      throw refreshError;
    }
    return client(request);
  });

  return client;
};
