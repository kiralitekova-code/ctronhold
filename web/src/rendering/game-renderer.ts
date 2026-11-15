import * as THREE from "three";
import { RtsCamera } from "../camera/rts-camera";

// wasm-pack writes the generated package to src/wasm.
type WasmModule = typeof import("../wasm/wasm_bridge");

export class GameRenderer {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  private renderer: THREE.WebGLRenderer;
  private controls: RtsCamera;
  private engine?: InstanceType<WasmModule["GameEngine"]>;
  private objects = new Map<number, THREE.Object3D>();
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pointer = new THREE.Vector2();
  private selection: THREE.Mesh;
  private routeLine?: THREE.Line;
  private onCanvasClick = (event: MouseEvent) => this.selectCell(event);

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
      new THREE.MeshBasicMaterial({
        color: 0xffdf76, transparent: true, opacity: 0.45,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.position.y = 0.04;
    this.selection.visible = false;
    this.scene.add(this.selection);

    this.renderer.domElement.addEventListener("click", this.onCanvasClick);
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

    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0x718b55 })
    );
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

  private selectCell(event: MouseEvent) {
    if (event.button !== 0 || !this.engine) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const point = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, point)) return;

    const x = Math.floor(point.x);
    const z = Math.floor(point.z);
    this.selection.position.set(x + 0.5, 0.04, z + 0.5);
    this.selection.visible = true;

    const path = this.engine.find_path(3, 2, x, z) as number[][];
    if (this.routeLine) {
      this.scene.remove(this.routeLine);
      this.routeLine.geometry.dispose();
      (this.routeLine.material as THREE.Material).dispose();
      this.routeLine = undefined;
    }
    if (path.length > 1) {
      const points = path.map(([px, pz]) => new THREE.Vector3(px + 0.5, 0.09, pz + 0.5));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      this.routeLine = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0xffd166, linewidth: 2 })
      );
      this.scene.add(this.routeLine);
    }
  }

  private syncEntities() {
    if (!this.engine) return;
    const entities = this.engine.snapshot() as Array<{
      id: number; position: { x: number; y: number; z: number };
      sprite: { kind: string; color: [number, number, number] };
    }>;
    for (const entity of entities) {
      let object = this.objects.get(entity.id);
      if (!object) {
        const geometry = entity.sprite.kind === "castle"
          ? new THREE.BoxGeometry(2.5, 2.5, 2.5)
          : new THREE.CapsuleGeometry(0.35, 0.8, 4, 8);
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(...entity.sprite.color)
        });
        object = new THREE.Mesh(geometry, material);
        (object as THREE.Mesh).castShadow = true;
        this.scene.add(object);
        this.objects.set(entity.id, object);
      }
      object.position.set(entity.position.x, entity.position.y +
        (entity.sprite.kind === "castle" ? 1.25 : 0.6), entity.position.z);
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
    this.renderer.domElement.removeEventListener("click", this.onCanvasClick);
    this.controls.dispose();
    this.renderer.dispose();
    this.host.replaceChildren();
  }
}
