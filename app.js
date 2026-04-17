/* =====================================================
   DEBRIEF LANDING — app.js
   1. Starfield canvas background
   2. 3D tilt on mock window (mousemove)
   3. Mock window pipeline animation (looping)
   4. Scroll reveal
   5. Header scroll border
   6. Demo form → mailto
   ===================================================== */

/* ── 1. Starfield ─────────────────────────────────── */
(function initStarfield() {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];
  let raf;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    buildStars(180);
  }

  function buildStars(n) {
    stars = Array.from({ length: n }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      r:     0.3 + Math.random() * 1.1,
      base:  0.15 + Math.random() * 0.65,
      phase: Math.random() * Math.PI * 2,
      freq:  0.0004 + Math.random() * 0.0012,
      vx:    (Math.random() - 0.5) * 0.06,
    }));
  }

  function draw(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      const alpha = s.base + Math.sin(now * s.freq + s.phase) * 0.25;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 218, 255, ${Math.max(0, alpha)})`;
      ctx.fill();
      s.x += s.vx;
      if (s.x < 0) s.x = canvas.width;
      if (s.x > canvas.width) s.x = 0;
    }
    raf = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();
  raf = requestAnimationFrame(draw);
})();


/* ── 2. 3D mock-window tilt ───────────────────────── */
(function initTilt() {
  const scene = document.getElementById('heroScene');
  const wrap  = document.getElementById('mockWrap');
  if (!scene || !wrap) return;

  // Default resting transform
  const DEFAULT = 'rotateX(6deg) rotateY(-14deg)';

  scene.addEventListener('mousemove', (e) => {
    const r = scene.getBoundingClientRect();
    const nx =  (e.clientX - r.left  - r.width  / 2) / (r.width  / 2); // -1…1
    const ny =  (e.clientY - r.top   - r.height / 2) / (r.height / 2);
    const rx = (-ny * 9).toFixed(2);
    const ry = ( nx * 13 - 14).toFixed(2);
    wrap.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  });

  scene.addEventListener('mouseleave', () => {
    wrap.style.transform = DEFAULT;
  });
})();


/* ── 3. Pipeline animation ────────────────────────── */
(function initPipeline() {
  // Element IDs that represent each animation step in order
  const SEQUENCE = [
    // [id, delay_ms]
    ['sUpload', 280],
    // progress bar fills via animateProgress from 400ms
    ['sDiv1',  2500],
    ['sConv',  2620],
    ['sNorm',  2900],
    ['sDiv2',  3300],
    ['sAsr',   3450],   // spinning
    ['sTrans', 3800],
    ['t1',     3900],
    ['t2',     4250],
    ['t3',     4600],
    ['t4',     4950],
    // ASR done → 5300ms (handled separately below)
    ['sDiv3',  5400],
    ['sDiar',  5520],
    ['sDiv4',  5900],
    ['sLlm',   6050],   // spinning
    // LLM done → 6900ms
    ['sCards', 6900],
    ['sDiv5',  7600],
    ['sClips', 7720],
    ['sIdx',   8050],
    ['sDone',  8600],
  ];

  const ALL_IDS = [
    'sUpload','sDiv1','sConv','sNorm','sDiv2','sAsr','sTrans',
    't1','t2','t3','t4','sDiv3','sDiar','sDiv4','sLlm','sCards',
    'sDiv5','sClips','sIdx','sDone',
  ];

  const LOOP_MS = 13000; // total loop length
  let timers = [];

  function getEl(id) { return document.getElementById(id); }

  function show(id) {
    const el = getEl(id);
    if (!el) return;
    el.style.display = '';
    // scroll winBody to bottom so new rows are always visible
    const body = getEl('winBody');
    if (body) requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
  }

  function hideAll() {
    ALL_IDS.forEach(id => {
      const el = getEl(id);
      if (el) el.style.display = 'none';
    });
  }

  function animateProgress(durationMs, cb) {
    const fill  = getEl('progFill');
    const label = getEl('progPct');
    if (!fill || !label) { cb && cb(); return; }
    const start = performance.now();
    function step(now) {
      const t = Math.min((now - start) / durationMs, 1);
      // ease in-out
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const pct = Math.round(e * 100);
      fill.style.width = pct + '%';
      label.textContent = pct + '%';
      if (t < 1) requestAnimationFrame(step);
      else cb && cb();
    }
    requestAnimationFrame(step);
  }

  function resetSpinners() {
    const asrIcon  = getEl('asrIcon');
    const asrLabel = getEl('asrLabel');
    const llmIcon  = getEl('llmIcon');
    const llmLabel = getEl('llmLabel');
    const badge    = getEl('winBadge');
    const win      = getEl('mockWindow');

    if (asrIcon)  { asrIcon.className = 'ri ri-spin'; asrIcon.textContent  = '⟳'; }
    if (asrLabel) asrLabel.textContent = 'Whisper ASR · transcribing segments…';
    if (llmIcon)  { llmIcon.className = 'ri ri-spin'; llmIcon.textContent  = '⟳'; }
    if (llmLabel) llmLabel.textContent = 'Extracting structured intelligence…';
    if (badge)    badge.textContent = 'PROCESSING';
    if (win)      win.classList.remove('complete');

    const fill  = getEl('progFill');
    const label = getEl('progPct');
    if (fill)  fill.style.width = '0%';
    if (label) label.textContent = '0%';
  }

  function runSequence() {
    timers.forEach(clearTimeout);
    timers = [];
    hideAll();
    resetSpinners();

    // Schedule element reveals
    SEQUENCE.forEach(([id, delay]) => {
      timers.push(setTimeout(() => show(id), delay));
    });

    // Progress bar: starts at 400ms, fills over 1900ms
    timers.push(setTimeout(() => animateProgress(1900, null), 400));

    // ASR icon → done at 5300ms
    timers.push(setTimeout(() => {
      const icon  = getEl('asrIcon');
      const label = getEl('asrLabel');
      if (icon)  { icon.className = 'ri ri-ok'; icon.textContent  = '✓'; }
      if (label) label.textContent = 'Whisper ASR · complete';
    }, 5300));

    // LLM icon → done at 6850ms
    timers.push(setTimeout(() => {
      const icon  = getEl('llmIcon');
      const label = getEl('llmLabel');
      if (icon)  { icon.className = 'ri ri-ok'; icon.textContent  = '✓'; }
      if (label) label.textContent = 'Intelligence extracted';
    }, 6850));

    // Badge → COMPLETE + glow at 8700ms
    timers.push(setTimeout(() => {
      const badge = getEl('winBadge');
      const win   = getEl('mockWindow');
      if (badge) badge.textContent = 'COMPLETE';
      if (win)   win.classList.add('complete');
    }, 8700));
  }

  runSequence();
  const loopTimer = setInterval(runSequence, LOOP_MS);
  // Expose cleanup (not strictly needed for landing page)
  window.__debriefCleanup = () => clearInterval(loopTimer);
})();


/* ── 4. Scroll reveal ─────────────────────────────── */
(function initReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const siblings = [...(entry.target.parentElement?.querySelectorAll('.reveal, .out-card, .pipe-node') || [])];
      const idx = Math.max(siblings.indexOf(entry.target), 0);
      setTimeout(() => entry.target.classList.add('is-visible'), idx * 90);
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });

  document.querySelectorAll('.reveal, .out-card, .pipe-node, .compno-flow').forEach(el => obs.observe(el));
})();


/* ── 5. Header border on scroll ───────────────────── */
(function initHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;
  const onScroll = () => {
    header.style.borderBottomColor = window.scrollY > 10
      ? 'rgba(0, 229, 195, 0.15)'
      : 'transparent';
  };
  window.addEventListener('scroll', onScroll, { passive: true });
})();


/* ── 6. Demo form ─────────────────────────────────── */
(function initForm() {
  const form = document.getElementById('demoForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name  = String(form.elements['name'].value || '').trim();
    const email = String(form.elements['email'].value || '').trim();
    if (!name || !email) return;
    const subject = encodeURIComponent('Debrief demo request');
    const body    = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\nI'd like a demo of Debrief.`
    );
    window.location.href = `mailto:business@brassin.com?subject=${subject}&body=${body}`;
  });
})();

