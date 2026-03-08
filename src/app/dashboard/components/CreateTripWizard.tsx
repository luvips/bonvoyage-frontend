"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  IoClose, IoAirplane, IoCalendarOutline, IoWallet, IoChevronBack,
} from "react-icons/io5";

const BACKEND = "https://bonvoyage-backend.vercel.app";

type Place = {
  name: string;
  country: string;
  lat: number;
  lng: number;
  photoUrl: string | null;
};

type Props = {
  place: Place;
  onClose: () => void;
};

const STORAGE_KEY = "bonvoyage_wizard";

export default function CreateTripWizard({ place, onClose }: Props) {
  const { getToken } = useAuth();
  const router = useRouter();

  // Restore from sessionStorage if available (survives page reload mid-wizard)
  const saved = (() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Only restore if it's for the same destination
      return parsed.placeName === place.name ? parsed : null;
    } catch { return null; }
  })();

  const [step, setStep] = useState<number>(saved?.step ?? 1);
  const [origin, setOrigin] = useState<string>(saved?.origin ?? "");
  const [departDate, setDepartDate] = useState<string>(saved?.departDate ?? "");
  const [returnDate, setReturnDate] = useState<string>(saved?.returnDate ?? "");
  const [passengers, setPassengers] = useState<number>(saved?.passengers ?? 1);
  const [cabinClass, setCabinClass] = useState<string>(saved?.cabinClass ?? "economy");
  const [tripName, setTripName] = useState<string>(saved?.tripName ?? `${place.name} ${new Date().getFullYear()}`);
  const [budget, setBudget] = useState<string>(saved?.budget ?? "");
  const [currency, setCurrency] = useState<string>(saved?.currency ?? "USD");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist wizard state on every change
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        placeName: place.name, step, origin, departDate, returnDate,
        passengers, cabinClass, tripName, budget, currency,
      }));
    } catch { /* ignore */ }
  }, [step, origin, departDate, returnDate, passengers, cabinClass, tripName, budget, currency, place.name]);

  function clearWizard() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  const today = new Date().toISOString().slice(0, 10);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();

      // Prevent duplicate trips to the same destination
      const tripsRes = await fetch(`${BACKEND}/api/trips`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (tripsRes.ok) {
        const tripsData = await tripsRes.json();
        const existing: Array<{ destination_name?: string; destination_city?: string }> =
          tripsData.trips ?? tripsData.data ?? tripsData ?? [];
        const duplicate = existing.find(
          (t) =>
            (t.destination_city ?? t.destination_name ?? "").toLowerCase() ===
            place.name.toLowerCase()
        );
        if (duplicate) {
          setError(`Ya tienes un viaje a ${place.name}. Accédelo desde "Mis viajes" para continuar planificándolo.`);
          setLoading(false);
          return;
        }
      }

      const body: Record<string, unknown> = {
        trip_name: tripName,
        destination_name: place.name,
        destination_city: place.name,
        destination_country: place.country,
        latitude: place.lat,
        longitude: place.lng,
        start_date: departDate,
        end_date: returnDate,
        currency,
        ...(place.photoUrl ? { destination_image: place.photoUrl } : {}),
      };
      if (budget) body.total_budget = parseFloat(budget);

      const res = await fetch(`${BACKEND}/api/trips`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Error ${res.status}`);
      }

      const data = await res.json();
      const tripId = data.trip_id ?? data.id ?? data.tripId;

      const params = new URLSearchParams({
        tripId,
        name: place.name,
        country: place.country,
        lat: place.lat.toString(),
        lng: place.lng.toString(),
        startDate: departDate,
        endDate: returnDate,
        origin,
        passengers: passengers.toString(),
        cabinClass,
        ...(place.photoUrl ? { photoUrl: place.photoUrl } : {}),
      });
      clearWizard();
      router.push(`/trip?${params.toString()}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear el viaje");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

       
        <div className="relative">
          {place.photoUrl ? (
            <div className="h-36 overflow-hidden">
              <img src={place.photoUrl} alt={place.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          ) : (
            <div className="h-36 bg-gradient-to-r from-blue-500 to-blue-400" />
          )}
          <button
            onClick={() => { clearWizard(); onClose(); }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white hover:bg-black/50 transition-colors"
          >
            <IoClose />
          </button>
          <div className="absolute bottom-3 left-4">
            <p className="text-white font-bold text-lg drop-shadow">{place.name}</p>
            {place.country && <p className="text-white/80 text-xs">{place.country}</p>}
          </div>
        </div>

       
        <div className="flex gap-1.5 px-6 pt-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors duration-300 ${s <= step ? "bg-blue-500" : "bg-gray-200"}`}
            />
          ))}
        </div>

        <div className="px-6 py-5">

        
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Crear viaje</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Para planificar tu viaje necesitamos primero los detalles de tus vuelos. Esto nos permitirá organizar tu itinerario día a día.
                </p>
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                Continuar
              </button>
            </div>
          )}

          
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <IoAirplane className="text-blue-500 text-lg" />
                <h2 className="text-base font-bold text-gray-800">Datos del vuelo</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Ciudad de origen *
                  </label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="ej. Ciudad de México"
                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Ida *
                    </label>
                    <input
                      type="date"
                      value={departDate}
                      min={today}
                      onChange={(e) => setDepartDate(e.target.value)}
                      className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Vuelta *
                    </label>
                    <input
                      type="date"
                      value={returnDate}
                      min={departDate || today}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Pasajeros
                    </label>
                    <select
                      value={passengers}
                      onChange={(e) => setPassengers(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>{n} {n === 1 ? "pasajero" : "pasajeros"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Clase
                    </label>
                    <select
                      value={cabinClass}
                      onChange={(e) => setCabinClass(e.target.value)}
                      className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                    >
                      <option value="economy">Económica</option>
                      <option value="premium_economy">Premium</option>
                      <option value="business">Business</option>
                      <option value="first">Primera</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <IoChevronBack />
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!departDate || !returnDate || !origin.trim()}
                  className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-semibold text-sm transition-colors"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <IoCalendarOutline className="text-blue-500 text-lg" />
                <h2 className="text-base font-bold text-gray-800">Detalles del viaje</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Nombre del viaje *
                  </label>
                  <input
                    type="text"
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Presupuesto total
                    </label>
                    <div className="relative mt-1">
                      <IoWallet className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                      <input
                        type="number"
                        min={0}
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="0"
                        className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Moneda
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="MXN">MXN</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Destino</span>
                    <span className="font-medium text-gray-700">{place.name}{place.country ? `, ${place.country}` : ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Origen</span>
                    <span className="font-medium text-gray-700">{origin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Fechas</span>
                    <span className="font-medium text-gray-700">{departDate} → {returnDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pasajeros</span>
                    <span className="font-medium text-gray-700">{passengers} · {cabinClass}</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <IoChevronBack />
                </button>
                <button
                  onClick={handleCreate}
                  disabled={loading || !tripName.trim()}
                  className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-xl font-semibold text-sm transition-colors"
                >
                  {loading ? "Creando viaje..." : "Crear viaje"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
