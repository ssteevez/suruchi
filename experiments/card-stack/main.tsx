import React, { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Environment, ContactShadows, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { TextureManager } from './textureManager';
import type { TextureData } from './textureManager';

const PAGE_WIDTH = 3.24;
const PAGE_HEIGHT = 3.0;
const TOTAL_PAGES = 7;
const PURCHASE_URL = "https://www.instagram.com/suruchichoksi/?hl=en";

// Pre-create geometry so x=0 is the spine
// Physical paper thickness set to 0.003 (exaggerated slightly for perceptual edge visibility)
const pageGeometry = new THREE.BoxGeometry(PAGE_WIDTH, PAGE_HEIGHT, 0.003, 64, 64, 1);
pageGeometry.translate(PAGE_WIDTH / 2, 0, 0);

const coverGeometry = new THREE.BoxGeometry(PAGE_WIDTH, PAGE_HEIGHT, 0.04, 64, 64, 1);
coverGeometry.translate(PAGE_WIDTH / 2, 0, 0);


// Global state for target progress (animated via spring)
const scrollState = {
  targetProgress: 0,
  currentProgress: 0,
};

const interactionState = {
  mode: 'SHOWCASE', // 'SHOWCASE' | 'READING'
  mouseX: 0,
  mouseY: 0,
  hasDragged: false,
  isRewinding: false,
};

// Global debug state for geometric debugging pass
export const debugState = {
  showBlocks: true,
  showPages: true,
  showCovers: true,
  showSpine: true,
  enableCurvature: true,
  wireframe: false,
  disableTextures: false,
};

// Simple event target for debug state updates
export const debugEmitter = new EventTarget();

const DebugUI = () => {
  const [state, setState] = useState({ ...debugState });

  useEffect(() => {
    const handleUpdate = () => setState({ ...debugState });
    debugEmitter.addEventListener('update', handleUpdate);
    return () => debugEmitter.removeEventListener('update', handleUpdate);
  }, []);

  const toggle = (key: keyof typeof debugState) => {
    (debugState as any)[key] = !(debugState as any)[key];
    debugEmitter.dispatchEvent(new Event('update'));
  };

  return (
    <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.8)', color: 'white', padding: 15, borderRadius: 8, fontFamily: 'monospace', zIndex: 9999 }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: 14, borderBottom: '1px solid #555', paddingBottom: 5 }}>Debug Controls</h3>
      {Object.keys(debugState).map((key) => (
        <div key={key} style={{ marginBottom: 5 }}>
          <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <input 
              type="checkbox" 
              checked={(state as any)[key]} 
              onChange={() => toggle(key as keyof typeof debugState)} 
              style={{ marginRight: 8 }}
            />
            {key}
          </label>
        </div>
      ))}
    </div>
  );
};

export const useDebugState = () => {
  const [state, setState] = useState({ ...debugState });
  useEffect(() => {
    const handleUpdate = () => setState({ ...debugState });
    debugEmitter.addEventListener('update', handleUpdate);
    return () => debugEmitter.removeEventListener('update', handleUpdate);
  }, []);
  return state;
};

// Global tuning parameters wired directly into shaders
const shaderParams = {
  edgeThickness: { value: 0.003 },
  transmissionStrength: { value: 0.8 }, // Increased for backlight
  backInkStrength: { value: 0.15 },
  paperGrainStrength: { value: 0.2 },
  
  // Phase 2 Deformation Physics
  twistAmount: { value: 0.1 },
  conicalFactor: { value: 0.05 },
  gravityFactor: { value: 0.02 },
  cornerDelay: { value: 0.05 },
  uBacklightPos: { value: new THREE.Vector3(0, 1, -4) },
};

export const tuningState = {
  backlightIntensity: 1000, 
  backlightX: 0,
  backlightY: 1,
  backlightZ: -4,
  spotAngle: 0.8,
  penumbra: 1.0,
  bloomIntensity: 1.2,
  bloomThreshold: 2.0,
  paperTransmission: 0.8,
  ambientLight: 0.2,
  directionalLightMain: 0.6,
  directionalLightFill: 0.3,
  version: 0,
};

export const forceGlobalRender = () => {
  tuningState.version++;
  window.dispatchEvent(new CustomEvent('tuning-updated'));
};

// Procedural paper normal map removed for now per user request to test raw images


