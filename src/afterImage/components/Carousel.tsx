import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, animate } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import Card from './Card';

interface CarouselProps {
  images: string[];
}

const Carousel: React.FC<CarouselProps> = ({ images }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1000);
  
  // Balanced scale so it is large but comfortable
  const slideWidth = Math.min(650, windowWidth * 0.45);
  const slideHeight = slideWidth; 
  // Step controls how many pixels you must drag to shift one card
  const step = slideWidth * 0.55; 
  const count = images.length;
  
  // Raw drag value
  const x = useMotionValue(0);
  // Extremely heavy mass for the visual spring so it feels like a heavy physical object
  const smoothedX = useSpring(x, { damping: 40, stiffness: 120, mass: 8 });

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    // Initial centering
    snapTo(0);
    return () => window.removeEventListener('resize', handleResize);
  }, [windowWidth]);

  // Calculates the raw X coordinate required to perfectly center a specific index
  const getCenterForIndex = (index: number) => {
    // The total width of all cards before this index
    const totalOffset = index * step;
    // We want to push the container right by half the window width,
    // and pull it left by half a card width, plus the total offset to reach that card
    return (windowWidth / 2) - (slideWidth / 2) - totalOffset;
  };

  const snapTo = (index: number) => {
    const targetIndex = Math.max(0, Math.min(count - 1, index));
    const targetX = getCenterForIndex(targetIndex);
    x.set(targetX); 
  };

  // Accumulator for smooth wheel scrolling
  const wheelTarget = useRef(x.get());
  // Base offset for accurate panning
  const panStartX = useRef(0);

  const handlePanStart = () => {
    panStartX.current = x.get();
    wheelTarget.current = x.get();
  };

  const handlePan = (e: any, info: PanInfo) => {
    x.set(panStartX.current + info.offset.x);
  };

  const handlePanEnd = (e: any, info: PanInfo) => {
    const velocity = info.velocity.x;
    const currentX = x.get();
    
    // Project where the velocity would naturally take us
    const projectedX = currentX + velocity * 0.15;
    snapToClosest(projectedX);
  };

  const snapToClosest = (targetX: number) => {
    const centerTarget = (windowWidth / 2) - (slideWidth / 2);
    const shift = targetX - centerTarget;
    const nearestMultiple = Math.round(shift / step) * step;
    const finalX = centerTarget + nearestMultiple;
    
    // Sync accumulator so the next wheel event doesn't jump
    wheelTarget.current = finalX;
    
    // Heavy physical snap
    animate(x, finalX, {
      type: "spring",
      damping: 35,
      stiffness: 100,
      mass: 8
    });
  };

  // Wheel handling for scrolling
  const wheelTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY || e.deltaX;
    
    // Accumulate the virtual target for smooth continuous scrolling
    wheelTarget.current -= delta * 0.8;
    x.set(wheelTarget.current);

    if (wheelTimeout.current) clearTimeout(wheelTimeout.current);
    wheelTimeout.current = setTimeout(() => {
      snapToClosest(x.get());
    }, 150);
  };

  return (
    <div className="carousel-viewport" ref={containerRef} onWheel={handleWheel}>
      
      {/* Invisible interaction layer that handles panning without moving */}
      <motion.div
        onPanStart={handlePanStart}
        onPan={handlePan}
        onPanEnd={handlePanEnd}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1000,
          cursor: "grab"
        }}
        whileTap={{ cursor: "grabbing" }}
      />

      {/* Rendering layer */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {images.map((src, i) => (
          <Card 
            key={i}
            index={i}
            src={src}
            containerX={smoothedX} // Pass the smoothed spring value down
            windowWidth={windowWidth}
            slideWidth={slideWidth}
            slideHeight={slideHeight}
            step={step}
            count={count}
          />
        ))}
      </div>
    </div>
  );
};

export default Carousel;
