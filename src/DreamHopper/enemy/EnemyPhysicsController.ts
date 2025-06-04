import { Mesh, Scene, Vector3, Quaternion } from "@babylonjs/core";
import { PhysicsController, PhysicsConfig, ColliderType } from "../PhysicsController";
import { RecastJSPlugin } from "@babylonjs/core";
import { Game } from "../Game";
import { Enemy } from "./Enemy";

export class EnemyPhysicsController {
  private physicsController: PhysicsController;
  private scene: Scene;
  private mesh: Mesh;
  private wanderObserver: any | null = null;
  private moveToObserver: any | null = null;
  private agentIndex = -1;
  private navigationPlugin: RecastJSPlugin | null;
  private crowd: any | null;
  private game: Game;
  private navDummy: Mesh;
  enemy: Enemy;

  constructor(scene: Scene, mesh: Mesh, physicsConfig: PhysicsConfig, game: Game, enemy: Enemy) {
    this.scene = scene;
    this.mesh = mesh;
    this.game = game;
    this.enemy = enemy;
    this.physicsController = new PhysicsController(scene, mesh, physicsConfig);
    this.navigationPlugin = game.getNavigationPlugin();
    this.crowd = game.getCrowd();

    // Create invisible navDummy for crowd navigation
    this.navDummy = Mesh.CreateBox("navDummy", 1, scene);
    this.navDummy.isVisible = false;
    this.navDummy.isPickable = false;
    this.navDummy.setEnabled(true);
    this.navDummy.position.copyFrom(this.mesh.getAbsolutePosition());

    if (this.navigationPlugin && this.crowd) {
      const agentParams = {
        radius: physicsConfig.colliderParams.radius! || 0.2,
        height: physicsConfig.colliderParams.pointB!.y - physicsConfig.colliderParams.pointA!.y || 1.75,
        maxAcceleration: 8.0,
        maxSpeed: 3,
        collisionQueryRange: 3,
        pathOptimizationRange: 50,
        separationWeight: 3,
      };
      this.agentIndex = this.crowd.addAgent(this.navDummy.position, agentParams, this.navDummy);
      console.log(`EnemyPhysicsController: Added agent ${this.agentIndex} at`, this.navDummy.position);
    } else {
      console.warn("EnemyPhysicsController: Navigation plugin or crowd not available");
    }


    this.scene.onBeforeRenderObservable.add(() => {
  if (this.navDummy && this.mesh) {
    this.navDummy.position.copyFrom(this.mesh.getAbsolutePosition());
  }
});
  }

  

  public setInertia(inertia: Vector3): void {
    this.physicsController.getPhysicsAggregate()?.body.setMassProperties({ inertia });
  }

