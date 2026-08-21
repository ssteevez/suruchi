// Main thread → Worker
export type MsgIn =
  | { type: 'init'; id: number; width: number; height: number; segX: number; segY: number; tearThreshold: number; initStage: number }
  | { type: 'step'; id: number; gravity: number; damping: number; iterations: number; buffer?: ArrayBuffer }
  | { type: 'grab'; id: number; x: number; y: number; z: number; radius: number }
  | { type: 'moveGrab'; id: number; x: number; y: number; z: number }
  | { type: 'releaseGrab'; id: number }
  | { type: 'drop'; id: number }
  | { type: 'dispose'; id: number }
  | { type: 'rewind'; id: number }
  | { type: 'proceduralTear'; id: number; normX: number; normY: number; radius: number; impulseZ: number; shape?: string };

// Worker → Main thread
export type MsgOut =
  | { type: 'ready'; id: number; particleCount: number }
  | { type: 'stepResult'; id: number; buffer: ArrayBuffer; normals: Float32Array; index: Uint32Array; drawCount: number; brokenCount: number };

class ClothSim {
  segX: number = 0;
  segY: number = 0;
  width: number = 0;
  height: number = 0;
  particleCount: number = 0;
  
  pos!: Float32Array;
  prevPos!: Float32Array;
  pinned!: Uint8Array;
  unpinDelay!: Float32Array;
  dropFrame: number = 0;

  conA!: Int32Array;
  conB!: Int32Array;
  conRest!: Float32Array;
  conAlive!: Uint8Array;
  constraintCount: number = 0;
  brokenCount: number = 0;

  // Pre-allocated output buffers — reused every frame, never GC'd
  normalsArray!: Float32Array;
  indicesArray!: Uint32Array;

  tearThreshold: number = 1.5;
  dropped: boolean = false;

  grabbedIdx: number = -1;
  grabOffX: number = 0;
  grabOffY: number = 0;
  grabOffZ: number = 0;
  grabTargetX: number = 0;
  grabTargetY: number = 0;
  grabTargetZ: number = 0;
  wasPinned: boolean = false;

  history: {
    pos: Float32Array;
    prevPos: Float32Array;
    conAlive: Uint8Array;
    brokenCount: number;
    pinned: Uint8Array;
    dropped: boolean;
  }[] = [];

  saveState() {
    this.history.push({
      pos: new Float32Array(this.pos),
      prevPos: new Float32Array(this.prevPos),
      conAlive: new Uint8Array(this.conAlive),
      brokenCount: this.brokenCount,
      pinned: new Uint8Array(this.pinned),
      dropped: this.dropped
    });
  }

  restoreState() {
    if (this.history.length > 1) {
      this.history.pop(); // discard current state
      const state = this.history[this.history.length - 1]; // get previous state
      this.pos.set(state.pos);
      this.prevPos.set(state.prevPos);
      this.conAlive.set(state.conAlive);
      this.pinned.set(state.pinned);
      this.brokenCount = state.brokenCount;
      this.dropped = state.dropped;
    }
  }

  // Builds a rewindable history of `stages` tears WITHOUT dropping.
  // Used when entering a cloth in reverse: appears maximally torn, each
  // scroll-up rewinds one tear until the cloth is pristine.
  preTear(stages: number) {
    this.saveState(); // history[0] = pristine
    for (let i = 0; i < stages; i++) {
      this.proceduralTear(
        0.15 + Math.random() * 0.7,
        0.1 + Math.random() * 0.7,
        0.10,
        (Math.random() > 0.5 ? 1 : -1) * (0.04 + Math.random() * 0.03)
      );
      // Use stepPhysics (no normals build) — fast enough for init, correct params
      for (let s = 0; s < 12; s++) this.stepPhysics(0.0004, 0.996, 8);
      this.saveState(); // history[i+1] = after i+1 tears
    }
    // cloth is now in its most-torn state at top of stack
  }

  preDestroy(targetStage: number) {
    this.saveState(); // stage 0
    for (let i = 0; i < targetStage - 1; i++) {
      this.proceduralTear(
        0.15 + Math.random() * 0.7,
        0.1 + Math.random() * 0.7,
        0.08,
        (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.05)
      );
      for (let s = 0; s < 10; s++) this.step(0, 0.992, 6);
      this.saveState(); // stages 1 to targetStage-1
    }
    this.drop();
    for (let s = 0; s < 80; s++) this.step(0.0012, 0.992, 6);
    this.saveState(); // stage targetStage (dropped)
  }

