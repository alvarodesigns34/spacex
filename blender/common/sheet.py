"""
Contact sheet of reference or review images, headless (Blender's image loader and numpy, no PIL):
    blender -b --factory-startup -P blender/common/sheet.py -- <out.png> <cols> <cell_w> <img> [<img> ...]
Each image is scaled to the cell width, kept in proportion, laid out row by row on dark grey.
"""
import sys

import bpy
import numpy as np


def load(path, cw):
    im = bpy.data.images.load(path)
    w, h = im.size
    a = np.array(im.pixels[:], np.float32).reshape(h, w, 4)
    ch = int(round(h * cw / w))
    ys = (np.arange(ch) * h / ch).astype(int)
    xs = (np.arange(cw) * w / cw).astype(int)
    return a[ys][:, xs]


def main(a):
    out, cols, cw = a[0], int(a[1]), int(a[2])
    tiles = [load(p, cw) for p in a[3:]]
    ch = max(t.shape[0] for t in tiles)
    rows = (len(tiles) + cols - 1) // cols
    pad = 6
    W, H = cols * (cw + pad) + pad, rows * (ch + pad) + pad
    sheet = np.zeros((H, W, 4), np.float32)
    sheet[..., :3] = 0.08
    sheet[..., 3] = 1
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        # Blender's pixels run bottom-up: lay the rows out from the top of the sheet.
        y0 = H - pad - (r + 1) * (ch + pad) + pad + (ch - t.shape[0])
        x0 = pad + c * (cw + pad)
        sheet[y0:y0 + t.shape[0], x0:x0 + cw] = t
    img = bpy.data.images.new('sheet', W, H)
    img.pixels.foreach_set(sheet.ravel())
    img.filepath_raw = out
    img.file_format = 'JPEG' if out.lower().endswith('.jpg') else 'PNG'
    img.save()


main(sys.argv[sys.argv.index('--') + 1:])
