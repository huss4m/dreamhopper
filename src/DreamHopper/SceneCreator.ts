import {
  Scene,
  Engine,
  ArcRotateCamera,
  Vector3,
  CubeTexture,
  HavokPlugin,
  HighlightLayer
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import { CharacterCameraController } from "./player/CharacterCameraController";
import { EnvironmentCreator, EnvironmentType, Environment } from "./EnvironmentCreator";

export class SceneCreator {
  private scene: Scene;
  private camera: ArcRotateCamera;
  physicsPlugin!: HavokPlugin;
  highlightLayer: HighlightLayer;
  private environmentCreator: EnvironmentCreator;
  private environment: Environment | null = null;

  constructor(engine: Engine, private canvas: HTMLCanvasElement, environmentType: EnvironmentType = EnvironmentType.FOREST) {
    this.scene = new Scene(engine);
    const cameraController = new CharacterCameraController(this.scene, canvas);
    this.camera = cameraController.getCamera();
    this.environmentCreator = new EnvironmentCreator(this.scene);
    this.highlightLayer = new HighlightLayer("highlightLayer", this.scene);
    this.initializePhysics();
    this.setupEnvironment(environmentType);
  }

  public createScene(): Scene {
    return this.scene;
  }

  public getCamera(): ArcRotateCamera {
    return this.camera;
  }

  public getShadowGenerator() {
    return this.environment?.getShadowGenerator() || null;
  }

  private async initializePhysics(): Promise<void> {
    try {
      const havokInstance = await HavokPhysics();
      this.physicsPlugin = new HavokPlugin(undefined, havokInstance);
      this.scene.enablePhysics(new Vector3(0, -9.81, 0), this.physicsPlugin);
      this.scene.collisionsEnabled = false;
    } catch (error) {
      console.error("Failed to initialize Havok physics:", error);
    }
  }

  private async setupEnvironment(environmentType: EnvironmentType): Promise<void> {
    this.environment = this.environmentCreator.createEnvironment(environmentType);
    await this.environment.create();
    
    const envTex = CubeTexture.CreateFromPrefilteredData("./environment/bluesky.env", this.scene);
    envTex.gammaSpace = false;
    envTex.rotationY = Math.PI;
    this.scene.environmentTexture = envTex;
  
    const skybox = this.scene.createDefaultSkybox(envTex, true, 100000, 0);
    if (skybox && skybox.material) {
      skybox.applyFog = false;
    }
  }
}

export { EnvironmentType };
