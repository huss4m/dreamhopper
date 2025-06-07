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
@import url('https://fonts.googleapis.com/css2?family=Petrona:wght@500;700&family=Quicksand:wght@400;600&display=swap');

.quest-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 480px;
  padding: 36px 42px;
  border-radius: 22px;
  background: linear-gradient(145deg, #1e1739 0%, #2a204d 100%);
  box-shadow:
    0 12px 30px rgba(40, 20, 80, 0.7),
    inset 0 0 18px rgba(170, 120, 255, 0.08);
  border: 2px solid rgba(110, 90, 180, 0.3);
  color: #d6d1f3;
  font-family: 'Quicksand', sans-serif;
  animation: fadeInDream 0.5s ease-out;
  z-index: 10000;
}

@keyframes fadeInDream {
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
  font-family: 'Petrona', serif;
  font-size: 28px;
  color: #c4b1ff;
  text-shadow: 0 0 6px rgba(160, 120, 255, 0.4);
  margin: 0;
}

p {
  font-size: 16.5px;
  font-weight: 500;
  color: #cabff3;
  line-height: 1.6;
  white-space: pre-line;
  background: rgba(255, 255, 255, 0.02);
  padding: 12px 18px;
  border-radius: 14px;
  box-shadow: inset 0 0 12px rgba(180, 140, 255, 0.05);
}

.buttons {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 14px;
}

button {
  background: linear-gradient(145deg, #5c4d9a, #6e5db6);
  border: 2px solid #7e6fd0;
  border-radius: 14px;
  padding: 10px 28px;
  font-family: 'Quicksand', sans-serif;
  font-size: 15.5px;
  font-weight: 600;
  color: #e7e2ff;
  box-shadow: 0 4px 12px rgba(120, 90, 200, 0.3);
  transition: all 0.3s ease;
  cursor: pointer;
  user-select: none;
}

button:hover {
  background: linear-gradient(145deg, #6e5db6, #8772dd);
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 6px 18px rgba(160, 120, 255, 0.4);
}

button:active {
  transform: scale(0.94);
  box-shadow: inset 0 3px 8px rgba(80, 60, 160, 0.5);
}

button:focus-visible {
  outline: none;
  box-shadow:
    0 0 24px 6px #9b8defaa,
    inset 0 0 18px 6px #7c6dd4bb;
}

</style>