import copy
import json
import unittest
from settings_schema import DEFAULTS, export_document, import_document


class SettingsTest(unittest.TestCase):
    def test_roundtrip_excludes_preview_state(self):
        values = {**DEFAULTS, 'brow_z':.4, 'iris_width':.9, 'blink':1, 'expression':'happy', 'before':True}
        doc = json.loads(json.dumps(export_document(values)))
        self.assertEqual(import_document(doc), {k:values[k] for k in DEFAULTS})
        self.assertNotIn('blink', doc['parameters'])

    def test_missing_fields_have_defaults(self):
        result = import_document(dict(format='eye-atelier-settings', version=1, parameters={'flatness':.3}))
        self.assertEqual(result['brow_curve'],0)
        self.assertEqual(result['iris_width'],1)

    def test_invalid_documents(self):
        valid = export_document(DEFAULTS)
        cases = [None, [], {}, {**valid,'version':True}, {**valid,'version':2}, {**valid,'format':'other'},
                 {**valid,'parameters':{}}, {**valid,'parameters':{'code':'anything'}},
                 {**valid,'parameters':{'blink':1}}]
        for value in (True,'0',None,[],float('nan'),float('inf'),1.01,-1.01):
            doc = copy.deepcopy(valid)
            doc['parameters']['brow_curve']=value
            cases.append(doc)
        for doc in cases:
            with self.subTest(doc=doc), self.assertRaises(ValueError):
                import_document(doc)


if __name__ == '__main__':
    unittest.main()
