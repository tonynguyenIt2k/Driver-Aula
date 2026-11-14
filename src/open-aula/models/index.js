import s75pro from './s75pro.js';
import f108pro from './f108pro.js';
import f87pro from './f87pro.js';
import f75 from './f75.js';
import sc620 from './sc620.js';
import { Aula04 } from '../protocols/aula04.js';
import { AA } from '../protocols/aa.js';
import { G5KB } from '../protocols/g5kb.js';
import { Mouse55 } from '../protocols/mouse55.js';
import { matchesId } from '../common.js';

export const MODELS = [s75pro, f108pro, f87pro, f75, sc620];
const PROTOCOLS = { aula04: Aula04, aa: AA, g5kb: G5KB, mouse55: Mouse55 };

export const modelById = (id) => MODELS.find((m) => m.id === id) ?? MODELS[0];

export const hidFilters = () => MODELS.flatMap((m) => m.usb.map(({ vendorId, productId }) => ({ vendorId, productId })));

export const modelForDevice = (dev, preferredId) => {
  const matching = MODELS.filter((m) => matchesId(dev, m.usb));
  if (!matching.length) return undefined;
  const pname = String(dev?.productName || '').toLowerCase();
  if (pname.includes('f108') || pname.includes('108')) {
    return matching.find((m) => m.id === 'f108pro') ?? matching[0];
  }
  if (pname.includes('s75')) {
    return matching.find((m) => m.id === 's75pro') ?? matching[0];
  }
  if (preferredId) {
    const preferred = matching.find((m) => m.id === preferredId);
    if (preferred) return preferred;
  }
  return matching[0];
};

export async function attachModel(model, devices, opts) {
  const mine = devices.filter((d) => matchesId(d, model.usb));
  if (!mine.length) return null;
  const Proto = PROTOCOLS[model.protocol];
  const handles = await Proto.discover(mine, model);
  return handles ? new Proto(handles, model, opts) : null;
}

export async function attach(devices, opts) {
  for (const model of MODELS) {
    const mine = devices.filter((d) => matchesId(d, model.usb));
    if (!mine.length) continue;
    const Proto = PROTOCOLS[model.protocol];
    const handles = await Proto.discover(mine, model);
    if (handles) return new Proto(handles, model, opts);
  }
  return null;
}

export const simulator = (model, opts) => new PROTOCOLS[model.protocol]({}, model, opts);
