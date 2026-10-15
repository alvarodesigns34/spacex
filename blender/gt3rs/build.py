"""
The Porsche 911 GT3 RS, refined in Blender (15-10-2026): the code-built car (src/vehicles/gt3rs.js, exported by
tools/vehicle-export.mjs) is the base; Blender rebuilds what the code drew coarsely and bakes the ambient occlusion,
and exports assets/gt3rs/gt3rs.glb. What drives it stays in code (src/sim/gt3*.js) and finds its parts by the code's
names (gt3-sprung, gt3-wheel-xx and their '-spin', gt3-wing-flap, gt3-brake-light, the mirrors); the cabin, with its
live instruments, is left out of the file and built by code on loading (vehicles/gt3rsAsset.js), as are the
materials: each part keeps its material's library name and the runtime lays the library's own material on it
(with its surface detail), adding the baked occlusion. The markings stay in their own asset (markings.py).

Run headless, never inside an open session (the bake uses operators):
    node tools/vehicle-export.mjs gt3rs
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --factory-startup -P blender/gt3rs/build.py
Options after `--`: `--no-bake`, `--save <file.blend>`.

PROVENANCE: the figures and the traced shape are the code's (data/gt3rs.js, gt3rs.js); what Blender adds is
described in each module (parts/wheels.py).
"""
import contextlib
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'common'))

import bpy  # noqa: E402

import webfinish  # noqa: E402
from parts import wheels  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
SOURCE = os.path.join(HERE, 'source', 'code-parts.glb')
OUT = os.path.join(ROOT, 'assets', 'gt3rs', 'gt3rs.glb')
CACHE = os.path.join(HERE, 'source')
# Not baked, and lit through: glass, lenses, the lit lamps.
CLEAR = ('gt3Glass', 'gt3Lens', 'gt3Drl', 'gt3Tail', 'gt3Amber', 'gt3Smoke', 'gt3Brake', 'gt3Reflector')


def base(o):
    return o.name.split('.')[0]


def build(bake=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if not os.path.exists(SOURCE):
        raise SystemExit(f'{SOURCE} is missing: run `node tools/vehicle-export.mjs gt3rs` first')
    with contextlib.redirect_stdout(io.StringIO()):
        bpy.ops.import_scene.gltf(filepath=SOURCE, merge_vertices=True)
    wheels.rebuild()
    root = bpy.data.objects['gt3rs']
    cabin = bpy.data.objects['gt3-cabin']
    in_cabin = set(cabin.children_recursive)
    meshes = [o for o in root.children_recursive if o.type == 'MESH' and o not in in_cabin]
    webfinish.apply_modifiers(meshes)
    if bake:
        clear = lambda o: all(s.material is None or s.material.name.split('.')[0].startswith(CLEAR) for s in o.material_slots)
        # (The cabin stays in the scene while the body bakes, so the body's inside is shaded by it.)
        print('ao:', webfinish.bake_ao(meshes, CACHE, 'gt3rs-ao', size=4096, distance=0.30, skip=clear,
                                       no_occlusion=lambda m: m.name.split('.')[0].startswith(CLEAR)))
    # The cabin is the code's (its instruments are live): only its empty stays, for the runtime to fill.
    for o in sorted(in_cabin, key=lambda o: -len(o.children_recursive)):
        if o.name in bpy.data.objects:
            bpy.data.objects.remove(o)
    return root


def export(root, path=OUT):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in [root] + list(root.children_recursive):
        o.select_set(True)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with contextlib.redirect_stdout(io.StringIO()):
        bpy.ops.export_scene.gltf(
            filepath=path, export_format='GLB', export_yup=True, export_apply=True, use_selection=True,
            export_texcoords=True, export_normals=True, export_tangents=False, export_materials='EXPORT',
            export_image_format='AUTO', export_extras=True, export_animations=False, export_cameras=False, export_lights=False,
        )
    print(f'{os.path.relpath(path, ROOT)}: {os.path.getsize(path) / 1e6:.2f} MB')


def main(argv):
    root = build(bake='--no-bake' not in argv)
    if '--save' in argv:
        bpy.ops.wm.save_as_mainfile(filepath=argv[argv.index('--save') + 1])
    export(root)


if __name__ == '__main__':
    main(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
