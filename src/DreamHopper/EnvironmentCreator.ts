import { Scene, CascadedShadowGenerator } from "@babylonjs/core";
import { ForestEnvironment } from "./environments/ForestEnvironment";
import { DesertEnvironment } from "./environments/DesertEnvironment";
import { PortalEnvironment } from "./environments/PortalEnvironment";

export enum EnvironmentType {
  FOREST = "forest",
  DESERT = "desert",
  URBAN = "urban",
  PORTAL = "portal"
}

export interface Environment {
  create(): Promise<void>;
  getShadowGenerator(): CascadedShadowGenerator | null;
  dispose(): void;
}

export class EnvironmentCreator {
  constructor(private scene: Scene) {}

  public createEnvironment(type: EnvironmentType): Environment {
    switch (type) {
      case EnvironmentType.FOREST:
        return new ForestEnvironment(this.scene);
      case EnvironmentType.DESERT:
        return new DesertEnvironment(this.scene);
      case EnvironmentType.PORTAL:
        return new PortalEnvironment(this.scene);
      default:
        throw new Error(`Unknown environment type: ${type}`);
    }
  }
}