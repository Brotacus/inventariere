const API_URL = "http://localhost:8000";


export async function getDevices() {
    const response = await fetch(`${API_URL}/devices/`);

    if (!response.ok) {
        throw new Error("Nu s-au putut încărca obiectele.");
    }

    return response.json();
}


export async function createDevice(device) {
    const response = await fetch(`${API_URL}/devices/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(device)
    });

    if (!response.ok) {
        throw new Error("Obiectul nu a putut fi adăugat.");
    }

    return response.json();
}
export async function deleteDevice(id) {
  const response = await fetch(`http://localhost:8000/devices/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Nu s-a putut șterge dispozitivul.");
  }
  return true;
}
