<template>
    <div class="vital-bar">
      <div class="vital-label">🌟 Essence: {{ currentHP }}/{{ maxHP }}</div>
      <div class="vital-bar-container">
        <div class="vital-bar-fill" :style="{ width: hpPercentage + '%' }"></div>
      </div>
    </div>
  </template>
  
  <script lang="ts">
  import { defineComponent, computed } from "vue";
  
  export default defineComponent({
    name: "VitalBar",
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
        return Math.max(0, Math.min(100, (props.currentHP / props.maxHP) * 100));
      });
  
      return {
        hpPercentage,
      };
    },
  });
  </script>
  
  <style scoped>
  .vital-bar {
  position: fixed; /* Changed from absolute */
  top: 30px;
  left: 30px;
  width: 520px;
  padding: 12px;
  background: linear-gradient(135deg, #3a2f7d 0%, #6c3fbf 100%);
  border: 2px solid #d8b4fe;
  border-radius: 15px;
  box-shadow: 0 2px 8px rgba(108, 63, 191, 0.5);
  font-family: "Quicksand", sans-serif;
  color: #ffffff;
  z-index: 1000; /* Ensure it's on top */
}

  .vital-label {
    font-size: 16px;
    margin-bottom: 6px;
    font-weight: bold;
    color: #fdfcfe;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  
  .vital-bar-container {
    width: 100%;
    height: 24px;
    background-color: #1f1c3a;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #ffffff33;
  }
  
  .vital-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #a18cd1 0%, #fbc2eb 100%);
    transition: width 0.4s ease;
  }
  </style>
  