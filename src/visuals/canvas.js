export function resizeCanvasIfNeeded(canvas, minWidth, minHeight, fallbackHeight) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const minW = typeof minWidth === "number" ? minWidth : 300;
  const minH = typeof minHeight === "number" ? minHeight : 140;
  const fallbackH = typeof fallbackHeight === "number" ? fallbackHeight : 230;
  const nextWidth = Math.max(minW, Math.floor(rect.width * dpr));
  const targetHeight = rect.height > 0 ? rect.height : fallbackH;
  const nextHeight = Math.max(minH, Math.floor(targetHeight * dpr));
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
}
