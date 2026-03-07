"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { IoAirplane, IoCalendarOutline, IoChevronForward } from "react-icons/io5";
import Link from "next/link";
import Header from "@/app/components/Header";

const BACKEND = "https://bonvoyage-backend.vercel.app";

type Trip = {
  trip_id: string;
  trip_name: string;
  start_date: string;
  end_date: string;
  status: string;
  is_favorite: boolean;
  destination_name?: string;
  destination_city?: string;
  destination_image?: string;
  total_days?: number;
  total_items?: number;
};

export default function MyTripsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const res = await fetch(`${BACKEND}/api/trips`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        setTrips(data.trips ?? data.data ?? data ?? []);
      } catch {
        setError("No se pudieron cargar los viajes.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header variant="light" />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Mis viajes</h1>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <IoAirplane className="text-base" />
            Nuevo viaje
          </Link>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 h-24 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <IoAirplane className="text-5xl text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && trips.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <IoAirplane className="text-5xl text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 text-sm font-medium">Aún no tienes viajes creados</p>
            <p className="text-gray-400 text-xs mt-1 mb-4">Empieza buscando un destino en el mapa</p>
            <Link href="/dashboard" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-colors">
              Explorar destinos
            </Link>
          </div>
        )}

        {!loading && trips.length > 0 && (
          <div className="space-y-3">
            {trips.map((trip) => (
              <TripCard key={trip.trip_id} trip={trip} onClick={() => {
                const params = new URLSearchParams({
                  tripId: trip.trip_id,
                  name: trip.destination_city ?? trip.destination_name ?? trip.trip_name,
                });
                if (trip.start_date) params.set("startDate", trip.start_date.slice(0, 10));
                if (trip.end_date) params.set("endDate", trip.end_date.slice(0, 10));
                if (trip.destination_image) params.set("photoUrl", trip.destination_image);
                router.push(`/trip?${params.toString()}`);
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TripCard({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  const start = trip.start_date ? new Date(trip.start_date.slice(0, 10) + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "";
  const end = trip.end_date ? new Date(trip.end_date.slice(0, 10) + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "";

  const statusColor: Record<string, string> = {
    PLANNED: "bg-blue-100 text-blue-600",
    CONFIRMED: "bg-green-100 text-green-600",
    COMPLETED: "bg-gray-100 text-gray-500",
    CANCELLED: "bg-red-100 text-red-500",
  };

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-4 text-left flex items-center gap-4"
    >
      {/* Image / icon */}
      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
        {trip.destination_image ? (
          <img src={trip.destination_image} alt={trip.trip_name} className="w-full h-full object-cover" />
        ) : (
          <IoAirplane className="text-white text-2xl" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-gray-800 text-sm">{trip.trip_name}</h3>
          {trip.status && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor[trip.status] ?? "bg-gray-100 text-gray-500"}`}>
              {trip.status}
            </span>
          )}
        </div>
        {(trip.destination_city ?? trip.destination_name) && (
          <p className="text-xs text-gray-500 mt-0.5">{trip.destination_city ?? trip.destination_name}</p>
        )}
        {start && (
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
            <IoCalendarOutline className="text-xs" />
            <span>{start} → {end}</span>
          </div>
        )}
      </div>

      <IoChevronForward className="text-gray-300 flex-shrink-0" />
    </button>
  );
}
