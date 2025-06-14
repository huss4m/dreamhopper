import { ArcRotateCamera, Engine, HighlightLayer, Scene, Vector3, Observable, DirectionalLight, HemisphericLight, CascadedShadowGenerator, SceneLoader, PBRMaterial, PhysicsAggregate, PhysicsShapeType, Color3, Texture, MeshBuilder, Mesh, Color4, ParticleSystem, CubeTexture, Quaternion, Matrix, Vector2, Ray, HavokPlugin, Light, StandardMaterial, GroundBuilder, GroundMesh, VolumetricLightScatteringPostProcess, GizmoManager, ShaderMaterial, Material, Effect, DefaultRenderingPipeline, ColorGradingTexture, ColorCurves, Tags, IDisposable } from "@babylonjs/core";
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
import { RecastJSPlugin } from "@babylonjs/core";
import Recast from "recast-detour";
import { Enemy } from "./enemy/Enemy";
//import { BossEnemy } from "./enemy/BossEnemy";
//import { Inspector } from "@babylonjs/inspector"


export interface SceneState {
  npcPositions?: Vector3[];
  enemyPositions?: Vector3[];
  bossPositions?: Vector3[];
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
  public gameManager!: GameManager;
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
  private boundaryWalls: Mesh[] = [];
  

  private navigationPlugin: RecastJSPlugin | null = null;
  private crowd: any | null = null; // Will hold the crowd instance
  observedEnemies  = new Set();
    

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { audioEngine: true });
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

 


/*
     
Inspector.Show(this.scene, {
    embedMode: true, 
  });
*/ 

  }
private async initialize(): Promise<void> {
  try {
    this.engine.displayLoadingUI();
    const totalSteps = 6;
    let currentStep = 0;


    this.assetManager = new AssetManager(this.scene);

    await this.assetManager.initializeFromJson("./models/assets.json", (percent) => {

      const stepProgress = (percent / 100) * (1 / totalSteps) * 100;
      this.loadingScreen.updateProgress(stepProgress);
      
    });
    currentStep++;
    this.loadingScreen.updateProgress((currentStep / totalSteps) * 100);


    await this.initializePhysics();
    currentStep++;
    this.loadingScreen.updateProgress((currentStep / totalSteps) * 100);


    await this.createForestEnvironment();
    currentStep++;
    this.loadingScreen.updateProgress((currentStep / totalSteps) * 100);


    await this.initializeNavigation();
    currentStep++;
    this.loadingScreen.updateProgress((currentStep / totalSteps) * 100);


    await this.soundManager.initialize();

    
    await this.initializeSceneComponents(() => {
      currentStep++;
      this.loadingScreen.updateProgress((currentStep / totalSteps) * 100);
    });

    // Scene ready callback
    this.gameManager.getDreamCrystalManager().getOnAllCrystalsCollected().add(() => {
      // Game win logic
    });

    this.isInitialized = true;


  
    this.engine.hideLoadingUI();
    this.engine.runRenderLoop(() => {
      if (this.inputHandler.getIsInitialized()) {
        this.inputHandler.update();
        this.scene.render();
      }
    });

    window.addEventListener("resize", () => this.engine.resize());

    

    
  } catch (error) {
    console.error("Game: Initialization failed:", error);
   // this.engine.hideLoadingUI();
    throw error;
  }
}



  private async initializePhysics(): Promise<void> {
    try {
      const havokInstance = await HavokPhysics();
      const physicsPlugin = new HavokPlugin(true, havokInstance);
      this.scene.enablePhysics(new Vector3(0, -9.81, 0), physicsPlugin);
      this.scene.collisionsEnabled = false;
      // console.log("Havok physics initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Havok physics:", error);
    }
  }

  private async createForestEnvironment(): Promise<void> {
  // Setup lighting
  this.light = new DirectionalLight("sunLight", new Vector3(-0.5, -1, -0.5).normalize(), this.scene);
  this.light.intensityMode = Light.INTENSITYMODE_ILLUMINANCE;
  this.light.intensity = 1;
  this.light.position = new Vector3(12, 25, 12);

  this.shadowGenerator = new CascadedShadowGenerator(1024, this.light);
  this.shadowGenerator.numCascades = 1;
  this.shadowGenerator.lambda = 0.9;
  this.shadowGenerator.shadowMaxZ = 30;
  this.shadowGenerator.bias = 0.001;
  this.shadowGenerator.cascadeBlendPercentage = 0.05;
  this.shadowGenerator.stabilizeCascades = true;

  // Setup fog
  this.scene.fogMode = Scene.FOGMODE_EXP2;
  this.scene.fogDensity = 0.008;
  this.scene.fogColor = new Color3(0.9, 0.92, 0.95);
  this.scene.fogEnabled = true;
  //this.scene.renderTargetsEnabled = false

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
  //await this.createGrass(800);
  await this.createBoundaryWalls();
  // Create mist particles
  this.createMistParticles();
  this.createSparkleParticles();
  this.createFireflyParticles();
  //this.createGodrays();
  //this.createGodrayParticles();
 // this.createRainbowArcParticles();
  //this.createDreamTrailParticles();
  // Create forest (now uses preloaded asset)

  //this.createProceduralRainbowArc();
  await this.createForest(800);
  await this.createGrass(2500);

  
}

  
private async loadGroundMesh(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      const ground = MeshBuilder.CreateGroundFromHeightMap(
        "Plane",
        "./HeightMap2.png",
        {
          width: 300,
          height: 300,
          subdivisions: 75,
          minHeight: 0,
          maxHeight: 1.5,
          onReady: (mesh) => {
            mesh.receiveShadows = true;
            mesh.isPickable = false;
            resolve();
          },
        },
        this.scene
      );
      this.ground = ground;

      const pbr = new PBRMaterial("pbr", this.scene);
      pbr.albedoTexture = new Texture("./textures/grass4/diffuse.jpg", this.scene);
      pbr.bumpTexture = new Texture("./textures/grass4/normal.jpg", this.scene);
      pbr.invertNormalMapX = true;
      pbr.invertNormalMapY = true;
      pbr.metallic = 0.2;
      pbr.roughness = 0.6;
      if (pbr.albedoTexture instanceof Texture) {
        pbr.albedoTexture.uScale = 75;
        pbr.albedoTexture.vScale = 75;
      }
      pbr.environmentIntensity = 0.15;
      ground.material = pbr;

      this.groundMeshes.push(ground);
    } catch (error) {
      console.error("Error creating ground from heightmap:", error);
      reject(error);
    }
  }).then(() => {
    if (this.scene.isPhysicsEnabled()) {
      try {
        new PhysicsAggregate(
          this.ground,
          PhysicsShapeType.MESH,
          { mass: 0, restitution: 0.1, friction: 0.8 },
          this.scene
        );
      } catch (physicsError) {
        console.error(`Failed to apply physics to ground:`, physicsError);
      }
    }

    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(this.ground);
    }
  });
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

  private createSparkleParticles(): void {
  const sparkleSystem = new ParticleSystem("sparkles", 500, this.scene);
  sparkleSystem.particleTexture = new Texture("./flare_1.png", this.scene); // texture à adapter
  sparkleSystem.emitter = new Vector3(0, 2, 0); // centré mais diffusé large
  sparkleSystem.minEmitBox = new Vector3(-50, 1, -50);
  sparkleSystem.maxEmitBox = new Vector3(50, 5, 50);

  sparkleSystem.minSize = 0.2;
  sparkleSystem.maxSize = 0.5;
  sparkleSystem.minLifeTime = 3.0;
  sparkleSystem.maxLifeTime = 6.0;
  sparkleSystem.emitRate = 250;

  sparkleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;
  sparkleSystem.gravity = new Vector3(0, -0.1, 0); // très légère chute
  sparkleSystem.direction1 = new Vector3(-0.05, 0.05, -0.05);
  sparkleSystem.direction2 = new Vector3(0.05, 0.05, 0.05);

  sparkleSystem.minAngularSpeed = 0;
  sparkleSystem.maxAngularSpeed = 0.5;
  sparkleSystem.minEmitPower = 0.05;
  sparkleSystem.maxEmitPower = 0.1;

  sparkleSystem.addColorGradient(0, new Color4(1.0, 1.0, 1.0, 0.0));
  sparkleSystem.addColorGradient(0.3, new Color4(0.9, 0.9, 1.0, 0.25));
  sparkleSystem.addColorGradient(0.6, new Color4(1.0, 0.9, 1.0, 0.2));
  sparkleSystem.addColorGradient(1.0, new Color4(1.0, 1.0, 1.0, 0.0));

  sparkleSystem.start();
}