const patchBasicShader = (shader: THREE.Shader, index: number, totalPages: number) => {
  shader.uniforms.uProgress = { value: 0 };
  shader.uniforms.uIndex = { value: index };
  shader.uniforms.uTotalPages = { value: totalPages };
  
  shader.vertexShader = `
    uniform float uProgress;
    uniform float uIndex;
    uniform float uTotalPages;
  ` + shader.vertexShader;
  
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
    float startP = uIndex / uTotalPages;
    float endP = (uIndex + 1.0) / uTotalPages;
    float turn = clamp((uProgress - startP) * uTotalPages, 0.0, 1.0);
    float easeTurn = turn * turn * (3.0 - 2.0 * turn); 
    float angle = easeTurn * 3.14159265359;
    float bendAmount = sin(easeTurn * 3.14159265359) * 0.3; 
    bendAmount = max(bendAmount, 0.001);
    float R = 1.0 / bendAmount; 
    float bendStart = 0.6; 
    
    float myLocalX = 0.0;
    float myLocalZ = 0.0;
    
    if (position.x <= bendStart) {
        myLocalX = position.x;
        myLocalZ = 0.0;
    } else {
        float arcAngle = (position.x - bendStart) * bendAmount;
        myLocalX = bendStart + sin(arcAngle) * R;
        myLocalZ = (1.0 - cos(arcAngle)) * R; 
    }
    
    float finalX = myLocalX * cos(angle) - myLocalZ * sin(angle);
    float finalZ = myLocalX * sin(angle) + myLocalZ * cos(angle);
    
    float rightYOffset = (uTotalPages - uIndex) * 0.015 + 0.002;
    float leftYOffset = uIndex * 0.015 + 0.002;
    float baseZOffset = mix(rightYOffset, leftYOffset, easeTurn);
    float liftArc = sin(easeTurn * 3.14159265359) * (abs(rightYOffset - leftYOffset) * 0.5 + 0.01);
    float zOffset = baseZOffset + liftArc;
    
    float restBend = (1.0 - sin(easeTurn * 3.14159265359)) * 0.05 * position.x;
    float sag = sin(position.x * 0.5) * sin(easeTurn * 3.14159265359) * 0.05;
    
    vec3 transformed = vec3(finalX, position.y, finalZ + zOffset - restBend - sag);
    `
  );
};

const patchStandardShader = (shader: THREE.Shader, index: number, totalPages: number) => {
  shader.uniforms.uProgress = { value: 0 };
  shader.uniforms.uIndex = { value: index };
  shader.uniforms.uTotalPages = { value: totalPages };
  shader.uniforms.uEdgeThickness = shaderParams.edgeThickness;
  shader.uniforms.uTransmissionStrength = shaderParams.transmissionStrength;
  shader.uniforms.uPaperGrainStrength = shaderParams.paperGrainStrength;
  shader.uniforms.uTwistAmount = shaderParams.twistAmount;
  shader.uniforms.uConicalFactor = shaderParams.conicalFactor;
  shader.uniforms.uGravityFactor = shaderParams.gravityFactor;
  shader.uniforms.uCornerDelay = shaderParams.cornerDelay;
  
  shader.vertexShader = `
    uniform float uProgress;
    uniform float uIndex;
    uniform float uTotalPages;
    uniform float uEdgeThickness;
    uniform float uTwistAmount;
    uniform float uConicalFactor;
    uniform float uGravityFactor;
    uniform float uCornerDelay;
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;
  ` + shader.vertexShader;
  
  shader.fragmentShader = `
    uniform float uProgress;
    uniform float uIndex;
    uniform float uTotalPages;
    uniform float uTransmissionStrength;
    uniform float uPaperGrainStrength;
    uniform vec3 uBacklightPos;
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;
    
    // Hash and noise for paper grain
    float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }
    float noise(vec2 x) {
        vec2 i = floor(x);
        vec2 f = fract(x);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
  ` + shader.fragmentShader;

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <roughnessmap_fragment>',
    `
    #include <roughnessmap_fragment>
    #ifdef USE_MAP
      float grain = noise(vMapUv * 1500.0);
      roughnessFactor = clamp(roughnessFactor + (grain - 0.5) * uPaperGrainStrength, 0.0, 1.0);
    #endif
    `
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <dithering_fragment>',
    `
    #include <dithering_fragment>
    
    // Hidden tungsten studio light at [0, 1, -6]
    vec3 lightPos = vec3(0.0, 1.0, -6.0);
    vec3 lightDirWorld = normalize(lightPos - vWorldPosition);
    vec3 viewDirWorld = normalize(cameraPosition - vWorldPosition);
    
    // 5. Gold Fresnel edge response
    float fresnel = pow(1.0 - max(0.0, dot(vWorldNormal, viewDirWorld)), 3.0);
    float backLightDirection = max(0.0, dot(vWorldNormal, lightDirWorld));
    
    float edgeThicknessMask = 1.0;
    #ifdef USE_MAP
       // Restrict edge glow to outer physical borders of the paper texture
       // Exclude the spine (vMapUv.x near 0.0) from glowing to prevent center-bleed
       edgeThicknessMask = smoothstep(0.96, 0.99, vMapUv.x) + 
                           smoothstep(0.96, 0.99, vMapUv.y) + smoothstep(0.04, 0.01, vMapUv.y);
       edgeThicknessMask = clamp(edgeThicknessMask, 0.0, 1.0);
    #endif
    
    float goldWrapIntensity = fresnel * backLightDirection * edgeThicknessMask;
    
    // Transmission when curled mid-air
    float transmissionAmount = 0.0;
    #ifdef USE_MAP
       float startP = uIndex / uTotalPages;
       float turn = clamp((uProgress - startP) * uTotalPages, 0.0, 1.0);
       float easeTurn = turn * turn * (3.0 - 2.0 * turn);
       float midAir = sin(easeTurn * 3.14159265359);
       
       // Only allow the intense transmission glow when the page is on the LEFT side of the spine (turn > 0.5).
       // This ensures that when the user slightly lifts the right page to read, it doesn't blind them with glow!
       float leftSideMask = smoothstep(0.4, 0.6, turn);
       
       transmissionAmount = max(0.0, -dot(vWorldNormal, lightDirWorld)) * midAir * 0.4 * leftSideMask;
    #endif
    
    float totalGold = goldWrapIntensity * 0.5 + transmissionAmount;
    
    if (totalGold > 0.0) {
        // Color #FFD27A. Multiplied by 5.0 to safely cross Bloom threshold (0.7) for hot glowing edges
        vec3 goldColor = vec3(1.0, 0.82, 0.48) * 5.0; 
        gl_FragColor.rgb += diffuseColor.rgb * goldColor * totalGold;
    }
    `
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <normal_fragment_begin>',
    `
    #include <normal_fragment_begin>
    
    #ifdef USE_MAP
      // Phase 4: Procedural micro-normals for paper tooth
      // High frequency, low amplitude noise
      float microNx = noise(vMapUv * 2500.0) - 0.5;
      float microNy = noise(vMapUv * 2500.0 + vec2(123.4, 567.8)) - 0.5;
      
      // 0.04 is the requested subtle strength (0.03 - 0.05)
      normal = normalize(normal + vec3(microNx, microNy, 0.0) * 0.04);
    #endif
    `
  );
  
  shader.vertexShader = shader.vertexShader.replace(
    '#include <beginnormal_vertex>',
    `
    float startP = uIndex / uTotalPages;
    
    // Non-linear flexibility (stiff at spine x=0, flexible at edge)
    // PAGE_WIDTH is 3.24
    float xNorm = clamp(position.x / 3.24, 0.0, 1.0);
    float flexibility = xNorm * xNorm;
    
    // Y normalization (-1.0 to 1.0). PAGE_HEIGHT is 3.0 (half is 1.5)
    float yNorm = clamp(position.y / 1.5, -1.0, 1.0);
    
    // Corner Lag (only lags DURING the turn, converges to 0 and 1)
    float rawTurn = clamp((uProgress - startP) * uTotalPages, 0.0, 1.0);
    float lagAmount = flexibility * (yNorm * yNorm);
    float turn = rawTurn - lagAmount * uCornerDelay * sin(rawTurn * 3.14159265359);
    turn = clamp(turn, 0.0, 1.0);
    
    float easeTurn = turn * turn * (3.0 - 2.0 * turn); 
    float midTurn = easeTurn * (1.0 - easeTurn) * 4.0; // 0 to 1 to 0
    
    // Torsional Twist
    float baseAngle = easeTurn * 3.14159265359;
    float twist = yNorm * flexibility * midTurn * uTwistAmount;
    float angle = baseAngle + twist;
    
    // Conical Bending
    float baseBendAmount = sin(easeTurn * 3.14159265359) * 0.3; 
    baseBendAmount = max(baseBendAmount, 0.001);
    float conicalMultiplier = 1.0 + (yNorm * yNorm * yNorm) * flexibility * uConicalFactor;
    float bendAmount = max(baseBendAmount * conicalMultiplier, 0.001);
    
    float bendStart = 0.6; 
    
    float effArc = position.x > bendStart ? (position.x - bendStart) * bendAmount : 0.0;
    
    // Construct local frame to rotate the original box normals
    vec3 T = vec3(cos(effArc), 0.0, sin(effArc)); // Tangent
    vec3 B = vec3(0.0, 1.0, 0.0);                 // Bitangent
    vec3 N = vec3(-sin(effArc), 0.0, cos(effArc)); // Normal
    mat3 localCurveRot = mat3(T, B, N);
    
    vec3 curvedNormal = localCurveRot * normal;
    
    // Apply page turn angle (including twist)
    float nx = curvedNormal.x * cos(angle) - curvedNormal.z * sin(angle);
    float nz = curvedNormal.x * sin(angle) + curvedNormal.z * cos(angle);
    vec3 objectNormal = normalize(vec3(nx, curvedNormal.y, nz));
    `
  );
  
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
    float R = 1.0 / bendAmount; 
    
    float myLocalX = 0.0;
    float myLocalZ = 0.0;
    vec3 neutralNormal = vec3(0.0, 0.0, 1.0);
    
    if (position.x <= bendStart) {
        myLocalX = position.x;
        myLocalZ = 0.0;
    } else {
        float arcAngle = (position.x - bendStart) * bendAmount;
        myLocalX = bendStart + sin(arcAngle) * R;
        myLocalZ = R - cos(arcAngle) * R; 
        neutralNormal = vec3(-sin(arcAngle), 0.0, cos(arcAngle));
    }
    
    // Displace vertex by its original Z (thickness) along the curved neutral normal
    // Scale original 0.003 thickness by the dynamic uEdgeThickness uniform
    float dynamicZ = (position.z / 0.003) * uEdgeThickness;
    myLocalX += neutralNormal.x * dynamicZ;
    myLocalZ += neutralNormal.z * dynamicZ;
    
    float finalX = myLocalX * cos(angle) - myLocalZ * sin(angle);
    float finalZ = myLocalX * sin(angle) + myLocalZ * cos(angle);
    
    // Gravity Droop
    float gravityDroop = midTurn * flexibility * uGravityFactor;
    float finalY = position.y - gravityDroop;
    
    float rightYOffset = (uTotalPages - uIndex) * 0.015 + 0.002;
    float leftYOffset = uIndex * 0.015 + 0.002;
    float baseZOffset = mix(rightYOffset, leftYOffset, easeTurn);
    float liftArc = sin(easeTurn * 3.14159265359) * (abs(rightYOffset - leftYOffset) * 0.5 + 0.01);
    float zOffset = baseZOffset + liftArc;
    
    float restBend = (1.0 - sin(easeTurn * 3.14159265359)) * 0.05 * position.x;
    float sag = sin(position.x * 0.5) * sin(easeTurn * 3.14159265359) * 0.05;
    
    vec3 transformed = vec3(finalX, finalY, finalZ + zOffset - restBend - sag);
    `
  );
  
  shader.vertexShader = shader.vertexShader.replace(
    '#include <worldpos_vertex>',
    `
    #include <worldpos_vertex>
    vWorldNormal = normalize( ( modelMatrix * vec4( objectNormal, 0.0 ) ).xyz );
    vViewPosition = -mvPosition.xyz;
    `
  );
};

