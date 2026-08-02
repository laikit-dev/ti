<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import TiLayout from "../layouts/TiLayout.vue";
import { getMySettings, loadLocalUser } from "../api/auth";
import { readHighlighterEnabled, readSubmissionAnalysisMode } from "../utils/devicePreferences";
import { problemsetApi, type ProblemQuestion, type ProblemsetDetail } from "../api/problemset";
import {
  fetchActiveExam,
  fetchProblemsetSubmissions,
  fetchSubmissionDetail,
  type SubmissionDetail,
  type SubmissionRecord
} from "../api/submission";
import { renderLuoguMarkdown } from "../utils/luoguMarkdown";
import { formatDate, normalizeOptionAnswer, isMultipleQuestion as isMulti } from "../utils/shared";
import AiAssistPanel from "../components/AiAssistPanel.vue";
import NotFoundMessage from "../components/NotFoundMessage.vue";
import HighlightToolbar from "../components/HighlightToolbar.vue";
import { useTextHighlighter } from "../composables/useTextHighlighter";

type DetailTab = "description" | "question" | "history";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const currentUser = loadLocalUser();

const loading = ref(true);
const detailError = ref("");
const detail = ref<ProblemsetDetail | null>(null);
const activeTab = ref<DetailTab>("description");
const selectedQuestionIndex = ref(0);
const answerVisible = ref(false);

const submissionsLoading = ref(false);
const submissions = ref<SubmissionRecord[]>([]);
const selectedSubmission = ref<SubmissionDetail | null>(null);
const activeExam = ref<SubmissionRecord | null>(null);
const historyCollapsed = ref(false);
const showExamConflictModal = ref(false);
const submissionAnalysisMode = ref<"none" | "wrong_only" | "all">(readSubmissionAnalysisMode());
const historyAnalysisVisible = ref<Record<string, boolean>>({});
const highlighterEnabled = ref(readHighlighterEnabled());

const questionBodyCardEl = ref<HTMLElement | null>(null);
const historyBodyCardEl = ref<HTMLElement | null>(null);
const {
  toolbarState,
  bindContainer,
  unbindContainer,
  applyHighlight,
  clearHighlight,
  dismissToolbar
} = useTextHighlighter();

onUnmounted(() => {
  unbindContainer();
});

const problemsetId = computed(() => {
  const parsed = Number(route.params.id);
  return Number.isFinite(parsed) ? parsed : 1001;
});

const pageTitle = computed(() => {
  if (!detail.value) return t("problemset.detail.pageTitleFallback", { id: problemsetId.value });
  return `${detail.value.summary.id} - ${detail.value.summary.title}`;
});

const canEdit = computed(() => {
  if (!detail.value || !currentUser?.uid) return false;
  if (currentUser.isAdmin) return true;
  return String(detail.value.summary.createdByUid ?? "") === String(currentUser.uid);
});

const guestPlayable = computed(() => {
  const type = String(detail.value?.summary.problemsetType ?? "");
  return type === "official_public" || type === "personal_featured";
});

const hasHistory = computed(() => submissions.value.length > 0);

const currentQuestion = computed<ProblemQuestion | null>(() => {
  if (!detail.value) return null;
  return detail.value.questions[selectedQuestionIndex.value] ?? null;
});

const questionMaterialHtml = computed(() => renderLuoguMarkdown(currentQuestion.value?.sharedMaterial ?? ""));

const selectedSubmissionSummary = computed(() => {
  if (!selectedSubmission.value) return null;
  return submissions.value.find((item) => item.id === selectedSubmission.value?.id) ?? null;
});

const submissionResultMap = computed(() => {
  const map: Record<string, { correct: boolean; earned: number; standardAnswer: string; userAnswer: string }> = {};
  if (!selectedSubmission.value?.results) return map;
  for (const item of selectedSubmission.value.results) {
    map[String(item.questionId)] = {
      correct: Boolean(item.correct),
      earned: Number(item.earned ?? 0),
      standardAnswer: String(item.standardAnswer ?? ""),
      userAnswer: String(item.userAnswer ?? "")
    };
  }
  return map;
});

