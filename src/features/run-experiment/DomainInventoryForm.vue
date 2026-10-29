<script setup lang="ts">
import { computed, ref } from "vue";
import { Network, Plus, Trash2 } from "@lucide/vue";
import { useI18n } from "../../i18n";
import InlineHelp from "../../components/InlineHelp.vue";
import { topologyDomainFields, topologyDomainMaxItems } from "./input-schema-meta";
import {
  addDomain,
  deviceIdsOf,
  domainIdsOf,
  domainReferences,
  isJsonObject,
  moduleBindingNamesOf,
  nextDomainId,
  parseJsonDocument,
  patchJsonDocument,
  removeDomain,
  renameDomain,
  setDomainMember,
  setDomainModuleBinding,
  setDomainType,
  StructuredInputError,
  topologyDomainsOf,
  type DomainType,
  type JsonObject,
} from "./structured-input";

const props = withDefaults(defineProps<{ modelValue: string; fieldPath?: string }>(), { fieldPath: "" });
const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
  (event: "notice", payload: { tone: "info" | "warning"; message: string }): void;
}>();
const { t } = useI18n();

/**
 * Plain-language labels. The contract key stays available as a hover tooltip so
 * a field can still be matched against a backend diagnostic Pointer.
 */
const DOMAIN_LABEL_SOURCE: Record<string, string> = {
  domain_id: "域名",
  domain_type: "域类型",
  module_binding: "所用网络模型",
  member_devices: "成员设备",
  default_fidelity: "默认保真度",
  failure_policy: "失败策略",
};

const DOMAIN_TYPE_LABEL_SOURCE: Record<string, string> = {
  scale_up: "机内高速互联（scale_up）",
  scale_out: "跨机网络（scale_out）",
};

/** Domain fields this panel renders. Everything else is reported, not dropped. */
const RENDERED_DOMAIN_KEYS = [
  "domain_id",
  "domain_type",
  "module_binding",
  "member_devices",
  "default_fidelity",
  "failure_policy",
];

const DOMAIN_ENUM_LABEL_SOURCE: Record<string, string> = {
  analytical: "Analytical",
  des: "DES",
  fallback: "允许降级",
  fail_closed: "拒绝运行",
};

function domainLabel(key: string): string {
  const source = DOMAIN_LABEL_SOURCE[key];
  return source ? t(source) : key;
}

function domainTypeLabel(value: string): string {
  const source = DOMAIN_TYPE_LABEL_SOURCE[value];
  return source ? t(source) : value;
}

const localError = ref("");
const parsed = computed(() => parseJsonDocument(props.modelValue, "Fabric topology"));
const documentValue = computed<JsonObject | null>(() => (parsed.value.ok ? parsed.value.value : null));
const domains = computed<unknown[] | null>(() => (documentValue.value ? topologyDomainsOf(documentValue.value) : null));
const rowIndexes = computed(() => (domains.value || []).map((_, index) => index));
const deviceIds = computed(() => (documentValue.value ? deviceIdsOf(documentValue.value) : []));
const moduleOptions = computed(() => (documentValue.value ? moduleBindingNamesOf(documentValue.value) : []));
const domainTypeValues = computed(() => {
  const meta = topologyDomainFields.find((field) => field.key === "domain_type");
  return (meta?.enumValues || []) as readonly DomainType[];
});
const domainEnumValues = computed(() => ({
  default_fidelity: topologyDomainFields.find((field) => field.key === "default_fidelity")?.enumValues || [],
  failure_policy: topologyDomainFields.find((field) => field.key === "failure_policy")?.enumValues || [],
}));
/** Optional fields not present in the current contract are still reported. */
const unrenderedFields = computed(() =>
  topologyDomainFields.filter((field) => !RENDERED_DOMAIN_KEYS.includes(field.key)),
);

function rowAt(index: number): JsonObject | null {
  const value = domains.value?.[index];
  return isJsonObject(value) ? value : null;
}

function domainId(index: number): string {
  const value = rowAt(index)?.domain_id;
  return typeof value === "string" ? value : "";
}

function domainType(index: number): string {
  const value = rowAt(index)?.domain_type;
  return typeof value === "string" ? value : "";
}

