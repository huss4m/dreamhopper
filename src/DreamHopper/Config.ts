import { Vector3, Color3 } from "@babylonjs/core";
import { PhysicsConfig, ColliderType } from "./PhysicsController";

// Scene configuration
export interface SceneConfig {
  gravity?: Vector3; // Physics gravity vector
  skyboxTexture?: string; // Path to .env file
  skyboxSize?: number; // Skybox scale
  camera?: {
    alpha?: number; // Camera rotation (radians)
    beta?: number;
    radius?: number; // Distance from target
    target?: Vector3; // Camera target
  };
}

// Environment configuration
export interface EnvironmentConfig {
  lighting?: {
    direction?: Vector3; // Light direction
    intensity?: number; // Light intensity
    position?: Vector3; // Light position
  };
  ground?: {
    modelPath?: string; // Path to ground .glb
    position?: Vector3;
    materialOverrides?: { [meshName: string]: Partial<PBRMaterialConfig> }; // Per-mesh material settings
    physics?: { [meshName: string]: PhysicsConfig }; // Per-mesh physics
  };
  objects?: Array<{
    type: "rock" | "custom"; // Extendable for other types
    position: Vector3;
    scale?: Vector3;
    physics?: PhysicsConfig;
    material?: Partial<PBRMaterialConfig>;
  }>;
}

// PBR material configuration
export interface PBRMaterialConfig {
  albedoColor: Color3;
  reflectivityColor: Color3;
  microSurface: number;
  roughness: number;
  metallic: number;
  usePhysicalLightFalloff: boolean;
  transparencyMode?: number; // PBRMaterial.PBRMATERIAL_ALPHATEST, etc.
  alphaCutOff?: number;
  environmentIntensity?: number;
}

// Example configs
export const ForestSceneConfig: SceneConfig = {
  gravity: new Vector3(0, -9.81, 0),
  skyboxTexture: "./environment/bluesky.env",
  skyboxSize: 100000,
  camera: {
    alpha: Math.PI / 2,
    beta: Math.PI / 4,
    radius: 5,
    target: new Vector3(0, 1, 0),
  },
};

export const ForestEnvironmentConfig: EnvironmentConfig = {
  lighting: {
    direction: new Vector3(-0, -1, -0.5).normalize(),
    intensity: 5.0,
    position: new Vector3(50, 100, 50),
  },
  ground: {
    modelPath: "./models/grass2.glb",
    position: new Vector3(0, 0, 0),
    materialOverrides: {
      rock: {
        albedoColor: new Color3(1, 1, 1),
        reflectivityColor: new Color3(0.7, 0.7, 0.7),
        microSurface: 0.9,
        roughness: 0.5,
        metallic: 0.2,
        usePhysicalLightFalloff: true,
      },
      bark: {
        albedoColor: new Color3(1, 1, 1),
        reflectivityColor: new Color3(0.7, 0.7, 0.7),
        microSurface: 0.9,
        roughness: 0.1,
        metallic: 0.5,
        usePhysicalLightFalloff: true,
      },
      cluster: {
        albedoColor: new Color3(1, 1, 1),
        reflectivityColor: new Color3(0.7, 0.7, 0.7),
        microSurface: 0.9,
        usePhysicalLightFalloff: true,
        transparencyMode: 2, // PBRMATERIAL_ALPHATEST
        alphaCutOff: 0.4,
        environmentIntensity: 3.6,
      },
    },
    physics: {
      bark: {
        colliderType: ColliderType.Mesh,
        colliderParams: {},
        physicsProps: { mass: 0, friction: 0.8, restitution: 0.1 },
      },
      ant01: {
        colliderType: ColliderType.Mesh,
        colliderParams: {},
        physicsProps: { mass: 0, friction: 5.0, restitution: 0 },
      },
    },
  },
  objects: [
    {
      type: "rock",
      position: new Vector3(5, 15, 5),
      scale: new Vector3(1, 1, 1),
      physics: {
        colliderType: ColliderType.Sphere,
        colliderParams: {},
        physicsProps: { mass: 1, friction: 0.8, restitution: 0.1 },
      },
      material: {
        albedoColor: new Color3(1, 1, 1),
        reflectivityColor: new Color3(0.7, 0.7, 0.7),
        microSurface: 0.9,
        roughness: 0.5,
        metallic: 0.2,
        usePhysicalLightFalloff: true,
      },
    },
  ],
};

export const DesertSceneConfig: SceneConfig = {
  gravity: new Vector3(0, -9.81, 0),
  skyboxTexture: "./environment/desert.env",
  skyboxSize: 100000,
  camera: {
    alpha: Math.PI / 2,
    beta: Math.PI / 4,
    radius: 5,
    target: new Vector3(0, 1, 0),
  },
};

export const DesertEnvironmentConfig: EnvironmentConfig = {
  lighting: {
    direction: new Vector3(-0, -1, -0.3).normalize(),
    intensity: 6.0,
    position: new Vector3(50, 100, 50),
  },
  ground: {
    modelPath: "./models/sand.glb",
    position: new Vector3(0, 0, 0),
    materialOverrides: {
      sand: {
        albedoColor: new Color3(0.9, 0.8, 0.6),
        reflectivityColor: new Color3(0.6, 0.6, 0.6),
        microSurface: 0.8,
        roughness: 0.7,
        metallic: 0.1,
        usePhysicalLightFalloff: true,
      },
    },
    physics: {
      sand: {
        colliderType: ColliderType.Mesh,
        colliderParams: {},
        physicsProps: { mass: 0, friction: 0.9, restitution: 0.05 },
      },
    },
  },
  objects: [],
};