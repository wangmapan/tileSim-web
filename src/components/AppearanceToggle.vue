<script setup lang="ts">
import { Moon, Sun } from "@lucide/vue";
import { computed } from "vue";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";

const { t } = useI18n();
const { appearance, toggleAppearance } = useTheme();
const isDark = computed(() => appearance.value === "dark");
const actionLabel = computed(() => t(isDark.value ? "切换到浅色模式" : "切换到深色模式"));
</script>

<template>
  <button
    class="button button--ghost appearance-toggle"
    type="button"
    :aria-label="actionLabel"
    :title="actionLabel"
    :aria-pressed="isDark"
    @click="toggleAppearance"
  >
    <Transition name="appearance-icon" mode="out-in">
      <Moon v-if="isDark" key="dark" :size="16" />
      <Sun v-else key="light" :size="16" />
    </Transition>
    <span>{{ t(isDark ? "深色" : "浅色") }}</span>
  </button>
</template>