private createDreamTrailParticles(): void {
  const trailSystem = new ParticleSystem("dreamTrail", 400, this.scene);
  trailSystem.particleTexture = new Texture("./lines_8.png", this.scene); // texture floue ou filet lumineux

  trailSystem.emitter = new Vector3(0, 12, 0); // haut de la scène
  trailSystem.minEmitBox = new Vector3(-60, 0, -60);
  trailSystem.maxEmitBox = new Vector3(60, 0, 60);

  trailSystem.minSize = 0.8;
  trailSystem.maxSize = 1.2;
  trailSystem.minLifeTime = 5;
  trailSystem.maxLifeTime = 9;
  trailSystem.emitRate = 200;

  trailSystem.direction1 = new Vector3(-0.1, -0.2, -0.1);
  trailSystem.direction2 = new Vector3(0.1, -0.3, 0.1);
  trailSystem.gravity = new Vector3(0, -0.1, 0); // lente descente

  trailSystem.minEmitPower = 0.05;
  trailSystem.maxEmitPower = 0.1;
  trailSystem.minAngularSpeed = 0;
  trailSystem.maxAngularSpeed = 0.2;

  trailSystem.blendMode = ParticleSystem.BLENDMODE_ADD;

  trailSystem.addColorGradient(0.0, new Color4(1.0, 0.9, 1.0, 0.0));
  trailSystem.addColorGradient(0.3, new Color4(1.0, 0.9, 1.0, 0.15));
  trailSystem.addColorGradient(0.7, new Color4(0.9, 0.8, 1.0, 0.1));
  trailSystem.addColorGradient(1.0, new Color4(1.0, 0.9, 1.0, 0.0));

  trailSystem.start();
}
private createFireflyParticles(): void {
  const fireflySystem = new ParticleSystem("fireflies", 100, this.scene);
  fireflySystem.particleTexture = new Texture("./Flare.png", this.scene); // petit point lumineux flou

  fireflySystem.emitter = new Vector3(0, 2, 0);
  fireflySystem.minEmitBox = new Vector3(-40, 0, -40);
  fireflySystem.maxEmitBox = new Vector3(40, 5, 40);

  fireflySystem.minSize = 0.3;
  fireflySystem.maxSize = 0.5;
  fireflySystem.minLifeTime = 4;
  fireflySystem.maxLifeTime = 8;
  fireflySystem.emitRate = 8;

  fireflySystem.direction1 = new Vector3(-0.2, 0.1, -0.2);
  fireflySystem.direction2 = new Vector3(0.2, 0.1, 0.2);
  fireflySystem.minEmitPower = 0.2;
  fireflySystem.maxEmitPower = 0.5;
  fireflySystem.minAngularSpeed = 0.0;
  fireflySystem.maxAngularSpeed = 0.2;
  fireflySystem.gravity = new Vector3(0, 0, 0); // pas de chute

  fireflySystem.blendMode = ParticleSystem.BLENDMODE_ADD;

  // Clignotement doux
  fireflySystem.addColorGradient(0.0, new Color4(1.0, 1.0, 0.8, 0.0));
  fireflySystem.addColorGradient(0.2, new Color4(1.0, 1.0, 0.6, 0.3));
  fireflySystem.addColorGradient(0.5, new Color4(1.0, 1.0, 0.4, 0.5));
  fireflySystem.addColorGradient(0.8, new Color4(1.0, 1.0, 0.6, 0.3));
  fireflySystem.addColorGradient(1.0, new Color4(1.0, 1.0, 0.8, 0.0));

  fireflySystem.start();
}
private createGodrays(): void {

  // SUN LIGHT SOURCE as a sphere
  const sun = MeshBuilder.CreateSphere("sun", { diameter: 4, segments: 32 }, this.scene);
  sun.position = new Vector3(0, 10, 10);

  const sunMat = new StandardMaterial("sunMat", this.scene);
  sunMat.emissiveColor = new Color3(1, 0.9, 0.6);

  sunMat.backFaceCulling = false;
  sun.material = sunMat;

  // GODRAY POSTPROCESS
  const godrays = new VolumetricLightScatteringPostProcess(
    "godrays",
    1.0,
    this.camera,
    sun,
    100,
    Texture.BILINEAR_SAMPLINGMODE,
    this.engine,
    false
  );

  godrays.exposure = 0.2;
  godrays.decay = 1;
  godrays.weight = 0.4;
  godrays.density = 0.5;


    // GIZMO MANAGER
 const gizmoManager = new GizmoManager(this.scene);
gizmoManager.attachToMesh(null);        // detach from anything first
gizmoManager.positionGizmoEnabled = true;

setTimeout(() => {
  gizmoManager.attachToMesh(null); // detach any previous
  gizmoManager.positionGizmoEnabled = true;
  gizmoManager.attachToMesh(sun);
}, 100);      
}

