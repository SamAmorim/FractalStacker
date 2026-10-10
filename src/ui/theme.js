const THEME_STORAGE_KEY = "fractalstacker.theme";

const DEFAULT_THEME = "phosphor";

const CANVAS_FONT = "\"IBM Plex Mono\", \"JetBrains Mono\", \"Cascadia Mono\", Consolas, monospace";

const PALETTE_KEYS = ["canvas-bg", "line", "line-strong", "fg", "fg-dim", "fg-mute", "accent", "accent-2", "warn", "danger", "ok"];

export const palette = {};

let tintCache = {};

function readPalette() {
  const styles = window.getComputedStyle(document.documentElement);
  PALETTE_KEYS.forEach(function (key) {
    const camelKey = key.replace(/-([a-z0-9])/g, function (_, chr) {
      return chr.toUpperCase();
    });
    palette[camelKey] = styles.getPropertyValue("--" + key).trim() || "#33ff66";
  });
  tintCache = {};
}

export function tint(color, alpha) {
  const cacheKey = color + "|" + alpha;
  if (tintCache[cacheKey]) {
    return tintCache[cacheKey];
  }
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) {
    return color;
  }
  const num = parseInt(match[1], 16);
  const rgba = "rgba(" + ((num >> 16) & 255) + "," + ((num >> 8) & 255) + "," + (num & 255) + "," + alpha + ")";
  tintCache[cacheKey] = rgba;
  return rgba;
}

export function canvasFont(px) {
  return px + "px " + CANVAS_FONT;
}

function applyTheme(themeName) {
  const picker = document.querySelector("[data-theme-picker]");
  const valid = picker && Array.from(picker.options).some(function (option) {
    return option.value === themeName;
  });
  const theme = valid ? themeName : DEFAULT_THEME;
  document.documentElement.setAttribute("data-theme", theme);
  if (picker) {
    picker.value = theme;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    // storage indisponivel: tema vale so para esta sessao
  }
  readPalette();
}

export function bindThemePicker() {
  const picker = document.querySelector("[data-theme-picker]");
  applyTheme(document.documentElement.getAttribute("data-theme") || DEFAULT_THEME);
  if (picker) {
    picker.addEventListener("change", function (event) {
      applyTheme(event.target.value);
    });
  }
}
