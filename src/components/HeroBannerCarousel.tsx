import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface HeroBannerCarouselProps {
  imageUrls: string[];
}

/**
 * HeroBannerCarousel
 * Renders an ambient, auto-playing background carousel of hero banner images.
 * Assumption: The component is absolutely positioned inside a relative container (absolute inset-0).
 */
export function HeroBannerCarousel({ imageUrls }: HeroBannerCarouselProps) {
  // Defensive guard against empty/null array
  const activeUrls = imageUrls.filter(Boolean);
  const count = activeUrls.length;

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (count <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % count);
    }, 5000);

    return () => clearInterval(interval);
  }, [count]);

  if (count === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-950">
      <AnimatePresence mode="popLayout">
        <motion.img
          key={activeUrls[currentIndex]}
          src={activeUrls[currentIndex]}
          alt=""
          loading="eager"
          // @ts-ignore - fetchPriority is an emerging standard and may not be fully typed in all TS versions
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        />
      </AnimatePresence>

      {/* Gradient scrim overlay to ensure text sitting on top is highly legible */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/20" />
    </div>
  );
}
