import plotJson from '../data/plot.json';
import { clearDraft, loadDraft } from './draft';
import { setupEditor } from './editor';
import { buildObjects } from './objects';
import { createWorld } from './scene';
import { sunState, toInstant } from './sun';
import type { PlotData } from './types';
import { setupTimeControls } from './ui';

const draft = loadDraft();
const plot = draft ?? (structuredClone(plotJson) as PlotData);
let world: ReturnType<typeof createWorld>;
try {
  world = createWorld(plot);
  const { root, byId } = buildObjects(plot.objects);
  world.scene.add(root);
  world.grass.rebuild(plot.objects);
  setupEditor(world, plot, byId, draft !== null);
} catch (err) {
  // Битая копия в браузере (например, загруженный JSON) не должна навсегда ломать страницу
  if (draft) {
    clearDraft();
    location.reload();
  }
  throw err;
}

// Свои сохранения совпадают с plot и страницу не трогают; ручная правка файла перезагружает её
import.meta.hot?.accept('../data/plot.json', (mod) => {
  if (mod && JSON.stringify(mod.default) !== JSON.stringify(plot)) location.reload();
});

const timeControls = setupTimeControls(plot.location, plot.utcOffsetHours, (date, hour) => {
  const sun = sunState(toInstant(date, hour, plot.utcOffsetHours), plot.location.lat, plot.location.lon, plot.northAngleDeg);
  world.applySun(sun);
  timeControls.show(sun);
});
timeControls.emit();

world.renderer.setAnimationLoop(() => {
  world.controls.update();
  world.renderer.render(world.scene, world.camera);
});
