import { Mesh } from "@babylonjs/core";

export interface Targettable {
    getId(): string;
    setTargetted(isTargetted: boolean): void;
    isTargetted: boolean;
    getMesh(): Mesh | null; // Allow null to match NPC implementation
}