<template>
  <div v-if="visible" class="death-screen">
    <div class="death-content">
      <h1>Vous avez succombé</h1>
      <p>Mais chaque fin est un nouveau commencement...</p>
      <div class="buttons">
        <button @click="$emit('restart')">Recommencer</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "DeathScreen",
  props: {
    visible: {
      type: Boolean,
      required: true,
    },
  },
  emits: ["restart", "quit"],
});
</script>

<style scoped>
.death-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle at center, rgba(0, 0, 50, 0.9), rgba(0, 0, 0, 0.95));
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 1.5s ease-out;
}

.death-content {
  text-align: center;
  background: rgba(25, 25, 112, 0.7);
  border: 2px solid #ff4e50;
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 0 30px rgba(255, 78, 80, 0.5);
  color: #fce4ec;
  font-family: "Roboto Condensed", serif;
  max-width: 500px;
  animation: pulseGlow 4s infinite ease-in-out;
}

h1 {
  font-size: 36px;
  margin-bottom: 15px;
  color: #ff4e50;
  text-shadow: 0 0 10px #ff4e50;
}

p {
  font-size: 18px;
  margin-bottom: 25px;
  color: #f8bbd0;
}

.buttons {
  display: flex;
  justify-content: center;
  gap: 20px;
}

button {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: bold;
  border: none;
  border-radius: 10px;
  background: #673ab7;
  color: #fff;
  cursor: pointer;
  transition: background 0.3s ease, transform 0.2s ease;
}

button:hover {
  background: #9575cd;
}

button:active {
  transform: scale(0.95);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 30px rgba(255, 78, 80, 0.5);
  }
  50% {
    box-shadow: 0 0 60px rgba(255, 78, 80, 0.8);
  }
}
</style>