function domainModule(index: number): string {
  const value = rowAt(index)?.module_binding;
  return typeof value === "string" ? value : "";
}

function domainMembers(index: number): string[] {
  const value = rowAt(index)?.member_devices;
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function domainEnumValue(index: number, key: "default_fidelity" | "failure_policy"): string {
  const value = rowAt(index)?.[key];
  return typeof value === "string" ? value : "";
}

function domainEnumLabel(value: string): string {
  return t(DOMAIN_ENUM_LABEL_SOURCE[value] || value);
}

function moduleKindOf(name: string): string {
  return moduleOptions.value.find((entry) => entry.name === name)?.kind || "";
}

/** A domain bound to a module of the other kind is schema-valid but misleading. */
function bindingMismatch(index: number): boolean {
  const kind = moduleKindOf(domainModule(index));
  return Boolean(kind) && kind !== domainType(index);
}

function cellPath(index: number, key: string): string {
  return `/custom_inputs/topology/topology/domains/${index}/${key}`;
}

function eventValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement | null)?.value || "";
}

function reportError(error: unknown) {
  localError.value = error instanceof StructuredInputError ? error.message : String(error);
}

function addOne() {
  if (!documentValue.value) return;
  if (domainIdsOf(documentValue.value).length >= topologyDomainMaxItems) {
    localError.value = t("域的数量不能超过 {max} 个。", { max: topologyDomainMaxItems });
    return;
  }
  // A domain must name a declared module, so an empty module list is a real
  // dead end rather than something to paper over with an invented name.
  const options = moduleOptions.value;
  if (!options.length) {
    localError.value = t(
      "topology 里还没有 module_bindings：新增域必须绑定一个网络模型，请先在「模块绑定参数」里补一个，或在原始 JSON 里补一条 module_bindings。",
    );
    return;
  }
  const preferred: DomainType = options.some((entry) => entry.kind === "scale_up") ? "scale_up" : "scale_out";
  const binding = options.find((entry) => entry.kind === preferred) || options[0];
  const id = nextDomainId(domainIdsOf(documentValue.value), preferred);
  try {
    const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) =>
      addDomain(draft, { domain_id: id, domain_type: preferred, module_binding: binding.name }),
    );
    emit("update:modelValue", updated);
    localError.value = "";
    emit("notice", {
      tone: "info",
      message: t("已新增域 {domain}（{type}），绑定网络模型 {module}。成员设备还是空的，勾选要加入的节点。", {
        domain: id,
        type: domainTypeLabel(preferred),
        module: binding.name,
      }),
    });
  } catch (error) {
    reportError(error);
  }
}

function updateName(index: number, event: Event) {
  const next = eventValue(event).trim();
  const current = domainId(index);
  if (next === current) return;
  if (!next) {
    localError.value = t("域名不能为空。");
    return;
  }
  try {
    const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) =>
      renameDomain(draft, current, next),
    );
    emit("update:modelValue", updated);
    localError.value = "";
    emit("notice", {
      tone: "info",
      message: t("已把域 {from} 改名为 {to}，并同步更新了 links 里的 domain_id。", { from: current, to: next }),
    });
  } catch (error) {
    reportError(error);
  }
}

function updateType(index: number, event: Event) {
  const next = eventValue(event) as DomainType;
  const current = domainId(index);
  if (next === domainType(index)) return;
  const bound = domainModule(index);
  try {
    const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) =>
      setDomainType(draft, current, next),
    );
    emit("update:modelValue", updated);
    localError.value = "";
    const kind = moduleKindOf(bound);
    if (kind && kind !== next) {
      emit("notice", {
        tone: "warning",
        message: t(
          "域 {domain} 现在是 {type}，但它绑定的模型 {module} 属于 {kind}：两边对不上，请核对「模块绑定参数」。",
          {
            domain: current,
            type: domainTypeLabel(next),
            module: bound,
            kind: domainTypeLabel(kind),
          },
        ),
      });
      return;
    }
    emit("notice", {
      tone: "info",
      message: t("域 {domain} 的类型已改为 {type}。", { domain: current, type: domainTypeLabel(next) }),
    });
  } catch (error) {
    reportError(error);
  }
}

