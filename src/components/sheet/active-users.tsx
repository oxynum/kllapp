"use client";

import { useOthers } from "@liveblocks/react/suspense";
import { UserAvatar } from "@/components/ui/user-avatar";

const MAX_SHOWN = 4;

interface ActiveUsersProps {
  followingUserId?: string | null;
  onFollowUser?: (userId: string | null) => void;
}

export function ActiveUsers({ followingUserId, onFollowUser }: ActiveUsersProps) {
  const others = useOthers();

  // Deduplicate by user id (same user may have multiple connections)
  const seen = new Set<string>();
  const uniqueOthers = others.filter((o) => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });

  if (uniqueOthers.length === 0) return null;

  const shown = uniqueOthers.slice(0, MAX_SHOWN);
  const overflow = uniqueOthers.length - MAX_SHOWN;
  const followedUser = followingUserId ? uniqueOthers.find(u => u.id === followingUserId) : null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center -space-x-1.5">
        {shown.map((user) => {
          const isFollowing = user.id === followingUserId;
          return (
            <button
              key={user.id}
              title={user.info.name}
              onClick={() => onFollowUser?.(isFollowing ? null : user.id)}
              className={`relative rounded-full transition-all ${
                isFollowing
                  ? "ring-2 ring-blue-500 scale-110 z-10"
                  : "ring-2 ring-white hover:ring-blue-200"
              }`}
            >
              <UserAvatar name={user.info.name} image={user.info.image} size={24} />
              <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-white" />
            </button>
          );
        })}
        {overflow > 0 && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[9px] font-medium text-gray-500 ring-2 ring-white">
            +{overflow}
          </div>
        )}
      </div>

      {followedUser && (
        <div className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
          <span>{followedUser.info.name.split(" ")[0]}</span>
          <button
            onClick={() => onFollowUser?.(null)}
            className="ml-0.5 text-blue-400 hover:text-blue-600"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
