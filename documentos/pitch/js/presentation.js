/* ══════════════════════════════════════════════════════════════════
   Kanbana Pitch — presentation.js
   Handles slide navigation, keyboard, dots, progress
══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const SLIDES = ['s-intro','s-dolor','s-quees','s-cura','s-producto','s-alcance','s-stack','s-roi','s-cierre'];
  const SLIDE_LABELS = ['Inicio','El Dolor','¿Qué es Kanbana?','La Cura','Producto','Alcance','Stack','ROI','Cierre'];
  let current = 0;
  let transitioning = false;
  let introTimer = null;

  // ── Elements ───────────────────────────────────────────────────
  const progressBar = document.getElementById('progress-bar');
  const counter     = document.getElementById('counter');
  const dotsWrap    = document.getElementById('nav-dots');
  const btnPrev     = document.getElementById('btn-prev');
  const btnNext     = document.getElementById('btn-next');

  // ── Build nav dots ─────────────────────────────────────────────
  SLIDES.forEach((id, i) => {
    const d = document.createElement('div');
    d.className = 'dot' + (i === 0 ? ' active' : '');
    d.title = SLIDE_LABELS[i];
    d.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(d);
  });

  // ── Go to slide ────────────────────────────────────────────────
  function goTo(idx, dir) {
    if (transitioning || idx === current) return;
    if (idx < 0 || idx >= SLIDES.length) return;
    clearTimeout(introTimer);
    transitioning = true;

    const from = document.getElementById(SLIDES[current]);
    const to   = document.getElementById(SLIDES[idx]);

    // Remove active, add exit
    from.classList.remove('active');
    from.classList.add('exit-left');

    // Small delay then show next
    setTimeout(() => {
      from.classList.remove('exit-left');
      to.classList.add('active');
      current = idx;
      update();
      setTimeout(() => { transitioning = false; }, 750);
    }, 300);
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  // ── Update UI ──────────────────────────────────────────────────
  function update() {
    // Dots
    document.querySelectorAll('.dot').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
    // Counter
    if (counter) counter.textContent = `${String(current + 1).padStart(2,'0')} / ${SLIDES.length}`;
    // Progress
    if (progressBar) {
      const pct = ((current) / (SLIDES.length - 1)) * 100;
      progressBar.style.width = pct + '%';
    }
    // Hide dots + arrows on intro
    const isIntro = current === 0;
    dotsWrap.style.opacity  = isIntro ? '0' : '1';
    if (btnPrev) btnPrev.style.opacity = isIntro ? '0' : '1';
    if (btnNext) btnNext.style.opacity = isIntro ? '0' : '1';
  }

  // ── Auto-advance on intro ──────────────────────────────────────
  function startIntroTimer() {
    introTimer = setTimeout(() => { goTo(1); }, 3800);
  }

  // ── Keyboard ───────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')  { e.preventDefault(); prev(); }
    if (e.key === 'Home') goTo(0);
    if (e.key === 'End')  goTo(SLIDES.length - 1);
    // Number keys 1-8
    const num = parseInt(e.key);
    if (num >= 1 && num <= SLIDES.length) goTo(num - 1);
  });

  // ── Buttons ────────────────────────────────────────────────────
  if (btnPrev) btnPrev.addEventListener('click', prev);
  if (btnNext) btnNext.addEventListener('click', next);

  // ── Touch swipe ────────────────────────────────────────────────
  let touchStartX = 0;
  document.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 60) { dx < 0 ? next() : prev(); }
  });

  // ── Initialize ─────────────────────────────────────────────────
  const firstSlide = document.getElementById(SLIDES[0]);
  if (firstSlide) firstSlide.classList.add('active');
  update();
  startIntroTimer();

})();
