/**
 * The rider who goes with the Ninja H2R when it is ridden (not on the exhibit): a figure in
 * one-piece leathers and a full-face helmet, tucked in behind the screen — hips on the seat,
 * knees against the tank, feet on the pegs, hands on the clip-ons, the helmet low behind the
 * screen. Proportions ≈ a 1.78 m adult; the joints are placed on the bike's traced seat, pegs,
 * grips and screen (vehicles/h2r.js). Plain black and grey leathers with green panels, no
 * markings.
 *
 * Frame: the bike model's (x forward from the middle of the wheelbase, y up from the ground,
 * z right). hangOff(k) moves the body to the inside of a turn, k from −1 (left) to 1 (right).
 */
import * as THREE from 'three';

export function buildH2rRider(M) {
  M.h2rLeather ??= new THREE.MeshStandardMaterial({ name: 'h2r-leather', color: 0x141516, metalness: 0.05, roughness: 0.6 });
  M.h2rLeatherGrey ??= new THREE.MeshStandardMaterial({ name: 'h2r-leather-grey', color: 0x5d6166, metalness: 0.05, roughness: 0.55 });
  M.h2rLeatherGreen ??= new THREE.MeshStandardMaterial({ name: 'h2r-leather-green', color: 0x2f9d3a, metalness: 0.05, roughness: 0.5 });
  M.h2rHelmet ??= new THREE.MeshPhysicalMaterial({ name: 'h2r-helmet', color: 0x0d0e10, metalness: 0.2, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  M.h2rVisor ??= new THREE.MeshPhysicalMaterial({ name: 'h2r-visor', color: 0x0e1114, metalness: 0.5, roughness: 0.08, clearcoat: 1 });
  const root = new THREE.Group();
  root.name = 'h2r-rider';
  const body = new THREE.Group();
  body.name = 'h2r-rider-body';
  root.add(body);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const limb = (a, b, r, mat, name) => {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, L - 2 * r * 0.2), 6, 12), mat);
    m.name = name;
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.castShadow = true;
    body.add(m);
    return m;
  };
  // The joints (≈ m).
  const hip = V(-0.27, 0.89, 0), neck = V(0.07, 1.01, 0);
  for (const s of [-1, 1]) {
    const hipS = V(-0.25, 0.88, s * 0.12), knee = V(0.03, 0.69, s * 0.215), ankle = V(-0.24, 0.43, s * 0.205), toe = V(-0.16, 0.39, s * 0.2);
    limb(hipS, knee, 0.075, M.h2rLeather, 'h2r-rider-thigh');
    limb(knee, ankle, 0.055, M.h2rLeather, 'h2r-rider-shin');
    limb(ankle, toe, 0.045, M.h2rLeatherGrey, 'h2r-rider-boot');
    // The knee slider, on the outside of each knee.
    const slider = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.02), M.h2rLeatherGrey);
    slider.name = 'h2r-rider-knee-slider'; slider.position.copy(knee).add(V(0.01, 0, s * 0.07)); body.add(slider);
    const shoulder = V(0.03, 1.0, s * 0.17), elbow = V(0.2, 0.92, s * 0.25), hand = V(0.37, 0.89, s * 0.31);
    limb(shoulder, elbow, 0.05, M.h2rLeather, 'h2r-rider-arm');
    limb(elbow, hand, 0.042, M.h2rLeatherGreen, 'h2r-rider-forearm');
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), M.h2rLeatherGrey);
    glove.name = 'h2r-rider-glove'; glove.position.copy(hand); glove.scale.set(1.3, 0.8, 1); body.add(glove);
  }
  // The torso, low along the tank, with the aero hump on the back.
  const torso = limb(hip, neck, 0.15, M.h2rLeather, 'h2r-rider-torso');
  torso.scale.set(1, 1, 1.15);
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), M.h2rLeatherGreen);
  hump.name = 'h2r-rider-hump'; hump.position.set(-0.06, 1.03, 0); hump.scale.set(1.6, 0.6, 0.8); body.add(hump);
  // The helmet, low behind the screen, chin on the tank, and its visor.
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 16), M.h2rHelmet);
  helmet.name = 'h2r-rider-helmet'; helmet.position.set(0.16, 1.07, 0); helmet.scale.set(1.1, 1, 0.9); body.add(helmet);
  // The visor: a band across the helmet's front (SphereGeometry's φ = π faces +x).
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.137, 20, 8, Math.PI - 0.75, 1.5, Math.PI * 0.36, Math.PI * 0.2), M.h2rVisor);
  visor.name = 'h2r-rider-visor'; visor.position.copy(helmet.position); visor.scale.copy(helmet.scale); body.add(visor);
  root.userData.eye = V(0.24, 1.08, 0);
  root.userData.hangOff = (k) => {
    // Hanging off: the hips slide ≈12 cm to the inside, the body rolls ≈15° further than the bike.
    body.position.set(0, 0, k * 0.12);
    body.rotation.x = k * 0.26;
  };
  return root;
}
