/** Keyboard + mouse-orbit + touch input. */
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();   // keys pressed this frame
    this.orbitDX = 0;
    this.orbitDY = 0;
    this.zoomDelta = 0;
    this.dragging = false;
    this.enabled = true;
    this.touchMove = { x: 0, y: 0 };
    this.touchJump = false;

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    let lastX = 0, lastY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      this.dragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.orbitDX += e.clientX - lastX; this.orbitDY += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
    });
    const end = () => { this.dragging = false; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.zoomDelta += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

    this.setupTouch(canvas);
  }

  setupTouch(canvas) {
    // left half of screen: virtual joystick; right half: camera drag
    let joyId = null, camId = null, jx = 0, jy = 0, cx = 0, cy = 0;
    const stick = document.getElementById('touch-stick');
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth / 2 && joyId === null) {
          joyId = t.identifier; jx = t.clientX; jy = t.clientY;
          if (stick) { stick.style.display = 'block'; stick.style.left = jx + 'px'; stick.style.top = jy + 'px'; }
        } else if (camId === null) { camId = t.identifier; cx = t.clientX; cy = t.clientY; }
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          let dx = (t.clientX - jx) / 50, dy = (t.clientY - jy) / 50;
          const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
          this.touchMove.x = dx; this.touchMove.y = dy;
          if (stick) stick.firstElementChild.style.transform = `translate(${dx * 30}px, ${dy * 30}px)`;
        } else if (t.identifier === camId) {
          this.orbitDX += (t.clientX - cx) * 1.2; this.orbitDY += (t.clientY - cy) * 1.2;
          cx = t.clientX; cy = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const endT = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) { joyId = null; this.touchMove.x = this.touchMove.y = 0; if (stick) stick.style.display = 'none'; }
        if (t.identifier === camId) camId = null;
      }
    };
    canvas.addEventListener('touchend', endT);
    canvas.addEventListener('touchcancel', endT);
  }

  down(...ks) { return this.enabled && ks.some((k) => this.keys.has(k)); }
  hit(k) { return this.enabled && this.pressed.has(k); }

  /** Movement vector in local (forward = -y) space. */
  moveVector() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0, y = 0;
    if (this.down('w', 'arrowup')) y -= 1;
    if (this.down('s', 'arrowdown')) y += 1;
    if (this.down('a')) x -= 1;
    if (this.down('d')) x += 1;
    x += this.touchMove.x; y += this.touchMove.y;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  endFrame() {
    this.pressed.clear();
    this.orbitDX = this.orbitDY = 0;
    this.zoomDelta = 0;
    this.touchJump = false;
  }
}
