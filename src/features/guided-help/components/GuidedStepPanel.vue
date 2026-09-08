<script setup lang="ts">
import { ArrowUpRight, Search, X } from "@lucide/vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "../../../i18n";
import { guideRegistry } from "../catalog";
import type { GuideDefinition, GuideId, HelpAnchor } from "../schema";

const props = defineProps<{
  guide: GuideDefinition;
  contextGuideId: GuideId;
  availableAnchors: readonly HelpAnchor[];
  pageHref: string | null;
  relatedHref: string;
}>();
const emit = defineEmits<{
  close: [];
  select: [guideId: GuideId];
  locate: [anchor: HelpAnchor];
  navigate: [related: boolean];
}>();
const { t, isEnglish } = useI18n();
const dialog = ref<HTMLDialogElement | null>(null);
const article = ref<HTMLElement | null>(null);
const heading = ref<HTMLElement | null>(null);
const search = ref("");
const groups: { title: string; ids: GuideId[] }[] = [
  { title: "实验与输入", ids: ["overview", "experiment", "history"] },
  { title: "结果分析", ids: ["execution", "metrics", "fabric", "attribution", "design_space"] },
  { title: "证据与校准", ids: ["validation", "evidence_agent", "evidence_lab"] },
  { title: "参考资料", ids: ["raw_evidence", "unsupported_schema"] },
];
const filteredGroups = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  return groups
    .map((group) => ({
      title: group.title,
      guides: group.ids
        .map((id) => guideRegistry[id])
        .filter(
          (guide) =>
            !query ||
            [guide.title, guide.description, ...guide.terms.map((term) => term.term)].some((text) =>
              `${text} ${t(text)}`.toLocaleLowerCase().includes(query),
            ),
        ),
    }))
    .filter((group) => group.guides.length);
});
const sections = computed(() => [
  ...props.guide.steps.map((step) => ({ id: step.id, title: step.title })),
  { id: "terms", title: "术语与定义" },
  { id: "scope", title: "适用范围与证据边界" },
  { id: "reference", title: props.guide.advanced.title },
]);
const sectionId = (id: string) => `help-${props.guide.id}-${id}`;
let previousOverflow = "";

function containFocus(event: KeyboardEvent) {
  if (event.key !== "Tab" || !dialog.value) return;
  const controls = [...dialog.value.querySelectorAll<HTMLElement>('a[href], button, input, [tabindex="0"]')].filter(
    (element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0,
  );
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function jump(id: string) {
  const target = document.getElementById(sectionId(id));
  target?.scrollIntoView({ behavior: "auto", block: "start" });
  target?.focus({ preventScroll: true });
}

watch(
  () => props.guide.id,
  async () => {
    await nextTick();
    if (!dialog.value?.open) return;
    article.value?.scrollTo?.({ top: 0, behavior: "auto" });
    heading.value?.focus({ preventScroll: true });
  },
);

onMounted(() => {
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  dialog.value?.showModal();
  dialog.value?.querySelector<HTMLButtonElement>(".help-documentation-close")?.focus();
});
onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow;
  dialog.value?.close();
});
</script>

<template>
  <dialog
    ref="dialog"
    class="help-documentation"
    :lang="isEnglish ? 'en' : 'zh-CN'"
    aria-labelledby="help-documentation-title"
    @cancel.prevent="emit('close')"
    @keydown="containFocus"
  >
    <header class="help-documentation-header">
      <span
        >TileSim <strong>{{ t("帮助文档") }}</strong></span
      >
      <button
        class="icon-button help-documentation-close"
        type="button"
        :aria-label="t('关闭帮助')"
        @click="emit('close')"
      >
        <X :size="19" aria-hidden="true" />
      </button>
    </header>
    <div class="help-documentation-layout">
      <nav class="help-documentation-nav" :aria-label="t('帮助主题')">
        <label class="help-documentation-search">
          <Search :size="15" aria-hidden="true" />
          <input v-model="search" type="search" :aria-label="t('搜索帮助主题')" :placeholder="t('搜索帮助主题')" />
        </label>
        <section v-for="group in filteredGroups" :key="group.title">
          <h2>{{ t(group.title) }}</h2>
          <ul>
            <li v-for="topic in group.guides" :key="topic.id">
              <button
                type="button"
                :data-guide-id="topic.id"
                :aria-current="guide.id === topic.id ? 'page' : undefined"
                @click="emit('select', topic.id)"
              >
                {{ t(topic.title) }}
              </button>
            </li>
          </ul>
        </section>
        <p v-if="!filteredGroups.length" role="status" class="help-documentation-no-results">
          {{ t("没有匹配的帮助主题。") }}
        </p>
      </nav>
      <article ref="article" class="help-documentation-article" tabindex="0" :aria-label="t(guide.title)">
        <header class="help-documentation-intro">
          <p class="help-documentation-context">{{ guide.id === contextGuideId ? t("当前页面") : t("产品文档") }}</p>
          <h1 id="help-documentation-title" ref="heading" tabindex="-1">{{ t(guide.title) }}</h1>
          <p>{{ t(guide.description) }}</p>
          <a
            v-if="pageHref && guide.id !== contextGuideId"
            :href="pageHref"
            @click.exact.prevent="emit('navigate', false)"
            >{{ t("打开此页面") }}<ArrowUpRight :size="14" aria-hidden="true"
          /></a>
        </header>
        <nav class="help-documentation-toc" :aria-label="t('本文目录')">
          <strong>{{ t("本文目录") }}</strong>
          <ul>
            <li v-for="section in sections" :key="section.id">
              <button type="button" @click="jump(section.id)">{{ t(section.title) }}</button>
            </li>
          </ul>
        </nav>
        <section v-for="section in guide.steps" :key="section.id" class="help-documentation-section">
          <h2 :id="sectionId(section.id)" tabindex="-1">{{ t(section.title) }}</h2>
          <p>{{ t(section.body) }}</p>
          <button
            v-if="guide.id === contextGuideId && availableAnchors.includes(section.anchor)"
            class="help-documentation-locate"
            type="button"
            @click="emit('locate', section.anchor)"
          >
            {{ t("在页面中查看") }}<ArrowUpRight :size="14" aria-hidden="true" />
          </button>
        </section>
        <section class="help-documentation-section">
          <h2 :id="sectionId('terms')" tabindex="-1">{{ t("术语与定义") }}</h2>
          <dl class="help-documentation-terms">
            <div v-for="term in guide.terms" :key="term.id">
              <dt>{{ t(term.term) }}</dt>
              <dd>{{ t(term.definition) }}</dd>
            </div>
          </dl>
        </section>
        <section class="help-documentation-section">
          <h2 :id="sectionId('scope')" tabindex="-1">{{ t("适用范围与证据边界") }}</h2>
          <p>{{ t(guide.takeaway) }}</p>
        </section>
        <section class="help-documentation-section">
          <h2 :id="sectionId('reference')" tabindex="-1">{{ t(guide.advanced.title) }}</h2>
          <p>{{ t(guide.advanced.body) }}</p>
        </section>
        <footer class="help-documentation-related">
          <h2>{{ t("相关页面") }}</h2>
          <a :href="relatedHref" @click.exact.prevent="emit('navigate', true)"
            >{{ t(guide.next.label) }}<ArrowUpRight :size="14" aria-hidden="true"
          /></a>
        </footer>
      </article>
    </div>
  </dialog>
</template>
