const trimTrailingSlashes = (value) => String(value || "").replace(/\/+$/, "");

export const CHAT_API_BASE = trimTrailingSlashes(
  import.meta.env.VITE_MCP_API_URL || ""
);

export const CHAT_API_PATH = import.meta.env.VITE_MCP_CHAT_PATH || "/chat";

export const BUILDING_API_BASE = trimTrailingSlashes(
  import.meta.env.VITE_BUILDING_API_BASE || ""
);

export const POWER_API_BASE = trimTrailingSlashes(
  import.meta.env.VITE_POWER_API_BASE || ""
);

export function buildApiUrl(base, path) {
  const cleanPath = `/${String(path || "").replace(/^\/+/, "")}`;
  if (!base) return cleanPath;
  return `${base}${cleanPath}`;
}
