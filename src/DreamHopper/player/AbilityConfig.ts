export enum AbilityType {
  RangedProjectile = "RangedProjectile",
}

export interface ParticleSystemConfig {
  texture: string;
  minSize: number;
  maxSize: number;
  minLifeTime: number;
  maxLifeTime: number;
  emitRate: number;
  blendMode: number;
  color1: { r: number; g: number; b: number; a: number };
  color2: { r: number; g: number; b: number; a: number };
  colorDead: { r: number; g: number; b: number; a: number };
  minEmitBox?: { x: number; y: number; z: number };
  maxEmitBox?: { x: number; y: number; z: number };
  gravity?: { x: number; y: number; z: number };
  direction1?: { x: number; y: number; z: number };
  direction2?: { x: number; y: number; z: number };
  minAngularSpeed?: number;
  maxAngularSpeed?: number;
  minEmitPower?: number;
  maxEmitPower?: number;
  updateSpeed?: number;
}

export interface ProjectileConfig {
  diameter: number;
  speed: number;
  lifetime: number;
  material: {
    diffuseColor: { r: number; g: number; b: number };
    emissiveColor: { r: number; g: number; b: number };
    alpha: number;
    specularPower: number;
    backFaceCulling: boolean;
  };
}

export interface AbilitySoundConfig {
  file: string;
  volume: number;
  loop: boolean;
  spatialSound: boolean;
  maxDistance: number;
  attachToMesh: boolean;
}

export interface AbilityConfig {
  id: string;
  name: string;
  type: AbilityType;
  animation: {
    name: string;
    speed: number;
    loop: boolean;
    triggerFrame?: number;
  };
  damage: {
    min: number;
    max: number;
    levelScaling: number;
  };
  sounds?: { [key: string]: AbilitySoundConfig };
  particles?: { [key: string]: ParticleSystemConfig };
  projectile?: ProjectileConfig;
}