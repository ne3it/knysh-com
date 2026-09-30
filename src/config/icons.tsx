'use client';

import type { SVGProps } from 'react';

export const BarcodeIcon = ({ className = '', style, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M3 5v14" />
    <path d="M7 5v14" />
    <path d="M11 5v10" />
    <path d="M14 5v14" />
    <path d="M17 5v7" />
    <path d="M21 5v14" />
  </svg>
);

export const PriceControlIcon = ({ className = '', style, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#7b1fa2"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M12 2 L12 8" />
    <path d="M8 8 H16" />
    <path d="M8 8 L8 14 M6 14 H10" />
    <path d="M16 8 L16 14 M14 14 H18" />
  </svg>
);

export const StockoutIcon = ({ className = '', style, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#7b1fa2"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M3 8l6 6 4-4 7 7" />
    <path d="M20 17v5" />
    <path d="M18 20l2 2l2-2" />
  </svg>
);

export const StartupPlannerIcon = ({ className = '', style, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#7b1fa2"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
    {...props}
  >
    {/* Notebook / checklist outline */}
    <path d="M6 4h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    {/* Text lines */}
    <path d="M9 9h6" />
    <path d="M9 13h6" />
    <path d="M9 17h3" />
    {/* Checkmark on the last item */}
    <path d="M13 16.5l1.5 1.5 2.5-2.5" />
  </svg>
);

export const CargoTruckIcon = ({ className = '', style, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#7b1fa2"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
    {...props}
  >
    {/* Truck body and cargo box */}
    <path d="M2 7h11v10H2z" />
    <path d="M13 10h4l3 3v4h-7z" />
    {/* Wheels */}
    <circle cx="6" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
    {/* Pallet under the box */}
    <path d="M3 21h9" />
  </svg>
);

export const TNVEDCheckIcon = ({ className = '', style, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#7b1fa2"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
    {...props}
  >
    {/* Sheet of paper */}
    <path d="M4 3h10l6 6v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    {/* Folded corner */}
    <path d="M14 3v6h6" />
    {/* Text lines on the sheet */}
    <path d="M7.5 12h5" />
    <path d="M7.5 15h3" />
    {/* Approval stamp */}
    <circle cx="8" cy="17" r="3.2" />
    <path d="M6.6 17l1 1 1.8-1.9" />
    {/* Magnifying glass */}
    <circle cx="17" cy="16" r="3.4" />
    <path d="M19.5 18.5L22 21" />
  </svg>
);

export const SEOCleanIcon = ({ className = '', style, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#7b1fa2"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
    {...props}
  >
    {/* Magic wand handle */}
    <path d="M3 21l4-4" />
    <path d="M5 17l6-6" />
    <path d="M15 3a2 2 0 0 1 2 2" />
    <path d="M15 3a2 2 0 0 0-2 2" />
    <path d="M15 3l2 2" />
    <path d="M19 13a2 2 0 1 1 0 4" />
    <path d="M17 15h4" />
    <path d="M21 11a2 2 0 0 1 0 4" />
    <path d="M19 13h2" />
    {/* Sparkles around the wand tip */}
    <path d="M12 2v3" />
    <path d="M12 5a2 2 0 0 0 0 4" />
    <path d="M12 5a2 2 0 0 1 0 4" />
    <path d="M12 2l-2 2" />
    <path d="M12 2l2 2" />
    <path d="M4 12h3" />
    <path d="M7 12a2 2 0 1 0 0 4" />
    <path d="M7 12a2 2 0 1 1 0 4" />
    <path d="M4 12l2-2" />
    <path d="M4 12l2 2" />
  </svg>
);

export const SplitCalculatorIcon = ({ className = '', style, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#7b1fa2"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
    {...props}
  >
    {/* Shield shape */}
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    {/* Percentage sign inside shield */}
    <circle cx="8.5" cy="15.5" r="1.5" />
    <circle cx="15.5" cy="8.5" r="1.5" />
    <path d="M7 17l10-10" />
  </svg>
);

export const EcoFeeIcon = ({ className = '', style, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#7b1fa2"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
    {...props}
  >
    {/* Recycling symbol - Mobius loop */}
    <path d="M7 11a4 4 0 0 1 4-4h.5a.5.5 0 0 1 .35.15l2 2a.5.5 0 0 1-.15.35H11v4a2 2 0 0 0 2 2h4a.5.5 0 0 1 .35.15l2 2a.5.5 0 0 1-.15.35H17v-4a4 4 0 0 1-4-4z" />
    <path d="M17 13a4 4 0 0 1-4 4h-.5a.5.5 0 0 1-.35-.15l-2-2a.5.5 0 0 1 .15-.35H13V9a2 2 0 0 0-2-2H7a.5.5 0 0 1-.35-.15L5 5a.5.5 0 0 1 .15-.35H7v4a4 4 0 0 1 4 4z" />
  </svg>
);

export const MarkingCodeIcon = ({ className = '', style, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#7b1fa2"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
    {...props}
  >
    {/* DataMatrix / QR grid outline */}
    <rect x="3" y="3" width="18" height="18" rx="2" />
    {/* Inner finder patterns (3 squares) */}
    <rect x="5" y="5" width="3" height="3" fill="#7b1fa2" />
    <rect x="16" y="5" width="3" height="3" fill="#7b1fa2" />
    <rect x="5" y="16" width="3" height="3" fill="#7b1fa2" />
    {/* Grid dots inside */}
    <circle cx="9" cy="9" r="0.8" />
    <circle cx="12" cy="9" r="0.8" />
    <circle cx="15" cy="9" r="0.8" />
    <circle cx="9" cy="12" r="0.8" />
    <circle cx="12" cy="12" r="0.8" />
    <circle cx="15" cy="12" r="0.8" />
    <circle cx="9" cy="15" r="0.8" />
    <circle cx="12" cy="15" r="0.8" />
    <circle cx="15" cy="15" r="0.8" />
    {/* Checkmark badge in bottom-right corner */}
    <path d="M15 15l3 3 3-3" />
    <path d="M15 15V12" />
    <path d="M18 15h0" />
  </svg>
);