/**
 * Soft shadows whose penumbra grows with the gap between caster and receiver: percentage-closer
 * soft shadows (PCSS; Fernando, "Percentage-Closer Soft Shadows", NVIDIA 2005), for the sun
 * (audit of 9-11-2026, A2).
 *
 * Until then the sun's shadow used three.js's PCFSoftShadowMap: four bilinear taps, a penumbra one
 * texel wide whatever the geometry, so a tower's shadow on the ground 80 m below was as sharp as a
 * wheel's on the asphalt next to it, and in the overview (a 680 m frustum on 4 096 texels, ≈17 cm a
 * texel) every edge stepped. The Sun is not a point: its disc is ≈0.53° across, so a shadow's edge
 * blurs by the caster-to-receiver distance × 0.0093. PCSS measures that distance per pixel:
 *
 *  1. blocker search: the shadow map is read over a disc that a caster could fall in, and the
 *     depths in front of the receiver are averaged — the mean blocker depth;
 *  2. penumbra width = (receiver − blocker) depth in metres × the Sun's angular diameter, in map UV
 *     (the filter's radius is half of it);
 *  3. a percentage-closer filter over that disc (32 taps on a Vogel spiral, turned per pixel by
 *     interleaved gradient noise so the taps do not band).
 * The filter's radius is never under 1 texel (the old filter's softness) nor over 32 texels (≈2.7 m at
 * 8 192² over the overview's 680 m, a penumbra ≈5 m wide: what a caster ≈500 m up the light's path
 * gives, beyond any structure here).
 *
 * Installed as a patch of three.js's shadow chunk, like fogSun.js, before anything compiles; the
 * parameters are one shared vec4 (set each frame by environment.js updateShadow). Every replace
 * must find its line or it throws at start-up. It is a look built on physics, not a reference
 * renderer: the blocker average and the cap are the method's approximations (≈).
 */
import * as THREE from 'three';

/** x: light depth range (far − near), m · y: the Sun's angular diameter, rad · z: frustum width, m · w: map size, texels. */
export const PCSS = { params: new Float32Array([1195, 0.0093, 680, 4096]) };
/** The Sun's mean angular diameter, rad (≈0.533°). */
export const SUN_ANGLE = 0.533 * Math.PI / 180;
let installed = false;

const PCSS_GLSL = /* glsl */`
	uniform vec4 pcssParams;
	float pcssNoise( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
	vec2 pcssVogel( float i, float n, float rot ) {
		float r = sqrt( ( i + 0.5 ) / n ), th = i * 2.39996323 + rot;
		return r * vec2( cos( th ), sin( th ) );
	}
	float pcssShadow( sampler2D shadowMap, vec2 shadowMapSize, vec4 c ) {
		float texel = 1.0 / shadowMapSize.x;
		// Map UV of penumbra per unit of depth (depth 0..1 spans pcssParams.x metres).
		float k = pcssParams.x * pcssParams.y / max( pcssParams.z, 1e-3 );
		float rot = pcssNoise( gl_FragCoord.xy ) * 6.2831853;
		// Radii, half the widths: a penumbra Δ·θ wide is a disc of radius Δ·θ/2 (until a fix the same
		// day it was used as the radius, doubling every penumbra).
		float search = clamp( 0.5 * c.z * k, 2.0 * texel, 32.0 * texel );
		float sum = 0.0, n = 0.0;
		for ( int i = 0; i < 16; i ++ ) {
			float d = unpackRGBAToDepth( texture2D( shadowMap, c.xy + pcssVogel( float( i ), 16.0, rot ) * search ) );
			if ( d < c.z ) { sum += d; n += 1.0; }
		}
		if ( n < 0.5 ) return 1.0;
		float pen = clamp( 0.5 * ( c.z - sum / n ) * k, 1.0 * texel, 32.0 * texel );
		float lit = 0.0;
		for ( int i = 0; i < 32; i ++ ) {
			lit += step( c.z, unpackRGBAToDepth( texture2D( shadowMap, c.xy + pcssVogel( float( i ), 32.0, rot + 1.7 ) * pen ) ) );
		}
		return lit / 32.0;
	}
`;

/** Patches three.js's shadow chunk and adds the shared uniform to every built-in shader with shadows. Once. */
export function installPcss() {
  if (installed) return;
  installed = true;
  const C = THREE.ShaderChunk;
  const patch = (name, from, to) => {
    const next = C[name].replace(from, to);
    if (next === C[name]) throw new Error(`pcss: three.js chunk ${name} no longer has the line it patches`);
    C[name] = next;
  };
  patch('shadowmap_pars_fragment', '\tfloat texture2DCompare( sampler2D depths, vec2 uv, float compare ) {\n\t\treturn step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );\n\t}',
    '\tfloat texture2DCompare( sampler2D depths, vec2 uv, float compare ) {\n\t\treturn step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );\n\t}' + PCSS_GLSL);
  // The sun's soft branch becomes PCSS; three's own four-tap filter stays under a macro nothing defines.
  patch('shadowmap_pars_fragment', '\t\t#elif defined( SHADOWMAP_TYPE_PCF_SOFT )\n\t\t\tvec2 texelSize = vec2( 1.0 ) / shadowMapSize;\n\t\t\tfloat dx = texelSize.x;',
    '\t\t#elif defined( SHADOWMAP_TYPE_PCF_SOFT )\n\t\t\tshadow = pcssShadow( shadowMap, shadowMapSize, shadowCoord );\n\t\t#elif defined( SHADOWMAP_TYPE_PCF_SOFT_THREE )\n\t\t\tvec2 texelSize = vec2( 1.0 ) / shadowMapSize;\n\t\t\tfloat dx = texelSize.x;');
  for (const name of Object.keys(THREE.ShaderLib)) {
    const u = THREE.ShaderLib[name].uniforms;
    if (u && u.directionalShadowMap) u.pcssParams = { value: PCSS.params };
  }
}

/** Per frame: the light camera's depth range and width, and the map's size. */
export function updatePcss(shadowCamera, mapSize) {
  PCSS.params[0] = shadowCamera.far - shadowCamera.near;
  PCSS.params[1] = SUN_ANGLE;
  PCSS.params[2] = shadowCamera.right - shadowCamera.left;
  PCSS.params[3] = mapSize;
}
