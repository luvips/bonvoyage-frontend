"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Header from "@/app/components/Header";
import DestinationCard from "./components/DestinationCard";

const MapView = dynamic(() => import("./components/MapView"), { ssr: false });

type SelectedPlace = {
  name: string;
  lng: number;
  lat: number;
  photoUrl: string | null;
};

export default function DashboardPage() {
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number } | null>(null);

  const handleSearch = useCallback(async (result: { name: string; lng: number; lat: number }) => {
    setFlyTo({ lng: result.lng, lat: result.lat });
    const res = await fetch(`/api/places?lat=${result.lat}&lng=${result.lng}`);
    const data = await res.json();
    setSelectedPlace({ name: data.name ?? result.name, lng: result.lng, lat: result.lat, photoUrl: data.photoUrl });
  }, []);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <Header variant="light" onSearch={handleSearch} />
      <div className="relative flex-1">
        <MapView onPlaceSelect={setSelectedPlace} flyTo={flyTo} />
        {selectedPlace && (
          <DestinationCard
            place={selectedPlace}
            onSave={() => setSelectedPlace(null)}
            onCancel={() => setSelectedPlace(null)}
          />
        )}
      </div>
    </div>
  );
}
