// Data files from the app's own origin (offline, from the service worker's cache). A missing file is null.

export async function loadJson(name) {
  try {
    const response = await fetch(`data/${name}.json`);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
