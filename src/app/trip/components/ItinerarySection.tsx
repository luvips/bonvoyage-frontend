"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  IoCalendar, IoCompass, IoRestaurant, IoBed, IoAirplane,
  IoArrowForward, IoLocationSharp, IoStar, IoTrash, IoMap,
} from "react-icons/io5";
import type { TripItinerary, ItineraryItem } from "../types";

const ItineraryMap = dynamic(() => import("./ItineraryMap"), { ssr: false });

type SavedHotel = { name: string; imageUrl: string | null; price: string };
type SavedFlight = { airline: string; origin: string | null; destination: string | null; departure: string | null; price: number | null };

type Props = {
  itinerary: TripItinerary;
  onRemove: (itemId: string, dayNumber: number) => void;
  savedHotel?: SavedHotel | null;
  savedFlight?: SavedFlight | null;
  center?: { lat: number; lng: number };
};

function formatTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function ItinerarySection({ itinerary, onRemove, savedHotel, savedFlight, center }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const totalItems = itinerary.days.reduce((sum, d) => sum + d.items.length, 0);
  const hasLocations = savedHotel || savedFlight;

  // Collect all mappable items (non-flight, valid coords)
  const mapItems = useMemo(() => {
    const seen = new Set<string>();
    return itinerary.days
      .flatMap((d) => d.items)
      .filter((item) => {
        if (item.type === "flight") return false;
        if (!item.lat || !item.lng) return false;
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .map((item) => ({
        id: item.id,
        name: item.name,
        lat: item.lat,
        lng: item.lng,
        type: item.type as "poi" | "restaurant" | "hotel",
      }));
  }, [itinerary.days]);

  // Find full item data for the selected marker
  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    for (const day of itinerary.days) {
      const found = day.items.find((i) => i.id === selectedId);
      if (found) return { item: found, dayNumber: day.dayNumber };
    }
    return null;
  }, [selectedId, itinerary.days]);

  const showMap = !!center && mapItems.length > 0;

  if (itinerary.days.length === 0 && !hasLocations) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-gray-400">
        <IoCalendar className="text-5xl text-gray-200" />
        <p className="text-sm text-center max-w-xs">
          Tu itinerario está vacío. Agrega puntos de interés o restaurantes desde las otras secciones usando el botón <span className="font-semibold text-blue-400">+</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 max-w-6xl mx-auto pt-6 pb-10 space-y-8">

      {/* Mis ubicaciones */}
      {hasLocations && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center flex-shrink-0">
              <IoLocationSharp className="text-sm" />
            </div>
            <h2 className="text-base font-semibold text-gray-700">Mis ubicaciones</h2>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pl-11">
            {savedFlight && (
              <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                <div className="w-full h-24 bg-blue-50 flex items-center justify-center">
                  <IoAirplane className="text-3xl text-blue-300" />
                </div>
                <div className="p-2.5">
                  <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">Vuelo</span>
                  <h3 className="font-semibold text-gray-800 text-xs leading-tight line-clamp-1 mt-1">{savedFlight.airline}</h3>
                  {savedFlight.origin && savedFlight.destination && (
                    <p className="text-[9px] text-gray-500 mt-0.5">{savedFlight.origin} → {savedFlight.destination}</p>
                  )}
                  {savedFlight.departure && (
                    <p className="text-[9px] text-gray-400 mt-0.5">{formatTime(savedFlight.departure)}</p>
                  )}
                  {savedFlight.price && (
                    <p className="text-[9px] font-semibold text-blue-600 mt-0.5">${savedFlight.price}</p>
                  )}
                </div>
              </div>
            )}
            {savedHotel && (
              <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                <div className="w-full h-24 bg-gray-100 overflow-hidden">
                  {savedHotel.imageUrl ? (
                    <img src={savedHotel.imageUrl} alt={savedHotel.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <IoBed className="text-3xl text-gray-200" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600">Hotel</span>
                  <h3 className="font-semibold text-gray-800 text-xs leading-tight line-clamp-2 mt-1">{savedHotel.name}</h3>
                  {savedHotel.price && savedHotel.price !== "Precio no disponible" && (
                    <p className="text-[9px] font-semibold text-blue-600 mt-0.5">{savedHotel.price}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mapa del itinerario */}
      {showMap && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center flex-shrink-0">
              <IoMap className="text-sm" />
            </div>
            <h2 className="text-base font-semibold text-gray-700">Mapa del itinerario</h2>
            <div className="flex-1 h-px bg-gray-100" />
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><IoLocationSharp className="text-blue-500" /> Lugar</span>
              <span className="flex items-center gap-1"><IoLocationSharp className="text-orange-500" /> Restaurante</span>
              <span className="flex items-center gap-1"><IoLocationSharp className="text-indigo-500" /> Hotel</span>
            </div>
          </div>

          <div className="flex gap-4 items-start pl-11">
            <div className="flex-1 h-72 rounded-2xl overflow-hidden shadow-md border border-gray-100">
              <ItineraryMap
                items={mapItems}
                selectedId={selectedId}
                onSelectId={setSelectedId}
                center={center}
              />
            </div>

            <div className="w-64 flex-shrink-0 h-72 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-y-auto">
              {selectedItem ? (
                <SelectedItemDetail item={selectedItem.item} dayNumber={selectedItem.dayNumber} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2 p-4">
                  <IoMap className="text-3xl" />
                  <p className="text-xs text-center text-gray-400">
                    Haz click en un marcador para ver los detalles
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <IoCalendar className="text-blue-400" />
        <span>
          {itinerary.days.length} día{itinerary.days.length !== 1 ? "s" : ""} &middot;{" "}
          {totalItems} actividad{totalItems !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Day-by-day */}
      {itinerary.days.map((day) => (
        <div key={day.dayNumber}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {day.dayNumber}
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-700">Día {day.dayNumber}</h2>
              {day.date && (
                <p className="text-xs text-gray-400">
                  {new Date(day.date + "T00:00:00").toLocaleDateString("es-MX", {
                    weekday: "short", day: "numeric", month: "short",
                  })}
                </p>
              )}
            </div>
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">
              {day.items.length} actividad{day.items.length !== 1 ? "es" : ""}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pl-11">
            {day.items.map((item) => (
              <ItineraryCard
                key={item.itemId ?? item.id}
                item={item}
                selected={selectedId === item.id}
                onSelect={() => setSelectedId(item.type !== "flight" ? item.id : null)}
                onRemove={() => onRemove(item.itemId ?? item.id, day.dayNumber)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SelectedItemDetail({ item, dayNumber }: { item: ItineraryItem; dayNumber: number }) {
  const Icon = item.type === "hotel" ? IoBed : item.type === "restaurant" ? IoRestaurant : IoCompass;
  const badgeClass =
    item.type === "hotel" ? "bg-purple-50 text-purple-600" :
    item.type === "restaurant" ? "bg-orange-50 text-orange-500" :
    "bg-blue-50 text-blue-600";
  const badgeLabel =
    item.type === "hotel" ? "Hotel" : item.type === "restaurant" ? "Restaurante" : "Lugar";

  return (
    <>
      <div className="w-full h-32 bg-gray-100 overflow-hidden rounded-t-2xl flex-shrink-0">
        {item.photoUrl ? (
          <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <Icon className="text-3xl text-gray-200" />
          </div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${badgeClass}`}>
            {badgeLabel}
          </span>
          <span className="text-[9px] text-gray-400">Día {dayNumber}</span>
        </div>
        <h3 className="font-bold text-gray-800 text-sm leading-snug">{item.name}</h3>
        {item.rating && (
          <div className="flex items-center gap-1">
            <IoStar className="text-amber-400 text-xs" />
            <span className="text-xs font-semibold text-gray-700">{item.rating.toFixed(1)}</span>
            {item.priceLevel && (
              <span className="text-[10px] text-gray-400 ml-1">{item.priceLevel}</span>
            )}
          </div>
        )}
        {item.address && (
          <div className="flex items-start gap-1">
            <IoLocationSharp className="text-gray-400 text-[9px] flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-500 leading-relaxed">{item.address}</p>
          </div>
        )}
      </div>
    </>
  );
}

function ItineraryCard({
  item,
  selected,
  onSelect,
  onRemove,
}: {
  item: ItineraryItem;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  if (item.type === "flight") {
    return (
      <div className="relative bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 group">
        <button onClick={onRemove} title="Eliminar"
          className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50">
          <IoTrash className="text-red-400 text-xs" />
        </button>
        <div className="w-full h-24 bg-blue-50 flex items-center justify-center">
          <IoAirplane className="text-3xl text-blue-300" />
        </div>
        <div className="p-2.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">Vuelo</span>
          <h3 className="font-semibold text-gray-800 text-xs leading-tight line-clamp-1 mt-1">{item.name}</h3>
          {item.address && (
            <div className="flex items-center gap-1 mt-0.5">
              <IoArrowForward className="text-gray-300 text-[9px] flex-shrink-0" />
              <p className="text-[9px] text-gray-400">{item.address}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const Icon = item.type === "hotel" ? IoBed : item.type === "restaurant" ? IoRestaurant : IoCompass;

  return (
    <div
      onClick={onSelect}
      className={`relative bg-white rounded-xl overflow-hidden shadow-sm border transition-all duration-150 cursor-pointer group ${
        selected ? "border-blue-400 shadow-md ring-1 ring-blue-200" : "border-gray-100 hover:border-gray-300"
      }`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title="Eliminar"
        className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
      >
        <IoTrash className="text-red-400 text-xs" />
      </button>

      <div className="w-full h-24 bg-gray-100 overflow-hidden">
        {item.photoUrl ? (
          <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <Icon className="text-2xl text-gray-200" />
          </div>
        )}
      </div>

      <div className="p-2.5">
        <span
          className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
            item.type === "poi"
              ? "bg-blue-50 text-blue-600"
              : item.type === "hotel"
              ? "bg-purple-50 text-purple-600"
              : "bg-orange-50 text-orange-500"
          }`}
        >
          {item.type === "poi" ? "Lugar" : item.type === "hotel" ? "Hotel" : "Restaurante"}
        </span>

        <h3 className="font-semibold text-gray-800 text-xs leading-tight line-clamp-2 mt-1">
          {item.name}
        </h3>

        {item.rating && (
          <div className="flex items-center gap-1 mt-1">
            <IoStar className="text-amber-400 text-[10px]" />
            <span className="text-[10px] text-gray-600">{item.rating.toFixed(1)}</span>
            {item.priceLevel && (
              <span className="text-[10px] text-gray-400 ml-1">{item.priceLevel}</span>
            )}
          </div>
        )}

        <div className="flex items-start gap-1 mt-1.5">
          <IoLocationSharp className="text-gray-400 text-[9px] flex-shrink-0 mt-0.5" />
          <p className="text-[9px] text-gray-400 line-clamp-1">{item.address}</p>
        </div>
      </div>
    </div>
  );
}
