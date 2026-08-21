import * as THREE from 'three';

let cachedNormalMap: THREE.DataTexture | null = null;

export function getCanvasNormalMap(): THREE.DataTexture {
  if (cachedNormalMap) return cachedNormalMap;

  const size = 512;
  const data = new Uint8Array(size * size * 4);
  const threads = 90; // Fewer threads, thicker weave

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const u = x / size;
      const v = y / size;

      // Checkerboard pattern to alternate which thread (horizontal vs vertical) is on top
      const checker = Math.sign(Math.cos(u * Math.PI * threads) * Math.cos(v * Math.PI * threads));
      
      let dx = 0;
      let dy = 0;

      if (checker > 0) {
        // Vertical thread is on top
        dx = -Math.sin(u * Math.PI * threads * 2) * 3.0; // Much deeper threads
        dy = 0;
      } else {
        // Horizontal thread is on top
        dx = 0;
        dy = -Math.sin(v * Math.PI * threads * 2) * 3.0;
      }

      // Add high-frequency noise for coarse fiber grain
      dx += (Math.random() - 0.5) * 1.5;
      dy += (Math.random() - 0.5) * 1.5;
      
      const dz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Convert normal vector to RGB (0-255)
      data[i] = Math.floor((dx / len + 1) * 127.5);
      data[i + 1] = Math.floor((dy / len + 1) * 127.5);
      data[i + 2] = 255; // Z points up (blue)
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Repeat the texture across the cloth for heavy detail
  texture.repeat.set(6, 6); 
  
  // Enable mipmapping for smooth rendering at a distance
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  cachedNormalMap = texture;
  return texture;
}
