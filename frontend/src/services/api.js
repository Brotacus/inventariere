const API_URL = "http://localhost:8000";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
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
    throw new Error(message);
  }

  return data;
}

export function getDevices() {
  return apiRequest("/devices/");
}

export function createDevice(device) {
  return apiRequest("/devices/", {
    method: "POST",
    body: JSON.stringify(device),
  });
}

export function updateDevice(deviceId, device) {
  return apiRequest(`/devices/${deviceId}`, {
    method: "PUT",
    body: JSON.stringify(device),
  });
}

export function deleteDevice(deviceId) {
  return apiRequest(`/devices/${deviceId}`, {
    method: "DELETE",
  });
}

export function getPeople(includeInactive = true) {
  return apiRequest(`/people/?include_inactive=${includeInactive}`);
}

export function createPerson(person) {
  return apiRequest("/people/", {
    method: "POST",
    body: JSON.stringify(person),
  });
}

export function updatePerson(personId, person) {
  return apiRequest(`/people/${personId}`, {
    method: "PUT",
    body: JSON.stringify(person),
  });
}

export function deactivatePerson(personId) {
  return apiRequest(`/people/${personId}`, {
    method: "DELETE",
  });
}

export function getLocations() {
  return apiRequest("/locations/");
}

export function createLocation(location) {
  return apiRequest("/locations/", {
    method: "POST",
    body: JSON.stringify(location),
  });
}

export function updateLocation(locationId, location) {
  return apiRequest(`/locations/${locationId}`, {
    method: "PUT",
    body: JSON.stringify(location),
  });
}

export function deleteLocation(locationId) {
  return apiRequest(`/locations/${locationId}`, {
    method: "DELETE",
  });
}

export function getLoans(status = "") {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest(`/loans/${query}`);
}

export function createLoan(loan) {
  return apiRequest("/loans/", {
    method: "POST",
    body: JSON.stringify(loan),
  });
}

export function returnLoan(loanId) {
  return apiRequest(`/loans/${loanId}/return`, {
    method: "POST",
  });
}

export function getLogs({ action = "", deviceId = "", limit = 200 } = {}) {
  const params = new URLSearchParams();

  if (action) params.set("action", action);
  if (deviceId) params.set("device_id", deviceId);
  params.set("limit", String(limit));

  return apiRequest(`/logs/?${params.toString()}`);
}

export function getLogActions() {
  return apiRequest("/logs/actions");
}

export function getAdminDashboard() {
  return apiRequest("/admin/dashboard");
}
