const stringifyDetail = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(stringifyDetail).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([field, detail]) => {
        const message = stringifyDetail(detail);
        if (!message) {
          return "";
        }

        return field === "detail" || field === "non_field_errors"
          ? message
          : `${field}: ${message}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  return String(value);
};

export const formatApiError = (details, fallbackMessage = "") => {
  const message = stringifyDetail(details) || fallbackMessage;
  return message ? `:\n${message}` : "";
};

export const getApiErrorMessage = (details, fallbackMessage = "") =>
  stringifyDetail(details) || fallbackMessage;

export const getRequestErrorMessage = (error, fallbackMessage = "") => {
  const status = error?.response?.status;

  // A development proxy can return an empty 502 when the API is offline.
  // Treat gateway failures like network failures, not invalid form input.
  if ((!error?.response && error?.request) || [502, 503, 504].includes(status)) {
    return "Cannot reach the server. Please try again shortly.";
  }

  if (status >= 500) {
    return "The server encountered an error. Please try again shortly.";
  }

  return getApiErrorMessage(error?.response?.data, fallbackMessage);
};
