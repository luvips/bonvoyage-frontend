"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import TripHeader from "./components/TripHeader";
import TripNav from "./components/TripNav";
import FlightsSection from "./components/FlightsSection";
import HotelsSection from "./components/HotelsSection";
import PointsOfInterestSection from "./components/PointsOfInterestSection";
import RestaurantsSection from "./components/RestaurantsSection";
import ItinerarySection from "./components/ItinerarySection";
import { IoHeart, IoHeartOutline, IoCheckmarkCircle, IoCloseCircle, IoTrophy, IoEllipsisHorizontalCircle, IoTrashOutline, IoPencilOutline, IoClose, IoWallet } from "react-icons/io5";
import { useRouter } from "next/navigation";
import type { ItineraryItem, TripItinerary, DayPlan } from "./types";
import { useTripTimeTracker } from "@/hooks/useTripTimeTracker";

export type TripSection = "vuelos" | "hospedaje" | "puntos" | "restaurantes" | "itinerario";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

function TripPageContent() {
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const router = useRouter();

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
  const [isFavorite, setIsFavorite] = useState(false);
  const togglingFav = useRef(false);
  const [tripStatus, setTripStatus] = useState<"DRAFT" | "CONFIRMED" | "COMPLETED" | "CANCELLED">("DRAFT");
  const [changingStatus, setChangingStatus] = useState(false);

  // Mide el tiempo activo de planificación (solo cuando status === DRAFT)
  useTripTimeTracker(tripId, tripStatus === "DRAFT");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingTrip, setDeletingTrip] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editCurrency, setEditCurrency] = useState("USD");
  const [savingEdit, setSavingEdit] = useState(false);
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

      setIsFavorite(data.is_favorite ?? false);
      setTripStatus(data.status ?? "DRAFT");

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

  async function toggleFavorite() {
    if (!tripId || togglingFav.current) return;
    togglingFav.current = true;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      const token = await getToken();
      await fetch(`${BACKEND}/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_favorite: next }),
      });
    } catch {
      setIsFavorite(!next); // revert
    } finally {
      togglingFav.current = false;
    }
  }

  async function changeStatus(action: "confirm" | "cancel" | "complete") {
    if (!tripId || changingStatus) return;
    setChangingStatus(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/trips/${tripId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      const data = json.data ?? json;
      setTripStatus(data.status ?? (action === "confirm" ? "CONFIRMED" : action === "cancel" ? "CANCELLED" : "COMPLETED"));
    } catch {
      // silent — keep current status
    } finally {
      setChangingStatus(false);
    }
  }

  function openEdit() {
    setEditName(destination.name ?? "");
    setEditStart(tripMeta?.startDate ?? wizardFlightParams.startDate ?? "");
    setEditEnd(tripMeta?.endDate ?? wizardFlightParams.endDate ?? "");
    setEditBudget("");
    setEditCurrency("USD");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!tripId || savingEdit) return;
    setSavingEdit(true);
    try {
      const token = await getToken();
      const body: Record<string, unknown> = {
        trip_name: editName,
        start_date: editStart,
        end_date: editEnd,
      };
      if (editBudget) body.total_budget = parseFloat(editBudget);
      body.currency = editCurrency;
      await fetch(`${BACKEND}/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      setTripMeta((prev) => prev ? { ...prev, startDate: editStart, endDate: editEnd } : prev);
      setEditOpen(false);
    } catch {
      // silent
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteTrip() {
    if (!tripId || deletingTrip) return;
    setDeletingTrip(true);
    try {
      const token = await getToken();
      await fetch(`${BACKEND}/api/trips/${tripId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      router.push("/my-trips");
    } catch {
      setDeletingTrip(false);
      setConfirmingDelete(false);
    }
  }

  async function addToItinerary(item: ItineraryItem, dayNumber: number) {
    if (tripStatus !== "DRAFT") return; // trip locked
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

  function reorderItinerary(dayNumber: number, items: ItineraryItem[]) {
    setItinerary((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.dayNumber === dayNumber ? { ...d, items } : d
      ),
    }));
  }

  async function removeFromItinerary(itemId: string, dayNumber: number) {
    if (tripStatus !== "DRAFT") return; // trip locked
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
        readOnly={tripStatus !== "DRAFT"}
      />
    ),
    restaurantes: (
      <RestaurantsSection
        destination={destination}
        tripDays={tripDays}
        onAddToItinerary={addToItinerary}
        readOnly={tripStatus !== "DRAFT"}
      />
    ),
    itinerario: (
      <ItinerarySection
        itinerary={itinerary}
        onRemove={removeFromItinerary}
        onReorder={reorderItinerary}
        savedHotel={savedHotel}
        savedFlight={savedFlight}
        readOnly={tripStatus !== "DRAFT"}
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

      {/* Status bar */}
      {tripId && (
        <div className="max-w-6xl mx-auto w-full px-4 pt-4">
          <div className="flex items-center gap-3 bg-white border border-cyan-100 rounded-2xl px-5 py-3 shadow-sm">
            {/* Status badge */}
            <div className="flex items-center gap-2 flex-1">
              {tripStatus === "DRAFT" && (
                <><IoEllipsisHorizontalCircle className="text-cyan-400 text-xl flex-shrink-0" /><span className="text-sm font-semibold text-cyan-600">Borrador</span></>
              )}
              {tripStatus === "CONFIRMED" && (
                <><IoCheckmarkCircle className="text-cyan-500 text-xl flex-shrink-0" /><span className="text-sm font-semibold text-cyan-700">Confirmado</span></>
              )}
              {tripStatus === "COMPLETED" && (
                <><IoTrophy className="text-cyan-600 text-xl flex-shrink-0" /><span className="text-sm font-semibold text-cyan-800">Completado</span></>
              )}
              {tripStatus === "CANCELLED" && (
                <><IoCloseCircle className="text-red-400 text-xl flex-shrink-0" /><span className="text-sm font-semibold text-red-500">Cancelado</span></>
              )}
            </div>

            {/* Edit — solo en DRAFT */}
            {tripStatus === "DRAFT" && !confirmingDelete && (
              <button
                onClick={openEdit}
                title="Editar viaje"
                className="p-2 rounded-full hover:bg-cyan-50 transition-colors flex-shrink-0"
              >
                <IoPencilOutline className="text-gray-300 hover:text-cyan-400 text-lg transition-colors" />
              </button>
            )}

            {/* Delete */}
            {confirmingDelete ? (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs text-gray-500">¿Eliminar?</span>
                <button
                  onClick={deleteTrip}
                  disabled={deletingTrip}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors"
                >
                  Sí, eliminar
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                title="Eliminar viaje"
                className="p-2 rounded-full hover:bg-red-50 transition-colors flex-shrink-0"
              >
                <IoTrashOutline className="text-gray-300 hover:text-red-400 text-lg transition-colors" />
              </button>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {tripStatus === "DRAFT" && (
                <>
                  <button
                    onClick={() => changeStatus("confirm")}
                    disabled={changingStatus}
                    className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <IoCheckmarkCircle className="text-sm" />
                    Confirmar
                  </button>
                  <button
                    onClick={() => changeStatus("cancel")}
                    disabled={changingStatus}
                    className="px-4 py-1.5 bg-white hover:bg-red-50 disabled:opacity-50 text-red-400 border border-red-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <IoCloseCircle className="text-sm" />
                    Cancelar
                  </button>
                </>
              )}
              {tripStatus === "CONFIRMED" && (
                <>
                  <button
                    onClick={() => changeStatus("complete")}
                    disabled={changingStatus}
                    className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    
                    Marcar completado
                  </button>
                  <button
                    onClick={() => changeStatus("cancel")}
                    disabled={changingStatus}
                    className="px-4 py-1.5 bg-white hover:bg-red-50 disabled:opacity-50 text-red-400 border border-red-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <IoCloseCircle className="text-sm" />
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
            <div className="flex items-end justify-between gap-4">
              <div>
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
              {tripId && (
                <button
                  onClick={toggleFavorite}
                  title={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                  className="flex-shrink-0 w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors"
                >
                  {isFavorite
                    ? <IoHeart className="text-red-400 text-2xl" />
                    : <IoHeartOutline className="text-white text-2xl" />
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 w-full pt-0 pb-6">
        {sectionComponents[activeSection]}
      </main>

      {/* Modal editar viaje */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Editar viaje</h2>
              <button onClick={() => setEditOpen(false)} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                <IoClose className="text-gray-400 text-lg" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Nombre del viaje</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Ida</label>
                  <input
                    type="date"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Vuelta</label>
                  <input
                    type="date"
                    value={editEnd}
                    min={editStart}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Presupuesto</label>
                  <div className="relative mt-1">
                    <IoWallet className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="number"
                      min={0}
                      value={editBudget}
                      onChange={(e) => setEditBudget(e.target.value)}
                      placeholder="0"
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Moneda</label>
                  <select
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 bg-white"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="MXN">MXN</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setEditOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit || !editName.trim() || !editStart || !editEnd}
                className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {savingEdit ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
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
