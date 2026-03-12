"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

export type UserProfile = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_name: string | null;
  avatar_url: string | null;
};

export type Avatar = {
  avatar_id: number;
  name: string;
  image_url: string;
};

export function useUserProfile() {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const res = await fetch(`${BACKEND}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        setProfile(json.data ?? json);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken]);

  const fetchAvatars = useCallback(async () => {
    if (avatars.length > 0) return;
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/avatars`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      setAvatars(json.data ?? json);
    } catch {
      // silently fail
    }
  }, [getToken, avatars.length]);

  const updateAvatar = useCallback(
    async (avatarId: number): Promise<boolean> => {
      setUpdating(true);
      try {
        const token = await getToken();
        const res = await fetch(`${BACKEND}/api/users/me`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ avatar_id: avatarId }),
        });
        if (!res.ok) return false;
        const json = await res.json();
        setProfile(json.data ?? json);
        return true;
      } catch {
        return false;
      } finally {
        setUpdating(false);
      }
    },
    [getToken]
  );

  return { profile, avatars, loading, updating, fetchAvatars, updateAvatar };
}
