<template>
  <main>
    <canvas ref="canvas"></canvas>
    <CastingBar v-if="animationManager" :animation-manager="animationManager" />
    <DreamCrystalCounter v-if="dreamCrystalManager" :dream-crystal-manager="dreamCrystalManager" />

    <!-- Spell bar container -->
    <div class="spell-bar">
      <!-- Spell slot examples (empty slots) -->
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
    </div>
  </main>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from "vue";
import { Game } from "@/DreamHopper/Game";
import CastingBar from "./CastingBar.vue";
import DreamCrystalCounter from "./DreamCrystalCounter.vue";

export default defineComponent({
  name: "DreamHopper",
  components: { CastingBar, DreamCrystalCounter },
  setup() {
    const canvas = ref<HTMLCanvasElement | null>(null);
    const animationManager = ref<any>(null);
    const dreamCrystalManager = ref<any>(null);

    onMounted(async () => {
      if (canvas.value) {
        const game = new Game(canvas.value);
        await game.waitForInitialization();
        animationManager.value = game.getAnimationManager();
        dreamCrystalManager.value = game.getDreamCrystalManager();
        console.log("DreamHopper: animationManager set:", animationManager.value);
        console.log("DreamHopper: dreamCrystalManager set:", dreamCrystalManager.value);
        if (!animationManager.value) {
          console.error("DreamHopper: Failed to get animationManager after initialization");
        }
        if (!dreamCrystalManager.value) {
          console.error("DreamHopper: Failed to get dreamCrystalManager after initialization");
        }
      }
    });

    return { canvas, animationManager, dreamCrystalManager };
  },
});
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Roboto+Condensed&family=Roboto:wght@100;700&display=swap");

main {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  margin: 0;
}

canvas {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  box-shadow: 8px 8px 10px -6px #000000;
}

.spell-bar {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 10px;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 15px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
}

.spell-slot {
  width: 50px;
  height: 50px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  border: 2px solid #444;
  position: relative;
  cursor: url("../../public/images/cursorTargetAlly.png"), auto;
}

.spell-slot:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

.spell-slot.active {
  border: 2px solid #ffcc00;
  box-shadow: 0 0 10px #ffcc00;
}
</style>