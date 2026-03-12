"use client";

import { useEffect, useState } from "react";
import { Avatar, useUserProfile } from "@/hooks/useUserProfile";

type Props = {
  onClose: () => void;
};

export default function AvatarSelectorModal({ onClose }: Props) {
  const { profile, avatars, updating, fetchAvatars, updateAvatar } = useUserProfile();
  const [selected, setSelected] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchAvatars();
  }, [fetchAvatars]);

  async function handleConfirm() {
    if (selected === null) return;
    const ok = await updateAvatar(selected);
    if (ok) {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 800);
    }
  }

  const currentAvatarUrl = profile?.avatar_url ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-800">Elige tu avatar</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Avatar actual */}
        {currentAvatarUrl && (
          <div className="flex justify-center mb-4">
            <img
              src={currentAvatarUrl}
              alt="Avatar actual"
              className="w-16 h-16 rounded-full object-cover border-2 border-blue-400"
            />
          </div>
        )}

        {/* Grid de avatares */}
        {avatars.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 mb-5">
            {avatars.map((avatar: Avatar) => (
              <button
                key={avatar.avatar_id}
                onClick={() => setSelected(avatar.avatar_id)}
                className={`rounded-xl overflow-hidden border-2 transition-all ${
                  selected === avatar.avatar_id
                    ? "border-blue-500 scale-105 shadow-md"
                    : "border-transparent hover:border-gray-300"
                }`}
              >
                <img
                  src={avatar.image_url}
                  alt={avatar.name}
                  className="w-full aspect-square object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected === null || updating || success}
            className="flex-1 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {success ? "✓ Guardado" : updating ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