const descriptionHtml = computed(() => renderLuoguMarkdown(detail.value?.summary.description ?? ""));
const questionStemHtml = computed(() => renderLuoguMarkdown(currentQuestion.value?.stem ?? ""));
const answerAnalysisHtml = computed(() => renderLuoguMarkdown(currentQuestion.value?.analysis ?? ""));
const renderMd = (source: string) => renderLuoguMarkdown(source);

function isMaterialGroupStart(question: ProblemQuestion, index: number, questionList: ProblemQuestion[]) {
  if (!question.sharedMaterial?.trim() || question.materialGroupIndex === null) return false;
  if (index === 0) return true;
  return questionList[index - 1]?.materialGroupIndex !== question.materialGroupIndex;
}

function questionMaterialTitle(question: ProblemQuestion) {
  return question.groupTitle?.trim() || t("problemset.detail.sharedMaterial");
}

function isMultipleQuestion(question: ProblemQuestion) {
  return isMulti(question.answer);
}

function isHistoryOptionChecked(question: ProblemQuestion, optionKey: string) {
  const result = submissionResultMap.value[String(question.id)];
  if (!result) return false;
  const selected = normalizeOptionAnswer(result.userAnswer).split(",").filter(Boolean);
  return selected.includes(optionKey);
}

function shouldShowHistoryAnalysis(question: ProblemQuestion) {
  return Boolean(historyAnalysisVisible.value[String(question.id)]);
}

function initHistoryAnalysisVisibility() {
  const next: Record<string, boolean> = {};
  for (const question of detail.value?.questions ?? []) {
    const qid = String(question.id);
    if (submissionAnalysisMode.value === "all") {
      next[qid] = true;
      continue;
    }
    if (submissionAnalysisMode.value === "none") {
      next[qid] = false;
      continue;
    }
    const result = submissionResultMap.value[qid];
    next[qid] = result ? !result.correct : false;
  }
  historyAnalysisVisible.value = next;
}

function toggleHistoryAnalysis(question: ProblemQuestion) {
  const qid = String(question.id);
  historyAnalysisVisible.value[qid] = !historyAnalysisVisible.value[qid];
}

function historyQuestionTitleClass(question: ProblemQuestion) {
  const result = submissionResultMap.value[String(question.id)];
  if (!result) return "";
  return result.correct ? "correct" : "wrong";
}

function switchToQuestionTab(index: number) {
  selectedQuestionIndex.value = index;
  activeTab.value = "question";
  answerVisible.value = false;
  historyCollapsed.value = false;
}

function questionButtonClass(question: ProblemQuestion, index: number) {
  if (activeTab.value === "history" && selectedSubmission.value) {
    const result = submissionResultMap.value[String(question.id)];
    if (!result) return "";
    if (result.correct) return "correct";
    if (String(result.userAnswer ?? "").trim()) return "wrong";
    return "";
  }
  return selectedQuestionIndex.value === index ? "active" : "";
}

