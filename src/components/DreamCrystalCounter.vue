<template>
    <div class="crystal-counter">
      Fragments de rêve: {{ collectedCrystals }}/12
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
  top: 30px; /* Match Luma bar */
  left: 50%;
  transform: translateX(-50%); /* Center horizontally only */
  padding: 12px 30px; /* Match Luma bar’s vertical padding */
  background: linear-gradient(135deg, #5e3a9c 0%, #b56bf7 100%);
  border-radius: 15px;
  border: 2px solid #e0c4ff;
  box-shadow:
    0 0 20px rgba(181, 107, 247, 0.6),
    0 0 40px rgba(181, 107, 247, 0.4),
    inset 0 0 10px rgba(255, 255, 255, 0.1);
  color: #f5e9ff;
  font-family: "Quicksand", sans-serif;
  font-weight: bold;
  font-size: 18px;
  letter-spacing: 1.2px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  animation: pulsePurple 4s ease-in-out infinite;
  z-index: 1000;
  max-width: 90vw;
  text-align: center;
}


@keyframes pulsePurple {
  0%, 100% {
    box-shadow:
      0 0 20px rgba(181, 107, 247, 0.6),
      0 0 40px rgba(181, 107, 247, 0.4),
      inset 0 0 10px rgba(255, 255, 255, 0.1);
  }
  50% {
    box-shadow:
      0 0 30px rgba(204, 128, 255, 0.7),
      0 0 60px rgba(214, 160, 255, 0.5),
      inset 0 0 15px rgba(255, 255, 255, 0.15);
  }
}



  </style>