const RigidCard = ({ index }: { index: number }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [textureData, setTextureData] = useState<TextureData | null>(null);
  
  const dummyTex = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, []);

  useEffect(() => {
    return TextureManager.subscribe(index, (data) => setTextureData(data));
  }, [index]);

  useFrame(() => {
    if (!groupRef.current) return;
    const progress = scrollState.currentProgress;
    
    // Each card flips in sequence. The first card turns from 0 to 1/TOTAL_PAGES
    let turn = (progress * TOTAL_PAGES) - index;
    turn = Math.max(0, Math.min(1, turn));
    
    const easeTurn = turn * turn * (3.0 - 2.0 * turn);
    
    // Rigid rotation around hinge (X=0)
    groupRef.current.rotation.y = -easeTurn * Math.PI;
    
    // Stack cards based on their index. 
    // index 0 is top (highest Z). index 6 is bottom (Z=0).
    // Thickness is 0.04.
    const restingZ = (TOTAL_PAGES - 1 - index) * 0.04;
    const rightZ = restingZ;
    const leftZ = 0.0;
    
    const pushOut = Math.sin(easeTurn * Math.PI) * 0.02;
    groupRef.current.position.z = rightZ * (1.0 - easeTurn) + leftZ * easeTurn - pushOut;
    
    // Hide the card once it turns past 60%
    groupRef.current.visible = turn < 0.6;
  });

  return (
    <group ref={groupRef}>
      <mesh position={[PAGE_WIDTH / 2, 0, 0.04 / 2]} castShadow receiveShadow>
        <boxGeometry args={[PAGE_WIDTH, PAGE_HEIGHT, 0.04]} />
        <meshStandardMaterial attach="material-0" color="#111111" roughness={0.9} />
        <meshStandardMaterial attach="material-1" color="#111111" roughness={0.9} />
        <meshStandardMaterial attach="material-2" color="#111111" roughness={0.9} />
        <meshStandardMaterial attach="material-3" color="#111111" roughness={0.9} />
        <meshStandardMaterial 
          attach="material-4" 
          map={textureData ? textureData.tex : dummyTex}
          color="#ffffff" roughness={0.15} metalness={0.0} 
        />
        <meshStandardMaterial attach="material-5" color="#222222" roughness={0.85} />
      </mesh>
    </group>
  );
};

