import * as THREE from "three";

export class RtsCamera {
  private keys = new Set<string>();
  private pointerDown = false;
  private lastPointer = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private target = new THREE.Vector3(0, 0, 0);
  private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.key.toLowerCase());
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  constructor(
    private camera: THREE.PerspectiveCamera,
    private canvas: HTMLCanvasElement
  ) {
    camera.position.set(22, 25, 22);
    camera.lookAt(this.target);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("pointerdown", this.pointerStart);
    canvas.addEventListener("pointerup", this.pointerEnd);
    canvas.addEventListener("pointermove", this.pointerMove);
    canvas.addEventListener("wheel", this.wheel, { passive: false });
    canvas.addEventListener("contextmenu", this.preventMenu);
  }

  update(dt: number) {
    const rect = this.canvas.getBoundingClientRect();
    const edge = 22;
    const speed = 24 * dt * (this.keys.has("shift") ? 2 : 1);
    let dx = 0, dz = 0;

    if (this.keys.has("w") || this.keys.has("arrowup")) dz -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) dz += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) dx -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) dx += 1;

    const mouse = new THREE.Vector2(
      (this.lastPointer.x - rect.left) / rect.width,
      (this.lastPointer.y - rect.top) / rect.height
    );
    if (this.lastPointer.x > 0) {
      if (mouse.x < edge / rect.width) dx -= 1;
      if (mouse.x > 1 - edge / rect.width) dx += 1;
      if (mouse.y < edge / rect.height) dz -= 1;
      if (mouse.y > 1 - edge / rect.height) dz += 1;
    }

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
    this.target.addScaledVector(right, dx * speed);
    this.target.addScaledVector(forward, dz * speed);
    this.target.x = THREE.MathUtils.clamp(this.target.x, -45, 45);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -45, 45);
    this.camera.position.add(new THREE.Vector3(this.target.x, 0, this.target.z)
      .sub(new THREE.Vector3(this.camera.position.x - 22, 0, this.camera.position.z - 22))
      .multiplyScalar(0.0));
    this.camera.lookAt(this.target);
  }

  private pointerStart = (e: PointerEvent) => {
    if (e.button === 2) {
      this.pointerDown = true;
      this.lastPointer.set(e.clientX, e.clientY);
      this.canvas.setPointerCapture(e.pointerId);
    }
  };
  private pointerEnd = () => { this.pointerDown = false; };
  private pointerMove = (e: PointerEvent) => {
    this.lastPointer.set(e.clientX, e.clientY);
    if (this.pointerDown) {
      const deltaX = e.clientX - this.lastPointer.x;
      const deltaY = e.clientY - this.lastPointer.y;
      this.target.x -= deltaX * 0.05;
      this.target.z -= deltaY * 0.05;
    }
  };
  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    const direction = this.camera.position.clone().sub(this.target).normalize();
    const distance = THREE.MathUtils.clamp(
      this.camera.position.distanceTo(this.target) + e.deltaY * 0.025, 9, 65
    );
    this.camera.position.copy(this.target).addScaledVector(direction, distance);
  };
  private preventMenu = (e: Event) => e.preventDefault();

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointerdown", this.pointerStart);
    this.canvas.removeEventListener("pointerup", this.pointerEnd);
    this.canvas.removeEventListener("pointermove", this.pointerMove);
    this.canvas.removeEventListener("wheel", this.wheel);
    this.canvas.removeEventListener("contextmenu", this.preventMenu);
  }
}
