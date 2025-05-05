import {
    Scene,
    ActionManager,
    KeyboardEventTypes,
    PointerEventTypes,
    Vector3
  } from "@babylonjs/core";
  import { CharacterController } from "./CharacterController";
  import { AssetManager } from "./AssetManager";
  import { Character } from "./types";
  
  export class InputHandler {
    private keyStates: { [key: string]: boolean } = {};
    private isRightMouseDown = false;
    private moveSpeed = 5;
    private rotationSpeed = 0.05;
    private wasSpacePressed = false;
  
    constructor(
      private scene: Scene,
      private characterController: CharacterController,
      private canvas: HTMLCanvasElement
    ) {
      this.setupKeyboardControls();
      this.setupPointerControls();
      this.setupPointerLock();
    }
  
    private setupKeyboardControls(): void {
      this.scene.actionManager = new ActionManager(this.scene);
      this.scene.onKeyboardObservable.add((kbInfo) => {
        const key = kbInfo.event.key.toUpperCase();
        const isDown = kbInfo.type === KeyboardEventTypes.KEYDOWN;
  
        if (["Z", "S", "Q", "D", "A", "E", " "].includes(key)) {
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
    }
  
    private setupPointerLock(): void {
      this.canvas.addEventListener("click", () => {
        this.canvas.requestPointerLock();
      });
  
      
    }
  
    public update(): void {
      const character = this.characterController.getCharacter();
    
      // Jump
      if (this.keyStates[" "] && !this.wasSpacePressed && !character.isJumping) {
        this.characterController.playAnimation(1);
        console.log("Jump triggered");
      }
      this.wasSpacePressed = this.keyStates[" "];
    
      const isZ = this.keyStates["Z"];
      const isS = this.keyStates["S"];
      const isA = this.keyStates["A"];
      const isE = this.keyStates["E"];
    
      // Diagonal Movement
      if (isZ && isE) {
        this.characterController.physicsController!.isDiagonal = true;
        this.characterController.playAnimation(2);
        this.characterController.moveDiagonallyRight(this.moveSpeed);
      } else if (isZ && isA) {
        this.characterController.physicsController!.isDiagonal = true;
        this.characterController.playAnimation(2);
        this.characterController.moveDiagonallyLeft(this.moveSpeed);
      }
      // Forward / Backward / Strafing Movement
      else if (isZ) {
        this.characterController.physicsController!.isDiagonal = false;
        this.characterController.playAnimation(2);
        this.characterController.moveForward(this.moveSpeed);
      } else if (isS) {
        this.characterController.playAnimation(3);
        this.characterController.backPedal(this.moveSpeed);
      } else if (isA) {
        this.characterController.playAnimation(4);
        this.characterController.strafeLeft(this.moveSpeed);
      } else if (isE) {
        this.characterController.playAnimation(5);
        this.characterController.strafeRight(this.moveSpeed);
      }
      // Idle (no input)
      else if (!this.keyStates[" "] && !character.isJumping) {
        this.characterController.playAnimation(0);
        this.characterController.moveForward(0); // Stops motion
      }
    
      // Rotation
      if (this.keyStates["Q"]) {
        //console.log("Rotating left");
        this.characterController.rotateLeft(this.rotationSpeed);
      }
      if (this.keyStates["D"]) {
        //console.log("Rotating right");
        this.characterController.rotateRight(this.rotationSpeed);
      }
    
      // Mouse-based camera sync
      if (this.isRightMouseDown) {
        this.characterController.syncRotationWithCamera();
      }
    }
  }