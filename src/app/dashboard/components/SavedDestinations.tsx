"use client";

import { IoLocationSharp, IoTrash } from "react-icons/io5";

type Destination = {
  id: string;
  name: string;
  lng: number;
  lat: number;
};

type Props = {
  destinations: Destination[];
  onDelete: (id: string) => void;
};

export default function SavedDestinations({ destinations, onDelete }: Props) {
  return (
    <aside className="w-72 h-full bg-white border-l border-gray-100 flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm">Mis destinos</h2>
        <p className="text-gray-400 text-xs mt-0.5">{destinations.length} guardados (esto es solo para probarlo)</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {destinations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 text-gray-400">
            <IoLocationSharp className="text-4xl mb-2 text-gray-200" />
            <p className="text-sm">Haz click en el mapa para empezar a vajar</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {destinations.map((dest) => (
              <li key={dest.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 group">
                <IoLocationSharp className="text-blue-500 text-lg flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 font-medium leading-snug truncate">{dest.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {dest.lat.toFixed(3)}°, {dest.lng.toFixed(3)}°
                  </p>
                </div>
                <button
                  onClick={() => onDelete(dest.id)}
                  className="text-gray-300 hover:text-yellow-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                >
                  <IoTrash className="text-base" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
