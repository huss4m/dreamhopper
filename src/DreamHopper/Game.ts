import { ArcRotateCamera, Engine, HighlightLayer, Scene, Vector3, Observable, DirectionalLight, HemisphericLight, CascadedShadowGenerator, SceneLoader, PBRMaterial, PhysicsAggregate, PhysicsShapeType, Color3, Texture, MeshBuilder, Mesh, Color4, ParticleSystem, CubeTexture, Quaternion, Matrix, Vector2, Ray, HavokPlugin, Light, StandardMaterial, GroundBuilder, GroundMesh } from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import { CharacterController } from "./player/CharacterController";
import { InputHandler } from "./InputHandler";
import "@babylonjs/loaders";
import { AssetManager } from "./AssetManager";
import { TargetingSystem } from "./TargetingSystem";
import { GameManager } from "./GameManager";
import { SoundManager } from "./SoundManager";
import { DreamHopperLoadingScreen } from "./DreamHopperLoadingScreen";
import { Targettable } from "./Targettable";
import { CharacterAnimationManager } from "./player/CharacterAnimationManager";
import { Quest, QuestState } from "./npc/Quest";
import { NPC } from "./npc/NPC";
import { CharacterCameraController } from "./player/CharacterCameraController";

export interface SceneState {
  npcPositions?: Vector3[];
  enemyPositions?: Vector3[];
  questStates?: QuestState[];
}

