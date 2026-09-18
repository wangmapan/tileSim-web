<script setup lang="ts">
import { ChevronDown, X } from "@lucide/vue";
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import ThemeColorEditor from "./ThemeColorEditor.vue";

const { t } = useI18n();
const { theme, appearance, customColor, setTheme, setCustomColor } = useTheme();
const initialColor = ref(customColor.value);
const picker = ref<HTMLElement | null>(null);
const toggle = ref<HTMLButtonElement | null>(null);
const open = ref(false);

async function openMenu() {
  initialColor.value =
    theme.value === "custom"
      ? customColor.value
      : getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  open.value = true;
  await nextTick();
  picker.value?.querySelector<HTMLInputElement>('.theme-color-fields input[type="text"]')?.focus();
}
function closeMenu({ restoreFocus = false } = {}) {
  open.value = false;
  if (restoreFocus) void nextTick(() => toggle.value?.focus());
}
function toggleMenu() {
  if (open.value) closeMenu();
  else void openMenu();
}
function applyColor(color: string) {
  if (setCustomColor(color)) closeMenu({ restoreFocus: true });
}
function resetColor() {
  setTheme("blue");
  closeMenu({ restoreFocus: true });
}
function closeOnOutsideClick(event: MouseEvent) {
  if (picker.value && !picker.value.contains(event.target as Node)) closeMenu();
}
function closeOnEscape(event: KeyboardEvent) {
  if (event.key === "Escape" && open.value) {
    event.preventDefault();
    closeMenu({ restoreFocus: true });
  }
}
onMounted(() => {
  document.addEventListener("pointerdown", closeOnOutsideClick);
  document.addEventListener("keydown", closeOnEscape);
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", closeOnOutsideClick);
  document.removeEventListener("keydown", closeOnEscape);
});
</script>

<template>
  <div ref="picker" class="theme-picker">
    <button
      ref="toggle"
      class="button button--ghost theme-toggle"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-label="t('设置主题颜色')"
      @click="toggleMenu"
    >
      <i class="theme-current-color" aria-hidden="true" />
      <span>{{ t("换肤") }}</span>
      <ChevronDown class="theme-toggle-chevron" :class="{ 'is-open': open }" :size="14" aria-hidden="true" />
    </button>
    <Transition name="menu-pop">
      <div v-if="open" class="theme-menu" role="dialog" :aria-label="t('主题颜色')">
        <header>
          <h2>{{ t("主题颜色") }}</h2>
          <button
            type="button"
            class="icon-button"
            :aria-label="t('关闭配色面板')"
            @click="closeMenu({ restoreFocus: true })"
          >
            <X :size="17" aria-hidden="true" />
          </button>
        </header>
        <ThemeColorEditor :initial-color="initialColor" :appearance="appearance" @apply="applyColor" />
        <button class="theme-reset" type="button" @click="resetColor">{{ t("重置颜色") }}</button>
      </div>
    </Transition>
  </div>
</template>
