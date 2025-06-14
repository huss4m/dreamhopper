import { Vector3 } from "@babylonjs/core";
import { PhysicsConfig } from "./EnemyPhysicsController";

export interface EnemyTypeConfig {
  type: string;
  model: string;
  maxHP: number;
  aggroRadius: number;
  attackRange: number;
  xpReward: number;
  speed: number;
  isBoss: boolean;
  animations: {
    idle: string;
    run: string;
    attack: string;
  };
  physics: PhysicsConfig;
  npcTransformation: {
    model: string;
    scaling: { x: number; y: number; z: number };
    hitbox: { height: number; width: number };
  };
  attackBolt: {
    diameter: number;
    particleMinSize: number;
    particleMaxSize: number;
    spawnOffsetScale: number;
    explosionMinSize: number;
    explosionMaxSize: number;
    explosionEmitBoxScale: number;
  };
  hitbox: { // New
    height: number;
    width: number;
    yPosition: number;
  };
}

export interface EnemyTypesConfig {
  enemyTypes: EnemyTypeConfig[];
}

export interface EnemyInstanceConfig {
  type: string;
  x: number;
  y: number;
  z: number;
}

export interface GameConfig {
  npcs: { x: number; y: number; z: number }[];
  enemies: EnemyInstanceConfig[];
  crystals: { x: number; y: number; z: number }[];
  bosses: { x: number; y: number; z: number }[];
}