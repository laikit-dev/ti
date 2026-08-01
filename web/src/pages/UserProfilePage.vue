<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { getUserByUid, loadLocalUser, type AuthUser, type PublicUserProfile } from "../api/auth";
import UiCard from "../components/UiCard.vue";
import { problemsetApi, type ProblemsetSummary } from "../api/problemset";
import { fetchActiveExam, fetchUserSubmissions, type SubmissionRecord } from "../api/submission";
import TiLayout from "../layouts/TiLayout.vue";
import { renderLuoguMarkdown } from "../utils/luoguMarkdown";
import { formatDate } from "../utils/shared";
import NotFoundMessage from "../components/NotFoundMessage.vue";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const currentUser = ref<AuthUser | null>(null);
const profile = ref<PublicUserProfile | null>(null);
const activeExam = ref<SubmissionRecord | null>(null);
const submissions = ref<SubmissionRecord[]>([]);
const userProblemsets = ref<ProblemsetSummary[]>([]);
const problemsetTab = ref<"all" | "official_public" | "personal_featured" | "personal_public" | "personal_private">("all");
const topTab = ref<"records" | "problemsets">("records");

const loading = ref(true);
const recordsLoading = ref(true);
const error = ref("");
const recordsError = ref("");

const profileUid = computed(() => String(route.params.uid ?? "").trim());
const showBannedNotice = computed(() => {
  if (!profile.value?.isBanned) return false;
  return currentUser.value?.uid !== profile.value.uid;
});

const canViewPrivateProblemsets = computed(() => {
  const current = currentUser.value;
  if (!current || !profileUid.value) return false;
  return current.uid === profileUid.value || current.isAdmin;
});

const canViewRecords = computed(() => {
  if (profile.value?.recordsPublic) return true;
  const current = currentUser.value;
  if (!current || !profileUid.value) return false;
  return current.uid === profileUid.value || current.isAdmin;
});

const canViewActiveExam = computed(() => canViewPrivateProblemsets.value);

const coverStyle = computed(() => {
  const url = String(profile.value?.profileCoverUrl ?? "").trim();
  if (!url) return {};
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: "cover",
    backgroundPosition: "center"
  };
});

const bioHtml = computed(() => renderLuoguMarkdown(String(profile.value?.bio ?? "").trim()));

const filteredProblemsets = computed(() => {
  if (problemsetTab.value === "all") return userProblemsets.value;
  return userProblemsets.value.filter((item) => item.problemsetType === problemsetTab.value);
});

function switchTopTab(tab: "records" | "problemsets") {
  topTab.value = tab;
}

function problemsetTypeLabel(type: ProblemsetSummary["problemsetType"]) {
  if (type === "official_public") return t("problemset.types.officialPublic");
  if (type === "personal_featured") return t("problemset.types.personalFeatured");
  if (type === "personal_public") return t("problemset.types.personalPublic");
  return t("problemset.types.personalPrivate");
}

function openSubmission(record: SubmissionRecord) {
  router.push(`/problemset/${record.problemsetId}?submission=${record.id}`);
}

function resumeExam() {
  if (!activeExam.value) return;
  router.push(`/problemset/${activeExam.value.problemsetId}/exam?resume=${activeExam.value.id}`);
}

function modeText(mode: SubmissionRecord["mode"]) {
  return mode === "exam" ? t("profile.modeExam") : t("profile.modeTraining");
}

async function loadPage() {
  loading.value = true;
  recordsLoading.value = true;
  error.value = "";
  recordsError.value = "";
  submissions.value = [];
  userProblemsets.value = [];
  activeExam.value = null;
  currentUser.value = loadLocalUser();

  const uid = profileUid.value;
  if (!uid) {
    error.value = t("common.invalidUser");
    loading.value = false;
    recordsLoading.value = false;
    return;
  }

  try {
    profile.value = await getUserByUid(uid);
  } catch (err) {
    error.value = String((err as Error)?.message ?? err);
    loading.value = false;
    recordsLoading.value = false;
    return;
  } finally {
    loading.value = false;
  }

  try {
    userProblemsets.value = await problemsetApi.listUserProblemsets(uid);
  } catch {
    userProblemsets.value = [];
  }

  if (!canViewRecords.value) {
    recordsLoading.value = false;
    return;
  }

  try {
    const activeExamPromise = canViewActiveExam.value ? fetchActiveExam(uid) : Promise.resolve(null);
    const [active, records] = await Promise.all([activeExamPromise, fetchUserSubmissions(uid)]);
    activeExam.value = active;
    submissions.value = records;
  } catch (err) {
    recordsError.value = String((err as Error)?.message ?? err);
  } finally {
    recordsLoading.value = false;
  }
}

onMounted(loadPage);
watch(() => route.params.uid, loadPage);
</script>

