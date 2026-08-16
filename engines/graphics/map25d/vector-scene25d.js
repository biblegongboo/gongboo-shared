const NS = 'http://www.w3.org/2000/svg';
const makeSvg = (name, attrs = {}) => {
  const el = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
  return el;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const collides = (a, b) => a.left < b.right + 3 && a.right > b.left - 3 && a.top < b.bottom + 3 && a.bottom > b.top - 3;

export function sceneFromGraphicObjects(graphic = {}) {
  const objects = Array.isArray(graphic.objects) ? graphic.objects : [];
  return {
    nodes: objects.filter((item) => item.type === 'point').map((item, index) => ({
      id: item.id || `node_${index}`, x: Number(item.coords?.[0]), y: Number(item.coords?.[1]),
      label: item.name || item.id || '', color: item.attributes?.fillColor || '#60a5fa',
      stroke: item.attributes?.strokeColor || '#1d4ed8', radius: Number(item.attributes?.size || 4),
      priority: index === 0 ? 100 : 50, metadata: item
    })),
    edges: objects.filter((item) => item.type === 'segment').map((item, index) => ({
      id: item.id || `edge_${index}`, points: [item.from, item.to],
      color: item.attributes?.strokeColor || '#2563eb', width: Number(item.attributes?.strokeWidth || 2)
    })),
    texts: objects.filter((item) => item.type === 'text').map((item) => ({
      x: Number(item.position?.[0]), y: Number(item.position?.[1]),
      label: item.value || '', color: item.attributes?.color || '#64748b'
    }))
  };
}

export class VectorScene25D {
  constructor(host, options = {}) {
    if (!host) throw new Error('VectorScene25D requires a host element.');
    this.host = host;
    this.options = { minimumZoom: -1, maximumZoom: 10, labelFontSize: 12, invertY: true, ...options };
    this.scene = { nodes: [], edges: [], texts: [] };
    this.camera = { centerX: 0, centerY: 0, zoom: 0, baseScale: 1 };
    this.drag = null;
    this.frame = null;
    this.svg = makeSvg('svg', { role: 'img', tabindex: '0', 'aria-label': this.options.ariaLabel || 'Interactive Bible visualization' });
    this.gridLayer = makeSvg('g'); this.edgeLayer = makeSvg('g');
    this.nodeLayer = makeSvg('g'); this.labelLayer = makeSvg('g');
    this.svg.append(this.gridLayer, this.edgeLayer, this.nodeLayer, this.labelLayer);
    host.classList.add('vector-scene25d');
    host.replaceChildren(this.svg);
    this.bind();
    this.resizeObserver = new ResizeObserver(() => { this.fitToData(); this.schedule(); });
    this.resizeObserver.observe(host);
  }

  setScene(scene) {
    this.scene = {
      nodes: (scene?.nodes || []).filter((n) => Number.isFinite(n.x) && Number.isFinite(n.y)),
      edges: scene?.edges || [], texts: (scene?.texts || []).filter((t) => Number.isFinite(t.x) && Number.isFinite(t.y))
    };
    this.fitToData();
    this.schedule();
  }

  points() {
    return [...this.scene.nodes.map((n) => [n.x, n.y]), ...this.scene.texts.map((t) => [t.x, t.y]),
      ...this.scene.edges.flatMap((e) => e.points || [])]
      .filter((p) => Number.isFinite(Number(p?.[0])) && Number.isFinite(Number(p?.[1])));
  }

  fitToData() {
    const points = this.points();
    if (!points.length) return;
    const xs = points.map((p) => Number(p[0])), ys = points.map((p) => Number(p[1]));
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    this.camera.centerX = (minX + maxX) / 2;
    this.camera.centerY = (minY + maxY) / 2;
    this.camera.baseScale = Math.min(
      (Math.max(1, this.host.clientWidth || 800) * 0.84) / Math.max(0.001, maxX - minX),
      (Math.max(1, this.host.clientHeight || 420) * 0.76) / Math.max(0.001, maxY - minY)
    );
    this.camera.zoom = 0;
  }

  toScreen(point) {
    const scale = this.camera.baseScale * 2 ** this.camera.zoom;
    return {
      x: this.host.clientWidth / 2 + (Number(point[0]) - this.camera.centerX) * scale,
      y: this.host.clientHeight / 2 + (Number(point[1]) - this.camera.centerY) * scale * (this.options.invertY ? -1 : 1)
    };
  }

  toWorld(x, y) {
    const scale = this.camera.baseScale * 2 ** this.camera.zoom;
    return {
      x: this.camera.centerX + (x - this.host.clientWidth / 2) / scale,
      y: this.camera.centerY + (y - this.host.clientHeight / 2) / scale * (this.options.invertY ? -1 : 1)
    };
  }

  setZoom(zoom, x = this.host.clientWidth / 2, y = this.host.clientHeight / 2) {
    const before = this.toWorld(x, y);
    this.camera.zoom = clamp(zoom, this.options.minimumZoom, this.options.maximumZoom);
    const after = this.toWorld(x, y);
    this.camera.centerX += before.x - after.x;
    this.camera.centerY += before.y - after.y;
    this.schedule();
  }

  bind() {
    this.svg.addEventListener('wheel', (event) => {
      event.preventDefault();
      const box = this.svg.getBoundingClientRect();
      this.setZoom(this.camera.zoom + (event.deltaY > 0 ? -0.25 : 0.25), event.clientX - box.left, event.clientY - box.top);
    }, { passive: false });
    this.svg.addEventListener('dblclick', (event) => {
      const box = this.svg.getBoundingClientRect();
      this.setZoom(this.camera.zoom + 1, event.clientX - box.left, event.clientY - box.top);
    });
    this.svg.addEventListener('pointerdown', (event) => {
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, centerX: this.camera.centerX, centerY: this.camera.centerY };
      this.svg.setPointerCapture(event.pointerId);
      this.svg.classList.add('is-dragging');
    });
    this.svg.addEventListener('pointermove', (event) => {
      if (!this.drag || this.drag.id !== event.pointerId) return;
      const scale = this.camera.baseScale * 2 ** this.camera.zoom;
      this.camera.centerX = this.drag.centerX - (event.clientX - this.drag.x) / scale;
      this.camera.centerY = this.drag.centerY - (event.clientY - this.drag.y) / scale * (this.options.invertY ? -1 : 1);
      this.schedule();
    });
    const finish = (event) => {
      if (!this.drag || this.drag.id !== event.pointerId) return;
      this.drag = null; this.svg.classList.remove('is-dragging');
    };
    this.svg.addEventListener('pointerup', finish);
    this.svg.addEventListener('pointercancel', finish);
  }

  schedule() {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => { this.frame = null; this.render(); });
  }

  render() {
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight);
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const grid = [];
    for (let x = 0; x <= width; x += 80) grid.push(`M${x} 0V${height}`);
    for (let y = 0; y <= height; y += 80) grid.push(`M0 ${y}H${width}`);
    this.gridLayer.replaceChildren(makeSvg('rect', { x: 0, y: 0, width, height, class: 'scene25d-bg' }), makeSvg('path', { d: grid.join(''), class: 'scene25d-grid' }));
    this.edgeLayer.replaceChildren();
    for (const edge of this.scene.edges) {
      const points = (edge.points || []).map((point) => this.toScreen(point));
      if (points.length < 2) continue;
      this.edgeLayer.appendChild(makeSvg('polyline', {
        points: points.map((p) => `${p.x},${p.y}`).join(' '), fill: 'none',
        stroke: edge.color || '#2563eb', 'stroke-width': edge.width || 2,
        'vector-effect': 'non-scaling-stroke', class: 'scene25d-edge'
      }));
    }
    this.nodeLayer.replaceChildren(); this.labelLayer.replaceChildren();
    const boxes = [];
    for (const node of this.scene.nodes.slice().sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))) {
      const point = this.toScreen([node.x, node.y]);
      if (point.x < -40 || point.x > width + 40 || point.y < -40 || point.y > height + 40) continue;
      const circle = makeSvg('circle', { cx: point.x, cy: point.y, r: node.radius || 4, fill: node.color || '#60a5fa', stroke: node.stroke || '#1d4ed8', 'stroke-width': 1.5, class: 'scene25d-node' });
      circle.addEventListener('click', () => this.host.dispatchEvent(new CustomEvent('scene25d:select', { detail: { node }, bubbles: true })));
      this.nodeLayer.appendChild(circle);
      const font = this.options.labelFontSize, estimated = Math.max(24, String(node.label || '').length * font * 0.56);
      const candidates = [[8, -8], [8, 18], [-estimated - 8, -8], [-estimated - 8, 18]];
      let placement;
      for (const [dx, dy] of candidates) {
        const box = { left: point.x + dx, right: point.x + dx + estimated, top: point.y + dy - font, bottom: point.y + dy + 3 };
        if (!boxes.some((other) => collides(box, other))) { placement = { dx, dy, box }; break; }
      }
      if (!placement) continue;
      boxes.push(placement.box);
      const text = makeSvg('text', { x: point.x + placement.dx, y: point.y + placement.dy, 'font-size': font, class: 'scene25d-label' });
      text.textContent = node.label;
      this.labelLayer.appendChild(text);
    }
    for (const item of this.scene.texts) {
      const point = this.toScreen([item.x, item.y]);
      const text = makeSvg('text', { x: point.x, y: point.y, fill: item.color || '#64748b', 'font-size': this.options.labelFontSize - 1, class: 'scene25d-section-label' });
      text.textContent = item.label; this.labelLayer.appendChild(text);
    }
    this.host.dataset.zoom = this.camera.zoom.toFixed(2);
  }

  destroy() {
    this.resizeObserver.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.host.replaceChildren();
  }
}
