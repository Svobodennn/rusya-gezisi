// Web Mercator, the same one the map build uses (tools/build_maps.py), so pins land where the geometry was drawn.

export function mercatorY(lat) {
  return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI);
}

export function project(lat, lon, { lon0, lat0, k }) {
  return { x: (lon - lon0) * k, y: (mercatorY(lat0) - mercatorY(lat)) * k };
}