  init(width: number, height: number, segX: number, segY: number, tearThreshold: number, initStage: number) {
    this.width = width;
    this.height = height;
    this.segX = segX;
    this.segY = segY;
    this.tearThreshold = tearThreshold;
    this.particleCount = (segX + 1) * (segY + 1);

    this.pos = new Float32Array(this.particleCount * 3);
    this.prevPos = new Float32Array(this.particleCount * 3);
    this.pinned = new Uint8Array(this.particleCount);
    this.unpinDelay = new Float32Array(this.segX + 1);
    this.dropFrame = 0;

    for (let r = 0; r <= segY; r++) {
      for (let c = 0; c <= segX; c++) {
        const i = r * (segX + 1) + c;
        const x = (c / segX) * width - width / 2;
        const y = height / 2 - (r / segY) * height;
        const z = 0;
        this.pos[i * 3] = x;
        this.pos[i * 3 + 1] = y;
        this.pos[i * 3 + 2] = z;
        this.prevPos[i * 3] = x;
        this.prevPos[i * 3 + 1] = y;
        this.prevPos[i * 3 + 2] = z;
        
        if (r === 0) {
          this.pinned[i] = 1;
        }
      }
    }

    // Structural (horiz + vert) + shear diagonal constraints
    const structuralCount = (segX * (segY + 1)) + (segY * (segX + 1));
    const shearCount      = 2 * segX * segY;
    this.constraintCount  = structuralCount + shearCount;

    this.conA    = new Int32Array(this.constraintCount);
    this.conB    = new Int32Array(this.constraintCount);
    this.conRest = new Float32Array(this.constraintCount);
    this.conAlive = new Uint8Array(this.constraintCount);
    this.conAlive.fill(1);

    // Pre-allocate output buffers — zeroed and reused every step, no GC
    this.normalsArray = new Float32Array(this.particleCount * 3);
    this.indicesArray = new Uint32Array(segX * segY * 6);

    let conIdx = 0;
    const restW = width  / segX;
    const restH = height / segY;
    const restD = Math.sqrt(restW * restW + restH * restH); // diagonal rest length

    // Horizontal constraints
    for (let r = 0; r <= segY; r++) {
      for (let c = 0; c < segX; c++) {
        const i = r * (segX + 1) + c;
        this.conA[conIdx] = i;
        this.conB[conIdx] = i + 1;
        this.conRest[conIdx] = restW;
        conIdx++;
      }
    }
    // Vertical constraints
    for (let c = 0; c <= segX; c++) {
      for (let r = 0; r < segY; r++) {
        const i = r * (segX + 1) + c;
        this.conA[conIdx] = i;
        this.conB[conIdx] = i + (segX + 1);
        this.conRest[conIdx] = restH;
        conIdx++;
      }
    }
    // Shear diagonal ↘  (top-left → bottom-right)
    for (let r = 0; r < segY; r++) {
      for (let c = 0; c < segX; c++) {
        const i = r * (segX + 1) + c;
        this.conA[conIdx] = i;
        this.conB[conIdx] = i + (segX + 1) + 1;
        this.conRest[conIdx] = restD;
        conIdx++;
      }
    }
    // Shear diagonal ↙  (top-right → bottom-left)
    for (let r = 0; r < segY; r++) {
      for (let c = 0; c < segX; c++) {
        const i = r * (segX + 1) + c + 1;
        this.conA[conIdx] = i;
        this.conB[conIdx] = i + (segX + 1) - 1;
        this.conRest[conIdx] = restD;
        conIdx++;
      }
    }
  }

