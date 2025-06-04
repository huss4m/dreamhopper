<template>
  <div class="quest-log-container">
    <div class="quest-log-panel">
      <h2 class="panel-title">Quêtes</h2>
      <div v-if="quests.length === 0" class="no-quests">
        Aucune quête en cours.
      </div>
      <div v-else class="quest-list">
        <div v-for="quest in quests" :key="quest.getId()" class="quest-item">
          <h3 class="quest-title">{{ quest.getTitle() }}</h3>
          <p class="quest-description">{{ quest.getInProgressText() }}</p>
          <div class="quest-progress">
            <span v-if="quest.type === 'COLLECT'">
              Fragments de rêve: {{ quest.getState().collectedCrystals || 0 }}/{{ quest.requiredCrystals }}
            </span>
            <span v-else-if="quest.type === 'KILL'">
              Perdus transformés: {{ quest.getState().enemiesKilled || 0 }}/{{ quest.requiredEnemies }}
            </span>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{
                  width: getProgressPercentage(quest) + '%',
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { Quest } from "@/DreamHopper/npc/Quest";

export default defineComponent({
  name: "QuestLog",
  props: {
    quests: {
      type: Array as PropType<Quest[]>,
      required: true,
    },
  },
  methods: {
    getProgressPercentage(quest: Quest): number {
      if (quest.type === "COLLECT") {
        const collected = quest.getState().collectedCrystals || 0;
        return (collected / quest.requiredCrystals) * 100;
      } else if (quest.type === "KILL") {
        const killed = quest.getState().enemiesKilled || 0;
        return (killed / quest.requiredEnemies) * 100;
      }
      return 0;
    },
  },
});
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&display=swap");

.quest-log-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  font-family: "Cinzel Decorative", cursive;
}

.quest-log-panel {
  background: rgba(30, 30, 60, 0.9); /* More visible */
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  padding: 20px;
  width: 320px;
  box-shadow: 0 0 16px rgba(90, 180, 255, 0.5), 0 0 32px rgba(100, 200, 255, 0.3);
  color: #ffffff;
}

.panel-title {
  font-size: 26px;
  margin: 0 0 16px;
  text-align: center;
  color: #f0f8ff;
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
}

.no-quests {
  text-align: center;
  font-style: italic;
  font-size: 15px;
  color: #d0d0ff;
}

.quest-list {
  max-height: 400px;
  overflow-y: auto;
}

.quest-item {
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.2);
}

.quest-title {
  font-size: 18px;
  font-weight: bold;
  margin: 0;
  color: #ffe066;
  text-shadow: 0 0 6px rgba(255, 230, 102, 0.7);
}

.quest-description {
  font-size: 14px;
  color: #e6f7ff;
  margin: 6px 0;
}

.quest-progress {
  margin-top: 10px;
}

.quest-progress span {
  display: block;
  font-size: 13px;
  color: #cbe4ff;
}

.progress-bar {
  width: 100%;
  height: 10px;
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  overflow: hidden;
  margin-top: 4px;
  box-shadow: inset 0 0 4px rgba(0, 100, 255, 0.3);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(to right, #4fc3f7, #1976d2);
  transition: width 0.4s ease;
  animation: glowingProgress 2s infinite alternate ease-in-out;
}

@keyframes glowingProgress {
  0% {
    box-shadow: 0 0 6px #4fc3f7;
  }
  100% {
    box-shadow: 0 0 12px #1976d2;
  }
}

@media (max-width: 768px) {
  .quest-log-container {
    top: 10px;
    right: 10px;
  }
  .quest-log-panel {
    width: 260px;
    padding: 14px;
  }
  .panel-title {
    font-size: 22px;
  }
  .quest-title {
    font-size: 16px;
  }
  .quest-description {
    font-size: 13px;
  }
  .quest-progress span {
    font-size: 12px;
  }
}

</style>