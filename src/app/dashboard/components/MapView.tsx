"use client";

import { useRef, useCallback, useEffect } from "react";
import Map, { MapMouseEvent, MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

type SelectedPlace = {
  name: string;
  lng: number;
  lat: number;
  photoUrl: string | null;
};

type Props = {
  onPlaceSelect: (place: SelectedPlace) => void;
  flyTo?: { lng: number; lat: number } | null;
};

export default function MapView({ onPlaceSelect, flyTo }: Props) {
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    mapRef.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: 12, duration: 2000 });
  }, [flyTo]);

  const handleClick = useCallback(
    async (e: MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      const res = await fetch(`/api/places?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      onPlaceSelect({ name: data.name, lng, lat, photoUrl: data.photoUrl });
    },
    [onPlaceSelect]
  );

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{ longitude: 0, latitude: 20, zoom: 2 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      onClick={handleClick}
      cursor="pointer"
    />
  );
}
