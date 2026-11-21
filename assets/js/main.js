/*
 * Comportements du portfolio : langue, thème, navigation, animations du hero,
 * cartes d'expertise, compétences, timeline, galerie, lightbox, contact et raccourcis.
 * Dépend de window.I18N (assets/js/i18n.js) et, si disponible, de window.Swiper (CDN).
 * Point d'entrée unique : init(), appelé en bas de fichier.
 */
(() => {
  'use strict';

  const T = window.I18N;

  /* ===== Utilitaires ===== */
  const doc = document;
  const root = doc.documentElement;

  const $ = (sel, ctx) => (ctx || doc).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || doc).querySelectorAll(sel));

  function mq(query) {
    return window.matchMedia ? window.matchMedia(query) : { matches: false, addEventListener() {} };
  }

  const reduceMQ = mq('(prefers-reduced-motion: reduce)');
  const fineMQ = mq('(hover: hover) and (pointer: fine)');
  const reduced = () => reduceMQ.matches;

  function onMQ(m, fn) {
    if (m.addEventListener) m.addEventListener('change', fn);
    else if (m.addListener) m.addListener(fn);
  }

  // localStorage peut être indisponible (navigation privée, file://) : on ignore l'erreur.
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (err) { /* stockage indisponible */ }
    return null;
  }

  // Lire offsetWidth force un recalcul de mise en page, pour rejouer une transition CSS.
  const reflow = (el) => el.offsetWidth;

  function replayClass(el, cls) {
    el.classList.remove(cls);
    reflow(el);
    el.classList.add(cls);
  }

  const scrollBehavior = () => (reduced() ? 'auto' : 'smooth');

  function debounce(fn, ms) {
    let id;
    return () => {
      clearTimeout(id);
      id = setTimeout(fn, ms);
    };
  }

  // Remplace les marqueurs {cle} d'un texte traduit.
  function fmt(str, values) {
    return str.replace(/\{(\w+)\}/g, (m, k) => (values[k] !== undefined ? values[k] : m));
  }

  /* ===== État partagé ===== */
  const state = {
    lang: store('lang') === 'fr' ? 'fr' : 'en',
    theme: store('theme') === 'light' ? 'light' : 'dark',
    heroVisible: true,
    lightboxOpen: false
  };
  // Fonctions rappelées à chaque changement de langue / de thème, dans l'ordre d'enregistrement.
  const langHooks = [];
  const themeHooks = [];

  // Traduction dans la langue courante, repli sur l'anglais puis sur la clé elle-même.
  function t(key) {
    const v = T[state.lang][key];
    if (v !== undefined) return v;
    return T.en[key] !== undefined ? T.en[key] : key;
  }

  /* ===== Langue ===== */
  function initLanguage() {
    const langBtn = $('#langToggle');

    function applyLang(lang) {
      state.lang = lang;
      const dict = T[lang];
      $$('[data-i18n]').forEach((el) => {
        const k = el.getAttribute('data-i18n');
        if (dict[k] !== undefined) el.textContent = dict[k];
      });
      $$('[data-i18n-html]').forEach((el) => {
        const k = el.getAttribute('data-i18n-html');
        if (dict[k] !== undefined) el.innerHTML = dict[k];
      });
      $$('[data-i18n-aria]').forEach((el) => {
        const k = el.getAttribute('data-i18n-aria');
        if (dict[k] === undefined) return;
        el.setAttribute('aria-label', dict[k]);
        if (el.hasAttribute('title')) el.setAttribute('title', dict[k]);
      });
      langBtn.textContent = lang === 'en' ? 'FR' : 'EN';
      root.setAttribute('lang', lang);
      store('lang', lang);
      langHooks.forEach((fn) => fn(lang));
    }

    const toggleLang = () => applyLang(state.lang === 'en' ? 'fr' : 'en');
    langBtn.addEventListener('click', toggleLang);
    return { applyLang, toggleLang };
  }

  /* ===== Thème clair / sombre ===== */
  function initTheme() {
    const themeBtn = $('#themeToggle');

    function applyTheme(theme) {
      root.setAttribute('data-theme', theme);
      themeBtn.innerHTML = theme === 'dark'
        ? '<i class="fa-solid fa-sun" aria-hidden="true"></i>'
        : '<i class="fa-solid fa-moon" aria-hidden="true"></i>';
      themeBtn.setAttribute('aria-pressed', String(theme === 'light'));
      store('theme', theme);
      state.theme = theme;
      themeHooks.forEach((fn) => fn(theme));
    }

    const toggleTheme = () => applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    themeBtn.addEventListener('click', toggleTheme);
    return { applyTheme, toggleTheme };
  }

  /* ===== Notification (toast) ===== */
  function initToast() {
    const toastEl = $('#toast');
    let timer = null;
    return function toast(msg) {
      toastEl.textContent = msg;
      toastEl.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(() => toastEl.classList.remove('show'), 2600);
    };
  }

  /* ===== Groupes de filtres (chips) ===== */
  // Un seul chip actif par groupe ; onChange reçoit la valeur de l'attribut attr du chip choisi.
  function chipGroup(group, attr, onChange) {
    const chips = $$('[' + attr + ']', group);
    function select(value) {
      chips.forEach((c) => {
        const on = c.getAttribute(attr) === value;
        c.classList.toggle('is-on', on);
        c.setAttribute('aria-pressed', String(on));
      });
      onChange(value);
    }
    group.addEventListener('click', (e) => {
      const c = e.target.closest('[' + attr + ']');
      if (c && group.contains(c)) select(c.getAttribute(attr));
    });
    return { select };
  }

  /* ===== Navigation : menu mobile, lien actif, progression, retour en haut ===== */
  function initNavigation() {
    const navToggle = $('#navToggle');
    const navLinks = $('#navLinks');
    const navAs = $$('a', navLinks);

    const menuOpen = () => navLinks.classList.contains('open');
    function setMenu(open) {
      navLinks.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', String(open));
    }
    navToggle.addEventListener('click', () => setMenu(!menuOpen()));
    navLinks.addEventListener('click', (e) => {
      if (e.target.closest('a')) setMenu(false);
    });
    doc.addEventListener('click', (e) => {
      if (menuOpen() && !navLinks.contains(e.target) && !navToggle.contains(e.target)) setMenu(false);
    });

    const sections = $$('main section[id]');
    function setActive(id) {
      navAs.forEach((a) => {
        const on = a.getAttribute('href') === '#' + id;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }
    if ('IntersectionObserver' in window) {
      // Bande fine au milieu de l'écran : la section qui la traverse devient active.
      const secIO = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) setActive(en.target.id);
        });
      }, { rootMargin: '-40% 0px -59% 0px' });
      sections.forEach((s) => secIO.observe(s));
    }

    const progress = $('#progress');
    const toTop = $('#toTop');
    let scrollTick = false;
    function onScroll() {
      scrollTick = false;
      const max = root.scrollHeight - window.innerHeight;
      const y = window.pageYOffset;
      const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      progress.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      toTop.classList.toggle('show', y > 600);
      // En bas de page, la dernière section (souvent courte) n'atteint jamais la bande du milieu.
      if (max > 0 && max - y < 4) setActive(sections[sections.length - 1].id);
    }
    window.addEventListener('scroll', () => {
      if (!scrollTick) {
        scrollTick = true;
        requestAnimationFrame(onScroll);
      }
    }, { passive: true });
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
      navAs[0].focus({ preventScroll: true });
    });

    return { menuOpen, setMenu, navToggle, toTop, onScroll };
  }

  /* ===== Apparition au défilement ===== */
  function initReveal() {
    const items = $$('.reveal,.reveal-left,.reveal-right');
    if ('IntersectionObserver' in window && !reduced()) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((x) => {
          if (x.isIntersecting) {
            x.target.classList.add('is-visible');
            io.unobserve(x.target);
          }
        });
      }, { threshold: 0.12 });
      items.forEach((el) => io.observe(el));
    } else {
      items.forEach((el) => el.classList.add('is-visible'));
    }
  }

  /* ===== Hero : compteurs animés ===== */
  function countUp() {
    $$('#heroStats [data-count]').forEach((el) => {
      const end = parseInt(el.getAttribute('data-count'), 10);
      const suffix = el.getAttribute('data-suffix') || '';
      if (reduced()) {
        el.textContent = end + suffix;
        return;
      }
      const duration = 1600;
      let start = null;
      el.textContent = '0';
      function step(ts) {
        if (start === null) start = ts;
        const p = Math.min(1, (ts - start) / duration);
        // Courbe ease-out cubique ; le suffixe (« + ») n'apparaît qu'à la fin.
        el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + (p === 1 ? suffix : '');
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  function initCounters() {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        io.disconnect();
        countUp();
      }
    }, { threshold: 0.5 });
    io.observe($('#heroStats'));
  }

  /* ===== Hero : texte machine à écrire ===== */
  function initTypewriter() {
    const typedEl = $('#typed');
    const typedSr = $('#typedSr');
    const typedWrap = $('#heroTyped');
    let timer = null;

    function startTyped() {
      clearTimeout(timer);
      const list = t('hero.roles').split('|');
      typedSr.textContent = list.join(', ');
      if (reduced()) {
        typedWrap.classList.add('static');
        typedEl.textContent = list.join(' · ');
        return;
      }
      typedWrap.classList.remove('static');
      let ri = 0;
      let ci = 0;
      let deleting = false;
      function tick() {
        // En pause tant que le hero est hors écran ou l'onglet masqué.
        if (!state.heroVisible || doc.hidden) {
          timer = setTimeout(tick, 400);
          return;
        }
        const word = list[ri];
        if (!deleting) {
          ci++;
          typedEl.textContent = word.slice(0, ci);
          if (ci >= word.length) {
            deleting = true;
            timer = setTimeout(tick, 1700);
            return;
          }
          timer = setTimeout(tick, 75);
        } else {
          ci--;
          typedEl.textContent = word.slice(0, ci);
          if (ci <= 0) {
            deleting = false;
            ri = (ri + 1) % list.length;
            timer = setTimeout(tick, 350);
            return;
          }
          timer = setTimeout(tick, 35);
        }
      }
      typedEl.textContent = '';
      tick();
    }

    langHooks.push(startTyped);
    onMQ(reduceMQ, startTyped);
  }

  /* ===== Hero : réseau de particules (canvas) ===== */
  function initParticles() {
    const hero = $('#hero');
    const cv = $('#heroCanvas');
    const ctx = cv.getContext ? cv.getContext('2d') : null;
    if (!ctx) {
      cv.hidden = true;
      return {};
    }
    let pts = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let rgb = '255,153,0';
    const mouse = { x: -1e4, y: -1e4 };

    // Couleur des particules = variable CSS --accent du thème courant.
    function readColor() {
      const c = getComputedStyle(root).getPropertyValue('--accent').trim();
      const m = /^#([0-9a-f]{6})$/i.exec(c);
      if (m) {
        const n = parseInt(m[1], 16);
        rgb = ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
      }
    }

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = hero.clientWidth;
      h = hero.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Densité proportionnelle à la surface, bornée entre 18 et 70 points.
      const n = Math.round(Math.min(70, Math.max(18, w * h / 22000)));
      pts = [];
      for (let i = 0; i < n; i++) {
        pts.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4
        });
      }
    }

    function frame() {
      raf = 0;
      ctx.clearRect(0, 0, w, h);
      let dx;
      let dy;
      let d;
      // Déplacement : rebond sur les bords, répulsion autour de la souris.
      for (const p of pts) {
        dx = p.x - mouse.x;
        dy = p.y - mouse.y;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d < 140 && d > 0) {
          p.x += dx / d * 1.2;
          p.y += dy / d * 1.2;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        p.x = Math.max(0, Math.min(w, p.x));
        p.y = Math.max(0, Math.min(h, p.y));
      }
      // Dessin : liens entre points proches (< 120 px), lien vers la souris, puis le point.
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j];
          dx = p.x - q.x;
          dy = p.y - q.y;
          d = dx * dx + dy * dy;
          if (d < 14400) {
            ctx.strokeStyle = 'rgba(' + rgb + ',' + ((1 - Math.sqrt(d) / 120) * 0.28).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
        dx = p.x - mouse.x;
        dy = p.y - mouse.y;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d < 180) {
          ctx.strokeStyle = 'rgba(' + rgb + ',' + ((1 - d / 180) * 0.45).toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(' + rgb + ',.65)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8, 0, 6.2832);
        ctx.fill();
      }
      if (running()) raf = requestAnimationFrame(frame);
    }

    const running = () => state.heroVisible && !doc.hidden && !reduced();

    // Démarre ou arrête l'animation selon la visibilité du hero, de l'onglet et la préférence de mouvement.
    function sync() {
      if (reduced()) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        ctx.clearRect(0, 0, w, h);
        cv.hidden = true;
        return;
      }
      cv.hidden = false;
      if (!w) resize();
      if (running() && !raf) raf = requestAnimationFrame(frame);
      else if (!running() && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    hero.addEventListener('mousemove', (e) => {
      const r = hero.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });
    hero.addEventListener('mouseleave', () => {
      mouse.x = -1e4;
      mouse.y = -1e4;
    });
    window.addEventListener('resize', debounce(() => {
      if (!reduced()) resize();
    }, 200));
    doc.addEventListener('visibilitychange', sync);
    onMQ(reduceMQ, sync);
    themeHooks.push(readColor);
    readColor();
    return { sync, isRunning: () => raf !== 0 };
  }

  function watchHeroVisibility(heroCanvas) {
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver((entries) => {
      state.heroVisible = entries[0].isIntersecting;
      if (heroCanvas.sync) heroCanvas.sync();
    }).observe($('#hero'));
  }

  /* ===== Expertise : inclinaison 3D + retournement des cartes ===== */
  function initExpertiseCards() {
    $$('.exp-card').forEach((card) => {
      const inner = $('.exp-inner', card);
      const front = $('.exp-front', card);
      const back = $('.exp-back', card);
      const openBtn = $('.exp-flip', front);
      const backBtn = $('.exp-unflip', back);
      // Pas d'inclinaison pendant l'animation de retournement.
      let lockUntil = 0;

      function resetTilt() {
        inner.style.removeProperty('--rx');
        inner.style.removeProperty('--ry');
        card.classList.remove('tilting');
      }

      function flip(on, moveFocus) {
        resetTilt();
        lockUntil = Date.now() + 700;
        card.classList.toggle('flipped', on);
        // La face cachée est inert : ni focus clavier ni lecteur d'écran.
        if (on) {
          back.removeAttribute('inert');
          front.setAttribute('inert', '');
        } else {
          front.removeAttribute('inert');
          back.setAttribute('inert', '');
        }
        openBtn.setAttribute('aria-expanded', String(on));
        if (moveFocus) (on ? backBtn : openBtn).focus({ preventScroll: true });
      }

      card.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        // Une sélection de texte ne doit pas retourner la carte.
        if (window.getSelection && String(window.getSelection()).length) return;
        flip(!card.classList.contains('flipped'), !!e.target.closest('.exp-flip'));
      });
      card.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse' || !fineMQ.matches || reduced() || Date.now() < lockUntil) return;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        inner.style.setProperty('--rx', (-py * 8).toFixed(2) + 'deg');
        inner.style.setProperty('--ry', (px * 10).toFixed(2) + 'deg');
        card.classList.add('tilting');
      });
      card.addEventListener('pointerleave', resetTilt);
    });
  }

  /* ===== Compétences : filtres par catégorie + barres de niveau ===== */
  function initSkillsTabs() {
    const items = $$('#skGrid .sk');
    const fillBars = (bars) => bars.forEach((b) => { b.style.width = b.getAttribute('data-w') + '%'; });

    // Chaque barre se remplit la première fois qu'elle devient visible.
    let io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((x) => {
          if (x.isIntersecting) {
            fillBars([x.target]);
            io.unobserve(x.target);
          }
        });
      }, { threshold: 0.4 });
      items.forEach((it) => io.observe($('.sk-bar', it)));
    } else {
      fillBars($$('.sk-bar'));
    }

    chipGroup($('#skFilters'), 'data-sk-filter', (cat) => {
      const shown = [];
      items.forEach((it) => {
        const ok = cat === 'all' || it.getAttribute('data-cat') === cat;
        it.hidden = !ok;
        if (ok) {
          it.classList.add('is-visible');
          shown.push($('.sk-bar', it));
          if (!reduced()) replayClass(it, 'sk-in');
        }
      });
      // Remise à zéro sans transition, puis remplissage animé à la frame suivante.
      shown.forEach((b) => {
        if (io) io.unobserve(b);
        b.style.transition = 'none';
        b.style.width = '0';
      });
      if (shown.length) reflow(shown[0]);
      shown.forEach((b) => { b.style.transition = ''; });
      requestAnimationFrame(() => fillBars(shown));
    });
  }

  /* ===== Timeline : filtres pays / entreprise + cartes dépliables ===== */
  // onPhotos(key) est appelé quand on clique sur le lien « photos » d'une expérience.
  function initTimelineFilters(onPhotos) {
    const rows = $$('#timeline .tl-row');
    const filters = { country: 'all', co: 'all' };
    let shownCount = rows.length;

    function moreLabel(card) {
      $('.tl-more-t', card).textContent = t(card.classList.contains('open') ? 'work.less' : 'work.more');
    }

    // Le bouton « Voir plus » n'apparaît que si la description est tronquée.
    function refreshExpandable() {
      rows.forEach((r) => {
        if (r.hidden) return;
        const c = $('.tl-c', r);
        const d = $('.tl-desc', c);
        const b = $('.tl-more', c);
        if (c.classList.contains('open')) {
          d.style.maxHeight = 'none';
          b.hidden = false;
          c.classList.add('expandable');
          return;
        }
        const fits = d.scrollHeight <= d.clientHeight + 2;
        b.hidden = fits;
        c.classList.toggle('expandable', !fits);
      });
    }

    // max-height passe par une valeur en px pour que la transition CSS fonctionne dans les deux sens.
    function setCard(c, open) {
      const d = $('.tl-desc', c);
      d.style.maxHeight = d.scrollHeight + 'px';
      if (!open) {
        reflow(d);
        d.style.maxHeight = '';
      }
      c.classList.toggle('open', open);
      $('.tl-more', c).setAttribute('aria-expanded', String(open));
      moreLabel(c);
    }

    function countText() {
      $('#tlCount').textContent = shownCount === 1 ? t('work.count1') : fmt(t('work.count'), { n: shownCount });
    }

    // Applique les filtres et réalterne gauche / droite sur les seules lignes visibles.
    function layoutTimeline(animate) {
      let n = 0;
      rows.forEach((r) => {
        const ok = (filters.country === 'all' || r.getAttribute('data-country') === filters.country)
          && (filters.co === 'all' || r.getAttribute('data-co') === filters.co);
        r.hidden = !ok;
        if (!ok) return;
        r.classList.toggle('is-left', n % 2 === 0);
        r.classList.toggle('is-right', n % 2 === 1);
        n++;
        if (animate) {
          r.classList.add('is-visible');
          if (!reduced()) replayClass(r, 'tl-anim');
        }
      });
      shownCount = n;
      $('#tlEmpty').hidden = n > 0;
      countText();
      refreshExpandable();
    }

    chipGroup($('#tlCountry'), 'data-tl-country', (v) => {
      filters.country = v;
      layoutTimeline(true);
    });
    chipGroup($('#tlCompany'), 'data-tl-co', (v) => {
      filters.co = v;
      layoutTimeline(true);
    });

    rows.forEach((r) => {
      const c = $('.tl-c', r);
      $('.tl-desc', c).addEventListener('transitionend', (e) => {
        if (e.propertyName === 'max-height' && c.classList.contains('open')) e.target.style.maxHeight = 'none';
      });
      c.addEventListener('click', (e) => {
        const photos = e.target.closest('.tl-photos');
        if (photos) {
          onPhotos(photos.getAttribute('data-gal'));
          return;
        }
        if (e.target.closest('.tl-more')) {
          setCard(c, !c.classList.contains('open'));
          return;
        }
        if (e.target.closest('a,button')) return;
        if (!c.classList.contains('expandable')) return;
        if (window.getSelection && String(window.getSelection()).length) return;
        setCard(c, !c.classList.contains('open'));
      });
    });

    langHooks.push(() => {
      rows.forEach((r) => moreLabel($('.tl-c', r)));
      countText();
      refreshExpandable();
    });
    window.addEventListener('resize', debounce(refreshExpandable, 200));
    window.addEventListener('load', refreshExpandable);

    return { layoutTimeline };
  }

  /* ===== Galerie : carrousels Swiper + filtre par entreprise ===== */
  function initGallery() {
    const galCos = $$('#gallery .gal-co');
    const swipers = {};
    const galData = {};
    const hasSwiper = typeof window.Swiper === 'function';
    const SW_SPEED = 300;
    const swCfg = {
      slidesPerView: 3,
      spaceBetween: 16,
      loop: true,
      speed: reduced() ? 0 : SW_SPEED,
      autoplay: { delay: 3500, disableOnInteraction: false, pauseOnMouseEnter: true },
      breakpoints: { 0: { slidesPerView: 1 }, 600: { slidesPerView: 2 }, 900: { slidesPerView: 3 } }
    };

    function swA11y() {
      return {
        prevSlideMessage: t('sw.prev'),
        nextSlideMessage: t('sw.next'),
        firstSlideMessage: t('sw.first'),
        lastSlideMessage: t('sw.last'),
        paginationBulletMessage: t('sw.bullet'),
        slideLabelMessage: t('sw.slide'),
        containerRoleDescriptionMessage: t('sw.carousel'),
        itemRoleDescriptionMessage: t('sw.item')
      };
    }

    galCos.forEach((g) => {
      const key = g.getAttribute('data-co');
      const items = [];
      // Chaque photo est enveloppée dans un bouton qui ouvre la lightbox.
      $$('.swiper-slide img', g).forEach((img, i) => {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'gal-open';
        b.setAttribute('data-co', key);
        b.setAttribute('data-index', String(i));
        img.parentNode.insertBefore(b, img);
        b.appendChild(img);
        items.push({ src: img.getAttribute('src'), alt: img.getAttribute('alt'), btn: b });
      });
      galData[key] = { el: g, title: $('.gal-hd h3', g), badge: $('.gal-badge', g), items };
      if (hasSwiper) {
        const el = $('.swiper', g);
        swipers[key] = new window.Swiper(el, Object.assign({}, swCfg, {
          a11y: swA11y(),
          navigation: { nextEl: $('.swiper-button-next', el), prevEl: $('.swiper-button-prev', el) },
          pagination: { el: $('.swiper-pagination', el), clickable: true }
        }));
        // L'autoplay reste configuré pour que les écouteurs pauseOnMouseEnter existent si la préférence de mouvement change ensuite.
        if (reduced()) swipers[key].autoplay.stop();
      }
    });

    function galLabels() {
      Object.keys(galData).forEach((k) => {
        const g = galData[k];
        g.items.forEach((it, i) => {
          it.btn.setAttribute('aria-label', fmt(t('lb.open'), { i: i + 1, n: g.items.length, co: g.title.textContent }));
        });
      });
    }
    langHooks.push(galLabels);

    // Swiper ne retraduit pas ses libellés ARIA : on les réécrit à chaque changement de langue.
    function swRelabel() {
      const m = swA11y();
      Object.keys(swipers).forEach((k) => {
        const s = swipers[k];
        const n = s.slides.length;
        Object.assign(s.params.a11y, m);
        s.el.setAttribute('aria-roledescription', m.containerRoleDescriptionMessage);
        if (s.navigation) {
          if (s.navigation.nextEl) s.navigation.nextEl.setAttribute('aria-label', m.nextSlideMessage);
          if (s.navigation.prevEl) s.navigation.prevEl.setAttribute('aria-label', m.prevSlideMessage);
        }
        s.slides.forEach((sl, i) => {
          const idx = s.params.loop ? parseInt(sl.getAttribute('data-swiper-slide-index'), 10) : i;
          sl.setAttribute('aria-roledescription', m.itemRoleDescriptionMessage);
          sl.setAttribute('aria-label', m.slideLabelMessage.replace('{{index}}', idx + 1).replace('{{slidesLength}}', n));
        });
        if (s.pagination && s.pagination.update) s.pagination.update();
      });
    }
    langHooks.push(swRelabel);

    // Défilement automatique uniquement si le carrousel est visible, la lightbox fermée et le mouvement autorisé.
    const galCanPlay = (key) => !reduced() && !galData[key].el.hidden && !state.lightboxOpen;
    function syncAutoplay() {
      Object.keys(swipers).forEach((k) => {
        const s = swipers[k];
        if (!s.autoplay) return;
        if (galCanPlay(k)) {
          if (!s.autoplay.running) s.autoplay.start();
        } else if (s.autoplay.running) {
          s.autoplay.stop();
        }
      });
    }
    onMQ(reduceMQ, () => {
      const sp = reduced() ? 0 : SW_SPEED;
      Object.keys(swipers).forEach((k) => { swipers[k].params.speed = sp; });
      syncAutoplay();
    });

    const galFilter = chipGroup($('#galFilters'), 'data-gal-filter', (v) => {
      galCos.forEach((g) => {
        const key = g.getAttribute('data-co');
        const ok = v === 'all' || key === v;
        g.hidden = !ok;
        if (ok) {
          g.classList.add('is-visible');
          if (swipers[key]) swipers[key].update();
          if (!reduced()) replayClass(g, 'gal-in');
        }
      });
      syncAutoplay();
    });

    // Filtre la galerie sur une entreprise, y défile et la met brièvement en évidence.
    function showGallery(key) {
      const g = galData[key];
      if (!g) return;
      galFilter.select(key);
      g.el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      g.title.focus({ preventScroll: true });
      g.el.classList.remove('gal-in');
      replayClass(g.el, 'gal-hl');
      setTimeout(() => g.el.classList.remove('gal-hl'), 2600);
    }

    return { galData, syncAutoplay, showGallery };
  }

  /* ===== Lightbox : agrandissement des photos de la galerie ===== */
  // outside : zones rendues inert pendant l'ouverture (le focus reste dans la lightbox).
  function initLightbox(gallery, outside) {
    const { galData, syncAutoplay } = gallery;
    const lb = $('#lightbox');
    const lbFig = $('#lbFig');
    const lbCap = $('#lbCaption');
    const lbCount = $('#lbCount');
    const lbStage = $('#lbStage');
    const lbPrev = $('#lbPrev');
    const lbNext = $('#lbNext');
    const lbClose = $('#lbClose');

    const lbImg = doc.createElement('img');
    lbImg.className = 'lb-img';
    lbImg.id = 'lbImg';
    lbImg.alt = '';
    lbImg.decoding = 'async';
    lbFig.insertBefore(lbImg, lbCap);

    const current = { key: null, i: 0, trigger: null };
    // Un swipe tactile génère aussi un clic : on l'ignore pour ne pas fermer la lightbox.
    let swipedAt = 0;

    function render() {
      const g = galData[current.key];
      const n = g.items.length;
      const it = g.items[current.i];
      lbImg.classList.add('loading');
      lbImg.onload = () => lbImg.classList.remove('loading');
      lbImg.onerror = lbImg.onload;
      lbImg.src = it.src;
      lbImg.alt = it.alt + ' ' + (current.i + 1) + '/' + n;
      lbCap.textContent = g.title.textContent + ' - ' + g.badge.textContent;
      lbCount.textContent = (current.i + 1) + '/' + n;
      lbPrev.hidden = lbNext.hidden = n < 2;
      // Précharge les photos voisines.
      [1, -1].forEach((d) => {
        const nb = g.items[(current.i + d + n) % n];
        if (nb) {
          const im = new Image();
          im.src = nb.src;
        }
      });
    }

    function open(key, i, trigger) {
      if (!galData[key]) return;
      state.lightboxOpen = true;
      current.key = key;
      current.i = i;
      current.trigger = trigger || doc.activeElement;
      outside.forEach((el) => el.setAttribute('inert', ''));
      doc.body.classList.add('lb-open');
      lb.hidden = false;
      render();
      reflow(lb);
      lb.classList.add('on');
      syncAutoplay();
      lbClose.focus({ preventScroll: true });
    }

    function close() {
      if (!state.lightboxOpen) return;
      state.lightboxOpen = false;
      lb.classList.remove('on');
      lb.hidden = true;
      outside.forEach((el) => el.removeAttribute('inert'));
      doc.body.classList.remove('lb-open');
      syncAutoplay();
      if (current.trigger && current.trigger.focus) current.trigger.focus({ preventScroll: true });
    }

    function step(d) {
      const n = galData[current.key].items.length;
      current.i = (current.i + d + n) % n;
      render();
    }

    $('#gallery').addEventListener('click', (e) => {
      const b = e.target.closest('.gal-open');
      // defaultPrevented : clic issu d'un glissement Swiper.
      if (!b || e.defaultPrevented) return;
      open(b.getAttribute('data-co'), parseInt(b.getAttribute('data-index'), 10), b);
    });
    lbPrev.addEventListener('click', () => step(-1));
    lbNext.addEventListener('click', () => step(1));
    lbClose.addEventListener('click', close);
    lb.addEventListener('click', (e) => {
      if (Date.now() - swipedAt < 400) return;
      if (e.target === lb || e.target === lbStage || e.target === lbFig) close();
    });

    let touch = null;
    lbStage.addEventListener('touchstart', (e) => {
      touch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    }, { passive: true });
    lbStage.addEventListener('touchend', (e) => {
      if (!touch) return;
      const p = e.changedTouches[0];
      const dx = p.clientX - touch.x;
      const dy = p.clientY - touch.y;
      touch = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        swipedAt = Date.now();
        step(dx < 0 ? 1 : -1);
      }
    }, { passive: true });

    // Piège à focus : Tab / Maj+Tab circulent entre les boutons visibles de la lightbox.
    function trapFocus(e) {
      const focusable = [lbClose, lbPrev, lbNext].filter((b) => !b.hidden);
      const i = focusable.indexOf(doc.activeElement);
      e.preventDefault();
      if (i === -1) {
        focusable[0].focus();
        return;
      }
      focusable[(i + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length].focus();
    }

    return { close, step, trapFocus };
  }

  /* ===== Contact : copie de l'e-mail + export vCard ===== */
  function initContact(toast) {
    const emailLink = $('#ctEmail');
    const emailAddr = () => emailLink.getAttribute('href').replace(/^mailto:/, '');

    // Repli pour les contextes sans API Clipboard (file://, HTTP non sécurisé).
    function legacyCopy(text) {
      const active = doc.activeElement;
      const ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.className = 'sr-only';
      doc.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = doc.execCommand('copy');
      } catch (err) {
        ok = false;
      }
      doc.body.removeChild(ta);
      if (active && active.focus) active.focus({ preventScroll: true });
      return ok;
    }

    function copyText(text) {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text));
      }
      return Promise.resolve(legacyCopy(text));
    }

    $('#copyEmail').addEventListener('click', () => {
      const e = emailAddr();
      copyText(e).then((ok) => toast(ok ? t('toast.copied') : fmt(t('toast.copy_fail'), { e })));
    });

    // Échappement des valeurs vCard 3.0 (RFC 2426).
    const vEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

    function buildVCard() {
      const city = $('#ctCity').textContent.split(',');
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'N:DEBAB;Amine;;;',
        'FN:Amine DEBAB',
        'TITLE:' + vEsc(t('hero.title')),
        'ORG:Amazon LYS2',
        'EMAIL;TYPE=INTERNET:' + emailAddr(),
        'TEL;TYPE=CELL:' + $('#ctPhone').getAttribute('href').replace(/^tel:/, ''),
        'ADR;TYPE=WORK:' + ['', '', '', city[0].trim(), '', '', (city[1] || '').trim()].map(vEsc).join(';'),
        'URL:' + $('#socLinkedin').href,
        'X-SOCIALPROFILE;TYPE=github:' + $('#socGithub').href
      ];
      if (/^https?:$/.test(location.protocol)) lines.push('URL:' + location.origin + location.pathname);
      lines.push('END:VCARD');
      return lines.join('\r\n') + '\r\n';
    }

    $('#vcardBtn').addEventListener('click', () => {
      const blob = new Blob([buildVCard()], { type: 'text/vcard;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = url;
      a.download = 'Amine_DEBAB.vcf';
      doc.body.appendChild(a);
      a.click();
      doc.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast(t('toast.vcard'));
    });
  }

  /* ===== Raccourcis clavier ===== */
  // Lightbox ouverte : Échap / flèches / Tab. Sinon : Échap ferme le menu, T = thème, L = langue.
  function initShortcuts({ lightbox, nav, theme, language, toast }) {
    function isTyping(el) {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    doc.addEventListener('keydown', (e) => {
      if (state.lightboxOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          lightbox.close();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          lightbox.step(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          lightbox.step(1);
        } else if (e.key === 'Tab') {
          lightbox.trapFocus(e);
        }
        return;
      }
      if (e.key === 'Escape' && nav.menuOpen()) {
        nav.setMenu(false);
        nav.navToggle.focus();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping(e.target)) return;
      const k = (e.key || '').toLowerCase();
      if (k === 't') {
        theme.toggleTheme();
        toast(t('toast.theme_' + state.theme));
      } else if (k === 'l') {
        language.toggleLang();
        toast(t('toast.lang'));
      }
    });
  }

  /* ===== Point d'entrée ===== */
  // L'ordre d'initialisation fixe l'ordre des hooks de langue / thème : ne pas le modifier sans vérifier.
  function init() {
    const language = initLanguage();
    const theme = initTheme();
    const toast = initToast();
    const nav = initNavigation();
    initReveal();
    initCounters();
    initTypewriter();
    const heroCanvas = initParticles();
    watchHeroVisibility(heroCanvas);
    initExpertiseCards();
    initSkillsTabs();
    // La galerie est créée après la timeline ; le lien « photos » la résout au moment du clic.
    let gallery = null;
    const timeline = initTimelineFilters((key) => gallery.showGallery(key));
    gallery = initGallery();
    const lightbox = initLightbox(gallery, [$('#mainNav'), $('#main'), $('footer'), nav.toTop]);
    initContact(toast);
    initShortcuts({ lightbox, nav, theme, language, toast });

    theme.applyTheme(state.theme);
    language.applyLang(state.lang);
    timeline.layoutTimeline(false);
    nav.onScroll();
    if (heroCanvas.sync) heroCanvas.sync();
  }

  init();
})();
