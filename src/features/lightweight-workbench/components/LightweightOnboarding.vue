<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "../../../i18n";

const { t } = useI18n();

const dismissed = ref(false);

function skip() {
  dismissed.value = true;
}

function reopen() {
  dismissed.value = false;
}
</script>

<template>
  <section class="lightweight-onboarding" aria-label="首次使用引导">
    <div v-if="!dismissed" class="lightweight-onboarding__panel">
      <div class="lightweight-onboarding__heading">
        <div>
          <p class="section-kicker">{{ t("首次使用") }}</p>
          <h2 id="lightweight-onboarding-title">{{ t("三步了解轻量工作台") }}</h2>
        </div>
        <button type="button" class="lightweight-onboarding__skip" @click="skip">{{ t("跳过引导") }}</button>
      </div>
      <ol class="lightweight-onboarding__steps">
        <li>
          <strong>{{ t("了解") }}</strong
          ><span>{{ t("用概念卡熟悉仿真中的基本词汇。") }}</span>
        </li>
        <li>
          <strong>{{ t("准备") }}</strong
          ><span>{{ t("填写基础配置并校验请求。") }}</span>
        </li>
        <li>
          <strong>{{ t("解读") }}</strong
          ><span>{{ t("提交正式 run，查看真实状态和结果。") }}</span>
        </li>
      </ol>
      <p class="lightweight-onboarding__note">
        {{ t("Agent 只生成解释和草案；正式 run 由工作台校验后提交，不会调用 Provider。") }}
      </p>
    </div>
    <div v-else class="lightweight-onboarding__reopen">
      <span>{{ t("已跳过首次引导。") }}</span>
      <button type="button" class="lightweight-onboarding__reopen-button" @click="reopen">
        {{ t("重新查看引导") }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.lightweight-onboarding {
  margin-bottom: 22px;
}
.lightweight-onboarding__panel,
.lightweight-onboarding__reopen {
  padding: clamp(20px, 3vw, 28px);
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--surface-subtle);
}
.lightweight-onboarding__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.lightweight-onboarding h2 {
  margin: 0;
  font-size: clamp(21px, 3vw, 28px);
}
.lightweight-onboarding__skip,
.lightweight-onboarding__reopen-button {
  border: 0;
  padding: 4px 0;
  color: var(--accent);
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.lightweight-onboarding__skip:focus-visible,
.lightweight-onboarding__reopen-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}
.lightweight-onboarding__steps {
  display: grid;
  gap: 12px;
  margin: 20px 0 0;
  padding-left: 24px;
}
.lightweight-onboarding__steps li {
  display: grid;
  gap: 2px;
  padding-left: 4px;
}
.lightweight-onboarding__steps span,
.lightweight-onboarding__note,
.lightweight-onboarding__reopen {
  color: var(--muted);
  line-height: 1.5;
}
.lightweight-onboarding__note {
  margin: 18px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  font-size: var(--text-sm);
}
.lightweight-onboarding__reopen {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: var(--text-sm);
}
@media (max-width: 520px) {
  .lightweight-onboarding__heading,
  .lightweight-onboarding__reopen {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
