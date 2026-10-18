import { registerEnvironment } from '@anime-vrm/engine/stage/environments';
import { disposePaintedAoiRoom, loadPaintedAoiRoom } from './sets/painted-aoi-room/PaintedAoiRoom';
import { disposePaintedFestival, loadPaintedFestival } from './sets/painted-festival/PaintedFestival';
import { disposePaintedClassroom, loadPaintedClassroom } from './sets/painted-classroom/PaintedClassroom';
import { disposePaintedGate, loadPaintedGate } from './sets/painted-gate/PaintedGate';
import { disposePaintedGround, loadPaintedGround } from './sets/painted-ground/PaintedGround';
import { disposePaintedLibrary, loadPaintedLibrary } from './sets/painted-library/PaintedLibrary';
import { disposePaintedGym, loadPaintedGym } from './sets/painted-gym/PaintedGym';
import { disposePaintedGondola, loadPaintedGondola } from './sets/painted-gondola/PaintedGondola';
import { disposePaintedSeaside, loadPaintedSeaside } from './sets/painted-seaside/PaintedSeaside';
import { disposeShoppingStreet, loadShoppingStreet } from './sets/shopping-street/ShoppingStreet';
import { disposePaintedShrine, loadPaintedShrine } from './sets/painted-shrine/PaintedShrine';

/** 簡易3D背景のセットを builtin:<名前> として登録する */
export function registerSets(): void {
  registerEnvironment('painted-classroom', { load: loadPaintedClassroom, dispose: disposePaintedClassroom });
  registerEnvironment('painted-library', { load: loadPaintedLibrary, dispose: disposePaintedLibrary });
  registerEnvironment('painted-aoi-room', { load: loadPaintedAoiRoom, dispose: disposePaintedAoiRoom });
  registerEnvironment('painted-gym', { load: loadPaintedGym, dispose: disposePaintedGym });
  registerEnvironment('painted-gate', { load: loadPaintedGate, dispose: disposePaintedGate });
  registerEnvironment('painted-ground', { load: loadPaintedGround, dispose: disposePaintedGround });
  registerEnvironment('painted-seaside', { load: loadPaintedSeaside, dispose: disposePaintedSeaside });
  registerEnvironment('painted-festival', { load: loadPaintedFestival, dispose: disposePaintedFestival });
  registerEnvironment('shopping-street', { load: loadShoppingStreet, dispose: disposeShoppingStreet });
  registerEnvironment('painted-shrine', { load: loadPaintedShrine, dispose: disposePaintedShrine });
  registerEnvironment('painted-gondola', { load: loadPaintedGondola, dispose: disposePaintedGondola });
}
