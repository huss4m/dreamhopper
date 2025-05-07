import { Observer, PointerEventTypes, Scene, Tags, Mesh, Nullable, PointerInfo } from "@babylonjs/core";
import { Targettable } from "./Targettable";

export class TargetingSystem {
  private currentTarget: Targettable | null = null;
  private targetMap: Record<string, Targettable> = {};
  private pointerObserver: Nullable<Observer<PointerInfo>> = null;

  constructor(private scene: Scene) {
    this.setupTargeting();
  }

  public registerTarget(target: Targettable): void {
    this.targetMap[target.getId()] = target;
  }

  public unregisterTarget(targetId: string): void {
    delete this.targetMap[targetId];
  }

  private setupTargeting(): void {
    this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === PointerEventTypes.POINTERDOWN && pointerInfo.event.button === 0) { // Left click
        if (pointerInfo.pickInfo?.hit && pointerInfo.pickInfo.pickedMesh) {
          let mesh = pointerInfo.pickInfo.pickedMesh;
          let targetId: string | undefined;

          // Check the picked mesh and its parents for targetID tag
          while (mesh && !targetId) {
            const tags = Tags.GetTags(mesh);
            if (tags) {
              const tagArray = tags.split(" ").filter((tag: any) => tag);
              targetId = tagArray.find((tag: string) => tag.startsWith("npcID:"))?.split(":")[1];
            }
            mesh = mesh.parent as Mesh;
          }

          if (targetId && this.targetMap[targetId]) {
            const selectedTarget = this.targetMap[targetId];
            if (this.currentTarget !== selectedTarget) {
              if (this.currentTarget) {
                this.currentTarget.setTargetted(false);
                //console.log("Untargeting target ", this.currentTarget.getId());
              }
              this.currentTarget = selectedTarget;
              this.currentTarget.setTargetted(true);
             // console.log("Targeting target ", this.currentTarget.getId());
            }
            return;
          }
        }
        // Clicked on empty space or non-target, deselect current target
        if (this.currentTarget) {
          this.currentTarget.setTargetted(false);
          //console.log("Untargeting target ", this.currentTarget.getId());
          this.currentTarget = null;
        }
      }
    });
  }

  public dispose(): void {
    if (this.pointerObserver) {
      this.scene.onPointerObservable.remove(this.pointerObserver);
      this.pointerObserver = null;
    }
    this.currentTarget = null;
    this.targetMap = {};
  }
}