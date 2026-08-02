<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import UiCard from "../components/UiCard.vue";
import TiLayout from "../layouts/TiLayout.vue";
import { fetchAiModels, type AiPublicModel } from "../api/ai";
import {
  getMySettings,
  getPersonalExportStatus,
  loadLocalUser,
  requestPersonalDataExport,
  saveLocalUser,
  updateMySettings,
  type AutosaveIntervalSeconds,
  type PersonalExportStatus
} from "../api/auth";
import {
  readHighlighterEnabled,
  readSubmissionAnalysisMode,
  saveDeviceContentPreferences,
  type SubmissionAnalysisMode
} from "../utils/devicePreferences";
import {
  readSidebarAutoBehavior,
  saveSidebarAutoBehavior,
  type SidebarAutoBehavior
} from "../utils/sidebarPreferences";

const { t } = useI18n();
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const success = ref("");
const isLoggedIn = ref(Boolean(loadLocalUser()?.uid));
type SettingsSection = "account" | "preferences" | "ai";
const activeSection = ref<SettingsSection>(isLoggedIn.value ? "account" : "preferences");
const exporting = ref(false);
const exportError = ref("");
const exportStatus = ref<PersonalExportStatus | null>(null);

const recordsPublic = ref(true);
const profileCoverUrl = ref("");
const submissionAnalysisMode = ref<SubmissionAnalysisMode>(readSubmissionAnalysisMode());
const autosaveIntervalSeconds = ref<AutosaveIntervalSeconds>(30);
const highlighterEnabled = ref(readHighlighterEnabled());
const sidebarAutoBehavior = ref<SidebarAutoBehavior>(readSidebarAutoBehavior());
const aiModels = ref<AiPublicModel[]>([]);
const aiModelId = ref("");
const aiModelUsageRows = computed(() => aiModels.value.map((model) => ({
  id: model.id,
  name: model.name || model.model || model.id,
  used: Number(model.usedCount ?? 0),
  dailyLimit: Number(model.dailyLimit ?? 0),
  remaining: model.remainingCount
})));
const defaultProfileCovers = [
  "https://resources.cn-sy1.rains3.com/ti/banner_1.webp",
  "https://resources.cn-sy1.rains3.com/ti/banner_2.webp",
  "https://resources.cn-sy1.rains3.com/ti/banner_3.webp"
] as const;
const nextExportTime = computed(() => {
  if (!exportStatus.value?.nextAvailableAt) return "";
  const date = new Date(exportStatus.value.nextAvailableAt);
  if (Number.isNaN(date.getTime())) return exportStatus.value.nextAvailableAt;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
});

const autosaveOptions: Array<{ value: AutosaveIntervalSeconds; label: string }> = [
  { value: 30, label: t("settings.autosave.30") },
  { value: 60, label: t("settings.autosave.60") },
  { value: 120, label: t("settings.autosave.120") },
  { value: 300, label: t("settings.autosave.300") },
  { value: 600, label: t("settings.autosave.600") },
  { value: 0, label: t("settings.autosave.off") }
];

function normalizeAutosaveInterval(value: unknown): AutosaveIntervalSeconds {
  const parsed = Number(value);
  if (parsed === 0 || parsed === 30 || parsed === 60 || parsed === 120 || parsed === 300 || parsed === 600) {
    return parsed;
  }
  return 30;
}

function pickDefaultProfileCover() {
  const index = Math.floor(Math.random() * defaultProfileCovers.length);
  return defaultProfileCovers[index];
}

function clearCoverUrl() {
  profileCoverUrl.value = pickDefaultProfileCover();
}

