"""
Tesla Model Y (2025), built in Blender: runs the ty_*.py modules in order in one namespace (they were
written as fragments of one session and share their names) and exports assets/modely/modely.glb.

Run headless, never inside an open session (the build adds and removes thousands of objects):
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --factory-startup -P blender/modely/build.py
Options after `--`: `--no-export` (build only), `--save <file.blend>` (keep the scene for inspection),
`--render <dir>` (review stills from the cameras of ty_scene2.py).
"""
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'modely', 'modely.glb')
ORDER = ['ty_core', 'ty_design', 'ty_scene', 'ty_scene2', 'ty_body', 'ty_details', 'ty_wheels', 'ty_interior', 'ty_interior2', 'ty_preview']


def load():
    ns = {'__name__': 'modely_build'}
    for m in ORDER:
        path = os.path.join(HERE, m + '.py')
        exec(compile(open(path, encoding='utf-8').read(), path, 'exec'), ns)
    return ns


def build(ns):
    ns['build_materials_v2']()
    body = ns['build_body']()
    ns['build_details'](body)
    ns['build_wheels']()
    ns['build_underbody']()
    ns['build_interior'](body)
    ns['refine_interior'](body)
    return body


def export(ns, path=OUT):
    root = ns['get_root']()
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in [root] + list(root.children_recursive):
        o.select_set(True)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', export_yup=True, export_apply=True, use_selection=True,
        export_texcoords=True, export_normals=True, export_tangents=False, export_materials='EXPORT',
        export_image_format='AUTO', export_extras=True, export_animations=False, export_cameras=False, export_lights=False,
    )
    print(f'{os.path.relpath(path, ROOT)}: {os.path.getsize(path) / 1e6:.2f} MB')


def main(argv):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ns = load()
    build(ns)
    if '--save' in argv:
        bpy.ops.wm.save_as_mainfile(filepath=argv[argv.index('--save') + 1])
    if '--no-export' not in argv:
        export(ns)


if __name__ == '__main__':
    main(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
