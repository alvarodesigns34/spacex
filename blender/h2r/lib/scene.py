"""The scene's life: reset, importing the code-built parts, exporting the asset."""
import os

import bpy


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = 'METRIC'
    s.unit_settings.scale_length = 1.0


def import_code_parts(path):
    """The code-built model (tools/h2r-export.mjs), its coincident vertices welded."""
    if not os.path.exists(path):
        raise SystemExit(f'{path} is missing: run `node tools/h2r-export.mjs` first')
    bpy.ops.import_scene.gltf(filepath=path, merge_vertices=True)


def export(path):
    """The asset: glTF binary, y up, every mesh with its normals and UVs, the materials' extensions
    (clearcoat, transmission) kept; geometry not compressed (the runtime needs no decoder)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', export_yup=True, export_apply=True,
        export_texcoords=True, export_normals=True, export_tangents=False,
        export_materials='EXPORT', export_image_format='AUTO', export_extras=True,
        export_animations=False, export_cameras=False, export_lights=False,
    )
    print(f'{os.path.relpath(path)}: {os.path.getsize(path) / 1e6:.1f} MB')
