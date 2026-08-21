import * as THREE from 'three';
import { DistortionField } from '../effects/DistortionField';
import { WaterRippleEffect } from '../effects/WaterRippleEffect';
import type { CursorState } from '../systems/cursor/types';
import videoVertexShader from '../shaders/video.vert?raw';
import videoFragmentShader from '../shaders/video.frag?raw';

interface HomepageSceneOptions {
  readonly restBrightness: number;
  readonly rippleExperimentEnabled?: boolean;
}

const MAX_RIPPLES = 16;

const VIDEO_SOURCES = [
  '/videos/home/video-1.mp4',
  '/videos/home/video-2.mp4',
  '/videos/home/video-3.mp4',
  '/videos/home/video-4.mp4',
  '/videos/home/video-5.mp4',
  '/videos/home/video-6.mp4',
] as const;

type ShaderUniforms = Record<string, THREE.IUniform<unknown>> & {
  uVideoTextureA: THREE.IUniform<THREE.VideoTexture>;
  uVideoTextureB: THREE.IUniform<THREE.VideoTexture>;
  uDisplacement: THREE.IUniform<THREE.DataTexture>;
  uLightUV: THREE.IUniform<[number, number]>;
  uLightVelocity: THREE.IUniform<[number, number]>;
  uRadiusUV: THREE.IUniform<number>;
  uResolution: THREE.IUniform<[number, number]>;
  uRestBrightness: THREE.IUniform<number>;
  uRGBShift: THREE.IUniform<number>;
  uBlendProgress: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
  uRippleData: THREE.IUniform<Float32Array>;
  uRippleCount: THREE.IUniform<number>;
  uRippleEnabled: THREE.IUniform<number>;
};

