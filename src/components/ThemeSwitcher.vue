<script setup lang="ts">
import { Check, ChevronDown, Palette } from "@lucide/vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "../i18n";
import { type AppTheme, supportedThemes, useTheme } from "../theme";

const { t } = useI18n();
const { theme, setTheme } = useTheme();
const picker = ref<HTMLElement | null>(null);
const toggle = ref<HTMLButtonElement | null>(null);
const open = ref(false);

const themeCopy: Record<AppTheme, { label: string; description: string }> = {
  blue: { label: "晴空蓝", description: "轻盈通透的浅蓝白" },
  cloud: { label: "云雾白", description: "克制柔和的中性白" },
  mint: { label: "薄荷青", description: "清爽低饱和的青绿色" },
  classic: { label: "经典深绿", description: "保留原始深绿视觉" },
};

const options = computed(() =>
  supportedThemes.map((id) => ({ id, label: t(themeCopy[id].label), description: t(themeCopy[id].description) })),
);
const currentLabel = computed(() => t(themeCopy[theme.value].label));

function optionElements() {
  return Array.from(picker.value?.querySelectorAll<HTMLButtonElement>(".theme-option") || []);
}

async function openMenu() {
  open.value = true;
  await nextTick();
  const index = Math.max(0, supportedThemes.indexOf(theme.value));
  optionElements()[index]?.focus();
}

function closeMenu({ restoreFocus = false } = {}) {
  open.value = false;
  if (restoreFocus) void nextTick(() => toggle.value?.focus());
}

function toggleMenu() {
  if (open.value) closeMenu();
  else void openMenu();
}

function chooseTheme(nextTheme: AppTheme) {
  setTheme(nextTheme);
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

function onListboxKeydown(event: KeyboardEvent) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const elements = optionElements();
  if (!elements.length) return;
  const current = Math.max(0, elements.indexOf(document.activeElement as HTMLButtonElement));
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? elements.length - 1
        : event.key === "ArrowDown"
          ? (current + 1) % elements.length
          : (current - 1 + elements.length) % elements.length;
  elements[next].focus();
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
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-label="t('选择界面主题，当前：{theme}', { theme: currentLabel })"
      @click="toggleMenu"
    >
      <Palette :size="16" />
      <span>{{ currentLabel }}</span>
      <ChevronDown class="theme-toggle-chevron" :class="{ 'is-open': open }" :size="14" />
    </button>

    <Transition name="menu-pop">
      <div v-if="open" class="theme-menu" role="listbox" :aria-label="t('选择界面主题')" @keydown="onListboxKeydown">
        <header>
          <strong>{{ t("界面主题") }}</strong>
          <small>{{ t("选择适合当前工作环境的配色") }}</small>
        </header>
        <button
          v-for="option in options"
          :key="option.id"
          class="theme-option"
          :class="{ active: theme === option.id }"
          type="button"
          role="option"
          :aria-selected="theme === option.id"
          @click="chooseTheme(option.id)"
        >
          <span class="theme-swatch" :class="`theme-swatch--${option.id}`"><i></i><i></i><i></i></span>
          <span>
            <strong>{{ option.label }}</strong>
            <small>{{ option.description }}</small>
          </span>
          <Check v-if="theme === option.id" :size="17" />
        </button>
      </div>
    </Transition>
  </div>
</template>
