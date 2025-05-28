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
  private wasDreamboltPressed = false;
  private wasSheathePressed = false;
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

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  private setupKeyboardControls(): void {
    this.scene.actionManager = new ActionManager(this.scene);
    this.scene.onKeyboardObservable.add((kbInfo) => {
      const key = kbInfo.event.key.toUpperCase();
      const isDown = kbInfo.type === KeyboardEventTypes.KEYDOWN;

      if (Object.values(this.keyBindings).some(binding => binding.key === key)) {
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

  private executeAction(binding: KeyAction): void {
    const character = this.characterController.getCharacter();
    switch (binding.action) {
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
        if (!this.wasSpacePressed && !character.isJumping) {
          this.characterController.jump(binding.animation);
        }
        break;
      case "switchScene":
        this.game.switchScene(EnvironmentType.DESERT);
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
      case "castDreambolt":
        if (!this.characterController.isAnimationPlaying("Dreambolt")) {
          this.characterController.castDreambolt(binding.animation);
        }
        break;
      case "toggleSheathe":
        if (!this.wasSheathePressed) {
          this.characterController.toggleSheathe();
        }
        break;
    }
  }

  public update(): void {
    if (!this.isInitialized) return;

    const character = this.characterController.getCharacter();
    let isMoving = false;

    // Check if Dreambolt is playing and cancel if movement keys are pressed
    const movementActions = ["moveForward", "backPedal", "strafeLeft", "strafeRight", "moveDiagonallyRight", "moveDiagonallyLeft"];
    const isDreamboltPlaying = this.characterController.isAnimationPlaying("Dreambolt");

    // Handle jump (non-continuous action)
    if (this.keyStates[" "] && !this.wasSpacePressed && !character.isJumping) {
      const jumpBinding = this.keyBindings["SPACE"];
      this.executeAction(jumpBinding);
      this.wasSpacePressed = true;
    } else if (!this.keyStates[" "]) {
      this.wasSpacePressed = false;
    }

    // Handle castDreambolt (non-continuous action)
    if (this.keyStates["1"] && !this.wasDreamboltPressed && !isDreamboltPlaying) {
      const dreamboltBinding = this.keyBindings["1"];
      this.executeAction(dreamboltBinding);
      this.wasDreamboltPressed = true;
    } else if (!this.keyStates["1"]) {
      this.wasDreamboltPressed = false;
    }

    // Handle toggle sheathe (non-continuous action)
    if (this.keyStates["W"] && !this.wasSheathePressed) {
      const sheatheBinding = this.keyBindings["W"];
      this.executeAction(sheatheBinding);
      this.wasSheathePressed = true;
    } else if (!this.keyStates["W"]) {
      this.wasSheathePressed = false;
    }

    // Collect all active continuous actions
    const activeActions: KeyAction[] = [];
    if (this.keyStates["Z"] && this.keyStates["E"] && this.keyBindings["Z_E"]) {
      activeActions.push(this.keyBindings["Z_E"]);
    } else if (this.keyStates["Z"] && this.keyStates["A"] && this.keyBindings["Z_A"]) {
      activeActions.push(this.keyBindings["Z_A"]);
    } else {
      for (const binding of Object.values(this.keyBindings)) {
        if (binding.continuous && binding.key !== "Z+E" && binding.key !== "Z+A" && this.keyStates[binding.key]) {
          activeActions.push(binding);
        }
      }
    }

    // Check for movement actions and cancel Dreambolt if necessary
    if (isDreamboltPlaying) {
      const hasMovement = activeActions.some(binding => movementActions.includes(binding.action as string));
      if (hasMovement) {
        console.log("InputHandler: Movement detected during Dreambolt, cancelling cast");
        this.characterController.animationManager.cancelDreambolt();
      }
    }

    // Execute all active continuous actions
    for (const binding of activeActions) {
      this.executeAction(binding);
      isMoving = true;
    }

    // Idle state: only if not moving, not jumping, and not playing Dreambolt
    if (!isMoving && !this.keyStates[" "] && !character.isJumping && !this.characterController.isAnimationPlaying("Dreambolt")) {
      this.characterController.playIdleAnimation();
      if (!this.characterController.physicsController?.isJumping) {
        this.characterController.moveForward(0);
      }
    }

    // Mouse-based camera sync
    if (this.isRightMouseDown) {
      this.characterController.syncRotationWithCamera();
    }
  }
}