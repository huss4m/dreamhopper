import {
  Scene,
  Engine,
  FreeCamera,
  Vector3,
  CubeTexture,
  SceneLoader,
  MeshBuilder,
  StandardMaterial,
  Color3,
  HemisphericLight,
  ArcRotateCamera,
  ActionManager,
  ExecuteCodeAction,
  AnimationGroup,
  KeyboardEventTypes,
  PointerEventTypes,
  ArcRotateCameraPointersInput,
  VertexData,
  Mesh,
  ShadowGenerator,
  DirectionalLight,
  CascadedShadowGenerator
} from "@babylonjs/core";
import "@babylonjs/loaders";


class SimpleNoise {
  noise2D(x: number, y: number): number {
    const n = Math.sin(x * 0.1 + Math.cos(y * 0.2)) * 43758.5453;
    const value = (n - Math.floor(n)) * 2 - 1; // Normalize to [-1, 1]
    console.log(`Noise2D(${x}, ${y}) = ${value}`); // Debug output
    return value;
  }
}

export class CharacterAnimations {
  scene: Scene;
  engine: Engine;
  thirdPersonCamera!: ArcRotateCamera;
  private isRightMouseDown = false;

  private keyStates: { [key: string]: boolean } = {};
  private animationGroups: AnimationGroup[] = [];
  private currentAnimationIndex = -1;
  characterMesh: any;
  childMesh: any;
  helmet: any;
  colliderBox: any;

  private light!: DirectionalLight;

  private isJumping = false;
  terrainMesh: any;
  shadowGenerator!: CascadedShadowGenerator;

