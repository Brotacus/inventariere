const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
const AUTH_STORAGE_KEY = "inventory-admin-session";

export function getAdminSessionToken() {
  return window.sessionStorage.getItem(AUTH_STORAGE_KEY) || "";
}

export function hasAdminSession() {
  return Boolean(getAdminSessionToken());
}

export function clearAdminSession() {
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

async function apiRequest(path, options = {}) {
  const { skipAuth = false, ...fetchOptions } = options;
  const isFormData = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
  const token = skipAuth ? "" : getAdminSessionToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && data.detail
        ? data.detail
        : "A apărut o eroare la comunicarea cu backend-ul.";

    if (response.status === 401 && !skipAuth && path !== "/auth/login") {
      clearAdminSession();
      window.dispatchEvent(new CustomEvent("inventory-auth-required"));
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function loginAdmin(password) {
  const result = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ password }),
    skipAuth: true,
  });
  window.sessionStorage.setItem(AUTH_STORAGE_KEY, result.token);
  return result;
}

export function getCurrentAdmin() {
  return apiRequest("/auth/me");
}

export async function logoutAdmin() {
  try {
    if (getAdminSessionToken()) {
      await apiRequest("/auth/logout", { method: "POST" });
    }
  } finally {
    clearAdminSession();
  }
}

export function mediaUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}


export function getPublicAsset(token) {
  return apiRequest(`/public/assets/${encodeURIComponent(token)}`, { skipAuth: true });
}

export function getDevicePublicAccess(deviceId, baseUrl = window.location.origin) {
  return apiRequest(`/devices/${deviceId}/public-access?base_url=${encodeURIComponent(baseUrl)}`);
}

export function createDevicePublicAccess(deviceId, baseUrl = window.location.origin) {
  return apiRequest(`/devices/${deviceId}/public-access`, {
    method: "POST",
    body: JSON.stringify({ base_url: baseUrl }),
  });
}

export function regenerateDevicePublicAccess(deviceId, baseUrl = window.location.origin) {
  return apiRequest(`/devices/${deviceId}/public-access/regenerate`, {
    method: "POST",
    body: JSON.stringify({ base_url: baseUrl }),
  });
}

export function revokeDevicePublicAccess(deviceId) {
  return apiRequest(`/devices/${deviceId}/public-access`, { method: "DELETE" });
}

export function getDevices() { return apiRequest("/devices/"); }
export function getDeviceTracking(deviceId) { return apiRequest(`/devices/${deviceId}/tracking`); }
export function createDevice(device) { return apiRequest("/devices/", { method: "POST", body: JSON.stringify(device) }); }
export function updateDevice(deviceId, device) { return apiRequest(`/devices/${deviceId}`, { method: "PUT", body: JSON.stringify(device) }); }
export function deleteDevice(deviceId) { return apiRequest(`/devices/${deviceId}`, { method: "DELETE" }); }

export function uploadDeviceImages(deviceId, files) {
  const form = new FormData();
  Array.from(files || []).forEach((file) => form.append("files", file));
  return apiRequest(`/devices/${deviceId}/images`, { method: "POST", body: form });
}

export function deleteDeviceImage(deviceId, imageId) {
  return apiRequest(`/devices/${deviceId}/images/${imageId}`, { method: "DELETE" });
}

export function getPeople(includeInactive = true) { return apiRequest(`/people/?include_inactive=${includeInactive}`); }
export function createPerson(person) { return apiRequest("/people/", { method: "POST", body: JSON.stringify(person) }); }
export function updatePerson(personId, person) { return apiRequest(`/people/${personId}`, { method: "PUT", body: JSON.stringify(person) }); }
export function deactivatePerson(personId) { return apiRequest(`/people/${personId}`, { method: "DELETE" }); }

export function getLocations(includeInactive = true) { return apiRequest(`/locations/?include_inactive=${includeInactive}`); }
export function createLocation(location) { return apiRequest("/locations/", { method: "POST", body: JSON.stringify(location) }); }
export function updateLocation(locationId, location) { return apiRequest(`/locations/${locationId}`, { method: "PUT", body: JSON.stringify(location) }); }
export function deleteLocation(locationId) { return apiRequest(`/locations/${locationId}`, { method: "DELETE" }); }

export function getLoans(status = "") {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest(`/loans/${query}`);
}
export function createLoan(loan) { return apiRequest("/loans/", { method: "POST", body: JSON.stringify(loan) }); }
export function returnLoan(loanId) { return apiRequest(`/loans/${loanId}/return`, { method: "POST" }); }

export function getLogs({ action = "", deviceId = "", limit = 200 } = {}) {
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (deviceId) params.set("device_id", deviceId);
  params.set("limit", String(limit));
  return apiRequest(`/logs/?${params.toString()}`);
}
export function getLogActions() { return apiRequest("/logs/actions"); }
export function getAdminDashboard() { return apiRequest("/admin/dashboard"); }


export function getJournal({ eventType = "", category = "", severity = "", deviceId = "", loanId = "", limit = 300 } = {}) {
  const params = new URLSearchParams();
  if (eventType) params.set("event_type", eventType);
  if (category) params.set("category", category);
  if (severity) params.set("severity", severity);
  if (deviceId) params.set("device_id", deviceId);
  if (loanId) params.set("loan_id", loanId);
  params.set("limit", String(limit));
  return apiRequest(`/journal/?${params.toString()}`);
}

export function getJournalEventTypes() { return apiRequest("/journal/event-types"); }

export function getNotifications({ unreadOnly = false, limit = 40 } = {}) {
  const params = new URLSearchParams({ unread_only: String(unreadOnly), limit: String(limit) });
  return apiRequest(`/notifications/?${params.toString()}`);
}

export function getUnreadNotificationCount() { return apiRequest("/notifications/unread-count"); }
export function markNotificationRead(notificationId) { return apiRequest(`/notifications/${notificationId}/read`, { method: "POST" }); }
export function markAllNotificationsRead() { return apiRequest("/notifications/read-all", { method: "POST" }); }

export function createBackup() { return apiRequest("/admin/backup", { method: "POST" }); }
export function clearApplicationData(code) {
  return apiRequest("/admin/clear-data", { method: "POST", body: JSON.stringify({ code }) });
}
