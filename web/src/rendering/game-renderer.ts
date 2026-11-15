import * as THREE from "three";
import { RtsCamera } from "../camera/rts-camera";

type WasmModule = typeof import("../wasm/wasm_bridge");
type SnapshotEntity = {
  id: number;
  position: { x: number; y: number; z: number };
  sprite: { kind: string; color: [number, number, number] };
  team: number;
  moving: boolean;
  attacking: boolean;
};

type Formation = "line" | "column" | "wedge";

export class GameRenderer {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  private renderer: THREE.WebGLRenderer;
  private controls: RtsCamera;
  private engine?: InstanceType<WasmModule["GameEngine"]>;
  private objects = new Map<number, THREE.Object3D>();
  private selectionRings = new Map<number, THREE.Mesh>();
  private selectedIds = new Set<number>();
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pointer = new THREE.Vector2();
  private selection: THREE.Mesh;
  private formation: Formation = "line";
  private dragStart?: { x: number; y: number; shift: boolean };
  private dragMoved = false;
  private suppressNextClick = false;
  private selectionBox = document.createElement("div");
  private onPointerDown = (event: PointerEvent) => this.beginSelectionDrag(event);
  private onPointerMove = (event: PointerEvent) => this.updateSelectionDrag(event);
  private onPointerUp = (event: PointerEvent) => this.finishSelectionDrag(event);
  private onCanvasClick = (event: MouseEvent) => this.handleCanvasClick(event);
  private onCanvasAuxClick = (event: MouseEvent) => this.handleCanvasClick(event);
  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "1") this.formation = "line";
    if (event.key === "2") this.formation = "column";
    if (event.key === "3") this.formation = "wedge";
  };

  constructor(private host: HTMLElement) {
    this.scene.background = new THREE.Color(0x9bb7bd);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    host.appendChild(this.renderer.domElement);
    this.controls = new RtsCamera(this.camera, this.renderer.domElement);

    const grid = new THREE.GridHelper(100, 100, 0x34472c, 0x526b40);
    grid.position.y = 0.015;
    this.scene.add(grid);

    this.selection = new THREE.Mesh(
      new THREE.PlaneGeometry(0.96, 0.96),
      new THREE.MeshBasicMaterial({ color: 0xffdf76, transparent: true, opacity: 0.45,
        side: THREE.DoubleSide, depthWrite: false })
    );
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.position.y = 0.04;
    this.selection.visible = false;
    this.scene.add(this.selection);

    this.selectionBox.style.cssText = "position:absolute;display:none;pointer-events:none;border:1px solid #ffe08a;background:rgba(255,224,138,.16);z-index:3;";
    host.appendChild(this.selectionBox);
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener("click", this.onCanvasClick);
    this.renderer.domElement.addEventListener("auxclick", this.onCanvasAuxClick);
    window.addEventListener("keydown", this.onKeyDown);
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  initialize = async () => {
    const wasm = await import("../wasm/wasm_bridge");
    await wasm.default();
    this.engine = new wasm.GameEngine();

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x59634b, 2));
    const sun = new THREE.DirectionalLight(0xfff0d6, 2.2);
    sun.position.set(20, 35, 10);
    sun.castShadow = true;
    this.scene.add(sun);

    const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0x718b55 }));
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);
    this.renderObstacles();
    this.syncEntities();
  };

  update(dt: number) {
    this.controls.update(dt);
    this.engine?.update(dt);
    this.syncEntities();
  }

  private renderObstacles() {
    if (!this.engine) return;
    const cells = this.engine.blocked_cells() as number[][];
    const geometry = new THREE.BoxGeometry(0.92, 0.65, 0.92);
    const material = new THREE.MeshStandardMaterial({ color: 0x77766c, roughness: 1 });
    for (const [x, z] of cells) {
      const rock = new THREE.Mesh(geometry, material);
      rock.position.set(x + 0.5, 0.32, z + 0.5);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    }
  }

  private updatePointer(event: MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private beginSelectionDrag(event: PointerEvent) {
    if (event.button !== 0 || !(event.target instanceof HTMLCanvasElement)) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.dragStart = { x: event.clientX, y: event.clientY, shift: event.shiftKey };
    this.dragMoved = false;
    this.selectionBox.style.display = "none";
    this.selectionBox.style.left = `${event.clientX - rect.left}px`;
    this.selectionBox.style.top = `${event.clientY - rect.top}px`;
    this.selectionBox.style.width = "0px";
    this.selectionBox.style.height = "0px";
  }

  private updateSelectionDrag(event: PointerEvent) {
    if (!this.dragStart) return;
    const dx = event.clientX - this.dragStart.x;
    const dy = event.clientY - this.dragStart.y;
    if (!this.dragMoved && Math.hypot(dx, dy) < 5) return;
    this.dragMoved = true;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const left = Math.min(this.dragStart.x, event.clientX) - rect.left;
    const top = Math.min(this.dragStart.y, event.clientY) - rect.top;
    this.selectionBox.style.display = "block";
    this.selectionBox.style.left = `${left}px`;
    this.selectionBox.style.top = `${top}px`;
    this.selectionBox.style.width = `${Math.abs(dx)}px`;
    this.selectionBox.style.height = `${Math.abs(dy)}px`;
  }

  private finishSelectionDrag(event: PointerEvent) {
    if (!this.dragStart) return;
    const start = this.dragStart;
    this.dragStart = undefined;
    this.selectionBox.style.display = "none";
    if (!this.dragMoved || !this.engine) return;

    this.suppressNextClick = true;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const minX = Math.min(start.x, event.clientX);
    const maxX = Math.max(start.x, event.clientX);
    const minY = Math.min(start.y, event.clientY);
    const maxY = Math.max(start.y, event.clientY);
    const entities = this.engine.snapshot() as SnapshotEntity[];
    const next = start.shift ? new Set(this.selectedIds) : new Set<number>();

    for (const entity of entities) {
      if (entity.sprite.kind !== "unit" || entity.team !== 1) continue;
      const projected = new THREE.Vector3(entity.position.x, 0.6, entity.position.z).project(this.camera);
      const screenX = rect.left + (projected.x + 1) * 0.5 * rect.width;
      const screenY = rect.top + (1 - projected.y) * 0.5 * rect.height;
      if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
        next.add(entity.id);
      }
    }
    this.selectedIds = next;
    this.syncSelectionRings();
  }

  private handleCanvasClick(event: MouseEvent) {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    if (!this.engine || (event.button !== 0 && event.button !== 2)) return;
    this.updatePointer(event);

    if (event.button === 0) {
      const unitMeshes = [...this.objects.values()]
        .filter(object => object.userData.team === 1);
      const hit = this.raycaster.intersectObjects(unitMeshes, false)[0];
      if (hit) {
        const id = Number(hit.object.userData.entityId);
        if (!event.shiftKey) this.selectedIds.clear();
        if (this.selectedIds.has(id) && event.shiftKey) this.selectedIds.delete(id);
        else this.selectedIds.add(id);
        this.syncSelectionRings();
        return;
      }

      const point = new THREE.Vector3();
      if (!this.raycaster.ray.intersectPlane(this.ground, point)) return;
      const x = Math.floor(point.x);
      const z = Math.floor(point.z);
      this.selection.position.set(x + 0.5, 0.04, z + 0.5);
      this.selection.visible = true;
      if (!event.shiftKey) {
        this.selectedIds.clear();
        this.syncSelectionRings();
      }
      return;
    }

    const enemyMeshes = [...this.objects.values()]
      .filter(object => object.userData.team === 2);
    const enemyHit = this.raycaster.intersectObjects(enemyMeshes, false)[0];
    if (enemyHit && this.selectedIds.size > 0) {
      const targetId = Number(enemyHit.object.userData.entityId);
      for (const attackerId of this.selectedIds) {
        this.engine.issue_attack(attackerId, targetId);
      }
      return;
    }

    const point = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, point)) return;
    this.issueFormationOrder(Math.floor(point.x), Math.floor(point.z));
  }

  private issueFormationOrder(goalX: number, goalZ: number) {
    if (!this.engine || this.selectedIds.size === 0) return;
    const ids = [...this.selectedIds].sort((a, b) => a - b);
    const middle = (ids.length - 1) / 2;

    ids.forEach((id, index) => {
      let dx = 0;
      let dz = 0;
      if (this.formation === "line") {
        dx = Math.round(index - middle);
      } else if (this.formation === "column") {
        dz = Math.round(index - middle);
      } else {
        // Symmetric shallow wedge: point unit first, then pairs behind it.
        const row = Math.ceil(index / 2);
        dx = index % 2 === 1 ? -row : row;
        dz = row;
      }
      this.engine!.issue_move(id, goalX + dx, goalZ + dz);
    });
  }

  private syncSelectionRings() {
    for (const [id, ring] of this.selectionRings) {
      ring.visible = this.selectedIds.has(id);
    }
  }

  private syncEntities() {
    if (!this.engine) return;
    const entities = this.engine.snapshot() as SnapshotEntity[];
    const liveIds = new Set(entities.map(entity => entity.id));
    for (const [id, object] of this.objects) {
      if (liveIds.has(id)) continue;
      this.scene.remove(object);
      this.objects.delete(id);
      this.selectedIds.delete(id);
      const ring = this.selectionRings.get(id);
      if (ring) {
        this.scene.remove(ring);
        this.selectionRings.delete(id);
      }
    }
    for (const entity of entities) {
      let object = this.objects.get(entity.id);
      if (!object) {
        const geometry = entity.sprite.kind === "castle"
          ? new THREE.BoxGeometry(2.5, 2.5, 2.5)
          : new THREE.CapsuleGeometry(0.35, 0.8, 4, 8);
        const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(...entity.sprite.color) });
        object = new THREE.Mesh(geometry, material);
        object.userData.entityId = entity.id;
        object.userData.team = entity.team;
        (object as THREE.Mesh).castShadow = true;
        this.scene.add(object);
        this.objects.set(entity.id, object);

        if (entity.sprite.kind === "unit") {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.43, 0.52, 32),
            new THREE.MeshBasicMaterial({ color: 0xffdf76, side: THREE.DoubleSide })
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.055;
          ring.visible = false;
          this.scene.add(ring);
          this.selectionRings.set(entity.id, ring);
        }
      }
      object.position.set(entity.position.x,
        entity.position.y + (entity.sprite.kind === "castle" ? 1.25 : 0.6),
        entity.position.z);
      const ring = this.selectionRings.get(entity.id);
      if (ring) {
        ring.position.x = entity.position.x;
        ring.position.z = entity.position.z;
      }
    }
  }

  render() { this.renderer.render(this.scene, this.camera); }

  private resize = () => {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  dispose() {
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.removeEventListener("click", this.onCanvasClick);
    this.renderer.domElement.removeEventListener("auxclick", this.onCanvasAuxClick);
    this.selectionBox.remove();
    this.controls.dispose();
    this.renderer.dispose();
    this.host.replaceChildren();
  }
}
