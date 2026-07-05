import React from 'react';

interface AvatarProps {
  name: string;
  size?: number; // size in px
  className?: string;
}

export default function Avatar({ name, size = 32, className = "" }: AvatarProps) {
  // Get initials
  const getInitials = (userName: string) => {
    const parts = userName.trim().split(/\s+/);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
  };

  // Premium gradient combinations
  const gradients = [
    "from-purple-600 to-indigo-600",
    "from-blue-600 to-cyan-500",
    "from-emerald-500 to-teal-600",
    "from-orange-500 to-red-600",
    "from-pink-500 to-rose-600",
    "from-amber-500 to-orange-600",
    "from-indigo-500 to-pink-500",
    "from-violet-600 to-purple-500"
  ];

  // Hash function to pick a stable gradient based on the name
  const getGradient = (userName: string) => {
    let hash = 0;
    for (let i = 0; i < userName.length; i++) {
      hash = userName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  const initials = getInitials(name);
  const gradient = getGradient(name);

  return (
    <div 
      className={`flex items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white font-bold tracking-wider shadow-sm select-none shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}
