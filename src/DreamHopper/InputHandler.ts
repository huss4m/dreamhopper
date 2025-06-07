import {
  Scene,
  ActionManager,
  KeyboardEventTypes,
  PointerEventTypes,
  Vector3
} from "@babylonjs/core";
import { CharacterController } from "./player/CharacterController";
import { Game } from "./Game";

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
  private isRightMouseDown = false;
  private moveSpeed = 5;
  private rotationSpeed = 0.1;
  private wasSpacePressed = false;
  private wasDreamboltPressed = false;
  private wasSheathePressed = false;
  private wasQuestDialogPressed = false;
  private wasLayoutTogglePressed = false;
  private layouts: { [key: string]: Layout } = {};
  private currentLayout = "AZERTY";
  private keyBindings: { [key: string]: KeyAction } = {};
  private isInitialized = false;
  private lastDialogTargetId: string | null = null;

  constructor(
    private scene: Scene,
    private characterController: CharacterController,
    private canvas: HTMLCanvasElement,
    private game: Game
  ) {}

  public async init(): Promise<boolean> {
    try {
      const response = await fetch('./controls/keybindings.json');
      if (!response.ok) throw new Error(`Failed to load keybindings: ${response.status}`);
      this.layouts = (await response.json()).layouts;
      // // console.log('InputHandler: Loaded layouts:', this.layouts);

      // Set default layout
      for (const [layoutName, layout] of Object.entries(this.layouts)) {
        if (layout.default) {
          this.currentLayout = layoutName;
          this.keyBindings = layout.bindings;
          break;
        }
      }
      // // console.log(`InputHandler: Set default layout to ${this.currentLayout}`);

      this.setupKeyboardControls();
      this.setupPointerControls();
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('InputHandler: Error loading keybindings:', error);
      this.keyBindings["T"] = { key: "T", action: "openQuestDialog" };
      // // console.log('InputHandler: Using fallback keybindings:', this.keyBindings);
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

      // Normalize '&' to '1' for caps lock agnostic behavior
      if (key === '&') {
        key = '1';
      }

      //// // console.log(`InputHandler: Key ${key} ${isDown ? 'down' : 'up'}`);
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
      case "openQuestDialog":
        if (!this.wasQuestDialogPressed) {
          const targetingSystem = this.game.getTargetingSystem();
          if (targetingSystem.isNPCTarget()) {
            const playerMesh = this.characterController.characterMeshLoader.getCharacterMesh();
            const npcMesh = targetingSystem.getCurrentTarget()?.getMesh();
            if (playerMesh && npcMesh) {
              const distance = Vector3.Distance(playerMesh.position, /*npcMesh.position*/ new Vector3(5,1,5));
              if (distance <= 5) {
                // console.log(`InputHandler: Toggling quest dialog for NPC (distance: ${distance.toFixed(2)} units)`);
                this.game.toggleQuestDialog();
                if (this.game.getShowQuestDialog()) {
                  this.lastDialogTargetId = targetingSystem.getCurrentTarget()?.getId() || null;
                  // console.log(`InputHandler: Dialog opened for NPC ID: ${this.lastDialogTargetId}`);
                } else {
                  this.lastDialogTargetId = null;
                  // console.log("InputHandler: Dialog closed or not opened");
                }
              } else {
                // console.log(`InputHandler: Cannot toggle quest dialog; NPC too far (distance: ${distance.toFixed(2)} units)`);
              }
            } else {
              // console.log("InputHandler: Cannot toggle quest dialog; player or NPC mesh not found");
            }
          } else {
            // console.log("InputHandler: Cannot toggle quest dialog; no NPC targeted");
          }
        }
        break;
      case "toggleLayout":
        if (!this.wasLayoutTogglePressed) {
          this.currentLayout = this.currentLayout === "AZERTY" ? "QWERTY" : "AZERTY";
          this.keyBindings = this.layouts[this.currentLayout].bindings;
          // console.log(`InputHandler: Switched to ${this.currentLayout} layout`);
        }
        break;
    }
  }

  public update(): void {
    if (!this.isInitialized) return;

    const character = this.characterController.getCharacter();
    let isMoving = false;

    const movementActions = ["moveForward", "backPedal", "strafeLeft", "strafeRight", "moveDiagonallyRight", "moveDiagonallyLeft"];
    const isDreamboltPlaying = this.characterController.isAnimationPlaying("Dreambolt");

    // Check if dialog should close
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
        // console.log("InputHandler: Closing quest dialog; NPC no longer targeted or meshes unavailable");
        this.game.toggleQuestDialog();
        this.lastDialogTargetId = null;
      } else {
        const distance = Vector3.Distance(playerMesh.position, new Vector3(5,1,5));
        if (distance > 5) {
          // console.log(`InputHandler: Closing quest dialog; player too far from NPC (distance: ${distance.toFixed(2)} units)`);
          this.game.toggleQuestDialog();
          this.lastDialogTargetId = null;
        }
      }
    }

    // Handle key actions
    if (this.keyStates[" "] && !this.wasSpacePressed && !character.isJumping) {
      const jumpBinding = this.keyBindings["SPACE"];
      if (jumpBinding) this.executeAction(jumpBinding);
      this.wasSpacePressed = true;
    } else if (!this.keyStates[" "]) {
      this.wasSpacePressed = false;
    }

    if ((this.keyStates["1"] || this.keyStates["&"]) && !this.wasDreamboltPressed && !isDreamboltPlaying) {
      const dreamboltBinding = this.keyBindings["1"] || this.keyBindings["&"];
      if (dreamboltBinding) this.executeAction(dreamboltBinding);
      this.wasDreamboltPressed = true;
    } else if (!this.keyStates["1"] && !this.keyStates["&"]) {
      this.wasDreamboltPressed = false;
    }

    if (this.currentLayout === "AZERTY" && this.keyStates["W"] && !this.wasSheathePressed) {
      const sheatheBinding = this.keyBindings["W"];
      if (sheatheBinding) this.executeAction(sheatheBinding);
      this.wasSheathePressed = true;
    } else if (!this.keyStates["W"]) {
      this.wasSheathePressed = false;
    }

    if (this.keyStates["T"] && !this.wasQuestDialogPressed) {
      // console.log("InputHandler: T key pressed, executing openQuestDialog");
      const questDialogBinding = this.keyBindings["T"];
      if (questDialogBinding) this.executeAction(questDialogBinding);
      this.wasQuestDialogPressed = true;
    } else if (!this.keyStates["T"]) {
      this.wasQuestDialogPressed = false;
    }

    if (this.keyStates["L"] && !this.wasLayoutTogglePressed) {
      const layoutToggleBinding = this.keyBindings["L"];
      if (layoutToggleBinding) this.executeAction(layoutToggleBinding);
      this.wasLayoutTogglePressed = true;
    } else if (!this.keyStates["L"]) {
      this.wasLayoutTogglePressed = false;
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

    if (isDreamboltPlaying) {
      const hasMovement = activeActions.some(binding => movementActions.includes(binding.action as string));
      if (hasMovement) {
        // console.log("InputHandler: Movement detected during Dreambolt, cancelling cast");
        this.characterController.animationManager.cancelDreambolt();
      }
    }

    for (const binding of activeActions) {
      this.executeAction(binding);
      isMoving = true;
    }

    if (!isMoving && !this.keyStates[" "] && !character.isJumping && !isDreamboltPlaying) {
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