import { Mesh, Scene, Vector3, Quaternion } from "@babylonjs/core";
import { PhysicsController, PhysicsConfig, ColliderType } from "../PhysicsController";

export class NPCPhysicsController {
  private physicsController: PhysicsController;
  private scene: Scene;
  private mesh: Mesh;
  private wanderObserver: any | null = null;

  constructor(scene: Scene, mesh: Mesh, physicsConfig: PhysicsConfig) {
    this.scene = scene;
    this.mesh = mesh;
    this.physicsController = new PhysicsController(scene, mesh, physicsConfig);
  }

  public setInertia(inertia: Vector3): void {
    this.physicsController.getPhysicsAggregate()?.body.setMassProperties({ inertia });
  }

  public orientToForwardDirection(forwardDirection: Vector3): void {
    const normalizedForward = forwardDirection.normalizeToNew();

    // Ensure the direction is on the XZ plane (ignore Y for yaw-only rotation)
    const flatForward = new Vector3(normalizedForward.x, 0, normalizedForward.z).normalize();

    // Skip rotation if the direction is zero or invalid
    if (flatForward.lengthSquared() < 0.0001) return;

    // Calculate the angle to rotate around the Y-axis (yaw)
    const angle = Math.atan2(flatForward.x, flatForward.z) + Math.PI; // Add 180 degrees to flip forward

    // Apply rotation as a quaternion around the Y-axis
    this.mesh.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), angle);

    // Ensure no angular velocity to prevent physics-driven rotation
    const aggregate = this.physicsController.getPhysicsAggregate();
    if (aggregate) {
      aggregate.body.setAngularVelocity(new Vector3(0, 0, 0));
    }
  }

  public generateRandomDirection(): Vector3 {
    const angle = Math.random() * 2 * Math.PI; // Random angle in radians
    const x = Math.cos(angle);
    const z = Math.sin(angle);
    return new Vector3(x, 0, z); // Y is 0 (flat plane)
  }

  public moveTo(position: Vector3): void {
    const physicsAggregate = this.physicsController.getPhysicsAggregate();
    if (!this.mesh || !physicsAggregate) return;

    const observer = this.scene.onBeforeRenderObservable.add(() => {
      const currentPosition = this.mesh.position.clone();
      const direction = position.subtract(currentPosition).normalize();
      const distanceThreshold = 0.1;
      const distanceToTarget = Vector3.Distance(currentPosition, position);

      if (distanceToTarget > distanceThreshold) {
        this.orientToForwardDirection(direction);

        // Set velocity
        const speed = 2;
        const velocity = direction.scale(speed);
        velocity.y = physicsAggregate.body.getLinearVelocity().y; // Preserve vertical velocity
        physicsAggregate.body.setLinearVelocity(velocity);
      } else {
        // Stop movement when close enough to the target
        physicsAggregate.body.setLinearVelocity(new Vector3(0, physicsAggregate.body.getLinearVelocity().y, 0));
        // Remove the observer to stop further updates
        this.scene.onBeforeRenderObservable.remove(observer);
      }
    });
  }

  public startWandering(maxDistance = 10): void {
    if (!this.mesh || !this.physicsController) {
      console.error(`Cannot start wandering: Mesh or physics controller is null`);
      return;
    }

    // Stop any existing wandering
    this.stopWandering();

    // Function to generate and move to a new random target
    const moveToNextTarget = () => {
      const currentPosition = this.mesh.position.clone();
      const randomDirection = this.generateRandomDirection();
      // Scale the direction to a random distance between 5 and maxDistance
      const distance = 5 + Math.random() * (maxDistance - 5);
      const targetPosition = currentPosition.add(randomDirection.scale(distance));

      // Move to the new target
      this.moveTo(targetPosition);
    };

    // Start wandering loop
    this.wanderObserver = this.scene.onBeforeRenderObservable.add(() => {
      const physicsAggregate = this.physicsController.getPhysicsAggregate()!;
      const velocity = physicsAggregate.body.getLinearVelocity();

      // Check if the NPC has stopped moving (reached target or stuck)
      if (velocity.lengthSquared() < 0.01) {
        moveToNextTarget();
      }
    });

    // Move to the first target immediately
    moveToNextTarget();
  }

  public stopWandering(): void {
    if (this.wanderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.wanderObserver);
      this.wanderObserver = null;
    }

    // Stop any current movement
    const physicsAggregate = this.physicsController.getPhysicsAggregate();
    if (physicsAggregate) {
      physicsAggregate.body.setLinearVelocity(new Vector3(0, physicsAggregate.body.getLinearVelocity().y, 0));
    }
  }

  public getPhysicsController(): PhysicsController {
    return this.physicsController;
  }

  public dispose(): void {
    this.stopWandering();
    this.physicsController.dispose();
  }
}

export { PhysicsConfig };
