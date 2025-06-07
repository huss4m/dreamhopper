<template>
  <div v-if="visible" class="quest-dialog">
    <div class="dialog-content">
      <h2>{{ quest ? quest.getTitle() : "No Quest" }}</h2>
      <p>{{ dialogText }}</p>
      <div class="buttons">
        <button v-if="quest && quest.getState().status === 'available'" @click="handleAccept">Accepter</button>
        <button v-if="quest && quest.getState().status === 'available'" @click="handleDeny">Refuser</button>
        <button v-if="quest && quest.getState().status === 'completed'" @click="handleTurnIn">Rendre</button>
        <button @click="handleClose">Quitter</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, PropType, watch } from "vue";
import { Quest } from "@/DreamHopper/npc/Quest";

export default defineComponent({
  name: "QuestDialog",
  props: {
    visible: {
      type: Boolean,
      required: true,
    },
    quest: {
      type: Object as PropType<Quest | null>,
      required: false,
      default: null,
    },
    canvas: {
      type: Object as PropType<HTMLCanvasElement | null>,
      required: false,
      default: null,
    },
  },
  emits: ["accept", "deny", "close", "turnIn"],
  setup(props, { emit }) {
    console.log("QuestDialog: Mounted with props:", {
      visible: props.visible,
      questId: props.quest ? props.quest.getId() : "null",
    });

    watch(
      () => [props.visible, props.quest],
      ([newVisible, newQuest]) => {
        console.log(
          `QuestDialog: Props changed - visible=${newVisible}, quest=${
            newQuest ? (newQuest as Quest).getId() : "null"
          }, status=${newQuest ? (newQuest as Quest).getState().status : "null"}`
        );
      },
      { immediate: true }
    );

    const dialogText = computed(() => {
      if (!props.quest) {
        console.log("QuestDialog: No quest provided");
        return "No quest available.";
      }
      const state = props.quest.getState();
      console.log(`QuestDialog: Computing dialogText for status=${state.status}`);
      let text = "";
      if (state.status === "available") {
        text = props.quest.getDescription();
        console.log(`QuestDialog: Using description: ${text}`);
      } else if (state.status === "inProgress") {
        text = props.quest.getInProgressText();
        console.log(`QuestDialog: Using inProgressText: ${text}`);
      } else if (state.status === "completed") {
        text = props.quest.getCompletedText();
        console.log(`QuestDialog: Using completedText: ${text}`);
      } else if (state.status === "turnedIn") {
        text = props.quest.getTurnedInText() || "Thank you for completing the quest!";
        console.log(`QuestDialog: Using turnedInText: ${text}`);
      }
      return text;
    });

    const focusCanvas = () => {
      if (props.canvas) {
        props.canvas.focus();
        console.log("QuestDialog: Focused canvas after button interaction");
      } else {
        console.warn("QuestDialog: Canvas prop is null, cannot focus");
      }
    };

    const handleAccept = () => {
      emit("accept");
      focusCanvas();
    };

    const handleDeny = () => {
      emit("deny");
      focusCanvas();
    };

    const handleClose = () => {
      emit("close");
      focusCanvas();
    };

    const handleTurnIn = () => {
      emit("turnIn");
      focusCanvas();
    };

    return {
      dialogText,
      handleAccept,
      handleDeny,
      handleClose,
      handleTurnIn,
    };
  },
});
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Quicksand:wght@400;600&display=swap");

.quest-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 500px;
  padding: 36px 42px;
  border-radius: 20px;
  background: rgba(30, 30, 60, 0.92);
  backdrop-filter: blur(14px);
  border: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 0 18px rgba(90, 180, 255, 0.35),
    0 0 32px rgba(100, 200, 255, 0.2);
  color: #f0f8ff;
  font-family: "Quicksand", sans-serif;
  animation: dialogFade 0.5s ease;
  z-index: 10000;
}

@keyframes dialogFade {
  from {
    opacity: 0;
    transform: translate(-50%, -56%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
}

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  text-align: center;
}

h2 {
  font-family: "Cinzel Decorative", cursive;
  font-size: 26px;
  font-weight: 700;
  margin: 0;
  color: #bfcaff; /* dreamy bluish-lavender */
  text-shadow: 0 0 8px rgba(190, 210, 255, 0.6);
}

p {
  font-size: 15px;
  font-weight: 500;
  color: #e2f1ff;
  line-height: 1.6;
  background: rgba(255, 255, 255, 0.03);
  padding: 14px 20px;
  border-radius: 14px;
  box-shadow: inset 0 0 10px rgba(200, 220, 255, 0.05);
  white-space: pre-line;
}

.buttons {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 14px;
}

button {
  background: linear-gradient(to right, #4fc3f7, #1976d2);
  border: none;
  border-radius: 14px;
  padding: 10px 28px;
  font-family: "Quicksand", sans-serif;
  font-size: 15.5px;
  font-weight: 600;
  color: #ffffff;
  box-shadow: 0 0 10px rgba(79, 195, 247, 0.3), inset 0 0 4px rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  cursor: pointer;
  user-select: none;
}

button:hover {
  background: linear-gradient(to right, #6ec6ff, #2196f3);
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 0 14px rgba(100, 200, 255, 0.5);
}

button:active {
  transform: scale(0.95);
  box-shadow: inset 0 4px 10px rgba(25, 118, 210, 0.4);
}

button:focus-visible {
  outline: none;
  box-shadow:
    0 0 18px rgba(120, 180, 255, 0.6),
    inset 0 0 10px rgba(150, 200, 255, 0.3);
}

@media (max-width: 600px) {
  .quest-dialog {
    width: 90%;
    padding: 24px;
  }

  h2 {
    font-size: 22px;
  }

  p {
    font-size: 14px;
  }

  button {
    padding: 10px 22px;
    font-size: 14px;
  }
}


</style>