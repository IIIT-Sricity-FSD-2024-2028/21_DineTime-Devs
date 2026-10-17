import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { image } from "../utils/images.js";

// Leaflet owns only the map canvas; React owns the selected location and fields.
export default function LocationMap({
  latitude = 12.9716,
  longitude = 77.5946,
  onChange,
  interactive = true,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const map = L.map(container, {
      scrollWheelZoom: false,
      dragging: interactive,
      zoomControl: interactive,
    }).setView([latitude, longitude], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    const icon = L.icon({
      iconUrl: image("map-marker-green.png"),
      shadowUrl: image("map-marker-shadow.png"),
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      shadowSize: [41, 41],
    });
    const marker = L.marker([latitude, longitude], {
      draggable: interactive,
      icon,
    }).addTo(map);
    mapRef.current = map;
    markerRef.current = marker;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [interactive]);

  // Rebind the latest form callback without rebuilding the map on each edit.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const update = (latlng) => {
      marker.setLatLng(latlng);
      onChange?.({ latitude: latlng.lat, longitude: latlng.lng });
    };
    const click = (event) => update(event.latlng);
    const drag = () => update(marker.getLatLng());
    if (interactive) map.on("click", click);
    marker.on("dragend", drag);
    return () => {
      map.off("click", click);
      marker.off("dragend", drag);
    };
  }, [onChange, interactive]);

  useEffect(() => {
    markerRef.current?.setLatLng([latitude, longitude]);
    mapRef.current?.panTo([latitude, longitude]);
  }, [latitude, longitude, interactive]);

  return (
    <div
      ref={containerRef}
      className="diner-location-map"
      aria-label="Select your location on the map"
    />
  );
}