function updateModule(index: number, event: Event) {
  const next = eventValue(event).trim();
  const current = domainId(index);
  if (!next || next === domainModule(index)) return;
  const currentType = domainType(index);
  try {
    const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) =>
      setDomainModuleBinding(draft, current, next),
    );
    emit("update:modelValue", updated);
    localError.value = "";
    const kind = moduleKindOf(next);
    if (kind && kind !== currentType) {
      emit("notice", {
        tone: "warning",
        message: t("域 {domain} 现在绑定模型 {module}（{kind}），和它的域类型 {type} 对不上，请核对。", {
          domain: current,
          module: next,
          kind: domainTypeLabel(kind),
          type: domainTypeLabel(currentType),
        }),
      });
      return;
    }
    emit("notice", {
      tone: "info",
      message: t("域 {domain} 现在绑定网络模型 {module}。", { domain: current, module: next }),
    });
  } catch (error) {
    reportError(error);
  }
}

function updateOptionalEnum(index: number, key: "default_fidelity" | "failure_policy", event: Event) {
  const value = eventValue(event);
  try {
    const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) => {
      const target = topologyDomainsOf(draft)?.[index];
      if (!target || !isJsonObject(target)) return;
      if (value) target[key] = value;
      else delete target[key];
    });
    emit("update:modelValue", updated);
    localError.value = "";
  } catch (error) {
    reportError(error);
  }
}

/** Membership toggles stay silent: the tick itself plus the graph are the feedback. */
function toggleMember(index: number, device: string, event: Event) {
  const include = Boolean((event.target as HTMLInputElement | null)?.checked);
  try {
    const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) =>
      setDomainMember(draft, domainId(index), device, include),
    );
    emit("update:modelValue", updated);
    localError.value = "";
  } catch (error) {
    reportError(error);
  }
}

function dropDomain(index: number) {
  const target = domainId(index);
  if (!target || !documentValue.value) return;
  const references = domainReferences(documentValue.value, target);
  try {
    const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) => {
      removeDomain(draft, target);
    });
    emit("update:modelValue", updated);
    localError.value = "";
    emit(
      "notice",
      references.links.length
        ? {
            tone: "warning",
            message: t("已删除域 {domain}，它下面的 {count} 条连接也一并删除。", {
              domain: target,
              count: references.links.length,
            }),
          }
        : { tone: "info", message: t("已删除域 {domain}。", { domain: target }) },
    );
  } catch (error) {
    reportError(error);
  }
}
</script>

