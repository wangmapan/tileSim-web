<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  category: string;
  action: string;
  technicalDetail: string;
}>();

const copied = ref(false);

async function copyDetail() {
  await navigator.clipboard.writeText(props.technicalDetail);
  copied.value = true;
  window.setTimeout(() => (copied.value = false), 1200);
}
</script>

<template>
  <section class="error-panel" role="alert">
    <p class="eyebrow">{{ props.category }}</p>
    <h2>下一步怎么做</h2>
    <p>{{ props.action }}</p>
    <details>
      <summary>技术详情</summary>
      <pre>{{ props.technicalDetail }}</pre>
      <button type="button" class="button button--secondary button--small" @click="copyDetail">
        {{ copied ? "已复制" : "复制技术详情" }}
      </button>
    </details>
  </section>
</template>
