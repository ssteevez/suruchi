import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { PHOTOGRAM_IMAGES } from './images';

function App() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const transitioningRef = useRef(false);
  const lastScrollRef = useRef(0);

  useEffect(() => {
    const handleNav = (dir: number) => {
      const now = performance.now();
      if (now - lastScrollRef.current < 1000 || transitioningRef.current) return;
      
      lastScrollRef.current = now;
      transitioningRef.current = true;
      setOpacity(0);

      setTimeout(() => {
        setActiveIndex(prev => {
          if (dir > 0) return (prev + 1) % PHOTOGRAM_IMAGES.length;
          return (prev - 1 + PHOTOGRAM_IMAGES.length) % PHOTOGRAM_IMAGES.length;
        });

        setTimeout(() => {
          setOpacity(1);
          setTimeout(() => {
            transitioningRef.current = false;
          }, 800);
        }, 100);
      }, 800);
    };

    const onWheel = (e: WheelEvent) => {
      const dir = Math.sign(e.deltaY);
      if (dir !== 0) handleNav(dir);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        handleNav(1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        handleNav(-1);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#050506',
    }}>
      {/* Nudge tip shown only on the first (vertical) image */}
      <div style={{
        position: 'absolute',
        right: '10%',
        top: '50%',
        transform: 'translateY(-50%)',
        color: 'rgba(245, 245, 245, 0.45)',
        fontFamily: '"Neue Haas Grotesk Text Pro", "Suisse Intl", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
        fontSize: '12px',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        maxWidth: '180px',
        textAlign: 'center',
        lineHeight: '1.8',
        pointerEvents: 'none',
        opacity: activeIndex === 0 && opacity === 1 ? 1 : 0,
        transition: 'opacity 800ms ease-in-out',
        zIndex: 20
      }}>
        Scroll or use arrow keys to navigate
      </div>

      <img 
        src={PHOTOGRAM_IMAGES[activeIndex]} 
        alt="Photogram" 
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          opacity: opacity,
          transition: 'opacity 800ms ease-in-out',
        }}
      />
      
      {/* Noise overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 10,
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.06%22/%3E%3C/svg%3E")',
        mixBlendMode: 'overlay'
      }} />
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
