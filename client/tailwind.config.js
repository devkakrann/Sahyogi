export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "on-error-container": "#93000a",
        "on-secondary-container": "#684000",
        "on-primary": "#ffffff",
        "secondary": "#855300",
        "surface-bright": "#f7f9fb",
        "on-primary-fixed-variant": "#005049",
        "surface-variant": "#e0e3e5",
        "surface-dim": "#d8dadc",
        "inverse-surface": "#2d3133",
        "on-tertiary": "#ffffff",
        "on-surface-variant": "#3d4947",
        "on-secondary-fixed": "#2a1700",
        "tertiary-fixed": "#ffdad7",
        "outline": "#6d7a77",
        "error-container": "#ffdad6",
        "error": "#ba1a1a",
        "surface-container-lowest": "#ffffff",
        "surface-container": "#eceef0",
        "on-tertiary-fixed": "#410004",
        "secondary-container": "#fea619",
        "inverse-primary": "#6bd8cb",
        "surface-container-low": "#f2f4f6",
        "surface": "#f7f9fb",
        "on-secondary": "#ffffff",
        "primary-fixed": "#89f5e7",
        "on-secondary-fixed-variant": "#653e00",
        "tertiary-fixed-dim": "#ffb3ad",
        "surface-tint": "#006a61",
        "background": "#f7f9fb",
        "outline-variant": "#bcc9c6",
        "secondary-fixed": "#ffddb8",
        "on-primary-fixed": "#00201d",
        "surface-container-highest": "#e0e3e5",
        "on-tertiary-container": "#fffbff",
        "secondary-fixed-dim": "#ffb95f",
        "primary-fixed-dim": "#6bd8cb",
        "on-primary-container": "#f4fffc",
        "primary": "#00685f",
        "inverse-on-surface": "#eff1f3",
        "on-tertiary-fixed-variant": "#930013",
        "tertiary-container": "#da3437",
        "on-background": "#191c1e",
        "primary-container": "#008378",
        "surface-container-high": "#e6e8ea",
        "tertiary": "#b61722",
        "on-surface": "#191c1e",
        "on-error": "#ffffff"
      },
      fontFamily: {
        "headline": ["Plus Jakarta Sans"],
        "body": ["Manrope"],
        "label": ["Manrope"]
      },
      borderRadius: {
        "DEFAULT": "1rem", 
        "lg": "2rem", 
        "xl": "3rem", 
        "full": "9999px"
      },
      animation: {
        scroll: 'scroll 30s linear infinite',
      },
      keyframes: {
        scroll: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        }
      }
    },
  },
  plugins: [],
};