async function loadSettings() {
  const me = loadLocalUser();
  isLoggedIn.value = Boolean(me?.uid);
  submissionAnalysisMode.value = readSubmissionAnalysisMode();
  highlighterEnabled.value = readHighlighterEnabled();
  sidebarAutoBehavior.value = readSidebarAutoBehavior();
  if (!me?.uid) {
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = "";
  success.value = "";
  try {
    const [settings, modelPayload, personalExportStatus] = await Promise.all([
      getMySettings(),
      fetchAiModels(),
      getPersonalExportStatus()
    ]);
    aiModels.value = modelPayload.models;
    exportStatus.value = personalExportStatus;
    recordsPublic.value = Boolean(settings.recordsPublic);
    profileCoverUrl.value = String(settings.profileCoverUrl ?? "");
    submissionAnalysisMode.value = settings.submissionAnalysisMode ?? "wrong_only";
    autosaveIntervalSeconds.value = normalizeAutosaveInterval(settings.autosaveIntervalSeconds);
    highlighterEnabled.value = Boolean(settings.highlighterEnabled ?? true);
    aiModelId.value = String(settings.aiModelId || modelPayload.defaultModelId || modelPayload.models[0]?.id || "");
  } catch (err) {
    error.value = String((err as Error)?.message ?? err);
  } finally {
    loading.value = false;
  }
}

async function exportPersonalData() {
  if (exporting.value || exportStatus.value?.canExport === false) return;
  exporting.value = true;
  exportError.value = "";
  try {
    const { blob, filename } = await requestPersonalDataExport();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    exportStatus.value = await getPersonalExportStatus();
  } catch (err) {
    exportError.value = String((err as Error)?.message ?? err);
    try {
      exportStatus.value = await getPersonalExportStatus();
    } catch {
      // Keep the original export error visible when status refresh also fails.
    }
  } finally {
    exporting.value = false;
  }
}

async function submitSettings() {
  if (saving.value) return;
  saving.value = true;
  error.value = "";
  success.value = "";
  try {
    saveDeviceContentPreferences(submissionAnalysisMode.value, highlighterEnabled.value);
    saveSidebarAutoBehavior(sidebarAutoBehavior.value);
    if (!isLoggedIn.value) {
      success.value = t("settings.saved");
      return;
    }
    const result = await updateMySettings({
      recordsPublic: recordsPublic.value,
      profileCoverUrl: profileCoverUrl.value.trim(),
      submissionAnalysisMode: submissionAnalysisMode.value,
      autosaveIntervalSeconds: autosaveIntervalSeconds.value,
      aiModelId: aiModelId.value,
      highlighterEnabled: highlighterEnabled.value
    });
    saveLocalUser(result.user);
    profileCoverUrl.value = String(result.settings.profileCoverUrl ?? result.user.profileCoverUrl ?? "");
    aiModelId.value = String(result.settings.aiModelId ?? result.user.aiModelId ?? aiModelId.value);
    success.value = t("settings.saved");
  } catch (err) {
    error.value = String((err as Error)?.message ?? err);
  } finally {
    saving.value = false;
  }
}

onMounted(loadSettings);
</script>

<template>
  <TiLayout
    :title="t('settings.title')"
    :subtitle="t('settings.subtitle')"
    :loading="loading"
    :loading-label="t('settings.loading')"
  >
    <section class="settings-root">
      <UiCard v-if="isLoggedIn" as="div" class="settings-notice" compact>
        <i class="fa-solid fa-circle-info"></i>
        <div>
          <strong>{{ t("settings.noticeTitle") }}</strong>
          <p>{{ t("settings.noticePrefix") }}<a href="https://auth.luogu.me/profile" target="_blank" rel="noopener noreferrer">{{ t("settings.noticeLink") }}</a>{{ t("settings.noticeSuffix") }}</p>
        </div>
      </UiCard>

      <UiCard v-else as="div" class="settings-notice guest-settings-notice" compact>
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div>
          <strong>{{ t("settings.guestNoticeTitle") }}</strong>
          <p>
            {{ t("settings.guestNoticeMessage") }}
            <RouterLink to="/auth/login">{{ t("settings.guestNoticeLogin") }}</RouterLink>
          </p>
        </div>
      </UiCard>

      <template v-if="!loading">
        <nav class="panel-card settings-tabs" role="tablist" :aria-label="t('settings.sectionNavigation')">
          <button
            v-if="isLoggedIn"
            id="settings-tab-account"
            type="button"
            role="tab"
            aria-controls="settings-panel-account settings-panel-data"
            :aria-selected="activeSection === 'account'"
            :class="{ active: activeSection === 'account' }"
            @click="activeSection = 'account'"
          >
            {{ t("settings.sectionAccount") }}
          </button>
          <button
            id="settings-tab-preferences"
            type="button"
            role="tab"
            aria-controls="settings-panel-preferences"
            :aria-selected="activeSection === 'preferences'"
            :class="{ active: activeSection === 'preferences' }"
            @click="activeSection = 'preferences'"
          >
            {{ t("settings.sectionPreferences") }}
          </button>
          <button
            v-if="isLoggedIn"
            id="settings-tab-ai"
            type="button"
            role="tab"
            aria-controls="settings-panel-ai"
            :aria-selected="activeSection === 'ai'"
            :class="{ active: activeSection === 'ai' }"
            @click="activeSection = 'ai'"
          >
            {{ t("settings.sectionAi") }}
          </button>
        </nav>

        <section
          v-if="isLoggedIn && activeSection === 'account'"
          id="settings-panel-account"
          class="settings-section"
          role="tabpanel"
          aria-labelledby="settings-tab-account"
        >

        <UiCard as="div" class="settings-item" compact>
          <label class="item-title" for="records-public"><i class="fa-solid fa-eye"></i>{{ t("settings.recordsPublic") }}</label>
          <div class="switch">
            <label>
              <input v-model="recordsPublic" type="radio" :value="true" />
              <i class="fa-solid fa-globe"></i>
              <span>{{ t("settings.public") }}</span>
            </label>
            <label>
              <input v-model="recordsPublic" type="radio" :value="false" />
              <i class="fa-solid fa-user-shield"></i>
              <span>{{ t("settings.private") }}</span>
            </label>
          </div>
        </UiCard>

        <UiCard as="div" class="settings-item" compact>
          <label class="item-title" for="profile-cover-url"><i class="fa-regular fa-image"></i>{{ t("settings.coverUrl") }}</label>
          <input
            id="profile-cover-url"
            v-model.trim="profileCoverUrl"
            class="text-input"
            type="url"
            :placeholder="t('settings.coverPlaceholder')"
          />
          <p class="item-desc">{{ t("settings.coverDesc") }}</p>
          <div class="cover-actions">
            <button type="button" class="minor-btn" @click="clearCoverUrl">
              <i class="fa-solid fa-eraser"></i>
              {{ t("settings.clearCover") }}
            </button>
          </div>
          <div class="cover-preview" :style="profileCoverUrl ? { backgroundImage: `url(${profileCoverUrl})` } : {}">
            <div class="preview-tip"><i class="fa-solid fa-panorama"></i>{{ t("common.preview") }}</div>
          </div>
        </UiCard>
        </section>

        <section
          v-show="activeSection === 'preferences'"
          id="settings-panel-preferences"
          class="settings-section"
          role="tabpanel"
          aria-labelledby="settings-tab-preferences"
        >

        <UiCard as="div" class="settings-item" compact>
          <label class="item-title" for="submission-analysis-mode"><i class="fa-solid fa-file-circle-check"></i>{{ t("settings.analysisMode") }}</label>
          <div class="switch">
            <label>
              <input v-model="submissionAnalysisMode" type="radio" value="wrong_only" />
              <i class="fa-solid fa-circle-exclamation"></i>
              <span>{{ t("settings.analysisWrongOnly") }}</span>
            </label>
            <label>
              <input v-model="submissionAnalysisMode" type="radio" value="none" />
              <i class="fa-regular fa-eye-slash"></i>
              <span>{{ t("settings.analysisNone") }}</span>
            </label>
            <label>
              <input v-model="submissionAnalysisMode" type="radio" value="all" />
              <i class="fa-regular fa-eye"></i>
              <span>{{ t("settings.analysisAll") }}</span>
            </label>
          </div>
          <p class="item-desc">{{ t("settings.analysisDesc") }}</p>
        </UiCard>

        <UiCard v-if="isLoggedIn" as="div" class="settings-item" compact>
          <label class="item-title"><i class="fa-regular fa-floppy-disk"></i>{{ t("settings.autosaveTitle") }}</label>
          <div class="switch">
            <label v-for="option in autosaveOptions" :key="option.value">
              <input v-model="autosaveIntervalSeconds" type="radio" :value="option.value" />
              <i class="fa-regular fa-clock"></i>
              <span>{{ option.label }}</span>
            </label>
          </div>
          <p class="item-desc">{{ t("settings.autosaveDesc") }}</p>
        </UiCard>

        <UiCard as="div" class="settings-item" compact>
          <label class="item-title"><i class="fa-solid fa-highlighter"></i>{{ t("settings.highlighterTitle") }}</label>
          <div class="switch">
            <label>
              <input v-model="highlighterEnabled" type="radio" :value="true" />
              <i class="fa-regular fa-eye"></i>
              <span>{{ t("settings.highlighterShow") }}</span>
            </label>
            <label>
              <input v-model="highlighterEnabled" type="radio" :value="false" />
              <i class="fa-regular fa-eye-slash"></i>
              <span>{{ t("settings.highlighterHide") }}</span>
            </label>
          </div>
          <p class="item-desc">{{ t("settings.highlighterDesc") }}</p>
        </UiCard>

        <UiCard as="div" class="settings-item" compact>
          <label class="item-title"><i class="fa-solid fa-columns"></i>{{ t("settings.sidebarAutoBehaviorTitle") }}</label>
          <div class="switch">
            <label>
              <input v-model="sidebarAutoBehavior" type="radio" value="overlay" />
              <i class="fa-solid fa-layer-group"></i>
              <span>{{ t("settings.sidebarAutoBehaviorOverlay") }}</span>
            </label>
            <label>
              <input v-model="sidebarAutoBehavior" type="radio" value="push" />
              <i class="fa-solid fa-arrows-left-right-to-line"></i>
              <span>{{ t("settings.sidebarAutoBehaviorPush") }}</span>
            </label>
          </div>
          <p class="item-desc">{{ t("settings.sidebarAutoBehaviorDesc") }}</p>
        </UiCard>
        </section>

        <section
          v-if="isLoggedIn && activeSection === 'ai'"
          id="settings-panel-ai"
          class="settings-section"
          role="tabpanel"
          aria-labelledby="settings-tab-ai"
        >

        <UiCard as="div" class="settings-item" compact>
          <label class="item-title" for="ai-model-id"><i class="fa-solid fa-wand-magic-sparkles"></i>{{ t("settings.aiModelTitle") }}</label>
          <select id="ai-model-id" v-model="aiModelId" class="text-input" required>
            <option v-for="model in aiModels" :key="model.id" :value="model.id">
              {{ model.name || model.model || model.id }}
            </option>
          </select>
          <p class="item-desc">{{ t("settings.aiModelDesc") }}</p>
          <div class="ai-usage-list">
            <div v-for="model in aiModelUsageRows" :key="model.id" class="ai-usage-row">
              <span>{{ model.name }}</span>
              <strong v-if="model.dailyLimit > 0">
                {{ t("settings.aiQuotaLimited", { remaining: model.remaining ?? 0, limit: model.dailyLimit, used: model.used }) }}
              </strong>
              <strong v-else>{{ t("settings.aiQuotaUnlimited", { used: model.used }) }}</strong>
            </div>
          </div>
        </UiCard>
        </section>

        <section
          v-if="isLoggedIn && activeSection === 'account'"
          id="settings-panel-data"
          class="settings-section"
          role="tabpanel"
          aria-labelledby="settings-tab-account"
        >

        <UiCard as="div" class="settings-item personal-export-card" compact>
          <div class="item-title">
            <i class="fa-solid fa-file-export"></i>{{ t("settings.personalExportTitle") }}
          </div>
          <p class="item-desc">{{ t("settings.personalExportDesc") }}</p>
          <ul class="personal-export-contents">
            <li>{{ t("settings.personalExportProfile") }}</li>
          </ul>
          <p class="item-desc">
            <a
              href="https://s.luogu.me/f/d/qzcm/%E4%BF%9D%E5%AD%98%E7%AB%99%E6%9C%89%E9%A2%98%E6%95%B0%E6%8D%AE%E5%AF%BC%E5%87%BA%E7%A4%BA%E4%BE%8B.pdf"
              target="_blank"
              rel="noopener noreferrer"
            >{{ t("settings.personalExportExample") }}</a>
          </p>
          <p class="item-desc">
            {{ exportStatus?.isUnlimited ? t("settings.personalExportUnlimited") : t("settings.personalExportLimit") }}
          </p>
          <p v-if="exportStatus && !exportStatus.canExport && nextExportTime" class="export-cooldown">
            <i class="fa-regular fa-clock"></i>
            {{
              exportStatus.restrictionReason === "registration_wait"
                ? t("settings.personalExportRegistrationWait", { time: nextExportTime })
                : t("settings.personalExportNext", { time: nextExportTime })
            }}
          </p>
          <button
            type="button"
            class="minor-btn export-btn"
            :disabled="exporting || exportStatus?.canExport === false"
            @click="exportPersonalData"
          >
            <i class="fa-solid fa-download"></i>
            {{ exporting ? t("settings.personalExportPreparing") : t("settings.personalExportButton") }}
          </button>
          <p v-if="exportError" class="state-tip error">
            <i class="fa-solid fa-circle-exclamation"></i>{{ exportError }}
          </p>
        </UiCard>

        <UiCard as="div" class="settings-item account-deletion-card" compact>
          <div class="item-title account-deletion-title">
            <i class="fa-solid fa-user-xmark"></i>{{ t("settings.accountDeletionTitle") }}
          </div>
          <p class="item-desc">
            {{ t("settings.accountDeletionDesc") }}
            <RouterLink to="/system/privacy-policy">{{ t("auth.privacyPolicy") }}</RouterLink>{{ t("settings.accountDeletionEnd") }}
          </p>
          <p class="account-deletion-unavailable">
            <i class="fa-solid fa-circle-info"></i>
            <span>
              {{ t("settings.accountDeletionUnavailable") }}
              <a href="mailto:i@hiac.me">i@hiac.me</a>{{ t("settings.accountDeletionEnd") }}
            </span>
          </p>
          <button type="button" class="minor-btn account-deletion-btn" disabled>
            <i class="fa-solid fa-user-xmark"></i>{{ t("settings.accountDeletionButton") }}
          </button>
        </UiCard>
        </section>

        <div class="actions">
          <button type="button" class="save-btn" :disabled="saving" @click="submitSettings">
            <i class="fa-regular fa-floppy-disk"></i>
            {{ saving ? t("common.saving") : t("settings.save") }}
          </button>
        </div>

        <p v-if="error" class="state-tip error"><i class="fa-solid fa-circle-exclamation"></i>{{ error }}</p>
        <p v-if="success" class="state-tip success"><i class="fa-solid fa-circle-check"></i>{{ success }}</p>
      </template>
    </section>
  </TiLayout>
</template>
