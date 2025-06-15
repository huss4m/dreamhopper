import { Color3, Color4, Vector3 } from "@babylonjs/core";

export interface Ability {
  id: string;
  name: string;
  type: "attack" | "support" | "movement" | "utility";
  subtype: string;
  cooldown: number;
  manaCost: number;
  animation?: {
    name: string;
    speed: number;
    loop: boolean;
  };
  effects: AbilityEffect[];
  sounds: AbilitySound[];
}

export interface AbilityEffect {
  type: "damage" | "heal" | "projectile" | "particle";
  trigger?: "onCast" | "onHit";
  target?: "self" | "enemy" | "ally" | "position";
  minBase?: number;
  maxBase?: number;
  baseAmount?: number;
  levelScaling?: number;
  speed?: number;
  size?: number;
  range?: number;
  maxAngle?: number;
  material?: {
    diffuseColor: [number, number, number];
    emissiveColor: [number, number, number];
    alpha: number;
  };
  particleSystem?: {
    texture: string;
    emitRate: number;
    minSize: number;
    maxSize: number;
    minLifeTime: number;
    maxLifeTime: number;
    color1: [number, number, number, number];
    color2: [number, number, number, number];
    colorDead: [number, number, number, number];
    blendMode: string;
    gravity?: [number, number, number];
    direction1?: [number, number, number];
    direction2?: [number, number, number];
    minAngularSpeed?: number;
    maxAngularSpeed?: number;
    minEmitPower?: number;
    maxEmitPower?: number;
    duration?: number;
  };
}

export interface AbilitySound {
  id: string;
  file: string;
  loop: boolean;
  spatial: boolean;
  volume: number;
  maxDistance: number;
}