private createProceduralRainbowArc(): void {
  const radius = 50;
  const arcAngle = Math.PI;
  const segments = 200;
  const thickness = 15;

  const pathArray: Vector3[][] = [];
  const uvs: Vector2[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * arcAngle;
    const inner = radius - thickness / 2;
    const outer = radius + thickness / 2;

    const innerPoint = new Vector3(
      Math.cos(angle) * inner,
      Math.sin(angle) * inner,
      0
    );
    const outerPoint = new Vector3(
      Math.cos(angle) * outer,
      Math.sin(angle) * outer,
      0
    );

    pathArray.push([innerPoint, outerPoint]);

    const u = i / segments;
    uvs.push(new Vector2(u, 0)); // inner
    uvs.push(new Vector2(u, 1)); // outer
  }

  const rainbow = MeshBuilder.CreateRibbon("rainbowArc", {
    pathArray,
    sideOrientation: Mesh.DOUBLESIDE,
    updatable: false,
    uvs
  }, this.scene);

  rainbow.position = new Vector3(0, 0, 0);
  rainbow.rotation = new Vector3(0, Math.PI/2, 0); // Face the camera
  //rainbow.renderingGroupId = 1;
  rainbow.hasVertexAlpha = true; // Ensure the mesh is treated as having alpha

rainbow.alphaIndex = 1000; // Higher alphaIndex renders later 

  const shaderName = "rainbowArcShader";

  // Vertex Shader
  Effect.ShadersStore[`${shaderName}VertexShader`] = `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    uniform mat4 worldViewProjection;
    varying vec2 vUV;

    void main() {
      vUV = uv;
      gl_Position = worldViewProjection * vec4(position, 1.0);
    }
  `;

  // Fragment Shader
Effect.ShadersStore[`${shaderName}FragmentShader`] = `
  precision highp float;
  varying vec2 vUV;

  vec3 hsl2rgb(float h, float s, float l) {
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
    float m = l - c / 2.0;
    vec3 rgb = vec3(0.0);
    if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
    else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
    else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
    else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
    else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
    else rgb = vec3(c, 0.0, x);
    return rgb + vec3(m);
  }

  void main() {
    float t = vUV.y;

    // Full spectrum hue
    float h = 0.0 + t * 0.83;
    vec3 color = hsl2rgb(h, 0.8, 0.5); // less saturated, softer

    // Smoother edge fading
    float edgeFade = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.92, t);

    // Slight fade toward center
    float centerFade = 1.0 - pow((t - 0.5) / 0.5, 2.0);

    // Lower overall intensity
    float alpha = edgeFade * centerFade * 0.1;

    gl_FragColor = vec4(color, alpha);
  }
`;

  const shaderMat = new ShaderMaterial("rainbowMat", this.scene, {
    vertex: shaderName,
    fragment: shaderName
  }, {
    attributes: ["position", "uv"],
    uniforms: ["worldViewProjection"]
  });

  shaderMat.backFaceCulling = false;
  shaderMat.transparencyMode = Material.MATERIAL_ALPHABLEND;
  shaderMat.alpha = 1.0;
  shaderMat.needDepthPrePass = false;
  shaderMat.separateCullingPass = true;
  shaderMat.forceDepthWrite = false;

  rainbow.material = shaderMat;
}


