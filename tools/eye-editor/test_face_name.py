"""Test naming and reference migration without requiring a running Blender."""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest


class Object(dict):
    def __init__(self, name, armature=None, **props):
        super().__init__(props)
        self.name = name
        self.armature = armature

    def find_armature(self):
        return self.armature


class FaceNameTest(unittest.TestCase):
    def run_migration(self, source_name, preview_name, desired=None, occupied=False):
        bind = SimpleNamespace(mesh_object_name=preview_name)
        annotation = SimpleNamespace(mesh_object_name=source_name)
        ext = SimpleNamespace(spec_version='1.0', vrm1=SimpleNamespace(
            first_person=SimpleNamespace(mesh_annotations=[SimpleNamespace(node=annotation)])))
        armature = SimpleNamespace(data=SimpleNamespace(vrm_addon_extension=ext))
        source = Object(source_name, armature, eye_editor_role='source')
        preview = Object(preview_name, eye_editor_role='face')
        if desired:
            preview['eye_editor_original_name'] = desired
        objects = [source, preview]
        if occupied:
            objects.append(Object('Face', eye_editor_role='unrelated'))
        tree = ast.parse(Path(__file__).with_name('blender_engine.py').read_text())
        fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name=='preserve_face_name')
        ns = {'SESSION':dict(source=source,preview=preview),
              'bpy':SimpleNamespace(data=SimpleNamespace(objects=SimpleNamespace(
                  get=lambda name: next((o for o in objects if o.name==name), None)))),
              'expression_collections':lambda:[('happy',[SimpleNamespace(node=bind)],'node')]}
        exec(compile(ast.Module(body=[fn],type_ignores=[]),'<naming>','exec'),ns)
        ns['preserve_face_name']()
        name = desired or ('Face' if source_name.startswith('EyeEditor.Preview') else source_name)
        self.assertEqual(preview.name,name)
        self.assertEqual(preview['eye_editor_source'],source.name)
        self.assertEqual(bind.mesh_object_name,name)
        self.assertEqual(annotation.mesh_object_name,name)
        self.assertTrue(source.name.startswith('EyeEditor.Source.'))
        saved = source.name
        ns['preserve_face_name']()
        self.assertEqual(source.name,saved)
        self.assertEqual(preview.name,name)

    def test_original_face(self):
        self.run_migration('Face','EyeEditor.Preview')

    def test_legacy_vrm(self):
        self.run_migration('EyeEditor.Preview','EyeEditor.Preview.001')

    def test_custom_name(self):
        self.run_migration('AvatarHead','EyeEditor.Preview')

    def test_reopen(self):
        self.run_migration('EyeEditor.Source.Face','Face',desired='Face')

    def test_conflict_is_rejected(self):
        with self.assertRaises(ValueError):
            self.run_migration('EyeEditor.Preview','EyeEditor.Preview.001',occupied=True)


if __name__ == '__main__':
    unittest.main()