  // Physics-only step used internally (skips normals/index build for speed)
  stepPhysics(gravity: number, damping: number, iterations: number) {
    for (let i = 0; i < this.particleCount; i++) {
      if (this.pinned[i] !== 0) continue;
      const x  = this.pos[i*3]!,   y  = this.pos[i*3+1]!,   z  = this.pos[i*3+2]!;
      const vx = (x - this.prevPos[i*3]!)   * damping;
      const vy = (y - this.prevPos[i*3+1]!) * damping;
      const vz = (z - this.prevPos[i*3+2]!) * damping;
      this.prevPos[i*3] = x; this.prevPos[i*3+1] = y; this.prevPos[i*3+2] = z;
      this.pos[i*3] = x + vx; this.pos[i*3+1] = y + vy - gravity; this.pos[i*3+2] = z + vz;
    }
    for (let iter = 0; iter < iterations; iter++) {
      for (let j = 0; j < this.constraintCount; j++) {
        if (this.conAlive[j] === 0) continue;
        const a = this.conA[j]!, b = this.conB[j]!, rest = this.conRest[j]!;
        const dx = this.pos[b*3]!-this.pos[a*3]!, dy = this.pos[b*3+1]!-this.pos[a*3+1]!, dz = this.pos[b*3+2]!-this.pos[a*3+2]!;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist < 0.0001) continue;
        if (dist > rest * this.tearThreshold) { this.conAlive[j] = 0; this.brokenCount++; continue; }
        const diff = (dist - rest) / dist;
        const pa = this.pinned[a] === 1, pb = this.pinned[b] === 1;
        if (!pa && !pb) {
          const c = diff * 0.5;
          this.pos[a*3]!+=dx*c; this.pos[a*3+1]!+=dy*c; this.pos[a*3+2]!+=dz*c;
          this.pos[b*3]!-=dx*c; this.pos[b*3+1]!-=dy*c; this.pos[b*3+2]!-=dz*c;
        } else if (!pa) {
          this.pos[a*3]!+=dx*diff; this.pos[a*3+1]!+=dy*diff; this.pos[a*3+2]!+=dz*diff;
        } else if (!pb) {
          this.pos[b*3]!-=dx*diff; this.pos[b*3+1]!-=dy*diff; this.pos[b*3+2]!-=dz*diff;
        }
      }
    }
  }

  drop() {
    this.dropped = true;
    this.dropFrame = 0;
    
    // Calculate structural damage per column based on broken constraints
    const damage = new Float32Array(this.segX + 1);
    const numConstraints = this.conA.length;
    for (let j = 0; j < numConstraints; j++) {
      if (this.conAlive[j] === 0) {
        const p1 = this.conA[j]!;
        const c1 = p1 % (this.segX + 1);
        damage[c1] += 1;
      }
    }

    // Assign unpin delays based on damage (heavily torn sections fall first)
    for (let c = 0; c <= this.segX; c++) {
      // 40 frames max delay (about 0.6 seconds). High damage = 0 delay.
      this.unpinDelay[c] = Math.max(0, 40 - damage[c] * 1.5);
    }
  }

  step(gravity: number, damping: number, iterations: number, buffer?: ArrayBuffer): MsgOut {
    if (this.dropped) {
      this.dropFrame++;
      // Progressively unpin the top edge based on the calculated tear delays
      for (let c = 0; c <= this.segX; c++) {
        if (this.pinned[c] && this.dropFrame >= this.unpinDelay[c]) {
          this.pinned[c] = 0;
          this.prevPos[c * 3 + 2]! -= (Math.random() - 0.5) * 0.005; // soft release flutter
        }
      }
    }

    // 1. Verlet Integration
    for (let i = 0; i < this.particleCount; i++) {
      if (this.pinned[i] === 0) {
        const x = this.pos[i * 3]!;
        const y = this.pos[i * 3 + 1]!;
        const z = this.pos[i * 3 + 2]!;
        let vx = (x - this.prevPos[i * 3]!) * damping;
        let vy = (y - this.prevPos[i * 3 + 1]!) * damping;
        let vz = (z - this.prevPos[i * 3 + 2]!) * damping;
        
        if (this.dropped) {
          // The bottom half catches air and parachutes, falling slower than the top
          const normalizedY = y / this.height; // roughly -0.5 (bottom) to 0.5 (top)
          if (normalizedY < 0) {
            vy += 0.0002; // soft parachute effect
            // Gentle ripple, using position offset rather than constant acceleration
            vz += Math.sin(this.dropFrame * 0.05 + x * 5.0) * 0.0001; 
          }
        }
        
        this.prevPos[i * 3] = x;
        this.prevPos[i * 3 + 1] = y;
        this.prevPos[i * 3 + 2] = z;
        
        this.pos[i * 3] = x + vx;
        this.pos[i * 3 + 1] = y + vy - gravity;
        this.pos[i * 3 + 2] = z + vz;
      }
    }

    if (this.grabbedIdx >= 0) {
      this.pos[this.grabbedIdx * 3] = this.grabTargetX;
      this.pos[this.grabbedIdx * 3 + 1] = this.grabTargetY;
      this.pos[this.grabbedIdx * 3 + 2] = this.grabTargetZ;
    }

    // 2. Constraints resolution
    for (let iter = 0; iter < iterations; iter++) {
      for (let j = 0; j < this.constraintCount; j++) {
        if (this.conAlive[j] === 0) continue;
        const a = this.conA[j]!;
        const b = this.conB[j]!;
        const restLen = this.conRest[j]!;
        
        const dx = this.pos[b * 3]! - this.pos[a * 3]!;
        const dy = this.pos[b * 3 + 1]! - this.pos[a * 3 + 1]!;
        const dz = this.pos[b * 3 + 2]! - this.pos[a * 3 + 2]!;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (dist < 0.0001) continue;
        
        if (dist > restLen * this.tearThreshold) {
          this.conAlive[j] = 0;
          this.brokenCount++;
          continue;
        }
        
        const diff = (dist - restLen) / dist;
        const correction = diff * 0.5;
        
        const isPinnedA = this.pinned[a] === 1;
        const isPinnedB = this.pinned[b] === 1;
        
        if (!isPinnedA && !isPinnedB) {
          this.pos[a * 3]! += dx * correction;
          this.pos[a * 3 + 1]! += dy * correction;
          this.pos[a * 3 + 2]! += dz * correction;
          this.pos[b * 3]! -= dx * correction;
          this.pos[b * 3 + 1]! -= dy * correction;
          this.pos[b * 3 + 2]! -= dz * correction;
        } else if (!isPinnedA && isPinnedB) {
          this.pos[a * 3]! += dx * diff;
          this.pos[a * 3 + 1]! += dy * diff;
          this.pos[a * 3 + 2]! += dz * diff;
        } else if (isPinnedA && !isPinnedB) {
          this.pos[b * 3]! -= dx * diff;
          this.pos[b * 3 + 1]! -= dy * diff;
          this.pos[b * 3 + 2]! -= dz * diff;
        }
      }
      
      if (this.grabbedIdx >= 0) {
        this.pos[this.grabbedIdx * 3] = this.grabTargetX;
        this.pos[this.grabbedIdx * 3 + 1] = this.grabTargetY;
        this.pos[this.grabbedIdx * 3 + 2] = this.grabTargetZ;
      }
    }

    const { drawCount } = this.buildIndexAndNormals();

    // Recycle the incoming position buffer if it's the right size, else allocate once
    let outBuffer = buffer;
    if (!outBuffer || outBuffer.byteLength !== this.pos.byteLength) {
      outBuffer = new ArrayBuffer(this.pos.byteLength);
    }
    new Float32Array(outBuffer).set(this.pos);

    return {
      type: 'stepResult',
      id: 0,
      buffer: outBuffer,             // transferred back to main thread (recycled)
      normals: this.normalsArray,    // cloned — pre-allocated, never GC'd
      index: this.indicesArray,      // cloned — pre-allocated, never GC'd
      drawCount,
      brokenCount: this.brokenCount
    };
  }

  grab(x: number, y: number, z: number, radius: number) {
    let minDist = radius;
    let minIdx = -1;
    for (let i = 0; i < this.particleCount; i++) {
      const px = this.pos[i * 3]!;
      const py = this.pos[i * 3 + 1]!;
      const pz = this.pos[i * 3 + 2]!;
      const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2);
      if (dist < minDist) {
        minDist = dist;
        minIdx = i;
      }
    }
    
    if (minIdx >= 0) {
      this.grabbedIdx = minIdx;
      this.grabOffX = this.pos[minIdx * 3]! - x;
      this.grabOffY = this.pos[minIdx * 3 + 1]! - y;
      this.grabOffZ = this.pos[minIdx * 3 + 2]! - z;
      this.grabTargetX = this.pos[minIdx * 3]!;
      this.grabTargetY = this.pos[minIdx * 3 + 1]!;
      this.grabTargetZ = this.pos[minIdx * 3 + 2]!;
      
      this.wasPinned = this.pinned[minIdx] === 1;
      this.pinned[minIdx] = 0;
    }
  }

  moveGrab(x: number, y: number, z: number) {
    if (this.grabbedIdx >= 0) {
      this.grabTargetX = x + this.grabOffX;
      this.grabTargetY = y + this.grabOffY;
      this.grabTargetZ = z + this.grabOffZ;
    }
  }

  releaseGrab() {
    if (this.grabbedIdx >= 0) {
      if (this.wasPinned) {
        this.pinned[this.grabbedIdx] = 1;
      }
      this.grabbedIdx = -1;
    }
  }

  proceduralTear(normX: number, normY: number, radius: number, impulseZ: number, shape: string = 'oval'): void {
    // Convert normalised coords to cloth grid coords
    const centerCol = normX * this.segX;
    const centerRow = normY * this.segY;
    let colRadius = radius * this.segX;
    let rowRadius = radius * this.segY * 0.5;

    if (shape === 'puncture') {
      colRadius = radius * this.segX * 0.4;
      rowRadius = radius * this.segY * 0.4;
    } else if (shape === 'vertical-slit') {
      colRadius = radius * this.segX * 0.2;
      rowRadius = radius * this.segY * 1.5;
    } else if (shape === 'horizontal-slit') {
      colRadius = radius * this.segX * 1.5;
      rowRadius = radius * this.segY * 0.2;
    }

    // Break constraints whose midpoint falls inside the ellipse
    for (let j = 0; j < this.constraintCount; j++) {
      if (this.conAlive[j] === 0) continue;
      const a = this.conA[j]!;
      const b = this.conB[j]!;
      const W = this.segX + 1;
      const aCol = a % W, aRow = Math.floor(a / W);
      const bCol = b % W, bRow = Math.floor(b / W);
      const midCol = (aCol + bCol) / 2;
      const midRow = (aRow + bRow) / 2;
      
      let dc = (midCol - centerCol) / colRadius;
      let dr = (midRow - centerRow) / rowRadius;

      if (shape === 'diagonal') {
        const rotDc = (dc - dr) * 0.707;
        const rotDr = (dc + dr) * 0.707;
        dc = rotDc;
        dr = rotDr;
      }
      
      let threshold = 1.0;
      if (shape === 'jagged') {
        threshold += (Math.random() - 0.5) * 1.2;
      }

      if (dc * dc + dr * dr <= threshold) {
        this.conAlive[j] = 0;
        this.brokenCount++;
      }
    }

    // Apply z impulse to particles in the affected region — makes cloth billow forward
    const W = this.segX + 1;
    for (let i = 0; i < this.particleCount; i++) {
      if (this.pinned[i] === 1) continue;
      const col = i % W;
      const row = Math.floor(i / W);
      const dc = (col - centerCol) / (colRadius * 1.6);
      const dr = (row - centerRow) / (rowRadius * 1.6);
      if (dc * dc + dr * dr <= 1.0) {
        // randomise direction slightly so different particles go different ways
        const sign = (col + row) % 2 === 0 ? 1 : -1;
        this.prevPos[i * 3 + 2]! -= impulseZ * sign; // subtract from prevPos = adds velocity
      }
    }
  }

  buildIndexAndNormals() {
    // Reuse pre-allocated arrays — zero normals, reset index counter
    const normals = this.normalsArray;
    normals.fill(0);
    const indices = this.indicesArray;
    
    let indexIdx = 0;
    const limitFactor = this.tearThreshold * 1.5;
    const wRest = this.width / this.segX;
    const hRest = this.height / this.segY;
    const diagRest = Math.sqrt(wRest * wRest + hRest * hRest);
    
    const limitH = wRest * limitFactor;
    const limitV = hRest * limitFactor;
    const limitD = diagRest * limitFactor;
    
    for (let r = 0; r < this.segY; r++) {
      for (let c = 0; c < this.segX; c++) {
        const p0 = r * (this.segX + 1) + c;
        const p1 = p0 + 1;
        const p2 = (r + 1) * (this.segX + 1) + c;
        const p3 = p2 + 1;
        
        const distSq = (a: number, b: number) => {
          const dx = this.pos[b * 3]! - this.pos[a * 3]!;
          const dy = this.pos[b * 3 + 1]! - this.pos[a * 3 + 1]!;
          const dz = this.pos[b * 3 + 2]! - this.pos[a * 3 + 2]!;
          return dx * dx + dy * dy + dz * dz;
        };
        
        const d01Sq = distSq(p0, p1);
        const d02Sq = distSq(p0, p2);
        const d21Sq = distSq(p2, p1);
        
        if (d01Sq <= limitH * limitH && d02Sq <= limitV * limitV && d21Sq <= limitD * limitD) {
          indices[indexIdx++] = p0;
          indices[indexIdx++] = p2;
          indices[indexIdx++] = p1;
          
          const v1x = this.pos[p2 * 3]! - this.pos[p0 * 3]!;
          const v1y = this.pos[p2 * 3 + 1]! - this.pos[p0 * 3 + 1]!;
          const v1z = this.pos[p2 * 3 + 2]! - this.pos[p0 * 3 + 2]!;
          
          const v2x = this.pos[p1 * 3]! - this.pos[p0 * 3]!;
          const v2y = this.pos[p1 * 3 + 1]! - this.pos[p0 * 3 + 1]!;
          const v2z = this.pos[p1 * 3 + 2]! - this.pos[p0 * 3 + 2]!;
          
          const nx = v1y * v2z - v1z * v2y;
          const ny = v1z * v2x - v1x * v2z;
          const nz = v1x * v2y - v1y * v2x;
          
          normals[p0 * 3]! += nx; normals[p0 * 3 + 1]! += ny; normals[p0 * 3 + 2]! += nz;
          normals[p2 * 3]! += nx; normals[p2 * 3 + 1]! += ny; normals[p2 * 3 + 2]! += nz;
          normals[p1 * 3]! += nx; normals[p1 * 3 + 1]! += ny; normals[p1 * 3 + 2]! += nz;
        }
        
        const d12Sq = distSq(p1, p2);
        const d13Sq = distSq(p1, p3);
        const d23Sq = distSq(p2, p3);
        
        if (d12Sq <= limitD * limitD && d13Sq <= limitV * limitV && d23Sq <= limitH * limitH) {
          indices[indexIdx++] = p1;
          indices[indexIdx++] = p2;
          indices[indexIdx++] = p3;
          
          const v1x = this.pos[p2 * 3]! - this.pos[p1 * 3]!;
          const v1y = this.pos[p2 * 3 + 1]! - this.pos[p1 * 3 + 1]!;
          const v1z = this.pos[p2 * 3 + 2]! - this.pos[p1 * 3 + 2]!;
          
          const v2x = this.pos[p3 * 3]! - this.pos[p1 * 3]!;
          const v2y = this.pos[p3 * 3 + 1]! - this.pos[p1 * 3 + 1]!;
          const v2z = this.pos[p3 * 3 + 2]! - this.pos[p1 * 3 + 2]!;
          
          const nx = v1y * v2z - v1z * v2y;
          const ny = v1z * v2x - v1x * v2z;
          const nz = v1x * v2y - v1y * v2x;
          
          normals[p1 * 3]! += nx; normals[p1 * 3 + 1]! += ny; normals[p1 * 3 + 2]! += nz;
          normals[p2 * 3]! += nx; normals[p2 * 3 + 1]! += ny; normals[p2 * 3 + 2]! += nz;
          normals[p3 * 3]! += nx; normals[p3 * 3 + 1]! += ny; normals[p3 * 3 + 2]! += nz;
        }
      }
    }
    
    for (let i = 0; i < this.particleCount; i++) {
      const nx = normals[i * 3]!;
      const ny = normals[i * 3 + 1]!;
      const nz = normals[i * 3 + 2]!;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len > 0.0001) {
        normals[i * 3]! = nx / len;
        normals[i * 3 + 1]! = ny / len;
        normals[i * 3 + 2]! = nz / len;
      } else {
        normals[i * 3]! = 0;
        normals[i * 3 + 1]! = 0;
        normals[i * 3 + 2]! = 1;
      }
    }
    
    return { drawCount: indexIdx };
  }
}

const sim = new ClothSim();

self.addEventListener('message', (e) => {
  const msg = e.data as MsgIn;
  switch (msg.type) {
    case 'init':
      sim.init(msg.width, msg.height, msg.segX, msg.segY, msg.tearThreshold, msg.initStage);
      if (msg.initStage > 0) {
        sim.preTear(msg.initStage);
      } else {
        sim.saveState();
      }
      self.postMessage({ type: 'ready', id: msg.id, particleCount: sim.particleCount });
      break;
    case 'step': {
      const out = sim.step(msg.gravity, msg.damping, msg.iterations, msg.buffer);
      out.id = msg.id;
      self.postMessage(out, [out.buffer]);
      break;
    }
    case 'grab':
      sim.grab(msg.x, msg.y, msg.z, msg.radius);
      break;
    case 'moveGrab':
      sim.moveGrab(msg.x, msg.y, msg.z);
      break;
    case 'releaseGrab':
      sim.releaseGrab();
      break;
    case 'drop':
      sim.drop();
      sim.saveState();
      break;
    case 'rewind':
      sim.restoreState();
      break;
    case 'dispose':
      self.close();
      break;
    case 'proceduralTear':
      sim.proceduralTear(msg.normX, msg.normY, msg.radius, msg.impulseZ, msg.shape);
      sim.saveState();
      break;
  }
});
