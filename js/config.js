"use strict";

/* ===============================
   Cache & helpers
================================= */
const header   = document.querySelector(".site-header");
const burger   = document.getElementById("burgerBtn");
const nav      = document.getElementById("mainNav");
const mqlMobile = window.matchMedia("(max-width: 768px)");

const getHeaderH = () =>
  (header?.offsetHeight || 0) ||
  parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;

const raf = (cb) => requestAnimationFrame(() => requestAnimationFrame(cb)); // 2×RAF, lai pārliecinātos, ka layout ir stabils

/* ===============================
   Loader
================================= */
window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  if (!loader) return;
  loader.style.transition = "opacity .3s ease";
  loader.style.opacity = "0";
  setTimeout(() => (loader.style.display = "none"), 300);
});

/* ===============================
   Language switch (placeholder)
================================= */
window.switchLanguage = function (lang) {
  console.log("Language switched to:", lang);
};

/* ===============================
   Language switching with #hash / ?query preservation
================================= */
(function languageSwitcher(){
  const SUPPORTED = ["en","lv","ru"];
  const DEFAULT   = "en";

  function getCurrentLang(){
    const segs = location.pathname.split("/").filter(Boolean);
    return SUPPORTED.includes(segs[0]) ? segs[0] : null;
  }

  function getRemainderPath(){
    const segs = location.pathname.split("/").filter(Boolean);
    const lang = SUPPORTED.includes(segs[0]) ? segs[0] : null;
    const rest = segs.slice(lang ? 1 : 0).join("/");
    // noņem "index.html" un normalizē beigās slīpsvītru, ja ir apakšceļš
    const clean = rest.replace(/^index\.html$/i, "");
    return clean ? (clean.endsWith("/") ? clean : clean + "/") : "";
  }

  function markActiveButtons(current){
    document.querySelectorAll(".language-switch button[data-lang]").forEach(btn=>{
      btn.classList.toggle("is-active", btn.dataset.lang === (current || DEFAULT));
      btn.setAttribute("aria-current", btn.classList.contains("is-active") ? "true" : "false");
    });
  }

  window.switchLanguage = function(lang){
    if (!SUPPORTED.includes(lang)) return;
    const current = getCurrentLang() || DEFAULT;
    if (lang === current) return; // jau aktīvs

    const rest   = getRemainderPath();             // apakšceļš, ja tāds ir
    const search = location.search || "";
    const hash   = location.hash   || "";
    const target = `/${lang}/${rest}${search}${hash}`;

    // replace -> nepiebriest back/forward vēsture
    location.replace(target);
  };

  // Event delegation: strādā gan header, gan mobile menu blokā
  document.addEventListener("click", (e)=>{
    const btn = e.target.closest(".language-switch button[data-lang]");
    if (!btn) return;
    e.preventDefault();
    window.switchLanguage(btn.dataset.lang);
  });

  // Iezīmē aktīvo pēc ielādes
  markActiveButtons(getCurrentLang());
})();


/* ===============================
   Header offset (body padding + scroll-padding)
================================= */
function updateHeaderOffset() {
  const h = getHeaderH();
  document.body.style.paddingTop = h + "px";
  document.documentElement.style.scrollPaddingTop = h + "px";
}
const debounce = (fn, d = 120) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), d);
  };
};
window.addEventListener("load", updateHeaderOffset);
window.addEventListener("resize", debounce(updateHeaderOffset, 120));

const throttle = (fn, wait = 100) => {
  let last = 0, t;
  return (...args) => {
    const now = Date.now();
    if (now - last >= wait) {
      last = now; fn(...args);
    } else {
      clearTimeout(t);
      t = setTimeout(() => { last = Date.now(); fn(...args); }, wait - (now - last));
    }
  };
};

/* ===============================
   Reveal on scroll
================================= */
(function revealOnScroll() {
  const els = document.querySelectorAll("[data-reveal]");
  if (!els.length) return;

  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
})();

/* ===============================
   Active nav highlight (top-level sections only)
   -> Izvēlamies tikai main > section[id], lai neķertu nejaušus iekšējos "section" ar ID
================================= */
/* ===============================
   Active section tracker (freeze while menu is open)
================================= */
(function activeSectionTracker(){
  const sections = Array.from(document.querySelectorAll("main > section[id]"));
  if (!sections.length) return;

  const links = Array.from(document.querySelectorAll(".main-nav a[href^='#']"));
  const setActive = (id) => {
    links.forEach(a => a.classList.toggle("active", a.getAttribute("href") === `#${id}`));
  };

  function computeActive(){
    // Ja burger izvēlne ir vaļā – neko nepārslēdzam (iesaldējam)
    if (document.body.classList.contains("nav-open")) return;

    const headerH = (document.querySelector(".site-header")?.offsetHeight) || 0;
    const topLine = window.scrollY + headerH + 8; // “redzamās lapas” augšlīnija zem headera

    // Ņemam pēdējo sekciju, kurai top <= topLine
    let current = sections[0].id;
    for (const s of sections) {
      if (s.offsetTop <= topLine) current = s.id; else break;
    }
    setActive(current);
  }

  // Pirmais aprēķins + uz scroll/resize
  window.addEventListener("load", computeActive);
  window.addEventListener("scroll", throttle(computeActive, 100), { passive:true });
  window.addEventListener("resize", debounce(computeActive, 150));

  // Padodam ārā, lai varam piesaukt pēc burgera aizvēršanas
  window.__computeActive = computeActive;
})();

