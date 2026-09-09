import * as T from 'three';
import { MotionEngine, type Recipe } from './engine';

type Prop = string | { type: 'I' | 'L' | 'D'; value: number } | { type: 'f' | 'i' | 'l'; value: number[] };
interface Node { name: string; props: Prop[]; children: Node[]; }
const n = (name: string, props: Prop[] = [], children: Node[] = []): Node => ({ name, props, children });
const i = (value: number): Prop => ({ type: 'I', value });
const l = (value: number): Prop => ({ type: 'L', value });
const d = (value: number): Prop => ({ type: 'D', value });
const p = (name: string, type: string, values: number[], integer = false) => n('P', [name, type, type === 'double' ? 'Number' : type === 'int' ? 'Integer' : '', type.startsWith('Lcl ') || type === 'Number' ? 'A' : '', ...values.map(integer ? i : d)]);
const ticks = (seconds: number) => Math.round(seconds * 46186158000);
const named = (name: string, type: string) => `${name}\0\x01${type}`;

/** FBX 7.4 binary, uncompressed baked curves, centimetres, Y-up. No mesh is required. */
export function exportFBX(engine: MotionEngine, recipe: Recipe): ArrayBuffer {
  const rests = [...engine.rest.values()];
  const ids = new Map(rests.map((r, index) => [r.node, 1000 + index]));
  const count = Math.ceil(recipe.duration * recipe.fps) + 1;
  const times = Array.from({ length: count }, (_, frame) => Math.min(frame / recipe.fps, recipe.duration));
  const rotations = rests.map(() => [[], [], []] as number[][]);
  const positions = rests.map(() => [[], [], []] as number[][]);
  for (let frame = 0; frame < count; frame++) {
    engine.sample(recipe, times[frame]);
    rests.forEach((r, index) => {
      const e = new T.Euler().setFromQuaternion(r.node.quaternion, 'ZYX');
      [e.x, e.y, e.z].forEach((angle, axis) => {
        let degrees = T.MathUtils.radToDeg(angle);
        const prev = rotations[index][axis][frame - 1];
        if (prev !== undefined) degrees += 360 * Math.round((prev - degrees) / 360);
        rotations[index][axis].push(degrees);
      });
      r.node.position.toArray().forEach((v, axis) => positions[index][axis].push(v));
    });
  }
  const objects: Node[] = [], connections: Node[] = [];
  const connect = (child: number, parent: number, property?: string) => connections.push(n('C', [property ? 'OP' : 'OO', l(child), l(parent), ...(property ? [property] : [])]));
  objects.push(n('AnimationStack', [l(10), named('mixamo.com', 'AnimStack'), ''], [n('Properties70', [], [n('P', ['LocalStart', 'KTime', 'Time', '', l(0)]), n('P', ['LocalStop', 'KTime', 'Time', '', l(ticks(recipe.duration))]), n('P', ['ReferenceStart', 'KTime', 'Time', '', l(0)]), n('P', ['ReferenceStop', 'KTime', 'Time', '', l(ticks(recipe.duration))])])]));
  objects.push(n('AnimationLayer', [l(11), named('BaseLayer', 'AnimLayer'), ''])); connect(11, 10);
  let next = 10000;
  rests.forEach((r, index) => {
    const id = ids.get(r.node)!;
    const e = new T.Euler().setFromQuaternion(r.q, 'ZYX');
    objects.push(n('Model', [l(id), named(r.node.name, 'Model'), 'LimbNode'], [n('Version', [i(232)]), n('Properties70', [], [p('Lcl Translation', 'Lcl Translation', r.p.toArray()), p('Lcl Rotation', 'Lcl Rotation', [e.x, e.y, e.z].map(T.MathUtils.radToDeg)), p('Lcl Scaling', 'Lcl Scaling', r.s.toArray()), p('RotationOrder', 'enum', [0], true), p('InheritType', 'enum', [1], true)]), n('Shading', [i(1)]), n('Culling', ['CullingOff'])]));
    connect(id, ids.get(r.node.parent!) ?? 0);
    const attribute = next++;
    objects.push(n('NodeAttribute', [l(attribute), named(r.node.name, 'NodeAttribute'), 'LimbNode'], [n('TypeFlags', ['Skeleton'])])); connect(attribute, id);
    for (const [channel, values, property] of [['R', rotations[index], 'Lcl Rotation'], ['T', positions[index], 'Lcl Translation']] as const) {
      const curveNode = next++;
      objects.push(n('AnimationCurveNode', [l(curveNode), named(channel, 'AnimCurveNode'), ''], [n('Properties70', [], ['X', 'Y', 'Z'].map((axis, a) => p(`d|${axis}`, 'Number', [values[a][0]])))]));
      connect(curveNode, 11); connect(curveNode, id, property);
      ['X', 'Y', 'Z'].forEach((axis, a) => {
        const curve = next++;
        objects.push(n('AnimationCurve', [l(curve), named('', 'AnimCurve'), ''], [n('Default', [d(values[a][0])]), n('KeyVer', [i(4008)]), n('KeyTime', [{ type: 'l', value: times.map(ticks) }]), n('KeyValueFloat', [{ type: 'f', value: values[a] }]), n('KeyAttrFlags', [{ type: 'i', value: [24836] }]), n('KeyAttrDataFloat', [{ type: 'f', value: [0, 0, 0, 0] }]), n('KeyAttrRefCount', [{ type: 'i', value: [count] }])])); connect(curve, curveNode, `d|${axis}`);
      });
    }
  });
  const nodes = [
    n('FBXHeaderExtension', [], [n('FBXHeaderVersion', [i(1003)]), n('FBXVersion', [i(7400)]), n('Creator', ['Motion Mixer'])]),
    n('GlobalSettings', [], [n('Version', [i(1000)]), n('Properties70', [], [p('UpAxis', 'int', [1], true), p('UpAxisSign', 'int', [1], true), p('FrontAxis', 'int', [2], true), p('FrontAxisSign', 'int', [1], true), p('CoordAxis', 'int', [0], true), p('CoordAxisSign', 'int', [1], true), p('UnitScaleFactor', 'double', [1]), p('OriginalUnitScaleFactor', 'double', [1]), p('TimeMode', 'enum', [recipe.fps === 24 ? 11 : recipe.fps === 60 ? 3 : 6], true)])]),
    n('Documents', [], [n('Count', [i(1)]), n('Document', [l(1), named('Scene', 'Document'), 'Scene'], [n('Properties70'), n('RootNode', [l(0)])])]),
    n('References'), n('Definitions', [], [n('Version', [i(100)]), n('Count', [i(objects.length)]), ...['Model', 'NodeAttribute', 'AnimationStack', 'AnimationLayer', 'AnimationCurveNode', 'AnimationCurve'].map(type => n('ObjectType', [type], [n('Count', [i(objects.filter(o => o.name === type).length)])]))]),
    n('Objects', [], objects), n('Connections', [], connections), n('Takes', [], [n('Current', ['mixamo.com'])]),
  ];
  return binary(nodes);
}
function binary(nodes: Node[]): ArrayBuffer {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = []; let offset = 0;
  const push = (b: Uint8Array) => { chunks.push(b); offset += b.length; };
  const number = (size: number, value: number, type: string) => { const b = new Uint8Array(size), v = new DataView(b.buffer); if (type === 'L') v.setBigInt64(0, BigInt(Math.round(value)), true); else if (type === 'D') v.setFloat64(0, value, true); else if (type === 'f') v.setFloat32(0, value, true); else v.setInt32(0, value, true); return b; };
  function prop(value: Prop): Uint8Array {
    if (typeof value === 'string') { const b = enc.encode(value); return join([enc.encode('S'), number(4, b.length, 'I'), b]); }
    if (Array.isArray(value.value)) { const size = value.type === 'l' ? 8 : 4; return join([enc.encode(value.type), number(4, value.value.length, 'I'), number(4, 0, 'I'), number(4, value.value.length * size, 'I'), ...value.value.map(x => number(size, x, value.type === 'l' ? 'L' : value.type))]); }
    return join([enc.encode(value.type), number(value.type === 'I' ? 4 : 8, value.value, value.type)]);
  }
  function write(node: Node) {
    const name = enc.encode(node.name), props = node.props.map(prop), size = props.reduce((sum, b) => sum + b.length, 0);
    const header = new Uint8Array(13), view = new DataView(header.buffer); push(header); push(name); props.forEach(push);
    node.children.forEach(write); if (node.children.length) push(new Uint8Array(13));
    view.setUint32(0, offset, true); view.setUint32(4, props.length, true); view.setUint32(8, size, true); view.setUint8(12, name.length);
  }
  push(enc.encode('Kaydara FBX Binary  \0\x1a\0')); push(number(4, 7400, 'I')); nodes.forEach(write); push(new Uint8Array(13));
  push(new Uint8Array([0xfa, 0xbc, 0xab, 0x09, 0xd0, 0xc8, 0xd4, 0x66, 0xb1, 0x76, 0xfb, 0x83, 0x1c, 0xf7, 0x26, 0x7e]));
  push(new Uint8Array(16 - offset % 16)); push(new Uint8Array(4)); push(number(4, 7400, 'I')); push(new Uint8Array(120));
  push(new Uint8Array([0xf8, 0x5a, 0x8c, 0x6a, 0xde, 0xf5, 0xd9, 0x7e, 0xec, 0xe9, 0x0c, 0xe3, 0x75, 0x8f, 0x29, 0x0b]));
  return join(chunks).buffer as ArrayBuffer;
}
function join(parts: Uint8Array[]) { const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0)); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }
