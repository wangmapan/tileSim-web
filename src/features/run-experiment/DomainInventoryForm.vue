<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
  topologyDevicesOf,
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
  domain_id: "通信域 ID",
  domain_type: "后端域类型",
  module_binding: "所用网络模型",
  member_devices: "后端端点",
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
const lastScaleOutPreparationSignature = ref<string | null>(null);

function scaleOutPreparationSignature(value: string): string | null {
  const parsedValue = parseJsonDocument(value, "Fabric topology");
  if (!parsedValue.ok) return null;
  const devices = (topologyDevicesOf(parsedValue.value) || [])
    .filter(isJsonObject)
    .map((device) => [device.device_id, device.group_id || ""]);
  const scaleUps = (topologyDomainsOf(parsedValue.value) || [])
    .filter(isJsonObject)
    .filter((domain) => domain.domain_type === "scale_up")
    .map((domain) => [domain.domain_id, domain.member_devices || []]);
  return JSON.stringify({ devices, scaleUps });
}

function syncDerivedScaleOut(value: string): void {
  const parsedValue = parseJsonDocument(value, "Fabric topology");
  if (!parsedValue.ok) return;
  let created = false;
  try {
    const next = patchJsonDocument(value, "Fabric topology", (draft) => {
      created = ensureScaleOutDomain(draft);
    });
    if (!created) return;
    emit("update:modelValue", next);
    emit("notice", { tone: "info", message: t("已根据计算组自动准备组间通信域，请在后端端点中核对。") });
  } catch (error) {
    reportError(error);
  }
}