private createRainbowArcParticles(): void {
  const rainbowSystem = new ParticleSystem("rainbow", 300, this.scene);
  rainbowSystem.particleTexture = new Texture("./flare_1.png", this.scene); // Use soft circular glow

  // Emit from arc-shaped area (fake a semi-circle using vertical range and emission box)
  rainbowSystem.emitter = new Vector3(0, 5, 0);
  rainbowSystem.minEmitBox = new Vector3(-20, 0, -5);
  rainbowSystem.maxEmitBox = new Vector3(20, 10, 5);

  rainbowSystem.minSize = 1.5;
  rainbowSystem.maxSize = 2.5;
  rainbowSystem.minLifeTime = 4;
  rainbowSystem.maxLifeTime = 6;
  rainbowSystem.emitRate = 150;
  rainbowSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD;

  rainbowSystem.gravity = new Vector3(0, 0, 0); // Keep them floating
  rainbowSystem.direction1 = new Vector3(-0.1, 0.1, -0.1);
  rainbowSystem.direction2 = new Vector3(0.1, 0.1, 0.1);

  rainbowSystem.minEmitPower = 0.05;
  rainbowSystem.maxEmitPower = 0.1;
  rainbowSystem.minAngularSpeed = 0;
  rainbowSystem.maxAngularSpeed = 0.05;

  // Gradient simulating rainbow colors
  rainbowSystem.addColorGradient(0.0, new Color4(1.0, 0.0, 0.0, 0.3)); // Red
  rainbowSystem.addColorGradient(0.2, new Color4(1.0, 0.5, 0.0, 0.3)); // Orange
  rainbowSystem.addColorGradient(0.4, new Color4(1.0, 1.0, 0.0, 0.3)); // Yellow
  rainbowSystem.addColorGradient(0.6, new Color4(0.0, 1.0, 0.0, 0.3)); // Green
  rainbowSystem.addColorGradient(0.8, new Color4(0.0, 0.0, 1.0, 0.3)); // Blue
  rainbowSystem.addColorGradient(1.0, new Color4(0.6, 0.0, 1.0, 0.3)); // Violet

  rainbowSystem.start();
}

  private async createForest(treeCount: number): Promise<void> {
  if (this.groundMeshes.length === 0) {
    console.warn("No ground mesh loaded to create forest");
    return;
  }
  const groundMesh = this.groundMeshes[0];

  const loadLODMesh = (containerName: string) => {
    const container = this.assetManager.getAssetContainer(containerName);
    if (!container) {
      console.error(`Game: ${containerName} asset not found`);
      return null;
    }
    const trunks = container.meshes.filter(m => m.name.includes("Sakura_Sakura_Mat_0")) as Mesh[];
    const leaves = container.meshes.filter(m => m.name.includes("Sakura_Bark001_2K_JPG_Mat_0")) as Mesh[];
    return {
      trunk: Mesh.MergeMeshes(trunks.map(m => m.clone(`${containerName}_trunk`, null, true)), true, true, undefined, false, true),
      leaves: Mesh.MergeMeshes(leaves.map(m => m.clone(`${containerName}_leaves`, null, true)), true, true, undefined, false, true),
    };
  };

  const lodHigh = loadLODMesh("mapleTreeHighPoly");
  const lodMid = loadLODMesh("mapleTree");
  const lodLow = loadLODMesh("mapleTreeLowPoly");

  if (!lodHigh || !lodMid || !lodLow || !lodHigh.trunk || !lodMid.trunk || !lodLow.trunk || !lodHigh.leaves || !lodMid.leaves || !lodLow.leaves) {
    console.warn("LOD meshes could not be loaded or merged.");
    return;
  }

  const configureLeavesMaterial = (mesh: Mesh) => {
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
      mat.fogEnabled = true;
    }
  };
  [lodHigh.leaves, lodMid.leaves, lodLow.leaves].forEach(configureLeavesMaterial);

  const trunkBase = lodHigh.trunk!;
  trunkBase.addLODLevel(30, lodMid.trunk!);
  trunkBase.addLODLevel(60, lodLow.trunk!);
  //trunkBase.addLODLevel(120, null);

  const leavesBase = lodHigh.leaves!;
  leavesBase.addLODLevel(30, lodMid.leaves!);
  leavesBase.addLODLevel(60, lodLow.leaves!);
  //leavesBase.addLODLevel(120, null);

  // Hide base meshes to prevent them from rendering
