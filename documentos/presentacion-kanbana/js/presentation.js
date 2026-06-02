/* ══════════════════════════════════════════════════════════════════
   Kanbana — Presentación formal (estilo SENA)
   Navegación de slides, teclado, dots, progreso, swipe.
   Mismo sistema que el pitch de Kanbana.
══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SLIDES = [
    's-intro','s-abstract','s-contexto','s-problema','s-objetivos',
    's-justificacion','s-innovacion','s-metodologia','s-arquitectura',
    's-requerimientos','s-uml','s-bd','s-producto','s-alcance',
    's-conclusion','s-cierre'
  ];
  const SLIDE_LABELS = [
    'Inicio','Abstract','Contexto','Problema','Objetivos',
    'Justificación','Innovación','Metodología','Arquitectura',
    'Requerimientos','Modelado','Base de datos','Producto','Alcance',
    'Conclusión','Cierre'
  ];

  let current = 0;
  let transitioning = false;
  let introTimer = null;

  const progressBar = document.getElementById('progress-bar');
  const counter     = document.getElementById('counter');
  const dotsWrap    = document.getElementById('nav-dots');
  const btnPrev     = document.getElementById('btn-prev');
  const btnNext     = document.getElementById('btn-next');

  // Dots
  SLIDES.forEach((id, i) => {
    const d = document.createElement('div');
    d.className = 'dot' + (i === 0 ? ' active' : '');
    d.title = SLIDE_LABELS[i];
    d.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(d);
  });

  function goTo(idx) {
    if (transitioning || idx === current) return;
    if (idx < 0 || idx >= SLIDES.length) return;
    clearTimeout(introTimer);
    transitioning = true;

    const from = document.getElementById(SLIDES[current]);
    const to   = document.getElementById(SLIDES[idx]);

    from.classList.remove('active');
    from.classList.add('exit-left');

    setTimeout(() => {
      from.classList.remove('exit-left');
      to.classList.add('active');
      current = idx;
      update();
      setTimeout(() => { transitioning = false; }, 720);
    }, 280);
  }
  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function update() {
    document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === current));
    if (counter) counter.textContent = `${String(current + 1).padStart(2,'0')} / ${SLIDES.length}`;
    if (progressBar) progressBar.style.width = ((current) / (SLIDES.length - 1)) * 100 + '%';
    const isIntro = current === 0;
    dotsWrap.style.opacity = isIntro ? '0' : '1';
    if (btnPrev) btnPrev.style.opacity = isIntro ? '0' : '1';
    if (btnNext) btnNext.style.opacity = isIntro ? '0' : '1';
  }

  function startIntroTimer() { introTimer = setTimeout(() => goTo(1), 4200); }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); prev(); }
    if (e.key === 'Home') goTo(0);
    if (e.key === 'End')  goTo(SLIDES.length - 1);
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= Math.min(9, SLIDES.length)) goTo(n - 1);
  });

  if (btnPrev) btnPrev.addEventListener('click', prev);
  if (btnNext) btnNext.addEventListener('click', next);

  let tStartX = 0;
  document.addEventListener('touchstart', (e) => { tStartX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - tStartX;
    if (Math.abs(dx) > 60) { dx < 0 ? next() : prev(); }
  });

  const first = document.getElementById(SLIDES[0]);
  if (first) first.classList.add('active');
  update();
  startIntroTimer();
})();
