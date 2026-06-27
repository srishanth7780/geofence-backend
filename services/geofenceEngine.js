// Haversine formula — distance between two GPS coords in meters
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Point-in-polygon (ray casting) for polygon geofences
function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isInsideGeofence(lat, lng, geofence) {
  if (geofence.shape === 'circle') {
    const dist = haversineDistance(lat, lng, geofence.center_lat, geofence.center_lng);
    return dist <= geofence.radius_m;
  }
  if (geofence.shape === 'polygon' && geofence.polygon) {
    return pointInPolygon(lat, lng, geofence.polygon);
  }
  return false;
}

// Priority logic: large fleet vehicles get 'high', others 'medium'
function determinePriority(device, alertType) {
  if (device.type === 'vehicle' && alertType === 'EXIT') return 'high';
  if (device.type === 'personnel')                      return 'critical';
  return 'medium';
}

module.exports = { isInsideGeofence, determinePriority };