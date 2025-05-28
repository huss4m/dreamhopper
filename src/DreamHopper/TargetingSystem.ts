import { Observer, PointerEventTypes, Scene, Tags, Mesh, Nullable, PointerInfo, ArcRotateCamera } from "@babylonjs/core";
import { Targettable } from "./Targettable";

export class TargetingSystem {
  private currentTarget: Targettable | null = null;
  private targetMap: Record<string, Targettable> = {};
  private pointerObserver: Nullable<Observer<PointerInfo>> = null;
  private startAlpha: number | null = null;
  private startBeta: number | null = null;
  private selectedNewTarget = false;
  private readonly angleThreshold = 0.01; // Radians (~0.57 degrees)

  constructor(private scene: Scene) {
    this.setupTargeting();
  }

  public registerTarget(target: Targettable): void {
    this.targetMap[target.getId()] = target;
  }

  public unregisterTarget(targetId: string): void {
    delete this.targetMap[targetId];
  }

  public getCurrentTarget(): Targettable | null {
    return this.currentTarget;
  }

  private setupTargeting(): void {
    this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
      const camera = this.scene.activeCamera as ArcRotateCamera;

      if (pointerInfo.type === PointerEventTypes.POINTERDOWN && pointerInfo.event.button === 0) {
        // Store camera angles on click
        if (camera) {
          this.startAlpha = camera.alpha;
          this.startBeta = camera.beta;
        }
        this.selectedNewTarget = false;

        // Handle target selection
        if (pointerInfo.pickInfo?.hit && pointerInfo.pickInfo.pickedMesh) {
          let mesh = pointerInfo.pickInfo.pickedMesh;
          let targetId: string | undefined;

          // Check mesh and parents for npcID or enemyID tag
          while (mesh && !targetId) {
            const tags = Tags.GetTags(mesh);
            if (tags) {
              const tagArray = tags.split(" ").filter((tag: any) => tag);
              targetId = tagArray.find((tag: string) =>
                tag.startsWith("npcID:") || tag.startsWith("enemyID:")
              )?.split(":")[1];
            }
            mesh = mesh.parent as Mesh;
          }

          if (targetId && this.targetMap[targetId]) {
            const selectedTarget = this.targetMap[targetId];
            if (this.currentTarget !== selectedTarget) {
              if (this.currentTarget) {
                this.currentTarget.setTargetted(false);
                console.log("TargetingSystem: Untargeting target", this.currentTarget.getId());
              }
              this.currentTarget = selectedTarget;
              this.currentTarget.setTargetted(true);
              console.log("TargetingSystem: Targeting target", this.currentTarget.getId());
              this.selectedNewTarget = true;
            }
            return;
          }
        }
        // No untargeting on POINTERDOWN; wait for POINTERUP
      } else if (pointerInfo.type === PointerEventTypes.POINTERUP && pointerInfo.event.button === 0) {
        // Handle untargeting on release
        if (!this.selectedNewTarget && this.currentTarget && camera) {
          const deltaAlpha = this.startAlpha !== null ? Math.abs(camera.alpha - this.startAlpha) : 0;
          const deltaBeta = this.startBeta !== null ? Math.abs(camera.beta - this.startBeta) : 0;

          // Untarget only if camera didn't pan significantly
          if (deltaAlpha < this.angleThreshold && deltaBeta < this.angleThreshold) {
            this.currentTarget.setTargetted(false);
            console.log("TargetingSystem: Untargeting target due to click without panning", this.currentTarget.getId());
            this.currentTarget = null;
          }
        }
        // Reset state
        this.startAlpha = null;
        this.startBeta = null;
        this.selectedNewTarget = false;
      }
    });
  }

  public dispose(): void {
    if (this.pointerObserver) {
      this.scene.onPointerObservable.remove(this.pointerObserver);
      this.pointerObserver = null;
    }
    if (this.currentTarget) {
      this.currentTarget.setTargetted(false);
      this.currentTarget = null;
    }
    this.targetMap = {};
    this.startAlpha = null;
    this.startBeta = null;
    this.selectedNewTarget = false;
  }
}