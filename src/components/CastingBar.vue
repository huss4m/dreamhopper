<template>
    <div v-if="isVisible" class="casting-bar">
      <div class="casting-bar-container">
        <div class="casting-bar-progress" :style="{ width: `${progress}%` }"></div>
        <span class="casting-bar-text">Casting Dreambolt</span>
      </div>
    </div>
  </template>
  
  <script lang="ts">
  import { defineComponent, ref, watch, onMounted, onUnmounted } from "vue";
  import { Observable } from "@babylonjs/core";
  
  interface DreamboltState {
    isPlaying: boolean;
    progress?: number;
  }
  
  export default defineComponent({
    name: "CastingBar",
    props: {
      animationManager: {
        type: Object as () => { onDreamboltAnimationState: Observable<DreamboltState> } | null,
        default: null,
      },
    },
    setup(props) {
      const isVisible = ref(false);
      const progress = ref(0);
      let updateCallback: ((state: DreamboltState) => void) | null = null;
  
      const updateCastingBar = ({ isPlaying, progress: animProgress }: DreamboltState) => {
        if (isPlaying && typeof animProgress === "number") {
          isVisible.value = animProgress < 0.5;
          progress.value = Math.min((animProgress / 0.5) * 100, 100);
          console.log(`Casting bar progress: ${progress.value}% (animation: ${animProgress * 100}%)`);
        } else {
          isVisible.value = false;
          progress.value = 0;
          console.log("Casting bar hidden");
        }
      };
  
      const setupObserver = () => {
        if (props.animationManager?.onDreamboltAnimationState) {
          updateCallback = updateCastingBar;
          props.animationManager.onDreamboltAnimationState.add(updateCallback);
          console.log("CastingBar: Attached Dreambolt animation state observer");
        }
      };
  
      onMounted(() => {
        setupObserver();
      });
  
      watch(() => props.animationManager, (newVal, oldVal) => {
        if (oldVal?.onDreamboltAnimationState && updateCallback) {
          oldVal.onDreamboltAnimationState.removeCallback(updateCallback);
          console.log("CastingBar: Removed old Dreambolt animation state observer");
        }
        setupObserver();
      });
  
      onUnmounted(() => {
        if (props.animationManager?.onDreamboltAnimationState && updateCallback) {
          props.animationManager.onDreamboltAnimationState.removeCallback(updateCallback);
          console.log("CastingBar: Removed Dreambolt animation state observer on unmount");
        }
      });
  
      return { isVisible, progress };
    },
  });
  </script>
  
  <style scoped>
  .casting-bar {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
  }
  
  .casting-bar-container {
    width: 300px;
    height: 40px;
    background-color: rgba(0, 0, 0, 0.6);
    border: 2px solid #ffffff;
    border-radius: 15px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
    position: relative;
    overflow: hidden;
  }
  
  .casting-bar-progress {
    height: 100%;
    background-color: #00ccff;
    transition: width 0.1s linear;
  }
  
  .casting-bar-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #ffffff;
    font-family: "Roboto Condensed", sans-serif;
    font-size: 16px;
    text-shadow: 0 0 5px rgba(0, 0, 0, 0.8);
  }
  </style>