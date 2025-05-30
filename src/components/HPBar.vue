<template>
    <div class="hp-bar">
      <div class="hp-label">HP: {{ currentHP }}/{{ maxHP }}</div>
      <div class="hp-bar-container">
        <div class="hp-bar-fill" :style="{ width: hpPercentage + '%' }"></div>
      </div>
    </div>
  </template>
  
  <script lang="ts">
  import { defineComponent, computed } from "vue";
  
  export default defineComponent({
    name: "HPBar",
    props: {
      currentHP: {
        type: Number,
        required: true,
      },
      maxHP: {
        type: Number,
        required: true,
      },
    },
    setup(props) {
      const hpPercentage = computed(() => {
        return (props.currentHP / props.maxHP) * 100;
      });
  
      return {
        hpPercentage,
      };
    },
  });
  </script>
  
  <style scoped>
  .hp-bar {
    position: absolute;
    top: 20px;
    left: 20px;
    width: 200px;
    padding: 10px;
    background-color: rgba(0, 0, 0, 0.6);
    border-radius: 10px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
    font-family: "Roboto", sans-serif;
    color: #fff;
  }
  
  .hp-label {
    font-size: 14px;
    margin-bottom: 5px;
  }
  
  .hp-bar-container {
    width: 100%;
    height: 20px;
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 5px;
    overflow: hidden;
  }
  
  .hp-bar-fill {
    height: 100%;
    background-color: #ff4d4d; /* Red for HP */
    transition: width 0.3s ease;
  }
  </style>