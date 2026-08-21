precision highp float;
#define MAX_RIPPLES 16

uniform sampler2D uVideoTextureA;
uniform sampler2D uVideoTextureB;
uniform sampler2D uDisplacement;
uniform vec2 uLightUV;
uniform vec2 uLightVelocity;
uniform float uRadiusUV;
uniform vec2 uResolution;
uniform float uRestBrightness;
uniform float uRGBShift;
uniform float uBlendProgress;
uniform float uTime;
uniform vec4 uRippleData[MAX_RIPPLES];
uniform float uRippleCount;
uniform float uRippleEnabled;

varying vec2 vUv;

vec2 computeRippleOffset(vec2 uv) {
  if (uRippleEnabled < 0.5 || uRippleCount <= 0.0) {
    return vec2(0.0);
  }

  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 uvAspect = vec2(uv.x * aspect, uv.y);
  vec2 offset = vec2(0.0);

  for (int i = 0; i < MAX_RIPPLES; i += 1) {
    if (float(i) >= uRippleCount) {
      break;
    }
    vec4 ripple = uRippleData[i];
    vec2 centerAspect = vec2(ripple.x * aspect, ripple.y);
    float age = clamp(ripple.z, 0.0, 1.0);
    float strength = ripple.w;
    float radius = 0.02 + age * 0.5;
    float dist = distance(uvAspect, centerAspect);
    float ring = exp(-pow((dist - radius) * 30.0, 2.0));
    float wake = exp(-pow((dist - radius * 1.2) * 24.0, 2.0)) * 0.62;
    float fade = pow(1.0 - age, 0.95);
    vec2 dirAspect = normalize(uvAspect - centerAspect + vec2(0.0001, 0.0001));
    vec2 dirUv = vec2(dirAspect.x / aspect, dirAspect.y);
    float rippleValue = (ring + wake) * fade * strength;
    offset += dirUv * rippleValue * 0.024;
  }

  return offset;
}

vec3 sampleVideo(sampler2D tex, vec2 uv, float shiftAmount) {
  if (uRGBShift > 0.0) {
    vec3 color;
    color.r = texture2D(tex, uv + vec2(shiftAmount, 0.0)).r;
    color.g = texture2D(tex, uv).g;
    color.b = texture2D(tex, uv - vec2(shiftAmount, 0.0)).b;
    return color;
  }
  return texture2D(tex, uv).rgb;
}

void main() {
  vec4 displacement = texture2D(uDisplacement, vUv);
  float intensity = displacement.b;
  float blend = smoothstep(0.0, 1.0, uBlendProgress);
  float outgoingWarp = 0.022 * (1.0 + blend * 0.8) * (0.35 + 0.65 * intensity);
  float incomingWarp = 0.022 * (1.0 + (1.0 - blend) * 0.5) * (0.35 + 0.65 * intensity);
  vec2 rippleOffset = computeRippleOffset(vUv);
  vec2 warpedA = vUv - displacement.rg * outgoingWarp + rippleOffset;
  vec2 warpedB = vUv - displacement.rg * incomingWarp + rippleOffset;
  float shift = uRGBShift * intensity;
  vec3 colorA = sampleVideo(uVideoTextureA, warpedA, shift);
  vec3 colorB = sampleVideo(uVideoTextureB, warpedB, shift);
  vec3 videoColor = mix(colorA, colorB, blend);

  vec2 aspectUV = vec2(vUv.x * (uResolution.x / uResolution.y), vUv.y);
  vec2 aspectLight = vec2(
    uLightUV.x * (uResolution.x / uResolution.y),
    uLightUV.y
  );
  float aspectRadius = uRadiusUV * (uResolution.x / uResolution.y);
  float dist = distance(aspectUV, aspectLight);
  float radial = dist / max(aspectRadius, 1e-6);
  float edge = smoothstep(0.42, 1.0, radial);
  float wobble =
    sin(radial * 24.0 - uTime * 1.7) * 0.02 +
    sin(radial * 13.0 + uTime * 1.1) * 0.012;
  float falloff = 1.0 - smoothstep(0.0, 1.0, radial + wobble * edge);

  float brightness = uRestBrightness + falloff * (1.0 - uRestBrightness);
  gl_FragColor = vec4(videoColor * brightness, 1.0);
}
