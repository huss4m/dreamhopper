<template>
  <main>
    <canvas></canvas>


    
    <!-- Spell bar container -->
    <div class="spell-bar">
      <!-- Spell slot examples (empty slots) -->
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
      <div class="spell-slot"></div>
  
      <!-- Add more slots as needed -->
    </div>
  </main>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { CharacterAnimations } from "public/models/CharacterAnimations";
import { Game } from "@/DreamHopper/Game";

export default defineComponent({
  name: "DreamHopper",

  mounted() {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement;
    new Game(canvas);
  },
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Roboto+Condensed&family=Roboto:wght@100;700&display=swap");

main {
  width: 100vw;  /* Full viewport width */
  height: 100vh; /* Full viewport height */
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  margin: 0; /* Ensure no margin */
}

canvas {
  width: 100%;  /* Take full width of its parent */
  height: 100%; /* Take full height of its parent */
  border: none;
  outline: none;
  box-shadow: 8px 8px 10px -6px #000000;
}


/* Spell bar at the bottom of the screen */
.spell-bar {
  position: absolute;
  bottom: 20px; /* Adjust if you want some space above the bottom */
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  gap: 10px; /* Space between each spell slot */
  padding: 10px;
  background-color: rgba(0, 0, 0, 0.6); /* Semi-transparent background */
  border-radius: 15px; /* Rounded corners for the spell bar */
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5); /* Optional: shadow for effect */
}

/* Individual spell slot (empty) */
.spell-slot {
  width: 50px; /* Width of each slot */
  height: 50px; /* Height of each slot */
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.2); /* Light transparent background for each slot */
  border-radius: 10px; /* Rounded corners for the slot */
  border: 2px solid #444; /* Darker border */
  position: relative;
  cursor: url("../../public/images/cursorTargetAlly.png"), auto;
}

/* Hover effect on spell slots */
.spell-slot:hover {
  background-color: rgba(255, 255, 255, 0.3); /* Slightly brighter background on hover */
}

/* Optional: Active or selected spell effect */
.spell-slot.active {
  border: 2px solid #ffcc00; /* Gold border for active slot */
  box-shadow: 0 0 10px #ffcc00; /* Glow effect for active spell */
}
</style>