export class Game {
  private engine: Engine;
  private scene: Scene;
  private camera: ArcRotateCamera;
  private characterController: CharacterController | null = null;
  private inputHandler!: InputHandler;
  private targetingSystem!: TargetingSystem;
  private assetManager!: AssetManager;
  private highlightLayer!: HighlightLayer;
  private gameManager!: GameManager;
  private soundManager: SoundManager;
  private loadingScreen: DreamHopperLoadingScreen;
  private showQuestDialog = false;
  private onQuestDialogToggled = new Observable<boolean>();
  private currentQuest: Quest | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void>;
  private groundMeshes: Mesh[] = [];
  private rock: Mesh | null = null;
  private mistSystem: ParticleSystem | null = null;
  private skybox: Mesh | null = null;
  private envTexture: CubeTexture | null = null;
  private light: DirectionalLight | null = null;
  private ambientLight: HemisphericLight | null = null;
  private shadowGenerator: CascadedShadowGenerator | null = null;
  private treeColliders: Mesh[] = [];
  public ground!: GroundMesh;

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true);
    this.soundManager = SoundManager.getInstance([
      "./music/music1.mp3",
      "./music/music2.mp3",
    ]);
    this.loadingScreen = new DreamHopperLoadingScreen(this.engine);
    this.engine.loadingScreen = this.loadingScreen;
    
    // Create single scene with forest environment
    this.scene = new Scene(this.engine);
    const cameraController = new CharacterCameraController(this.scene, canvas);
    this.camera = cameraController.getCamera();
    this.highlightLayer = new HighlightLayer("highlightLayer", this.scene);
    
    this.initializationPromise = this.initialize();

    window.addEventListener("beforeunload", () => {
      this.soundManager.dispose();
    });
  }

  private async initialize(): Promise<void> {
  try {
    this.engine.displayLoadingUI();
    const totalSteps = 6;
    let currentStep = 0;

    // Initialize AssetManager first to ensure assets are available
    this.assetManager = new AssetManager(this.scene);
    await this.assetManager.initializeFromJson("./models/assets.json");
    console.log("Game: All assets loaded.");
    currentStep++;
    this.loadingScreen.updateProgress((currentStep / totalSteps) * 100);

    // Initialize physics
    await this.initializePhysics();
    currentStep++;
    this.loadingScreen.updateProgress((currentStep / totalSteps) * 100);

    // Create forest environment (includes forest creation with preloaded assets)
    await this.createForestEnvironment();
    currentStep++;
    this.loadingScreen.updateProgress((currentStep / totalSteps) * 100);

    // Initialize other scene components
    await this.initializeSceneComponents(() => {
      currentStep++;
      this.loadingScreen.updateProgress((currentStep / totalSteps) * 100);
    });

    await this.soundManager.initialize();
    currentStep++;
    this.loadingScreen.updateProgress((currentStep / totalSteps) * 100);

    this.gameManager.getDreamCrystalManager().getOnAllCrystalsCollected().add(() => {
      console.log("Game: All DreamCrystals collected! You win!");
    });

    this.engine.runRenderLoop(() => {
      if (this.inputHandler.getIsInitialized()) {
        this.inputHandler.update();
        this.scene.render();
      }
    });

    window.addEventListener("resize", () => {
      this.engine.resize();
    });

    this.isInitialized = true;
    console.log("Game initialized");
    this.engine.hideLoadingUI();
  } catch (error) {
    console.error("Game: Initialization failed:", error);
    this.engine.hideLoadingUI();
    throw error;
  }
}

  private async initializePhysics(): Promise<void> {
    try {
      const havokInstance = await HavokPhysics();
      const physicsPlugin = new HavokPlugin(true, havokInstance);
      this.scene.enablePhysics(new Vector3(0, -9.81, 0), physicsPlugin);
      this.scene.collisionsEnabled = false;
      console.log("Havok physics initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Havok physics:", error);
    }
  }

  private async createForestEnvironment(): Promise<void> {
  // Setup lighting
  this.light = new DirectionalLight("sunLight", new Vector3(-0.5, -1, -0.5).normalize(), this.scene);
  this.light.intensityMode = Light.INTENSITYMODE_ILLUMINANCE;
  this.light.intensity = 3;
  this.light.position = new Vector3(12, 25, 12);

  this.shadowGenerator = new CascadedShadowGenerator(1024, this.light);
  this.shadowGenerator.numCascades = 1;
  this.shadowGenerator.lambda = 0.9;
  this.shadowGenerator.autoCalcDepthBounds = true;
  this.shadowGenerator.shadowMaxZ = 1000;
  this.shadowGenerator.bias = 0.0005;
  this.shadowGenerator.cascadeBlendPercentage = 0.05;
  this.shadowGenerator.penumbraDarkness = 1.0;
  this.shadowGenerator.stabilizeCascades = true;

  // Setup fog
  this.scene.fogMode = Scene.FOGMODE_EXP2;
  this.scene.fogDensity = 0.008;
  this.scene.fogColor = new Color3(0.9, 0.92, 0.95);
  this.scene.fogEnabled = true;

  // Setup skybox
  this.envTexture = CubeTexture.CreateFromPrefilteredData("./environment/bluesky.env", this.scene);
  this.envTexture.gammaSpace = false;
  this.envTexture.rotationY = Math.PI;
  this.scene.environmentTexture = this.envTexture;

  this.skybox = this.scene.createDefaultSkybox(this.envTexture, true, 100000, 0);
  if (this.skybox && this.skybox.material) {
    this.skybox.applyFog = false;
  }
  

  // Load ground mesh
  await this.loadGroundMesh();

  // Create mist particles
  this.createMistParticles();

  // Create forest (now uses preloaded asset)
  await this.createForest(800);
}

  
private async loadGroundMesh(): Promise<void> {
  try {
    // Create ground from heightmap
    const ground = GroundBuilder.CreateGroundFromHeightMap("Plane", "./HeightMap.png", {
      width: 300,
      height: 300,
      subdivisions: 150,
      minHeight: 0,
      maxHeight: 1.5,
      // optionally add updatable: false if you don't need to update
    }, this.scene);
    this.ground = ground;

    // Position ground
    ground.position = new Vector3(0, 0, 0);


    // Make it pickable and receive shadows like your original
    ground.receiveShadows = true;
    ground.isPickable = true;

    /*
    // Create and assign a simple standard material so it's visible
    const groundMat = new StandardMaterial("groundMaterial", this.scene);
    groundMat.diffuseColor = new Color3(0.5, 0.7, 0.3);  // greenish
    groundMat.specularColor = new Color3(0, 0, 0);
    ground.material = groundMat;

    */


        // Create PBR material
    const pbr = new PBRMaterial("pbr", this.scene);
    pbr.albedoTexture = new Texture(
      "./textures/grass4/diffuse.jpg",
      this.scene
    );

    pbr.bumpTexture = new Texture(
      "./textures/grass3/bump.jpg",
      this.scene
    );

    pbr.invertNormalMapX = true;
    pbr.invertNormalMapY = true;

   pbr.metallicTexture = new Texture(
      "./textures/asphalt/asphalt_ao_rough_metal.jpg",
      this.scene
    );
    

   pbr.useAmbientOcclusionFromMetallicTextureRed = true;
    pbr.useRoughnessFromMetallicTextureGreen = true;
    pbr.useMetallnessFromMetallicTextureBlue = true;
	
    
  


if (pbr.albedoTexture instanceof Texture) {
              pbr.albedoTexture.uScale = 100;
              pbr.albedoTexture.vScale = 100;
            }


           // pbr.environmentIntensity = 4;

    //groundMat.useAmbientOcclusionFromMetallicTextureRed = false;

    //pbr.environmentIntensity = 0.3;
    ground.material = pbr;
    // Store in your groundMeshes array to keep your logic consistent
    this.groundMeshes.push(ground);

    // Physics (if enabled)
    if (this.scene.isPhysicsEnabled()) {
      try {
        ground.onMeshReadyObservable.addOnce(() => {
  try {
    //ground.optimize(100);
    new PhysicsAggregate(
      ground,
      PhysicsShapeType.MESH,
      { mass: 0, restitution: 0.1, friction: 0.8 },
      this.scene
    );
  } catch (physicsError) {
    console.error(`Failed to apply physics to ${ground.name}:`, physicsError);
  }
});
      } catch (physicsError) {
        console.error(`Failed to apply physics to ${ground.name}:`, physicsError);
      }
    }

    // Add to shadow generator if exists
    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(ground);
    }

  } catch (error) {
    console.error("Error creating ground from heightmap:", error);
  }
}

  private createMistParticles(): void {
    this.mistSystem = new ParticleSystem("mist", 200, this.scene);
    this.mistSystem.particleTexture = new Texture("./Mist2.png", this.scene);
    this.mistSystem.emitter = new Vector3(0, 1, 0);
    this.mistSystem.minEmitBox = new Vector3(-50, 0.5, -50);
    this.mistSystem.maxEmitBox = new Vector3(50, 2, 50);
    this.mistSystem.minSize = 25.0;
    this.mistSystem.maxSize = 25.0;
    this.mistSystem.minLifeTime = 5.0;
    this.mistSystem.maxLifeTime = 10.0;
    this.mistSystem.emitRate = 2;
    this.mistSystem.blendMode = ParticleSystem.BLENDMODE_ADD;
    this.mistSystem.gravity = new Vector3(1, 0.8, 0);
    this.mistSystem.direction1 = new Vector3(-0.1, 0.05, -0.1);
    this.mistSystem.direction2 = new Vector3(0.1, 0.05, 0.1);
    this.mistSystem.minAngularSpeed = 0;
    this.mistSystem.maxAngularSpeed = 0.1;
    this.mistSystem.minEmitPower = 0.1;
    this.mistSystem.maxEmitPower = 0.3;
    this.mistSystem.addColorGradient(0, new Color4(1.0, 0.75, 0.85, 0.0));
    this.mistSystem.addColorGradient(0.3, new Color4(1.0, 0.75, 0.85, 0.18));
    this.mistSystem.addColorGradient(0.7, new Color4(1.0, 0.85, 0.9, 0.1));
    this.mistSystem.addColorGradient(1.0, new Color4(1.0, 0.75, 0.85, 0.0));
    this.mistSystem.start();
  }

  private async createForest(treeCount: number): Promise<void> {
  if (this.groundMeshes.length === 0) {
    console.warn("No ground mesh loaded to create forest");
    return;
  }
  const groundMesh = this.groundMeshes[0];

  // Retrieve the preloaded mapleTree asset
  const treeContainer = this.assetManager.getAssetContainer("mapleTree");
  if (!treeContainer) {
    console.error("Game: mapleTree asset not found in AssetManager");
    return;
  }

  // Access meshes directly from the asset container
  const trunkMeshes = treeContainer.meshes.filter(mesh => mesh.name.includes("Sakura_Sakura_Mat_0")) as Mesh[];
  const leavesMeshes = treeContainer.meshes.filter(mesh => mesh.name.includes("Sakura_Bark001_2K_JPG_Mat_0")) as Mesh[];

  if (trunkMeshes.length === 0 || leavesMeshes.length === 0) {
    console.warn("Could not find both trunk and leaves meshes in mapleTree asset container");
    console.log("Available meshes:", treeContainer.meshes.map(m => m.name));
    return;
  }

  // Clone meshes to avoid modifying the original assets
  const clonedTrunkMeshes = trunkMeshes.map(mesh => mesh.clone(`cloned_trunk_${mesh.name}`, null, true));
  const clonedLeavesMeshes = leavesMeshes.map(mesh => mesh.clone(`cloned_leaves_${mesh.name}`, null, true));

  // Apply material properties to leaves
  clonedLeavesMeshes.forEach(mesh => {
    if (mesh.material instanceof PBRMaterial) {
      const mat = mesh.material as PBRMaterial;
      mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
      mat.alphaCutOff = 0.3;
      mat.useAlphaFromAlbedoTexture = true;
      mat.needAlphaTesting();
      mat.forceDepthWrite = true;
      mat.separateCullingPass = true;
      mat.backFaceCulling = false;
      mat.usePhysicalLightFalloff = true;
    }
  });

  // Merge meshes for thin instancing
  const mergedTrunkMesh = Mesh.MergeMeshes(clonedTrunkMeshes, true, true, undefined, false, true);
  const mergedLeavesMesh = Mesh.MergeMeshes(clonedLeavesMeshes, true, true, undefined, false, true);

  if (!mergedTrunkMesh || !mergedLeavesMesh) {
    console.warn("Failed to merge trunk or leaves meshes");
    clonedTrunkMeshes.forEach(m => m.dispose());
    clonedLeavesMeshes.forEach(m => m.dispose());
    return;
  }

  // Dispose cloned meshes after merging
  clonedTrunkMeshes.forEach(m => m.dispose());
  clonedLeavesMeshes.forEach(m => m.dispose());

  mergedTrunkMesh.refreshBoundingInfo();
  const trunkBoundingBox = mergedTrunkMesh.getBoundingInfo().boundingBox;
  const trunkHeight = trunkBoundingBox.maximumWorld.y - trunkBoundingBox.minimumWorld.y;
  const trunkDiameter = 4;

  mergedTrunkMesh.receiveShadows = true;
  mergedLeavesMesh.receiveShadows = true;
  if (this.shadowGenerator) {
    this.shadowGenerator.addShadowCaster(mergedTrunkMesh, true);
    this.shadowGenerator.addShadowCaster(mergedLeavesMesh, true);
    this.shadowGenerator.transparencyShadow = true;
    this.shadowGenerator.blurScale = 2;
    this.shadowGenerator.blurBoxOffset = 2;
    this.shadowGenerator.useContactHardeningShadow = true;
  }

  // Poisson disk sampling for tree placement (unchanged)
  const seed = 12314584;
  const rand = this.mulberry32(seed);
  const radius = 10;
  const bounds = { minX: -200, maxX: 200, minZ: -200, maxZ: 200 };
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxZ - bounds.minZ;
  const cellSize = radius / Math.sqrt(2);
  const gridWidth = Math.ceil(width / cellSize);
  const gridHeight = Math.ceil(height / cellSize);
  const grid: (Vector2 | null)[] = new Array(gridWidth * gridHeight).fill(null);
  const active: Vector2[] = [];
  const points: Vector2[] = [];

  const isValidPoint = (point: Vector2, grid: (Vector2 | null)[], gridWidth: number, cellSize: number) => {
    const gridX = Math.floor((point.x - bounds.minX) / cellSize);
    const gridZ = Math.floor((point.y - bounds.minZ) / cellSize);
    if (gridX < 0 || gridX >= gridWidth || gridZ < 0 || gridZ >= gridHeight) return false;

    const startX = Math.max(0, gridX - 2);
    const endX = Math.min(gridWidth - 1, gridX + 2);
    const startZ = Math.max(0, gridZ - 2);
    const endZ = Math.min(gridHeight - 1, gridZ + 2);

    for (let z = startZ; z <= endZ; z++) {
      for (let x = startX; x <= endX; x++) {
        const neighbor = grid[z * gridWidth + x];
        if (neighbor && Vector2.Distance(point, neighbor) < radius) {
          return false;
        }
      }
    }
    return true;
  };

  const firstPoint = new Vector2(bounds.minX + rand() * width, bounds.minZ + rand() * height);
  points.push(firstPoint);
  active.push(firstPoint);
  const gridX = Math.floor((firstPoint.x - bounds.minX) / cellSize);
  const gridZ = Math.floor((firstPoint.y - bounds.minZ) / cellSize);
  grid[gridZ * gridWidth + gridX] = firstPoint;

  while (active.length > 0 && points.length < treeCount) {
    const idx = Math.floor(rand() * active.length);
    const point = active[idx];
    let found = false;

    for (let i = 0; i < 30; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = radius + rand() * radius;
      const newPoint = new Vector2(point.x + Math.cos(angle) * dist, point.y + Math.sin(angle) * dist);

      if (
        newPoint.x >= bounds.minX && newPoint.x <= bounds.maxX &&
        newPoint.y >= bounds.minZ && newPoint.y <= bounds.maxZ &&
        isValidPoint(newPoint, grid, gridWidth, cellSize)
      ) {
        points.push(newPoint);
        active.push(newPoint);
        const newGridX = Math.floor((newPoint.x - bounds.minX) / cellSize);
        const newGridZ = Math.floor((newPoint.y - bounds.minZ) / cellSize);
        grid[newGridZ * gridWidth + newGridX] = newPoint;
        found = true;
        if (points.length >= treeCount) break;
      }
    }

    if (!found) {
      active.splice(idx, 1);
    }
  }

  // Create thin instances for trees
  const trunkMatrices: Float32Array = new Float32Array(treeCount * 16);
  const leavesMatrices: Float32Array = new Float32Array(treeCount * 16);

  for (let i = 0; i < Math.min(points.length, treeCount); i++) {
    const point = points[i];
    const x = point.x;
    const z = point.y;

    const ray = new Ray(new Vector3(x, 100, z), Vector3.Down(), 200);
    const hit = this.scene.pickWithRay(ray, (mesh) => mesh === groundMesh);

    let position = new Vector3(x, 0, z);
    let rotation = Quaternion.Identity();

    if (hit && hit.pickedPoint && hit.getNormal) {
      position = hit.pickedPoint;
      const normal = hit.getNormal(true) || Vector3.Up();

      const up = Vector3.Up();
      if (normal.lengthSquared() > 0 && !normal.equalsWithEpsilon(up, 0.0001)) {
        const axis = Vector3.Cross(up, normal).normalize();
        const angle = Math.acos(Vector3.Dot(up, normal) / normal.length());
        if (axis.lengthSquared() > 0.0001) {
          rotation = Quaternion.RotationAxis(axis, angle);
        } else if (Vector3.Dot(up, normal) < -0.999) {
          rotation = Quaternion.RotationAxis(Vector3.Right(), Math.PI);
        }
      }
    } else {
      console.warn(`No terrain hit for tree ${i} at (${x}, ${z})`);
    }

    const randomYaw = rand() * Math.PI * 2;
    const yawRotation = Quaternion.RotationAxis(Vector3.Up(), randomYaw);
    rotation = yawRotation.multiply(rotation);

    const leafRandomTilt = Quaternion.RotationAxis(Vector3.Forward(), (rand() - 0.5) * 0.1);
    const leafRotation = leafRandomTilt.multiply(rotation);

    const scaleValue = 0.4 + rand() * (0.8 - 0.4);
    const scale = new Vector3(scaleValue, scaleValue, scaleValue);

    const trunkMatrix = Matrix.Compose(scale, rotation, position);
    const leavesMatrix = Matrix.Compose(scale, leafRotation, position);

    trunkMatrix.copyToArray(trunkMatrices, i * 16);
    leavesMatrix.copyToArray(leavesMatrices, i * 16);

    if (this.scene.isPhysicsEnabled()) {
      const collider = MeshBuilder.CreateCylinder(
        `treeCollider${i}`,
        { height: trunkHeight * scaleValue, diameter: trunkDiameter * scaleValue },
        this.scene
      );
      collider.position = position;
      collider.rotationQuaternion = rotation;
      collider.isVisible = false;
      collider.isPickable = false;

      try {
        new PhysicsAggregate(
          collider,
          PhysicsShapeType.CYLINDER,
          { mass: 0, restitution: 0.1, friction: 0.8 },
          this.scene
        );
        this.treeColliders.push(collider);
      } catch (physicsError) {
        console.error(`Failed to apply physics to tree collider ${i}:`, physicsError);
        collider.dispose();
      }
    }
  }

  mergedTrunkMesh.thinInstanceSetBuffer("matrix", trunkMatrices, 16, true);
  mergedLeavesMesh.thinInstanceSetBuffer("matrix", leavesMatrices, 16, true);

  mergedTrunkMesh.thinInstanceCount = Math.min(points.length, treeCount);
  mergedLeavesMesh.thinInstanceCount = Math.min(points.length, treeCount);

  console.log(`Created forest with ${Math.min(points.length, treeCount)} trees using thin instances and physics colliders.`);
}

  private mulberry32(seed: number) {
    return function random() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  private async initializeSceneComponents(onStepComplete: () => void): Promise<void> {
    try {
      this.assetManager = new AssetManager(this.scene);
      await this.assetManager.initializeFromJson("./models/assets.json");
      console.log("Game: All assets loaded.");
      onStepComplete();

      this.targetingSystem = new TargetingSystem(this.scene);

      if (!this.shadowGenerator) {
        throw new Error("Game: Shadow generator not initialized");
      }

      if (!this.shadowGenerator.getLight()) {
        throw new Error("Game: Shadow generator has no associated light");
      }
      console.log("Game: Shadow generator initialized with light:", this.shadowGenerator.getLight().name);

      this.gameManager = new GameManager(
        this.scene,
        this.assetManager,
        this.shadowGenerator,
        this.highlightLayer,
        this.targetingSystem,
        this
      );

      const savedState: SceneState = { npcPositions: [], enemyPositions: [], questStates: [] };
      await this.gameManager.initializeNPCs(savedState.npcPositions, savedState.questStates);
      console.log("Game: NPCs initialized");
      onStepComplete();
      await this.gameManager.initializeEnemies(savedState.enemyPositions);
      console.log("Game: Enemies initialized");
      onStepComplete();

      this.characterController = new CharacterController(
        this.scene,
        this.canvas,
        this.camera,
        this.shadowGenerator,
        this.assetManager,
        this.targetingSystem,
        this.gameManager
      );

      const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh();
      if (characterMesh) {
        console.log("Game: Player mesh name:", characterMesh.name);
        this.shadowGenerator.addShadowCaster(characterMesh, true);
        characterMesh.receiveShadows = true;
        characterMesh.checkCollisions = true;
        characterMesh.getChildMeshes().forEach(child => {
          this.shadowGenerator!.addShadowCaster(child, true);
          child.receiveShadows = true;
          child.checkCollisions = true;
        });
        console.log("Game: Character mesh added to shadow generator:", characterMesh.name);
        this.gameManager.setCharacterMesh(characterMesh);
      } else {
        console.warn("Game: Character mesh not found for shadow generator");
      }

      await this.gameManager.initializeDreamCrystals();
      console.log("Game: DreamCrystals initialized");
      onStepComplete();

      const player = this.characterController.getPlayer();
      const crystalState = this.gameManager.getDreamCrystalManager().getState();
      const totalCrystals = this.gameManager.getDreamCrystalManager().totalCrystals;
      console.log(`Game: Crystal state:`, crystalState.collected, `positions:`, crystalState.positions.length, `totalCrystals:`, totalCrystals);
      player.setTotalCrystals(totalCrystals);
      player.resetCrystalCount();
      crystalState.collected.forEach((collected, i) => {
        if (collected) {
          player.incrementCrystalCount();
          console.log(`Game: Crystal ${i} collected during initialization`);
        }
      });
      this.gameManager.getDreamCrystalManager().getOnCrystalCollectedObservable().add((index) => {
        player.incrementCrystalCount();
        console.log(`Game: Crystal ${index} collected, player crystals: ${player.getCollectedCrystals()}/${player.getTotalCrystals()}`);
      });

      if (savedState.questStates) {
        player.setQuestState(savedState.questStates);
      }

      this.inputHandler = new InputHandler(this.scene, this.characterController, this.canvas, this);
      const initSuccess = await this.inputHandler.init();
      if (!initSuccess) {
        console.warn("Game: InputHandler failed to initialize, using fallback keybindings");
      }
    } catch (error) {
      console.error("Game: Scene components initialization failed:", error);
      throw error;
    }
  }

  public getCharacterController(): CharacterController | null {
    return this.characterController;
  }

  public getAnimationTarget(): Targettable | null {
    if (!this.characterController) {
      console.warn("Game: CharacterController not initialized");
      return null;
    }
    return this.characterController.getCurrentTarget();
  }

  public getAnimationManager(): CharacterAnimationManager | null {
    if (!this.characterController) {
      console.warn("Game: CharacterController not initialized");
      return null;
    }
    return this.characterController.animationManager;
  }

  public getDreamCrystalManager() {
    if (!this.gameManager) {
      console.warn("Game: GameManager not initialized yet");
      return null;
    }
    return this.gameManager.getDreamCrystalManager();
  }

  public getGameManager(): GameManager {
    return this.gameManager;
  }

  public toggleQuestDialog(): void {
    const target = this.getAnimationTarget();
    if (target instanceof NPC) {
      const npcQuest = target.getQuest();
      if (npcQuest && this.characterController) {
        const player = this.characterController.getPlayer();
        const playerQuest = [...player.getActiveQuests(), ...player.getCompletedQuests()].find(q => q.getId() === npcQuest.getId());
        this.currentQuest = playerQuest || npcQuest;
        console.log(`Game: Set currentQuest to ${this.currentQuest.getId()}, status: ${this.currentQuest.getState().status}, playerQuest: ${playerQuest ? playerQuest.getState().status : 'none'}, npcQuest: ${npcQuest.getState().status}`);
        this.showQuestDialog = !this.showQuestDialog;
        console.log(`Game: Quest dialog toggled to ${this.showQuestDialog} for quest ${this.currentQuest.getId()}`);
        this.onQuestDialogToggled.notifyObservers(this.showQuestDialog);
        if (this.showQuestDialog) {
          target.rotateToFacePlayer();
        }
      } else {
        console.log("Game: Cannot toggle quest dialog; NPC has no quest");
        this.showQuestDialog = false;
        this.currentQuest = null;
        this.onQuestDialogToggled.notifyObservers(this.showQuestDialog);
      }
    } else {
      console.log("Game: Cannot toggle quest dialog; target is not an NPC");
      this.showQuestDialog = false;
      this.currentQuest = null;
      this.onQuestDialogToggled.notifyObservers(this.showQuestDialog);
    }
  }

  public getShowQuestDialog(): boolean {
    return this.showQuestDialog;
  }

  public getCurrentQuest(): Quest | null {
    if (this.currentQuest && this.characterController) {
      const player = this.characterController.getPlayer();
      const playerQuest = [...player.getActiveQuests(), ...player.getCompletedQuests()].find(q => q.getId() === this.currentQuest!.getId());
      if (playerQuest) {
        this.currentQuest = playerQuest;
        console.log(`Game: getCurrentQuest updated to playerQuest ${this.currentQuest.getId()}, status: ${this.currentQuest.getState().status}`);
      }
    }
    console.log(`Game: getCurrentQuest returning ${this.currentQuest?.getId() ?? "null"}, status: ${this.currentQuest?.getState().status ?? "none"}`);
    return this.currentQuest;
  }

  public getPlayerHP(): { currentHP: number; maxHP: number } {
    if (!this.characterController) {
      console.warn("Game: CharacterController not initialized");
      return { currentHP: 0, maxHP: 0 };
    }
    const player = this.characterController.getPlayer();
    return { currentHP: player.getCurrentHP(), maxHP: player.getMaxHP() };
  }

  public getOnQuestDialogToggled(): Observable<boolean> {
    return this.onQuestDialogToggled;
  }

  public getTargetingSystem(): TargetingSystem {
    return this.targetingSystem;
  }

  public handleQuestAccept(): void {
    if (this.currentQuest && this.characterController) {
      const player = this.characterController.getPlayer();
      player.acceptQuest(this.currentQuest);
      this.gameManager.getNPCs().forEach(npc => {
        if (npc.getQuest()?.getId() === this.currentQuest!.getId()) {
          const playerQuest = player.getActiveQuests().find(q => q.getId() === this.currentQuest!.getId());
          if (playerQuest) {
            npc.setQuest(playerQuest);
            console.log(`Game: Updated NPC quest ${this.currentQuest!.getId()} to status: ${playerQuest.getState().status}`);
          }
          npc.updateQuestMarker();
        }
      });
      this.currentQuest = player.getActiveQuests().find(q => q.getId() === this.currentQuest!.getId()) || this.currentQuest;
      console.log(`Game: updated currentQuest after accept to ${this.currentQuest.getId()}, status: ${this.currentQuest.getState().status}`);
      this.showQuestDialog = false;
      this.onQuestDialogToggled.notifyObservers(false);
    }
  }

  public handleQuestDeny(): void {
    this.showQuestDialog = false;
    this.onQuestDialogToggled.notifyObservers(false);
  }

  public handleQuestClose(): void {
    this.showQuestDialog = false;
    this.onQuestDialogToggled.notifyObservers(false);
  }

  public handleQuestTurnIn(): void {
    if (this.currentQuest && this.characterController) {
      const player = this.characterController.getPlayer();
      player.turnInQuest(this.currentQuest);
      this.gameManager.getNPCs().forEach(npc => {
        if (npc.getQuest()?.getId() === this.currentQuest!.getId()) {
          const playerQuest = [...player.getActiveQuests(), ...player.getCompletedQuests(), ...player.getTurnedInQuests()].find(q => q.getId() === this.currentQuest!.getId());
          if (playerQuest) {
            npc.setQuest(playerQuest);
            console.log(`Game: Updated NPC quest ${this.currentQuest!.getId()} to status: ${playerQuest.getState().status}`);
            npc.updateQuestMarker();
          }
        }
      });
      this.currentQuest = [...player.getActiveQuests(), ...player.getCompletedQuests(), ...player.getTurnedInQuests()].find(q => q.getId() === this.currentQuest!.getId()) || this.currentQuest;
      console.log(`Game: Updated currentQuest after turn-in to ${this.currentQuest!.getId()}, status: ${this.currentQuest!.getState().status}`);
      this.showQuestDialog = false;
      this.onQuestDialogToggled.notifyObservers(false);
    }
  }

  public waitForInitialization(): Promise<void> {
    return this.initializationPromise;
  }

  public dispose(): void {
    try {
      this.characterController?.dispose();
      this.gameManager?.dispose();
      this.targetingSystem?.dispose();
      this.assetManager?.dispose();
      this.soundManager.dispose();

      this.groundMeshes.forEach(mesh => {
        if (mesh.physicsBody) {
          mesh.physicsBody.dispose();
        }
        if (mesh.material) {
          mesh.material.dispose();
        }
        mesh.dispose();
      });
      this.groundMeshes = [];

      if (this.rock) {
        if (this.rock.physicsBody) {
          this.rock.physicsBody.dispose();
        }
        if (this.rock.material) {
          this.rock.material.dispose();
        }
        this.rock.dispose();
        this.rock = null;
      }

      if (this.mistSystem) {
        if (this.mistSystem.particleTexture) {
          this.mistSystem.particleTexture.dispose();
        }
        this.mistSystem.dispose();
        this.mistSystem = null;
      }

      if (this.skybox) {
        if (this.skybox.material) {
          this.skybox.material.dispose();
        }
        this.skybox.dispose();
        this.skybox = null;
      }
      if (this.envTexture) {
        this.envTexture.dispose();
        this.envTexture = null;
      }
      this.scene.environmentTexture = null;

      if (this.light) {
        this.light.dispose();
        this.light = null;
      }
      if (this.ambientLight) {
        this.ambientLight.dispose();
        this.ambientLight = null;
      }

      if (this.shadowGenerator) {
        this.shadowGenerator.dispose();
        this.shadowGenerator = null;
      }

      this.treeColliders.forEach(collider => {
        if (collider.physicsBody) {
          collider.physicsBody.dispose();
        }
        collider.dispose();
      });
      this.treeColliders = [];

      this.scene.fogEnabled = false;

      this.scene.dispose();
      this.onQuestDialogToggled.clear();
      this.engine.dispose();
      console.log("Game: Disposed");
    } catch (error) {
      console.error("Game: Dispose failed:", error);
    }
  }
}