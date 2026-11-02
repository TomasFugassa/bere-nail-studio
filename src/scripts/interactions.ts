export {};

const filters = document.querySelectorAll<HTMLButtonElement>('[data-filter]');
const cards = [...document.querySelectorAll<HTMLElement>('.gallery-item')];
const photoButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-photo-id]')];
const count = document.getElementById('photo-count');
const dialog = document.querySelector<HTMLDialogElement>('#photo-dialog');
const dialogImage = document.querySelector<HTMLImageElement>('#dialog-image');
const dialogTitle = document.getElementById('dialog-title');
const dialogLabel = document.getElementById('dialog-label');
let currentPhoto: HTMLButtonElement | null = null;
let photoOpener: HTMLButtonElement | null = null;
let selectedReference: { number: string; title: string } | null = null;
let nextFocus: HTMLElement | null = null;

filters.forEach((filter) =>
  filter.addEventListener('click', () => {
    const category = filter.dataset.filter;
    const previous = new Map(
      cards.filter((card) => !card.hidden).map((card) => [card, card.getBoundingClientRect()]),
    );
    filters.forEach((button) => {
      const active = button === filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    cards.forEach((card) => {
      card.hidden = category !== 'all' && card.dataset.category !== category;
    });
    if (count) count.textContent = String(cards.filter((card) => !card.hidden).length);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cards
        .filter((card) => !card.hidden)
        .forEach((card, index) => {
          const before = previous.get(card),
            after = card.getBoundingClientRect();
          card.classList.add('revealed');
          card
            .getAnimations()
            .filter((animation) => animation.id === 'filter-move')
            .forEach((animation) => animation.cancel());
          const animation = card.animate(
            before
              ? [
                  {
                    transform: `translate(${before.left - after.left}px, ${before.top - after.top}px)`,
                  },
                  { transform: 'translate(0, 0)' },
                ]
              : [
                  { opacity: 0, transform: 'translateY(18px) scale(.97)' },
                  { opacity: 1, transform: 'translateY(0) scale(1)' },
                ],
            {
              duration: 430,
              delay: before ? 0 : index * 35,
              easing: 'cubic-bezier(.2,.7,.3,1)',
              fill: 'backwards',
            },
          );
          animation.id = 'filter-move';
        });
    }
  }),
);

function displayPhoto(button: HTMLButtonElement) {
  currentPhoto = button;
  if (dialogImage) {
    dialogImage.src = button.dataset.photoSrc ?? '';
    dialogImage.alt = button.dataset.photoAlt ?? '';
  }
  if (dialogImage && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    dialogImage
      .decode()
      .then(() => {
        if (currentPhoto === button)
          dialogImage.animate(
            [
              { opacity: 0.35, transform: 'scale(.985)' },
              { opacity: 1, transform: 'scale(1)' },
            ],
            { duration: 320, easing: 'ease-out' },
          );
      })
      .catch(() => {});
  }
  if (dialogTitle) dialogTitle.textContent = button.dataset.photoTitle ?? '';
  if (dialogLabel)
    dialogLabel.textContent = `${button.dataset.photoNumber} / ${button.dataset.photoLabel}`;
  const visible = photoButtons.filter(
    (photo) => !photo.closest<HTMLElement>('.gallery-item')?.hidden,
  );
  const position = document.getElementById('dialog-position');
  if (position)
    position.textContent = `${visible.indexOf(button) + 1} de ${visible.length} · Usá las flechas para explorar`;
}
photoButtons.forEach((button) =>
  button.addEventListener('click', () => {
    photoOpener = button;
    displayPhoto(button);
    dialog?.showModal();
    document.body.classList.add('dialog-open');
  }),
);
function closeDialog() {
  dialog?.close();
}
dialog?.addEventListener('close', () => {
  document.body.classList.remove('dialog-open');
  (nextFocus ?? photoOpener)?.focus({ preventScroll: true });
  nextFocus = null;
});
document.querySelector('.dialog-close')?.addEventListener('click', closeDialog);
dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) closeDialog();
});
function movePhoto(direction: number) {
  const visible = photoButtons.filter(
    (button) => !button.closest<HTMLElement>('.gallery-item')?.hidden,
  );
  const index = visible.indexOf(currentPhoto!);
  const next = visible[(index + direction + visible.length) % visible.length];
  if (next) displayPhoto(next);
}
document.querySelector('.dialog-prev')?.addEventListener('click', () => movePhoto(-1));
document.querySelector('.dialog-next')?.addEventListener('click', () => movePhoto(1));
dialog?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    movePhoto(-1);
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    movePhoto(1);
  }
});

