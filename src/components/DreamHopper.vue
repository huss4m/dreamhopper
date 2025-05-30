<template>
  <main>
    <canvas ref="canvas"></canvas>
    <CastingBar v-if="animationManager" :animation-manager="animationManager" />
    <DreamCrystalCounter v-if="dreamCrystalManager" :dream-crystal-manager="dreamCrystalManager" />
    <QuestDialog
      :visible="dialogState.visible"
      :quest="dialogState.quest"
      @accept="handleAccept"
      @deny="handleDeny"
      @close="handleClose"
      @turnIn="handleTurnIn" 
      :key="dialogState.questKey" 
    />
  </main>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, reactive, watch } from "vue";
import { Game } from "@/DreamHopper/Game";
import CastingBar from "./CastingBar.vue";
import DreamCrystalCounter from "./DreamCrystalCounter.vue";
import QuestDialog from "./QuestDialog.vue";
import { Quest } from "@/DreamHopper/npc/Quest";

export default defineComponent({
  name: "DreamHopper",
  components: { CastingBar, DreamCrystalCounter, QuestDialog },
  setup() {
    const canvas = ref<HTMLCanvasElement | null>(null);
    const animationManager = ref<any>(null);
    const dreamCrystalManager = ref<any>(null);
    let gameInstance: Game | null = null;

    // Reactive state for dialog
    const dialogState = reactive({
      visible: false,
      quest: null as Quest | null,
      questKey: 0, // For forcing re-render
    });

    const handleAccept = () => {
      console.log("DreamHopper: Quest accepted!");
      if (gameInstance) {
        gameInstance.handleQuestAccept();
        dialogState.questKey++; // Update key to force re-render
      }
    };

    const handleDeny = () => {
      console.log("DreamHopper: Quest denied!");
      if (gameInstance) {
        gameInstance.handleQuestDeny();
      }
    };

    const handleClose = () => {
      console.log("DreamHopper: Quest dialog closed!");
      if (gameInstance) {
        gameInstance.handleQuestClose();
      }
    };

    const handleTurnIn = () => { // Added handleTurnIn
      console.log("DreamHopper: Quest turned in!");
      if (gameInstance) {
        gameInstance.handleQuestTurnIn();
        dialogState.questKey++; // Update key to force re-render
      }
    };

    onMounted(async () => {
      if (canvas.value) {
        gameInstance = new Game(canvas.value);
        await gameInstance.waitForInitialization();
        animationManager.value = gameInstance.getAnimationManager();
        dreamCrystalManager.value = gameInstance.getDreamCrystalManager();

        // Initialize dialog state
        dialogState.visible = gameInstance.getShowQuestDialog();
        dialogState.quest = gameInstance.getCurrentQuest();
        console.log(`DreamHopper: Initial dialog state - visible=${dialogState.visible}, quest=${dialogState.quest?.getId() ?? "null"}, status=${dialogState.quest?.getState().status ?? "none"}`);

        // Subscribe to quest dialog toggle events
        gameInstance.getOnQuestDialogToggled().add((isVisible) => {
          console.log(`DreamHopper: Quest dialog toggled to ${isVisible}`);
          dialogState.visible = isVisible;
          dialogState.quest = gameInstance!.getCurrentQuest();
          dialogState.questKey++; // Update key to force re-render
          console.log(`DreamHopper: Updated dialog state - visible=${dialogState.visible}, quest=${dialogState.quest?.getId() ?? "null"}, status=${dialogState.quest?.getState().status ?? "none"}`);
        });
      }
    });

    // Watch quest status changes
    watch(
      () => dialogState.quest?.getState().status,
      (newStatus) => {
        if (newStatus) {
          console.log(`DreamHopper: Quest status changed to ${newStatus}`);
          dialogState.questKey++; // Force re-render
        }
      }
    );

    onUnmounted(() => {
      if (gameInstance) {
        gameInstance.dispose();
        gameInstance = null;
      }
    });

    return {
      canvas,
      animationManager,
      dreamCrystalManager,
      dialogState,
      handleAccept,
      handleDeny,
      handleClose,
      handleTurnIn, // Added to return
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