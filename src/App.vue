<template>
  <div id="app">
    <DreamHopper />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import DreamHopper from "./components/DreamHopper.vue";

export default defineComponent({
  name: "App",
  components: {
    DreamHopper,
  },
});
</script>

<style>
* {
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}

#app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  background-image: url("../public/images/Background_Dots.png");
  background-size: cover;
  background-position: center;
  
}
</style>