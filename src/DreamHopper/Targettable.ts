export interface Targettable {
    getId(): string;
    setTargetted(isTargetted: boolean): void;
    isTargetted: boolean;
  }