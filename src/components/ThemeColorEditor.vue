<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "../i18n";
import { customPalette, hexToRgb, hsvToRgb, normalizeHex, rgbToHex, rgbToHsv, type RGB } from "../theme/color";
import type { AppAppearance } from "../theme";

const props = defineProps<{ initialColor: string; appearance: AppAppearance }>();
const emit = defineEmits<{ apply: [color: string] }>();
const { t } = useI18n();
const color = ref(props.initialColor);
const hexInput = ref(color.value);
const channels = ref(hexToRgb(color.value).map(String));
const hsv = ref(rgbToHsv(hexToRgb(color.value)));
const error = ref("");
const preview = computed(() => customPalette(color.value, props.appearance));
const labels = ["红色（R）", "绿色（G）", "蓝色（B）"];
const plane = ref<HTMLElement | null>(null);

function updateColor(next: string, updateHue = true) {
  color.value = next;
  hexInput.value = next;
  channels.value = hexToRgb(next).map(String);
  if (updateHue) {
    const converted = rgbToHsv(hexToRgb(next));
    hsv.value = { ...converted, hue: converted.saturation ? converted.hue : hsv.value.hue };
  }
  error.value = "";
}
function changeHex(event: Event) {
  hexInput.value = (event.target as HTMLInputElement).value;
  const normalized = normalizeHex(hexInput.value);
  if (normalized) {
    const typed = hexInput.value;
    updateColor(normalized);
    hexInput.value = typed;
  } else error.value = "请输入 3 位或 6 位 HEX 颜色。";
}
function changeChannel(index: number, event: Event) {
  channels.value[index] = (event.target as HTMLInputElement).value;
  if (channels.value.some((channel) => !/^\d{1,3}$/.test(channel) || Number(channel) > 255)) {
    error.value = "RGB 数值应为 0–255 的整数。";
    return;
  }
  updateColor(rgbToHex(channels.value.map(Number) as RGB));
}
function changeHue(event: Event) {
  hsv.value.hue = Number((event.target as HTMLInputElement).value);
  updateColor(rgbToHex(hsvToRgb(hsv.value)), false);
}
function pick(event: PointerEvent) {
  if (!plane.value) return;
  const bounds = plane.value.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  hsv.value.saturation = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
  hsv.value.value = 1 - Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
  updateColor(rgbToHex(hsvToRgb(hsv.value)), false);
}
function startPick(event: PointerEvent) {
  if (event.button !== 0) return;
  plane.value?.setPointerCapture(event.pointerId);
  pick(event);
}
function movePick(event: PointerEvent) {
  if (plane.value?.hasPointerCapture(event.pointerId)) pick(event);
}
function endPick(event: PointerEvent) {
  if (plane.value?.hasPointerCapture(event.pointerId)) plane.value.releasePointerCapture(event.pointerId);
}
</script>

<template>
  <section class="theme-color-editor" :aria-label="t('自定义主题色')">
    <div
      ref="plane"
      class="theme-color-plane"
      aria-hidden="true"
      :style="{ backgroundColor: 'hsl(' + hsv.hue + ' 100% 50%)' }"
      @pointerdown.prevent="startPick"
      @pointermove="movePick"
      @pointerup="endPick"
      @pointercancel="endPick"
    >
      <span :style="{ left: hsv.saturation * 100 + '%', top: (1 - hsv.value) * 100 + '%', backgroundColor: color }" />
    </div>
    <label class="theme-hue-label"
      >{{ t("色相") }}
      <input class="theme-hue" type="range" min="0" max="360" step="1" :value="hsv.hue" @input="changeHue" />
    </label>
    <div class="theme-color-fields">
      <label class="theme-hex-field"
        >HEX
        <input
          type="text"
          :value="hexInput"
          spellcheck="false"
          autocomplete="off"
          :aria-label="t('HEX 颜色')"
          :aria-invalid="!!error"
          @input="changeHex"
        />
      </label>
      <label v-for="(label, index) in labels" :key="label"
        >{{ ["R", "G", "B"][index] }}
        <input
          type="number"
          min="0"
          max="255"
          step="1"
          :value="channels[index]"
          :aria-label="t(label)"
          :aria-invalid="!!error"
          @input="changeChannel(index, $event)"
        />
      </label>
    </div>
    <p v-if="error" class="theme-color-error" role="alert">{{ t(error) }}</p>
    <div class="theme-color-preview" :aria-label="t('主题色预览')">
      <span class="theme-color-sample" :style="{ backgroundColor: color }" :title="color" />
      <span :style="{ color: preview.accent }">{{ t("链接文字") }}</span>
      <span class="theme-button-sample" :style="{ backgroundColor: preview.accent, color: preview.onAccent }">{{
        t("按钮预览")
      }}</span>
    </div>
    <p class="theme-color-note">{{ t("颜色应用于导航、按钮和选中区域；告警与图表颜色保持不变。") }}</p>
    <button
      class="button button--primary theme-color-apply"
      type="button"
      :disabled="!!error"
      @click="emit('apply', color)"
    >
      {{ t("应用自定义颜色") }}
    </button>
  </section>
</template>

<style scoped>
.theme-color-editor {
  padding: 4px;
}
h3 {
  margin: 0 0 12px;
  font-size: var(--text-sm);
  font-weight: 600;
}
.theme-color-plane {
  position: relative;
  height: 140px;
  background-image: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent);
  cursor: crosshair;
  touch-action: none;
}
.theme-color-plane > span {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  outline: 1px solid #000;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.theme-hue-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  font-size: var(--text-xs);
  color: var(--muted);
}
.theme-hue {
  flex: 1;
  min-width: 0;
  height: 12px;
  appearance: none;
  border: 1px solid var(--line-strong);
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  padding: 0;
  cursor: pointer;
}
.theme-hue::-webkit-slider-thumb {
  appearance: none;
  width: 10px;
  height: 20px;
  border: 2px solid var(--ink);
  background: var(--panel);
  border-radius: 2px;
}
.theme-hue::-moz-range-thumb {
  width: 8px;
  height: 18px;
  border: 2px solid var(--ink);
  background: var(--panel);
  border-radius: 2px;
}
.theme-color-fields {
  display: grid;
  grid-template-columns: 1.6fr repeat(3, 1fr);
  gap: 8px;
  margin-top: 14px;
}
.theme-color-fields label {
  display: grid;
  gap: 4px;
  min-width: 0;
  font-size: 12px;
  color: var(--muted);
}
.theme-color-fields input {
  width: 100%;
  min-width: 0;
  padding: 6px;
  border: 1px solid var(--line-strong);
  border-radius: 3px;
  color: var(--ink);
  background: var(--control-bg);
  font: inherit;
  font-family: var(--font-mono);
}
.theme-color-fields input[aria-invalid="true"] {
  border-color: var(--danger);
}
.theme-color-error {
  margin: 8px 0 0;
  color: var(--danger-ink);
  font-size: var(--text-xs);
}
.theme-color-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0 4px;
  font-size: var(--text-xs);
}
.theme-color-sample {
  width: 23px;
  height: 23px;
  border: 1px solid var(--line-strong);
  flex-shrink: 0;
}
.theme-button-sample {
  margin-left: auto;
  padding: 4px 10px;
  border-radius: 3px;
}
.theme-color-note {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
  margin: 8px 0 12px;
}
.theme-color-apply {
  width: 100%;
}
</style>
