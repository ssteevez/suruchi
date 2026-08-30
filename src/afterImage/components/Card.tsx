import React from 'react';
import { motion, MotionValue, useTransform, useVelocity, useSpring } from 'framer-motion';

interface CardProps {
  index: number;
  src: string;
  title: string;
  description: string;
  containerX: MotionValue<number>;
  windowWidth: number;
  slideWidth: number;
  slideHeight: number;
  step: number;
  count: number;
}

const Card: React.FC<CardProps> = ({ 
  index, 
  src, 
  title,
  description,
  containerX, 
  windowWidth,
  slideWidth, 
  slideHeight, 
  step,
  count
}) => {
  const contentWidth = count * step;
  
  const getWrappedDist = (v: number) => {
    const centerTarget = (windowWidth / 2) - (slideWidth / 2);
    // Absolute virtual position of this card
    const virtualX = (index * step) + v;
    // Distance from the center target
    const distFromCenter = virtualX - centerTarget;
    
    // Wrap the distance between -contentWidth/2 and +contentWidth/2
    const halfContent = contentWidth / 2;
    const wrap = (val: number, max: number) => ((val % max) + max) % max;
    
    return wrap(distFromCenter + halfContent, contentWidth) - halfContent;
  };

  // wrappedDist is exactly 0 when the card is perfectly centered.
  const wrappedDist = useTransform(containerX, (v) => getWrappedDist(v));
  
  // ── ASYMMETRIC STACK (INFINITE LEFT LOOP) ──
  const range = [
    -step * 4,
    -step * 3,
    -step * 2,
    -step,
    0,
    step,
    step * 2,
    step * 3,
    step * 4
  ];

  // X offset: Deep spread on the left, rapid exit on the right
  const x = useTransform(wrappedDist, range, [
    -slideWidth * 1.6, 
    -slideWidth * 1.2, 
    -slideWidth * 0.8, 
    -slideWidth * 0.4, 
    0, 
    slideWidth * 0.5, 
    slideWidth * 1.0, 
    slideWidth * 1.5, 
    slideWidth * 2.0
  ]);

  // Scale: Shrink heavily into the distance on the left
  const scale = useTransform(wrappedDist, range, [
    0.4, 0.55, 0.7, 0.85, 1, 
    0.9, 0.9, 0.9, 0.9 // Exit right without shrinking much
  ]);

  // Opacity: Build up smoothly on left, instantly disappear on right
  const opacity = useTransform(wrappedDist, range, [
    0, 0.1, 0.3, 0.6, 1, 
    0, 0, 0, 0 // No stack on the right! Fades to 0 before the next step.
  ]);

  // ── DYNAMIC LIGHTING ENGINE ──
  // Shading (Ambient Occlusion): Cards get darker as they recede into the left stack
  const shadowOpacity = useTransform(wrappedDist, range, [
    0.8, 0.7, 0.5, 0.2, 0, 
    0, 0, 0, 0
  ]);

  // Incident Light: A soft spotlight that illuminates the active card from the front
  const incidentOpacity = useTransform(wrappedDist, [-step, 0, step], [0, 1, 0]);

  // RotateY: Turn strongly inward from the left to show off the 3D edge thickness
  const rotateY = useTransform(wrappedDist, range, [
    60, 45, 30, 15, 0, 
    -10, -10, -10, -10
  ]);

  // Z-index sorting
  const zIndex = useTransform(wrappedDist, (d) => Math.round(1000 - Math.abs(d)));

  return (
    <motion.div 
      style={{
        position: 'absolute',
        right: '25vw',
        marginRight: -(slideWidth / 2),
        top: '50%',
        marginTop: -(slideHeight / 2),
        width: slideWidth,
        height: slideHeight,
        x,
        scale,
        opacity,
        rotateY,
        zIndex,
        transformPerspective: 1800,
        transformStyle: 'preserve-3d',
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#050505',
        borderRadius: 8,
        overflow: 'hidden',
        // Clean, ultra-heavy drop shadow for physical weight
        boxShadow: "0 60px 120px -20px rgba(0,0,0,1), 0 30px 60px -30px rgba(0,0,0,0.8)", 
      }}>
        <img 
          src={src} 
          alt="" 
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none'
          }}
        />
        
        {/* Gallery Spotlight (Strong incident light from top-center, casting shadows to the edges) */}
        <motion.div 
          style={{
            position: 'absolute',
            inset: 0,
            // A literal spotlight effect: 25% white at the top, fading into 70% black at the bottom corners
            background: 'radial-gradient(circle at 50% -20%, rgba(255,255,255,0.25) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.7) 100%)',
            opacity: incidentOpacity,
            pointerEvents: 'none'
          }} 
        />
        
        {/* Ambient Shading Overlay (Darkens cards in the background) */}
        <motion.div 
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#000',
            opacity: shadowOpacity,
            pointerEvents: 'none'
          }} 
        />
      </div>

      {/* Description Tag - Only visible when the card is in focus */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: '-35px',
          left: 0,
          width: '100%',
          textAlign: 'center',
          opacity: incidentOpacity, // Reuse incident lighting to fade text naturally!
          color: 'rgba(255, 255, 255, 0.65)',
          fontSize: '11px',
          letterSpacing: '0.04em',
          fontFamily: '"Neue Haas Grotesk Text Pro", -apple-system, sans-serif',
          pointerEvents: 'none'
        }}
      >
        {description}
      </motion.div>
    </motion.div>
  );
};

export default Card;