const BookAssembly = ({ currentPage, onCloseComplete }: { currentPage: number, onCloseComplete: () => void }) => {
  const pivotRef = useRef<THREE.Group>(null);
  const spring = useMemo(() => ({ value: 0, velocity: 0 }), []);
  const stateRef = useRef({ lastState: 'IDLE' as 'IDLE' | 'TURNING' | 'SETTLED' });
  const activePages = useMemo(() => Array.from({ length: TOTAL_PAGES - 1 }).map((_, i) => i + 1), []);
  const debug = useDebugState();
  
  useFrame((state, delta) => {
    if (!pivotRef.current) return;
    
    // Physics
    const dt = Math.min(delta, 0.1);
    
    if (interactionState.isClosing) {
      // Pre-load the front cover and first page so they are perfectly ready when the animation finishes
      TextureManager.requestLoad(0, 1200);
      TextureManager.requestLoad(1, 1200);

      interactionState.closingProgress += dt * 0.4; // 2.5 seconds to close
      if (interactionState.closingProgress >= 1.0) {
        interactionState.isClosing = false;
        interactionState.closingProgress = 0;
        spring.value = 0;
        spring.velocity = 0;
        onCloseComplete();
        scrollState.currentProgress = 0;
      }
      return;
    }
    
    const diff = (currentPage / TOTAL_PAGES) - spring.value;
    const isSettled = Math.abs(diff) < 0.001 && Math.abs(spring.velocity) < 0.005;
    
    const stiffness = 3.0; // Lowered to make turns slower/heavier
    const damping = 2.0 * Math.sqrt(stiffness);

    const acceleration = diff * stiffness - spring.velocity * damping;
    spring.velocity += acceleration * dt;
    spring.value += spring.velocity * dt;
    scrollState.currentProgress = Math.max(0, Math.min(1, spring.value));

    // Progressive texture loading
    const currentState = isSettled ? 'SETTLED' : 'TURNING';
    const windowStart = Math.max(0, currentPage - 2);
    const windowEnd = Math.min(TOTAL_PAGES - 1, currentPage + 2);
    
    for (let i = 0; i < TOTAL_PAGES; i++) {
       if (i < windowStart || i > windowEnd) TextureManager.dispose(i);
    }
    if (currentState === 'TURNING') {
       if (stateRef.current.lastState === 'SETTLED') TextureManager.cancelAllResolutions(2400);
       for (let i = windowStart; i <= windowEnd; i++) TextureManager.requestLoad(i, 1200);
    } else if (currentState === 'SETTLED' && stateRef.current.lastState !== 'SETTLED') {
       TextureManager.requestLoad(currentPage, 2400);
       if (currentPage > 0) TextureManager.requestLoad(currentPage - 1, 2400);
       if (currentPage + 1 < TOTAL_PAGES) TextureManager.requestLoad(currentPage + 1, 2400);
    }
    stateRef.current.lastState = currentState;

    // Always apply the high-intensity dynamic mouse movement
    const targetRotX = 0.25 + (interactionState.mouseY * 0.8);
    const targetRotY = -0.3 + (interactionState.mouseX * 1.0);
    
    pivotRef.current.rotation.x += (targetRotX - pivotRef.current.rotation.x) * (delta * 5.0);
    pivotRef.current.rotation.y += (targetRotY - pivotRef.current.rotation.y) * (delta * 5.0);
  });

  return (
    <group ref={pivotRef}>
      {/* Shift the book so its center (PAGE_WIDTH/2) sits at the pivot point (0,0,0) */}
      <group position={[-PAGE_WIDTH / 2, 0, 0]}>
        {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
          <RigidCard key={i} index={i} />
        ))}
      </group>
    </group>
  );
};
const CameraController = () => {
  useFrame((state, delta) => {
    const targetCamX = 0.0;
    const targetCamZ = 6.8; 
    
    state.camera.position.x += (targetCamX - state.camera.position.x) * (delta * 3.0);
    state.camera.position.z += (targetCamZ - state.camera.position.z) * (delta * 3.0);
  });
  return null;
};

