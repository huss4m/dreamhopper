import {
  Scene,
  ActionManager,
  KeyboardEventTypes,
  PointerEventTypes,
  Vector3,
} from "@babylonjs/core";
import { CharacterController } from "./player/CharacterController";
import { Game } from "./Game";
import { CharacterAnimationManager } from "./player/CharacterAnimationManager";

interface KeyAction {
  key: string;
  action: string | { [key: string]: any };
  continuous?: boolean;
  animation?: {
    name: string;
    loop?: number;
    speed?: number;
    endFrame?: number;
  };
}

interface Layout {
  default?: boolean;
  bindings: { [key: string]: KeyAction };
}

export class InputHandler {
  private keyStates: { [key: string]: boolean } = {};
  private wasKeyPressed: { [key: string]: boolean } = {};
  private isRightMouseDown = false;
  private moveSpeed = 5;
  private rotationSpeed = 0.1;
  private layouts: { [key: string]: Layout } = {};
  private currentLayout = "AZERTY";
  private keyBindings: { [key: string]: KeyAction } = {};
  private isInitialized = false;
  private lastDialogTargetId: string | null = null;

  constructor(
    private scene: Scene,
    private characterController: CharacterController,
    private canvas: HTMLCanvasElement,
    private game: Game,
    private animationManager: CharacterAnimationManager
  ) {}

