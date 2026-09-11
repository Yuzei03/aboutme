
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


const bgMusic = document.getElementById('bgMusic');
let muted = false;
let lastVolume = 0.4; 

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

  return bgMusic.play().catch(() => {

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
  } catch (e) {  }
}


volSlider.addEventListener('input', () => {
  applyVolume(Number(volSlider.value));
});

volMute.addEventListener('click', () => {
  if (muted || bgMusic.volume === 0) {
   
    const restore = lastVolume > 0 ? lastVolume : 0.4;
    applyVolume(Math.round(restore * 100));
    if (bgMusic.paused) initAudio();
  } else {
  
    lastVolume = bgMusic.volume || lastVolume;
    applyVolume(0);
  }
});


setVolumeUI(40);


enterBtn.addEventListener('click', () => {
  if (splash.classList.contains('slide-out')) return;
  initAudio();

  splash.classList.add('slide-out');

  let revealed = false;
  function revealSite() {
    if (revealed) return;
    revealed = true;
    splash.style.display = 'none';
    site.classList.add('site-enter');
  }

  splash.addEventListener('transitionend', function onDone(e) {
    if (e.target !== splash) return;
    splash.removeEventListener('transitionend', onDone);
    revealSite();
  });

  window.setTimeout(revealSite, 900);
});


const pageOrder = Array.from(pages);
let activeIndex = 0;
let isSnapping = false;

function setActiveTabFor(pageId) {
  tabs.forEach((t) => {
    t.classList.toggle('active', t.dataset.page === pageId);
  });
}

function goToIndex(index, { silent } = {}) {
  const clamped = Math.max(0, Math.min(pageOrder.length - 1, index));
  if (clamped === activeIndex && !silent) return;

  isSnapping = true;
  activeIndex = clamped;
  const target = pageOrder[activeIndex];
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setActiveTabFor(target.id);

  if (!silent) playBlip();

  window.clearTimeout(goToIndex._t);
  goToIndex._t = window.setTimeout(() => { isSnapping = false; }, 700);
}


let wheelCooldown = false;
scrollArea.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (wheelCooldown || isSnapping) return;
  if (Math.abs(e.deltaY) < 4) return;

  wheelCooldown = true;
  window.setTimeout(() => { wheelCooldown = false; }, 750);

  if (e.deltaY > 0) {
    goToIndex(activeIndex + 1);
  } else {
    goToIndex(activeIndex - 1);
  }
}, { passive: false });


let touchStartY = null;
scrollArea.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

scrollArea.addEventListener('touchend', (e) => {
  if (touchStartY === null || isSnapping) return;
  const delta = touchStartY - e.changedTouches[0].clientY;
  touchStartY = null;
  if (Math.abs(delta) < 40) return;
  goToIndex(activeIndex + (delta > 0 ? 1 : -1));
}, { passive: true });


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


tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const index = pageOrder.findIndex((p) => p.id === tab.dataset.page);
    if (index === -1) return;
    goToIndex(index);
  });
});


const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
    } else {
  
      entry.target.classList.remove('in-view');
    }
  });
}, { root: scrollArea, threshold: 0.45 });

pageOrder.forEach((page) => revealObserver.observe(page));


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
