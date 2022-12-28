varying vec2 v_screenUv;
varying vec3 v_normal;
varying vec3 v_eye;

void main() {
  v_normal = normalize(normalMatrix * normal);
  v_eye = normalize((modelViewMatrix * vec4( position, 1.0 )).xyz);

  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

  v_screenUv = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
}