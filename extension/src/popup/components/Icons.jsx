const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export const BackIcon = (p) => (
  <svg {...base} {...p}><path d="M15 18l-6-6 6-6" /></svg>
);
export const ChevronIcon = (p) => (
  <svg {...base} {...p}><path d="M9 18l6-6-6-6" /></svg>
);
export const PlusIcon = (p) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const CloseIcon = (p) => (
  <svg {...base} {...p}><path d="M18 6L6 18M6 6l12 12" /></svg>
);
export const LinkIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" />
  </svg>
);
export const CheckIcon = (p) => (
  <svg {...base} {...p}><path d="M20 6L9 17l-5-5" /></svg>
);
export const ExternalIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
  </svg>
);
// Default profile picture: a filled head-and-shoulders silhouette, clipped to a circle.
export const UserIcon = (p) => (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <clipPath id="user-icon-circle">
      <circle cx="12" cy="12" r="12" />
    </clipPath>
    <g clipPath="url(#user-icon-circle)">
      <circle cx="12" cy="9.5" r="4.2" />
      <path d="M3 25c0-5.3 4-9.2 9-9.2s9 3.9 9 9.2z" />
    </g>
  </svg>
);

export const GiftIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13M19 12v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7" />
    <path d="M7.5 8a2.5 2.5 0 010-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 010 5" />
  </svg>
);