  constructor(private canvas: HTMLCanvasElement) {
      this.engine = new Engine(this.canvas, true);
      this.scene = this.CreateScene();
      this.CreateEnvironment();

      //this.createProceduralTerrain();

      this.CreateCharacter();
      const moveSpeed = 0.05;
      // Initialize ActionManager for keyboard input
      this.scene.actionManager = new ActionManager(this.scene);
      this.setupKeyboardControls();


      this.shadowGenerator = new CascadedShadowGenerator(2048, this.light);

      this.shadowGenerator.numCascades = 4; 
      this.shadowGenerator.lambda = 0.9;
      this.shadowGenerator.autoCalcDepthBounds = true;
      
      this.shadowGenerator.shadowMaxZ = 100;
    
      this.shadowGenerator.bias = 0.001;
      this.shadowGenerator.cascadeBlendPercentage = 0.05;
      this.shadowGenerator.penumbraDarkness = 0.7;

      this.shadowGenerator.stabilizeCascades = true;

    //  this.shadowGenerator!.getShadowMap()!.renderList!.push(this.childMesh);
    //  this.shadowGenerator!.getShadowMap()!.renderList!.push(this.helmet);

      //this.shadowGenerator.addShadowCaster(this.characterMesh);

      this.scene.collisionsEnabled = true;
      // Request pointer lock when clicking on the canvas
      this.canvas.addEventListener("click", () => {
        this.canvas.requestPointerLock();
    });

    
    // Pointer Lock change listener
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === this.canvas) {
          console.log("Pointer lock engaged");
      } else {
          console.log("Pointer lock disengaged");
      }
  });


  
      const rotationSpeed = 0.05;
      this.engine.runRenderLoop(() => {
          if (this.characterMesh) {

         





              if (this.keyStates["Z"]) {
                  this.playAnimation(2); // walk

                  const forward = new Vector3(
                    Math.sin(this.colliderBox.rotation.y),
                    0,
                    Math.cos(this.colliderBox.rotation.y)
                );
                this.colliderBox.moveWithCollisions(forward.scale(-2*moveSpeed));


              } else if (this.keyStates["S"]) {
                  this.playAnimation(3); // backpedal

                  const forward = new Vector3(
                    Math.sin(this.colliderBox.rotation.y),
                    0,
                    Math.cos(this.colliderBox.rotation.y)
                );
                this.colliderBox.moveWithCollisions(forward.scale(moveSpeed));
              } 
              else if (this.keyStates["A"]) {
                this.playAnimation(4); // StrafeLeft
                const left = new Vector3(
                    -Math.cos(this.colliderBox.rotation.y),
                    0,
                    Math.sin(this.colliderBox.rotation.y)
                );
                this.colliderBox.moveWithCollisions(left.scale(-1.5*moveSpeed)); // Move left (negative scale for left)
              }
              else if (this.keyStates["E"]) {
                this.playAnimation(5); // StrafeRight
                const right = new Vector3(
                    Math.cos(this.colliderBox.rotation.y),
                    0,
                    -Math.sin(this.colliderBox.rotation.y)
                );
                this.colliderBox.moveWithCollisions(right.scale(-1.5*moveSpeed)); // Move right

  
          } 

          else if (this.keyStates[" "] /* && this.currentAnimationIndex !== 1 */) {
            this.playAnimation(1); // Jump animation (non-looping)
            // Optionally add vertical movement for jump
            //this.colliderBox.position.y += 0.1; // Adjust for jump height
        }
              
              else {
                  this.playAnimation(0); // idle
              }

              if (this.keyStates["Q"]) {
                  this.colliderBox.rotation.y += rotationSpeed;
                  console.log("Q");
              }

              if (this.keyStates["D"]) {
                  this.colliderBox.rotation.y -= rotationSpeed;
                  console.log("D");
              }
          }

         // update collider rotation based on camera alpha while right-click is held
        if (this.characterMesh && this.isRightMouseDown) {
              this.colliderBox.rotation.y = -this.thirdPersonCamera.alpha+Math.PI/2; // sync with camera's alpha rotation
          }











          

          this.scene.render();
      });

      this.scene.onPointerObservable.add((pointerInfo) => {
          switch (pointerInfo.type) {
              case PointerEventTypes.POINTERDOWN:
                  if (pointerInfo.event.button === 2) { // right mouse button
                      pointerInfo.event.preventDefault(); // Prevent context menu
                      this.isRightMouseDown = true;
                      // Request pointer lock with browser prefixes
                      
                    //  console.log("Right mouse down, isRightMouseDown:", this.isRightMouseDown, "requesting pointer lock");
                  }
                  break;

              case PointerEventTypes.POINTERUP:
                  if (pointerInfo.event.button === 2) {
                      pointerInfo.event.preventDefault(); // Prevent context menu
                      this.isRightMouseDown = false;
                     
                     // console.log("Right mouse up, isRightMouseDown:", this.isRightMouseDown, "exiting pointer lock");
                  }
                  break;
          }
      });

      // Debug pointer lock status
      document.addEventListener("pointerlockchange", () => {
          if (document.pointerLockElement === this.canvas) {
              console.log("Pointer lock engaged");
          } else {
              console.log("Pointer lock disengaged");
          }
      });

      // Mousemove listener on document with capture option
      document.addEventListener("mousemove", (event) => {
          //console.log("Mouse move event fired, movementX:", event.movementX, "isRightMouseDown:", this.isRightMouseDown, "pointerLockElement:", document.pointerLockElement === this.canvas); 
          if (this.isRightMouseDown && this.colliderBox && document.pointerLockElement === this.canvas) {
             // console.log("Processing movement, movementX:", event.movementX, "colliderBox exists:", !!this.colliderBox); 
              const rotationSpeed = 0.002;
              const deltaYaw = event.movementX * rotationSpeed; 
              this.colliderBox.rotation.y += deltaYaw;

              // Log mouse movement direction
              if (event.movementX > 0) {
                 // console.log("Turning left");
              } else if (event.movementX < 0) {
                  //console.log("Turning right");
              }
          } else {
              //console.log("Conditions not met: isRightMouseDown:", this.isRightMouseDown, "colliderBox exists:", !!this.colliderBox, "pointerLockElement:", document.pointerLockElement === this.canvas); // Debug: why conditions fail
          }
      }, { capture: true });
  }

  CreateScene(): Scene {
      const scene = new Scene(this.engine);

      const envTex = CubeTexture.CreateFromPrefilteredData(
          "./environment/sky.env",
          scene
      );

      envTex.gammaSpace = false;
      envTex.rotationY = Math.PI / 2;
      scene.environmentTexture = envTex;
      scene.createDefaultSkybox(envTex, true, 100, 0.25);

      // TEMP placeholder target until character is loaded
      const target = new Vector3(0, 1, 0);

      this.thirdPersonCamera = new ArcRotateCamera(
          "arcCamera",
          Math.PI / 2, // alpha (left/right rotation)
          Math.PI / 3, // beta (up/down angle)
          6,           // radius (distance from target)
          target,
          scene
      );

      this.thirdPersonCamera.attachControl(this.canvas, true);
      this.thirdPersonCamera.lowerRadiusLimit = 4;
      this.thirdPersonCamera.upperRadiusLimit = 10;
      this.thirdPersonCamera.wheelPrecision = 30; // optional: slower zoom
      this.thirdPersonCamera.panningSensibility = 0; // disable panning
    
      this.thirdPersonCamera.angularSensibilityX = 250; // lower value = more sensitive
      this.thirdPersonCamera.angularSensibilityY = 250;

      //this.thirdPersonCamera.checkCollisions = true;

      this.thirdPersonCamera.inertia = 0.3;

      const pointerInput = this.thirdPersonCamera.inputs.attached["pointers"] as ArcRotateCameraPointersInput;
      pointerInput.buttons = [0, 2];

      return scene;
  }

  async CreateEnvironment(): Promise<void> {

     // Create a directional light to simulate sunlight
     const sunLight = new DirectionalLight("sunLight", new Vector3(0, -1, -0.5), this.scene);
     sunLight.intensity = 3; // Sunlight intensity (adjust as needed)
 
     // Enable shadow generation for the light


 
  
     // Set the light's position to simulate the sun (you can adjust the position for different effects)
     sunLight.position = new Vector3(10, 100, -10); // Adjust position for sunlight angle

     this.light = sunLight;
   const result = await SceneLoader.ImportMeshAsync("", "./models/", "grass.glb", this.scene);

    result.meshes.forEach(mesh => {
        mesh.checkCollisions = true;
        //mesh.receiveShadows = true;

        this.shadowGenerator.addShadowCaster(mesh);
        mesh.receiveShadows = true; 

        console.log(mesh.name);
     
          mesh.scaling.x = 1;  // Example: double size on X
          mesh.scaling.z = 1;  // Example: double size on Y
          // mesh.scaling.z = 1; // Leave Z as-is or modify if needed
      
    }); 

    //const hemiLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), this.scene);
    //hemiLight.intensity = 0.5;


    
}

  async CreateCharacter(): Promise<void> {
      try {
          const { meshes, animationGroups } = await SceneLoader.ImportMeshAsync(
              "",
              "./models/",
              "guy2.glb",
              this.scene
          );

          this.characterMesh = meshes[0];
          this.helmet = meshes[1];
          this.childMesh = meshes[2];
          this.characterMesh.rotate(Vector3.Up(), Math.PI);

          this.animationGroups = animationGroups;

          // Play idle animation by default
          this.playAnimation(0);

   // Ensure the character casts shadows
          this.shadowGenerator.addShadowCaster(meshes[0]);

          // Set up jump animation end detection
        this.animationGroups[1].onAnimationGroupEndObservable.add(() => {
          this.isJumping = false;
       
          console.log("Jump animation ended, isJumping set to false");
      });

          const colliderBox = MeshBuilder.CreateBox("collider", {
              width: 1,
              height: 2,
              depth: 1
          }, this.scene);

          colliderBox.position = new Vector3(0, 1, 0); // adjust as needed

          const colliderMat = new StandardMaterial("colliderMat", this.scene);
          colliderMat.alpha = 0.1;
          colliderMat.diffuseColor = new Color3(0, 1, 0); // green, semi-transparent
          colliderBox.material = colliderMat;
          this.colliderBox = colliderBox;
          console.log("ColliderBox created"); // Debug: confirm colliderBox creation

          this.characterMesh.setParent(colliderBox);

          console.log(this.characterMesh.position);

          this.scene.collisionsEnabled = true;

this.colliderBox.checkCollisions = true;
this.colliderBox.ellipsoid = new Vector3(0.5, 1, 0.5); // Size of collision body
this.colliderBox.ellipsoidOffset = new Vector3(0, 1, 0); // Offset if needed (adjust to center it on your character)

          // Update camera target to follow collider box
          this.thirdPersonCamera.setTarget(this.colliderBox);
      } catch (error) {
          console.error("Failed to load guy.glb:", error);
      }
  }

  private playAnimation(index: number): void {
      if (index === this.currentAnimationIndex) return;

      // Stop all animations first
      this.animationGroups.forEach(group => group.stop());

      this.animationGroups[index].play(true); // loop
      this.currentAnimationIndex = index;
  }

  setupKeyboardControls(): void {
    this.scene.onKeyboardObservable.add((kbInfo) => {
        const key = kbInfo.event.key.toUpperCase();
        const isDown = kbInfo.type === KeyboardEventTypes.KEYDOWN;

        // Track continuous key states for movement and rotation
        if (["Z", "S", "Q", "D", "A", "E"].includes(key)) {
            this.keyStates[key] = isDown;
        }

        // Trigger jump on spacebar keydown only
        if (key === " " && isDown && !this.isJumping) {
            this.playAnimation(1); // Jump animation (non-looping)
          
      
            console.log("Spacebar pressed, jump triggered");
        }
    });
}




createProceduralTerrain(): void {
  const width = 100;
  const depth = 100;
  const scale = 5; // Controls noise frequency
  const heightScale = 50; // Exaggerated height for visibility
  const subdivisions = 100; // Ensure enough detail

  console.log("Creating procedural terrain...");

  // Create ground mesh with high subdivisions
  const terrain = MeshBuilder.CreateGround(
    "terrain",
    { width: width, height: depth, subdivisions: subdivisions },
    this.scene
  );

 

  // Apply a material
  const terrainMaterial = new StandardMaterial("terrainMat", this.scene);
  terrainMaterial.diffuseColor = new Color3(0.94, 0.78, 0.53);
  //terrainMaterial.wireframe = true; // Wireframe to visualize mesh
  terrain.material = terrainMaterial;

  // Enable collisions
  terrain.checkCollisions = true;

  //terrain.receiveShadows = true;
  this.terrainMesh = terrain;

  console.log("Terrain created at position:", terrain.position);
}


}