export function AgentIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Antenna */}
      <rect x="7" y="0" width="2" height="2" fill="#F59E0B" />
      <rect x="6" y="1" width="1" height="1" fill="#FBBF24" />
      <rect x="9" y="1" width="1" height="1" fill="#FBBF24" />
      {/* Head */}
      <rect x="4" y="2" width="8" height="7" fill="#8B5CF6" />
      <rect x="3" y="3" width="1" height="5" fill="#7C3AED" />
      <rect x="12" y="3" width="1" height="5" fill="#7C3AED" />
      {/* Eyes */}
      <rect x="5" y="4" width="2" height="2" fill="#E0F2FE" />
      <rect x="9" y="4" width="2" height="2" fill="#E0F2FE" />
      <rect x="6" y="5" width="1" height="1" fill="#1E293B" />
      <rect x="10" y="5" width="1" height="1" fill="#1E293B" />
      {/* Mouth */}
      <rect x="6" y="7" width="4" height="1" fill="#C4B5FD" />
      {/* Body */}
      <rect x="5" y="10" width="6" height="4" fill="#6D28D9" />
      <rect x="6" y="11" width="4" height="2" fill="#A78BFA" />
      {/* Arms */}
      <rect x="3" y="11" width="2" height="1" fill="#7C3AED" />
      <rect x="11" y="11" width="2" height="1" fill="#7C3AED" />
      {/* Feet */}
      <rect x="5" y="14" width="2" height="1" fill="#4C1D95" />
      <rect x="9" y="14" width="2" height="1" fill="#4C1D95" />
    </svg>
  );
}
