import { VectorMap25D } from './vector-map25d.js';

const mapHost = document.getElementById('map25dHost');
const status = document.getElementById('map25dStatus');
const detail = document.getElementById('map25dDetail');
const zoomIn = document.getElementById('map25dZoomIn');
const zoomOut = document.getElementById('map25dZoomOut');
const reset = document.getElementById('map25dReset');

const map = new VectorMap25D(mapHost, {
  initialZoom: 1,
  minimumZoom: 1,
  maximumZoom: 12,
  labelFontSize: 12
});

const dataUrl = '../../factory-output/bible-map/bible-map25d.prototype.json';

fetch(dataUrl)
  .then((response) => {
    if (!response.ok) throw new Error(`Map data failed to load (${response.status}).`);
    return response.json();
  })
  .then((payload) => {
    map.setPlaces(payload.places);
    status.textContent = `${payload.places.length.toLocaleString()} vector places loaded`;
  })
  .catch((error) => {
    status.textContent = error.message;
    status.classList.add('is-error');
  });

mapHost.addEventListener('map25d:render', (event) => {
  const { zoom, visiblePlaces, visibleLabels } = event.detail;
  status.textContent = `Zoom ${zoom.toFixed(2)} · ${visiblePlaces} points · ${visibleLabels} labels`;
});

mapHost.addEventListener('map25d:select', (event) => {
  const place = event.detail.place;
  detail.innerHTML = `<strong>${place.name}</strong>
    <span>${place.type || 'Bible place'}</span>
    <span>${place.verse_reference_count || 0} verse references</span>
    <span>${place.candidate_count || 0} location candidate(s)</span>`;
});

zoomIn.addEventListener('click', () => map.setZoom(map.camera.zoom + 0.5));
zoomOut.addEventListener('click', () => map.setZoom(map.camera.zoom - 0.5));
reset.addEventListener('click', () => {
  map.fitToData();
  map.scheduleRender();
});
