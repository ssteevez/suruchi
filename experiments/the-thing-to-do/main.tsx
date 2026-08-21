import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

type Stamp = {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
};

const App = () => {
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [cursorPos, setCursorPos] = useState({ x: -1000, y: -1000 });
  const [cursorVisible, setCursorVisible] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    
    const handleMouseEnter = () => setCursorVisible(true);
    const handleMouseLeave = () => setCursorVisible(false);

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    // Prevent stamping if clicking on UI elements like the back button
    if ((e.target as HTMLElement).closest('a')) return;

    // Slight randomness to make it feel hand-stamped
    const rotation = (Math.random() - 0.5) * 4; // -2 to +2 degrees
    const scale = 0.95 + Math.random() * 0.1; // 0.95 to 1.05
    const opacity = 0.75 + Math.random() * 0.2; // 0.75 to 0.95

    setStamps(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        x: e.clientX,
        y: e.clientY,
        rotation,
        scale,
        opacity
      }
    ]);
  };

  return (
    <div 
      style={{ width: '100vw', height: '100vh', cursor: 'none', position: 'relative' }} 
      onClick={handleClick}
    >
      {/* Existing Stamps */}
      {stamps.map((stamp) => (
        <div
          key={stamp.id}
          style={{
            position: 'absolute',
            left: stamp.x,
            top: stamp.y,
            transform: `translate(-50%, -50%) rotate(${stamp.rotation}deg) scale(${stamp.scale})`,
            fontFamily: '"Stardos Stencil", cursive',
            fontSize: '5vw',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            color: '#111',
            opacity: stamp.opacity,
            pointerEvents: 'none',
            filter: 'url(#graffiti-simple)', // Apply SVG roughness
            textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
            mixBlendMode: 'multiply'
          }}
        >
          THE THING TO DO IS TO DO NOTHING
        </div>
      ))}

      {/* Floating Ghost Cursor */}
      {cursorVisible && (
        <div
          style={{
            position: 'fixed',
            left: cursorPos.x,
            top: cursorPos.y,
            transform: 'translate(-50%, -50%) scale(1.0)',
            fontFamily: '"Stardos Stencil", cursive',
            fontSize: '5vw',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            color: 'rgba(17, 17, 17, 0.3)', // Ghostly preview
            pointerEvents: 'none',
            zIndex: 9999,
            transition: 'opacity 0.15s ease',
          }}
        >
          THE THING TO DO IS TO DO NOTHING
        </div>
      )}
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
