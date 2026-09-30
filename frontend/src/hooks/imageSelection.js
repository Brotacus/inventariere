export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
const allowedTypes = new Set(IMAGE_ACCEPT.split(","));
const maxBytes = 8 * 1024 * 1024;

export function validateImages(files, availableSlots = 10) {
  const accepted = [];
  let invalidType = false;
  let invalidSize = false;
  let tooMany = false;
  for (const file of files) {
    if (!allowedTypes.has(file.type)) { invalidType = true; continue; }
    if (file.size <= 0 || file.size > maxBytes) { invalidSize = true; continue; }
    if (accepted.length >= availableSlots) { tooMany = true; continue; }
    accepted.push(file);
  }
  const errors = [];
  if (invalidType) errors.push("Sunt acceptate numai fotografii PNG, JPG sau WEBP.");
  if (invalidSize) errors.push("Fiecare fotografie trebuie să aibă între 1 octet și 8 MB.");
  if (tooMany) errors.push("Poți încărca maximum 10 fotografii într-o singură operație.");
  return { files: accepted, error: errors.join(" ") };
}
