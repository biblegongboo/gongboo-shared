const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function mercator(longitude, latitude) {
  const safeLatitude = clamp(Number(latitude), -85, 85);
  const x = (Number(longitude) + 180) / 360;
  const sine = Math.sin((safeLatitude * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI);
  return { x, y };
}

function labelBox(x, y, width, height, offsetX, offsetY) {
  return {
    left: x + offsetX,
    right: x + offsetX + width,
    top: y + offsetY - height,
    bottom: y + offsetY
  };
}

function boxesOverlap(left, right, padding = 3) {
  return (
    left.left < right.right + padding &&
    left.right > right.left - padding &&
    left.top < right.bottom + padding &&
    left.bottom > right.top - padding
  );
}

export class VectorMap25D {
  constructor(host, options = {}) {
    if (!host) throw new Error('VectorMap25D requires a host element.');
    this.host = host;
    this.options = {
      minimumZoom: 1,
      maximumZoom: 12,
      initialZoom: 1,
      labelFontSize: 12,
      pointRadius: 3,
      ...options
    };
    this.camera = { centerX: 0.5, centerY: 0.5, zoom: this.options.initialZoom };
    this.places = [];
    this.projectedPlaces = [];
    this.roads = [];
    this.geography = [];
    this.selectedId = null;
    this.drag = null;
    this.frame = null;
    this.resizeObserver = new ResizeObserver(() => this.scheduleRender());
    this.createScene();
    this.bindInteraction();
    this.resizeObserver.observe(this.host);
  }

  createScene() {
    this.host.classList.add('vector-map25d');
    this.svg = svgElement('svg', {
      role: 'img',
      'aria-label': 'Interactive vector Bible map',
      tabindex: '0'
    });
    this.backgroundLayer = svgElement('g', { class: 'map25d-background' });
    this.regionLayer = svgElement('g', { class: 'map25d-regions' });
    this.waterLayer = svgElement('g', { class: 'map25d-waters' });
    this.roadLayer = svgElement('g', { class: 'map25d-roads' });
    this.pointLayer = svgElement('g', { class: 'map25d-points' });
    this.labelLayer = svgElement('g', { class: 'map25d-labels' });
    this.svg.append(
      this.backgroundLayer,
      this.regionLayer,
      this.waterLayer,
      this.roadLayer,
      this.pointLayer,
      this.labelLayer
    );
    this.host.replaceChildren(this.svg);
  }

  setPlaces(places) {
    this.places = Array.isArray(places) ? places.slice() : [];
    this.projectedPlaces = this.places
      .map((place) => ({ ...place, projected: mercator(place.longitude, place.latitude) }))
      .filter(
        (place) =>
          Number.isFinite(place.projected.x) && Number.isFinite(place.projected.y)
      );
    this.fitToData();
    this.scheduleRender();
  }

  setRoads(roads) {
    this.roads = (Array.isArray(roads) ? roads : []).map((road) => ({
      ...road,
      projectedLines: (road.lines || []).map((line) =>
        line.map((point) => mercator(point[0], point[1]))
      )
    }));
    this.scheduleRender();
  }

  setGeography(features) {
    this.geography = (Array.isArray(features) ? features : []).map((feature) => ({
      ...feature,
      projectedLines: (feature.lines || []).map((line) =>
        line.map((point) => mercator(point[0], point[1]))
      ),
      projectedPolygons: (feature.polygons || []).map((ring) =>
        ring.map((point) => mercator(point[0], point[1]))
      )
    }));
    this.scheduleRender();
  }

  focusOnPlace(placeId, zoom = 7) {
    const place = this.projectedPlaces.find((item) => item.id === placeId);
    if (!place) return false;
    this.selectedId = place.id;
    this.camera.centerX = place.projected.x;
    this.camera.centerY = place.projected.y;
    this.camera.zoom = clamp(
      Number(zoom) || 7,
      this.options.minimumZoom,
      this.options.maximumZoom
    );
    this.scheduleRender();
    return true;
  }

  fitToData() {
    if (!this.projectedPlaces.length) return;
    const xs = this.projectedPlaces.map((place) => place.projected.x);
    const ys = this.projectedPlaces.map((place) => place.projected.y);
    const minimumX = Math.min(...xs);
    const maximumX = Math.max(...xs);
    const minimumY = Math.min(...ys);
    const maximumY = Math.max(...ys);
    this.camera.centerX = (minimumX + maximumX) / 2;
    this.camera.centerY = (minimumY + maximumY) / 2;
    const width = Math.max(0.00001, maximumX - minimumX);
    const height = Math.max(0.00001, maximumY - minimumY);
    const aspect = Math.max(0.25, this.host.clientWidth / Math.max(1, this.host.clientHeight));
    const extent = Math.max(width, height * aspect);
    this.camera.zoom = clamp(
      Math.log2(0.82 / extent),
      this.options.minimumZoom,
      this.options.maximumZoom
    );
  }

  worldToScreen(projected) {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    const scale = 256 * 2 ** this.camera.zoom;
    return {
      x: width / 2 + (projected.x - this.camera.centerX) * scale,
      y: height / 2 + (projected.y - this.camera.centerY) * scale
    };
  }

  screenToWorld(x, y) {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    const scale = 256 * 2 ** this.camera.zoom;
    return {
      x: this.camera.centerX + (x - width / 2) / scale,
      y: this.camera.centerY + (y - height / 2) / scale
    };
  }

  setZoom(nextZoom, anchorX = this.host.clientWidth / 2, anchorY = this.host.clientHeight / 2) {
    const before = this.screenToWorld(anchorX, anchorY);
    this.camera.zoom = clamp(
      nextZoom,
      this.options.minimumZoom,
      this.options.maximumZoom
    );
    const after = this.screenToWorld(anchorX, anchorY);
    this.camera.centerX += before.x - after.x;
    this.camera.centerY += before.y - after.y;
    this.scheduleRender();
  }

  bindInteraction() {
    this.svg.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const bounds = this.svg.getBoundingClientRect();
        const direction = event.deltaY > 0 ? -0.25 : 0.25;
        this.setZoom(
          this.camera.zoom + direction,
          event.clientX - bounds.left,
          event.clientY - bounds.top
        );
      },
      { passive: false }
    );
    this.svg.addEventListener('pointerdown', (event) => {
      this.drag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        centerX: this.camera.centerX,
        centerY: this.camera.centerY
      };
      this.svg.setPointerCapture(event.pointerId);
      this.svg.classList.add('is-dragging');
    });
    this.svg.addEventListener('pointermove', (event) => {
      if (!this.drag || this.drag.pointerId !== event.pointerId) return;
      const scale = 256 * 2 ** this.camera.zoom;
      this.camera.centerX = this.drag.centerX - (event.clientX - this.drag.x) / scale;
      this.camera.centerY = this.drag.centerY - (event.clientY - this.drag.y) / scale;
      this.scheduleRender();
    });
    const endDrag = (event) => {
      if (!this.drag || this.drag.pointerId !== event.pointerId) return;
      this.drag = null;
      this.svg.classList.remove('is-dragging');
    };
    this.svg.addEventListener('pointerup', endDrag);
    this.svg.addEventListener('pointercancel', endDrag);
    this.svg.addEventListener('dblclick', (event) => {
      const bounds = this.svg.getBoundingClientRect();
      this.setZoom(
        this.camera.zoom + 1,
        event.clientX - bounds.left,
        event.clientY - bounds.top
      );
    });
  }

  scheduleRender() {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.render();
    });
  }

  renderGrid(width, height) {
    this.backgroundLayer.replaceChildren();
    const background = svgElement('rect', {
      x: 0,
      y: 0,
      width,
      height,
      class: 'map25d-sea'
    });
    this.backgroundLayer.appendChild(background);
    const gridStep = clamp(120 * 2 ** (this.camera.zoom % 1), 90, 180);
    const lines = [];
    for (let x = (width / 2) % gridStep; x < width; x += gridStep) {
      lines.push(`M${x.toFixed(1)} 0V${height}`);
    }
    for (let y = (height / 2) % gridStep; y < height; y += gridStep) {
      lines.push(`M0 ${y.toFixed(1)}H${width}`);
    }
    this.backgroundLayer.appendChild(
      svgElement('path', { d: lines.join(''), class: 'map25d-grid' })
    );
  }

  renderRoads(width, height) {
    this.roadLayer.replaceChildren();
    if (this.camera.zoom < 4 || !this.roads.length) return;
    const certaintyOrder = { Certain: 0, Conjectured: 1, Hypothetical: 2 };
    const roads = this.roads.slice().sort((left, right) =>
      (certaintyOrder[left.certainty] ?? 3) - (certaintyOrder[right.certainty] ?? 3)
    );
    let visibleCount = 0;
    const maximumVisible = 1400;
    for (const road of roads) {
      if (visibleCount >= maximumVisible) break;
      for (const line of road.projectedLines) {
        const points = line.map((point) => this.worldToScreen(point));
        if (points.length < 2) continue;
        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        if (Math.max(...xs) < -20 || Math.min(...xs) > width + 20 ||
            Math.max(...ys) < -20 || Math.min(...ys) > height + 20) continue;
        const roadPath = svgElement('polyline', {
          points: points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '),
          class: `map25d-road is-${String(road.certainty || 'unknown').toLowerCase()}`,
          fill: 'none',
          'data-road-id': road.road_id
        });
        const title = svgElement('title');
        title.textContent = `${road.name || 'Ancient road'} · ${road.certainty || 'Unknown certainty'}`;
        roadPath.appendChild(title);
        this.roadLayer.appendChild(roadPath);
        visibleCount += 1;
        if (visibleCount >= maximumVisible) break;
      }
    }
    this.host.dataset.visibleRoads = String(visibleCount);
  }

  isVisibleShape(points, width, height) {
    if (!points.length) return false;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return !(
      Math.max(...xs) < -30 ||
      Math.min(...xs) > width + 30 ||
      Math.max(...ys) < -30 ||
      Math.min(...ys) > height + 30
    );
  }

  renderGeography(width, height) {
    this.regionLayer.replaceChildren();
    this.waterLayer.replaceChildren();
    let visibleCount = 0;
    const maximumVisible =
      this.camera.zoom < 3 ? 12 :
      this.camera.zoom < 5 ? 28 :
      this.camera.zoom < 7 ? 65 :
      this.camera.zoom < 9 ? 130 : 240;
    const candidates = this.geography
      .filter((feature) => this.camera.zoom >= Number(feature.min_zoom || 5))
      .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));
    for (const feature of candidates) {
      if (visibleCount >= maximumVisible) break;
      const target =
        feature.land_or_water === 'water' ? this.waterLayer : this.regionLayer;
      const shapeClass =
        feature.land_or_water === 'water'
          ? 'map25d-water-shape'
          : 'map25d-region-shape';
      for (const ring of feature.projectedPolygons) {
        const points = ring.map((point) => this.worldToScreen(point));
        if (!this.isVisibleShape(points, width, height)) continue;
        const polygon = svgElement('polygon', {
          points: points
            .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
            .join(' '),
          class: shapeClass,
          'data-geography-id': feature.id
        });
        const title = svgElement('title');
        title.textContent = `${feature.name} · ${feature.kind}`;
        polygon.appendChild(title);
        target.appendChild(polygon);
        visibleCount += 1;
        if (visibleCount >= maximumVisible) break;
      }
      if (visibleCount >= maximumVisible) break;
      for (const line of feature.projectedLines) {
        const points = line.map((point) => this.worldToScreen(point));
        if (!this.isVisibleShape(points, width, height)) continue;
        const polyline = svgElement('polyline', {
          points: points
            .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
            .join(' '),
          class:
            feature.land_or_water === 'water'
              ? 'map25d-water-path'
              : 'map25d-region-path',
          fill: 'none',
          'data-geography-id': feature.id
        });
        const title = svgElement('title');
        title.textContent = `${feature.name} · ${feature.kind}`;
        polyline.appendChild(title);
        target.appendChild(polyline);
        visibleCount += 1;
        if (visibleCount >= maximumVisible) break;
      }
    }
    this.host.dataset.visibleGeography = String(visibleCount);
  }

  render() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.renderGrid(width, height);
    this.renderGeography(width, height);
    this.renderRoads(width, height);
    this.pointLayer.replaceChildren();
    this.labelLayer.replaceChildren();

    const labelBoxes = [];
    const visible = this.projectedPlaces
      .map((place) => ({ ...place, screen: this.worldToScreen(place.projected) }))
      .filter(
        (place) =>
          place.screen.x >= -30 &&
          place.screen.x <= width + 30 &&
          place.screen.y >= -30 &&
          place.screen.y <= height + 30
      )
      .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));

    for (const place of visible) {
      const selected = place.id === this.selectedId;
      const point = svgElement('circle', {
        cx: place.screen.x,
        cy: place.screen.y,
        r: selected ? 6 : this.options.pointRadius,
        class: selected ? 'map25d-point is-selected' : 'map25d-point',
        tabindex: 0,
        'aria-label': `${place.name}, ${place.verse_reference_count || 0} references`
      });
      point.addEventListener('click', () => {
        this.selectedId = place.id;
        this.scheduleRender();
        this.host.dispatchEvent(
          new CustomEvent('map25d:select', { detail: { place }, bubbles: true })
        );
      });
      this.pointLayer.appendChild(point);

      const shouldLabel =
        selected || this.camera.zoom >= Number(place.min_zoom || 5);
      if (!shouldLabel) continue;
      const fontSize = selected
        ? this.options.labelFontSize + 2
        : this.options.labelFontSize;
      const widthEstimate = Math.max(28, String(place.name || '').length * fontSize * 0.57);
      const offsets = [
        [8, -7],
        [8, 18],
        [-widthEstimate - 8, -7],
        [-widthEstimate - 8, 18],
        [-widthEstimate / 2, -12]
      ];
      let placement = null;
      for (const [offsetX, offsetY] of offsets) {
        const box = labelBox(
          place.screen.x,
          place.screen.y,
          widthEstimate,
          fontSize + 4,
          offsetX,
          offsetY
        );
        if (selected || !labelBoxes.some((existing) => boxesOverlap(box, existing))) {
          placement = { box, offsetX, offsetY };
          break;
        }
      }
      if (!placement) continue;
      labelBoxes.push(placement.box);
      const text = svgElement('text', {
        x: place.screen.x + placement.offsetX,
        y: place.screen.y + placement.offsetY,
        class: selected ? 'map25d-label is-selected' : 'map25d-label',
        'font-size': fontSize
      });
      text.textContent = place.name;
      this.labelLayer.appendChild(text);
    }

    this.host.dataset.zoom = this.camera.zoom.toFixed(2);
    this.host.dispatchEvent(
      new CustomEvent('map25d:render', {
        detail: {
          zoom: this.camera.zoom,
          visiblePlaces: visible.length,
          visibleLabels: labelBoxes.length,
          visibleRoads: Number(this.host.dataset.visibleRoads || 0),
          visibleGeography: Number(this.host.dataset.visibleGeography || 0)
        }
      })
    );
  }

  destroy() {
    this.resizeObserver.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.host.replaceChildren();
  }
}
