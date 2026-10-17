export function distanceKm(from, to) {
  const coordinates = [from?.latitude, from?.longitude, to?.latitude, to?.longitude];
  if (coordinates.some((value) => value == null || !Number.isFinite(Number(value)))) return null;
  const [lat1, lon1, lat2, lon2] = coordinates.map((value) => (Number(value) * Math.PI) / 180);
  const a =
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}