  public async init(): Promise<boolean> {
    try {
      const response = await fetch("./controls/keybindings.json");
      if (!response.ok) throw new Error(`Failed to load keybindings: ${response.status}`);
      this.layouts = (await response.json()).layouts;

      for (const [layoutName, layout] of Object.entries(this.layouts)) {
        if (layout.default) {
          this.currentLayout = layoutName;
          this.keyBindings = layout.bindings;
          break;
        }
      }

      this.setupKeyboardControls();
      this.setupPointerControls();
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("InputHandler: Error loading keybindings:", error);
      this.keyBindings["T"] = { key: "T", action: "openQuestDialog" };
      return false;
    }
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  private setupKeyboardControls(): void {
    this.scene.actionManager = new ActionManager(this.scene);
    this.scene.onKeyboardObservable.add((kbInfo) => {
      let key = kbInfo.event.key.toUpperCase();
      const isDown = kbInfo.type === KeyboardEventTypes.KEYDOWN;

      if (key === "&") key = "1";
      if (key === "É" || key === "é") key = "2";
      if (key === "\"") key = "3";
      if (key === "'") key = "4";

      if (Object.values(this.keyBindings).some((binding) => binding.key.includes(key))) {
        this.keyStates[key] = isDown;
      }
    });
  }

  private setupPointerControls(): void {
    this.scene.onPointerObservable.add((pointerInfo) => {
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN:
          if (pointerInfo.event.button === 2) {
            pointerInfo.event.preventDefault();
            this.isRightMouseDown = true;
          }
          break;
        case PointerEventTypes.POINTERUP:
          if (pointerInfo.event.button === 2) {
            pointerInfo.event.preventDefault();
            this.isRightMouseDown = false;
          }
          break;
      }
    });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private getAbilityIdFromAction(action: string): string | null {
    if (typeof action === "string" && action.startsWith("cast")) {
      return action.replace(/^cast/, "").toLowerCase();
    }
    return null;
  }

  private isAnyAbilityAnimationPlaying(): string | null {
  let playingAbilityId: string | null = null;
  this.animationManager.getAbilities().forEach((ability, abilityId) => {
    if (this.animationManager.isAnimationPlaying(ability.animation.name)) {
      playingAbilityId = abilityId;
    }
  });
  return playingAbilityId;
}

  private executeAction(binding: KeyAction): void {
    const character = this.characterController.getCharacter();
    const action = binding.action as string;
    const abilityId = this.getAbilityIdFromAction(action);

    if (abilityId) {
      const ability = this.animationManager.getAbility(abilityId);
      if (ability && !this.animationManager.isAnimationPlaying(ability.animation.name)) {
        this.characterController.castAbility(abilityId);
      }
      return;
    }

    switch (action) {
      case "moveForward":
        this.characterController.physicsController!.isDiagonal = false;
        if (!this.characterController.physicsController?.isJumping) {
          this.characterController.moveForward(this.moveSpeed, binding.animation);
        }
        break;
      case "backPedal":
        if (!this.characterController.physicsController?.isJumping) {
          this.characterController.backPedal(this.moveSpeed, binding.animation);
        }
        break;
      case "strafeLeft":
        if (!this.characterController.physicsController?.isJumping) {
          this.characterController.strafeLeft(this.moveSpeed, binding.animation);
        }
        break;
      case "strafeRight":
        if (!this.characterController.physicsController?.isJumping) {
          this.characterController.strafeRight(this.moveSpeed, binding.animation);
        }
        break;
      case "rotateLeft":
        this.characterController.rotateLeft(this.rotationSpeed);
        break;
      case "rotateRight":
        this.characterController.rotateRight(this.rotationSpeed);
        break;
      case "jump":
        if (!character.isJumping) {
          this.characterController.jump(binding.animation);
        }
        break;
      case "moveDiagonallyRight":
        this.characterController.physicsController!.isDiagonal = true;
        if (!this.characterController.physicsController?.isJumping) {
          this.characterController.moveDiagonallyRight(this.moveSpeed, binding.animation);
        }
        break;
      case "moveDiagonallyLeft":
        this.characterController.physicsController!.isDiagonal = true;
        if (!this.characterController.physicsController?.isJumping) {
          this.characterController.moveDiagonallyLeft(this.moveSpeed, binding.animation);
        }
        break;
      case "toggleSheathe":
        this.characterController.toggleSheathe();
        break;
      case "openQuestDialog": {
        const targetingSystem = this.game.getTargetingSystem();
        if (targetingSystem.isNPCTarget()) {
          const playerMesh = this.characterController.characterMeshLoader.getCharacterMesh();
          const npcMesh = targetingSystem.getCurrentTarget()?.getMesh();
          if (playerMesh && npcMesh) {
            const distance = Vector3.Distance(playerMesh.position, new Vector3(5, 1, 5));
            if (distance <= 5) {
              this.game.toggleQuestDialog();
              if (this.game.getShowQuestDialog()) {
                this.lastDialogTargetId = targetingSystem.getCurrentTarget()?.getId() || null;
              } else {
                this.lastDialogTargetId = null;
              }
            }
          }
        }
        break;
      }
      case "toggleLayout":
        this.currentLayout = this.currentLayout === "AZERTY" ? "QWERTY" : "AZERTY";
        this.keyBindings = this.layouts[this.currentLayout].bindings;
        break;
    }
  }

  public update(): void {
    if (!this.isInitialized) return;

    const character = this.characterController.getCharacter();
    let isMoving = false;
    const movementActions = [
      "moveForward",
      "backPedal",
      "strafeLeft",
      "strafeRight",
      "moveDiagonallyRight",
      "moveDiagonallyLeft",
    ];

    if (this.game.getShowQuestDialog() && this.lastDialogTargetId) {
      const targetingSystem = this.game.getTargetingSystem();
      const currentTarget = targetingSystem.getCurrentTarget();
      const playerMesh = this.characterController.characterMeshLoader.getCharacterMesh();
      const npcMesh = currentTarget?.getMesh();

      if (
        !targetingSystem.isNPCTarget() ||
        currentTarget?.getId() !== this.lastDialogTargetId ||
        !playerMesh ||
        !npcMesh
      ) {
        this.game.toggleQuestDialog();
        this.lastDialogTargetId = null;
      } else {
        const distance = Vector3.Distance(playerMesh.position, new Vector3(5, 1, 5));
        if (distance > 5) {
          this.game.toggleQuestDialog();
          this.lastDialogTargetId = null;
        }
      }
    }

    for (const [bindingKey, binding] of Object.entries(this.keyBindings)) {
      const keys = binding.key.split("+");
      const isPressed = keys.every((key) => this.keyStates[key]);
      const wasPressed = this.wasKeyPressed[bindingKey] || false;

      if (isPressed && !wasPressed) {
        const abilityId = this.getAbilityIdFromAction(binding.action as string);
        if (abilityId) {
          const ability = this.animationManager.getAbility(abilityId);
          if (binding.key === "2") {
            console.log(
              `Key 2 detected, wasPressed: ${wasPressed}, isAnimationPlaying: ${ability ? this.animationManager.isAnimationPlaying(ability.animation.name) : false}`
            );
            console.log("Fireball binding:", binding);
          }
          if (ability && !this.animationManager.isAnimationPlaying(ability.animation.name)) {
            this.executeAction(binding);
          }
        } else {
          this.executeAction(binding);
        }
        this.wasKeyPressed[bindingKey] = true;
      } else if (!isPressed) {
        this.wasKeyPressed[bindingKey] = false;
      }
    }

    const activeActions: KeyAction[] = [];
    if (this.currentLayout === "AZERTY") {
      if (this.keyStates["Z"] && this.keyStates["E"] && this.keyBindings["Z_E"]) {
        activeActions.push(this.keyBindings["Z_E"]);
      } else if (this.keyStates["Z"] && this.keyStates["A"] && this.keyBindings["Z_A"]) {
        activeActions.push(this.keyBindings["Z_A"]);
      } else {
        for (const binding of Object.values(this.keyBindings)) {
          if (binding.continuous && !["Z_E", "Z_A"].includes(binding.key) && this.keyStates[binding.key]) {
            activeActions.push(binding);
          }
        }
      }
    } else if (this.currentLayout === "QWERTY") {
      if (this.keyStates["W"] && this.keyStates["E"] && this.keyBindings["W_E"]) {
        activeActions.push(this.keyBindings["W_E"]);
      } else if (this.keyStates["W"] && this.keyStates["Q"] && this.keyBindings["W_Q"]) {
        activeActions.push(this.keyBindings["W_Q"]);
      } else {
        for (const binding of Object.values(this.keyBindings)) {
          if (binding.continuous && !["W_E", "W_Q"].includes(binding.key) && this.keyStates[binding.key]) {
            activeActions.push(binding);
          }
        }
      }
    }

    const currentAbilityPlaying = this.isAnyAbilityAnimationPlaying();
    if (currentAbilityPlaying) {
      const hasMovement = activeActions.some((binding) => movementActions.includes(binding.action as string));
      if (hasMovement) {
        console.log(`InputHandler: Movement detected during ${currentAbilityPlaying}, cancelling cast`);
        this.characterController.animationManager.cancelAbility(currentAbilityPlaying);
      }
    }

    for (const binding of activeActions) {
      this.executeAction(binding);
      isMoving = true;
    }

    if (!isMoving && !this.keyStates[" "] && !character.isJumping && !currentAbilityPlaying) {
      this.characterController.playIdleAnimation();
      if (!this.characterController.physicsController?.isJumping) {
        this.characterController.moveForward(0);
      }
    }

    if (this.isRightMouseDown) {
      this.characterController.syncRotationWithCamera();
    }
  }
}