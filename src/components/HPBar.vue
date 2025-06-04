<template>
  <div class="unit-frame">
    <div class="portrait-wrapper">
      <div class="portrait-aura"></div>
      <div class="portrait">
        <img src="../assets/model.png" alt="Character Portrait" class="portrait-image" />
      </div>
    </div>
    <div class="bar-section">
      <div class="unit-name">🌙 Essence</div>
      <div class="hp-bar-outer">
        <div
          class="hp-bar-inner"
          :class="{ low: isLowHP }"
          :style="{ width: hpPercentage + '%' }"
        >
          <div class="shimmer-overlay"></div>
        </div>
        <div class="hp-text">{{ currentHP }} / {{ maxHP }}</div>
        <div class="sparkle-particles"></div>
        <div class="arcane-glyphs"></div>
      </div>
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

    const isLowHP = computed(() => {
      return props.currentHP / props.maxHP < 0.25;
    });

    return {
      hpPercentage,
      isLowHP,
    };
  },
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Marcellus+SC&display=swap');

.unit-frame {
  position: fixed;
  top: 30px;
  left: 30px;
  display: flex;
  align-items: center;
  background: linear-gradient(145deg, #1e132a 0%, #281a40 100%);
  border: 2.5px solid #caa9ff77;
  border-radius: 18px;
  padding: 14px 18px;
  width: 440px;
  box-shadow: 0 0 25px #dab6ff77, 0 0 16px #9b5de5dd;
  font-family: 'Marcellus SC', serif;
  backdrop-filter: blur(11px);
}

.portrait-wrapper {
  position: relative;
  width: 75px;
  height: 75px;
  margin-right: 20px;
}

.portrait-aura {
  position: absolute;
  top: -9px;
  left: -9px;
  width: 93px;
  height: 93px;
  border-radius: 50%;
  background: radial-gradient(circle, #e0b3ff55, transparent 60%);
  box-shadow: 0 0 25px #f3ccffbb, 0 0 16px #b67fffbb;
  animation: auraPulse 3s infinite ease-in-out;
  z-index: 1;
}

.portrait {
  width: 75px;
  height: 75px;
  border-radius: 50%;
  overflow: hidden;
  border: 2.7px solid #f3ccff;
  z-index: 2;
  position: relative;
  box-shadow: 0 0 13px #fbc2ebbb, 0 0 5px #fff;
}

.portrait-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bar-section {
  flex: 1;
}

.unit-name {
  color: #fff0ff;
  font-size: 20px;
  text-shadow: 0 0 6px #d0a8ff, 0 0 3px #fff;
  margin-bottom: 10px;
  letter-spacing: 1px;
}

.hp-bar-outer {
  position: relative;
  height: 24px;
  background: #22172f;
  border: 2px solid #a472f055;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: inset 0 0 9px #000, 0 0 5px #c2a9f088;
}

.hp-bar-inner {
  height: 100%;
  position: relative;
  background: linear-gradient(to right, #c7b3ff, #fbc2eb, #d8b4fe);
  transition: width 0.55s ease-in-out;
  box-shadow: inset 0 0 6px #fff5, 0 0 8px #eacbff99;
  border-radius: 16px 0 0 16px;
  overflow: hidden;
}

.hp-bar-inner.low {
  background: linear-gradient(to right, #ff6b6b, #ffd166);
  box-shadow: 0 0 11px #ff6b6bcc, inset 0 0 7px #ffd166bb;
}

.hp-text {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  text-align: center;
  color: #ffffff;
  font-weight: 600;
  font-size: 14px;
  line-height: 24px;
  text-shadow: 1px 1px 3px #000;
  pointer-events: none;
  z-index: 3;
}

/* ✨ Sparkle Particles */
.sparkle-particles::before,
.sparkle-particles::after {
  content: "";
  position: absolute;
  width: 100%;
  height: 100%;
  background-image: radial-gradient(circle, #ffffff88 1.7px, transparent 1.7px);
  background-size: 18px 18px;
  animation: twinkle 6s infinite linear;
  opacity: 0.18;
  z-index: 1;
}

.sparkle-particles::after {
  animation-delay: 3s;
}

/* ✨ Shimmer Effect */
.shimmer-overlay {
  position: absolute;
  top: 0;
  left: -100%;
  height: 100%;
  width: 200%;
  background: linear-gradient(to right, transparent 0%, #ffffff22 50%, transparent 100%);
  animation: shimmerMove 5s infinite;
}

/* 🕯️ Arcane Glyph Overlay */
.arcane-glyphs {
  position: absolute;
  top: -5px;
  left: 9px;
  width: 115%;
  height: 100%;
  background: repeating-linear-gradient(45deg, transparent, transparent 9px, #ffffff11 9px, #ffffff11 10px);
  pointer-events: none;
  z-index: 1;
  opacity: 0.1;
}

/* 🔮 Animations */
@keyframes shimmerMove {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

@keyframes auraPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.05);
    opacity: 1;
  }
}

@keyframes twinkle {
  0%, 100% {
    background-position: 0 0;
  }
  50% {
    background-position: 9px 9px;
  }
}
</style>
