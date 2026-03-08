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

  const tripId = searchParams.get("tripId");

  const [activeSection, setActiveSection] = useState<TripSection>(() => {
    if (!tripId) return "vuelos";
    try {
      const saved = sessionStorage.getItem(`bonvoyage_tab_${tripId}`);
      if (saved && ["vuelos","hospedaje","puntos","restaurantes","itinerario"].includes(saved))
        return saved as TripSection;
    } catch { /* ignore */ }
    return "vuelos";
  });

  function handleSectionChange(section: TripSection) {
    setActiveSection(section);
    if (tripId) {
      try { sessionStorage.setItem(`bonvoyage_tab_${tripId}`, section); } catch { /* ignore */ }
    }
  }

  const [itinerary, setItinerary] = useState<TripItinerary>({ tripId: tripId ?? "", days: [] });
  const [savedHotel, setSavedHotel] = useState<{ name: string; imageUrl: string | null; price: string; externalId?: string } | null>(null);
  const [savedFlight, setSavedFlight] = useState<{ airline: string; origin: string | null; destination: string | null; departure: string | null; price: number | null } | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(!!tripId);
  const [tripError, setTripError] = useState<string | null>(null);
  const [tripMeta, setTripMeta] = useState<{
    startDate: string;
    endDate: string;
    photoUrl: string | null;
    lat: number | null;
    lng: number | null;
    country: string | null;
  } | null>(null);

  const urlLat = parseFloat(searchParams.get("lat") ?? "NaN");
  const urlLng = parseFloat(searchParams.get("lng") ?? "NaN");

  const destination = {
    name: searchParams.get("name") ?? "Destino",
    country: searchParams.get("country") ?? tripMeta?.country ?? "",
    lat: (!isNaN(urlLat) ? urlLat : null) ?? tripMeta?.lat ?? 0,
    lng: (!isNaN(urlLng) ? urlLng : null) ?? tripMeta?.lng ?? 0,
    photoUrl: searchParams.get("photoUrl") ?? tripMeta?.photoUrl ?? null,
  };

  // Pre-fill flight params passed from the wizard (or loaded from backend)
  const wizardFlightParams = {
    origin: searchParams.get("origin") ?? "",
    startDate: searchParams.get("startDate") ?? tripMeta?.startDate ?? "",
    endDate: searchParams.get("endDate") ?? tripMeta?.endDate ?? "",
    passengers: parseInt(searchParams.get("passengers") ?? "1"),
    cabinClass: searchParams.get("cabinClass") ?? "economy",
  };

  const loadTrip = useCallback(async () => {
    if (!tripId) return;
    setLoadingTrip(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/trips/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      const data = json.data ?? json;

      // Map backend response to our DayPlan shape
      const days: DayPlan[] = (data.days ?? []).map((d: {
        day_id: string;
        day_number: number;
        day_date?: string;
        date?: string;
        items?: Array<{
          item_id: string;
          item_type?: string;
          place_reference_id?: string | null;
          flight_reference_id?: string | null;
          // enriched place fields (from place_references JOIN)
          place_name?: string | null;
          place_address?: string | null;
          place_latitude?: number | null;
          place_longitude?: number | null;
          place_photo_url?: string | null;
          place_category?: string | null;
          place_rating?: number | null;
          place_price_level?: string | null;
          place_external_id?: string | null;
          estimated_cost?: number | null;
          notes?: string | null;
          // enriched flight fields (from flight_references JOIN)
          flight_airline_code?: string | null;
          flight_origin_airport?: string | null;
          flight_destination_airport?: string | null;
          flight_departure_time?: string | null;
          flight_price?: number | null;
        } | null>;
      }) => ({
        dayId: d.day_id,
        dayNumber: d.day_number,
        date: d.day_date?.slice(0, 10) ?? d.date?.slice(0, 10) ?? "",
        items: (d.items ?? [])
          .filter((item): item is NonNullable<typeof item> => !!item?.item_id && (item.item_type === "PLACE" || item.item_type === "FLIGHT"))
          .map((item) => {
            if (item.item_type === "FLIGHT") {
              const origin = item.flight_origin_airport ?? "";
              const dest   = item.flight_destination_airport ?? "";
              return {
                itemId: item.item_id,
                id: item.flight_reference_id ?? item.item_id,
                type: "flight" as const,
                name: item.flight_airline_code ?? "Vuelo",
                address: origin && dest ? `${origin} → ${dest}` : "",
                lat: 0,
                lng: 0,
                photoUrl: null,
                rating: null,
                priceLevel: null,
              };
            }
            return {
              itemId: item.item_id,
              id: item.place_external_id ?? item.place_reference_id ?? item.item_id,
              type: (
                item.place_category === "HOTEL" ? "hotel"
                : item.place_category === "RESTAURANT" ? "restaurant"
                : "poi"
              ) as "poi" | "restaurant" | "hotel",
              name: item.place_name ?? "",
              address: item.place_address ?? "",
              lat: item.place_latitude ?? 0,
              lng: item.place_longitude ?? 0,
              photoUrl: item.place_photo_url ?? null,
              rating: item.place_rating ?? null,
              priceLevel: item.place_price_level ?? null,
            };
          }),
      }));

      setItinerary({ tripId, days });

      // Restore "Mis ubicaciones" from persisted items
      let hotelFound = false;
      let flightFound = false;
      for (const d of (data.days ?? [])) {
        for (const item of (d.items ?? [])) {
          if (!item) continue;
          if (!hotelFound && item.item_type === "PLACE" && item.place_category === "HOTEL" && item.place_name) {
            hotelFound = true;
            setSavedHotel({
              name: item.place_name,
              imageUrl: item.place_photo_url ?? null,
              price: item.estimated_cost ? `$${item.estimated_cost}` : "",
              externalId: item.place_external_id ?? undefined,
            });
          }
          if (!flightFound && item.item_type === "FLIGHT" && item.flight_airline_code) {
            flightFound = true;
            setSavedFlight({
              airline: item.flight_airline_code,
              origin: item.flight_origin_airport ?? null,
              destination: item.flight_destination_airport ?? null,
              departure: item.flight_departure_time ?? null,
              price: item.flight_price ?? item.estimated_cost ?? null,
            });
          }
        }
      }

      // Store trip-level metadata to fill in missing URL params
      setTripMeta({
        startDate: data.start_date?.slice(0, 10) ?? "",
        endDate: data.end_date?.slice(0, 10) ?? "",
        photoUrl: data.destination_image ?? null,
        lat: data.destination_lat ?? data.latitude ?? null,
        lng: data.destination_lng ?? data.longitude ?? null,
        country: data.destination_country ?? data.country ?? null,
      });
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
    if (day?.items.some((i) => i.id === item.id)) return; // already added

    // Optimistic update — create a placeholder day if the trip hasn't loaded yet
    const tempId = crypto.randomUUID();
    setItinerary((prev) => {
      const existing = prev.days.find((d) => d.dayNumber === dayNumber);
      if (existing) {
        return {
          ...prev,
          days: prev.days.map((d) =>
            d.dayNumber === dayNumber
              ? { ...d, items: [...d.items, { ...item, itemId: tempId }] }
              : d
          ),
        };
      }
      // Trip not loaded yet — add a placeholder day so the UI still shows the item
      return {
        ...prev,
        days: [
          ...prev.days,
          { dayId: `placeholder-${dayNumber}`, dayNumber, date: "", items: [{ ...item, itemId: tempId }] },
        ].sort((a, b) => a.dayNumber - b.dayNumber),
      };
    });

    try {
      const token = await getToken();

      const categoryMap: Record<string, string> = {
        poi: "POI",
        restaurant: "RESTAURANT",
        hotel: "HOTEL",
      };

      // 1. Save/upsert place reference → get reference_id
      const saveRes = await fetch(`${BACKEND}/api/places/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          external_id: item.id,
          category: categoryMap[item.type] ?? "POI",
          name: item.name,
          latitude: item.lat,
          longitude: item.lng,
          rating: item.rating ?? null,
          photo_url: item.photoUrl ?? null,
          address: item.address ?? null,
          price_level: item.priceLevel ?? null,
        }),
      });
      if (!saveRes.ok) return; // keep optimistic item shown

      const { reference_id } = await saveRes.json();

      // 2. Add item to the itinerary day (skip if day has no real backend ID)
      if (!day?.dayId || day.dayId.startsWith("placeholder-")) return;
      await fetch(`${BACKEND}/api/trips/${tripId}/days/${day.dayId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_type: "PLACE", place_reference_id: reference_id }),
      });
    } catch {
      // silent — optimistic item stays visible
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

    // Optimistic remove — keep days even when they have 0 items
    setItinerary((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.dayNumber === dayNumber
          ? { ...d, items: d.items.filter((i) => i.itemId !== itemId) }
          : d
      ),
    }));
  }

  // Build tripDays: always use the full wizard date range so the day picker never collapses
  // after an optimistic add. When backend days are loaded we prefer their real dayIds.
  const tripDays: { dayId: string; dayNumber: number; date: string }[] = (() => {
    const start = wizardFlightParams.startDate ? new Date(wizardFlightParams.startDate) : null;
    const end = wizardFlightParams.endDate ? new Date(wizardFlightParams.endDate) : null;
    if (start && end && start <= end) {
      const days: { dayId: string; dayNumber: number; date: string }[] = [];
      const cur = new Date(start);
      let n = 1;
      while (cur <= end && n <= 30) {
        const dateStr = cur.toISOString().split("T")[0];
        // Prefer a real (non-placeholder) backend dayId for this day number
        const backendDay = itinerary.days.find(
          (d) => d.dayNumber === n && !d.dayId.startsWith("placeholder-")
        );
        days.push({
          dayId: backendDay?.dayId ?? `placeholder-${n}`,
          dayNumber: n,
          date: backendDay?.date || dateStr,
        });
        cur.setDate(cur.getDate() + 1);
        n++;
      }
      return days;
    }
    // No wizard dates — fall back to whatever the backend returned
    return itinerary.days.map((d) => ({ dayId: d.dayId, dayNumber: d.dayNumber, date: d.date }));
  })();

  const sectionComponents: Record<TripSection, React.ReactNode> = {
    vuelos: (
      <FlightsSection
        destination={destination}
        tripId={tripId ?? undefined}
        tripDays={tripDays}
        defaultOrigin={wizardFlightParams.origin}
        defaultDepartDate={wizardFlightParams.startDate}
        defaultReturnDate={wizardFlightParams.endDate}
        defaultPassengers={wizardFlightParams.passengers}
        defaultCabinClass={wizardFlightParams.cabinClass}
        onFlightSave={(info) => setSavedFlight(info)}
      />
    ),
    hospedaje: (
      <HotelsSection
        destination={destination}
        tripId={tripId ?? ""}
        tripDays={tripDays}
        savedHotelExternalId={savedHotel?.externalId ?? null}
        onHotelSave={(hotel) => setSavedHotel(hotel)}
      />
    ),
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
        savedHotel={savedHotel}
        savedFlight={savedFlight}
        center={
          destination.lat && destination.lng
            ? { lat: destination.lat, lng: destination.lng }
            : undefined
        }
      />
    ),
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <TripHeader />
      <TripNav active={activeSection} onChange={handleSectionChange} />

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