<template>
  <TiLayout
    :title="t('profile.title', { uid: profile?.uid ?? profileUid })"
    :subtitle="t('profile.subtitle')"
    :use-panel="false"
  >
    <div class="profile-root">
      <div class="left-col">
        <UiCard class="card tab-card" compact>
          <button
            class="tab"
            :class="{ active: topTab === 'records' }"
            type="button"
            @click="switchTopTab('records')"
          >
            <i class="fa-solid fa-clock-rotate-left"></i>
            {{ t("profile.records") }}
          </button>
          <button
            class="tab"
            :class="{ active: topTab === 'problemsets' }"
            type="button"
            @click="switchTopTab('problemsets')"
          >
            <i class="fa-solid fa-book"></i>
            {{ t("profile.problemsets") }}
          </button>
        </UiCard>

        <section v-if="loading" class="card">{{ t("profile.loading") }}</section>
        <NotFoundMessage v-else-if="error" i18n-prefix="userNotFound" />

        <UiCard v-else-if="topTab === 'records' && canViewRecords && activeExam" class="card active-exam">
          <p class="active-title">{{ t("profile.activeExam") }}</p>
          <button class="link-btn" type="button" @click="resumeExam">
            <i class="fa-solid fa-play"></i>{{ activeExam.problemsetId }} - {{ activeExam.problemsetTitle || t("profile.resumeExam") }}
          </button>
        </UiCard>

        <UiCard v-if="!loading && topTab === 'records' && canViewRecords" class="card records-card" compact>
          <div v-if="recordsLoading" class="records-loading">{{ t("profile.loadingRecords") }}</div>
          <div v-else-if="recordsError" class="records-error">{{ recordsError }}</div>
          <div v-else-if="submissions.length === 0" class="records-empty">{{ t("profile.noSubmissions") }}</div>
          <article
            v-else
            v-for="record in submissions"
            :key="record.id"
            class="record-item"
          >
            <div class="record-head">
              <button class="record-title" type="button" @click="openSubmission(record)">
                {{ record.problemsetTitle || t("profile.problemsetFallback", { id: record.problemsetId }) }}
              </button>
              <span class="record-mode">{{ modeText(record.mode) }}</span>
              <strong class="record-score">{{ record.score }} {{ t("common.points") }}</strong>
              <span class="record-date">{{ formatDate(record.submittedAt || record.updatedAt) }}</span>
            </div>
            <div class="record-actions">
              <button class="view-paper" type="button" @click="openSubmission(record)">
                <i class="fa-regular fa-file-lines"></i>
                {{ t("profile.viewSubmission") }}
              </button>
            </div>
          </article>
        </UiCard>

        <UiCard v-if="!loading && topTab === 'problemsets'" class="card records-card" compact>
          <div class="problemset-header">
            <h3>{{ t("profile.problemsets") }}</h3>
            <div class="problemset-tabs">
              <button class="problemset-tab" :class="{ active: problemsetTab === 'all' }" @click="problemsetTab = 'all'">{{ t("common.all") }}</button>
              <button class="problemset-tab" :class="{ active: problemsetTab === 'official_public' }" @click="problemsetTab = 'official_public'">{{ t("problemset.types.officialPublic") }}</button>
              <button class="problemset-tab" :class="{ active: problemsetTab === 'personal_featured' }" @click="problemsetTab = 'personal_featured'">{{ t("problemset.types.personalFeatured") }}</button>
              <button class="problemset-tab" :class="{ active: problemsetTab === 'personal_public' }" @click="problemsetTab = 'personal_public'">{{ t("problemset.types.personalPublic") }}</button>
              <button
                v-if="canViewPrivateProblemsets"
                class="problemset-tab"
                :class="{ active: problemsetTab === 'personal_private' }"
                @click="problemsetTab = 'personal_private'"
              >
                {{ t("problemset.types.personalPrivate") }}
              </button>
            </div>
          </div>

          <div v-if="filteredProblemsets.length === 0" class="records-empty">{{ t("problemset.list.empty") }}</div>
          <article v-else v-for="item in filteredProblemsets" :key="item.id" class="record-item">
            <div class="record-head">
              <button class="record-title" type="button" @click="router.push(`/problemset/${item.id}`)">
                {{ item.title }}
              </button>
              <span class="record-mode">{{ problemsetTypeLabel(item.problemsetType) }}</span>
              <strong class="record-score">{{ item.questionCount }} {{ t("common.questions") }}</strong>
              <span class="record-date">ID {{ item.id }}</span>
            </div>
          </article>
        </UiCard>

        <UiCard v-if="!loading && topTab === 'records' && !canViewRecords" class="card records-empty-state">
          <div class="empty-icon"><i class="fa-solid fa-user-secret"></i></div>
          <p class="empty-main">{{ t("profile.recordsHidden") }}</p>
        </UiCard>
      </div>

      <aside v-if="profile" class="right-col">
        <UiCard class="profile-card" flush>
          <div class="cover" :style="coverStyle"></div>
          <div class="profile-body">
            <img :src="profile.avatarUrl" alt="avatar" />
            <div class="meta">
              <p class="name">{{ profile.username }}</p>
              <p class="uid">@{{ profile.uid }}</p>
              <p v-if="showBannedNotice" class="banned-note">{{ t("profile.banned") }}</p>
            </div>
          </div>
        </UiCard>

        <UiCard class="profile-card profile-bio-card">
          <div class="profile-bio-header">
            <i class="fa-solid fa-signature"></i>
            <span>{{ t("profile.bio") }}</span>
          </div>
          <div v-if="!String(profile.bio ?? '').trim()" class="profile-bio-empty">{{ t("profile.bioEmpty") }}</div>
          <div v-else class="bio-content luogu-markdown" v-html="bioHtml"></div>
        </UiCard>
      </aside>
    </div>
  </TiLayout>
</template>
