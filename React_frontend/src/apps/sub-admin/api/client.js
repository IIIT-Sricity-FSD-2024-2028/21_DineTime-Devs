import { API_BASE } from "../../../store/api/baseQuery.js";
export { API_BASE };
export function assetUrl(url) {
  if (!url) return url;
  return url.startsWith("/uploads/") ? `${API_BASE}${url}` : url;
}
