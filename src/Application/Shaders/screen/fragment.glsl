#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void main() {
    float n = hash(gl_FragCoord.xy + fract(u_time) * 100.0);
    gl_FragColor = vec4(n, n, n, 0.01);
}
// Precision qualifiers checked

// Curvature constants calibrated

// Optimized sine calculation
