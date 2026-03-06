"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  IoAirplane, IoSwapHorizontal, IoSearch, IoChevronDown,
  IoArrowForward, IoAdd, IoCheckmark, IoCalendarOutline,
} from "react-icons/io5";
import type { TripDay } from "../types";

const BACKEND = "https://bonvoyage-backend.vercel.app";

type TripType = "ida-vuelta" | "solo-ida" | "multidestino";

type Tramo = {
  origen: string | null;
  destino: string | null;
  salida: string | null;
  llegada: string | null;
  duracionMin: number | null;
  escalas: number | null;
  aerolinea: string | null;
};

type Vuelo = {
  id: string | null;
  precio: number | null;
  precioTexto: string | null;
  origen: string | null;
  destino: string | null;
  salida: string | null;
  llegada: string | null;
  duracionMin: number | null;
  escalas: number | null;
  aerolinea: string | null;
  tramos: Tramo[];
};

type Destination = {
  name: string;
  country: string;
  lat: number;
  lng: number;
  photoUrl: string | null;
};

type Props = {
  destination: Destination;
  tripId?: string;
  tripDays?: TripDay[];
  defaultOrigin?: string;
  defaultDepartDate?: string;
  defaultReturnDate?: string;
  defaultPassengers?: number;
  defaultCabinClass?: string;
};

