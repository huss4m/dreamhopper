<template>
    <div v-if="visible" class="quest-dialog">
      <div class="dialog-content">
        <h2>{{ quest ? quest.getTitle() : "No Quest" }}</h2>
        <p>{{ dialogText }}</p>
        <div class="buttons">
          <button v-if="quest && quest.getState().status === 'available'" @click="$emit('accept')">Accept</button>
          <button v-if="quest && quest.getState().status === 'available'" @click="$emit('deny')">Deny</button>
          <button v-if="quest && quest.getState().status === 'completed'" @click="$emit('turnIn')">Turn In</button>
          <button @click="$emit('close')">Close</button>
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
    },
    emits: ["accept", "deny", "close", "turnIn"], // Added turnIn
    setup(props) {
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
  
      return {
        dialogText,
      };
    },
  });
  </script>
  
  <style scoped>
  .quest-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 400px;
    background: rgba(0, 0, 50, 0.9);
    border: 2px solid #ffd700;
    border-radius: 15px;
    padding: 20px;
    z-index: 10000;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    color: #fff;
    font-family: "Roboto Condensed", sans-serif;
    display: block;
    visibility: visible;
  }
  
  .dialog-content {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  h2 {
    margin: 0;
    font-size: 24px;
    color: #ffd700;
    text-align: center;
  }
  
  p {
    margin: 0;
    font-size: 16px;
    line-height: 1.6;
    color: #e0e0e0;
  }
  
  .buttons {
    display: flex;
    justify-content: center;
    gap: 10px;
  }
  
  button {
    padding: 10px 20px;
    background: #2196f3;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    font-weight: bold;
  }
  
  button:hover {
    background: #21cbf3;
  }
  
  button:active {
    transform: scale(0.95);
  }
  </style>