import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

// --------------------------------------------------------
// GLOBAL STATE & CONSTANTS
// --------------------------------------------------------
const IMAGES = [
  'IMG_1373.jpg',
  'IMG_1384.jpg',
  'IMG_1387.jpg',
  'IMG_1388.jpg',
  'IMG_1535.jpg',
  'IMG_1553.jpg'
];
const CYLINDER_RADIUS = 3;
const CYLINDER_HEIGHT = 4.5;
const IMAGE_DIR = '/images/painter/i-was-not-among';

// The physics scroll tracker
const scrollState = {
  target: 0,
  current: 0,
  velocity: 0
};

// --------------------------------------------------------
// UTILS
// --------------------------------------------------------
// Simple linear interpolation
const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

// --------------------------------------------------------
// COMPONENTS
// --------------------------------------------------------

const ImageSegment = ({ url, index, segments, radius, height }: { url: string, index: number, segments: number, radius: number, height: number }) => {
  const texture = useLoader(THREE.TextureLoader, url);
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  
  const angleLength = (Math.PI * 2) / segments;
  const startAngle = index * angleLength;
  
  // The plane width is exactly the arc length of the cylinder when closed
  const planeWidth = (Math.PI * 2 * radius) / segments * 0.98; // 2% visual gap
  
  // Custom uniform to dynamically control the curvature of the plane
  const uniforms = useMemo(() => ({
    uRadius: { value: radius }
  }), [radius]);

  const onBeforeCompile = (shader: any) => {
    shader.uniforms.uRadius = uniforms.uRadius;
    shader.vertexShader = `
      uniform float uRadius;
      ${shader.vertexShader}
    `;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      // Map the flat x coordinate to an angle along the circle
      float theta = position.x / uRadius;
      
      vec3 transformed = vec3(position);
      
      // Bend the plane into a perfect cylindrical arc
      transformed.x = sin(theta) * uRadius;
      // Subtract uRadius so the center of the plane stays at local z=0
      transformed.z = cos(theta) * uRadius - uRadius;
      `
    );
  };

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const p = scrollState.current;
    
    // Showcase wide gap during intro (0.05 to 0.35), close gap (0.35 to 0.45)
    let currentRadius = radius;
    if (p < 0.35) {
      currentRadius = radius + 8.0;
    } else if (p < 0.45) {
      const t = (p - 0.35) / 0.10;
      const ease = t * t * (3 - 2 * t);
      currentRadius = lerp(radius + 8.0, radius, ease);
    }
    
    // Update the shader uniform so the physical curvature updates smoothly
    uniforms.uRadius.value = currentRadius;
    
    // Move the plane outward to match its new radius
    meshRef.current.position.z = currentRadius;
    
    // Fade in material quickly after pure text intro
    if (materialRef.current) {
      if (p < 0.05) {
        materialRef.current.opacity = 0;
      } else if (p < 0.15) {
        materialRef.current.opacity = (p - 0.05) / 0.10;
      } else if (p > 0.95) {
        // Fade out to pure black at the very end so the loop jump is seamless!
        materialRef.current.opacity = 1.0 - (p - 0.95) / 0.05;
      } else {
        materialRef.current.opacity = 1;
      }
    }

    const v = Math.abs(scrollState.velocity);
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    let targetOpacity = Math.min(1.0, 0.4 + v * 10.0);
    if (scrollState.current < 0.05) targetOpacity = 0;
    mat.opacity = lerp(mat.opacity, targetOpacity, delta * 5.0);
  });

  return (
    <group rotation={[0, startAngle, 0]}>
      {/* Position is handled dynamically in useFrame */}
      <mesh ref={meshRef}>
        <planeGeometry args={[planeWidth, height, 32, 1]} />
        <meshBasicMaterial 
          ref={materialRef} 
          map={texture} 
          transparent 
          side={THREE.DoubleSide}
          onBeforeCompile={onBeforeCompile}
        />
      </mesh>
    </group>
  );
};

const CylinderAssembly = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = scrollState.current * Math.PI * 5.71; 
    }
  });

  return (
    <group ref={groupRef}>
      {IMAGES.map((filename, i) => (
        <ImageSegment 
          key={filename} 
          url={`${IMAGE_DIR}/${filename}`} 
          index={i} 
          segments={IMAGES.length} 
          radius={CYLINDER_RADIUS} 
          height={CYLINDER_HEIGHT} 
        />
      ))}
    </group>
  );
};

const Particles = () => {
  const count = 300;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  // Pre-compute orbital positions
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => {
    return Array.from({ length: count }, () => {
      // Spread them around a larger cylinder
      const angle = Math.random() * Math.PI * 2;
      const radius = CYLINDER_RADIUS + 0.5 + Math.random() * 4;
      const height = (Math.random() - 0.5) * 12;
      const speed = 0.2 + Math.random() * 0.5;
      return { angle, radius, height, speed };
    });
  }, [count]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    // React to the scroll velocity
    const v = Math.abs(scrollState.velocity);
    // Base speed + velocity-driven speed
    const globalSpeedMultiplier = 1.0 + v * 50.0; 
    
    particles.forEach((p, i) => {
      // Orbit them
      p.angle += p.speed * delta * globalSpeedMultiplier;
      
      const x = Math.cos(p.angle) * p.radius;
      const z = Math.sin(p.angle) * p.radius;
      
      dummy.position.set(x, p.height, z);
      // Small fixed size for dots/speckles instead of stretching lines
      dummy.scale.set(1, 1, 1);
      dummy.rotation.y = -p.angle; 
      
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    
    // Fade opacity based on velocity, and hide during pure text intro & final void
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    let targetOpacity = Math.min(0.6, 0.1 + v * 15.0);
    if (scrollState.current < 0.05) targetOpacity = 0;
    if (scrollState.current > 0.95) targetOpacity = 0;
    mat.opacity = lerp(mat.opacity, targetOpacity, delta * 5.0);
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.03, 8, 8]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  );
};

const CameraController = () => {
  useFrame((state, delta) => {
    const p = scrollState.current;
    
    let targetX = 0, targetY = 0, targetZ = 8;
    
    if (p < 0.05) {
      // 0.0 - 0.05: Pure Text Intro
      targetX = 0; targetY = 0; targetZ = 16;
    } else if (p < 0.35) {
      // 0.05 - 0.35: Massive, slow showcase of the wide plane carousel!
      const t = (p - 0.05) / 0.30;
      const ease = t * t * (3 - 2 * t);
      targetX = lerp(0, 0, ease);
      targetY = 0;
      targetZ = lerp(24, 16, ease); // Camera starts far back to capture the 8.0 extra radius
    } else if (p < 0.45) {
      // 0.35 - 0.45: Gap closes, camera rises up and OVER the rim to dive inside!
      const t = (p - 0.35) / 0.10;
      const ease = t * t * (3 - 2 * t);
      targetX = lerp(0, 0, ease);
      targetY = lerp(0, 2.5, ease);
      targetZ = lerp(16, 6, ease);
    } else if (p < 0.65) {
      // 0.45 - 0.65: Cinematic Sway (Inside the cylinder)
      const t = (p - 0.45) / 0.20;
      const ease = t * t * (3 - 2 * t);
      targetX = Math.sin(ease * Math.PI) * 1.5; 
      targetY = 2.5; 
      targetZ = lerp(6, 3, ease);
    } else {
      // 0.65 - 1.0: Deep tunnel push (Text P2-P5 arrives here!)
      const t = (p - 0.65) / 0.35;
      const ease = t * t * (3 - 2 * t);
      targetX = 0;
      targetY = 2.5;
      targetZ = lerp(3, 0.5, ease);
    }
    
    // Apply directly (smoothness is driven by scrollState.current which is already sprung)
    state.camera.position.set(targetX, targetY, targetZ);
    // Always look at the center of the cylinder
    state.camera.lookAt(0, 0, 0);
  });

  return null;
};

// --------------------------------------------------------
// PHYSICS & APP
// --------------------------------------------------------

const ScrollPhysics = () => {
  useFrame((state, delta) => {
    // Basic spring physics (similar to ScrollSmoother)
    const dt = Math.min(delta, 0.1);
    const diff = scrollState.target - scrollState.current;
    
    const stiffness = 8.0; 
    const damping = 2.0 * Math.sqrt(stiffness);

    const acceleration = diff * stiffness - scrollState.velocity * damping;
    scrollState.velocity += acceleration * dt;
    scrollState.current += scrollState.velocity * dt;
  });
  return null;
};

const getFade = (p: number, inStart: number, inEnd: number, outStart: number, outEnd: number) => {
  if (p <= inStart) return 0;
  if (p >= outEnd) return 0;
  if (p > inEnd && p < outStart) return 1;
  if (p >= inStart && p <= inEnd) {
    return (p - inStart) / (inEnd - inStart);
  }
  if (p >= outStart && p <= outEnd) {
    return 1.0 - (p - outStart) / (outEnd - outStart);
  }
  return 0;
};

const HTMLOverlay = () => {
  const [p, setP] = useState(0);
  
  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      setP(scrollState.current);
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Title and P1 are visible at 0%, and vanish on the very first scroll!
  const oIntro = getFade(p, -1, 0, 0.02, 0.05);
  
  // P2-P5 arrive ONLY in the final deep push phase (0.65 to 1.0)
  const o2 = getFade(p, 0.65, 0.67, 0.72, 0.74);
  const o3 = getFade(p, 0.74, 0.76, 0.81, 0.83);
  const o4 = getFade(p, 0.83, 0.85, 0.90, 0.92);
  const o5 = getFade(p, 0.92, 0.94, 1.00, 1.10); // Stays visible at the very end

  // Scroll prompt vanishes instantly
  const promptOpacity = p < 0.02 ? 1.0 - (p / 0.02) : 0;

  const fontStyle = {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
  };

  const centerTextStyle: React.CSSProperties = {
    ...fontStyle,
    position: 'absolute',
    top: '55%', left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '80%', maxWidth: '700px',
    textAlign: 'center',
    fontSize: '1.6rem',
    lineHeight: '1.6',
    fontWeight: 400,
    margin: 0,
    pointerEvents: 'none',
  };

  const bottomTextStyle: React.CSSProperties = {
    ...fontStyle,
    position: 'absolute',
    bottom: '5%', left: '50%',
    transform: 'translateX(-50%)',
    width: '60%', maxWidth: '600px',
    textAlign: 'center',
    fontSize: '1.4rem',
    lineHeight: '1.6',
    fontWeight: 400,
    margin: 0,
    pointerEvents: 'none',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10, mixBlendMode: 'difference' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300&display=swap');
        @keyframes scrollBounce {
          0%, 100% { transform: translate(-50%, 0); }
          50% { transform: translate(-50%, 10px); }
        }
      `}</style>

      {/* Global Suruchi Choksi Header Overlay (Fades out with intro) */}
      <header id="zp-header" style={{ opacity: oIntro }}>
        <span className="zp-line-wrap">
          <a className="zp-name-line zp-name-link" href="/" aria-label="Back to homepage" style={{ pointerEvents: oIntro > 0.5 ? 'auto' : 'none' }}>Suruchi</a>
        </span>
        <span className="zp-line-wrap">
          <a className="zp-name-line zp-name-link" href="/" id="painter-choksi" style={{ pointerEvents: oIntro > 0.5 ? 'auto' : 'none' }}>Choksi</a>
        </span>
        <p id="painter-subtitle">
          <span>I Was Not, Among My Kind,</span>
          <span>Distinctive</span>
        </p>
      </header>
      
      {/* General Title Removed as it is now in the global header */}
      <p style={{ ...centerTextStyle, opacity: oIntro }}>
        At a time when the world is ravaged by violence - one country trying to occupy another, one tribe trying to dominate another, one body trying to forcefully possess another, these works try and revisit our wounds, underscoring a fundamental mistake in our understanding of reality – that we are somehow separate from one another – that we exist, or even can, independently. As if existence could ever be insular. So strong are our in-group biases that we forget that it is one group and we are all in it.
      </p>

      {/* Scroll Prompt */}
      <div style={{
        ...fontStyle,
        position: 'absolute', bottom: '8%', left: '50%', 
        opacity: promptOpacity, transition: 'opacity 0.3s',
        animation: 'scrollBounce 2s infinite',
        fontSize: '1.2rem', letterSpacing: '0.1em',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.7)',
        textTransform: 'uppercase'
      }}>
        Scroll to view
        <div style={{ marginTop: '12px', height: '40px', width: '1px', background: 'rgba(255,255,255,0.5)', margin: '0 auto' }} />
      </div>

      {/* The remaining paragraphs sit in the bottom void */}
      <p style={{ ...bottomTextStyle, opacity: o2 }}>
        All things, living or not, are interconnected in an infinite number of ways, and the whole universe works as a whole, not differentiable from its innumerable constituents. The world is, essentially, an unimaginably complex web of causes and effects, all interacting together. These scars remind us that we are not alone in our suffering. The sub-groups are narrow definitions that, instead of celebrating our uniqueness, negate it.
      </p>

      <p style={{ ...bottomTextStyle, opacity: o3 }}>
        This body of work tries to capture the essence of our shared suffering and interconnectedness, challenging how we see ourselves and others. What are we without empathy?
      </p>

      <p style={{ ...bottomTextStyle, opacity: o4 }}>
        The work is an ode to singularity – where there’s no us; no them. It borrows from the sub-title of my work, Anattā – I Not I Not Me Not Mine. In the end it also points to this truth — if even one of us is not free, none of us are free. This sense of separateness is an illusion. Our shared humanity can be a tender testament to our suffering. A place of solace. Or a place of strife. It is up to us.
      </p>

      <p style={{ ...bottomTextStyle, opacity: o5 }}>
        The title of the work is based on a poem by Jane Hirshfield.
      </p>
    </div>
  );
};

