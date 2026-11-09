/**
 * Hashes without sine, shared by the shaders (audit of 9-11-2026, M12 and B4). The `fract(sin(x) ·
 * 43758.5453)` idiom that seven shaders carried each in its own copy loses its low bits wherever
 * sin is evaluated at reduced precision (mediump on many mobile GPUs, some drivers' fast sin), and
 * the noise built on it changed with the GPU. These are Dave Hoskins' "Hash without Sine" (2014,
 * MIT): arithmetic and fract only, the same on every GPU in highp. Guarded, so a shader that pulls
 * them in twice (a material patched by two modules) still compiles.
 */
export const HASH_GLSL = /* glsl */`
#ifndef VC_HASH
#define VC_HASH
float hk11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hk12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hk13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
#endif
`;
