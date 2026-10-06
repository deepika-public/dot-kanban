// Dragging cards with Pointer Events: mouse, pen and touch (long press). The HTML5
// drag-and-drop API does not fire on touch screens, hence this small controller.

export interface DragHandlers {
  /** Cards that may be dragged. */
  cardSelector: string;
  /** Where a card may be dropped. */
  targetSelector: string;
  /** A card was picked up. */
  start(card: HTMLElement): void;
  /** The pointer moved, over `target` (null: over nothing droppable), at `y` on screen. */
  hover(card: HTMLElement, target: HTMLElement | null, y: number): void;
  drop(card: HTMLElement, target: HTMLElement | null, y: number): void;
  /** Dragging stopped without a drop (Escape, lost pointer). */
  cancel(card: HTMLElement): void;
}

const MOUSE_THRESHOLD = 5;
const TOUCH_SLOP = 8;
const LONG_PRESS = 300;
const EDGE = 48;
/** The browser's click this soon after a drop is the one ending the drag: it must not open the card. */
const CLICK_AFTER_DROP = 100;

/** Nearest ancestor that scrolls along `axis`. */
function scrollParent(el: HTMLElement | null, axis: "x" | "y"): HTMLElement | null {
  for (let e = el; e; e = e.parentElement) {
    const style = getComputedStyle(e);
    const overflow = axis === "x" ? style.overflowX : style.overflowY;
    const size = axis === "x" ? e.scrollWidth > e.clientWidth : e.scrollHeight > e.clientHeight;
    if (size && /(auto|scroll)/.test(overflow)) return e;
  }
  return null;
}

export class CardDrag {
  private card: HTMLElement | null = null;
  private ghost: HTMLElement | null = null;
  private target: HTMLElement | null = null;
  private start = { x: 0, y: 0, dx: 0, dy: 0 };
  private pointer = { x: 0, y: 0 };
  private dragging = false;
  private timer: number | null = null;
  private frame: number | null = null;
  private suppressClickUntil = 0;
  private cleanup: (() => void)[] = [];

  constructor(private readonly root: HTMLElement, private readonly handlers: DragHandlers) {}

  /** Starts listening; returns what stops it. */
  attach(): () => void {
    const down = (e: PointerEvent) => this.down(e);
    const click = (e: MouseEvent) => {
      // The browser's own click ends the gesture; a click from a script never does.
      if (!e.isTrusted || performance.now() > this.suppressClickUntil) return;
      this.suppressClickUntil = 0;
      e.stopPropagation();
      e.preventDefault();
    };
    // A touch drag must keep the page from scrolling under the finger.
    const touchmove = (e: TouchEvent) => {
      if (this.dragging) e.preventDefault();
    };
    this.root.addEventListener("pointerdown", down);
    this.root.addEventListener("click", click, true);
    this.root.addEventListener("touchmove", touchmove, { passive: false });
    return () => {
      this.root.removeEventListener("pointerdown", down);
      this.root.removeEventListener("click", click, true);
      this.root.removeEventListener("touchmove", touchmove);
      this.stop(false);
    };
  }

  get active() {
    return this.dragging;
  }

  private down(e: PointerEvent) {
    if (e.button !== 0 || this.card) return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea")) return;
    const card = target.closest<HTMLElement>(this.handlers.cardSelector);
    if (!card || !this.root.contains(card)) return;
    this.card = card;
    const rect = card.getBoundingClientRect();
    this.start = { x: e.clientX, y: e.clientY, dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    this.pointer = { x: e.clientX, y: e.clientY };

    const move = (ev: PointerEvent) => this.move(ev);
    const up = () => this.stop(true);
    const cancel = () => this.stop(false);
    const key = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && this.dragging) {
        ev.preventDefault();
        this.stop(false);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
    this.cleanup = [
      () => window.removeEventListener("pointermove", move),
      () => window.removeEventListener("pointerup", up),
      () => window.removeEventListener("pointercancel", cancel),
      () => window.removeEventListener("keydown", key, true),
    ];
    if (e.pointerType === "touch") this.timer = window.setTimeout(() => this.begin(), LONG_PRESS);
  }

  private move(e: PointerEvent) {
    this.pointer = { x: e.clientX, y: e.clientY };
    const moved = Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y);
    if (!this.dragging) {
      if (e.pointerType === "touch") {
        // Moving before the long press is a scroll, not a drag.
        if (moved > TOUCH_SLOP) this.stop(false);
        return;
      }
      if (moved < MOUSE_THRESHOLD) return;
      this.begin();
    }
    e.preventDefault();
    this.place();
  }

  private begin() {
    const card = this.card;
    if (!card) return;
    this.timer = null;
    this.dragging = true;
    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true) as HTMLElement;
    ghost.addClass("dot-kanban-ghost");
    // Outside the board: `.dot-kanban` keeps the card styled.
    ghost.addClass("dot-kanban");
    ghost.removeAttribute("id");
    ghost.setCssStyles({ width: `${rect.width}px` });
    document.body.appendChild(ghost);
    this.ghost = ghost;
    card.addClass("is-dragging");
    this.root.addClass("is-dragging");
    this.handlers.start(card);
    this.place();
    this.frame = window.requestAnimationFrame(() => this.autoScroll());
  }

  private place() {
    const { ghost, card } = this;
    if (!ghost || !card) return;
    ghost.setCssStyles({ transform: `translate(${this.pointer.x - this.start.dx}px, ${this.pointer.y - this.start.dy}px) rotate(2deg)` });
    const under = document.elementFromPoint(this.pointer.x, this.pointer.y) as HTMLElement | null;
    const target = under?.closest<HTMLElement>(this.handlers.targetSelector) ?? null;
    this.target = target && this.root.contains(target) ? target : null;
    this.handlers.hover(card, this.target, this.pointer.y);
  }

  /** Scrolls the board sideways, and the note up or down, near their edges. */
  private autoScroll() {
    if (!this.dragging) return;
    const { x, y } = this.pointer;
    const step = (distance: number) => Math.ceil((EDGE - distance) / 4);
    const horizontal = scrollParent(this.root, "x");
    if (horizontal) {
      const r = horizontal.getBoundingClientRect();
      if (x < r.left + EDGE) horizontal.scrollLeft -= step(x - r.left);
      else if (x > r.right - EDGE) horizontal.scrollLeft += step(r.right - x);
    }
    const vertical = scrollParent(this.root, "y");
    if (vertical) {
      const r = vertical.getBoundingClientRect();
      if (y < r.top + EDGE) vertical.scrollTop -= step(y - r.top);
      else if (y > r.bottom - EDGE) vertical.scrollTop += step(r.bottom - y);
    }
    this.place();
    this.frame = window.requestAnimationFrame(() => this.autoScroll());
  }

  private stop(drop: boolean) {
    if (this.timer !== null) window.clearTimeout(this.timer);
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    this.timer = this.frame = null;
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    const { card, dragging, target } = this;
    this.ghost?.remove();
    this.ghost = null;
    this.card = null;
    this.target = null;
    this.dragging = false;
    this.root.removeClass("is-dragging");
    if (!card || !dragging) return;
    card.removeClass("is-dragging");
    // The click that ends a drag must not open the card. A deadline, not a timer: Chromium
    // slows timers down in a background window, and the next real click would be lost.
    this.suppressClickUntil = performance.now() + CLICK_AFTER_DROP;
    if (drop) this.handlers.drop(card, target, this.pointer.y);
    else this.handlers.cancel(card);
  }
}
