<script setup lang="ts">
import { Trash2 } from "@lucide/vue";
import { useI18n } from "../../i18n";
import InlineHelp from "../../components/InlineHelp.vue";
import type { TopologyDomain, TopologyLink } from "./topology-graph";

const props = defineProps<{
  link: TopologyLink;
  domains: TopologyDomain[];
}>();
const emit = defineEmits<{
  (event: "delete"): void;
  (event: "update-field", payload: { field: "domain_id" | "bandwidth_gbps" | "latency_us"; value: string }): void;
}>();
const { t } = useI18n();

function domainType(link: TopologyLink): "inside" | "cross" {
  return props.domains.find((domain) => domain.domain_id === link.domain_id)?.domain_type === "scale_out"
    ? "cross"
    : "inside";
}

function domainLabel(link: TopologyLink): string {
  return domainType(link) === "cross" ? t("跨域通信") : t("域内通信");
}

function eventValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement | null)?.value || "";
}
</script>

<template>
  <aside class="topology-link-panel" :aria-label="t('连接属性')">
    <header>
      <strong>{{ t("连接属性") }}</strong>
      <button type="button" class="button button--danger" @click="emit('delete')">
        <Trash2 :size="14" />{{ t("删除连接") }}
      </button>
    </header>
    <small>{{ props.link.src_device }} ↔ {{ props.link.dst_device }}</small>
    <div class="topology-link-kind" :class="`topology-link-kind--${domainType(props.link)}`">
      <span>{{ domainLabel(props.link) }} · {{ props.link.domain_id }}</span>
      <InlineHelp :text="t('根据该连接所属 domain 的类型判断：scale_up 为域内，scale_out 为跨域')" />
    </div>
    <div class="topology-link-panel__inline-fields">
      <label title="domain_id">
        {{ t("所属域") }}
        <select
          :value="props.link.domain_id"
          @change="emit('update-field', { field: 'domain_id', value: eventValue($event) })"
        >
          <option v-for="domain in props.domains" :key="domain.domain_id" :value="domain.domain_id">
            {{ domain.domain_id }}
          </option>
        </select>
      </label>
      <label title="bandwidth_gbps">
        {{ t("带宽（Gbps）") }}
        <input
          :value="props.link.bandwidth_gbps ?? ''"
          list="topology-link-bandwidth-presets"
          type="number"
          min="0"
          step="any"
          @input="emit('update-field', { field: 'bandwidth_gbps', value: eventValue($event) })"
        />
      </label>
      <label title="latency_us">
        {{ t("延迟（us）") }}
        <input
          :value="props.link.latency_us ?? ''"
          list="topology-link-latency-presets"
          type="number"
          min="0"
          step="any"
          @input="emit('update-field', { field: 'latency_us', value: eventValue($event) })"
        />
      </label>
    </div>
    <datalist id="topology-link-bandwidth-presets">
      <option v-for="value in [25, 100, 400, 800, 1600]" :key="value" :value="value" />
    </datalist>
    <datalist id="topology-link-latency-presets">
      <option v-for="value in [0.5, 1, 5, 10, 25]" :key="value" :value="value" />
    </datalist>
  </aside>
</template>
