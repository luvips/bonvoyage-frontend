"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import TripHeader from "./components/TripHeader";
import TripNav from "./components/TripNav";
import FlightsSection from "./components/FlightsSection";
import HotelsSection from "./components/HotelsSection";
import PointsOfInterestSection from "./components/PointsOfInterestSection";
import RestaurantsSection from "./components/RestaurantsSection";
import ItinerarySection from "./components/ItinerarySection";
import type { ItineraryItem, TripItinerary, DayPlan } from "./types";

export type TripSection = "vuelos" | "hospedaje" | "puntos" | "restaurantes" | "itinerario";

const BACKEND = "https://bonvoyage-backend.vercel.app";

function TripPageContent() {
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const [activeSection, setActiveSection] = useState<TripSection>("vuelos");

  const tripId = searchParams.get("tripId");

  const destination = {
    name: searchParams.get("name") ?? "Destino",
    country: searchParams.get("country") ?? "",
    lat: parseFloat(searchParams.get("lat") ?? "0"),
    lng: parseFloat(searchParams.get("lng") ?? "0"),
    photoUrl: searchParams.get("photoUrl") ?? null,
  };

  // Pre-fill flight params passed from the wizard
  const wizardFlightParams = {
    origin: searchParams.get("origin") ?? "",
    startDate: searchParams.get("startDate") ?? "",
    endDate: searchParams.get("endDate") ?? "",
    passengers: parseInt(searchParams.get("passengers") ?? "1"),
    cabinClass: searchParams.get("cabinClass") ?? "economy",
  };

  const [itinerary, setItinerary] = useState<TripItinerary>({ tripId: tripId ?? "", days: [] });
  const [loadingTrip, setLoadingTrip] = useState(!!tripId);
  const [tripError, setTripError] = useState<string | null>(null);

  const loadTrip = useCallback(async () => {
    if (!tripId) return;
    setLoadingTrip(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/trips/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();

      // Map backend response to our DayPlan shape
      // Adjust field names here if the actual API differs
      const days: DayPlan[] = (data.days ?? []).map((d: {
        day_id: string;
        day_number: number;
        day_date?: string;
        date?: string;
        items?: Array<{
          item_id: string;
          place_id: string;
          item_type?: string;
          type?: string;
          item_name?: string;
          name?: string;
          address?: string;
          latitude?: number;
          lat?: number;
          longitude?: number;
          lng?: number;
          photo_url?: string;
          photoUrl?: string;
          rating?: number | null;
          price_level?: string | null;
          priceLevel?: string | null;
        }>;
      }) => ({
        dayId: d.day_id,
        dayNumber: d.day_number,
        date: d.day_date ?? d.date ?? "",
        items: (d.items ?? []).map((item) => ({
          itemId: item.item_id,
          id: item.place_id,
          type: (item.item_type ?? item.type ?? "poi") as "poi" | "restaurant",
          name: item.item_name ?? item.name ?? "",
          address: item.address ?? "",
          lat: item.latitude ?? item.lat ?? 0,
          lng: item.longitude ?? item.lng ?? 0,
          photoUrl: item.photo_url ?? item.photoUrl ?? null,
          rating: item.rating ?? null,
          priceLevel: item.price_level ?? item.priceLevel ?? null,
        })),
      }));

      setItinerary({ tripId, days });
    } catch (err: unknown) {
      setTripError(err instanceof Error ? err.message : "Error al cargar el viaje");
    } finally {
      setLoadingTrip(false);
    }
  }, [tripId, getToken]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  async function addToItinerary(item: ItineraryItem, dayNumber: number) {
    const day = itinerary.days.find((d) => d.dayNumber === dayNumber);
    if (!day) return;
    if (day.items.some((i) => i.id === item.id)) return; // already added

    try {
      const token = await getToken();
      const res = await fetch(
        `${BACKEND}/api/trips/${tripId}/days/${day.dayId}/items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            place_id: item.id,
            item_type: item.type,
            item_name: item.name,
            address: item.address,
            latitude: item.lat,
            longitude: item.lng,
            photo_url: item.photoUrl,
            rating: item.rating,
            price_level: item.priceLevel,
          }),
        }
      );
      if (!res.ok) return;
      const data = await res.json();
      const itemId = data.item_id ?? data.id ?? crypto.randomUUID();

      setItinerary((prev) => ({
        ...prev,
        days: prev.days.map((d) =>
          d.dayNumber === dayNumber
            ? { ...d, items: [...d.items, { ...item, itemId }] }
            : d
        ),
      }));
    } catch {
      // silent — item wasn't added
    }
  }

  async function removeFromItinerary(itemId: string, dayNumber: number) {
    const day = itinerary.days.find((d) => d.dayNumber === dayNumber);
    if (!day) return;

    try {
      const token = await getToken();
      await fetch(
        `${BACKEND}/api/trips/${tripId}/days/${day.dayId}/items/${itemId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch {
      // silent
    }

    // Optimistic remove regardless of API result
    setItinerary((prev) => ({
      ...prev,
      days: prev.days
        .map((d) =>
          d.dayNumber === dayNumber
            ? { ...d, items: d.items.filter((i) => i.itemId !== itemId) }
            : d
        )
        .filter((d) => d.items.length > 0),
    }));
  }

  const tripDays = itinerary.days.map((d) => ({
    dayId: d.dayId,
    dayNumber: d.dayNumber,
    date: d.date,
  }));

  const sectionComponents: Record<TripSection, React.ReactNode> = {
    vuelos: (
      <FlightsSection
        destination={destination}
        defaultOrigin={wizardFlightParams.origin}
        defaultDepartDate={wizardFlightParams.startDate}
        defaultReturnDate={wizardFlightParams.endDate}
        defaultPassengers={wizardFlightParams.passengers}
        defaultCabinClass={wizardFlightParams.cabinClass}
      />
    ),
    hospedaje: <HotelsSection destination={destination} tripId={tripId ?? ""} />,
    puntos: (
      <PointsOfInterestSection
        destination={destination}
        tripDays={tripDays}
        onAddToItinerary={addToItinerary}
      />
    ),
    restaurantes: (
      <RestaurantsSection
        destination={destination}
        tripDays={tripDays}
        onAddToItinerary={addToItinerary}
      />
    ),
    itinerario: (
      <ItinerarySection
        itinerary={itinerary}
        onRemove={removeFromItinerary}
      />
    ),
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <TripHeader />
      <TripNav active={activeSection} onChange={setActiveSection} />

      {/* Destination hero */}
      <div className="max-w-6xl mx-auto w-full px-4 pt-6">
        <div className="relative h-100 w-full overflow-hidden rounded-2xl bg-gray-800 shadow-md">
          {destination.photoUrl ? (
            <img
              src={destination.photoUrl}
              alt={destination.name}
              className="w-full h-full object-cover opacity-75"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-blue-600 to-blue-400" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-7">
            <h1 className="text-white text-5xl font-bold drop-shadow-lg leading-tight">
              {destination.name}
            </h1>
            {destination.country && (
              <p className="text-white/80 text-2xl font-medium mt-1 drop-shadow">
                {destination.country}
              </p>
            )}
            {loadingTrip && (
              <p className="text-white/60 text-sm mt-2">Cargando itinerario...</p>
            )}
            {tripError && (
              <p className="text-red-300 text-sm mt-2">{tripError}</p>
            )}
          </div>
        </div>
      </div>

      <main className="flex-1 w-full pt-0 pb-6">
        {sectionComponents[activeSection]}
      </main>
    </div>
  );
}

export default function TripPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">Cargando...</div>}>
      <TripPageContent />
    </Suspense>
  );
}
