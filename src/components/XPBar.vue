<template>
  <div class="xp-bar-container">
    <div class="xp-bar-border">
      <div class="xp-bar-progress" :style="{ width: progressPercentage + '%' }">
        <span class="xp-text">{{ currentXP }} / {{ maxXP }} XP</span>
      </div>
    </div>
    <div class="level-circle">{{ level }}</div>
    <div class="xp-label"></div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';

export default defineComponent({
  name: 'XPBar',
  props: {
    currentXP: { type: Number, required: true },
    maxXP: { type: Number, required: true },
    level: { type: Number, required: true },
  },
  setup(props) {
    const progressPercentage = computed(() =>
      Math.min(100, (props.currentXP / props.maxXP) * 100).toFixed(2)
    );

    return { progressPercentage };
  },
});
</script>
<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');

.xp-bar-container {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  width: 384px; /* Equivalent to w-96 (96 * 4px) */
  display: flex;
  flex-direction: column;
  align-items: center;
}

.xp-bar-border {
  position: relative;
  width: 100%;
  height: 32px; /* Equivalent to h-8 */
  background-color: #1a202c; /* bg-gray-900 */
  border: 2px solid #9333ea; /* border-purple-600 */
  border-radius: 9999px; /* rounded-full */
  overflow: hidden;
  box-shadow: 0 0 10px rgba(147, 51, 234, 0.8), 0 0 20px rgba(147, 51, 234, 0.4);
  animation: glow-pulse 2s ease-in-out infinite;
}

.xp-bar-progress {
  height: 100%;
  background: linear-gradient(to right, #a855f7, #3b82f6); /* from-purple-500 to-blue-500 */
  transition: width 0.5s ease-out; /* transition-all duration-500 ease-out */
}

.xp-text {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff; /* text-white */
  font-size: 14px; /* text-sm */
  font-family: 'Cinzel', serif; /* font-cinzel */
  font-weight: 700; /* font-bold */
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.8);
}

.level-circle {
  position: absolute;
  top: -16px; /* -top-4 */
  left: 0;
  width: 48px; /* w-12 */
  height: 48px; /* h-12 */
  background-color: #1a202c; /* bg-gray-900 */
  border: 2px solid #9333ea; /* border-purple-600 */
  border-radius: 50%; /* rounded-full */
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff; /* text-white */
  font-size: 18px; /* text-lg */
  font-family: 'Cinzel', serif; /* font-cinzel */
  font-weight: 700; /* font-bold */
  box-shadow: 0 0 10px rgba(147, 51, 234, 0.8);
}

.xp-label {
  margin-top: 8px; /* mt-2 */
  color: #ffffff; /* text-white */
  font-size: 14px; /* text-sm */
  font-family: 'Cinzel', serif; /* font-cinzel */
  text-align: center;
  text-shadow: 0 0 5px rgba(147, 51, 234, 0.5);
}

@keyframes glow-pulse {
  0%, 100% {
    box-shadow: 0 0 10px rgba(147, 51, 234, 0.8), 0 0 20px rgba(147, 51, 234, 0.4);
  }
  50% {
    box-shadow: 0 0 15px rgba(147, 51, 234, 1), 0 0 30px rgba(147, 51, 234, 0.6);
  }
}
</style>