const referenceBox = document.getElementById('selected-reference');
const referenceName = document.getElementById('reference-name');
const contact = document.getElementById('contacto');
const serviceSelect = document.querySelector<HTMLSelectElement>('#service');
document.getElementById('use-reference')?.addEventListener('click', () => {
  if (!currentPhoto) return;
  selectedReference = {
    number: currentPhoto.dataset.photoNumber ?? '',
    title: currentPhoto.dataset.photoTitle ?? '',
  };
  if (referenceName)
    referenceName.textContent = `${selectedReference.number} · ${selectedReference.title}`;
  if (referenceBox) referenceBox.hidden = false;
  nextFocus = serviceSelect;
  closeDialog();
  contact?.scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  });
  serviceSelect?.focus({ preventScroll: true });
});

// On touchscreens, a horizontal swipe browses the visible collection.
let touchStart: { x: number; y: number } | null = null;
dialogImage?.addEventListener(
  'touchstart',
  (event) => {
    if (event.touches.length === 1)
      touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  },
  { passive: true },
);
dialogImage?.addEventListener(
  'touchend',
  (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(touch.clientY - touchStart.y) * 1.4)
      movePhoto(dx > 0 ? -1 : 1);
    touchStart = null;
  },
  { passive: true },
);

const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
type HeroSlide = { id: string; number: string; title: string; alt: string; src: string };
const slides: HeroSlide[] = JSON.parse(document.getElementById('hero-slides')?.textContent ?? '[]');
const heroImages = [...document.querySelectorAll<HTMLImageElement>('.hero-visual > img')];
let heroIndex = 0,
  activeLayer = 0,
  heroBusy = false;
let heroTimer: ReturnType<typeof setTimeout> | undefined;
function mayPlay() {
  return !document.hidden;
}
function scheduleHero() {
  clearTimeout(heroTimer);
  if (slides.length > 1 && mayPlay())
    heroTimer = setTimeout(() => {
      void changeHero(1);
    }, 4000);
}
async function changeHero(direction: number) {
  if (heroBusy || slides.length < 2 || heroImages.length !== 2) return;
  clearTimeout(heroTimer);
  heroBusy = true;
  const nextIndex = (heroIndex + direction + slides.length) % slides.length;
  const slide = slides[nextIndex],
    incoming = heroImages[1 - activeLayer],
    outgoing = heroImages[activeLayer];
  try {
    incoming.removeAttribute('srcset');
    incoming.removeAttribute('sizes');
    incoming.src = slide.src;
    await incoming.decode();
    incoming.alt = slide.alt;
    incoming.removeAttribute('aria-hidden');
    outgoing.setAttribute('aria-hidden', 'true');
    incoming.classList.add('is-current');
    outgoing.classList.remove('is-current');
    heroIndex = nextIndex;
    activeLayer = 1 - activeLayer;
    const caption = document.getElementById('hero-caption'),
      position = document.getElementById('hero-position');
    if (caption) caption.textContent = `${slide.number} / ${slide.title}`;
    if (position)
      position.textContent = `${String(heroIndex + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    await new Promise((resolve) => setTimeout(resolve, 950));
  } catch {
    /* A failed image leaves the current design visible. */
  } finally {
    heroBusy = false;
    scheduleHero();
  }
}
document.getElementById('hero-prev')?.addEventListener('click', () => {
  void changeHero(-1);
});
document.getElementById('hero-next')?.addEventListener('click', () => {
  void changeHero(1);
});
document.addEventListener('visibilitychange', scheduleHero);
scheduleHero();
if (!motionPreference.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 },
  );
  document
    .querySelectorAll(
      '.section-heading, .gallery-item, .services-header, .studio-art, .studio-copy, .journey, .contact-heading, .inquiry-form',
    )
    .forEach((element) => {
      if (element instanceof HTMLElement && element.classList.contains('gallery-item'))
        element.style.setProperty('--reveal-order', String(cards.indexOf(element) % 4));
      element.classList.add('reveal');
      observer.observe(element);
    });
  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches) {
      observer.disconnect();
      document.querySelectorAll('.reveal').forEach((element) => element.classList.add('revealed'));
    }
  });
}
document.getElementById('clear-reference')?.addEventListener('click', () => {
  selectedReference = null;
  if (referenceBox) referenceBox.hidden = true;
  serviceSelect?.focus();
});

document.querySelectorAll<HTMLAnchorElement>('[data-service]').forEach((link) =>
  link.addEventListener('click', () => {
    const value = link.dataset.service;
    const mapped = value === 'Semipermanente' ? 'Esmaltado semipermanente' : value;
    if (serviceSelect && [...serviceSelect.options].some((option) => option.value === mapped))
      serviceSelect.value = mapped ?? '';
  }),
);

document.getElementById('inquiry-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const service = serviceSelect?.value;
  const idea = document.querySelector<HTMLTextAreaElement>('#idea')?.value.trim();
  const lines = ['¡Hola, Estudio Demo! Me gustaría consultar por un turno.'];
  if (service) lines.push(`Servicio: ${service}.`);
  if (selectedReference)
    lines.push(
      `Mi referencia de la colección es ${selectedReference.number}: ${selectedReference.title}.`,
    );
  if (idea) lines.push(`Mi idea: ${idea}`);
  lines.push('¿Me contás disponibilidad, precio y ubicación actual?');
  const url = `https://wa.me/${document.querySelector<HTMLFormElement>('#inquiry-form')?.dataset.phone || ''}?text=${encodeURIComponent(lines.join('\n'))}`;
  void url; // Demostración: no se envía ninguna consulta.
  const status = document.getElementById('form-status');
  if (status)
    status.textContent =
      'Demostración: la consulta no se envía y no se reserva ningún turno.';
});

const menuToggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
const mobileNav = document.getElementById('mobile-nav');
function setMenu(open: boolean) {
  if (mobileNav) mobileNav.hidden = !open;
  menuToggle?.setAttribute('aria-expanded', String(open));
  menuToggle?.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
}
menuToggle?.addEventListener('click', () =>
  setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'),
);
mobileNav
  ?.querySelectorAll('a')
  .forEach((link) => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuToggle?.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menuToggle.focus();
  }
});
matchMedia('(min-width: 701px)').addEventListener('change', (event) => {
  if (event.matches) setMenu(false);
});

if (
  !matchMedia('(prefers-reduced-motion: reduce)').matches &&
  matchMedia('(hover: hover) and (pointer: fine)').matches
) {
  const composition = document.querySelector<HTMLElement>('[data-tilt]');
  let frame = 0;
  composition?.addEventListener('pointermove', (event) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (motionPreference.matches) return;
      const box = composition.getBoundingClientRect();
      composition.style.setProperty(
        '--tilt-x',
        `${((event.clientY - box.top) / box.height - 0.5) * -5}deg`,
      );
      composition.style.setProperty(
        '--tilt-y',
        `${((event.clientX - box.left) / box.width - 0.5) * 5}deg`,
      );
    });
  });
  composition?.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame);
    composition.style.setProperty('--tilt-x', '0deg');
    composition.style.setProperty('--tilt-y', '0deg');
  });
}

// Two identical, viewport-filling runs make the loop boundary invisible.
const ribbon = document.querySelector<HTMLElement>('.ribbon');
const ribbonTrack = document.querySelector<HTMLElement>('.ribbon-track');
const ribbonGroups = [...document.querySelectorAll<HTMLElement>('.ribbon-group')];
if (ribbon && ribbonTrack && ribbonGroups.length === 2) {
  const originals = [...ribbonGroups[0].children].map((element) => element.cloneNode(true));
  function fillRibbon() {
    const first = ribbonGroups[0],
      second = ribbonGroups[1];
    first.replaceChildren(...originals.map((element) => element.cloneNode(true)));
    while (first.scrollWidth < ribbon!.clientWidth + 64)
      first.append(...originals.map((element) => element.cloneNode(true)));
    second.replaceChildren(...[...first.children].map((element) => element.cloneNode(true)));
    ribbonTrack!.style.setProperty(
      '--ribbon-duration',
      first.getBoundingClientRect().width / 40 + 's',
    );
  }
  void document.fonts.ready.then(fillRibbon);
  if ('ResizeObserver' in window) new ResizeObserver(fillRibbon).observe(ribbon);
}
