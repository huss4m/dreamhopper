<template>
  <div class="action-bar">
    <button
      v-for="ability in abilities"
      :key="ability.id"
      class="action-button"
      :title="`${ability.name} - ${ability.manaCost} Mana`"
      @mousedown.prevent="onAbilityClick($event, ability, false)"
      @click="onAbilityClick($event, ability, true)"
      tabindex="-1"
    >
      <div class="icon-placeholder" :style="{ backgroundImage: `url(${ability.icon})` }"></div>
      <span class="mana-cost">{{ ability.manaCost }}</span>
      <span class="ability-name">{{ ability.name }}</span>
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from "vue";
import type { PropType } from "vue";
import type { CharacterController } from "@/DreamHopper/player/CharacterController";
import type { CharacterAnimationManager } from "@/DreamHopper/player/CharacterAnimationManager";
import { nextTick } from "vue";

interface Vector3Config {
  x: number;
  y: number;
  z: number;
}

interface ColorConfig {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface SoundConfig {
  file: string;
  volume: number;
  loop: boolean;
  spatialSound: boolean;
  maxDistance: number;
  attachToMesh: boolean;
}

interface ParticleConfig {
  texture: string;
  minSize: number;
  maxSize: number;
  minLifeTime: number;
  maxLifeTime: number;
  emitRate: number;
  blendMode: number;
  color1: ColorConfig;
  color2: ColorConfig;
  colorDead: ColorConfig;
  minEmitBox?: Vector3Config;
  maxEmitBox?: Vector3Config;
  gravity?: Vector3Config;
  direction1?: Vector3Config;
  direction2?: Vector3Config;
  minAngularSpeed?: number;
  maxAngularSpeed?: number;
  minEmitPower?: number;
  maxEmitPower?: number;
  updateSpeed?: number;
}

interface ProjectileConfig {
  diameter: number;
  speed: number;
  material: {
    diffuseColor: ColorConfig;
    emissiveColor: ColorConfig;
    alpha: number;
    specularPower: number;
    backFaceCulling: boolean;
  };
  lifetime: number;
}

interface DamageConfig {
  min: number;
  max: number;
  levelScaling: number;
}

interface HealingConfig {
  baseHeal: number;
  levelScaling: number;
}

interface AnimationConfig {
  name: string;
  speed: number;
  loop: boolean;
  triggerFrame: number;
}

interface AbilityConfig {
  id: string;
  name: string;
  type: string;
  manaCost: number;
  icon?: string; // New: Added icon property
  animation: AnimationConfig;
  damage?: DamageConfig;
  healing?: HealingConfig;
  sounds: {
    cast?: SoundConfig;
    launch?: SoundConfig;
    travel?: SoundConfig;
    impact?: SoundConfig;
  };
  particles?: {
    cast?: ParticleConfig;
    projectile?: ParticleConfig;
    impact?: ParticleConfig;
  };
  projectile?: ProjectileConfig;
}

export default defineComponent({
  name: "ActionBar",
  props: {
    canvas: {
      type: Object as PropType<HTMLCanvasElement | null>,
      required: false,
      default: null,
    },
    characterController: {
      type: Object as PropType<CharacterController | null>,
      required: false,
      default: null,
    },
    characterAnimationManager: {
      type: Object as PropType<CharacterAnimationManager | null>,
      required: false,
      default: null,
    },
  },
  setup(props) {
    const abilities = ref<AbilityConfig[]>([]);

    // Load abilities from abilities.json
    const loadAbilities = async () => {
      try {
        const response = await fetch("./abilities.json");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        abilities.value = await response.json();
        console.log("ActionBar: Abilities loaded successfully", abilities.value);
      } catch (error) {
        console.error("ActionBar: Failed to load abilities:", error);
        // No fallback; log error and keep empty abilities array
      }
    };

    // Called when a button is clicked
    const onAbilityClick = (event: MouseEvent, ability: AbilityConfig, execute: boolean) => {
      event.preventDefault();
      if (execute) {
        if (props.canvas && document.activeElement !== props.canvas) {
          props.canvas.focus();
          console.log("ActionBar: Canvas refocused");
        }
        if (!props.characterController || !props.characterAnimationManager) {
          console.warn("ActionBar: Missing controller or animation manager");
          return;
        }
        if (props.characterAnimationManager.isAnimationPlaying(ability.animation.name)) {
          console.log(`ActionBar: Cannot trigger ${ability.name}; animation is playing`);
          return;
        }
        console.log(`ActionBar: Attempting to cast ${ability.name} (ID: ${ability.id})`);

        window.dispatchEvent(
          new CustomEvent("cast-ability", {
            detail: { abilityId: ability.id },
          })
        );

        console.log(`ActionBar: Triggered ${ability.name}`);
      }
    };

    onMounted(() => {
      console.log("ActionBar: Mounted, characterController:", props.characterController);
      console.log("ActionBar: Mounted, characterAnimationManager:", props.characterAnimationManager);
      loadAbilities();
    });

    return { abilities, onAbilityClick };
  },
});
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap");

.action-bar {
  display: flex;
  justify-content: center;
  gap: 12px;
  position: fixed;
  bottom: 90px;
  left: 50%;
  transform: translateX(-50%);
  padding: 14px 22px;
  background: rgba(30, 30, 60, 0.85);
  border: 2px solid rgba(200, 200, 255, 0.2);
  border-radius: 16px;
  box-shadow:
    0 0 12px rgba(100, 200, 255, 0.3),
    0 0 24px rgba(90, 180, 255, 0.2),
    inset 0 0 10px rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  z-index: 1000;
  font-family: "Cinzel", serif;
}

.action-button {
  position: relative;
  width: 56px;
  height: 56px;
  background: linear-gradient(145deg, #2a1f3a, #151120);
  border: 2px solid #6a5acd;
  border-radius: 10px;
  cursor: pointer;
  overflow: hidden;
  box-shadow:
    inset 0 0 5px rgba(0, 0, 0, 0.8),
    0 3px 6px rgba(0, 0, 0, 0.6),
    0 0 10px rgba(138, 43, 226, 0.2);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.action-button:hover {
  transform: scale(1.1);
  border-color: #d8b4fe;
  box-shadow:
    0 0 12px #c084fc,
    inset 0 0 12px #f3e8ff;
}

.icon-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  background-size: contain; /* Changed to 'contain' to ensure the entire icon is visible */
  background-position: center;
  background-repeat: no-repeat; /* Prevent tiling */
  box-shadow: inset 0 0 8px rgba(255, 255, 255, 0.2);
  filter: brightness(1.1);
}

.mana-cost {
  position: absolute;
  bottom: 3px;
  right: 3px;
  font-size: 10px;
  font-weight: bold;
  color: #7dd3fc;
  background: rgba(0, 0, 0, 0.6);
  padding: 1px 4px;
  border-radius: 4px;
  text-shadow: 0 0 2px #000;
  box-shadow: 0 0 4px rgba(125, 211, 252, 0.5);
  font-family: "Cinzel", serif;
}

.ability-name {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: #ffe066;
  background: rgba(30, 20, 10, 0.9);
  padding: 2px 6px;
  border-radius: 6px;
  font-family: "Cinzel", serif;
  text-shadow: 0 0 3px rgba(255, 230, 102, 0.7);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0.95;
  box-shadow: 0 0 5px rgba(255, 234, 167, 0.3);
}
</style>