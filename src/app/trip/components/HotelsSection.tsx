"use client";

import { IoBed } from "react-icons/io5";

type Destination = { name: string; country: string; lat: number; lng: number; photoUrl: string | null };

export default function HotelsSection({ destination }: { destination: Destination }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
      <IoBed className="text-5xl text-blue-200 mx-auto mb-4" />
      <h2 className="text-gray-700 font-semibold mb-1">Hospedaje en {destination.name}</h2>
      <p className="text-gray-400 text-sm">Aqui podrás ver tus hoteles, alojamientos y actividades que haras durante tu viaej.</p>
    </div>
  );
}
