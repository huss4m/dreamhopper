import {
  Scene,
  ArcRotateCamera,
  Vector3,
  ArcRotateCameraPointersInput
} from "@babylonjs/core";

export class CharacterCameraController {
  private camera: ArcRotateCamera;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.camera = this.createCamera(scene, canvas);
  }

  private createCamera(scene: Scene, canvas: HTMLCanvasElement): ArcRotateCamera {
    const target = new Vector3(0, 2, 0);
    const camera = new ArcRotateCamera(
      "arcCamera",
      Math.PI / 2, // alpha
      Math.PI / 3, // beta
      6,           // radius
      target,
      scene
    );

    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 4;
    camera.upperRadiusLimit = 10;
    camera.wheelPrecision = 15;
    camera.panningSensibility = 0;
    camera.angularSensibilityX = 250;
    camera.angularSensibilityY = 250;
    camera.inertia = 0.3;
    camera.minZ = 0.1;   
    camera.maxZ = 200; 

    const pointerInput = camera.inputs.attached["pointers"] as ArcRotateCameraPointersInput;
    pointerInput.buttons = [0, 2];

    return camera;
  }

  public getCamera(): ArcRotateCamera {
    return this.camera;
  }
}