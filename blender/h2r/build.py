"""
The Kawasaki Ninja H2R, built in Blender (October 2026): the model is made here and exported as
assets/h2r/h2r.glb; its physics, ride, sound and animation stay in code (src/sim/h2r*.js), which
find the parts they move by name.

Run (Blender 5 as the `bpy` module, or `blender -b -P`):
    node tools/h2r-export.mjs          # the code-built parts -> blender/h2r/source/code-parts.glb
    python3 blender/h2r/build.py       # -> assets/h2r/h2r.glb

PROVENANCE: every published figure is in src/data/h2r.js with its source; the shapes are fitted to
photographs (reference only, never in the repository) as each module's header says; what is
reconstructed is marked ≈ there.

Frame: x forward from the middle of the wheelbase, y up, z to the right (three.js); Blender's own
axes are z up, so its importer and exporter turn the scene, and these modules work in Blender's
axes through `lib.frame` (X = x forward, Y = -z left, Z = y up).

The parts the runtime moves (names kept exactly): h2r-steer (about the steering axis),
h2r-wheel-f-spin, h2r-wheel-r-spin, h2r-swingarm (about the pivot), h2r-impeller, h2r-dash-face
(its face redrawn live).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from lib import scene  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
SOURCE = os.path.join(HERE, 'source', 'code-parts.glb')
OUT = os.path.join(ROOT, 'assets', 'h2r', 'h2r.glb')


def build():
    scene.reset()
    scene.import_code_parts(SOURCE)
    scene.export(OUT)


if __name__ == '__main__':
    build()
