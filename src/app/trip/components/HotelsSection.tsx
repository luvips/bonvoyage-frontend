"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@clerk/nextjs";
import {
  IoBed,
  IoSearch,
  IoStar,
  IoLocationSharp,
  IoPricetag,
  IoPerson,
  IoCalendarOutline,
} from "react-icons/io5";

const POIMap = dynamic(() => import("./POIMap"), { ssr: false });

type Hotel = {
  id: string | null;
  name: string;
  price: string;
  rating: string | number;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
};

type Destination = {
  name: string;
  country: string;
  lat: number;
  lng: number;
  photoUrl: string | null;
};


function toMapPlace(hotel: Hotel, index: number) {
  return {
    id: hotel.id ?? `hotel-${index}`,
    name: hotel.name,
    lat: hotel.latitude ?? 0,
    lng: hotel.longitude ?? 0,
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function HotelsSection({ destination }: { destination: Destination }) {
  const { getToken } = useAuth();
  const [checkIn, setCheckIn] = useState(today());
  const [checkOut, setCheckOut] = useState(tomorrow());
  const [adults, setAdults] = useState(1);
  const [rooms, setRooms] = useState(1);

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setHotels([]);
    setSelectedId(null);

    try {
      const token = await getToken();

     
      const destRes = await fetch(
        `https://bonvoyage-backend.vercel.app/api/destinations/search?query=${encodeURIComponent(destination.name)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!destRes.ok) throw new Error("No se pudo resolver el destino");
      const locations = await destRes.json();
      const match = locations.find((l: { type: string }) => l.type === "CITY") ?? locations[0];
      if (!match) throw new Error("Destino no encontrado");

 
      const params = new URLSearchParams({
        destination: match.entityId,
        checkin: checkIn,
        checkout: checkOut,
        adults: adults.toString(),
        rooms: rooms.toString(),
        currency: "USD",
      });

      const res = await fetch(
        `https://bonvoyage-backend.vercel.app/api/hotels/search?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Error ${res.status}`);
      }

      const data = await res.json();
      const list: Hotel[] = data.data ?? [];
      setHotels(list);
      if (list.length > 0) setSelectedId(list[0].id ?? "hotel-0");
      setSearched(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al buscar hoteles");
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  const selectedHotel =
    hotels.find((h, i) => (h.id ?? `hotel-${i}`) === selectedId) ?? null;

  const mapPlaces = hotels
    .filter((h) => h.latitude && h.longitude)
    .map(toMapPlace);

  return (
    <div className="px-4 max-w-6xl mx-auto pt-6 pb-8 space-y-5">

      {/* busqueda form*/}
      <form
        onSubmit={handleSearch}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end">

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <IoLocationSharp className="text-xs" /> Destino
            </label>
            <div className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 truncate">
              {destination.name}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <IoCalendarOutline className="text-xs" /> Entrada
            </label>
            <input
              type="date"
              value={checkIn}
              min={today()}
              onChange={(e) => setCheckIn(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
              required
            />
          </div>

    
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <IoCalendarOutline className="text-xs" /> Salida
            </label>
            <input
              type="date"
              value={checkOut}
              min={checkIn}
              onChange={(e) => setCheckOut(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
              required
            />
          </div>

      
          <div className="flex gap-2">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <IoPerson className="text-xs" /> Adultos
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <IoBed className="text-xs" /> Hab.
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={rooms}
                onChange={(e) => setRooms(Number(e.target.value))}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
              />
            </div>
          </div>

       
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-semibold py-2 px-4 rounded-xl transition-colors"
          >
            {loading ? (
              <IoBed className="text-base animate-pulse" />
            ) : (
              <IoSearch className="text-base" />
            )}
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

     
      {!searched && !loading && (
        <div className="flex flex-col items-center justify-center h-60 gap-3 text-gray-400">
          <IoBed className="text-5xl text-gray-200" />
          <p className="text-sm">Ingresa las fechas para buscar hospedajes en {destination.name}.</p>
        </div>
      )}

      {searched && !loading && hotels.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center h-60 gap-3 text-gray-400">
          <IoBed className="text-5xl text-gray-200" />
          <p className="text-sm">No se encontraron hoteles para esas fechas.</p>
        </div>
      )}

      {hotels.length > 0 && (
        <div className="flex gap-4 items-start">

       
          <div className="flex-1 overflow-y-auto max-h-[540px] pr-1">
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {hotels.map((hotel, i) => {
                const id = hotel.id ?? `hotel-${i}`;
                return (
                  <HotelCard
                    key={id}
                    hotel={hotel}
                    selected={selectedId === id}
                    onClick={() => setSelectedId(id)}
                  />
                );
              })}
            </div>
          </div>

          
          <div className="w-72 flex-shrink-0 sticky top-16 h-[540px] flex flex-col gap-3">

            {/* Map */}
            <div className="h-[220px] rounded-2xl overflow-hidden shadow-md border border-gray-100 flex-shrink-0">
              {mapPlaces.length > 0 ? (
                <POIMap
                  places={mapPlaces}
                  selectedId={selectedId}
                  onSelectId={setSelectedId}
                  center={{ lat: destination.lat, lng: destination.lng }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                  <IoLocationSharp className="text-3xl text-gray-200" />
                </div>
              )}
            </div>

            
            <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-gray-100 shadow-sm min-h-0">
              {selectedHotel ? (
                <>
                  {selectedHotel.imageUrl && (
                    <div className="w-full h-32 overflow-hidden rounded-t-2xl flex-shrink-0">
                      <img
                        src={selectedHotel.imageUrl}
                        alt={selectedHotel.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-3 space-y-2">
                    <h3 className="font-bold text-gray-800 text-sm leading-snug">
                      {selectedHotel.name}
                    </h3>

                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedHotel.rating && selectedHotel.rating !== "N/A" && (
                        <div className="flex items-center gap-1">
                          <IoStar className="text-amber-400 text-xs" />
                          <span className="text-xs font-semibold text-gray-700">
                            {selectedHotel.rating}
                          </span>
                        </div>
                      )}
                      {selectedHotel.price && selectedHotel.price !== "Precio no disponible" && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <IoPricetag className="text-xs text-blue-400" />
                          <span className="text-xs font-semibold">{selectedHotel.price}</span>
                        </div>
                      )}
                    </div>

                    {selectedHotel.latitude && selectedHotel.longitude && (
                      <div className="flex items-start gap-1.5">
                        <IoLocationSharp className="text-gray-400 text-xs flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-500">
                          {selectedHotel.latitude.toFixed(4)}, {selectedHotel.longitude.toFixed(4)}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
                  <IoBed className="text-3xl text-gray-200" />
                  <p className="text-xs text-center text-gray-400">
                    Selecciona un hotel para ver sus detalles
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HotelCard({
  hotel,
  selected,
  onClick,
}: {
  hotel: Hotel;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`relative w-full bg-white rounded-xl overflow-hidden shadow-sm border transition-all duration-200 cursor-pointer ${
        selected
          ? "border-blue-500 shadow-md ring-1 ring-blue-200"
          : "border-gray-100 hover:border-gray-300 hover:shadow"
      }`}
    >
      {/* Image */}
      <div className="w-full h-28 bg-gray-100 overflow-hidden">
        {hotel.imageUrl ? (
          <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <IoBed className="text-3xl text-gray-200" />
          </div>
        )}
      </div>

      <div className="p-2.5">
        {/* precio */}
        <div className="flex items-center justify-between mb-1">
          {hotel.rating && hotel.rating !== "N/A" ? (
            <div className="flex items-center gap-1">
              <IoStar className="text-amber-400 text-[10px]" />
              <span className="text-[11px] font-semibold text-gray-700">{hotel.rating}</span>
            </div>
          ) : <span />}

          {hotel.price && hotel.price !== "Precio no disponible" && (
            <div className="flex items-center gap-0.5 text-blue-500">
              <IoPricetag className="text-[9px]" />
              <span className="text-[10px] font-semibold">{hotel.price}</span>
            </div>
          )}
        </div>

    
        <h3 className="font-semibold text-gray-800 text-xs leading-tight line-clamp-2">
          {hotel.name}
        </h3>
      </div>
    </div>
  );
}
