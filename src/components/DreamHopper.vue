<template>
  <main>
    <canvas ref="canvas"></canvas>
    <CastingBar v-if="animationManager" :animation-manager="animationManager" />
    <DreamCrystalCounter v-if="dreamCrystalManager" :dream-crystal-manager="dreamCrystalManager" />
    <QuestDialog v-if="showQuestDialog" @accept="handleAccept" @deny="handleDeny" />
  </main>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted } from "vue";
import { Game } from "@/DreamHopper/Game";
import CastingBar from "./CastingBar.vue";
import DreamCrystalCounter from "./DreamCrystalCounter.vue";
import QuestDialog from "./QuestDialog.vue";

export default defineComponent({
  name: "DreamHopper",
  components: { CastingBar, DreamCrystalCounter, QuestDialog },
  setup() {
    const canvas = ref<HTMLCanvasElement | null>(null);
    const animationManager = ref<any>(null);
    const dreamCrystalManager = ref<any>(null);
    const showQuestDialog = ref(false);
    let gameInstance: Game | null = null;

    const handleAccept = () => {
      console.log("Quest accepted!");
      showQuestDialog.value = false;
      if (gameInstance) {
        gameInstance.toggleQuestDialog(); // Sync with Game state
      }
    };

    const handleDeny = () => {
      console.log("Quest denied!");
      showQuestDialog.value = false;
      if (gameInstance) {
        gameInstance.toggleQuestDialog(); // Sync with Game state
      }
    };

    onMounted(async () => {
      if (canvas.value) {
        gameInstance = new Game(canvas.value);
        await gameInstance.waitForInitialization();
        animationManager.value = gameInstance.getAnimationManager();
        dreamCrystalManager.value = gameInstance.getDreamCrystalManager();

        // Subscribe to quest dialog toggle events
        gameInstance.getOnQuestDialogToggled().add((isVisible) => {
          showQuestDialog.value = isVisible;
        });
      }
    });

    onUnmounted(() => {
      if (gameInstance) {
        gameInstance.dispose();
      }
    });

    return {
      canvas,
      animationManager,
      dreamCrystalManager,
      showQuestDialog,
      handleAccept,
      handleDeny,
    };
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