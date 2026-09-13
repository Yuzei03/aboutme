// ---------- element refs ----------
const splash = document.getElementById('splash');
const site = document.getElementById('site');
const enterBtn = document.getElementById('enterBtn');
const tabs = document.querySelectorAll('.tab');
const pages = document.querySelectorAll('.page');
const scrollArea = document.getElementById('scrollArea');
const volSlider = document.getElementById('volSlider');
const volFill = document.getElementById('volFill');
const volThumb = document.getElementById('volThumb');
const volMute = document.getElementById('volMute');

// ---------- audio setup ----------
const bgMusic = document.getElementById('bgMusic');
let muted = false;
let lastVolume = 0.4; // keep last non-zero volume for unmute

function setVolumeUI(pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  volFill.style.width = clamped + '%';
  volThumb.style.left = clamped + '%';
  volSlider.value = clamped;
}

function applyVolume(pct) {
  const v = Math.max(0, Math.min(100, pct)) / 100;
  bgMusic.volume = v;
  if (v > 0) {
    lastVolume = v;
    muted = false;
    bgMusic.muted = false;
    volMute.classList.remove('is-muted');
  } else {
    muted = true;
    bgMusic.muted = true;
    volMute.classList.add('is-muted');
  }
  setVolumeUI(pct);
}

function initAudio() {
  bgMusic.volume = lastVolume;
  setVolumeUI(Math.round(lastVolume * 100));
  // play() returns a promise; browsers may still block until a gesture,
  // but the enter click counts as one, so this should succeed.
  return bgMusic.play().catch(() => {
    // silent fallback — user can still use the slider / mute button
  });
}

function playBlip() {
  if (muted || bgMusic.volume === 0) return;
  try {
    const ctx = playBlip._ctx || (playBlip._ctx = new (window.AudioContext || window.webkitAudioContext)());
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08 * bgMusic.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch (e) { /* ignore */ }
}

// volume slider
volSlider.addEventListener('input', () => {
  applyVolume(Number(volSlider.value));
});

// mute / unmute toggle on the speaker icon
volMute.addEventListener('click', () => {
  if (muted || bgMusic.volume === 0) {
    // unmute to last volume (or 40% if never set)
    const restore = lastVolume > 0 ? lastVolume : 0.4;
    applyVolume(Math.round(restore * 100));
    if (bgMusic.paused) initAudio();
  } else {
    // mute (remember current volume)
    lastVolume = bgMusic.volume || lastVolume;
    applyVolume(0);
  }
});

// initial UI state
setVolumeUI(40);

// ---------- enter transition ----------
// Start the splash exit and site entrance at the same time. This keeps the
// transition identical on desktop and mobile and avoids waiting on a
// transitionend event before revealing the page underneath.
let hasEntered = false;

function enterSite() {
  if (hasEntered) return;
  hasEntered = true;

  initAudio();
  enterBtn.disabled = true;
  splash.classList.add('slide-out');
  site.classList.add('site-enter');

  // Remove the splash after its exit animation has completed. The timeout is
  // only a fallback for browsers that don't fire transitionend reliably.
  const finish = () => {
    splash.style.display = 'none';
    splash.removeEventListener('transitionend', onTransitionEnd);
  };

  const onTransitionEnd = (e) => {
    if (e.target === splash && e.propertyName === 'transform') finish();
  };

  splash.addEventListener('transitionend', onTransitionEnd);
  window.setTimeout(finish, 950);
}

enterBtn.addEventListener('click', enterSite);
enterBtn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    enterSite();
  }
});

// ---------- scroll-driven paging ----------
const pageOrder = Array.from(pages);
let activeIndex = 0;
let isSnapping = false;

function setActiveTabFor(pageId) {
  tabs.forEach((t) => {
    t.classList.toggle('active', t.dataset.page === pageId);
  });
}

// how long the snap animation is allowed to "own" the scroll area.
// must be >= the CSS transition time for .page-inner (0.55s) plus a margin
// for the smooth scrollIntoView itself, so trackpad inertia can't sneak
// a second trigger in before the current page finishes settling.
const SNAP_LOCK_MS = 700;
const SNAP_DURATION_MS = 650;
let snapAnimation = null;