function jumpQuestion(question: ProblemQuestion, index: number) {
  if (activeTab.value === "history") {
    const element = document.getElementById(`history-question-${question.id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
  switchToQuestionTab(index);
}

async function openSubmission(submissionId: number, switchTab = true, syncQuery = true) {
  if (!Number.isFinite(submissionId)) return;
  const submission = await fetchSubmissionDetail(submissionId);
  if (submission.problemsetId !== problemsetId.value) return;
  selectedSubmission.value = submission;
  initHistoryAnalysisVisibility();
  if (switchTab && hasHistory.value) {
    activeTab.value = "history";
  }
  if (syncQuery && Number(route.query.submission ?? NaN) !== submissionId) {
    await router.replace({
      path: route.path,
      query: { ...route.query, submission: String(submissionId) }
    });
  }
}

async function loadSubmissions() {
  if (!currentUser?.uid) {
    submissions.value = [];
    activeExam.value = null;
    selectedSubmission.value = null;
    return;
  }
  submissionsLoading.value = true;
  try {
    const [response, currentActiveExam] = await Promise.all([
      fetchProblemsetSubmissions(problemsetId.value),
      fetchActiveExam(currentUser.uid)
    ]);
    submissions.value = response.submissions;
    activeExam.value = currentActiveExam ?? response.activeExam;

    if (submissions.value.length === 0) {
      if (activeTab.value === "history") activeTab.value = "description";
      selectedSubmission.value = null;
      if (route.query.submission) {
        const query = { ...route.query };
        delete query.submission;
        await router.replace({ path: route.path, query });
      }
      return;
    }

    const querySubmissionId = Number(route.query.submission ?? NaN);
    const preferredId = Number.isFinite(querySubmissionId)
      ? querySubmissionId
      : (selectedSubmission.value?.id ?? submissions.value[0].id);
    await openSubmission(preferredId, false, false);
  } finally {
    submissionsLoading.value = false;
  }
}

async function loadDetail() {
  loading.value = true;
  detailError.value = "";
  if (currentUser?.uid) {
    try {
      const settings = await getMySettings();
      const mode = String(settings.submissionAnalysisMode ?? "none");
      submissionAnalysisMode.value = mode === "wrong_only" || mode === "all" ? mode : "none";
      highlighterEnabled.value = Boolean(settings.highlighterEnabled ?? true);
    } catch {
      submissionAnalysisMode.value = readSubmissionAnalysisMode();
      highlighterEnabled.value = readHighlighterEnabled();
    }
  } else {
    submissionAnalysisMode.value = readSubmissionAnalysisMode();
    highlighterEnabled.value = readHighlighterEnabled();
  }

  try {
    detail.value = await problemsetApi.detail(problemsetId.value);
  } catch (err) {
    detailError.value = String((err as Error)?.message ?? err);
    loading.value = false;
    return;
  }
  selectedQuestionIndex.value = 0;
  activeTab.value = "description";
  answerVisible.value = false;
  historyCollapsed.value = false;
  await loadSubmissions();

  const querySubmissionId = Number(route.query.submission ?? NaN);
  if (Number.isFinite(querySubmissionId) && hasHistory.value) {
    activeTab.value = "history";
  }
  loading.value = false;
}

async function goExam() {
  if (!currentUser?.uid) {
    if (!guestPlayable.value) {
      await router.push("/auth/login");
      return;
    }
    await router.push(`/problemset/${problemsetId.value}/exam?notice=1`);
    return;
  }
  if (!submissionsLoading.value) {
    await loadSubmissions();
  }
  if (activeExam.value) {
    showExamConflictModal.value = true;
    return;
  }
  await router.push(`/problemset/${problemsetId.value}/exam?notice=1`);
}

async function goTraining() {
  await router.push(`/problemset/${problemsetId.value}/training`);
}

async function forceStartExam() {
  showExamConflictModal.value = false;
  await router.push(`/problemset/${problemsetId.value}/exam?force=1&notice=1`);
}

function closeConflictModal() {
  showExamConflictModal.value = false;
}

onMounted(loadDetail);

watch(() => route.params.id, loadDetail);

watch(
  () => route.query.submission,
  async (submission) => {
    if (!submission || !hasHistory.value) return;
    const submissionId = Number(submission);
    if (!Number.isFinite(submissionId)) return;
    if (selectedSubmission.value?.id === submissionId) return;
    await openSubmission(submissionId, true, false);
  }
);

// Rebind highlighter when switching to question/history tabs
watch([activeTab, selectedQuestionIndex, selectedSubmission], async () => {
  unbindContainer();
  await nextTick();
  if (!highlighterEnabled.value) return;
  const target = activeTab.value === "history" ? historyBodyCardEl.value : questionBodyCardEl.value;
  if (target) {
    bindContainer(target);
  }
});
</script>

<template>
  <TiLayout
    :title="pageTitle"
    :subtitle="t('problemset.detail.subtitle')"
    :use-panel="false"
    :loading="loading"
    :loading-label="t('problemset.detail.loading')"
  >
    <NotFoundMessage v-if="detailError && !loading" i18n-prefix="problemSetNotFound" />
    <div v-else-if="detail && !loading" class="problemset-detail-page page-shell">
      <section class="problemset-detail-summary panel-card">
        <div class="problemset-detail-actions">
          <button class="action-btn action-btn-primary" type="button" @click="goExam">{{ t("problemset.detail.exam") }}</button>
          <button class="action-btn" type="button" @click="goTraining">{{ t("problemset.detail.training") }}</button>
          <button
            v-if="canEdit"
            class="action-btn"
            type="button"
            @click="router.push(`/problemset/${problemsetId}/edit`)"
          >
            {{ t("problemset.detail.edit") }}
          </button>
        </div>
        <div class="problemset-detail-stats">
          <div class="stat-item">
            <span class="stat-label">{{ t("problemset.detail.questionCount") }}</span>
            <strong class="stat-value">{{ detail.summary.questionCount }}</strong>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-label">{{ t("problemset.detail.duration") }}</span>
            <strong class="stat-value">{{ detail.summary.durationHours }} {{ t("common.hours") }}</strong>
          </div>
        </div>
      </section>

      <section class="problemset-detail-grid">
        <div class="left-column">
          <div class="panel-card tabs-card">
            <button class="tab-btn" :class="{ active: activeTab === 'description' }" type="button" @click="activeTab = 'description'">{{ t("problemset.detail.tabs.description") }}</button>
            <button class="tab-btn" :class="{ active: activeTab === 'question' }" type="button" @click="activeTab = 'question'">{{ t("problemset.detail.tabs.question") }}</button>
            <button v-if="hasHistory" class="tab-btn" :class="{ active: activeTab === 'history' }" type="button" @click="activeTab = 'history'">{{ t("problemset.detail.tabs.history") }}</button>
          </div>

          <div v-if="activeTab === 'description'" class="panel-card body-card">
            <div class="luogu-markdown" v-html="descriptionHtml"></div>
          </div>

          <div v-else-if="activeTab === 'question' && currentQuestion" ref="questionBodyCardEl" class="panel-card body-card">
            <div class="question-head">
              <h3 class="question-title">{{ t("problemset.common.questionNumber", { index: currentQuestion.index }) }}</h3>
              <AiAssistPanel
                :question="currentQuestion"
                :question-label="t('problemset.common.questionNumber', { index: currentQuestion.index })"
                mode="hint-and-solution"
              />
            </div>
            <div v-if="currentQuestion.sharedMaterial" class="shared-material-block">
              <div class="shared-material-title">
                {{ questionMaterialTitle(currentQuestion) }}
                <span v-if="currentQuestion.groupQuestionIndex">
                  · {{ currentQuestion.groupQuestionIndex }}
                  <span v-if="currentQuestion.groupQuestionCount"> / {{ currentQuestion.groupQuestionCount }}</span>
                  {{ t("problemset.common.subQuestion") }}
                </span>
              </div>
              <div class="shared-material-content luogu-markdown" v-html="questionMaterialHtml"></div>
            </div>
            <div class="question-stem luogu-markdown" v-html="questionStemHtml"></div>

            <div v-if="currentQuestion.type === 'option'" class="detail-option-list">
              <label v-for="option in currentQuestion.options" :key="option.key" class="detail-option-row">
                <input
                  :type="isMultipleQuestion(currentQuestion) ? 'checkbox' : 'radio'"
                  :name="`preview-${currentQuestion.id}`"
                  disabled
                />
                <span class="detail-option-key">{{ option.key }}.</span>
                <span class="detail-option-text luogu-markdown" v-html="renderMd(option.text)"></span>
              </label>
            </div>

            <div v-else class="input-preview">
              <label>{{ t("problemset.detail.inputPreview") }}</label>
              <input type="text" :placeholder="currentQuestion.inputPlaceholder || t('problemset.common.answerPlaceholder')" disabled />
            </div>

            <p class="question-score">{{ t("problemset.detail.score", { score: currentQuestion.score }) }}</p>
            <button class="answer-btn" type="button" @click="answerVisible = !answerVisible">
              {{ answerVisible ? t("problemset.detail.hideAnswer") : t("problemset.detail.showAnswer") }}
            </button>

            <div v-if="answerVisible" class="answer-block">
              <p class="answer-text">{{ t("problemset.common.answerLabel", { answer: currentQuestion.answer }) }}</p>
              <div class="luogu-markdown" v-html="answerAnalysisHtml"></div>
            </div>
          </div>

          <div v-else-if="activeTab === 'history' && selectedSubmission" ref="historyBodyCardEl" class="panel-card body-card">
            <article
              v-for="(question, index) in detail.questions"
              :id="`history-question-${question.id}`"
              :key="question.id"
              class="history-question"
            >
              <div v-if="isMaterialGroupStart(question, index, detail.questions)" class="shared-material-block">
                <div class="shared-material-title">{{ questionMaterialTitle(question) }}</div>
                <div class="shared-material-content luogu-markdown" v-html="renderMd(question.sharedMaterial)"></div>
              </div>
              <div class="question-head">
                <h3 class="history-question-title" :class="historyQuestionTitleClass(question)">
                  {{ t("problemset.common.questionNumber", { index: question.index }) }}
                  <span v-if="question.groupQuestionIndex">
                    · {{ question.groupQuestionIndex }}
                    <span v-if="question.groupQuestionCount"> / {{ question.groupQuestionCount }}</span>
                    {{ t("problemset.common.subQuestion") }}
                  </span>
                </h3>
                <AiAssistPanel
                  :question="question"
                  :question-label="t('problemset.common.questionNumber', { index: question.index })"
                  mode="hint-and-solution"
                  :history-context="{
                    userAnswer: submissionResultMap[question.id]?.userAnswer,
                    standardAnswer: submissionResultMap[question.id]?.standardAnswer || question.answer,
                    earned: submissionResultMap[question.id]?.earned ?? 0,
                    score: question.score,
                    correct: submissionResultMap[question.id]?.correct ?? false
                  }"
                />
              </div>
              <div class="question-stem luogu-markdown" v-html="renderMd(question.stem)"></div>

              <div v-if="question.type === 'option'" class="detail-option-list">
                <label v-for="option in question.options" :key="option.key" class="detail-option-row">
                  <input
                    :type="isMultipleQuestion(question) ? 'checkbox' : 'radio'"
                    :name="`history-${question.id}`"
                    :checked="isHistoryOptionChecked(question, option.key)"
                    disabled
                  />
                  <span class="detail-option-key">{{ option.key }}.</span>
                  <span class="detail-option-text luogu-markdown" v-html="renderMd(option.text)"></span>
                </label>
              </div>
              <div v-else class="history-input">{{ t("problemset.detail.yourAnswer", { answer: submissionResultMap[question.id]?.userAnswer || t("problemset.detail.emptyAnswer") }) }}</div>

              <div class="history-meta">
                <p class="history-answer">{{ t("problemset.common.answerLabel", { answer: submissionResultMap[question.id]?.standardAnswer || question.answer }) }}</p>
                <p class="history-score">{{ t("problemset.detail.earned", { earned: submissionResultMap[question.id]?.earned ?? 0, score: question.score }) }}</p>
                <button class="answer-btn history-toggle-btn" type="button" @click="toggleHistoryAnalysis(question)">
                  {{ shouldShowHistoryAnalysis(question) ? t("problemset.detail.hideAnalysis") : t("problemset.detail.showAnalysis") }}
                </button>
              </div>
              <div v-if="shouldShowHistoryAnalysis(question)" class="history-analysis luogu-markdown" v-html="renderMd(question.analysis)"></div>
            </article>
          </div>

          <div v-else-if="activeTab === 'history' && !hasHistory" class="panel-card body-card">{{ t("problemset.detail.noHistory") }}</div>
        </div>

        <aside class="right-column">
          <div id="ai-sidebar-panel" class="ai-sidebar-target"></div>
          <div v-if="hasHistory" class="panel-card history-card">
            <div class="history-main-score">{{ selectedSubmission?.score ?? submissions[0]?.score ?? 0 }} {{ t("common.points") }}</div>
            <p class="history-date">{{ t("problemset.detail.submittedAt", { time: formatDate(selectedSubmission?.submittedAt ?? submissions[0]?.submittedAt) }) }}</p>
            <div class="history-header">
              <h3>{{ t("problemset.detail.recentSubmissions") }}</h3>
              <button class="toggle-btn" @click="historyCollapsed = !historyCollapsed">{{ historyCollapsed ? t("problemset.detail.expand") : t("problemset.detail.collapse") }}</button>
            </div>
            <div v-if="!historyCollapsed" class="history-list">
              <button
                v-for="item in submissions"
                :key="item.id"
                class="history-item"
                :class="{ active: item.id === selectedSubmissionSummary?.id }"
                @click="openSubmission(item.id)"
              >
                {{ item.score }} {{ t("common.points") }} - {{ t("problemset.detail.submittedAt", { time: formatDate(item.submittedAt) }) }}
              </button>
            </div>
          </div>

          <RouterLink
            v-if="detail.author.uid"
            class="panel-card author-card"
            :to="`/user/${encodeURIComponent(detail.author.uid)}`"
            :aria-label="t('problemset.detail.viewAuthorProfile', { name: detail.author.username || detail.author.uid })"
          >
            <img
              v-if="detail.author.avatarUrl"
              class="author-avatar"
              :src="detail.author.avatarUrl"
              :alt="detail.author.username || detail.author.uid"
            />
            <span v-else class="author-avatar author-avatar-fallback" aria-hidden="true">
              <i class="fa-solid fa-user"></i>
            </span>
            <strong class="author-name">{{ detail.author.username || detail.author.uid }}</strong>
            <i class="fa-solid fa-chevron-right author-link-icon" aria-hidden="true"></i>
          </RouterLink>
          <div v-else class="panel-card author-card author-card-static">
            <span class="author-avatar author-avatar-fallback" aria-hidden="true">
              <i class="fa-solid fa-user-shield"></i>
            </span>
            <strong class="author-name">{{ t("problemset.detail.systemAuthor") }}</strong>
          </div>

          <div class="panel-card list-card">
            <h3 class="list-title">{{ t("problemset.detail.questionList") }}</h3>
            <div class="question-list">
              <button
                v-for="(question, index) in detail.questions"
                :key="question.id"
                class="question-btn"
                :class="questionButtonClass(question, index)"
                type="button"
                @click="jumpQuestion(question, index)"
              >
                {{ t("problemset.common.questionNumber", { index: question.index }) }}
              </button>
            </div>
          </div>
        </aside>
      </section>
    </div>

    <div v-if="showExamConflictModal" class="detail-modal-mask" @click.self="closeConflictModal">
      <div class="detail-modal-card">
        <button class="detail-modal-close" @click="closeConflictModal">×</button>
        <p>
          {{ t("problemset.detail.conflictMessage", { id: activeExam?.problemsetId, title: activeExam?.problemsetTitle }) }}
        </p>
        <div class="detail-modal-actions">
          <button class="danger" @click="forceStartExam">{{ t("problemset.detail.forceStart") }}</button>
          <button @click="closeConflictModal">{{ t("common.cancel") }}</button>
        </div>
      </div>
    </div>
    <HighlightToolbar
      :x="toolbarState.x"
      :y="toolbarState.y"
      :visible="toolbarState.visible"
      @highlight="applyHighlight"
      @clear="clearHighlight"
      @close="dismissToolbar"
    />
  </TiLayout>
</template>
