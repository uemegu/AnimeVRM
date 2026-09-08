"""Validate actual exported VRM 1.0 expression binds and morph payloads."""
import json
import struct
from pathlib import Path


def read_glb(path):
    raw = Path(path).read_bytes()
    magic, version, length = struct.unpack_from('<III', raw)
    if magic != 0x46546C67 or version != 2 or length != len(raw):
        raise ValueError('Invalid GLB header')
    offset, document, binary = 12, None, b''
    while offset < length:
        size, kind = struct.unpack_from('<II', raw, offset)
        payload = raw[offset+8:offset+8+size]
        if kind == 0x4E4F534A:
            document = json.loads(payload)
        elif kind == 0x004E4942:
            binary = payload
        offset += 8 + size
    if document is None:
        raise ValueError('Missing GLB JSON')
    return document, binary


def position_extent(document, binary, index):
    accessor = document['accessors'][index]
    if accessor['componentType'] != 5126 or accessor['type'] != 'VEC3':
        raise ValueError('Unexpected POSITION accessor format')
    extent = 0.0
    if 'bufferView' in accessor:
        view = document['bufferViews'][accessor['bufferView']]
        start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        stride = view.get('byteStride', 12)
        for i in range(accessor['count']):
            extent = max(extent, *(abs(v) for v in struct.unpack_from('<3f', binary, start+i*stride)))
    if 'sparse' in accessor:
        sparse = accessor['sparse']
        view = document['bufferViews'][sparse['values']['bufferView']]
        start = view.get('byteOffset', 0) + sparse['values'].get('byteOffset', 0)
        for i in range(sparse['count']):
            extent = max(extent, *(abs(v) for v in struct.unpack_from('<3f', binary, start+i*12)))
    return extent


def verify(path, expected=None, original_name='Face'):
    document, binary = read_glb(path)
    expressions = document['extensions']['VRMC_vrm']['expressions']
    expressions = {**expressions.get('preset', {}), **expressions.get('custom', {})}
    nodes, meshes = document['nodes'], document['meshes']
    if any(n.get('name') == original_name and 'mesh' in n for n in nodes):
        raise ValueError('元の顔が書き出しに混入しています。')
    checked, moving, counts = 0, {}, {}
    for name, expression in expressions.items():
        actual = []
        for bind in expression.get('morphTargetBinds', []):
            node = nodes[bind['node']]
            mesh = meshes[node['mesh']]
            index = bind['index']
            names = mesh.get('extras', {}).get('targetNames', [])
            if index >= len(names):
                raise ValueError(f'{name}: missing morph target name')
            actual.append((node.get('name'), names[index], bind['weight']))
            extent = 0.0
            for primitive in mesh['primitives']:
                if index >= len(primitive.get('targets', [])):
                    raise ValueError(f'{name}: missing morph target')
                target = primitive['targets'][index]
                if 'POSITION' in target:
                    extent = max(extent, position_extent(document, binary, target['POSITION']))
            if extent * bind['weight'] > 1e-7:
                moving.setdefault(name, []).append(node.get('name'))
            checked += 1
        counts[name] = len(actual)
        if expected is not None:
            for node_name, key_name, weight in expected.get(name, []):
                if not any(n == node_name and k == key_name and abs(w-weight) < 1e-5 for n,k,w in actual):
                    raise ValueError(f'{name}: {node_name}/{key_name} の表情バインドが書き出しに含まれていません。')
    if expected:
        for name, binds in expected.items():
            if binds and name not in expressions:
                raise ValueError(f'{name}: 表情自体が書き出しに含まれていません。')
        for name in ('happy', 'angry', 'sad', 'aa', 'blink'):
            if expected.get(name) and not moving.get(name):
                raise ValueError(f'{name}: 動かせる表情の頂点データがありません。')
    return dict(bindings=checked, counts=counts, moving=moving, original_excluded=True)


if __name__ == '__main__':
    import sys
    print(json.dumps(verify(sys.argv[1]), ensure_ascii=False, indent=2))
