import {
    Scene,
    MeshBuilder,
    StandardMaterial,
    Color3,
    VertexData,
    Vector3,
    Mesh
  } from "@babylonjs/core";
  

  export class TerrainGenerator {
    private terrainMesh: Mesh | null = null;
  
    constructor(private scene: Scene) {}
  
    public createProceduralTerrain(): void {
      const width = 100;
      const depth = 100;
      const subdivisions = 100;
  
      // Create a flat ground 
      const ground = MeshBuilder.CreateGround(
        "terrain",
        { width, height: depth, subdivisions },
        this.scene
      );
  
      // Access the vertex data to modify heights
      const vertexData = VertexData.ExtractFromMesh(ground);
      const positions = vertexData.positions;
  
      // Modify y-position for hills
      for (let i = 0; i < positions!.length; i += 3) {
        const x = positions![i];
        const z = positions![i + 2];
  
        // sinusoidal hill formula 
        const height = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 5;
        positions![i + 1] = height; // update y position
      }
  
      // Update the mesh with new vertex positions
      vertexData.positions = positions;
      vertexData.applyToMesh(ground);
  
      // Material
      const terrainMaterial = new StandardMaterial("terrainMat", this.scene);
      terrainMaterial.diffuseColor = new Color3(0.8, 0.7, 0.5);
      ground.material = terrainMaterial;
  
      ground.checkCollisions = true;
      ground.receiveShadows = true;
  
      this.terrainMesh = ground;
    }
  }
  