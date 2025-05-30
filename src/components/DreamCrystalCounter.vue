<template>
    <div class="crystal-counter">
      Dream Crystals: {{ collectedCrystals }}/{{ totalCrystals }}
    </div>
  </template>
  
  <script lang="ts">
  import { defineComponent, ref, onMounted, onUnmounted, watch } from "vue";
  import { Observable, Vector3 } from "@babylonjs/core";
  
  export default defineComponent({
    name: "DreamCrystalCounter",
    props: {
      dreamCrystalManager: {
        type: Object as () => { getState: () => { positions: Vector3[]; collected: boolean[] }; getOnCrystalCollectedObservable: () => Observable<void> } | null,
        default: null,
      },
    },
    setup(props) {
      const collectedCrystals = ref(0);
      const totalCrystals = ref(0);
  
      const updateCrystalCount = () => {
        if (props.dreamCrystalManager) {
          const state = props.dreamCrystalManager.getState();
          collectedCrystals.value = state.collected.filter(c => c).length;
          totalCrystals.value = state.positions.length;
          console.log(`DreamCrystalCounter: Updated count to ${collectedCrystals.value}/${totalCrystals.value}`);
        }
      };
  
      let collectObserver: (() => void) | null = null;
  
      const setupObserver = () => {
        if (props.dreamCrystalManager?.getOnCrystalCollectedObservable) {
          updateCrystalCount(); // Initial count
          collectObserver = () => updateCrystalCount();
          props.dreamCrystalManager.getOnCrystalCollectedObservable().add(collectObserver);
          console.log("DreamCrystalCounter: Attached crystal collection observer");
        }
      };
  
      onMounted(() => {
        setupObserver();
      });
  
      watch(() => props.dreamCrystalManager, (newVal, oldVal) => {
        if (oldVal?.getOnCrystalCollectedObservable && collectObserver) {
          oldVal.getOnCrystalCollectedObservable().removeCallback(collectObserver);
          console.log("DreamCrystalCounter: Removed old crystal collection observer");
        }
        setupObserver();
      });
  
      onUnmounted(() => {
        if (props.dreamCrystalManager?.getOnCrystalCollectedObservable && collectObserver) {
          props.dreamCrystalManager.getOnCrystalCollectedObservable().removeCallback(collectObserver);
          console.log("DreamCrystalCounter: Removed crystal collection observer on unmount");
        }
      });
  
      return { collectedCrystals, totalCrystals };
    },
  });
  </script>
  
  <style scoped>
.crystal-counter {
  position: fixed;
  top: 5vh;
  left: 50%;
  transform: translateX(-50%);
  padding: 18px 40px;
  background: rgba(135, 206, 250, 0.85); /* baby blue, slightly transparent */
  border-radius: 24px;
  border: 2.5px solid rgba(100, 180, 255, 0.8);
  box-shadow:
    0 0 30px rgba(100, 180, 255, 0.9),
    0 0 60px rgba(135, 206, 250, 0.7),
    inset 0 0 20px rgba(180, 220, 255, 0.5);
  color: #e0f7ff;
  font-family: "Roboto Condensed", sans-serif;
  font-weight: 700;
  font-size: 22px;
  letter-spacing: 1.8px;
  text-transform: uppercase;
  text-shadow:
    0 0 12px rgba(180, 210, 255, 1),
    0 0 20px rgba(150, 190, 255, 0.8);
  user-select: none;
  cursor: default;
  z-index: 1000;
  backdrop-filter: blur(10px);
  animation:
    dreamyPulseBlue 5s ease-in-out infinite,
    floatUpDown 6s ease-in-out infinite;
  max-width: 90vw;
  text-align: center;
  position: fixed;
}

@keyframes dreamyPulseBlue {
  0%, 100% {
    box-shadow:
      0 0 30px rgba(100, 180, 255, 0.9),
      0 0 60px rgba(135, 206, 250, 0.7),
      inset 0 0 20px rgba(180, 220, 255, 0.5);
    color: #e0f7ff;
  }
  50% {
    box-shadow:
      0 0 50px rgba(150, 210, 255, 1),
      0 0 80px rgba(180, 230, 255, 0.85),
      inset 0 0 30px rgba(210, 240, 255, 0.6);
    color: #f0fbff;
  }
}


  </style>