const DynamicLighting = () => {
  const spotTarget = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.set(0, 0, 0); // Point at the center of the book
    return obj;
  }, []);
  
  return (
    <>
      <primitive object={spotTarget} />
      
      {/* 1. FRONT: Natural ambient and reading light */}
      <ambientLight intensity={tuningState.ambientLight} color="#ffffff" />
      <directionalLight 
        position={[2, 5, 8]} 
        intensity={tuningState.directionalLightMain} 
        color="#FFF4E0"
        castShadow
        shadow-bias={-0.0005}
      />
      <directionalLight 
        position={[-4, 3, 5]} 
        intensity={tuningState.directionalLightFill} 
        color="#E0EFFF"
      />
      
      {/* 2. BACK: Three-Layer Cinematic Tungsten Studio Light */}
      
      {/* Golden Core Source */}
      <spotLight 
        position={[0, 1.0, -6]} 
        target={spotTarget}
        angle={1.2}
        penumbra={1.0}
        intensity={tuningState.backlightIntensity} 
        distance={30}
        decay={2}
        color="#FFF0C4"
        castShadow
        shadow-bias={-0.0005}
      />
      
      {/* Golden Wrap Source */}
      <spotLight 
        position={[0, 0, -8]} 
        target={spotTarget}
        angle={1.5}
        penumbra={0.9}
        intensity={4000.0} 
        distance={40}
        decay={2}
        color="#E8A23A"
      />
      
      {/* Ambient Golden Atmosphere */}
      <spotLight 
        position={[0, 0, -10]} 
        target={spotTarget}
        angle={1.5}
        penumbra={1.0}
        intensity={800.0} 
        distance={50}
        decay={2}
        color="#7A3F12"
      />
      
      {/* (God Rays mesh removed for pure dramatic grey background) */}
      
      {/* 4. FRONT: Left, Center, and Right (Silver, reduced intensity) */}
      <spotLight 
        position={[-8, 6, 8]} 
        target={spotTarget}
        angle={0.6}
        penumbra={0.5}
        intensity={150.0} 
        distance={40}
        decay={2}
        color="#ffffff"
        castShadow
      />
      <spotLight 
        position={[0, 6, 8]} 
        target={spotTarget}
        angle={0.6}
        penumbra={0.5}
        intensity={75.0}
        distance={40}
        decay={2}
        color="#ffffff"
        castShadow
      />
      <spotLight 
        position={[8, 6, 8]} 
        target={spotTarget}
        angle={0.6}
        penumbra={0.5}
        intensity={150.0} 
        distance={40}
        decay={2}
        color="#ffffff"
        castShadow
      />

      {/* 3. SIDES: Multiple grazing lights, intensity halved to 300 */}
      {/* Left Side Cluster */}
      <spotLight 
        position={[-12, 8, 2]} 
        target={spotTarget}
        angle={0.7}
        penumbra={0.8}
        intensity={300.0} 
        distance={40}
        decay={2}
        color="#ffffff"
      />
      <spotLight 
        position={[-12, 2, -2]} 
        target={spotTarget}
        angle={0.7}
        penumbra={0.8}
        intensity={300.0} 
        distance={40}
        decay={2}
        color="#ffaa00" // Changed to warm gold
      />
      
      {/* Right Side Cluster */}
      <spotLight 
        position={[12, 8, 2]} 
        target={spotTarget}
        angle={0.7}
        penumbra={0.8}
        intensity={300.0} 
        distance={40}
        decay={2}
        color="#ffffff"
      />
      <spotLight 
        position={[12, 2, -2]} 
        target={spotTarget}
        angle={0.7}
        penumbra={0.8}
        intensity={300.0} 
        distance={40}
        decay={2}
        color="#ffaa00" // Changed to warm gold
      />
    </>
  );
};

