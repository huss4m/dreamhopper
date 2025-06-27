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
      v-if="playerHP && playerMana && xpData"
      :current-h-p="playerHP.currentHP"
      :max-h-p="playerHP.maxHP"
      :current-mana="playerMana.currentMana"
      :max-mana="playerMana.maxMana"
      :level="xpData.level"
    />
    <XPBar
      v-if="xpData"
      :current-x-p="xpData.currentXP"
      :max-x-p="xpData.maxXP"
      :level="xpData.level"
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
    <ActionBar
      v-if="gameInstance"
      :canvas="canvas"
      :characterController="gameInstance.getCharacterController()"
      :characterAnimationManager="gameInstance.getAnimationManager()"
      :inputHandler="gameInstance.getInputHandler()"
    />
  </main>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, reactive, watch } from "vue";
import { Game } from "@/DreamHopper/Game";
import { InputHandler } from "@/DreamHopper/InputHandler"; 
import CastingBar from "./CastingBar.vue";
import DeathScreen from "./DeathScreen.vue";
import QuestDialog from "./QuestDialog.vue";
import HPBar from "./HPBar.vue";
import XPBar from "./XPBar.vue";
import HelpDialog from "./HelpDialog.vue";
import QuestLog from "./QuestLog.vue";
import { Quest } from "@/DreamHopper/npc/Quest";
import { Vector3, Observer } from "@babylonjs/core";
import ActionBar from "./ActionBar.vue";

