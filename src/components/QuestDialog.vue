<template>
    <div class="quest-dialog" v-if="visible">
      <div class="quest-box">
        <h2 class="quest-title">Quest: A Mysterious Request</h2>
        <p class="quest-text">
          Lorem ipsum dolor sit amet, adventurer. Are you brave enough to retrieve the 3 lost Dream Crystals from the Hollow Caverns?
        </p>
        <div class="quest-buttons">
          <button @click="$emit('accept')" class="accept-btn">Accept</button>
          <button @click="$emit('deny')" class="deny-btn">Decline</button>
        </div>
      </div>
    </div>
  </template>
  
  <script lang="ts">
  import { defineComponent } from "vue";
  
  export default defineComponent({
    name: "QuestDialog",
    props: {
      visible: {
        type: Boolean,
        default: true,
      },
    },
  });
  </script>
  
  <style scoped>
  .quest-dialog {
    position: absolute;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
  }
  
  .quest-box {
    background: url('../assets/parchment.png'), #f4ecd8;
    background-size: cover;
    border: 2px solid #8b5e3c;
    border-radius: 16px;
    padding: 20px 25px;
    width: 420px;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
    font-family: 'Georgia', serif;
    color: #3c2f1f;
  }
  
  .quest-title {
    font-size: 22px;
    margin-bottom: 10px;
    color: #5a3e1b;
    text-shadow: 1px 1px #fffbe3;
  }
  
  .quest-text {
    font-size: 16px;
    margin-bottom: 20px;
    line-height: 1.5;
  }
  
  .quest-buttons {
    display: flex;
    justify-content: center;
    gap: 20px;
  }
  
  .accept-btn,
  .deny-btn {
    padding: 8px 18px;
    font-size: 15px;
    font-weight: bold;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .accept-btn {
    background-color: #3c8c3c;
    color: white;
  }
  
  .accept-btn:hover {
    background-color: #2e6e2e;
  }
  
  .deny-btn {
    background-color: #a63c3c;
    color: white;
  }
  
  .deny-btn:hover {
    background-color: #8b2f2f;
  }
  </style>
  