function formatDuration(min: number | null) {
  if (!min) return "";
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function formatTime(iso: string | null) {
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

async function resolveLocation(query: string, token: string) {
  const res = await fetch(
    `${BACKEND}/api/flights/location?query=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`No se encontró "${query}"`);
  const data = await res.json();
  // response shape: { success, data: { status, timestamp, data: [...] } }
  const places: any[] = data?.data?.data ?? data?.data ?? [];
  if (!Array.isArray(places) || places.length === 0)
    throw new Error(`No se encontró "${query}"`);
  // prefer CITY, then AIRPORT, then anything
  const match =
    places.find((p: any) => p.navigation?.entityType === "CITY") ??
    places.find((p: any) => p.navigation?.entityType === "AIRPORT") ??
    places[0];
  const skyId = match?.skyId;
  const entityId = match?.entityId;
  if (!skyId || !entityId) throw new Error(`No se pudo resolver el ID de "${query}"`);
  return { skyId, entityId };
}

export default function FlightsSection({
  destination,
  tripId,
  tripDays = [],
  defaultOrigin = "",
  defaultDepartDate = "",
  defaultReturnDate = "",
  defaultPassengers = 1,
  defaultCabinClass = "economy",
}: Props) {
  const { getToken } = useAuth();

  async function handleSaveFlight(vuelo: Vuelo, dayId: string) {
    if (!tripId) return;
    const token = await getToken();
    const firstLeg = vuelo.tramos?.[0];
    const saveRes = await fetch(`${BACKEND}/api/flights/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        external_flight_id: vuelo.id ?? crypto.randomUUID(),
        airline_code: firstLeg?.aerolinea ?? vuelo.aerolinea ?? "UNKNOWN",
        flight_number: vuelo.id ?? "N/A",
        origin_airport: firstLeg?.origen ?? vuelo.origen ?? "UNKNOWN",
        destination_airport: firstLeg?.destino ?? vuelo.destino ?? "UNKNOWN",
        departure_time: firstLeg?.salida ?? vuelo.salida ?? new Date().toISOString(),
        arrival_time: firstLeg?.llegada ?? vuelo.llegada ?? new Date().toISOString(),
        price: vuelo.precio ?? 0,
        currency: "USD",
        api_source: "air-scrapper",
      }),
    });
    if (!saveRes.ok) throw new Error("Error al guardar vuelo");
    const { reference_id } = await saveRes.json();
    await fetch(`${BACKEND}/api/trips/${tripId}/days/${dayId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        item_type: "FLIGHT",
        flight_reference_id: reference_id,
        estimated_cost: vuelo.precio ?? undefined,
        notes: "Vuelo",
      }),
    });
  }
  const [tripType, setTripType] = useState<TripType>("ida-vuelta");
  const [origin, setOrigin] = useState(defaultOrigin);
  const [dest, setDest] = useState(
    destination.country ? `${destination.name}, ${destination.country}` : destination.name
  );
  const [departDate, setDepartDate] = useState(defaultDepartDate);
  const [returnDate, setReturnDate] = useState(defaultReturnDate);
  const [passengers, setPassengers] = useState(defaultPassengers);
  const [cabinClass, setCabinClass] = useState(defaultCabinClass);

  const [vuelos, setVuelos] = useState<Vuelo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function swapLocations() {
    setOrigin(dest);
    setDest(origin);
  }

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setVuelos([]);
    setSearched(false);

    try {
      const token = await getToken();
      if (!token) throw new Error("No autenticado");

      const [originData, destData] = await Promise.all([
        resolveLocation(origin, token),
        resolveLocation(dest, token),
      ]);

      const params = new URLSearchParams({
        originSkyId:        originData.skyId,
        originEntityId:     originData.entityId,
        destinationSkyId:   destData.skyId,
        destinationEntityId: destData.entityId,
        date:               departDate,
        adults:             passengers.toString(),
        cabinClass,
      });
      if (tripType === "ida-vuelta" && returnDate) {
        params.set("returnDate", returnDate);
      }

      const res = await fetch(`${BACKEND}/api/flights/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Error ${res.status}`);
      }

      const data = await res.json();
      setVuelos(data.data?.vuelos ?? []);
      setSearched(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al buscar vuelos");
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      
      <div className="-mt-18 relative z-10 px-4 max-w-5xl mx-auto mb-6">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-5">

          {/* Trip type selector */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(["ida-vuelta", "solo-ida", "multidestino"] as TripType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTripType(type)}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    tripType === type
                      ? "bg-white text-gray-800 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {type === "ida-vuelta" ? "Ida y vuelta" : type === "solo-ida" ? "Solo ida" : "Multidestino"}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSearch}>
            <div className="flex items-stretch rounded-xl border border-gray-200 overflow-hidden">

              {/* Origen */}
              <div className="flex-1 min-w-0 px-4 py-3 hover:bg-gray-50 transition-colors">
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Origen</label>
                <div className="flex items-center gap-2">
                  <IoAirplane className="text-gray-400 flex-shrink-0 rotate-45" />
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="Ciudad de salida"
                    required
                    className="w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-300 outline-none"
                  />
                </div>
              </div>

              {/* Swap */}
              <div className="flex items-center px-2 border-x border-gray-200 bg-white">
                <button type="button" onClick={swapLocations}
                  className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-500">
                  <IoSwapHorizontal className="text-lg" />
                </button>
              </div>

              {/* Destino */}
              <div className="flex-1 min-w-0 px-4 py-3 border-r border-gray-200 hover:bg-gray-50 transition-colors">
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Destino</label>
                <div className="flex items-center gap-2">
                  <IoAirplane className="text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    placeholder="Ciudad de destino"
                    required
                    className="w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-300 outline-none"
                  />
                </div>
              </div>

              {/* Salida */}
              <div className="px-4 py-3 border-r border-gray-200 hover:bg-gray-50 transition-colors">
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Salida</label>
                <input type="date" value={departDate} onChange={(e) => setDepartDate(e.target.value)}
                  required className="bg-transparent text-sm text-gray-800 outline-none w-32" />
              </div>

              {/* Regreso */}
              <div className="px-4 py-3 border-r border-gray-200 hover:bg-gray-50 transition-colors">
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Regreso</label>
                <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)}
                  disabled={tripType === "solo-ida"}
                  className="bg-transparent text-sm text-gray-800 outline-none w-32 disabled:opacity-30 disabled:cursor-not-allowed" />
              </div>

              {/* Pasajeros + Clase */}
              <div className="px-4 py-3 border-r border-gray-200 hover:bg-gray-50 transition-colors">
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Pasajeros · Clase</label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))}
                      className="bg-transparent text-sm text-gray-800 outline-none appearance-none pr-4 cursor-pointer">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>{n} {n === 1 ? "pasajero" : "pasajeros"}</option>
                      ))}
                    </select>
                    <IoChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
                  </div>
                  <span className="text-gray-300">·</span>
                  <div className="relative">
                    <select value={cabinClass} onChange={(e) => setCabinClass(e.target.value)}
                      className="bg-transparent text-sm text-gray-800 outline-none appearance-none pr-4 cursor-pointer">
                      <option value="economy">Económica</option>
                      <option value="premium_economy">Premium</option>
                      <option value="business">Business</option>
                      <option value="first">Primera</option>
                    </select>
                    <IoChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Search button */}
              <button type="submit" disabled={loading}
                className="flex items-center gap-2 px-6 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold text-sm transition-colors flex-shrink-0">
                {loading
                  ? <IoAirplane className="text-lg animate-pulse" />
                  : <IoSearch className="text-lg" />}
                {loading ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-5xl mx-auto px-4 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {searched && !loading && vuelos.length === 0 && !error && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <IoAirplane className="text-5xl text-blue-200 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">No se encontraron vuelos para esa ruta y fechas.</p>
          </div>
        )}

        {vuelos.map((vuelo, i) => (
          <FlightCard
            key={vuelo.id ?? i}
            vuelo={vuelo}
            tripDays={tripDays}
            onSaveToDay={tripId ? handleSaveFlight : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function FlightCard({
  vuelo,
  tripDays,
  onSaveToDay,
}: {
  vuelo: Vuelo;
  tripDays?: TripDay[];
  onSaveToDay?: (vuelo: Vuelo, dayId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedDayId, setSavedDayId] = useState<string | null>(null);

  async function handleAddToDay(dayId: string) {
    if (!onSaveToDay) return;
    setSaving(true);
    try {
      await onSaveToDay(vuelo, dayId);
      setSavedDayId(dayId);
    } catch {
      // silent
    } finally {
      setSaving(false);
      setPickerOpen(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Airline */}
          <div className="w-24 flex-shrink-0">
            <p className="text-xs font-semibold text-gray-700 truncate">{vuelo.aerolinea ?? "Aerolínea"}</p>
            <p className="text-[10px] text-gray-400">
              {vuelo.escalas === 0 ? "Directo" : `${vuelo.escalas} escala${vuelo.escalas !== 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Route */}
          <div className="flex-1 flex items-center gap-3">
            <div className="text-right">
              <p className="text-lg font-bold text-gray-800">{formatTime(vuelo.salida)}</p>
              <p className="text-xs text-gray-400">{vuelo.origen ?? ""}</p>
            </div>

            <div className="flex-1 flex flex-col items-center gap-1">
              <p className="text-[10px] text-gray-400">{formatDuration(vuelo.duracionMin)}</p>
              <div className="w-full flex items-center gap-1">
                <div className="flex-1 h-px bg-gray-200" />
                <IoArrowForward className="text-gray-300 text-xs flex-shrink-0" />
              </div>
            </div>

            <div>
              <p className="text-lg font-bold text-gray-800">{formatTime(vuelo.llegada)}</p>
              <p className="text-xs text-gray-400">{vuelo.destino ?? ""}</p>
            </div>
          </div>

          {/* Price */}
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-bold text-blue-600">
              {vuelo.precioTexto ?? (vuelo.precio ? `$${vuelo.precio}` : "—")}
            </p>
            <p className="text-[10px] text-gray-400">por persona</p>
          </div>
        </div>
      </button>

      {/* Tramos detail */}
      {expanded && vuelo.tramos.length > 1 && (
        <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 space-y-2">
          {vuelo.tramos.map((tramo, i) => (
            <div key={i} className="flex items-center gap-3 text-xs text-gray-600">
              <IoAirplane className="text-blue-400 flex-shrink-0" />
              <span className="font-medium">{tramo.aerolinea}</span>
              <span>{formatTime(tramo.salida)} · {tramo.origen}</span>
              <IoArrowForward className="text-gray-300" />
              <span>{formatTime(tramo.llegada)} · {tramo.destino}</span>
              <span className="text-gray-400 ml-auto">{formatDuration(tramo.duracionMin)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add to itinerary — always visible when tripId is set */}
      {onSaveToDay && (
        <div className="border-t border-gray-100 px-5 py-3">
          {savedDayId ? (
            <div className="flex items-center gap-2 text-green-600 text-xs font-semibold">
              <IoCheckmark className="text-sm" />
              Vuelo añadido al itinerario
            </div>
          ) : !pickerOpen ? (
            <button
              onClick={(e) => { e.stopPropagation(); setPickerOpen(true); }}
              className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              <IoAdd className="text-sm" />
              Agregar al itinerario
            </button>
          ) : (
            <div onClick={(e) => e.stopPropagation()}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                <IoCalendarOutline className="text-xs" />
                Selecciona el día
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(tripDays ?? []).map((d) => (
                  <button
                    key={d.dayId}
                    onClick={() => handleAddToDay(d.dayId)}
                    disabled={saving}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-blue-500 hover:text-white text-gray-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? "..." : `Día ${d.dayNumber}`}
                  </button>
                ))}
                <button
                  onClick={() => setPickerOpen(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
