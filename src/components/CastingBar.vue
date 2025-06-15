<template>
  <div v-if="isVisible" class="casting-bar">
    <div class="casting-bar-container">
      <div class="casting-bar-progress" :style="{ width: `${progress}%` }"></div>
      <span class="casting-bar-text">{{ abilityName }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, onMounted, onUnmounted } from "vue";
import { Observable } from "@babylonjs/core";
import { AbilityConfig } from "@/DreamHopper/player/AbilityConfig"; // Import AbilityConfig interface

interface AbilityAnimationState {
  abilityId: string;
  isPlaying: boolean;
  progress?: number;
}

export default defineComponent({
  name: "CastingBar",
  props: {
    animationManager: {
      type: Object as () => { onAbilityAnimationState: Observable<AbilityAnimationState> } | null,
      default: null,
    },
  },
  setup(props) {
    const isVisible = ref(false);
    const progress = ref(0);
    const abilityName = ref(""); // Dynamic ability name
    const abilities = ref<AbilityConfig[]>([]); // Store abilities from JSON
    let updateCallback: ((state: AbilityAnimationState) => void) | null = null;

    // Load abilities.json
    const loadAbilities = async () => {
      try {
        const response = await fetch("./abilities.json");
        abilities.value = await response.json();
        console.log("CastingBar: Loaded abilities", abilities.value);
      } catch (error) {
        console.error("CastingBar: Failed to load abilities.json", error);
      }
    };

    const updateCastingBar = ({ abilityId, isPlaying, progress: animProgress }: AbilityAnimationState) => {
      const ability = abilities.value.find((a) => a.id === abilityId);
      if (!ability) {
        console.warn(`CastingBar: Ability ${abilityId} not found`);
        isVisible.value = false;
        progress.value = 0;
        return;
      }

      // Set the ability name for display
      abilityName.value = ability.name;

      // Show the casting bar until the trigger frame (if defined)
      const triggerFrame = ability.animation.triggerFrame ?? 1.0; // Default to 1.0 if not specified
      if (isPlaying && typeof animProgress === "number" && animProgress < triggerFrame) {
        isVisible.value = true;
        progress.value = Math.min((animProgress / triggerFrame) * 100, 100);
        console.log(`Casting bar progress for ${abilityId}: ${progress.value}% (animation: ${animProgress * 100}%)`);
      } else {
        isVisible.value = false;
        progress.value = 0;
        console.log(`Casting bar hidden for ${abilityId}`);
      }
    };

    const setupObserver = () => {
      if (props.animationManager?.onAbilityAnimationState) {
        updateCallback = updateCastingBar;
        props.animationManager.onAbilityAnimationState.add(updateCallback);
        console.log("CastingBar: Attached ability animation state observer");
      }
    };

    onMounted(async () => {
      await loadAbilities(); // Load abilities on mount
      setupObserver();
    });

    watch(
      () => props.animationManager,
      (newVal, oldVal) => {
        if (oldVal?.onAbilityAnimationState && updateCallback) {
          oldVal.onAbilityAnimationState.removeCallback(updateCallback);
          console.log("CastingBar: Removed old ability animation state observer");
        }
        setupObserver();
      }
    );

    onUnmounted(() => {
      if (props.animationManager?.onAbilityAnimationState && updateCallback) {
        props.animationManager.onAbilityAnimationState.removeCallback(updateCallback);
        console.log("CastingBar: Removed ability animation state observer on unmount");
      }
    });

    return { isVisible, progress, abilityName };
  },
});
</script>

<style scoped>
.casting-bar {
  position: fixed;
  bottom: 20vh;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: none;
}

.casting-bar-container {
  width: 320px;
  height: 42px;
  background: linear-gradient(145deg, #1e1e1e, #2a2a2a);
  border: 2px solid #00ccff;
  border-radius: 20px;
  box-shadow: 0 0 10px rgba(0, 204, 255, 0.4), 0 0 20px rgba(0, 204, 255, 0.2) inset;
  position: relative;
  overflow: hidden;
}

.casting-bar-container::before {
  content: "";
  position: absolute;
  top: 0;
  left: -75%;
  width: 50%;
  height: 100%;
  background: linear-gradient(120deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.3) 50%, rgba(255, 255, 255, 0.1) 100%);
  transform: skewX(-20deg);
  animation: shimmer 2.5s infinite;
}

@keyframes shimmer {
  0% {
    left: -75%;
  }
  100% {
    left: 125%;
  }
}

.casting-bar-progress {
  height: 100%;
  background: linear-gradient(to right, #00ccff, #33ffee);
  box-shadow: 0 0 10px rgba(0, 204, 255, 0.5), 0 0 25px rgba(0, 204, 255, 0.3);
  transition: width 0.1s linear;
  border-radius: 20px 0 0 20px;
}

.casting-bar-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ffffff;
  font-family: "Orbitron", "Roboto Condensed", sans-serif;
  font-size: 17px;
  font-weight: bold;
  letter-spacing: 0.5px;
  text-shadow: 0 0 5px #00ccff, 0 0 10px rgba(0, 204, 255, 0.6);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.85;
  }
  100% {
    opacity: 1;
  }
}
</style>