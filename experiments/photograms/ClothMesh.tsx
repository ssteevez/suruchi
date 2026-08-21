import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { MsgIn, MsgOut } from './cloth.worker';
import { getCanvasNormalMap } from './canvasTexture';

interface ClothMeshProps {
  texture: THREE.Texture | null;
  dropped: boolean;
  zOffset: number;
  tearTrigger: number;
  rewindTrigger: number;
  initStage?: number;
}

export function ClothMesh({ texture, dropped, zOffset, tearTrigger, rewindTrigger, initStage = 0 }: ClothMeshProps) {
  const { viewport } = useThree();
  const normalMap = React.useMemo(() => getCanvasNormalMap(), []);
  const workerRef = useRef<Worker>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const recyclePosRef = useRef<ArrayBuffer | null>(null);
  const [ready, setReady] = useState(false);
  const prevTearTrigger = useRef(0);
  const prevRewindTrigger = useRef(0);
  // Captured once at mount — changing this prop won't restart the worker
  const initStageAtMount = useRef(initStage);
  const droppedRef = useRef(dropped);
  droppedRef.current = dropped;

  const clothW = viewport.width;
  const clothH = viewport.height;
  const segX = 72;
  const segY = 72;
  const tearThreshold = 2.8;
  const particleCount = (segX + 1) * (segY + 1);

  // Allocate stable WebGL buffers once on mount
  useEffect(() => {
    if (!geomRef.current) return;
    const uvs = new Float32Array(particleCount * 2);
    const positions = new Float32Array(particleCount * 3);
    const normals = new Float32Array(particleCount * 3);
    const indices = new Uint32Array(segX * segY * 6);

    for (let r = 0; r <= segY; r++) {
      for (let c = 0; c <= segX; c++) {
        const i = r * (segX + 1) + c;
        uvs[i * 2] = c / segX;
        uvs[i * 2 + 1] = 1 - r / segY;
        
        positions[i * 3] = (c / segX - 0.5) * clothW;
        positions[i * 3 + 1] = (0.5 - r / segY) * clothH;
        positions[i * 3 + 2] = 0;
        
        normals[i * 3] = 0;
        normals[i * 3 + 1] = 0;
        normals[i * 3 + 2] = 1;
      }
    }
    
    let idx = 0;
    for (let r = 0; r < segY; r++) {
      for (let c = 0; c < segX; c++) {
        const a = r * (segX + 1) + c;
        const b = a + 1;
        const d = (r + 1) * (segX + 1) + c;
        const c2 = d + 1;
        
        indices[idx++] = a;
        indices[idx++] = b;
        indices[idx++] = d;
        indices[idx++] = b;
        indices[idx++] = c2;
        indices[idx++] = d;
      }
    }

    geomRef.current.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geomRef.current.setAttribute('position', posAttr);
    const normAttr = new THREE.BufferAttribute(normals, 3);
    normAttr.setUsage(THREE.DynamicDrawUsage);
    geomRef.current.setAttribute('normal', normAttr);
    const indexAttr = new THREE.BufferAttribute(indices, 1);
    indexAttr.setUsage(THREE.DynamicDrawUsage);
    geomRef.current.setIndex(indexAttr);

    // Set bounding sphere once — full-screen cloth never leaves the frustum
    geomRef.current.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, 0),
      Math.max(clothW, clothH)
    );
  }, [particleCount]);

  // Worker lifecycle — inits once, never restarts mid-sequence
  useEffect(() => {
    const worker = new Worker(new URL('./cloth.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<MsgOut>) => {
      const msg = e.data;
      if (msg.type === 'ready') {
        setReady(true);
      } else if (msg.type === 'stepResult') {
        // Stash the transferred positions buffer for recycling next frame
        recyclePosRef.current = msg.buffer;

        const geom = geomRef.current;
        if (!geom) return;

        // Copy into stable WebGL buffers — normals/index are cloned (not transferred)
        const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
        if (posAttr) {
          (posAttr.array as Float32Array).set(new Float32Array(msg.buffer));
          posAttr.needsUpdate = true;
        }
        const normAttr = geom.getAttribute('normal') as THREE.BufferAttribute;
        if (normAttr) {
          (normAttr.array as Float32Array).set(msg.normals);
          normAttr.needsUpdate = true;
        }
        const indexAttr = geom.getIndex();
        if (indexAttr) {
          (indexAttr.array as Uint32Array).set(msg.index.subarray(0, msg.drawCount));
          indexAttr.needsUpdate = true;
          geom.setDrawRange(0, msg.drawCount);
        }
      }
    };

    worker.postMessage({
      type: 'init',
      id: 0,
      width: clothW,
      height: clothH,
      segX,
      segY,
      tearThreshold,
      initStage: initStageAtMount.current
    } as MsgIn);

    return () => {
      worker.postMessage({ type: 'dispose', id: 0 } as MsgIn);
      worker.terminate();
    };
  }, [clothW, clothH]); // intentionally excludes tearTrigger/dropped — worker inits once

  useEffect(() => {
    if (dropped && workerRef.current) {
      workerRef.current.postMessage({ type: 'drop', id: 0 } as MsgIn);
    }
  }, [dropped]);

  useEffect(() => {
    if (tearTrigger > prevTearTrigger.current && workerRef.current) {
      prevTearTrigger.current = tearTrigger;
      
      const shapes = ['puncture', 'horizontal-slit', 'vertical-slit', 'diagonal', 'jagged', 'oval'];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      
      workerRef.current.postMessage({
        type: 'proceduralTear',
        id: 0,
        normX: 0.15 + Math.random() * 0.7,
        normY: 0.1 + Math.random() * 0.7,
        radius: 0.10,
        impulseZ: (Math.random() > 0.5 ? 1 : -1) * (0.04 + Math.random() * 0.03),
        shape
      } as MsgIn);
    }
  }, [tearTrigger]);

  useEffect(() => {
    if (rewindTrigger > prevRewindTrigger.current && workerRef.current) {
      prevRewindTrigger.current = rewindTrigger;
      workerRef.current.postMessage({ type: 'rewind', id: 0 } as MsgIn);
    }
  }, [rewindTrigger]);

  useFrame(() => {
    if (!ready || !workerRef.current) return;
    
    // Freeze pristine cloth (no initial tears, no triggered tears, not dropped)
    // so it renders perfectly flat like a normal image
    if (initStageAtMount.current === 0 && tearTrigger === 0 && !droppedRef.current) return;

    const buf = recyclePosRef.current;
    recyclePosRef.current = null;
    const msg: MsgIn = {
      type: 'step',
      id: 0,
      gravity: droppedRef.current ? 0.0012 : 0.0004,
      damping: 0.996,
      iterations: 8,
      buffer: buf ?? undefined
    };
    if (buf) {
      workerRef.current.postMessage(msg, [buf]);
    } else {
      workerRef.current.postMessage(msg);
    }
  });

  return (
    <mesh position={[0, 0, zOffset]} visible={ready} castShadow receiveShadow>
      <bufferGeometry ref={geomRef} />
      <meshPhysicalMaterial
        map={texture}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(1.2, 1.2)} // Deep, coarse canvas weave
        roughness={0.95} // Very rough, matte
        metalness={0.0}
        sheen={0.15} // Subtle canvas sheen
        sheenRoughness={0.9}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
