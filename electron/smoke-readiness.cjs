// Written with AI assistance (Codex). Serialized into the renderer by smoke.cjs.
function previewReady(document, location) {
  return location.hash === '#preview' && !document.querySelector('.raw-app') &&
    !!document.querySelector('.preview .preview-canvas canvas') &&
    /Terrain: 4 m grid, heights/.test(document.querySelector('.preview-badge')?.textContent ?? '');
}
module.exports = { previewReady };
