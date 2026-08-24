import React, { useState, useRef, useMemo } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

const CALIBRATION_MODE: 'NONE' | 'BOX' | 'POLYGON' = 'NONE';
const IMAGE_ASPECT_RATIO = 11648 / 4800; // Intrinsic dimensions of the assemblage

interface Box {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Point {
  x: number;
  y: number;
}

const ARTWORKS: Box[] = [
  { "id": 1787419831574, "x": 1.1529592621060722, "y": 14.631024753483231, "w": 7.763259031514221, "h": 25.131621047732622 },
  { "id": 1787419843464, "x": 6.878306878306878, "y": 49.28044049555751, "w": 7.738095238095239, "h": 18.901263921912154 },
  { "id": 1787419853207, "x": 6.944444444444445, "y": 70.58440745839069, "w": 7.539682539682541, "h": 9.770992366412216 },
  { "id": 1787419860464, "x": 19.378306878306876, "y": 8.434488799899889, "w": 10.25132275132275, "h": 24.988111625578775 },
  { "id": 1787419867394, "x": 19.510582010582013, "y": 36.30584407458391, "w": 10.05291005291005, "h": 18.58090351645601 },
  { "id": 1787419876760, "x": 19.378306878306876, "y": 60.81341509197847, "w": 10.25132275132275, "h": 24.98811162557878 },
  { "id": 1787419888408, "x": 31.67989417989418, "y": 34.223501439119005, "w": 7.738095238095237, "h": 9.770992366412216 },
  { "id": 1787419896295, "x": 31.67989417989418, "y": 48.63971968464523, "w": 9.06084656084656, "h": 22.10486797647353 },
  { "id": 1787419903346, "x": 40.54232804232804, "y": 21.409085220873482, "w": 11.574074074074076, "h": 27.871355274684024 },
  { "id": 1787419911175, "x": 40.07936507936508, "y": 75.38981354023277, "w": 3.9682539682539613, "h": 9.931172569140273 },
  { "id": 1787419917137, "x": 57.804232804232804, "y": 25.894130897259416, "w": 7.671957671957678, "h": 24.507571017394568 },
  { "id": 1787419925370, "x": 52.050264550264544, "y": 55.68764860468026, "w": 11.375661375661387, "h": 27.71117507195595 },
  { "id": 1787419932203, "x": 68.98148148148148, "y": 1.7069202853209862, "w": 10.251322751322746, "h": 18.90126392191215 },
  { "id": 1787419941944, "x": 72.88359788359789, "y": 25.733950694531348, "w": 7.804232804232797, "h": 24.988111625578778 },
  { "id": 1787419952687, "x": 81.87830687830689, "y": 25.573770491803277, "w": 7.738095238095227, "h": 24.98811162557877 },
  { "id": 1787419961408, "x": 90.8068783068783, "y": 25.573770491803277, "w": 7.804232804232811, "h": 25.14829182830685 },
  { "id": 1787419967662, "x": 78.04232804232805, "y": 55.68764860468026, "w": 8.928571428571416, "h": 21.7845075710174 },
  { "id": 1787419974766, "x": 88.16137566137566, "y": 55.84782880740834, "w": 8.994708994709, "h": 21.944687773745464 },
  { "id": 1787419981708, "x": 72.81746031746032, "y": 82.918283068452, "w": 7.804232804232797, "h": 12.974596420973612 }
];

const leftClip = `polygon(0% 0%, 53.77% 0%, 53.77% 4.75%, 53.97% 51.84%, 47.95% 53.12%, 48.68% 98.94%, 48.68% 100%, 0% 100%)`;
const rightClip = `polygon(100% 0%, 100% 100%, 48.68% 100%, 48.68% 98.94%, 47.95% 53.12%, 53.97% 51.84%, 53.77% 4.75%, 53.77% 0%)`;

const App = () => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  React.useEffect(() => {
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Calibration State
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [drawing, setDrawing] = useState<{ startX: number, startY: number, currX: number, currY: number } | null>(null);
  
  // Polygon Cut State
  const [cutPoints, setCutPoints] = useState<Point[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);

  const imgUrl = '/images/painter/i-was-not-among/Display_I%20Was%20Not,%20Among%20My%20Kind,%20Distinctive.webp';
  const imgFallbackUrl = '/images/painter/i-was-not-among/Display_I%20Was%20Not,%20Among%20My%20Kind,%20Distinctive.jpg';

  // SCENES LOGIC
  const scenes = useMemo(() => {
    if (CALIBRATION_MODE !== 'NONE' || ARTWORKS.length === 0) {
      return [{ x: 0, y: 0, scale: 1 }];
    }
    const arr = [{ x: 0, y: 0, scale: 1 }]; // Start Overview

    ARTWORKS.forEach((box) => {
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      
      const boxWidthPx = (box.w / 100) * windowSize.w;
      const boxHeightPx = (box.h / 100) * (windowSize.w / IMAGE_ASPECT_RATIO);

      const maxW = windowSize.w < 768 ? 0.85 : 0.45; 
      const maxH = windowSize.w < 768 ? 0.70 : 0.65; 

      const scaleForWidth = (windowSize.w * maxW) / boxWidthPx;
      const scaleForHeight = (windowSize.h * maxH) / boxHeightPx;

      const targetScale = Math.min(scaleForWidth, scaleForHeight);
      
      const tx = (50 - cx) * targetScale;
      const ty = (50 - cy) * targetScale;
      
      arr.push({ x: tx, y: ty, scale: targetScale });
    });

    arr.push({ x: 0, y: 0, scale: 1 }); // End Overview
    return arr;
  }, [windowSize]);

  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [transitionDuration, setTransitionDuration] = useState(1.5);
  
  const [textRevealed, setTextRevealed] = useState(false);

  // Keyboard Navigation
  React.useEffect(() => {
    if (CALIBRATION_MODE !== 'NONE' || textRevealed) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      let nextIndex = currentSceneIndex;
      if (['ArrowRight', 'ArrowDown'].includes(e.key)) {
        nextIndex = Math.min(scenes.length - 1, currentSceneIndex + 1);
      } else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
        nextIndex = Math.max(0, currentSceneIndex - 1);
      }

      if (nextIndex !== currentSceneIndex) {
        e.preventDefault();
        
        const curr = scenes[currentSceneIndex];
        const target = scenes[nextIndex];
        
        const dx = target.x - curr.x;
        const dy = target.y - curr.y;
        const ds = Math.abs(target.scale - curr.scale) * 20; 
        const distance = Math.sqrt(dx * dx + dy * dy) + ds;
        
        const duration = 1.0 + distance * 0.005;
        
        setTransitionDuration(duration);
        setCurrentSceneIndex(nextIndex);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSceneIndex, scenes, textRevealed]);

  const isEndOrStart = currentSceneIndex === 0 || currentSceneIndex === scenes.length - 1;
  const uiOpacity = isEndOrStart ? 1 : 0;
  const titleOpacity = (isEndOrStart && !textRevealed) ? 1 : 0;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (CALIBRATION_MODE === 'NONE' || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    
    const xPct = (rawX / rect.width) * 100;
    const yPct = (rawY / rect.height) * 100;
    
    if (CALIBRATION_MODE === 'BOX') {
      setDrawing({ startX: xPct, startY: yPct, currX: xPct, currY: yPct });
    } else if (CALIBRATION_MODE === 'POLYGON') {
      setCutPoints([...cutPoints, { x: xPct, y: yPct }]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (CALIBRATION_MODE !== 'BOX' || !drawing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    
    const xPct = Math.max(0, Math.min(100, (rawX / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, (rawY / rect.height) * 100));
    
    setDrawing(prev => prev ? { ...prev, currX: xPct, currY: yPct } : null);
  };

  const handlePointerUp = () => {
    if (CALIBRATION_MODE !== 'BOX' || !drawing) return;
    const { startX, startY, currX, currY } = drawing;
    
    const bx = Math.min(startX, currX);
    const by = Math.min(startY, currY);
    const w = Math.abs(currX - startX);
    const h = Math.abs(currY - startY);
    
    if (w > 1 && h > 1) { 
      setBoxes([...boxes, { id: Date.now(), x: bx, y: by, w, h }]);
    }
    setDrawing(null);
  };

  const copyJson = () => {
    if (CALIBRATION_MODE === 'BOX') {
      navigator.clipboard.writeText(JSON.stringify(boxes, null, 2));
      alert("Copied artwork bounds to clipboard!");
    } else if (CALIBRATION_MODE === 'POLYGON') {
      navigator.clipboard.writeText(JSON.stringify(cutPoints, null, 2));
      alert("Copied polygon cut path to clipboard!");
    }
  };

  const clearBoxes = () => {
    setBoxes([]);
    setCutPoints([]);
  };

  const toggleText = () => {
    if (!textRevealed) {
      setCurrentSceneIndex(0);
      setTransitionDuration(2.0); // Smooth zoom out before text reveals
      setTextRevealed(true);
    } else {
      setTextRevealed(false);
    }
  };

  return (
    <>
      <style>{`
        body { margin: 0; background-color: #ffffff; overflow: hidden; }
        .ui-btn {
          position: fixed;
          bottom: 30px;
          color: rgba(0, 0, 0, 0.6);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          text-decoration: underline;
          padding: 8px 0;
          z-index: 50;
          transition: color 180ms ease;
          font-family: "Neue Haas Grotesk Text Pro", "Suisse Intl", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
          cursor: pointer;
          background: none;
          border: none;
        }
        .ui-btn:hover {
          color: rgba(0, 0, 0, 1);
        }
      `}</style>
      
      <motion.div 
        animate={{ opacity: titleOpacity }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
        style={{
          position: 'fixed',
          top: '76px',
          left: '84px',
          color: 'rgba(0, 0, 0, 0.82)',
          fontSize: '34px',
          fontWeight: 400,
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          zIndex: 50,
          pointerEvents: (isEndOrStart && !textRevealed) ? 'auto' : 'none',
          fontFamily: '"Neue Haas Grotesk Text Pro", "Suisse Intl", "Avenir Next", "Helvetica Neue", Arial, sans-serif'
        }}
      >
        I WAS NOT, AMONG MY KIND, DISTINCTIVE
      </motion.div>

      <motion.a 
        href="/painter.html"
        className="ui-btn"
        animate={{ opacity: uiOpacity }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
        style={{ left: '30px', pointerEvents: isEndOrStart ? 'auto' : 'none' }}
      >
        BACK
      </motion.a>

      <motion.button 
        onClick={toggleText}
        className="ui-btn"
        animate={{ opacity: uiOpacity }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
        style={{ right: '30px', pointerEvents: isEndOrStart ? 'auto' : 'none' }}
      >
        {textRevealed ? 'CLOSE TEXT' : 'ABOUT THIS WORK'}
      </motion.button>

      <div style={{ 
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: CALIBRATION_MODE !== 'NONE' ? 'auto' : 'none', backgroundColor: '#ffffff'
      }}>
        
        {/* TEXT BEHIND THE ARTWORK */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: textRevealed ? 1 : 0, y: textRevealed ? 0 : 20 }}
          transition={{ duration: 1.0, delay: textRevealed ? 0.6 : 0, ease: 'easeOut' }} // Delay fade in until split happens
          style={{ 
            position: 'absolute', width: '100vw', height: '100vh', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: textRevealed ? 'auto' : 'none',
            zIndex: 1
          }}
        >
          <div style={{ 
            maxWidth: '740px', padding: '0 40px',
            fontFamily: '"Neue Haas Grotesk Text Pro", "Suisse Intl", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
            color: 'rgba(0,0,0,0.85)', fontSize: '15px', lineHeight: '1.6', textAlign: 'left',
            maxHeight: '100vh', overflowY: 'auto'
          }}>
            <h2 style={{ fontSize: '26px', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '8px' }}>
              I Was Not Among My Kind, Distinctive
            </h2>
            <p style={{ fontStyle: 'italic', marginBottom: '32px', color: 'rgba(0,0,0,0.5)' }}>
              after Jane Hirshfield
            </p>
            <p style={{ marginBottom: '16px' }}>
              At a time when the world is ravaged by violence — one country trying to occupy another, one tribe to dominate another, one body to forcefully possess another — these works return to our wounds. They underscore a fundamental error in how we understand reality: that we are somehow separate from one another. That we exist independently, or ever could. As if existence were ever insular.
            </p>
            <p style={{ marginBottom: '16px' }}>
              I burn the canvas. Fire is the least discriminating mark-maker there is: it does not ask what a surface was going to become, and it works by taking away rather than adding. What remains is not a wound that will close — a burn removes material, and nothing arrives to fill it. I call these infractions. The word is mild in the way official language is mild, and I want that mildness to sit badly against something this final.
            </p>
            <p style={{ marginBottom: '16px' }}>
              Each mark is small in a wide white field. Most of the surface is untouched, and still the burn organizes everything around it. On one panel the burns are set in a grid of sixteen: repetition rather than event, because suffering is not exceptional — it is the condition we hold in common. One panel appears unmarked. Not everything that has been burnt shows.
            </p>
            <p style={{ marginBottom: '16px' }}>
              The work is an assemblage — separate panels, separately framed, hung so that the wall between them belongs to the composition. No panel is complete alone. So strong are our in-group biases that we forget there is one group, and all of us are in it. The world is a web of causes so dense that no thread can be pulled without moving the whole. The sub-groups we defend are narrow definitions that, in claiming to honour our uniqueness, negate it.
            </p>
            <p>
              The separateness is the illusion, not the kinship. And if even one of us is not free, none of us are free.
            </p>
          </div>
        </motion.div>

        {/* CAMERA (THE ARTWORKS) */}
        <motion.div 
          animate={CALIBRATION_MODE !== 'NONE' ? { x: 0, y: 0, scale: 1 } : { 
            x: `${scenes[currentSceneIndex].x}%`, 
            y: `${scenes[currentSceneIndex].y}%`, 
            scale: scenes[currentSceneIndex].scale 
          }}
          transition={{ 
            duration: transitionDuration,
            ease: [0.3, 0, 0.2, 1] 
          }}
          style={{ 
            position: 'absolute', 
            width: '100vw', 
            aspectRatio: `${IMAGE_ASPECT_RATIO}`,
            transformOrigin: '50% 50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2 // Sit above the text
          }}
        >
          <div 
            ref={containerRef}
            style={{ width: '100%', height: '100%', position: 'relative' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* LEFT HALF */}
            <motion.picture style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, display: 'block' }}>
              <source srcSet={imgUrl} type="image/webp" />
              <motion.img 
                src={imgFallbackUrl}
                alt="Assemblage Left"
                draggable={false}
                onLoad={() => setImageLoaded(true)}
                animate={{ 
                  x: textRevealed ? '-35%' : '0%', 
                  opacity: imageLoaded ? 1 : 0 
                }}
                transition={{ 
                  duration: 1.8, 
                  ease: [0.76, 0, 0.24, 1], // Cinematic slow split
                  opacity: { duration: 1.5 }
                }}
                style={{
                  width: '100%', height: '100%', objectFit: 'fill', 
                  clipPath: leftClip,
                  display: 'block',
                  cursor: CALIBRATION_MODE !== 'NONE' ? 'crosshair' : 'default'
                }}
              />
            </motion.picture>

            {/* RIGHT HALF */}
            <motion.picture style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, display: 'block' }}>
              <source srcSet={imgUrl} type="image/webp" />
              <motion.img 
                src={imgFallbackUrl}
                alt="Assemblage Right"
                draggable={false}
                animate={{ 
                  x: textRevealed ? '35%' : '0%', 
                  opacity: imageLoaded ? 1 : 0 
                }}
                transition={{ 
                  duration: 1.8, 
                  ease: [0.76, 0, 0.24, 1], // Cinematic slow split
                  opacity: { duration: 1.5 }
                }}
                style={{
                  width: '100%', height: '100%', objectFit: 'fill', 
                  clipPath: rightClip,
                  display: 'block'
                }}
              />
            </motion.picture>
          </div>
        </motion.div>
      </div>

      {CALIBRATION_MODE === 'NONE' && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: imageLoaded ? 1 : 0 }} transition={{ delay: 1, duration: 1 }}
          style={{
            position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
            pointerEvents: 'none', zIndex: 10
          }}
        >
          <motion.div 
            animate={{ opacity: uiOpacity }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            style={{
              color: 'rgba(0, 0, 0, 0.4)', fontFamily: '"Neue Haas Grotesk Text Pro", sans-serif',
              letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: '12px',
              textAlign: 'center', whiteSpace: 'nowrap'
            }}
          >
            Use Left/Right arrow keys to explore (19 Artworks)
          </motion.div>
        </motion.div>
      )}
    </>
  );
};

export default App;
