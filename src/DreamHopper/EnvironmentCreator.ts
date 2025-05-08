import { Scene, CascadedShadowGenerator } from "@babylonjs/core";
import { ForestEnvironment } from "./environments/ForestEnvironment";


export enum EnvironmentType {
  FOREST = "forest",
  DESERT = "desert",
  URBAN = "urban"
}

export interface Environment {
  create(): Promise<void>;
  getShadowGenerator(): CascadedShadowGenerator | null;
}

export class EnvironmentCreator {
  constructor(private scene: Scene) {}

  public createEnvironment(type: EnvironmentType): Environment {
    switch (type) {
      case EnvironmentType.FOREST:
        return new ForestEnvironment(this.scene);

      default:
        throw new Error(`Unknown environment type: ${type}`);
    }
  }
}