lodHigh.trunk!.isVisible = false;
lodMid.trunk!.isVisible = false;
lodLow.trunk!.isVisible = false;

lodHigh.leaves!.isVisible = false;
lodMid.leaves!.isVisible = false;
lodLow.leaves!.isVisible = false;

  // Disable fog & shadows for LOD2
  lodLow.trunk!.receiveShadows = false;
  lodLow.leaves!.receiveShadows = false;
  if (lodLow.leaves!.material instanceof PBRMaterial) {
    const mat = lodLow.leaves!.material as PBRMaterial;
    mat.fogEnabled = false;
    mat.backFaceCulling = true;
    mat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
  }

  // Bounding info
  trunkBase.refreshBoundingInfo();
  const trunkHeight = trunkBase.getBoundingInfo().boundingBox.maximumWorld.y -
                      trunkBase.getBoundingInfo().boundingBox.minimumWorld.y;
  const trunkDiameter = 4;

  // Poisson Disk Sampling
  const points: Vector2[] = [];
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

  const isValidPoint = (point: Vector2) => {
    const gridX = Math.floor((point.x - bounds.minX) / cellSize);
    const gridZ = Math.floor((point.y - bounds.minZ) / cellSize);
    if (gridX < 0 || gridX >= gridWidth || gridZ < 0 || gridZ >= gridHeight) return false;

    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = gridX + dx, z = gridZ + dz;
        if (x >= 0 && x < gridWidth && z >= 0 && z < gridHeight) {
          const neighbor = grid[z * gridWidth + x];
          if (neighbor && Vector2.Distance(point, neighbor) < radius) return false;
        }
      }
    }
    return true;
  };

  const first = new Vector2(bounds.minX + rand() * width, bounds.minZ + rand() * height);
  active.push(first); points.push(first);
  grid[Math.floor((first.y - bounds.minZ) / cellSize) * gridWidth + Math.floor((first.x - bounds.minX) / cellSize)] = first;

  while (active.length > 0 && points.length < treeCount) {
    const idx = Math.floor(rand() * active.length);
    const p = active[idx];
    let found = false;
    for (let i = 0; i < 30; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = radius + rand() * radius;
      const np = new Vector2(p.x + Math.cos(angle) * dist, p.y + Math.sin(angle) * dist);
      if (
        np.x >= bounds.minX && np.x <= bounds.maxX &&
        np.y >= bounds.minZ && np.y <= bounds.maxZ &&
        isValidPoint(np)
      ) {
        points.push(np);
        active.push(np);
        grid[Math.floor((np.y - bounds.minZ) / cellSize) * gridWidth + Math.floor((np.x - bounds.minX) / cellSize)] = np;
        found = true;
        break;
      }
    }
    if (!found) active.splice(idx, 1);
  }

  for (let i = 0; i < points.length; i++) {
    const x = points[i].x;
    const z = points[i].y;

    const position = new Vector3(x, 0, z); // No raycast
    const rotation = Quaternion.RotationAxis(Vector3.Up(), rand() * Math.PI * 2);
    const scaleVal = 0.4 + rand() * (0.8 - 0.4);
    const scale = new Vector3(scaleVal, scaleVal, scaleVal);

    const trunk = trunkBase.createInstance(`trunkInstance_${i}`);
    trunk.position = position;
    trunk.rotationQuaternion = rotation;
    trunk.scaling = scale;
    this.shadowGenerator!.addShadowCaster(trunk);
    trunk.receiveShadows = true;
 

    const leaves = leavesBase.createInstance(`leavesInstance_${i}`);
    leaves.position = position;
    leaves.rotationQuaternion = rotation;
    leaves.scaling = scale;
    //this.shadowGenerator!.addShadowCaster(leaves);
    leaves.receiveShadows = true;


    trunk.freezeWorldMatrix();
    leaves.freezeWorldMatrix();

    if (this.scene.isPhysicsEnabled()) {
      const collider = MeshBuilder.CreateCylinder(
        `treeCollider${i}`,
        { height: trunkHeight * scaleVal, diameter: trunkDiameter * scaleVal },
        this.scene
      );
      collider.position = position;
      collider.rotationQuaternion = rotation;
      collider.isVisible = false;
      collider.checkCollisions = true;

      Tags.EnableFor(collider);
      Tags.AddTagsTo(collider, "obstacle");

      try {
        new PhysicsAggregate(
          collider,
          PhysicsShapeType.CYLINDER,
          { mass: 0, restitution: 0.1, friction: 0.8 },
          this.scene
        );
        this.treeColliders.push(collider);
      } catch (err) {
        console.error(`Physics error on tree ${i}:`, err);
        collider.dispose();
      }
    }
  }

  // console.log(`Created forest with ${points.length} instances and adaptive LOD0 shadows.`);
}



