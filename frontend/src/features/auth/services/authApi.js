import API, { session } from "../../../services/api/index.js";

const authenticate = async (endpoint, payload) => {
  session.clear();
  const response = await API.post(endpoint, payload, { skipAuth: true });
  session.setTokens(response.data);
  return response;
};

export const login = (payload) => authenticate("users/login/", payload);
export const register = (payload) => authenticate("users/register/", payload);
