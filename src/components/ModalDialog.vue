<script setup>
import { X } from "@lucide/vue";
defineProps({ open: Boolean, title: String });
defineEmits(["close"]);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-layer" @click.self="$emit('close')">
      <section class="modal-card" role="dialog" aria-modal="true" :aria-label="title">
        <header>
          <h2>{{ title }}</h2>
          <button class="icon-button" aria-label="关闭" @click="$emit('close')"><X :size="18" /></button>
        </header>
        <slot />
      </section>
    </div>
  </Teleport>
</template>
