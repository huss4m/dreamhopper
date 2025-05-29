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
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 14px 30px;
  background: linear-gradient(135deg, #5a47d1, #1e2a78);
  border-radius: 16px;
  border: 1.5px solid #9b85ff;
  box-shadow: 0 4px 10px rgba(90, 71, 209, 0.5);
  color: #d9dbff;
  font-family: "Roboto Condensed", sans-serif;
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 1.3px;
  text-transform: uppercase;
  text-shadow: 0 0 3px #7365e0;
  user-select: none;
  cursor: default;
  z-index: 1000;
}

  </style>