"use client";

import { useEffect } from "react";

// Adds the `.in` class to every `.reveal` element once it scrolls into view.
// Renders nothing. Under `prefers-reduced-motion` the CSS already shows
// `.reveal` content without animation, so the observer is harmless there.
export function Reveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");

    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, []);

  return null;
}
