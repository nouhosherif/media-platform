import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000/api/",
});

// attach token automatically
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthRequest =
      originalRequest?.url?.includes("/users/login/") ||
      originalRequest?.url?.includes("/users/register/") ||
      originalRequest?.url?.includes("/users/token/refresh/");

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;

      const refresh = localStorage.getItem("refreshToken");
      if (refresh) {
        try {
          const res = await axios.post(`${API.defaults.baseURL}users/token/refresh/`, {
            refresh,
          });
          localStorage.setItem("token", res.data.access);
          originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
          return API(originalRequest);
        } catch (refreshError) {
          console.error(refreshError);
        }
      }

      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      window.location.href = "/";
    }

    return Promise.reject(error);
  }
);

export default API;