const DebugOverlay = () => {
  const [debugInfo, setDebugInfo] = useState(TextureManager.getDebugInfo());
  
  useEffect(() => {
     const interval = setInterval(() => {
        setDebugInfo(TextureManager.getDebugInfo());
     }, 100);
     return () => clearInterval(interval);
  }, []);

  return (
    <Html position={[-1.5, -2, 0]} transform={false} zIndexRange={[100, 0]}>
      <div style={{
        position: 'fixed', top: 20, left: 20, 
        background: 'rgba(0,0,0,0.8)', color: '#0f0', 
        padding: '10px 15px', borderRadius: 8,
        fontFamily: 'monospace', fontSize: '12px',
        pointerEvents: 'none', minWidth: '250px'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: 5 }}>TEXTURE MANAGER</div>
        <div>Total Active : {debugInfo.totalActive} / 25</div>
        <div>1200px Res   : {debugInfo.textures1200}</div>
        <div>2400px Res   : {debugInfo.textures2400}</div>
        <div>Pending Req  : {debugInfo.pending}</div>
        <div style={{ marginTop: 5, color: '#aaa', fontSize: '10px', wordBreak: 'break-all' }}>
           Active: [{debugInfo.activeList}]
        </div>
        <div style={{ marginTop: 2, color: '#f88', fontSize: '10px' }}>
           Pending: [{debugInfo.pendingList}]
        </div>
      </div>
    </Html>
  );
};

