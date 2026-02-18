import { useEffect } from 'react'

const STYLES = `
/* --- GLOBAL CSS --- */
:root {
  --font-inter: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

  /* Theme Variables - New Minimal Palette */
  --bg-base: #f7f7f9;
  --accent-primary: #a5c9ff;
  --bg-soft: #e3f2fd;
  --accent-secondary: #ffe2de;
  --color-border: #dadada;
  --text-dark: #1f2937;
  --cta-blue: #3b82f6;
  --cta-dark: #2563eb;
}

/* Base Utility Overrides */
.reveal-fade { opacity: 0; visibility: hidden; }

html.lenis, html.lenis body { height: auto; }
.lenis.lenis-smooth { scroll-behavior: auto !important; }
.lenis.lenis-stopped { overflow: hidden; }
`

export const StylesInjection = () => {
  useEffect(() => {
    // Inject Inter Font
    const link = document.createElement('link')
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
    link.rel = "stylesheet"
    document.head.appendChild(link)

    // Inject Styles
    const styleId = 'talentops-minimal-styles'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.innerHTML = STYLES
      document.head.appendChild(style)
    }
  }, [])
  return null
}
