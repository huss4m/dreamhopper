import {
  Scene,
  ActionManager,
  KeyboardEventTypes,
  PointerEventTypes,
  Vector3
} from "@babylonjs/core";
import { CharacterController } from "./player/CharacterController";
import { Game } from "./Game";
import { EnvironmentType } from "./EnvironmentCreator";

// Defining the structure of  key action for TypeScript typing
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


export class InputHandler {
  private keyStates: { [key: string]: boolean } = {};
  private isRightMouseDown = false;
  private moveSpeed = 5;
  private rotationSpeed = 0.05;
  private wasSpacePressed = false;
  private game: Game;
  private keyBindings: { [key: string]: KeyAction } = {};
  private isInitialized = false;

  constructor(
    private scene: Scene,
    private characterController: CharacterController,
    private canvas: HTMLCanvasElement,
    game: Game
  ) {
    this.game = game;
  }

  // Async initialization to load keybindings
  public async init(): Promise<boolean> {
    try {
      const response = await fetch('./controls/keybindings.json');
      if (!response.ok) throw new Error(`Failed to load keybindings: ${response.status}`);
      this.keyBindings = (await response.json()).bindings;
      this.setupKeyboardControls();
      this.setupPointerControls();
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error loading keybindings:', error);
      return false;
    }
  }

  // Check if initialized
  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  private setupKeyboardControls(): void {
    this.scene.actionManager = new ActionManager(this.scene);
    this.scene.onKeyboardObservable.add((kbInfo) => {
      const key = kbInfo.event.key.toUpperCase();
      const isDown = kbInfo.type === KeyboardEventTypes.KEYDOWN;

      // Track state for all keys defined in keyBindings
      if (Object.values(this.keyBindings).some(binding => binding.key === key)) {
        this.keyStates[key] = isDown;

        // Execute non-continuous actions on key down
        if (isDown) {
          const binding = Object.values(this.keyBindings).find(b => b.key === key && !b.continuous);
          if (binding) {
            this.executeAction(binding);
          }
        }
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

  /*
  private setupPointerLock(): void {
    this.canvas.addEventListener("click", () => {
      this.canvas.requestPointerLock();
    });
  } */

  private executeAction(binding: KeyAction): void {
    const character = this.characterController.getCharacter();
    switch (binding.action) {
      case "moveForward":
        this.characterController.physicsController!.isDiagonal = false;
        if (!this.characterController.physicsController?.isJumping) {
          this.characterController.moveForward(this.moveSpeed);
        }
        break;
      case "backPedal":
        if (!this.characterController.physicsController?.isJumping) {
          this.characterController.backPedal(this.moveSpeed);
        }
        break;
      case "strafeLeft":
        if (!this.characterController.physicsController?.isJumping) {
          this.characterController.strafeLeft(this.moveSpeed);
        }
        break;
      case "strafeRight":
        if (!this.characterController.physicsController?.isJumping) {
          this.characterController.strafeRight(this.moveSpeed);
        }
        break;
      case "rotateLeft":
        this.characterController.rotateLeft(this.rotationSpeed);
        break;
      case "rotateRight":
        this.characterController.rotateRight(this.rotationSpeed);
        break;
      case "jump":
        if (!this.wasSpacePressed && !character.isJumping) {
          this.characterController.playAnimation("Jump", 1, 8, 95);
          this.characterController.jump();
        }
        break;
      case "switchScene":
        this.game.switchScene(EnvironmentType.DESERT);
        break;
      case "moveDiagonallyRight":
        this.characterController.physicsController!.isDiagonal = true;
        if (!this.characterController.physicsController?.isJumping) {
          this.characterController.moveDiagonallyRight(this.moveSpeed);
        }
        break;
      case "moveDiagonallyLeft":
        this.characterController.physicsController!.isDiagonal = true;
        if (!this.characterController.physicsController?.isJumping) {
          this.characterController.moveDiagonallyLeft(this.moveSpeed);
        }
        break;
    }
  }

  public update(): void {
    if (!this.isInitialized) return; // Skip update if not initialized

    const character = this.characterController.getCharacter();

    // Handle continuous actions and animations
    let isMoving = false;

    // Check diagonal movements (combined keys)
    if (this.keyStates["Z"] && this.keyStates["E"] && this.keyBindings["Z_E"]) {
      this.executeAction(this.keyBindings["Z_E"]);
      if (this.keyBindings["Z_E"].animation && !character.isJumping) {
        const { name, loop = 1, speed = 1, endFrame } = this.keyBindings["Z_E"].animation!;
        this.characterController.playAnimation(name, loop, speed, endFrame);
      }
      isMoving = true;
    } else if (this.keyStates["Z"] && this.keyStates["A"] && this.keyBindings["Z_A"]) {
      this.executeAction(this.keyBindings["Z_A"]);
      if (this.keyBindings["Z_A"].animation && !character.isJumping) {
        const { name, loop = 1, speed = 1, endFrame } = this.keyBindings["Z_A"].animation!;
        this.characterController.playAnimation(name, loop, speed, endFrame);
      }
      isMoving = true;
    } else {
      // Handle single-key continuous actions
      for (const binding of Object.values(this.keyBindings)) {
        if (binding.continuous && binding.key !== "Z+E" && binding.key !== "Z+A" && this.keyStates[binding.key]) {
          this.executeAction(binding);
          if (binding.animation && !character.isJumping) {
            const { name, loop = 1, speed = 1, endFrame } = binding.animation;
            this.characterController.playAnimation(name, loop, speed, endFrame);
          }
          isMoving = true;
        }
      }
    }

    // Handle space key state for jump
    if (this.keyStates[" "]) {
      this.wasSpacePressed = true;
    } else {
      this.wasSpacePressed = false;
    }

    // Idle state
    if (!isMoving && !this.keyStates[" "] && !character.isJumping) {
      this.characterController.playAnimation("IdleGreatSword");
      if (!this.characterController.physicsController?.isJumping) {
        this.characterController.moveForward(0); // Stops motion
      }
    }

    // Mouse-based camera sync
    if (this.isRightMouseDown) {
      this.characterController.syncRotationWithCamera();
    }
  }
}