const BookEngine = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const [, setRenderTrigger] = useState(0);
  const lastEventTimeRef = useRef(0);

  useEffect(() => {
    const handleTuningUpdate = () => {
       setRenderTrigger(v => v + 1);
       shaderParams.transmissionStrength.value = tuningState.paperTransmission;
       shaderParams.uBacklightPos.value.set(tuningState.backlightX, tuningState.backlightY, tuningState.backlightZ);
    };
    window.addEventListener('tuning-updated', handleTuningUpdate);
    
    const handleMouseMove = (e: MouseEvent) => {
      interactionState.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      interactionState.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); 
      const now = performance.now();
      if (now - lastEventTimeRef.current < 400) return;
      
      if (e.deltaY > 20) {
        if (currentPage < TOTAL_PAGES - 1) {
          setCurrentPage(p => p + 1);
        } else {
          // Loop back to the start
          setCurrentPage(0);
        }
        lastEventTimeRef.current = now;
      } else if (e.deltaY < -20 && currentPage > 0) {
        setCurrentPage(p => p - 1);
        lastEventTimeRef.current = now;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('tuning-updated', handleTuningUpdate);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [currentPage]);
  
  useEffect(() => {
    scrollState.targetProgress = currentPage / TOTAL_PAGES;
    if (currentPage === 0) {
      interactionState.mode = 'SHOWCASE';
    }
  }, [currentPage]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (interactionState.isClosing) return;
    const now = performance.now();
    if (now - lastEventTimeRef.current < 200) return;
    
    if (interactionState.mode === 'SHOWCASE') {
      interactionState.mode = 'READING';
      setCurrentPage(1); // Open cover
      lastEventTimeRef.current = now;
      return;
    }
    
    if (e.clientX > window.innerWidth / 2) {
      if (currentPage < TOTAL_PAGES) {
        setCurrentPage(p => p + 1);
      } else {
        // Trigger macro block close
        interactionState.mode = 'SHOWCASE';
        interactionState.isClosing = true;
        interactionState.closingProgress = 0;
        return;
      }
    } else {
      if (currentPage > 0) setCurrentPage(p => p - 1);
    }
    lastEventTimeRef.current = now;
  };

  return (
    <div style={{ position: 'absolute', inset: 0, width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Invisible interaction layer strictly for turning pages */}
      <div 
        style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'pointer', touchAction: 'none' }}
        onClick={(e) => {
          handleOverlayClick(e);
        }}
      />
      
      <Canvas
        style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }} 
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        shadows
      >
        <color attach="background" args={['#2c2c2c']} />
        
        {/* Soft studio environment map so metallic surfaces always reflect something and remain visible */}
        <Environment preset="studio" background={false} environmentIntensity={0.25} />
        
        <PerspectiveCamera makeDefault position={[0, 0, 7]} fov={45} />
        
        <DynamicLighting />
        
        <CameraController />
        
        <EffectComposer disableNormalPass multisampling={4}>
          <Bloom 
            luminanceThreshold={tuningState.bloomThreshold} 
            luminanceSmoothing={0.85} 
            intensity={tuningState.bloomIntensity} 
            mipmapBlur 
          />
        </EffectComposer>
        
        <Suspense fallback={null}>
          <BookAssembly currentPage={currentPage} onCloseComplete={() => setCurrentPage(0)} />
        </Suspense>
      </Canvas>
    </div>
  );
};

const LightingTuningControls = () => {
  const [, forceLocalRender] = useState(0);
  
  const updateField = (key: keyof typeof tuningState, val: number) => {
    (tuningState as any)[key] = val;
    forceLocalRender(r => r+1);
    forceGlobalRender();
  };
  
  return (
    <div 
      className="tuning-controls"
      onPointerDown={(e) => e.stopPropagation()} 
      onWheel={(e) => e.stopPropagation()}
      style={{ position: 'fixed', bottom: 20, right: 20, background: 'rgba(0,0,0,0.85)', color: '#ffb52e', padding: '15px 20px', zIndex: 1000, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'monospace', fontSize: '11px', minWidth: 280, border: '1px solid #333' }}
    >
       <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: 5 }}>Cinematic Lighting Tuning</div>
       
       <label style={{ display: 'flex', justifyContent: 'space-between' }}>
         <span>Front Ambient Light: {tuningState.ambientLight.toFixed(2)}</span>
         <input type="range" min="0" max="2" step="0.1" value={tuningState.ambientLight} onChange={e => updateField('ambientLight', parseFloat(e.target.value))} />
       </label>
       <label style={{ display: 'flex', justifyContent: 'space-between' }}>
         <span>Front Reading Light: {tuningState.directionalLightMain.toFixed(2)}</span>
         <input type="range" min="0" max="5" step="0.1" value={tuningState.directionalLightMain} onChange={e => updateField('directionalLightMain', parseFloat(e.target.value))} />
       </label>
       <label style={{ display: 'flex', justifyContent: 'space-between' }}>
         <span>Front Fill Light: {tuningState.directionalLightFill.toFixed(2)}</span>
         <input type="range" min="0" max="3" step="0.1" value={tuningState.directionalLightFill} onChange={e => updateField('directionalLightFill', parseFloat(e.target.value))} />
       </label>
       <label style={{ display: 'flex', justifyContent: 'space-between' }}>
         <span>Backlight Intensity: {tuningState.backlightIntensity.toFixed(0)}</span>
         <input type="range" min="0" max="10000" step="100" value={tuningState.backlightIntensity} onChange={e => updateField('backlightIntensity', parseFloat(e.target.value))} />
       </label>
       <label style={{ display: 'flex', justifyContent: 'space-between' }}>
         <span>PosX: {tuningState.backlightX}</span>
         <input type="range" min="-10" max="10" step="0.5" value={tuningState.backlightX} onChange={e => updateField('backlightX', parseFloat(e.target.value))} />
       </label>
       <label style={{ display: 'flex', justifyContent: 'space-between' }}>
         <span>PosY: {tuningState.backlightY}</span>
         <input type="range" min="-10" max="10" step="0.5" value={tuningState.backlightY} onChange={e => updateField('backlightY', parseFloat(e.target.value))} />
       </label>
       <label style={{ display: 'flex', justifyContent: 'space-between' }}>
         <span>PosZ: {tuningState.backlightZ}</span>
         <input type="range" min="-15" max="0" step="0.5" value={tuningState.backlightZ} onChange={e => updateField('backlightZ', parseFloat(e.target.value))} />
       </label>
       <label style={{ display: 'flex', justifyContent: 'space-between' }}>
         <span>Angle: {tuningState.spotAngle.toFixed(2)}</span>
         <input type="range" min="0.1" max="1.5" step="0.05" value={tuningState.spotAngle} onChange={e => updateField('spotAngle', parseFloat(e.target.value))} />
       </label>
       <label style={{ display: 'flex', justifyContent: 'space-between' }}>
         <span>Penumbra: {tuningState.penumbra.toFixed(2)}</span>
         <input type="range" min="0" max="1" step="0.05" value={tuningState.penumbra} onChange={e => updateField('penumbra', parseFloat(e.target.value))} />
       </label>
       
       <div style={{ fontWeight: 'bold', marginTop: 10, borderTop: '1px solid #333', paddingTop: 10 }}>Post & Shaders</div>
       
       <label style={{ display: 'flex', justifyContent: 'space-between' }}>
         <span>Bloom Intensity: {tuningState.bloomIntensity.toFixed(2)}</span>
         <input type="range" min="0" max="5" step="0.1" value={tuningState.bloomIntensity} onChange={e => updateField('bloomIntensity', parseFloat(e.target.value))} />
       </label>
       <label style={{ display: 'flex', justifyContent: 'space-between' }}>
         <span>Bloom Threshold: {tuningState.bloomThreshold.toFixed(2)}</span>
         <input type="range" min="0" max="2" step="0.05" value={tuningState.bloomThreshold} onChange={e => updateField('bloomThreshold', parseFloat(e.target.value))} />
       </label>
       <label style={{ display: 'flex', justifyContent: 'space-between' }}>
         <span>Paper Transmission: {tuningState.paperTransmission.toFixed(2)}</span>
         <input type="range" min="0" max="2" step="0.05" value={tuningState.paperTransmission} onChange={e => updateField('paperTransmission', parseFloat(e.target.value))} />
       </label>
    </div>
  );
};



