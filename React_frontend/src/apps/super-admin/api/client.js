export const API_BASE = "http://localhost:3000";
export const API_ROLE = "super_user";

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  requireBaseUrl() {
    if (!this.baseUrl) {
      throw new Error("VITE_API_BASE_URL is required in this app .env file.");
    }
  }

  async request(path, options = {}) {
    this.requireBaseUrl();
    const token = sessionStorage.getItem("super_access_token") || "";
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        role: API_ROLE,
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        Object.keys(sessionStorage)
          .filter((key) => key.startsWith("super_"))
          .forEach((key) => sessionStorage.removeItem(key));
      }
      let message = `Request failed (${response.status})`;
      try {
        const body = await response.json();
        message = Array.isArray(body.message) ? body.message.join(", ") : body.message || message;
      } catch (_error) {
        // Keep the HTTP status when the backend does not return JSON.
      }
      throw new Error(message);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
}

export const apiClient = new ApiClient(API_BASE);
export const requireApiBase = () => apiClient.requireBaseUrl();
export const apiRequest = (...args) => apiClient.request(...args);
