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

  constructor(private host: HTMLElement) {
    this.scene.background = new THREE.Color(0x9bb7bd);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    host.appendChild(this.renderer.domElement);
    this.controls = new RtsCamera(this.camera, this.renderer.domElement);
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

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0x718b55 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.syncEntities();
  };

  update(dt: number) {
    this.controls.update(dt);
    this.engine?.update(dt);
    this.syncEntities();
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
    this.controls.dispose();
    this.renderer.dispose();
    this.host.replaceChildren();
  }
}