<template>
  <section class="domain-inventory" :aria-label="t('域清单')">
    <header class="structured-block__header">
      <Network :size="16" />
      <div>
        <span
          ><strong>{{ t("域清单") }}</strong
          ><InlineHelp :text="t('域用于分组节点并指定通信模型；最多 {max} 个。', { max: topologyDomainMaxItems })"
        /></span>
      </div>
      <button type="button" class="button button--secondary" @click="addOne">
        <Plus :size="15" />{{ t("新增域") }}
      </button>
    </header>

    <p v-if="!parsed.ok" class="structured-note structured-note--warning" role="alert">{{ parsed.error }}</p>
    <p v-else-if="!domains" class="structured-note structured-note--warning" role="alert">
      {{ t("topology JSON 缺少 domains 数组，域清单暂不可编辑。") }}
    </p>
    <p v-else-if="!domains.length" class="structured-note">
      {{ t("当前没有域。点「新增域」创建第一个，再勾选它包含哪些节点。") }}
    </p>

    <ul v-else class="domain-inventory__rows">
      <li v-for="index in rowIndexes" :key="`domain-row-${index}`" class="domain-inventory-row">
        <span class="domain-inventory-row__index">{{ index + 1 }}</span>
        <label :data-input-path="cellPath(index, 'domain_id')" title="domain_id">
          <span>{{ domainLabel("domain_id") }}</span>
          <input
            type="text"
            spellcheck="false"
            :value="domainId(index)"
            :aria-label="`${domainLabel('domain_id')} ${index + 1}`"
            :aria-invalid="fieldPath === cellPath(index, 'domain_id')"
            @change="updateName(index, $event)"
          />
        </label>
        <label :data-input-path="cellPath(index, 'domain_type')" title="domain_type">
          <span>{{ domainLabel("domain_type") }}</span>
          <select
            :value="domainType(index)"
            :aria-label="`${domainLabel('domain_type')} ${index + 1}`"
            @change="updateType(index, $event)"
          >
            <option v-for="value in domainTypeValues" :key="`type-${value}`" :value="value">
              {{ domainTypeLabel(value) }}
            </option>
          </select>
        </label>
        <label :data-input-path="cellPath(index, 'module_binding')" title="module_binding">
          <span>{{ domainLabel("module_binding") }}</span>
          <select
            :value="domainModule(index)"
            :aria-label="`${domainLabel('module_binding')} ${index + 1}`"
            @change="updateModule(index, $event)"
          >
            <option v-for="option in moduleOptions" :key="`module-${option.name}`" :value="option.name">
              {{ option.name }}
            </option>
            <option
              v-if="!moduleOptions.some((entry) => entry.name === domainModule(index))"
              :value="domainModule(index)"
            >
              {{ domainModule(index) }}
            </option>
          </select>
        </label>
        <label
          v-for="key in ['default_fidelity', 'failure_policy'] as const"
          :key="`${index}-${key}`"
          :data-input-path="cellPath(index, key)"
          :title="key"
        >
          <span>{{ domainLabel(key) }}</span>
          <select
            :value="domainEnumValue(index, key)"
            :aria-label="`${domainLabel(key)} ${index + 1}`"
            :aria-invalid="fieldPath === cellPath(index, key)"
            @change="updateOptionalEnum(index, key, $event)"
          >
            <option value="">{{ t("未设置（省略字段）") }}</option>
            <option v-for="value in domainEnumValues[key]" :key="`${key}-${value}`" :value="value">
              {{ domainEnumLabel(value) }}
            </option>
          </select>
        </label>
        <fieldset class="domain-inventory-row__members" :aria-label="`${domainLabel('member_devices')} ${index + 1}`">
          <legend>
            {{ domainLabel("member_devices") }}
            <small>{{
              t("已选 {selected} / 共 {total} 个节点", {
                selected: domainMembers(index).length,
                total: deviceIds.length,
              })
            }}</small>
          </legend>
          <label v-for="device in deviceIds" :key="`${index}-${device}`" class="domain-member-option">
            <input
              type="checkbox"
              :checked="domainMembers(index).includes(device)"
              @change="toggleMember(index, device, $event)"
            />
            <span>{{ device }}</span>
          </label>
          <small v-if="!deviceIds.length" class="domain-member-empty">{{
            t("还没有设备，先在「设备清单」里添加节点。")
          }}</small>
        </fieldset>
        <button
          type="button"
          class="icon-button"
          :aria-label="t('删除域 {domain}', { domain: domainId(index) })"
          @click="dropDomain(index)"
        >
          <Trash2 :size="14" />
        </button>
        <p v-if="bindingMismatch(index)" class="structured-note structured-note--warning">
          {{
            t("这个域是 {type}，但绑定的模型 {module} 属于 {kind}，两边对不上，请核对「模块绑定参数」。", {
              type: domainTypeLabel(domainType(index)),
              module: domainModule(index),
              kind: domainTypeLabel(moduleKindOf(domainModule(index))),
            })
          }}
        </p>
        <p v-else-if="!domainMembers(index).length" class="structured-note">
          {{ t("这个域还没有成员设备：它不会承载任何通信。") }}
        </p>
      </li>
    </ul>

    <p v-if="localError" class="structured-note structured-note--error" role="alert">{{ localError }}</p>
    <p v-else-if="unrenderedFields.length" class="structured-note structured-note--warning">
      {{
        t("契约里还有 {count} 个可选域字段没有控件（留空即省略），要改请直接在原始 JSON 里编辑：{fields}", {
          count: unrenderedFields.length,
          fields: unrenderedFields.map((field) => field.key).join("、"),
        })
      }}
    </p>
  </section>
</template>
