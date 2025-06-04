<template>
  <main>
    <canvas ref="canvas" tabindex="0"></canvas>
    <CastingBar v-if="animationManager" :animation-manager="animationManager" />
    <QuestDialog
      :visible="dialogState.visible"
      :quest="dialogState.quest"
      :canvas="canvas"
      @accept="handleAccept"
      @deny="handleDeny"
      @close="handleClose"
      @turnIn="handleTurnIn"
      :key="dialogState.questKey"
    />
    <HPBar
      v-if="playerHP"
      :current-h-p="playerHP.currentHP"
      :max-h-p="playerHP.maxHP"
    />
    <QuestLog
      v-if="activeQuests"
      :quests="activeQuests"
    />
    <DeathScreen
      :visible="isDeathScreenVisible"
      @restart="handleRestart"
    />
    <HelpDialog
      :visible="showHelpDialog"
      :steps="helpDialogSteps"
      :onClose="closeHelpDialog"
    />
  </main>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, reactive, watch } from "vue";
import { Game } from "@/DreamHopper/Game";
import CastingBar from "./CastingBar.vue";
import DeathScreen from "./DeathScreen.vue";
import QuestDialog from "./QuestDialog.vue";
import HPBar from "./HPBar.vue";
import HelpDialog from "./HelpDialog.vue";
import QuestLog from "./QuestLog.vue";
import { Quest } from "@/DreamHopper/npc/Quest";
import { Vector3, Observer } from "@babylonjs/core";

export default defineComponent({
  name: "DreamHopper",
  components: {
    CastingBar,
    QuestDialog,
    HPBar,
    QuestLog,
    DeathScreen,
    HelpDialog,
  },
  setup() {
    const canvas = ref<HTMLCanvasElement | null>(null);
    const animationManager = ref<any>(null);
    const dreamCrystalManager = ref<any>(null);
    const playerHP = ref<{ currentHP: number; maxHP: number } | null>(null);
    const activeQuests = ref<Quest[]>([]);
    const isDeathScreenVisible = ref(false);
    let gameInstance: Game | null = null;
    let questObserver: Observer<Quest> | null = null;

    const dialogState = reactive({
      visible: false,
      quest: null as Quest | null,
      questKey: 0,
    });

    const handleAccept = () => {
      console.log("DreamHopper: Quest accepted!");
      if (gameInstance) {
        gameInstance.handleQuestAccept();
        dialogState.questKey++;
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
        dialogState.visible = false;
      }
    };

    const handleTurnIn = () => {
      console.log("DreamHopper: Quest turned in!");
      if (gameInstance) {
        gameInstance.handleQuestTurnIn();
        dialogState.questKey++;
      }
    };

    const handleRestart = () => {
      console.log("DreamHopper: Restarting game");
      if (gameInstance) {
        const player = gameInstance.getCharacterController()?.getPlayer();
        if (player) {
          player.reset();
          const characterMesh = gameInstance.getCharacterController()?.characterMeshLoader.getCharacterMesh();
          if (characterMesh) {
            characterMesh.position = new Vector3(5, 5, 0);
          }
          gameInstance.getCharacterController()?.playIdleAnimation();
          gameInstance.getCharacterController()?.animationManager.stopAllAnimations();
          isDeathScreenVisible.value = false;
          console.log("DreamHopper: Player respawned, death screen hidden");
          activeQuests.value = [];
        }
      }
    };

    const updateActiveQuests = () => {
      if (gameInstance) {
        const player = gameInstance.getCharacterController()?.getPlayer();
        if (player) {
          activeQuests.value = player.getActiveQuests();
          console.log(`DreamHopper: Updated activeQuests, count: ${activeQuests.value.length}`);
        }
      }
    };

    const showHelpDialog = ref(false);
    const helpDialogPermanentlyDismissed = ref(false);

    const helpDialogSteps = [
      "Appuyez sur Z pour avancer, S pour reculer, A et E pour vous déplacer latéralement, Q et D pour pivoter. Appuyez sur L pour activer/désactiver le clavier QWERTY.",
      "Maintenez le clic gauche pour faire pivoter la caméra autour du personnage, et le clic droit pour contrôler la rotation avec la souris.",
      "Sélectionnez un PNJ et appuyez sur T pour interagir."
    ];

    const closeHelpDialog = (permanently = false) => {
      showHelpDialog.value = false;
      if (permanently) {
        helpDialogPermanentlyDismissed.value = true;
      }
    };

    onMounted(async () => {
      if (canvas.value) {
        gameInstance = new Game(canvas.value);
        await gameInstance.waitForInitialization();
        animationManager.value = gameInstance.getAnimationManager();
        dreamCrystalManager.value = gameInstance.getDreamCrystalManager();
        playerHP.value = gameInstance.getPlayerHP();
        updateActiveQuests();

        dialogState.visible = gameInstance.getShowQuestDialog();
        dialogState.quest = gameInstance.getCurrentQuest();

        gameInstance.getOnQuestDialogToggled().add((isVisible) => {
          dialogState.visible = isVisible;
          dialogState.quest = gameInstance!.getCurrentQuest();
          dialogState.questKey++;
        });

        const player = gameInstance.getCharacterController()?.getPlayer();
        if (player) {
          questObserver = player.onQuestStateChanged.add((quest) => {
            console.log(`DreamHopper: Quest ${quest.getId()} state changed, status: ${quest.getState().status}`);
            updateActiveQuests();
          });

          player.onDeathObservable.add(() => {
            isDeathScreenVisible.value = true;
            activeQuests.value = [];
            console.log("DreamHopper: Player died, cleared activeQuests");
          });
        }

        const hpInterval = setInterval(() => {
          if (gameInstance) {
            playerHP.value = gameInstance.getPlayerHP();
          }
        }, 500);

        onUnmounted(() => {
          clearInterval(hpInterval);
          if (player && questObserver) {
            player.onQuestStateChanged.remove(questObserver);
            console.log("DreamHopper: Unsubscribed from onQuestStateChanged");
          }
        });

        setTimeout(() => {
          if (!helpDialogPermanentlyDismissed.value) {
            showHelpDialog.value = true;
          }
        }, 5000);
      }
    });

    watch(
      () => dialogState.quest?.getState().status,
      (newStatus) => {
        if (newStatus) {
          dialogState.questKey++;
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
      playerHP,
      activeQuests,
      isDeathScreenVisible,
      handleAccept,
      handleDeny,
      handleClose,
      handleTurnIn,
      handleRestart,
      showHelpDialog,
      helpDialogSteps,
      closeHelpDialog,
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
</style>