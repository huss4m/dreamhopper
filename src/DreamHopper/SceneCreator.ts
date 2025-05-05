import {
  Scene,
  Engine,
  ArcRotateCamera,
  Vector3,
  CubeTexture,
  HavokPlugin
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import { CharacterCameraController } from "./CharacterCameraController";

export class SceneCreator {
  private scene: Scene;
  private camera: ArcRotateCamera;
  physicsPlugin!: HavokPlugin;

  constructor(engine: Engine, private canvas: HTMLCanvasElement) {
    this.scene = new Scene(engine);
    const cameraController = new CharacterCameraController(this.scene, canvas);
    this.camera = cameraController.getCamera();
    this.initializePhysics();
    this.setupEnvironment();
  }

  public createScene(): Scene {
    return this.scene;
  }

  public getCamera(): ArcRotateCamera {
    return this.camera;
  }

  private async initializePhysics(): Promise<void> {
    try {
      const havokInstance = await HavokPhysics();
      this.physicsPlugin = new HavokPlugin(undefined, havokInstance);
      this.scene.enablePhysics(new Vector3(0, -9.81, 0), this.physicsPlugin);
      this.scene.collisionsEnabled = false;
      console.log("Havok initialized:", this.physicsPlugin);
    } catch (error) {
      console.error("Failed to initialize Havok physics:", error);
    }
  }

  private setupEnvironment(): void {
    const envTex = CubeTexture.CreateFromPrefilteredData("./environment/bluesky.env", this.scene);
    envTex.gammaSpace = false;
    envTex.rotationY = Math.PI;
    this.scene.environmentTexture = envTex;
    this.scene.createDefaultSkybox(envTex, true, 100000, 0);
  }
}