private async createBoundaryWalls(): Promise<void> {
    try {
      const wallHeight = 100; // Tall enough to prevent jumping over
      const wallThickness = 1; // Thin to minimize impact
      const bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }; // Match forest bounds
      const wallLength = 400; // Matches ground width/height (maxX - minX or maxZ - minZ)

      // Create four walls (north, south, east, west)
      const walls = [
        // North wall (z = maxZ)
        {
          name: "northWall",
          position: new Vector3(0, wallHeight / 2, bounds.maxZ),
          dimensions: { width: wallLength, height: wallHeight, depth: wallThickness },
        },
        // South wall (z = minZ)
        {
          name: "southWall",
          position: new Vector3(0, wallHeight / 2, bounds.minZ),
          dimensions: { width: wallLength, height: wallHeight, depth: wallThickness },
        },
        // East wall (x = maxX)
        {
          name: "eastWall",
          position: new Vector3(bounds.maxX, wallHeight / 2, 0),
          dimensions: { width: wallThickness, height: wallHeight, depth: wallLength },
        },
        // West wall (x = minX)
        {
          name: "westWall",
          position: new Vector3(bounds.minX, wallHeight / 2, 0),
          dimensions: { width: wallThickness, height: wallHeight, depth: wallLength },
        },
      ];

      for (const wallConfig of walls) {
        const wall = MeshBuilder.CreateBox(
          wallConfig.name,
          {
            width: wallConfig.dimensions.width,
            height: wallConfig.dimensions.height,
            depth: wallConfig.dimensions.depth,
          },
          this.scene
        );
        wall.position = wallConfig.position;
        wall.isVisible = false;
        wall.isPickable = false;

        // Add physics
        if (this.scene.isPhysicsEnabled()) {
          try {
            new PhysicsAggregate(
              wall,
              PhysicsShapeType.BOX,
              { mass: 0, restitution: 0.1, friction: 0.8 },
              this.scene
            );
          } catch (physicsError) {
            console.error(`Failed to apply physics to ${wallConfig.name}:`, physicsError);
            wall.dispose();
            continue;
          }
        }

        this.boundaryWalls.push(wall);
      }

      // console.log("Created invisible boundary walls around the forest");
    } catch (error) {
      console.error("Error creating boundary walls:", error);
    }
  }

