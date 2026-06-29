/**
 * AutoClutch Design Tokens
 * Based on DESIGN.md (Intelligent Speed philosophy)
 */

export const Colors = {
  // Base background & surfaces (Deep Indigo seed)
  bgBase: '#1A1244',
  surfaceBase: '#13121b',
  surfaceCard: '#20184e', // 24px rounded card surfaces
  surfaceContainer: '#1b1348', // 5-8% lighter tint
  surfaceContainerHigh: '#271f5c', // Elevated panels / inputs
  surfaceContainerHighest: '#332b6e',
  
  // Primary action colors (Indigo-Violet seed)
  primary: '#5B4FE3',
  primaryHover: '#4232CA',
  primaryGlow: 'rgba(91, 79, 227, 0.25)',
  primaryGlowStrong: 'rgba(91, 79, 227, 0.4)',
  
  // Text colors
  onSurface: '#e4e1ed', // Near-white lavender tint
  onSurfaceVariant: '#c8c4d7', // Muted lavender-grey
  
  // Accent & Status colors
  tertiary: '#ffb4a6', // Coral/Amber accent for celebrations/highlights
  urgent: '#ff5a5a', // Red-Coral for at-risk tasks
  success: '#10b981', // Calm desaturated Green for completed
  
  // Borders
  borderGlass: 'rgba(255, 255, 255, 0.08)',
  borderActive: '#5B4FE3',
};

export const Radii = {
  sm: '4px',
  input: '12px', // 12px inputs as required
  card: '24px',  // 24px cards as required
  pill: '9999px', // Pill buttons
};

export const Spacing = {
  unit: '4px',
  gutterDesktop: '24px',
  marginDesktop: '40px',
  gutterMobile: '16px',
  marginMobile: '20px',
  sidebarWidth: '280px',
};

export const Typography = {
  fontSans: 'Manrope, sans-serif',
  fontMono: 'JetBrains Mono, monospace',
};

// spring motion (stiffness 300, damping 20) as requested
export const MotionSpring = {
  type: 'spring',
  stiffness: 300,
  damping: 20,
};