export default defineComponent({
  name: "DreamHopper",
  components: {
    CastingBar,
    QuestDialog,
    HPBar,
    QuestLog,
    DeathScreen,
    HelpDialog,
    XPBar,
    ActionBar,
  },
  setup() {
    const canvas = ref<HTMLCanvasElement | null>(null);
    const animationManager = ref<any>(null);
    const dreamCrystalManager = ref<any>(null);
    const playerHP = ref<{ currentHP: number; maxHP: number } | null>(null);
    const playerMana = ref<{ currentMana: number; maxMana: number } | null>(null);
    const activeQuests = ref<Quest[]>([]);
    const isDeathScreenVisible = ref(false);

    const gameInstance = ref<Game | null>(null);
    let questObserver: Observer<Quest> | null = null;
    let hpObserver: Observer<{ currentHP: number; maxHP: number }> | null = null;
    let manaObserver: Observer<{ currentMana: number; maxMana: number }> | null = null;
    const xpData = ref<{ currentXP: number; maxXP: number; level: number } | null>(null);
    let xpObserver: Observer<{ currentXP: number; maxXP: number }> | null = null;
    let levelObserver: Observer<{ level: number }> | null = null;

    const dialogState = reactive({
      visible: false,
      quest: null as Quest | null,
      questKey: 0,
    });

    const handleAccept = () => {
      console.log("DreamHopper: Quest accepted!");
      if (gameInstance.value) {
        gameInstance.value.handleQuestAccept();
        dialogState.questKey++;
      }
    };

    const handleDeny = () => {
      console.log("DreamHopper: Quest denied!");
      if (gameInstance.value) {
        gameInstance.value.handleQuestDeny();
      }
    };

    const handleClose = () => {
      console.log("DreamHopper: Quest dialog closed!");
      if (gameInstance.value) {
        gameInstance.value.handleQuestClose();
        dialogState.visible = false;
      }
    };

    const handleTurnIn = () => {
      console.log("DreamHopper: Quest turned in!");
      if (gameInstance.value) {
        gameInstance.value.handleQuestTurnIn();
        dialogState.questKey++;
      }
    };

    const handleRestart = () => {
      console.log("DreamHopper: Restarting game");
      if (gameInstance.value) {
        const player = gameInstance.value.getCharacterController()?.getPlayer();
        if (player) {
          player.reset();
          const characterMesh = gameInstance.value.getCharacterController()?.characterMeshLoader.getCharacterMesh();
          if (characterMesh) {
            characterMesh.position = new Vector3(5, 5, 0);
          }
          gameInstance.value.getCharacterController()?.playIdleAnimation();
          gameInstance.value.getCharacterController()?.animationManager.stopAllAnimations();
          isDeathScreenVisible.value = false;
          console.log("DreamHopper: Player respawned, death screen hidden");
          updateActiveQuests();
        }
      }
    };

    const updateActiveQuests = () => {
      if (gameInstance.value) {
        const player = gameInstance.value.getCharacterController()?.getPlayer();
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
      "Sélectionnez un PNJ et appuyez sur T pour interagir.",
    ];

    const closeHelpDialog = (permanently = false) => {
      showHelpDialog.value = false;
      if (permanently) {
        helpDialogPermanentlyDismissed.value = true;
      }
    };

    onMounted(async () => {
      if (canvas.value) {
        try {
          gameInstance.value = new Game(canvas.value);
          console.log("DreamHopper: gameInstance created:", gameInstance.value);
          console.log("DreamHopper: gameInstance is Game instance:", gameInstance.value instanceof Game);
          console.log("DreamHopper: gameInstance properties before init:", Object.keys(gameInstance.value));

          await gameInstance.value.waitForInitialization();
          console.log("DreamHopper: gameInstance initialized:", gameInstance.value);
          console.log("DreamHopper: gameInstance properties after init:", Object.keys(gameInstance.value));

          animationManager.value = gameInstance.value.getAnimationManager();
          dreamCrystalManager.value = gameInstance.value.getDreamCrystalManager();
          playerHP.value = gameInstance.value.getPlayerHP();
          updateActiveQuests();

          dialogState.visible = gameInstance.value.getShowQuestDialog();
          dialogState.quest = gameInstance.value.getCurrentQuest();

          gameInstance.value.getOnQuestDialogToggled().add((isVisible) => {
            dialogState.visible = isVisible;
            dialogState.quest = gameInstance.value!.getCurrentQuest();
            dialogState.questKey++;
          });

          const player = gameInstance.value.getCharacterController()?.getPlayer();
          if (player) {
            questObserver = player.onQuestStateChanged.add((quest) => {
              console.log(`DreamHopper: Quest ${quest.getId()} state changed, status: ${quest.getState().status}`);
              updateActiveQuests();
            });

            player.onDeathObservable.add(() => {
              isDeathScreenVisible.value = true;
              console.log("DreamHopper: Player died");
            });

            hpObserver = player.onHPChanged.add((hp) => {
              playerHP.value = { currentHP: hp.currentHP, maxHP: hp.maxHP };
              console.log(`DreamHopper: Player HP updated to ${hp.currentHP}/${hp.maxHP}`);
            });

            playerMana.value = {
              currentMana: player.getMana(),
              maxMana: player.getMaxMana(),
            };
            manaObserver = player.onManaChanged.add((mana) => {
              playerMana.value = {
                currentMana: mana.currentMana,
                maxMana: mana.maxMana,
              };
              console.log(`DreamHopper: Mana updated to ${mana.currentMana}/${mana.maxMana}`);
            });

            xpData.value = {
              currentXP: player.getCurrentXP(),
              maxXP: player.getMaxXP(),
              level: player.getLevel(),
            };
            xpObserver = player.onXPChanged.add((xp) => {
              xpData.value = {
                currentXP: xp.currentXP,
                maxXP: xp.maxXP,
                level: xpData.value?.level || 1,
              };
              console.log(`DreamHopper: XP updated to ${xp.currentXP}/${xp.maxXP}`);
            });
            levelObserver = player.onLevelChanged.add((levelData) => {
              if (xpData.value) {
                xpData.value.level = levelData.level;
              }
              console.log(`DreamHopper: Level updated to ${levelData.level}`);
            });
          }

          setTimeout(() => {
            if (!helpDialogPermanentlyDismissed.value) {
              showHelpDialog.value = true;
            }
          }, 5000);
        } catch (error) {
          console.error("DreamHopper: Failed to initialize game:", error);
        }
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
      if (gameInstance.value) {
        const player = gameInstance.value.getCharacterController()?.getPlayer();
        if (player && questObserver) {
          player.onQuestStateChanged.remove(questObserver);
          console.log("DreamHopper: Unsubscribed from onQuestStateChanged");
        }
        if (player && hpObserver) {
          player.onHPChanged.remove(hpObserver);
          console.log("DreamHopper: Unsubscribed from onHPChanged");
        }
        if (player && manaObserver) {
          player.onManaChanged.remove(manaObserver);
          console.log("DreamHopper: Unsubscribed from onManaChanged");
        }
        if (player && xpObserver) {
          player.onXPChanged.remove(xpObserver);
          console.log("DreamHopper: Unsubscribed from onXPChanged");
        }
        if (player && levelObserver) {
          player.onLevelChanged.remove(levelObserver);
          console.log("DreamHopper: Unsubscribed from onLevelChanged");
        }
        gameInstance.value.dispose();
        gameInstance.value = null;
      }
    });

    return {
      canvas,
      animationManager,
      dreamCrystalManager,
      dialogState,
      playerHP,
      playerMana,
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
      xpData,
      gameInstance,
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