
<template>
  <div class="action-bar">
    <button
      v-for="ability in abilities"
      :key="ability.id"
      class="action-button"
      :ref="setButtonRef(ability.id)"
      :title="`${ability.name} - ${ability.manaCost} Mana (Key: ${getKeyBinding(ability.id)})`"
      @mousedown.prevent="onAbilityClick($event, ability, false)"
      @click="onAbilityClick($event, ability, true)"
      tabindex="-1"
    >
      <div class="icon-placeholder" :style="{ backgroundImage: `url(${ability.icon})` }"></div>
      <span class="mana-cost">{{ ability.manaCost }}</span>
      <span class="ability-name">{{ ability.name }}</span>
      <span class="key-binding">{{ getKeyBinding(ability.id) }}</span>
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, PropType, VNodeRef, ComponentPublicInstance, watch } from "vue";
import type { CharacterController } from "@/DreamHopper/player/CharacterController";
import type { CharacterAnimationManager } from "@/DreamHopper/player/CharacterAnimationManager";
import type { InputHandler } from "@/DreamHopper/InputHandler";
import { Observer } from "@babylonjs/core";

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
  icon?: string;
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
    inputHandler: {
      type: Object as PropType<InputHandler | null>,
      required: false,
      default: null,
    },
  },
  setup(props) {
    const abilities = ref<AbilityConfig[]>([]);
    const buttonRefs = ref<{ [key: string]: HTMLElement | null }>({});
    let abilityTriggerObserver: Observer<{ abilityId: string }> | null = null;

    const setButtonRef = (abilityId: string) => {
      return (el: Element | ComponentPublicInstance | null) => {
        if (el instanceof HTMLElement) {
          buttonRefs.value[abilityId] = el;
          console.log(`ActionBar: Stored ref for ${abilityId}`, el);
        } else {
          buttonRefs.value[abilityId] = null;
          console.log(`ActionBar: Null ref for ${abilityId}`, el);
        }
      };
    };

    const triggerFlareAnimation = (abilityId: string) => {
      console.log(`ActionBar: Attempting to trigger flare for ${abilityId}`);
      console.log(`ActionBar: buttonRefs for ${abilityId}`, buttonRefs.value[abilityId]);
      const button = buttonRefs.value[abilityId];
      if (button) {
        console.log(`ActionBar: Applying flare class to ${abilityId}`);
        button.classList.add("flare");
        setTimeout(() => {
          button.classList.remove("flare");
          console.log(`ActionBar: Removed flare class from ${abilityId}`);
        }, 300); // Matches animation duration
      } else {
        console.warn(`ActionBar: No button found for ${abilityId}`);
      }
    };

    const loadAbilities = async () => {
      try {
        const response = await fetch("./abilities.json");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        abilities.value = await response.json();
        console.log("ActionBar: Abilities loaded successfully", abilities.value.map(a => a.id));
      } catch (error) {
        console.error("ActionBar: Failed to load abilities:", error);
      }
    };

    const getKeyBinding = (abilityId: string): string => {
      if (!props.inputHandler) {
        console.warn(`ActionBar: InputHandler not available for ability ${abilityId}`);
        return "?";
      }
      const action = `cast${abilityId.charAt(0).toUpperCase() + abilityId.slice(1)}`;
      const key = props.inputHandler.getKeyForAction(action);
      if (!key) {
        console.warn(`ActionBar: No key binding found for action ${action}`);
        return "?";
      }
      return key.toUpperCase();
    };

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
        triggerFlareAnimation(ability.id); // Trigger flare on click
      }
    };

    const setupObserver = () => {
      if (props.inputHandler && !abilityTriggerObserver) {
        console.log("ActionBar: Setting up ability trigger observer");
        abilityTriggerObserver = props.inputHandler.getOnAbilityTriggered().add(({ abilityId }) => {
          console.log(`ActionBar: Received ability trigger for ${abilityId}`);
          triggerFlareAnimation(abilityId);
        });
        console.log("ActionBar: Subscribed to onAbilityTriggered", abilityTriggerObserver);
      } else if (!props.inputHandler) {
        console.warn("ActionBar: inputHandler is null, cannot subscribe to onAbilityTriggered");
      }
    };

    onMounted(() => {
      console.log("ActionBar: Mounted, inputHandler:", props.inputHandler);
      setupObserver();
      loadAbilities();
    });

    watch(() => props.inputHandler, (newInputHandler) => {
      console.log("ActionBar: inputHandler changed", newInputHandler);
      if (newInputHandler && !abilityTriggerObserver) {
        setupObserver();
      }
    });

    onUnmounted(() => {
      if (abilityTriggerObserver && props.inputHandler) {
        props.inputHandler.getOnAbilityTriggered().remove(abilityTriggerObserver);
        console.log("ActionBar: Unsubscribed from onAbilityTriggered");
      }
    });

    return { abilities, onAbilityClick, getKeyBinding, setButtonRef };
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

.action-button.flare {
  animation: flare 0.3s ease-out;
}

.action-button.flare::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 14px;
  height: 14px;
  background: radial-gradient(circle, rgba(255, 255, 255, 1) 20%, rgba(255, 230, 100, 0.5) 70%, transparent);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  animation: sparkle 0.3s ease-out;
  z-index: 2;
}

.action-button.flare::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.9) 30%, transparent);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  animation: sparkle-small 0.3s ease-out 0.15s;
  z-index: 2;
}

@keyframes flare {
  0% {
    background: linear-gradient(145deg, #2a1f3a, #151120);
  }
  50% {
    background: radial-gradient(circle at center, rgba(255, 255, 255, 0.9) 20%, rgba(255, 230, 100, 0.6) 50%, #2a1f3a 80%);
  }
  100% {
    background: linear-gradient(145deg, #2a1f3a, #151120);
  }
}

@keyframes sparkle {
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 1;
  }
  50% {
    transform: translate(-50%, -50%) scale(4);
    opacity: 0.9;
  }
  100% {
    transform: translate(-50%, -50%) scale(6);
    opacity: 0;
  }
}

@keyframes sparkle-small {
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 1;
  }
  50% {
    transform: translate(-50%, -50%) scale(3);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(4);
    opacity: 0;
  }
}

.icon-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
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

.key-binding {
  position: absolute;
  top: 3px;
  left: 3px;
  font-size: 10px;
  font-weight: bold;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.6);
  padding: 1px 4px;
  border-radius: 4px;
  text-shadow: 0 0 2px #000;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
  font-family: "Cinzel", serif;
}
</style>