/* ===============================
   Mobile menu (burger)
================================= */
(function mobileMenu() {
  if (!burger || !nav) return;

  burger.setAttribute("aria-controls", "mainNav");
  burger.setAttribute("aria-expanded", "false");

  function openMenu() {
    nav.classList.add("active");
    document.body.classList.add("nav-open");
    burger.setAttribute("aria-expanded", "true");
    raf(updateHeaderOffset);
  }
  function closeMenu() {
    nav.classList.remove("active");
    document.body.classList.remove("nav-open");
    burger.setAttribute("aria-expanded", "false");
    raf(() => {
      updateHeaderOffset();
      // Pēc header augstuma izmaiņām pārrēķinam aktīvo sekciju
      window.__computeActive?.();
    });
  }
  function isMobile() {
    return mqlMobile.matches;
  }

  burger.addEventListener("click", () => {
    nav.classList.contains("active") ? closeMenu() : openMenu();
  });

  // Aizveram uz ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("active")) closeMenu();
  });

  // Aizveram, ja klikšķis ārpus navigācijas
  document.addEventListener("click", (e) => {
    if (!isMobile()) return;
    if (!nav.classList.contains("active")) return;
    const inside = e.target.closest("#mainNav, #burgerBtn");
    if (!inside) closeMenu();
  });

  // Ja pārejam uz desktop izmēru — aizveram
  mqlMobile.addEventListener?.("change", () => {
    if (!mqlMobile.matches) closeMenu();
  });

  // ENKURU klikšķi: aizveram burgeri un RITINĀM AR OFFSETU
  nav.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;

    const id = a.getAttribute("href").slice(1);
    const target = document.getElementById(id);
    if (!target) return;

    e.preventDefault();

    // Ja mobilais – vispirms aizveram
    if (isMobile()) closeMenu();

    // Kad layout stabils, ritinām līdz precīzam punktam
    raf(() => {
      const headerH = getHeaderH();
      const y = target.getBoundingClientRect().top + window.pageYOffset - headerH - 8;
      window.scrollTo({ top: y, behavior: "smooth" });
      // Ātra vizuāla atgriezeniskā saite
      document.querySelectorAll(".main-nav a").forEach((link) => {
        link.classList.toggle("active", link === a);
      });
    });
  });
})();

/* ===============================
   Fix: ja lapa ielādējas ar #hash, pozicionē ar offsetu
================================= */
window.addEventListener("load", () => {
  if (location.hash && document.getElementById(location.hash.slice(1))) {
    const target = document.getElementById(location.hash.slice(1));
    raf(() => {
      const headerH = getHeaderH();
      const y = target.getBoundingClientRect().top + window.pageYOffset - headerH - 8;
      window.scrollTo({ top: y, behavior: "instant" in window ? "instant" : "auto" });
    });
  }
});

/* ===============================
   LITE 900 – inline image slider
================================= */
const lite900Images = ["images/L900_1.png", "images/L900.png"];
let lite900Index = 0;
window.nextLite900Image = function () {
  const img = document.getElementById("lite900-image");
  if (!img) return;
  lite900Index = (lite900Index + 1) % lite900Images.length;
  img.src = lite900Images[lite900Index];
};

/* ===============================
   Modals (open/close, backdrop, ESC)
================================= */
function bodyLock(lock) {
  document.body.style.overflow = lock ? "hidden" : "";
}

window.openModal = function (id, event) {
  if (event) event.stopPropagation();
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add("show");
  bodyLock(true);
};

window.closeModal = function (id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove("show");
  bodyLock(false);
};

// ESC aizver visus
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  document.querySelectorAll(".modal.show").forEach((m) => m.classList.remove("show"));
  bodyLock(false);
});

// Klikšķis uz backdrop
document.addEventListener("click", (event) => {
  const modals = document.querySelectorAll(".modal.show");
  modals.forEach((modal) => {
    if (event.target === modal) {
      modal.classList.remove("show");
      bodyLock(false);
    }
  });
});

// Blur efekts, kad hover uz "price" pogas
document.querySelectorAll(".model-card__price").forEach((btn) => {
  const card = btn.closest(".model-card");
  if (!card) return;
  btn.addEventListener("mouseenter", () => card.classList.add("blur-content"));
  btn.addEventListener("mouseleave", () => card.classList.remove("blur-content"));
});

// Piespied "mailto:" atvērt JAUNĀ TABĀ (ar drošiem atribūtiem)
(function enforceMailtoNewTab(){
  function wire(root = document){
    root.querySelectorAll('a[href^="mailto:"]').forEach(a => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');

      // Šis novērš gadījumus, kad Safari/ mobilie ignorē target uz mailto
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        if (!href) return;
        e.preventDefault();
        window.open(href, '_blank', 'noopener,noreferrer');
      }, { passive:false });
    });
  }

  // start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => wire());
  } else {
    wire();
  }
})();
