// The route map: the city at night from build-time OpenStreetMap vectors, the day's stops strung on a garland of
// lights. Map units come from tools/build_maps.py (Web Mercator, 1000 wide); a camera maps them to screen pixels.
import { project } from '../core/geo.js';
import { prefersReducedMotion } from '../lib/motion.js';
import { tweenCamera } from './camera.js';
import { startChase } from './chase.js';
import { drawCity, loadMapData, markPinned } from './base-map.js';
import {
  clampCamera, fitCamera, garlandPath, isSameCamera, layoutPins, overviewCamera, panBy, scaleLimits, toScreen, withoutOutliers,
  zoomAt,
} from './geometry.js';
import { detailLevel } from './detail.js';
import { enableMapInteraction } from './interaction.js';
import { controlsBox, mountFrame } from './layers.js';
import { pinButton, pinItems, routePins } from './pins.js';

const fix = (n) => n.toFixed(1);

export function createRouteMap(root, { onPick }) {
  const frame = mountFrame(root);
  const state = {
    city: null, data: null, projection: null, landmarks: [], stopDots: [], mode: root.dataset.mode || 'day', view: null,
    pins: [], route: [], pinBoxes: [], controlsBox: null, camera: null, moving: false, width: 0, height: 0, token: 0,
    stopTween: () => {},
  };
  const size = () => ({ width: state.width, height: state.height });
  const pinScreen = (pin, camera = state.camera) => {
    const q = toScreen(pin.point, camera, size());
    return { x: q.x + pin.dx, y: q.y + pin.dy };
  };

  function targetCamera() {
    const today = state.pins.filter((pin) => pin.today).map((pin) => pin.point);
    const all = state.pins.map((pin) => pin.point);
    const points = state.mode === 'day' && today.length ? today : withoutOutliers(all);
    return points.length
      ? fitCamera(points, { ...size(), mode: state.mode, projection: state.projection })
      : overviewCamera(size(), state.data?.height);
  }

  function arrangePins(camera) {
    const points = state.pins.map((pin) => toScreen(pin.point, camera, size()));
    const layout = layoutPins(points, state.pins.map((pin) => pin.labelW), {
      width: state.width, fan: state.mode === 'day', labels: state.mode !== 'city',
    });
    state.pins = state.pins.map((pin, i) => ({ ...pin, ...layout.offsets[i], side: layout.sides[i] }));
    state.route = routePins(state.pins, state.city);
    state.pinBoxes = state.controlsBox ? [...layout.boxes, state.controlsBox] : layout.boxes; // names keep off both
    state.pins.forEach((pin) => {
      pin.el.classList.toggle('pin--left', pin.side === 'left');
      pin.el.dataset.label = pin.side ? 'on' : 'off';
    });
  }

  // The level of detail decides which dots show (CSS reads data-detail) and which names may try for a place.
  function drawLabels() {
    const level = detailLevel(state.camera, state.projection);
    if (root.dataset.detail !== String(level)) root.dataset.detail = String(level);
    frame.labels.draw({ camera: state.camera, size: size(), pins: state.pinBoxes, level, quiet: state.moving });
  }

  function draw() {
    const { x, y, s } = state.camera;
    frame.cameraGroup.setAttribute('transform', `matrix(${s} 0 0 ${s} ${(state.width / 2 - x * s).toFixed(2)} ${(state.height / 2 - y * s).toFixed(2)})`);
    let leaderPath = '';
    let anchorPath = '';
    state.pins.forEach((pin) => {
      const q = pinScreen(pin);
      pin.el.style.setProperty('--x', `${fix(q.x)}px`);
      pin.el.style.setProperty('--y', `${fix(q.y)}px`);
      if (pin.dx || pin.dy) {
        const at = toScreen(pin.point, state.camera, size());
        leaderPath += `M${fix(at.x)} ${fix(at.y)}L${fix(q.x)} ${fix(q.y)}`;
        anchorPath += `M${fix(at.x)} ${fix(at.y)}h0`;
      }
    });
    frame.leaders.setAttribute('d', leaderPath);
    frame.anchors.setAttribute('d', anchorPath);
    const d = garlandPath(state.route.map((pin) => pinScreen(pin)));
    [frame.wire, frame.bulbs, frame.lights].forEach((path) => path.setAttribute('d', d));
    drawLabels();
  }

  function moveTo(target, animate) {
    state.stopTween();
    const from = state.camera;
    if (!animate || !from || isSameCamera(from, target) || prefersReducedMotion()) {
      Object.assign(state, { camera: target, moving: false });
      draw();
      return;
    }
    // While it glides, the pins' boxes are the destination's: place and metro names wait for the last frame.
    state.stopTween = tweenCamera(from, target, (camera) => {
      Object.assign(state, { camera, moving: !isSameCamera(camera, target) });
      draw();
    });
  }

  function measure() {
    state.width = root.clientWidth;
    state.height = root.clientHeight;
    frame.overlay.setAttribute('viewBox', `0 0 ${state.width} ${state.height}`);
    state.controlsBox = controlsBox(frame, root); // no name goes under the zoom buttons
  }

  function buildPins() {
    const items = pinItems(state.view, state.mode, state.city);
    state.pins = items.map((item) => {
      const el = pinButton(item);
      el.addEventListener('click', () => onPick(item.today ? { place: item.id } : { place: item.id, day: item.day }));
      return { ...item, point: project(item.lat, item.lon, state.projection), el, dx: 0, dy: 0 };
    });
    // A rebuilt pin keeps the keyboard focus its predecessor had.
    const focused = frame.pinLayer.contains(document.activeElement) ? document.activeElement.dataset.place : null;
    frame.pinLayer.replaceChildren(...state.pins.map((pin) => pin.el));
    state.pins.find((pin) => pin.id === focused)?.el.focus({ preventScroll: true });
    state.pins = state.pins.map((pin) => ({ ...pin, labelW: pin.el.querySelector('.pin-label').offsetWidth }));
    markPinned(frame, state, { today: new Set(state.view.stops.map((s) => s.id)), pinned: new Set(state.pins.map((p) => p.id)) });
    const onMap = state.pins.filter((pin) => pin.today).length;
    root.setAttribute('aria-label', `${state.mode === 'city' ? 'Şehir haritası' : 'Günün rotası haritası'}: ${onMap} durak`);
  }

  // Every call takes a new token, so a slower load for another city can never land after a newer view.
  async function setCity(city, points) {
    const token = ++state.token;
    if (state.city === city) return true;
    const data = await loadMapData(city);
    if (token !== state.token) return false;
    Object.assign(state, { city, data, camera: null }, drawCity(frame, data, points));
    return true;
  }

  function relayout(animate) {
    if (!state.view || !state.projection) return;
    measure();
    if (!state.width || !state.height) return;
    buildPins();
    const target = targetCamera();
    arrangePins(target);
    moveTo(target, animate);
  }

  // By hand: every drag or zoom lays the pins out again for the new framing; buttons and recentring glide there.
  const bounded = (camera) => (state.data ? clampCamera(camera, state.data.height) : camera);
  function lookAt(camera, animate = false) {
    const target = bounded(camera);
    arrangePins(target);
    moveTo(target, animate);
  }
  enableMapInteraction({ root, controls: frame.controls }, {
    begin: () => {
      state.stopTween();
      if (state.moving) lookAt(state.camera); // a glide cut short settles where it is, names and all
    },
    pan: (dx, dy) => state.camera && lookAt(panBy(state.camera, dx, dy)),
    zoom: (factor, at, { animate = false } = {}) => state.camera
      && lookAt(zoomAt(state.camera, factor, at, size(), scaleLimits(size(), state.projection, state.data?.height)), animate),
    recenter: () => state.camera && lookAt(targetCamera(), true),
  });

  // With less than a fifth of the map in view (or the tab hidden), the chaser holds still.
  new IntersectionObserver(([entry]) => root.toggleAttribute('data-offscreen', entry.intersectionRatio < 0.2), {
    threshold: [0, 0.2],
  }).observe(root);
  startChase(frame.lights, { paused: () => document.hidden || root.hasAttribute('data-offscreen') || prefersReducedMotion() });

  // The first show can land while the section is still hidden (0×0); the first real size then does the layout.
  new ResizeObserver(() => {
    if (!state.view || !state.projection) return;
    if (!state.camera) {
      relayout(false);
      return;
    }
    measure();
    const target = targetCamera();
    arrangePins(target);
    moveTo(target, false);
  }).observe(root);

  return {
    // view: { city, stops (dayStops), places (the city's places with their first day) }
    async show(view) {
      const sameCity = state.city === view.city;
      state.view = view;
      const points = view.places.filter((p) => p.lat != null && p.city === view.city);
      if (!(await setCity(view.city, points))) return;
      if (state.view !== view) return;
      relayout(sameCity);
    },
    setMode(mode) {
      state.mode = mode;
      root.dataset.mode = mode;
      relayout(true);
    },
  };
}
