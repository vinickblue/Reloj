/**
 * RELOJ DIGITAL PWA — app.js
 * Lógica del reloj, cambio de color, localStorage y partículas
 */

'use strict';

/* ============================================================
   CONSTANTES Y REFERENCIAS AL DOM
   ============================================================ */

const STORAGE_KEY_COLOR  = 'reloj_bg_color';
const STORAGE_KEY_FORMAT = 'reloj_format_24h';
const DEFAULT_BG         = '#0a0a0a';

const $ = id => document.getElementById(id);

const elTime         = $('time');
const elHoursMinutes = $('hoursMinutes');
const elSeconds      = $('seconds');
const elPeriod       = $('period');
const elDate         = $('date');
const elProgressFill = $('progressFill');
const elColorBtn     = $('colorBtn');
const elColorPicker  = $('colorPicker');
const elColorDot     = $('colorDot');
const elColorRing    = $('colorRing');
const elFormatToggle = $('formatToggle');
const elFormatLabel  = $('formatLabel');
const elThemeMeta    = $('themeColorMeta');
const elCanvas       = $('particleCanvas');

/* ============================================================
   ESTADO DE LA APLICACIÓN
   ============================================================ */

const state = {
  use24h:       loadBool(STORAGE_KEY_FORMAT, true),
  bgColor:      localStorage.getItem(STORAGE_KEY_COLOR) || DEFAULT_BG,
  prevSeconds:  -1,
  prevMinutes:  -1,
  animFrame:    null,
};

/* ============================================================
   HELPERS
   ============================================================ */

/** Carga un boolean desde localStorage con valor por defecto */
function loadBool(key, defaultVal) {
  const stored = localStorage.getItem(key);
  if (stored === null) return defaultVal;
  return stored === 'true';
}

/** Pad a number to 2 digits */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Calcula si el color de texto debe ser oscuro o claro según el fondo */
function getContrastText(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Luminosidad relativa (fórmula W3C)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? 'dark' : 'light';
}

/** Aplica variables CSS de texto según contraste del fondo */
function applyContrastVars(hex) {
  const mode = getContrastText(hex);
  const root = document.documentElement;

  if (mode === 'dark') {
    root.style.setProperty('--text-primary',    'rgba(0, 0, 0, 0.88)');
    root.style.setProperty('--text-secondary',  'rgba(0, 0, 0, 0.36)');
    root.style.setProperty('--text-accent',     'rgba(0, 0, 0, 0.56)');
    root.style.setProperty('--glow-color',      'rgba(0, 0, 0, 0.06)');
    root.style.setProperty('--progress-bg',     'rgba(0, 0, 0, 0.12)');
    root.style.setProperty('--progress-fill',   'rgba(0, 0, 0, 0.50)');
    root.style.setProperty('--btn-bg',          'rgba(0, 0, 0, 0.08)');
    root.style.setProperty('--btn-hover',       'rgba(0, 0, 0, 0.14)');
  } else {
    root.style.setProperty('--text-primary',    'rgba(255, 255, 255, 0.92)');
    root.style.setProperty('--text-secondary',  'rgba(255, 255, 255, 0.38)');
    root.style.setProperty('--text-accent',     'rgba(255, 255, 255, 0.60)');
    root.style.setProperty('--glow-color',      'rgba(255, 255, 255, 0.08)');
    root.style.setProperty('--progress-bg',     'rgba(255, 255, 255, 0.10)');
    root.style.setProperty('--progress-fill',   'rgba(255, 255, 255, 0.55)');
    root.style.setProperty('--btn-bg',          'rgba(255, 255, 255, 0.08)');
    root.style.setProperty('--btn-hover',       'rgba(255, 255, 255, 0.16)');
  }
}

/* ============================================================
   COLOR DE FONDO
   ============================================================ */

/**
 * Aplica el color de fondo al body, actualiza el meta theme-color,
 * sincroniza el dot del botón y ajusta el texto por contraste.
 */
function applyBgColor(hex) {
  document.body.style.backgroundColor = hex;
  elColorDot.style.backgroundColor    = hex;
  elColorPicker.value                 = hex;

  // Actualiza meta theme-color para barra del navegador / instalada
  if (elThemeMeta) elThemeMeta.setAttribute('content', hex);

  // Ajusta variables CSS según contraste
  applyContrastVars(hex);

  // Persiste en localStorage
  localStorage.setItem(STORAGE_KEY_COLOR, hex);
  state.bgColor = hex;
}

/* ============================================================
   RELOJ — ACTUALIZACIÓN CADA SEGUNDO
   ============================================================ */

const DAYS_ES   = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Dispara la animación de tick sobre un elemento */
function triggerTick(el) {
  el.classList.remove('tick');
  // Forzar reflow para reiniciar la animación
  void el.offsetWidth;
  el.classList.add('tick');
}