  public orientToForwardDirection(forwardDirection: Vector3): void {
    const normalizedForward = forwardDirection.normalizeToNew();
    const flatForward = new Vector3(normalizedForward.x, 0, normalizedForward.z).normalize();

    if (flatForward.lengthSquared() < 0.0001) return;

    const angle = Math.atan2(flatForward.x, flatForward.z) + Math.PI;
    this.mesh.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), angle);

    const aggregate = this.physicsController.getPhysicsAggregate();
    if (aggregate) {
      aggregate.body.setAngularVelocity(new Vector3(0, 0, 0));
    }
  }

  public generateRandomDirection(): Vector3 {
    const angle = Math.random() * 2 * Math.PI;
    const x = Math.cos(angle);
    const z = Math.sin(angle);
    return new Vector3(x, 0, z);
  }

   public moveTo(position: Vector3): void {
    if (this.agentIndex === -1 || !this.crowd || !this.navigationPlugin) {
      console.warn("EnemyPhysicsController: No crowd agent, using fallback");
      return;
    }

    this.crowd.agentGoto(this.agentIndex, position);

    if (this.moveToObserver) this.scene.onBeforeRenderObservable.remove(this.moveToObserver);

    this.moveToObserver = this.scene.onBeforeRenderObservable.add(() => {
      const aggregate = this.physicsController.getPhysicsAggregate();
      if (!aggregate || !this.crowd) return;

      const agentVelocity = this.crowd.getAgentVelocity(this.agentIndex);
      if (agentVelocity.lengthSquared() > 0.01) {
        this.orientToForwardDirection(agentVelocity);
        try {
          const y = aggregate.body.getLinearVelocity().y;
          const horizVel = new Vector3(agentVelocity.x, y, agentVelocity.z);
          aggregate.body.setLinearVelocity(horizVel);
        } catch (e) {
          console.warn("moveTo: Failed to set velocity", e);
        }
      }
    });
  }


  private fallbackMoveTo(position: Vector3): void {
    const aggregate = this.physicsController?.getPhysicsAggregate();
    if (!this.mesh || !aggregate) return;

    if (this.moveToObserver) {
      this.scene.onBeforeRenderObservable.remove(this.moveToObserver);
      this.moveToObserver = null;
    }

    this.moveToObserver = this.scene.onBeforeRenderObservable.add(() => {
      const aggregate = this.physicsController?.getPhysicsAggregate();
      if (!aggregate) {
        this.scene.onBeforeRenderObservable.remove(this.moveToObserver);
        this.moveToObserver = null;
        return;
      }

      const currentPosition = this.mesh.position.clone();
      const direction = position.subtract(currentPosition);
      const distanceToTarget = direction.length();

      if (distanceToTarget > 0.1) {
        this.orientToForwardDirection(direction); // Ensure orientation in fallback
        const velocity = direction.normalize().scale(2);
        try {
          velocity.y = aggregate.body.getLinearVelocity().y;
          aggregate.body.setLinearVelocity(velocity);
        } catch (e) {
          console.warn("fallbackMoveTo: Failed to set velocity", e);
          this.scene.onBeforeRenderObservable.remove(this.moveToObserver);
          this.moveToObserver = null;
        }
      } else {
        try {
          const y = aggregate.body.getLinearVelocity().y;
          aggregate.body.setLinearVelocity(new Vector3(0, y, 0));
        } catch (e) {
          console.warn("fallbackMoveTo (end): Failed to reset velocity", e);
        }
        this.scene.onBeforeRenderObservable.remove(this.moveToObserver);
        this.moveToObserver = null;
      }
    });
  }

  public startWandering(maxDistance = 10): void {
  if (!this.mesh || !this.physicsController || !this.crowd || this.agentIndex === -1) return;

  this.stopWandering();

  let waitingForNextTarget = false;

  const moveToNextTarget = () => {
    const randomDirection = this.generateRandomDirection();
    const distance = 5 + Math.random() * (maxDistance - 5);
    const roughTarget = this.mesh.position.add(randomDirection.scale(distance));

    let finalTarget = roughTarget;

    // Make sure target is on the navmesh
    if (this.navigationPlugin) {
      const closest = this.navigationPlugin.getClosestPoint(roughTarget);
      if (closest) {
        finalTarget = closest;
      } else {
        console.warn("startWandering: No valid navmesh point for target");
        return;
      }
    }

    this.crowd.agentGoto(this.agentIndex, finalTarget);
    this.enemy.getAnimationManager().playAnimation("Run");

    waitingForNextTarget = false;
  };

  this.wanderObserver = this.scene.onBeforeRenderObservable.add(() => {
    const aggregate = this.physicsController.getPhysicsAggregate();
    if (!aggregate || !this.crowd) return;

    const agentVelocity = this.crowd.getAgentVelocity(this.agentIndex);

    if (agentVelocity.lengthSquared() < 0.01) {
      if (!waitingForNextTarget) {
        waitingForNextTarget = true;

        this.enemy.getAnimationManager().playAnimation("Idle", 1.0, undefined, undefined, true);
        setTimeout(() => {
          moveToNextTarget();
        }, 3000); // Delay before wandering again
      }
    } else {
      // Smooth rotation toward velocity
      const flatVel = new Vector3(agentVelocity.x, 0, agentVelocity.z);
      if (flatVel.lengthSquared() > 0.05) {
        const desiredAngle = Math.atan2(flatVel.x, flatVel.z) + Math.PI;
        const targetRotation = Quaternion.RotationAxis(Vector3.Up(), desiredAngle);

        // Interpolate rotation smoothly
        this.mesh.rotationQuaternion = Quaternion.Slerp(
          this.mesh.rotationQuaternion ?? Quaternion.Identity(),
          targetRotation,
          0.1 // Smooth factor (tweak as needed)
        );
      }

      try {
        const y = aggregate.body.getLinearVelocity().y;
        const horizVel = new Vector3(agentVelocity.x, y, agentVelocity.z);
        aggregate.body.setLinearVelocity(horizVel);
      } catch (e) {
        console.warn("startWandering: Failed to set velocity", e);
      }
    }
  });

  // Start first wander
  moveToNextTarget();
}


  private fallbackStartWandering(maxDistance = 10): void {
    this.stopWandering();

    const moveToNextTarget = () => {
      const currentPosition = this.mesh.position.clone();
      const randomDirection = this.generateRandomDirection();
      const distance = 5 + Math.random() * (maxDistance - 5);
      const targetPosition = currentPosition.add(randomDirection.scale(distance));

      this.fallbackMoveTo(targetPosition);
    };

    this.wanderObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (!this.physicsController) {
        this.stopWandering();
        return;
      }

      const physicsAggregate = this.physicsController.getPhysicsAggregate();
      if (!physicsAggregate) {
        console.warn("Physics aggregate is null. Stopping wandering.");
        this.stopWandering();
        return;
      }

      let velocity: Vector3;
      try {
        velocity = physicsAggregate.body.getLinearVelocity();
      } catch (err) {
        console.warn("Physics body is null or disposed. Stopping wandering.");
        this.stopWandering();
        return;
      }

      if (velocity.lengthSquared() < 0.01) {
        moveToNextTarget();
      }
    });

    moveToNextTarget();
  }

  public stopWandering(): void {
    if (this.wanderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.wanderObserver);
      this.wanderObserver = null;
    }

    if (this.crowd && this.agentIndex !== -1) {
      this.crowd.agentTeleport(this.agentIndex, this.mesh.position);
    }

    const physicsAggregate = this.physicsController.getPhysicsAggregate();
    if (physicsAggregate) {
      try {
        const y = physicsAggregate.body.getLinearVelocity().y;
        physicsAggregate.body.setLinearVelocity(new Vector3(0, y, 0));
      } catch (e) {
        console.warn("stopWandering: Failed to reset velocity", e);
      }
    }
  }

  public stopAllMovement(): void {
    if (this.wanderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.wanderObserver);
      this.wanderObserver = null;
    }

    if (this.moveToObserver) {
      this.scene.onBeforeRenderObservable.remove(this.moveToObserver);
      this.moveToObserver = null;
    }

    if (this.crowd && this.agentIndex !== -1) {
      this.crowd.agentTeleport(this.agentIndex, this.mesh.position);
    }

    const physicsAggregate = this.physicsController.getPhysicsAggregate();
    if (physicsAggregate) {
      try {
        const y = physicsAggregate.body.getLinearVelocity().y;
        physicsAggregate.body.setLinearVelocity(new Vector3(0, y, 0));
        console.log("EnemyPhysicsController: All movement stopped");
      } catch (e) {
        console.warn("stopAllMovement: Failed to reset velocity", e);
      }
    }
  }

  public getPhysicsController(): PhysicsController {
    return this.physicsController;
  }

  public getAgentIndex(): number {
    return this.agentIndex;
  }

  public dispose(): void {
    this.stopAllMovement();
    if (this.crowd && this.agentIndex !== -1) {
      this.crowd.removeAgent(this.agentIndex);
    }
    this.navDummy.dispose();
    this.physicsController.dispose();
    this.agentIndex = -1;
  }
}

export { PhysicsConfig };