export class HomepageScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly videoElements: HTMLVideoElement[];
  private readonly videoTextures: THREE.VideoTexture[];
  private readonly material: THREE.ShaderMaterial;
  private readonly uniforms: ShaderUniforms;
  private readonly distortionField: DistortionField;
  private readonly waterRippleEffect: WaterRippleEffect | null;
  private readonly rippleUniformData: Float32Array;
  private readonly rippleExperimentEnabled: boolean;
  private readonly canvasElement: HTMLCanvasElement;
  private viewportWidth: number;
  private viewportHeight: number;
  private sectionProgress: number;
  private readonly prefetchedSceneIndices: Set<number>;

  constructor(options: HomepageSceneOptions) {
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    this.sectionProgress = 0;
    this.prefetchedSceneIndices = new Set<number>();
    this.rippleExperimentEnabled = options.rippleExperimentEnabled === true;
    this.rippleUniformData = new Float32Array(MAX_RIPPLES * 4);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    this.renderer.setClearColor(0x000000, 1);
    this.canvasElement = this.renderer.domElement;
    this.canvasElement.style.display = 'block';
    this.canvasElement.style.width = '100%';
    this.canvasElement.style.height = '100%';

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.videoElements = VIDEO_SOURCES.map((src) => createLoopedVideoElement(src));
    this.videoTextures = this.videoElements.map((videoElement) =>
      createVideoTexture(videoElement)
    );

    this.distortionField = new DistortionField({
      width: 128,
      height: 64,
      forceScale: 0.005,
      maxForce: 0.5,
    });
    // Curator-approved extension of the cursor's elastic distortion expression.
    this.waterRippleEffect = this.rippleExperimentEnabled
      ? new WaterRippleEffect({
          maxRipples: MAX_RIPPLES,
          spawnVelocityThreshold: 10,
          rippleLifetime: 3.8,
          intensity: 0.9,
        })
      : null;

    this.uniforms = {
      uVideoTextureA: { value: this.getVideoTexture(0) },
      uVideoTextureB: { value: this.getVideoTexture(1) },
      uDisplacement: { value: this.distortionField.getTexture() },
      uLightUV: { value: [0.5, 0.5] },
      uLightVelocity: { value: [0.0, 0.0] },
      uRadiusUV: { value: 0.0 },
      uResolution: { value: [this.viewportWidth, this.viewportHeight] },
      uRestBrightness: { value: options.restBrightness },
      uRGBShift: { value: 0.0 },
      uBlendProgress: { value: 0.0 },
      uTime: { value: 0.0 },
      uRippleData: { value: this.rippleUniformData },
      uRippleCount: { value: 0.0 },
      uRippleEnabled: { value: this.rippleExperimentEnabled ? 1.0 : 0.0 },
    };

    this.material = new THREE.ShaderMaterial({
      vertexShader: videoVertexShader,
      fragmentShader: videoFragmentShader,
      uniforms: this.uniforms,
    });

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(plane);
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.canvasElement);
    this.videoElements.forEach((videoElement) => {
      if (!videoElement.parentElement) {
        parent.appendChild(videoElement);
      }
    });
  }

  startVideo(): void {
    this.prefetchScene(0);
    this.prefetchScene(1);
  }

  setRestBrightness(value: number): void {
    const clampedValue = Math.max(0, Math.min(1, value));
    this.uniforms.uRestBrightness.value = clampedValue;
  }

  setRGBShift(value: number): void {
    this.uniforms.uRGBShift.value = Math.max(0, value);
  }

  setSectionProgress(progress: number): void {
    this.sectionProgress = Math.max(0, progress);
  }

  prefetchScene(index: number): void {
    if (this.videoElements.length === 0) {
      return;
    }
    const wrappedIndex =
      ((index % this.videoElements.length) + this.videoElements.length) % this.videoElements.length;
    if (this.prefetchedSceneIndices.has(wrappedIndex)) {
      return;
    }
    const videoElement = this.videoElements[wrappedIndex];
    if (!videoElement) {
      return;
    }
    videoElement.preload = 'auto';
    videoElement.load();
    void videoElement.play().catch(() => {
      // Browser autoplay policies may block without user gesture.
    });
    this.prefetchedSceneIndices.add(wrappedIndex);
  }

  resize(width: number, height: number, dpr: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(dpr);
    this.uniforms.uResolution.value = [width, height];
  }

  render(cursorState: CursorState, dt: number): void {
    this.distortionField.update(cursorState, this.viewportWidth, dt);
    if (this.waterRippleEffect) {
      this.waterRippleEffect.update(cursorState, dt);
      this.waterRippleEffect.writeUniformData(this.rippleUniformData);
      this.uniforms.uRippleCount.value = this.waterRippleEffect.getCount();
    } else {
      this.uniforms.uRippleCount.value = 0.0;
    }

    const sectionCount = Math.max(this.videoTextures.length, 1);
    const wrappedProgress =
      ((this.sectionProgress % sectionCount) + sectionCount) % sectionCount;
    const sectionIndex = Math.floor(wrappedProgress);
    const blend = wrappedProgress - sectionIndex;
    this.uniforms.uVideoTextureA.value = this.getVideoTexture(sectionIndex);
    this.uniforms.uVideoTextureB.value = this.getVideoTexture(
      (sectionIndex + 1) % sectionCount
    );
    this.uniforms.uBlendProgress.value = blend;

    this.uniforms.uLightUV.value = [cursorState.lightUV.x, cursorState.lightUV.y];
    this.uniforms.uLightVelocity.value = [cursorState.velocity.x, cursorState.velocity.y];
    this.uniforms.uRadiusUV.value = cursorState.radius / this.viewportWidth;
    this.uniforms.uTime.value += dt;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.videoElements.forEach((videoElement) => {
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load();
      videoElement.remove();
    });
    this.material.dispose();
    this.videoTextures.forEach((texture) => texture.dispose());
    this.renderer.dispose();
    this.canvasElement.remove();
  }

  private getVideoTexture(index: number): THREE.VideoTexture {
    const clampedIndex = Math.max(0, Math.min(this.videoTextures.length - 1, index));
    return this.videoTextures[clampedIndex] ?? this.videoTextures[0]!;
  }
}

const createLoopedVideoElement = (src: string): HTMLVideoElement => {
  const video = document.createElement('video');
  video.src = src;
  video.autoplay = false;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.crossOrigin = 'anonymous';
  video.style.display = 'none';
  return video;
};

const createVideoTexture = (video: HTMLVideoElement): THREE.VideoTexture => {
  const texture = new THREE.VideoTexture(video);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  return texture;
};
