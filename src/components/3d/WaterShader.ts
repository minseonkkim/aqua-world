import * as THREE from 'three';

export const waterVertexShader = `
  uniform float uTime;
  uniform float uWaveAmplitude;
  uniform float uWaveFrequency;

  varying vec2 vUv;
  varying vec3 vPosition;
  varying float vWaveHeight;

  void main() {
    vUv = uv;
    vPosition = position;

    vec3 pos = position;
    // Multiple wave layers for natural look
    float wave1 = sin(pos.x * uWaveFrequency + uTime * 1.5) * uWaveAmplitude;
    float wave2 = sin(pos.z * uWaveFrequency * 0.8 + uTime * 1.2 + 1.0) * uWaveAmplitude * 0.6;
    float wave3 = sin((pos.x + pos.z) * uWaveFrequency * 0.5 + uTime * 0.8) * uWaveAmplitude * 0.4;

    pos.y += wave1 + wave2 + wave3;
    vWaveHeight = (wave1 + wave2 + wave3) / (uWaveAmplitude * 2.0);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const waterFragmentShader = `
  uniform float uTime;
  uniform vec3 uWaterColor;
  uniform vec3 uFoamColor;
  uniform float uOpacity;
  uniform float uFoamThreshold;

  varying vec2 vUv;
  varying float vWaveHeight;

  void main() {
    // Base water color with depth variation
    vec3 color = uWaterColor;

    // Foam at wave peaks
    float foam = smoothstep(uFoamThreshold, 1.0, vWaveHeight);
    color = mix(color, uFoamColor, foam * 0.4);

    // Caustics-like shimmer
    float shimmer = sin(vUv.x * 30.0 + uTime * 2.0) * sin(vUv.y * 30.0 + uTime * 1.5);
    shimmer = smoothstep(0.7, 1.0, shimmer) * 0.15;
    color += vec3(shimmer);

    // Edge transparency
    float edgeFade = smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x)
                   * smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.95, vUv.y);

    gl_FragColor = vec4(color, uOpacity * edgeFade);
  }
`;

export function createWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uWaterColor: { value: new THREE.Color(0x006994) },
      uFoamColor: { value: new THREE.Color(0xaaddff) },
      uOpacity: { value: 0.75 },
      uWaveAmplitude: { value: 0.08 },
      uWaveFrequency: { value: 2.0 },
      uFoamThreshold: { value: 0.6 },
    },
    transparent: true,
    side: THREE.DoubleSide,
  });
}