function setActiveTabFor(pageId) {
  tabs.forEach((t) => {
    t.classList.toggle('active', t.dataset.page === pageId);
  });
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function stopSnapAnimation() {
  if (snapAnimation !== null) {
    cancelAnimationFrame(snapAnimation);
    snapAnimation = null;
  }
}

function animateScrollTo(targetTop, duration = SNAP_DURATION_MS) {
  stopSnapAnimation();

  const startTop = scrollArea.scrollTop;
  const distance = targetTop - startTop;
  if (Math.abs(distance) < 1) {
    scrollArea.scrollTop = targetTop;
    return Promise.resolve();
  }

  const startTime = performance.now();

  return new Promise((resolve) => {
    function frame(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      scrollArea.scrollTop = startTop + distance * easeOutCubic(progress);

      if (progress < 1) {
        snapAnimation = requestAnimationFrame(frame);
      } else {
        snapAnimation = null;
        scrollArea.scrollTop = targetTop;
        resolve();
      }
    }

    snapAnimation = requestAnimationFrame(frame);
  });
}

function goToIndex(index, { silent = false } = {}) {
  const clamped = Math.max(0, Math.min(pageOrder.length - 1, index));
  if (clamped === activeIndex && !silent) return;

  isSnapping = true;
  activeIndex = clamped;

  const target = pageOrder[activeIndex];
  const targetTop = target.offsetTop;
  setActiveTabFor(target.id);

  if (!silent) playBlip();

  animateScrollTo(targetTop).finally(() => {
    window.clearTimeout(goToIndex._t);
    goToIndex._t = window.setTimeout(() => {
      isSnapping = false;
    }, SNAP_LOCK_MS);
  });
}

// Desktop wheel paging. The wheel event is intentionally handled on the
// scroll container so mouse wheels and trackpads use the same animation as
// touch and keyboard navigation. Native scrolling is prevented only while
// paging so one gesture cannot skip through several sections.
const WHEEL_MIN_DELTA = 4;

scrollArea.addEventListener('wheel', (e) => {
  let delta = e.deltaY;
  if (e.deltaMode === 1) delta *= 16;
  else if (e.deltaMode === 2) delta *= window.innerHeight;

  if (Math.abs(delta) < WHEEL_MIN_DELTA) return;

  e.preventDefault();
  if (isSnapping) return;

  goToIndex(activeIndex + (delta > 0 ? 1 : -1));
}, { passive: false });

// touch swipe
let touchStartY = null;
scrollArea.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

scrollArea.addEventListener('touchend', (e) => {
  if (touchStartY === null) return;
  const delta = touchStartY - e.changedTouches[0].clientY;
  touchStartY = null;
  if (isSnapping) return;
  if (Math.abs(delta) < 40) return;
  goToIndex(activeIndex + (delta > 0 ? 1 : -1));
}, { passive: true });

// keyboard
window.addEventListener('keydown', (e) => {
  if (splash.style.display !== 'none') return;
  if (['ArrowDown', 'PageDown'].includes(e.key)) {
    e.preventDefault();
    goToIndex(activeIndex + 1);
  } else if (['ArrowUp', 'PageUp'].includes(e.key)) {
    e.preventDefault();
    goToIndex(activeIndex - 1);
  }
});

// tab clicks
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const index = pageOrder.findIndex((p) => p.id === tab.dataset.page);
    if (index === -1) return;
    goToIndex(index);
  });
});

// reveal-on-scroll (slide + fade)
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
    } else {
      // allow content to slide out a bit when leaving so the next page's
      // enter feels continuous
      entry.target.classList.remove('in-view');
    }
  });
}, { root: scrollArea, threshold: 0.45 });

pageOrder.forEach((page) => revealObserver.observe(page));

// keep active tab in sync
const tabSyncObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting && entry.intersectionRatio > 0.55) {
      const index = pageOrder.indexOf(entry.target);
      if (index !== -1) {
        activeIndex = index;
        setActiveTabFor(entry.target.id);
      }
    }
  });
}, { root: scrollArea, threshold: [0.55] });

pageOrder.forEach((page) => tabSyncObserver.observe(page));

// ---------- discord "copy username" panel ----------
const discordCopy = document.getElementById('discordCopy');
if (discordCopy) {
  const subEl = document.getElementById('discordCopySub');
  const username = discordCopy.dataset.username;
  const defaultLabel = subEl.textContent;
  let resetTimer = null;

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  discordCopy.addEventListener('click', () => {
    const copyPromise = (navigator.clipboard && window.isSecureContext)
      ? navigator.clipboard.writeText(username)
      : Promise.resolve(fallbackCopy(username));

    copyPromise.catch(() => fallbackCopy(username)).finally(() => {
      discordCopy.classList.add('is-copied');
      subEl.textContent = 'copied to clipboard!';
      playBlip();

      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        discordCopy.classList.remove('is-copied');
        subEl.textContent = defaultLabel;
      }, 1600);
    });
  });
}
