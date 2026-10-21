// Инструментовка Canvas 2D для замеров (measure.mjs / loc.mjs):
// считает операции и кадры в window.__cvstats, не меняя поведение рендера.
(() => {
  const TARGETS = [
    'fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'drawImage', 'beginPath', 'closePath',
    'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'arcTo', 'ellipse', 'rect',
    'clip', 'save', 'restore', 'translate', 'rotate', 'scale', 'setTransform',
    'createLinearGradient', 'createRadialGradient', 'createPattern', 'fillText', 'strokeText', 'fillPath', 'strokePath',
  ];
  const stats = (window.__cvstats = {
    ops: Object.fromEntries(TARGETS.map((k) => [k, 0])),
    frames: 0,
    winStart: performance.now(),
    canvases: [],
    longTasks: 0,
    longTaskMs: 0,
  });

  const proto = CanvasRenderingContext2D.prototype;
  for (const name of TARGETS) {
    const original = proto[name];
    if (typeof original !== 'function') continue;
    proto[name] = function (...args) {
      stats.ops[name]++;
      return original.apply(this, args);
    };
  }

  // Инвентаризация канвасов: размеры и площадь в пикселях.
  const makeCanvas = document.createElement.bind(document);
  document.createElement = function (tag, ...rest) {
    const el = makeCanvas(tag, ...rest);
    if (String(tag).toLowerCase() === 'canvas') {
      stats.canvases.push(el);
    }
    return el;
  };

  // Кадры: rAF-цикл игры.
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      stats.frames++;
      return cb(t);
    });

  if (window.PerformanceObserver) {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          stats.longTasks++;
          stats.longTaskMs += entry.duration;
        }
      }).observe({ entryTypes: ['longtask'] });
    } catch {
      /* longtask не поддерживается */
    }
  }
})();
