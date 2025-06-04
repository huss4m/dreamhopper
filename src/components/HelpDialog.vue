<template>
  <transition name="fade">
    <div v-if="visible" class="help-dialog">
      <div class="dialog-content">
        <h2>Aide</h2>
        <ul>
          <li v-for="(step, index) in steps" :key="index">{{ step }}</li>
        </ul>
        <div class="buttons">
          <button @click="handleClose(false)">Fermer</button>
          <button @click="handleClose(true)">Ne plus afficher</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";

export default defineComponent({
  name: "HelpDialog",
  props: {
    visible: {
      type: Boolean,
      required: true,
    },
    steps: {
      type: Array as PropType<string[]>,
      required: true,
    },
    onClose: {
      type: Function as PropType<(permanently?: boolean) => void>,
      required: true,
    },
  },
  setup(props) {
    const handleClose = (permanently: boolean) => {
      props.onClose(permanently);
    };

    return {
      handleClose,
    };
  },
});
</script>

<style scoped>
.help-dialog {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 300px;
  background: rgba(0, 0, 60, 0.9);
  border: 2px solid #2196f3;
  border-radius: 10px;
  padding: 20px;
  z-index: 10001;
  color: white;
  font-family: "Roboto Condensed", sans-serif;
  box-shadow: 0 0 10px #2196f3;
}

.dialog-content h2 {
  margin: 0 0 10px;
  font-size: 20px;
  text-align: center;
  color: #21cbf3;
}

.dialog-content ul {
  padding-left: 20px;
  margin: 0 0 15px;
  max-height: 200px;
  overflow-y: auto;
  list-style-type: disc;
  font-size: 14px;
}

.buttons {
  display: flex;
  justify-content: space-between;
}

button {
  background: #2196f3;
  border: none;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  font-size: 14px;
  transition: background-color 0.3s ease;
}

button:hover {
  background: #21cbf3;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
