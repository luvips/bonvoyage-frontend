"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { IoAirplane, IoCalendarOutline, IoChevronForward, IoHeart, IoHeartOutline, IoTrashOutline, IoSearchOutline, IoClose } from "react-icons/io5";
import Link from "next/link";
import Header from "@/app/components/Header";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

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
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

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

  async function handleDeleteTrip(tripId: string) {
    if (deleting.has(tripId)) return;
    setDeleting((prev) => new Set(prev).add(tripId));
    setConfirmDelete(null);
    // Optimistic remove
    setTrips((prev) => prev.filter((t) => t.trip_id !== tripId));
    try {
      const token = await getToken();
      await fetch(`${BACKEND}/api/trips/${tripId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Reload on error to restore the list
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/trips`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setTrips(data.trips ?? data.data ?? data ?? []);
      }
    } finally {
      setDeleting((prev) => { const s = new Set(prev); s.delete(tripId); return s; });
    }
  }

  async function handleToggleFavorite(tripId: string, current: boolean) {
    if (toggling.has(tripId)) return;
    setToggling((prev) => new Set(prev).add(tripId));
    // Optimistic update
    setTrips((prev) =>
      prev.map((t) => (t.trip_id === tripId ? { ...t, is_favorite: !current } : t))
    );
    try {
      const token = await getToken();
      await fetch(`${BACKEND}/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_favorite: !current }),
      });
    } catch {
      // Revert on error
      setTrips((prev) =>
        prev.map((t) => (t.trip_id === tripId ? { ...t, is_favorite: current } : t))
      );
    } finally {
      setToggling((prev) => { const s = new Set(prev); s.delete(tripId); return s; });
    }
  }

  const STATUS_LABELS: Record<string, string> = {
    ALL: "Todos", DRAFT: "Borrador", CONFIRMED: "Confirmado",
    COMPLETED: "Completado", CANCELLED: "Cancelado",
  };

  const filteredTrips = trips.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      t.trip_name.toLowerCase().includes(q) ||
      (t.destination_city ?? t.destination_name ?? "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

        {/* Search + filters */}
        {!loading && trips.length > 0 && (
          <div className="space-y-3 mb-5">
            {/* Search bar */}
            <div className="relative">
              <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o destino..."
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent shadow-sm"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <IoClose className="text-base" />
                </button>
              )}
            </div>

            {/* Status filters */}
            <div className="flex gap-2 flex-wrap">
              {Object.keys(STATUS_LABELS).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    statusFilter === s
                      ? "bg-blue-500 text-white"
                      : "bg-white text-gray-500 border border-gray-200 hover:border-blue-300 hover:text-blue-500"
                  }`}
                >
                  {STATUS_LABELS[s]}
                  {s !== "ALL" && (
                    <span className={`ml-1.5 ${statusFilter === s ? "text-blue-200" : "text-gray-300"}`}>
                      {trips.filter((t) => t.status === s).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

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

        {!loading && trips.length > 0 && filteredTrips.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <IoSearchOutline className="text-4xl text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">Sin resultados</p>
            <p className="text-gray-400 text-xs mt-1">Intenta con otro nombre, destino o estado</p>
            <button
              onClick={() => { setSearch(""); setStatusFilter("ALL"); }}
              className="mt-3 text-xs text-blue-500 hover:text-blue-600 font-semibold"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {!loading && filteredTrips.length > 0 && (
          <div className="space-y-3">
            {filteredTrips.map((trip) => (
              <TripCard
                key={trip.trip_id}
                trip={trip}
                toggling={toggling.has(trip.trip_id)}
                confirmingDelete={confirmDelete === trip.trip_id}
                deleting={deleting.has(trip.trip_id)}
                onToggleFavorite={() => handleToggleFavorite(trip.trip_id, trip.is_favorite)}
                onRequestDelete={() => setConfirmDelete(trip.trip_id)}
                onCancelDelete={() => setConfirmDelete(null)}
                onConfirmDelete={() => handleDeleteTrip(trip.trip_id)}
                onClick={() => {
                  const params = new URLSearchParams({
                    tripId: trip.trip_id,
                    name: trip.destination_city ?? trip.destination_name ?? trip.trip_name,
                  });
                  if (trip.start_date) params.set("startDate", trip.start_date.slice(0, 10));
                  if (trip.end_date) params.set("endDate", trip.end_date.slice(0, 10));
                  if (trip.destination_image) params.set("photoUrl", trip.destination_image);
                  router.push(`/trip?${params.toString()}`);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TripCard({
  trip,
  toggling,
  confirmingDelete,
  deleting,
  onToggleFavorite,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onClick,
}: {
  trip: Trip;
  toggling: boolean;
  confirmingDelete: boolean;
  deleting: boolean;
  onToggleFavorite: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onClick: () => void;
}) {
  const start = trip.start_date ? new Date(trip.start_date.slice(0, 10) + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "";
  const end = trip.end_date ? new Date(trip.end_date.slice(0, 10) + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "";

  const statusColor: Record<string, string> = {
    PLANNED: "bg-blue-100 text-blue-600",
    CONFIRMED: "bg-green-100 text-green-600",
    COMPLETED: "bg-gray-100 text-gray-500",
    CANCELLED: "bg-red-100 text-red-500",
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-4 flex items-center gap-4">
      {/* Image / icon */}
      <button onClick={onClick} className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
        {trip.destination_image ? (
          <img src={trip.destination_image} alt={trip.trip_name} className="w-full h-full object-cover" />
        ) : (
          <IoAirplane className="text-white text-2xl" />
        )}
      </button>

      <button onClick={onClick} className="flex-1 min-w-0 text-left">
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
      </button>

      {/* Favorite toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
        disabled={toggling}
        title={trip.is_favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 flex-shrink-0"
      >
        {trip.is_favorite
          ? <IoHeart className="text-red-500 text-xl" />
          : <IoHeartOutline className="text-gray-300 text-xl hover:text-red-400 transition-colors" />
        }
      </button>

      {/* Delete */}
      {confirmingDelete ? (
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs text-gray-500 mr-1">¿Eliminar?</span>
          <button
            onClick={(e) => { e.stopPropagation(); onConfirmDelete(); }}
            disabled={deleting}
            className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            Sí
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCancelDelete(); }}
            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
          >
            No
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onRequestDelete(); }}
          title="Eliminar viaje"
          className="p-2 rounded-full hover:bg-red-50 transition-colors flex-shrink-0"
        >
          <IoTrashOutline className="text-gray-300 text-xl hover:text-red-400 transition-colors" />
        </button>
      )}

      <button onClick={onClick}>
        <IoChevronForward className="text-gray-300 flex-shrink-0" />
      </button>
    </div>
  );
}
