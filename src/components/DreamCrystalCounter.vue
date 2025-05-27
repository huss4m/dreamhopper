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
    padding: 8px 16px;
    background-color: rgba(0, 0, 0, 0.6);
    border-radius: 10px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
    color: #ffffff;
    font-family: "Roboto Condensed", sans-serif;
    font-size: 16px;
    text-shadow: 0 0 5px rgba(0, 0, 0, 0.8);
    z-index: 1000;
  }
  </style>