watch(
  () => props.modelValue,
  (value) => {
    const signature = scaleOutPreparationSignature(value);
    if (!signature || signature === lastScaleOutPreparationSignature.value) return;
    lastScaleOutPreparationSignature.value = signature;
    syncDerivedScaleOut(value);
  },
  { immediate: true },
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

function scaleUpMemberIds(document: JsonObject): string[] {
  const ids = new Set<string>();
  for (const entry of topologyDomainsOf(document) || []) {
    if (!isJsonObject(entry) || entry.domain_type !== "scale_up" || !Array.isArray(entry.member_devices)) continue;
    for (const member of entry.member_devices) if (typeof member === "string") ids.add(member);
  }
  const devices = new Map<string, string>();
  for (const entry of topologyDevicesOf(document) || []) {
    if (!isJsonObject(entry) || typeof entry.device_id !== "string") continue;
    devices.set(entry.device_id, String(entry.device_type || "").toLowerCase());
  }
  return [...ids].filter((id) => devices.get(id) !== "switch");
}

/**
 * The backend resolves scale_up ownership per group and scale_out ownership
 * across participants. Keep the persisted endpoint list in sync while making
 * that distinction explicit in the editor.
 */
function syncScaleOutMembership(document: JsonObject): void {
  const members = scaleUpMemberIds(document);
  for (const entry of topologyDomainsOf(document) || []) {
    if (!isJsonObject(entry) || entry.domain_type !== "scale_out") continue;
    entry.member_devices = [...members];
  }
}

function ensureScaleOutDomain(document: JsonObject): boolean {
  const domains = topologyDomainsOf(document) || [];
  const scaleUps = domains.filter(
    (entry): entry is JsonObject => isJsonObject(entry) && entry.domain_type === "scale_up",
  );
  const memberIds = new Set(scaleUpMemberIds(document));
  const groupIds = new Set(
    (topologyDevicesOf(document) || [])
      .filter(isJsonObject)
      .filter((device) => typeof device.device_id === "string" && memberIds.has(device.device_id))
      .map((device) => (typeof device.group_id === "string" ? device.group_id.trim() : ""))
      .filter(Boolean),
  );
  // `group_id` is the backend's physical placement partition. A single
  // scale_up domain may legitimately cover all partitions, as in the shipped
  // hierarchical examples, so counting scale_up domains alone is incorrect.
  // Keep the old two-domain fallback for legacy documents that have no group_id.
  const hasMultiplePhysicalGroups = groupIds.size >= 2 || (groupIds.size === 0 && scaleUps.length >= 2);
  if (
    !hasMultiplePhysicalGroups ||
    scaleUps.some((entry) => !Array.isArray(entry.member_devices) || !entry.member_devices.length)
  ) {
    return false;
  }
  if (domains.some((entry) => isJsonObject(entry) && entry.domain_type === "scale_out")) {
    syncScaleOutMembership(document);
    return false;
  }
  const binding = moduleBindingNamesOf(document).find((entry) => entry.kind === "scale_out");
  if (!binding) return false;
  addDomain(document, {
    domain_id: nextDomainId(domainIdsOf(document), "scale_out"),
    domain_type: "scale_out",
    module_binding: binding.name,
  });
  syncScaleOutMembership(document);
  return true;
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
  // The normal workflow creates a group-local network. Users do not need to
  // choose scale_out here; the endpoint layer is derived once physical groups
  // exist and is shown separately below.
  const preferred: DomainType = "scale_up";
  const binding = options.find((entry) => entry.kind === preferred);
  if (!binding) {
    localError.value = t(
      "当前 topology 没有声明可用于计算节点组的 scale_up 网络模型；请先在高级「模块绑定参数」中声明一个，不能把跨机模型冒充机内互联。",
    );
    return;
  }
  const id = nextDomainId(domainIdsOf(documentValue.value), preferred);
  try {
    const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) =>
      addDomain(draft, { domain_id: id, domain_type: preferred, module_binding: binding.name }),
    );
    emit("update:modelValue", updated);
    localError.value = "";
    emit("notice", {
      tone: "info",
      message: t("已新增组内通信域 {domain}，绑定网络模型 {module}；请在后端端点中选择设备。", {
        domain: id,
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
  const matchingBinding = moduleOptions.value.find((entry) => entry.kind === next);
  if (!matchingBinding) {
    reportError(
      new StructuredInputError(
        t("当前没有可用于 {type} 的网络模型。请先在「模块绑定参数」中声明匹配的 module_binding。", {
          type: domainTypeLabel(next),
        }),
      ),
    );
    return;
  }
  try {
    const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) => {
      setDomainType(draft, current, next);
      // The backend requires module_kind === domain_type. Switching the
      // domain therefore also switches to a declared model of that kind.
      if (moduleKindOf(bound) !== next) setDomainModuleBinding(draft, current, matchingBinding.name);
    });
    emit("update:modelValue", updated);
    localError.value = "";
    emit("notice", {
      tone: "info",
      message: t("域 {domain} 的类型已改为 {type}，并绑定匹配模型 {module}。", {
        domain: current,
        type: domainTypeLabel(next),
        module: matchingBinding.name,
      }),
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
  const kind = moduleKindOf(next);
  if (kind && kind !== currentType) {
    localError.value = t("模型 {module} 属于 {kind}，不能绑定到 {type} 域。请先切换域类型。", {
      module: next,
      kind: domainTypeLabel(kind),
      type: domainTypeLabel(currentType),
    });
    return;
  }
  try {
    const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) =>
      setDomainModuleBinding(draft, current, next),
    );
    emit("update:modelValue", updated);
    localError.value = "";
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
      (() => {
        setDomainMember(draft, domainId(index), device, include);
        if (domainType(index) === "scale_up") ensureScaleOutDomain(draft);
      })(),
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
      (() => {
        const wasScaleUp = domainType(index) === "scale_up";
        removeDomain(draft, target);
        if (wasScaleUp) syncScaleOutMembership(draft);
      })();
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
  <section class="domain-inventory" :aria-label="t('通信域清单')">
    <header class="structured-block__header">
      <Network :size="16" />
      <div>
        <span
          ><strong>{{ t("通信域") }}</strong
          ><InlineHelp
            :text="
              t('通信域是后端网络资源，不是设备所有权。设备归属由设备清单中的计算组决定，最多 {max} 个通信域。', {
                max: topologyDomainMaxItems,
              })
            "
        /></span>
      </div>
      <button type="button" class="button button--secondary" @click="addOne">
        <Plus :size="15" />{{ t("新增通信域") }}
      </button>
    </header>
    <p class="structured-note">
      {{
        t(
          "设备清单里的计算组决定节点归属；这里仅配置后端通信域。scale_up 用于组内通信，scale_out 用于组间通信，scale_out 的端点列表可以和 scale_up 重叠。",
        )
      }}
    </p>

    <p v-if="!parsed.ok" class="structured-note structured-note--warning" role="alert">{{ parsed.error }}</p>
    <p v-else-if="!domains" class="structured-note structured-note--warning" role="alert">
      {{ t("topology JSON 缺少 domains 数组，域清单暂不可编辑。") }}
    </p>
    <p v-else-if="!domains.length" class="structured-note">
      {{ t("当前没有通信域。点「新增通信域」创建组内通信；形成多个计算组后，组间通信域会自动准备。") }}
    </p>

    <ul v-else class="domain-inventory__rows">
      <li v-for="index in rowIndexes" :key="`domain-row-${index}`" class="domain-inventory-row">
        <span class="domain-inventory-row__index">{{ index + 1 }}</span>
        <p v-if="domainType(index) === 'scale_out'" class="domain-inventory-row__scope">
          {{ t("这是组间通信域：它汇总跨计算组的 endpoint。成员重叠是后端端点语义，不代表这些卡属于两个计算组。") }}
        </p>
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
        <details class="domain-inventory-row__advanced">
          <summary>{{ t("后端绑定与运行策略") }} · {{ domainTypeLabel(domainType(index)) }}</summary>
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
        </details>
        <fieldset
          v-if="domainType(index) === 'scale_up'"
          class="domain-inventory-row__members"
          :aria-label="`${domainLabel('member_devices')} ${index + 1}`"
        >
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
        <div v-else class="domain-inventory-row__members domain-inventory-row__members--derived">
          <span class="domain-inventory-row__members-label">{{ t("组间端点（自动汇总）") }}</span>
          <span v-if="domainMembers(index).length" class="topology-device-pills">
            <span v-for="device in domainMembers(index)" :key="`${index}-derived-${device}`">{{ device }}</span>
          </span>
          <small v-else class="domain-member-empty">{{
            t("先在设备清单中填写至少两个计算组，并配置组内通信域。")
          }}</small>
        </div>
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