const App = () => {
  const [fadeState, setFadeState] = useState<'idle' | 'fading-out' | 'fading-in'>('idle');

  useEffect(() => {
    let resetInProgress = false;

    const handleScroll = () => {
      if (resetInProgress) return;

      const maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
      
      const newTarget = window.scrollY / maxScroll;
      
      // If we hit the absolute bottom, trigger a cinematic fade to loop!
      if (newTarget >= 0.995) {
        resetInProgress = true;
        setFadeState('fading-out'); // 1. Start 1s fade to black
        
        setTimeout(() => {
          // 2. While the screen is completely black, snap everything to the start
          window.scrollTo(0, 0);
          scrollState.target = 0;
          scrollState.current = 0;
          scrollState.velocity = 0;
          
          // 3. Wait 1 frame for React/ThreeJS to render the reset state
          requestAnimationFrame(() => {
            setFadeState('fading-in'); // 4. Start 1s fade back to clear
            
            setTimeout(() => {
              setFadeState('idle'); // 5. Finish and unlock scrolling
              resetInProgress = false;
            }, 1000);
          });
        }, 1000);
      } else {
        scrollState.target = Math.max(0, Math.min(1, newTarget));
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div style={{ backgroundColor: '#050505', minHeight: '700vh' }}>
      <style>{`
        body {
          overflow: auto !important;
          overflow-x: hidden !important;
        }
      `}</style>
      {/* Cinematic Loop Overlay */}
      <div 
        style={{ 
          position: 'fixed', inset: 0, zIndex: 9999, 
          backgroundColor: '#050505', 
          opacity: fadeState === 'idle' ? 0 : (fadeState === 'fading-out' ? 1 : 0),
          transition: fadeState === 'idle' ? 'none' : 'opacity 1s ease-in-out',
          pointerEvents: fadeState === 'idle' ? 'none' : 'auto'
        }} 
      />

      <div style={{ height: '700vh' }}></div>
      <HTMLOverlay />
      
      <a className="home" href="/painter.html" aria-label="Back to Painter">← Painter</a>

      <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100dvh', overflow: 'hidden' }}>
        <Canvas gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }} dpr={[1, 2]}>
          <color attach="background" args={['#050505']} />
          <ambientLight intensity={0.5} />
          <pointLight position={[0, 0, 0]} intensity={50} color="#ffffff" distance={20} />
          <directionalLight position={[5, 10, 5]} intensity={1.5} />
          
          <ScrollPhysics />
          <CameraController />
          <React.Suspense fallback={null}>
            <CylinderAssembly />
          </React.Suspense>
          <Particles />
        </Canvas>
      </div>
    </div>
  );
};

export default App;