/** Actualiza el DOM con la hora actual */
function updateClock() {
  const now     = new Date();
  const rawH    = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // --- Segundos ---
  const secStr = pad2(seconds);
  if (seconds !== state.prevSeconds) {
    elSeconds.textContent = secStr;
    triggerTick(elSeconds);

    // Barra de progreso (0–59 → 0%–100%)
    elProgressFill.style.width = `${(seconds / 59) * 100}%`;

    state.prevSeconds = seconds;
  }

  // --- Horas y Minutos ---
  if (minutes !== state.prevMinutes || seconds === 0) {
    let displayHour;
    let periodStr = '';

    if (state.use24h) {
      displayHour = pad2(rawH);
      elPeriod.style.opacity = '0';
    } else {
      const h12 = rawH % 12 || 12;
      displayHour = pad2(h12);
      periodStr   = rawH < 12 ? 'AM' : 'PM';
      elPeriod.textContent   = periodStr;
      elPeriod.style.opacity = '1';
    }

    const hmStr = `${displayHour}:${pad2(minutes)}`;
    if (elHoursMinutes.textContent !== hmStr) {
      elHoursMinutes.textContent = hmStr;
      triggerTick(elHoursMinutes);
    }

    // Actualiza atributo datetime para accesibilidad
    const iso = now.toTimeString().slice(0, 8);
    elTime.setAttribute('datetime', iso);

    state.prevMinutes = minutes;
  }

  // --- Fecha (se actualiza al cambiar el día, pero verificamos cada segundo) ---
  const dateStr = `${DAYS_ES[now.getDay()]}, ${now.getDate()} de ${MONTHS_ES[now.getMonth()]}`;
  if (elDate.textContent !== dateStr) {
    elDate.textContent = dateStr;
  }
}

/* ============================================================
   BUCLE PRINCIPAL — requestAnimationFrame sincronizado al segundo
   ============================================================ */

let lastSecond = -1;

function clockLoop(timestamp) {
  const now = new Date();
  const sec = now.getSeconds();

  if (sec !== lastSecond) {
    updateClock();
    lastSecond = sec;
  }

  state.animFrame = requestAnimationFrame(clockLoop);
}

/* ============================================================
   PARTÍCULAS DE FONDO (canvas)
   ============================================================ */

const ctx    = elCanvas.getContext('2d');
const DOTS   = 55;
const dots   = [];

function initCanvas() {
  elCanvas.width  = window.innerWidth;
  elCanvas.height = window.innerHeight;
}

function createDots() {
  dots.length = 0;
  for (let i = 0; i < DOTS; i++) {
    dots.push({
      x:   Math.random() * elCanvas.width,
      y:   Math.random() * elCanvas.height,
      r:   Math.random() * 1.2 + 0.3,
      vx:  (Math.random() - 0.5) * 0.25,
      vy:  (Math.random() - 0.5) * 0.25,
      a:   Math.random() * 0.5 + 0.1,
    });
  }
}

function drawDots() {
  ctx.clearRect(0, 0, elCanvas.width, elCanvas.height);
  const mode = getContrastText(state.bgColor);
  const fill = mode === 'dark' ? '0,0,0' : '255,255,255';

  dots.forEach(d => {
    d.x += d.vx;
    d.y += d.vy;

    // Rebote en bordes
    if (d.x < 0 || d.x > elCanvas.width)  d.vx *= -1;
    if (d.y < 0 || d.y > elCanvas.height) d.vy *= -1;

    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${fill}, ${d.a})`;
    ctx.fill();
  });

  requestAnimationFrame(drawDots);
}

function handleResize() {
  initCanvas();
  createDots();
}

/* ============================================================
   FORMATO 12h / 24h
   ============================================================ */

function toggleFormat() {
  state.use24h = !state.use24h;
  localStorage.setItem(STORAGE_KEY_FORMAT, state.use24h);
  elFormatLabel.textContent = state.use24h ? '24H' : '12H';

  // Forzar re-render
  state.prevMinutes = -1;
  updateClock();
}

/* ============================================================
   EVENTOS
   ============================================================ */

/** Click en el botón de color → abre el input nativo */
elColorBtn.addEventListener('click', () => {
  elColorPicker.click();
});

/** Mientras arrastra el color → actualiza en tiempo real */
elColorPicker.addEventListener('input', e => {
  applyBgColor(e.target.value);
});

/** Al soltar el color → asegura que quede guardado */
elColorPicker.addEventListener('change', e => {
  applyBgColor(e.target.value);
});

/** Cambio de formato 12h / 24h */
elFormatToggle.addEventListener('click', toggleFormat);

/** Redimensionar ventana → ajustar canvas */
window.addEventListener('resize', handleResize, { passive: true });

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */

function init() {
  // 1. Aplicar color guardado (con transición ya activa en CSS)
  applyBgColor(state.bgColor);

  // 2. Etiqueta del formato
  elFormatLabel.textContent = state.use24h ? '24H' : '12H';

  // 3. Primera llamada al reloj (sin esperar el primer segundo)
  updateClock();

  // 4. Arrancar el bucle con rAF
  state.animFrame = requestAnimationFrame(clockLoop);

  // 5. Canvas de partículas
  initCanvas();
  createDots();
  drawDots();
}

// Arrancar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
