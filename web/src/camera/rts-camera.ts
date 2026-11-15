import * as THREE from "three";

export class RtsCamera {
  private keys = new Set<string>();
  private dragging = false;
  private lastPointer = new THREE.Vector2(-1, -1);
  private target = new THREE.Vector3(0, 0, 0);
  private offset = new THREE.Vector3(22, 25, 22);

  private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.key.toLowerCase());
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  constructor(
    private camera: THREE.PerspectiveCamera,
    private canvas: HTMLCanvasElement
  ) {
    this.applyCamera();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("pointerdown", this.pointerStart);
    canvas.addEventListener("pointerup", this.pointerEnd);
    canvas.addEventListener("pointercancel", this.pointerEnd);
    canvas.addEventListener("pointermove", this.pointerMove);
    canvas.addEventListener("pointerleave", this.pointerLeave);
    canvas.addEventListener("wheel", this.wheel, { passive: false });
    canvas.addEventListener("contextmenu", this.preventMenu);
  }

  update(dt: number) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const edge = 22;
    const speed = 24 * dt * (this.keys.has("shift") ? 2 : 1);
    let dx = 0;
    let dz = 0;

    if (this.keys.has("w") || this.keys.has("arrowup")) dz -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) dz += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) dx -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) dx += 1;

    if (this.lastPointer.x >= rect.left && this.lastPointer.x <= rect.right &&
        this.lastPointer.y >= rect.top && this.lastPointer.y <= rect.bottom) {
      if (this.lastPointer.x < rect.left + edge) dx -= 1;
      if (this.lastPointer.x > rect.right - edge) dx += 1;
      if (this.lastPointer.y < rect.top + edge) dz -= 1;
      if (this.lastPointer.y > rect.bottom - edge) dz += 1;
    }

    const forward = new THREE.Vector3(-this.offset.x, 0, -this.offset.z).normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    this.target.addScaledVector(right, dx * speed);
    this.target.addScaledVector(forward, -dz * speed);
    this.target.x = THREE.MathUtils.clamp(this.target.x, -45, 45);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -45, 45);
    this.applyCamera();
  }

  private applyCamera() {
    this.camera.position.copy(this.target).add(this.offset);
    this.camera.lookAt(this.target);
  }

  private pointerStart = (e: PointerEvent) => {
    if (e.button === 2) {
      this.dragging = true;
      this.lastPointer.set(e.clientX, e.clientY);
      this.canvas.setPointerCapture(e.pointerId);
    }
  };

  private pointerEnd = () => { this.dragging = false; };

  private pointerMove = (e: PointerEvent) => {
    if (this.dragging) {
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.target.x -= dx * 0.06;
      this.target.z -= dy * 0.06;
      this.target.x = THREE.MathUtils.clamp(this.target.x, -45, 45);
      this.target.z = THREE.MathUtils.clamp(this.target.z, -45, 45);
      this.applyCamera();
    }
    this.lastPointer.set(e.clientX, e.clientY);
  };

  private pointerLeave = () => {
    if (!this.dragging) this.lastPointer.set(-1, -1);
  };

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    const distance = THREE.MathUtils.clamp(
      this.offset.length() + e.deltaY * 0.025, 9, 65
    );
    this.offset.setLength(distance);
    this.applyCamera();
  };

  private preventMenu = (e: Event) => e.preventDefault();

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointerdown", this.pointerStart);
    this.canvas.removeEventListener("pointerup", this.pointerEnd);
    this.canvas.removeEventListener("pointercancel", this.pointerEnd);
    this.canvas.removeEventListener("pointermove", this.pointerMove);
    this.canvas.removeEventListener("pointerleave", this.pointerLeave);
    this.canvas.removeEventListener("wheel", this.wheel);
    this.canvas.removeEventListener("contextmenu", this.preventMenu);
  }
}