private async createGrass(grassCount: number): Promise<void> {
  if (this.groundMeshes.length === 0) {
    console.warn("No ground mesh loaded to create grass");
    return;
  }

  const groundMesh = this.groundMeshes[0];
  groundMesh.isPickable = false;

  const grassContainer = this.assetManager.getAssetContainer("grassPlant");
  if (!grassContainer) {
    console.error("Game: Grass asset not found in AssetManager");
    return;
  }

  const grassMeshes = grassContainer.meshes.filter(mesh => mesh.name.includes("Grass")) as Mesh[];
  if (grassMeshes.length === 0) {
    console.warn("No Grass meshes found in asset container");
    return;
  }

  const clonedGrassMeshes = grassMeshes.map(mesh => mesh.clone(`cloned_grass_${mesh.name}`, null, true));
  clonedGrassMeshes.forEach(mesh => {
    mesh.isPickable = false;
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

  const mergedGrassMesh = Mesh.MergeMeshes(clonedGrassMeshes, true, true, undefined, false, true);
  if (!mergedGrassMesh) {
    console.warn("Failed to merge grass meshes");
    clonedGrassMeshes.forEach(m => m.dispose());
    return;
  }

  clonedGrassMeshes.forEach(m => m.dispose());
  mergedGrassMesh.refreshBoundingInfo();
  mergedGrassMesh.receiveShadows = true;

  const seed = 98765432;
  const rand = this.mulberry32(seed);
  const bounds = { minX: -200, maxX: 200, minZ: -200, maxZ: 200 };
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxZ - bounds.minZ;
  const grassMatrices: Float32Array = new Float32Array(grassCount * 16);

  for (let i = 0; i < grassCount; i++) {
    const x = bounds.minX + rand() * width;
    const z = bounds.minZ + rand() * height;

    let position: Vector3;
    let rotation = Quaternion.Identity();

    const y = this.ground.getHeightAtCoordinates(x, z);
    if (y === undefined || isNaN(y)) {
      console.warn(`No valid height for grass ${i} at (${x}, ${z})`);
      position = new Vector3(x, 0, z);
    } else {
      position = new Vector3(x, y, z);
    }

    const ray = new Ray(new Vector3(x, position.y + 100, z), Vector3.Down(), 200);
    const hit = this.scene.pickWithRay(ray, (mesh) => mesh === groundMesh);

    if (hit && hit.getNormal) {
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
    }

    const randomYaw = rand() * Math.PI * 2;
    const yawRotation = Quaternion.RotationAxis(Vector3.Up(), randomYaw);
    rotation = yawRotation.multiply(rotation);

    const scaleValue = 10 + rand() * (0.6 - 0.3);
    const scale = new Vector3(scaleValue, scaleValue, scaleValue);

    const grassMatrix = Matrix.Compose(scale, rotation, position);
    grassMatrix.copyToArray(grassMatrices, i * 16);
  }

  mergedGrassMesh.thinInstanceSetBuffer("matrix", grassMatrices, 16, true);
  mergedGrassMesh.thinInstanceCount = grassCount;
  mergedGrassMesh.freezeWorldMatrix();
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
    this.targetingSystem = new TargetingSystem(this.scene);

    if (!this.shadowGenerator) {
      throw new Error("Game: Shadow generator not initialized");
    }

    if (!this.shadowGenerator.getLight()) {
      throw new Error("Game: Shadow generator has no associated light");
    }

    this.gameManager = new GameManager(
      this.scene,
      this.assetManager,
      this.shadowGenerator,
      this.highlightLayer,
      this.targetingSystem,
      this
    );

    const savedState: SceneState = { npcPositions: [], enemyPositions: [], bossPositions: [], questStates: [] };
    await this.gameManager.initializeNPCs(savedState.npcPositions, savedState.questStates);
    onStepComplete(); // Step 5: NPCs initialized

    await this.gameManager.initializeEnemies(savedState.enemyPositions, savedState.bossPositions);
    //await this.gameManager.initializeBosses(savedState.bossPositions);
    onStepComplete(); // Step 6: Enemies and bosses initialized

    this.gameManager.getEnemies().forEach(enemy => {
      this.observeEnemyDeath(enemy);
    });

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
      this.shadowGenerator.addShadowCaster(characterMesh, true);
      characterMesh.receiveShadows = true;
      characterMesh.checkCollisions = true;
      characterMesh.getChildMeshes().forEach(child => {
        this.shadowGenerator!.addShadowCaster(child, true);
        child.receiveShadows = true;
        child.checkCollisions = true;
      });
      this.gameManager.setCharacterMesh(characterMesh);
    } else {
      console.warn("Game: Character mesh not found for shadow generator");
    }

    await this.gameManager.initializeDreamCrystals();
    onStepComplete(); // Step 7: DreamCrystals initialized

    const player = this.characterController.getPlayer();
    const crystalState = this.gameManager.getDreamCrystalManager().getState();
    const totalCrystals = this.gameManager.getDreamCrystalManager().totalCrystals;
    player.setTotalCrystals(totalCrystals);
    player.resetCrystalCount();
    crystalState.collected.forEach((collected, i) => {
      if (collected) {
        player.incrementCrystalCount();
      }
    });
    this.gameManager.getDreamCrystalManager().getOnCrystalCollectedObservable().add((index) => {
      player.incrementCrystalCount();
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
public observeEnemyDeath(enemy: Enemy): void {
    const enemyId = enemy.getId();
    if (this.observedEnemies.has(enemyId)) {
      // console.log(`Game: Already observing enemy ${enemyId}, skipping duplicate observer`);
      return;
    }
    this.observedEnemies.add(enemyId);

    if (this.characterController) {
    const player = this.characterController.getPlayer();
    player.subscribeToEnemyDeath(enemy); // New: Subscribe for XP awards
  }

    enemy.onDeath.addOnce(({ id, position }) => {
      if (this.characterController) {
        const player = this.characterController.getPlayer();
            const enemyType = this.gameManager.getEnemyTypeConfig(enemy.getType())?.type || "Enemy";
            const isBoss = enemyType === "boss"; // Assume "boss" type indicates a boss
            player.incrementEnemyKills(isBoss ? "BossEnemy" : "Enemy");
            // console.log(`Game: ${isBoss ? "BossEnemy" : "Enemy"} ${id} killed at position`, position, `notified player`);
            this.observedEnemies.delete(id); // Clean up after death
            this.gameManager.scheduleEnemyRespawn(id, position, isBoss); // Pass isBoss flag
      }
    });
    // console.log(`Game: Observing onDeath for ${enemy instanceof BossEnemy ? "BossEnemy" : "Enemy"} ${enemyId}`);
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
        // console.log(`Game: Set currentQuest to ${this.currentQuest.getId()}, status: ${this.currentQuest.getState().status}, playerQuest: ${playerQuest ? playerQuest.getState().status : 'none'}, npcQuest: ${npcQuest.getState().status}`);
        this.showQuestDialog = !this.showQuestDialog;
        // console.log(`Game: Quest dialog toggled to ${this.showQuestDialog} for quest ${this.currentQuest.getId()}`);
        this.onQuestDialogToggled.notifyObservers(this.showQuestDialog);
        if (this.showQuestDialog) {
          target.rotateToFacePlayer();
        }
      } else {
        // console.log("Game: Cannot toggle quest dialog; NPC has no quest");
        this.showQuestDialog = false;
        this.currentQuest = null;
        this.onQuestDialogToggled.notifyObservers(this.showQuestDialog);
      }
    } else {
      // console.log("Game: Cannot toggle quest dialog; target is not an NPC");
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
        // console.log(`Game: getCurrentQuest updated to playerQuest ${this.currentQuest.getId()}, status: ${this.currentQuest.getState().status}`);
      }
    }
    // console.log(`Game: getCurrentQuest returning ${this.currentQuest?.getId() ?? "null"}, status: ${this.currentQuest?.getState().status ?? "none"}`);
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
            // console.log(`Game: Updated NPC quest ${this.currentQuest!.getId()} to status: ${playerQuest.getState().status}`);
          }
          npc.updateQuestMarker();
        }
      });
      this.currentQuest = player.getActiveQuests().find(q => q.getId() === this.currentQuest!.getId()) || this.currentQuest;
      // console.log(`Game: updated currentQuest after accept to ${this.currentQuest.getId()}, status: ${this.currentQuest.getState().status}`);
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
      const currentQuestId = this.currentQuest.getId();
      player.turnInQuest(this.currentQuest);

      let nextQuest: Quest | null = null;
      const nextQuestId = this.currentQuest.getNextQuestId();
      if (nextQuestId) {
        nextQuest = this.gameManager.getQuestById(nextQuestId);
        if (!nextQuest) {
          console.warn(`Game: Next quest ${nextQuestId} not found`);
        }
      }

      this.gameManager.getNPCs().forEach(npc => {
        const npcQuest = npc.getQuest();
        if (npcQuest?.getId() === currentQuestId) {
          const playerQuest = [...player.getActiveQuests(), ...player.getCompletedQuests(), ...player.getTurnedInQuests()].find(q => q.getId() === currentQuestId);
          if (playerQuest) {
            npc.setQuest(playerQuest);
            // console.log(`Game: Updated NPC quest ${currentQuestId} to status: ${playerQuest.getState().status}`);
            npc.updateQuestMarker();
          }
          // New: Assign next quest to NPC if available
          if (nextQuest && !player.getTurnedInQuests().some(q => q.getId() === nextQuestId)) {
            npc.setQuest(nextQuest);
            npc.updateQuestMarker();
            // console.log(`Game: Assigned next quest ${nextQuestId} to NPC ${npc.getId()}`);
          }
        }
      });

      this.currentQuest = [...player.getActiveQuests(), ...player.getCompletedQuests(), ...player.getTurnedInQuests()].find(q => q.getId() === currentQuestId) || this.currentQuest;
      if (nextQuest && !player.getTurnedInQuests().some(q => q.getId() === nextQuestId)) {
        this.currentQuest = nextQuest;
        // console.log(`Game: Updated currentQuest to next quest ${nextQuestId}, status: ${nextQuest.getState().status}`);
      } else {
        // console.log(`Game: Updated currentQuest after turn-in to ${this.currentQuest!.getId()}, status: ${this.currentQuest!.getState().status}`);
      }

      this.showQuestDialog = false;
      this.onQuestDialogToggled.notifyObservers(false);
    }
  }

  public waitForInitialization(): Promise<void> {
    return this.initializationPromise;
  }


  private async initializeNavigation(): Promise<void> {
    try {
      const recast = await Recast();
      this.navigationPlugin = new RecastJSPlugin(recast);
      const navmeshParameters = {
        cs: 0.38, // Cell size 
        ch: 0.05, // Cell height
        walkableSlopeAngle: 60, // Max slope enemies can climb
        walkableHeight: 2.0, // Enemy height
        walkableClimb: 11.0, // Max height enemies can step up
        walkableRadius: 0.5, // Enemy radius for collision
        maxEdgeLen: 24,
          maxSimplificationError: 0.5,
  minRegionArea: 2,
  mergeRegionArea: 8,
  maxVertsPerPoly: 6,
  detailSampleDist: 3,
  detailSampleMaxError: 0.4,
      };

      // Combine ground and obstacle meshes
      const navmeshMeshes = [
        this.ground,
        ...this.treeColliders,
        ...this.boundaryWalls,
      ].filter((mesh): mesh is Mesh => !!mesh);

      this.navigationPlugin.createNavMesh(navmeshMeshes, navmeshParameters);
      // console.log("Game: Navmesh created successfully");
      /*
      const navmeshdebug = this.navigationPlugin.createDebugNavMesh(this.scene);
      const matdebug = new StandardMaterial("matdebug", this.scene);
      matdebug.diffuseColor = new Color3(0.1, 0.2, 1);
      matdebug.alpha = 0.2;
      navmeshdebug.material = matdebug;
      */

      // Create crowd for enemies
      this.crowd = this.navigationPlugin.createCrowd(20, 2.0, this.scene); // Max 20 enemies, max speed 2.0
      // console.log("Game: Crowd initialized for enemies");
    } catch (error) {
      console.error("Game: Failed to initialize navigation:", error);
    }
  }

  // Getter for navigation plugin
  public getNavigationPlugin(): RecastJSPlugin | null {
    return this.navigationPlugin;
  }

  // Getter for crowd
  public getCrowd(): any | null {
    return this.crowd;
  }

  // Update crowd in render loop
  private updateCrowd(): void {
    if (this.crowd) {
      this.crowd.update(this.scene.getEngine().getDeltaTime());
    }
  }

  // Modify render loop to include crowd update
  private initializeRenderLoop(): void {
    this.engine.runRenderLoop(() => {
      if (this.inputHandler.getIsInitialized()) {
        this.inputHandler.update();
        this.updateCrowd(); // Add crowd update
        this.scene.render();
      }
    });
  }

  

  public dispose(): void {
    try {


   
      // console.log("Game: Cleared enemy death subscriptions");

      
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
      // console.log("Game: Disposed");
    } catch (error) {
      console.error("Game: Dispose failed:", error);
    }
  }
} 