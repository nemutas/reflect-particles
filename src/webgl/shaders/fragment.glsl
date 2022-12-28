uniform sampler2D tParticles;
uniform sampler2D tMatcap;
varying vec2 v_screenUv;
varying vec3 v_normal;
varying vec3 v_eye;

#include '../glsl/matcap.glsl'

float rand(vec2 n) { 
	return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

vec3 randVector(in vec3 p) {
  return normalize(vec3(rand(p.xy), rand(p.yz), rand(p.xz)));
}

void main() {
  vec3 roughness = randVector(v_normal) * 0.03;

  vec2 screenUv = v_screenUv + v_normal.xy * 0.01 + roughness.xy * 0.05;
  vec4 particlesTexture = texture2D(tParticles, screenUv);
  vec2 matcapUv = matcap(v_eye, v_normal + roughness);
  vec4 m = texture2D(tMatcap, matcapUv);

  vec3 color = particlesTexture.rgb;
  color += m.rgb;

  gl_FragColor = particlesTexture;
  gl_FragColor = vec4(color, 1.0);
}