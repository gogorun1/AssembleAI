import { useMemo } from 'react';

export interface TokenColors {
  paperRaised: string;
  paperSunken: string;
  ink: string;
  inkSoft: string;
  line: string;
  accent: string;
  ok: string;
}

const FALLBACK: TokenColors = {
  paperRaised: 'white',
  paperSunken: 'beige',
  ink: 'black',
  inkSoft: 'gray',
  line: 'gray',
  accent: 'orange',
  ok: 'green'
};

/** Read the product design tokens off :root so three.js materials match the UI. */
export function useTokenColors(): TokenColors {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return FALLBACK;
    }

    const style = getComputedStyle(document.documentElement);
    const read = (name: string) => style.getPropertyValue(name).trim();
    return {
      paperRaised: read('--paper-raised') || FALLBACK.paperRaised,
      paperSunken: read('--paper-sunken') || FALLBACK.paperSunken,
      ink: read('--ink') || FALLBACK.ink,
      inkSoft: read('--ink-soft') || FALLBACK.inkSoft,
      line: read('--line') || FALLBACK.line,
      accent: read('--accent') || FALLBACK.accent,
      ok: read('--ok') || FALLBACK.ok
    };
  }, []);
}
