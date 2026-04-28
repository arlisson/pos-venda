import React from 'react';

const mk = (paths, vb = '0 0 24 24') => ({ size = 16, ...rest } = {}) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox={vb} 
    width={size} 
    height={size} 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.6" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...rest}
  >
    {paths}
  </svg>
);

export const Funnel = mk(<><path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" /></>);
export const Plus = mk(<><path d="M12 5v14M5 12h14" /></>);
export const Search = mk(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const Filter = mk(<><path d="M4 5h16M7 12h10M10 19h4" /></>);
export const Bell = mk(<><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" /><path d="M10 21a2 2 0 0 0 4 0" /></>);
export const User = mk(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
export const Users = mk(<><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><circle cx="17" cy="9" r="3" /><path d="M22 19a5 5 0 0 0-7-4.6" /></>);
export const Chart = mk(<><path d="M3 3v18h18" /><path d="M7 14l3-4 4 3 5-7" /></>);
export const Settings = mk(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.9l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const History = mk(<><path d="M3 3v6h6" /><path d="M3.5 9a9 9 0 1 0 2-4.6L3 9" /><path d="M12 7v5l3 2" /></>);
export const Return = mk(<><path d="M9 14l-4-4 4-4" /><path d="M5 10h11a4 4 0 0 1 0 8h-2" /></>);
export const Logout = mk(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>);
export const External = mk(<><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" /></>);
export const More = mk(<><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>);
export const Close = mk(<><path d="M18 6 6 18M6 6l12 12" /></>);
export const Check = mk(<><path d="m5 12 5 5L20 7" /></>);
export const ArrowRight = mk(<><path d="M5 12h14M13 6l6 6-6 6" /></>);
export const Calendar = mk(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>);
export const Edit = mk(<><path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6" /><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L11 16l-4 1 1-4 10.4-10.4z" /></>);
export const Trash = mk(<><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></>);
export const AlertTriangle = mk(<><path d="M12 3 2 21h20L12 3z" /><path d="M12 9v5M12 18h.01" /></>);
export const LayoutGrid = mk(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>);
export const LayoutList = mk(<><rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="11" width="18" height="4" rx="1" /><rect x="3" y="18" width="18" height="3" rx="1" /></>);
export const LayoutHybrid = mk(<><rect x="3" y="3" width="6" height="18" rx="1" /><rect x="11" y="3" width="10" height="18" rx="1" /></>);
export const SimCard = mk(<><path d="M5 3h10l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><rect x="8" y="11" width="8" height="8" rx="1" /><path d="M8 14h8M11 11v8M14 11v8" /></>);
export const Shield = mk(<><path d="M12 2 3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7l-9-5z" /></>);
export const Home = mk(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>);
export const Eye = mk(<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>);
export const EyeOff = mk(<><path d="M17.9 17.4A10 10 0 0 1 2 12s1.5-4 5.1-6.2M9.5 4.3A10 10 0 0 1 22 12s-3 7-10 7a9.9 9.9 0 0 1-4.5-1.1" /><path d="M2 2l20 20" /></>);
export const ChevronDown = mk(<><path d="m6 9 6 6 6-6" /></>);
