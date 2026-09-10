"""Portable settings format and shared, strict numeric validation."""
import math

DEFAULTS = dict(flatness=0.0, length=0.0, thickness=.45, corner_ratio=.18, corner_angle=0.0, jaw_roundness=0.0, face_slim=0.0, upper_peak=0.0,
                eye_x=0.0, eye_z=0.0, eye_width=1.0, eye_height=1.0,
                iris_x=0.0, iris_z=0.0, iris_width=1.0, iris_height=1.0,
                brow_x=0.0, brow_z=0.0, brow_peak=0.0, brow_curve=0.0)
RANGES = dict(flatness=(0,1), length=(0,1), thickness=(0,3), corner_ratio=(0,3), corner_angle=(-1,1),
              jaw_roundness=(0,1), face_slim=(0,1),
              upper_peak=(-1,1), eye_x=(-1,1), eye_z=(-1,1), eye_width=(.75,1.25), eye_height=(.75,1.25),
              iris_x=(-1,1), iris_z=(-1,1), iris_width=(.6,1.4), iris_height=(.6,1.4),
              brow_x=(-1,1), brow_z=(-1,1), brow_peak=(-1,1), brow_curve=(-1,1))


def validate_parameters(data):
    if not isinstance(data, dict) or set(data)-set(RANGES):
        raise ValueError('設定に未対応のパラメータが含まれています。')
    result = {}
    for key, value in data.items():
        lo, hi = RANGES[key]
        if type(value) not in (float,int) or not math.isfinite(value) or not lo <= value <= hi:
            raise ValueError(f'{key}: {lo}〜{hi}の有限の数値が必要です。')
        result[key] = float(value)
    return result


def export_document(params):
    return dict(format='eye-atelier-settings', version=1,
                parameters={key:params.get(key,default) for key,default in DEFAULTS.items()})


def import_document(document):
    if (not isinstance(document,dict) or document.get('format') != 'eye-atelier-settings'
            or type(document.get('version')) is not int or document['version'] != 1
            or set(document)-{'format','version','parameters'}):
        raise ValueError('対応しているEye Atelier設定ファイル（version 1）ではありません。')
    if not isinstance(document.get('parameters'),dict) or not document['parameters']:
        raise ValueError('設定ファイルのparametersが空か、形式が正しくありません。')
    return {**DEFAULTS, **validate_parameters(document['parameters'])}
