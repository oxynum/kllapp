"use client";

import { useState } from "react";
import { getInitials, getAvatarColor } from "@/lib/utils/avatars";

interface UserAvatarProps {
  name: string;
  image?: string | null;
  size?: number;
}

export function UserAvatar({ name, image, size = 28 }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(name);
  const color = getAvatarColor(name);
  const fontSize = Math.round(size * 0.38);

  if (image && !imgError) {
    return (
      <img
        src={image}
        alt={name}
        referrerPolicy="no-referrer"
        loading="eager"
        onError={() => setImgError(true)}
        className="flex-shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize }}
    >
      {initials}
    </div>
  );
}