class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{color: 'red', padding: 20, background: 'black'}}>
        <h1>Something went wrong.</h1>
        <pre>{this.state.error?.message}</pre>
        <pre>{this.state.error?.stack}</pre>
      </div>;
    }
    return this.props.children;
  }
}

const App = () => {
  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      background: '#2c2c2c',
      overflow: 'hidden',
      fontFamily: '"Neue Haas Grotesk Text Pro", "Suisse Intl", "Avenir Next", "Helvetica Neue", Arial, sans-serif'
    }}>
      
      {/* Brand / Home Link */}
      <div style={{
        position: 'absolute',
        top: 64,
        left: 84,
        zIndex: 100,
        color: 'rgba(245,245,245,0.82)',
        fontSize: '68px',
        fontWeight: '400',
        lineHeight: '1.2',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        pointerEvents: 'auto'
      }}>
        <a href="/" style={{
          display: 'inline-block',
          borderBottom: '2px solid currentColor',
          paddingBottom: 2,
          marginBottom: 3,
          color: 'inherit',
          textDecoration: 'none',
          cursor: 'pointer'
        }}>SURUCHI</a><br />
        <a href="/" style={{
          display: 'inline-block',
          borderBottom: '2px solid currentColor',
          paddingBottom: 2,
          color: 'inherit',
          textDecoration: 'none',
          cursor: 'pointer'
        }}>CHOKSI</a>
      </div>

      {/* Buy the Book CTA */}
      <a 
        href={PURCHASE_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          top: '84px',
          right: '84px',
          zIndex: 1000,
          color: 'rgba(245, 245, 245, 0.82)',
          fontFamily: '"Neue Haas Grotesk Text Pro", "Suisse Intl", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
          fontSize: '11px',
          fontWeight: 500,
          letterSpacing: '0.15em',
          textDecoration: 'none',
          paddingBottom: '4px',
          borderBottom: '1px solid rgba(245, 245, 245, 0.3)',
          transition: 'all 0.3s ease',
          pointerEvents: 'auto',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderBottomColor = 'rgba(245, 245, 245, 0.82)';
          e.currentTarget.style.textShadow = '0 0 12px rgba(255, 255, 255, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderBottomColor = 'rgba(245, 245, 245, 0.3)';
          e.currentTarget.style.textShadow = 'none';
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '1px solid rgba(245, 245, 245, 0.6)';
          e.currentTarget.style.outlineOffset = '6px';
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none';
        }}
      >
        BUY THE BOOK ↗
      </a>

      {/* Interaction Instructions */}
      <div style={{
        position: 'fixed',
        bottom: 34,
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        color: 'rgba(245, 245, 245, 0.44)',
        fontSize: 12,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        lineHeight: 1.8,
        zIndex: 1000,
        pointerEvents: 'none'
      }}>
        <div>Scroll to open and read</div>
      </div>

      <BookEngine />
    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  // @ts-ignore
  if (!window._reactRoot) {
    // @ts-ignore
    window._reactRoot = createRoot(rootEl);
  }
  // @ts-ignore
  window._reactRoot.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
