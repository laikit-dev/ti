<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import TiLayout from "../layouts/TiLayout.vue";
import { getMySettings, loadLocalUser, type AutosaveIntervalSeconds } from "../api/auth";
import { readHighlighterEnabled } from "../utils/devicePreferences";
import { problemsetApi, type ProblemQuestion, type ProblemsetDetail } from "../api/problemset";
import {
  ActiveExamConflictError,
  autosaveSubmission,
  pauseExamSubmission,
  resumeSubmission,
  startExamSubmission,
  startTrainingSubmission,
  submitExamSubmission,
  submitTrainingSubmission,
  type SubmissionDetail
} from "../api/submission";
import { renderLuoguMarkdown } from "../utils/luoguMarkdown";
import { normalizeOptionAnswer, isMultipleQuestion as isMulti } from "../utils/shared";
import { askConfirm, notifyError, notifySuccess } from "../composables/feedback";
import AiAssistPanel from "../components/AiAssistPanel.vue";
import HighlightToolbar from "../components/HighlightToolbar.vue";
import { useTextHighlighter } from "../composables/useTextHighlighter";

interface QuestionResult {
  correct: boolean;
  earned: number;
  standardAnswer: string;
}

interface LocalModeDraft {
  version: 1;
  mode: "exam" | "training";
  problemsetId: number;
  userKey: string;
  submissionId: number | null;
  answers: Record<string, string>;
  remainingSeconds: number;
  updatedAt: string;
}

const DEFAULT_AUTOSAVE_INTERVAL_SECONDS: AutosaveIntervalSeconds = 30;

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const currentUser = loadLocalUser();

const loading = ref(true);
const error = ref("");
const detail = ref<ProblemsetDetail | null>(null);
const submissionId = ref<number | null>(null);
const submitted = ref(false);
const submissionScore = ref(0);
const maxScore = ref(0);
const remainingSeconds = ref(0);
const autosaving = ref(false);
const showingNotice = ref(false);
const noticeTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const showGuestLoginModal = ref(false);
const autosaveIntervalSeconds = ref<AutosaveIntervalSeconds>(DEFAULT_AUTOSAVE_INTERVAL_SECONDS);
const skipLeaveConfirmOnce = ref(false);
const highlighterEnabled = ref(readHighlighterEnabled());

const answers = reactive<Record<string, string>>({});
const results = reactive<Record<string, QuestionResult>>({});

let countdownTimer: ReturnType<typeof setInterval> | null = null;
let autosaveTimer: ReturnType<typeof setInterval> | null = null;
let navigatingByUserAction = false;

const modeLeftEl = ref<HTMLElement | null>(null);
const {
  toolbarState,
  bindContainer,
  unbindContainer,
  applyHighlight,
  clearHighlight,
  dismissToolbar
} = useTextHighlighter();

const problemsetId = computed(() => {
  const parsed = Number(route.params.id);
  return Number.isFinite(parsed) ? parsed : 1001;
});

const isExam = computed(() => route.path.endsWith("/exam"));
const modeKey = computed<"exam" | "training">(() => (isExam.value ? "exam" : "training"));
const userStorageKey = computed(() => (currentUser?.uid ? `uid:${currentUser.uid}` : "guest"));
const localDraftStorageKey = computed(
  () => `ti.mode.autosave.v1.${userStorageKey.value}.${modeKey.value}.${problemsetId.value}`
);
const shouldConfirmLeave = computed(
  () => !loading.value && !error.value && !!detail.value && !submitted.value && !skipLeaveConfirmOnce.value
);
const modeTitle = computed(() => (isExam.value ? t("problemset.mode.exam") : t("problemset.mode.training")));
const pageTitle = computed(() => {
  const summary = detail.value?.summary;
  return summary ? `${summary.id} - ${summary.title}` : `${problemsetId.value} - ${modeTitle.value}`;
});
const subtitle = computed(() => `${t("problemset.list.subtitle")} / ${modeTitle.value}`);
const isGuest = computed(() => !currentUser?.uid);
const guestPlayable = computed(() => {
  const type = String(detail.value?.summary.problemsetType ?? "");
  return type === "official_public" || type === "personal_featured";
});

const questions = computed(() => detail.value?.questions ?? []);
const totalScore = computed(() => questions.value.reduce((sum, item) => sum + Number(item.score), 0));

interface SidebarQuestionGroup {
  key: string;
  title: string;
  questions: ProblemQuestion[];
  materialGroupIndex: number | null;
  isMaterialGroup: boolean;
}

const sidebarQuestionGroups = computed<SidebarQuestionGroup[]>(() => {
  const groups: SidebarQuestionGroup[] = [];
  const materialGroupMap = new Map<number, SidebarQuestionGroup>();

  for (const question of questions.value) {
    const hasMaterial = Boolean(question.sharedMaterial?.trim()) && question.materialGroupIndex !== null;
    if (!hasMaterial || question.materialGroupIndex === null) {
      groups.push({
        key: `single-${question.id}`,
        title: t("problemset.common.questionNumber", { index: question.index }),
        questions: [question],
        materialGroupIndex: null,
        isMaterialGroup: false
      });
      continue;
    }

    const existing = materialGroupMap.get(question.materialGroupIndex);
    if (existing) {
      existing.questions.push(question);
      continue;
    }

    const group: SidebarQuestionGroup = {
      key: `material-${question.materialGroupIndex}`,
      title: question.groupTitle?.trim() || t("problemset.common.materialGroupWithIndex", { index: question.materialGroupIndex }),
      questions: [question],
      materialGroupIndex: question.materialGroupIndex,
      isMaterialGroup: true
    };
    materialGroupMap.set(question.materialGroupIndex, group);
    groups.push(group);
  }

  return groups;
});

const answeredCount = computed(() =>
  questions.value.filter((question) => String(answers[question.id] ?? "").trim().length > 0).length
);

const correctCount = computed(() =>
  questions.value.filter((question) => results[question.id]?.correct === true).length
);

function resetIntervals() {
  if (countdownTimer) clearInterval(countdownTimer);
  if (autosaveTimer) clearInterval(autosaveTimer);
  countdownTimer = null;
  autosaveTimer = null;
  autosaving.value = false;
}

function clearNoticeTimer() {
  if (noticeTimer.value) clearTimeout(noticeTimer.value);
  noticeTimer.value = null;
}

function normalizeAutosaveInterval(value: unknown): AutosaveIntervalSeconds {
  const parsed = Number(value);
  if (parsed === 0 || parsed === 30 || parsed === 60 || parsed === 120 || parsed === 300 || parsed === 600) {
    return parsed;
  }
  return DEFAULT_AUTOSAVE_INTERVAL_SECONDS;
}

function getAutosaveIntervalMs() {
  return autosaveIntervalSeconds.value > 0 ? autosaveIntervalSeconds.value * 1000 : 0;
}

async function loadAutosaveIntervalSetting() {
  if (!currentUser?.uid) {
    autosaveIntervalSeconds.value = DEFAULT_AUTOSAVE_INTERVAL_SECONDS;
    highlighterEnabled.value = readHighlighterEnabled();
    return;
  }
  try {
    const settings = await getMySettings();
    autosaveIntervalSeconds.value = normalizeAutosaveInterval(settings.autosaveIntervalSeconds);
    highlighterEnabled.value = Boolean(settings.highlighterEnabled ?? true);
  } catch {
    autosaveIntervalSeconds.value = DEFAULT_AUTOSAVE_INTERVAL_SECONDS;
    highlighterEnabled.value = readHighlighterEnabled();
  }
}

function clearLocalDraft() {
  localStorage.removeItem(localDraftStorageKey.value);
}

function buildLocalDraft(): LocalModeDraft {
  const snapshot: Record<string, string> = {};
  for (const question of questions.value) {
    snapshot[question.id] = String(answers[question.id] ?? "");
  }
  return {
    version: 1,
    mode: modeKey.value,
    problemsetId: problemsetId.value,
    userKey: userStorageKey.value,
    submissionId: submissionId.value,
    answers: snapshot,
    remainingSeconds: Number(remainingSeconds.value ?? 0),
    updatedAt: new Date().toISOString()
  };
}

function persistLocalDraft(force = false) {
  if (submitted.value || !detail.value) return;
  if (!force && getAutosaveIntervalMs() <= 0) return;
  try {
    localStorage.setItem(localDraftStorageKey.value, JSON.stringify(buildLocalDraft()));
  } catch {
    // ignore localStorage quota/transient errors
  }
}

function restoreFromLocalDraft() {
  if (!detail.value || submitted.value) return false;
  const raw = localStorage.getItem(localDraftStorageKey.value);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw) as Partial<LocalModeDraft>;
    if (parsed.version !== 1) return false;
    if (parsed.mode !== modeKey.value) return false;
    if (Number(parsed.problemsetId) !== problemsetId.value) return false;
    if (String(parsed.userKey ?? "") !== userStorageKey.value) return false;
    // Only reject draft when we have a matching submission resume in progress
    // (submissionId will match if resumeSubmission succeeded above).
    // If submissionIds differ (e.g. resume failed, fresh exam created), still
    // restore draft answers — they are the best data available on refresh.

    const restoredAnswers: Record<string, string> = {};
    for (const question of questions.value) {
      const draftAnswer = parsed.answers?.[question.id];
      restoredAnswers[question.id] = draftAnswer === undefined ? String(answers[question.id] ?? "") : String(draftAnswer);
    }
    hydrateAnswers(restoredAnswers);

    const draftRemaining = Number(parsed.remainingSeconds ?? NaN);
    if (isExam.value && Number.isFinite(draftRemaining) && draftRemaining > 0) {
      if (currentUser?.uid) {
        remainingSeconds.value = Math.min(remainingSeconds.value, Math.floor(draftRemaining));
      } else {
        remainingSeconds.value = Math.floor(draftRemaining);
      }
    }
    return true;
  } catch {
    return false;
  }
}

function allowNextLeaveWithoutConfirm() {
  skipLeaveConfirmOnce.value = true;
}

async function confirmLeaveIfNeeded() {
  if (!shouldConfirmLeave.value) return true;
  const confirmed = await askConfirm({
    title: t("unsaved.answerTitle"),
    message: t("unsaved.answerMessage"),
    confirmText: t("unsaved.leave"),
    cancelText: t("unsaved.continueAnswering"),
    danger: true
  });
  if (confirmed) {
    persistLocalDraft(true);
  }
  return confirmed;
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!shouldConfirmLeave.value || navigatingByUserAction) return;
  persistLocalDraft(true);
  event.preventDefault();
  event.returnValue = "";
}

function isMultipleQuestion(question: ProblemQuestion) {
  return isMulti(question.answer);
}

function hydrateAnswers(next: Record<string, string>) {
  for (const key of Object.keys(answers)) delete answers[key];
  for (const question of questions.value) {
    answers[question.id] = String(next[question.id] ?? "");
  }
}

function hydrateResults(submission: SubmissionDetail | null) {
  for (const key of Object.keys(results)) delete results[key];
  if (!submission?.results) return;
  for (const item of submission.results) {
    results[String(item.questionId)] = {
      correct: Boolean(item.correct),
      earned: Number(item.earned ?? 0),
      standardAnswer: String(item.standardAnswer ?? "")
    };
  }
}

function startCountdown() {
  if (!isExam.value || submitted.value) return;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    remainingSeconds.value = Math.max(0, remainingSeconds.value - 1);
    if (remainingSeconds.value === 0) {
      submitExam("timeout");
    }
  }, 1000);
}

function startAutosave() {
  if (submitted.value) return;
  const intervalMs = getAutosaveIntervalMs();
  if (intervalMs <= 0) return;
  if (autosaveTimer) clearInterval(autosaveTimer);
  autosaveTimer = setInterval(async () => {
    if (submitted.value) return;
    persistLocalDraft();
    // Autosave to server for both exam and training (logged-in users only)
    if (!submissionId.value || !currentUser?.uid) return;
    autosaving.value = true;
    try {
      await autosaveSubmission(submissionId.value, {
        answers: { ...answers },
        remainingSeconds: remainingSeconds.value
      });
    } catch {
      // ignore transient autosave errors
    } finally {
      autosaving.value = false;
    }
  }, intervalMs);
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hour = String(Math.floor(safe / 3600)).padStart(2, "0");
  const minute = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const second = String(safe % 60).padStart(2, "0");
  return `${hour}:${minute}:${second}`;
}

function showExamNoticeIfNeeded() {
  const shouldShow = String(route.query.notice ?? "").trim() === "1";
  if (!shouldShow) return;
  showingNotice.value = true;
  clearNoticeTimer();
  noticeTimer.value = setTimeout(() => {
    showingNotice.value = false;
  }, 5000);
}

function scrollToQuestion(questionId: string) {
  const element = document.getElementById(`question-${questionId}`);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderMd(text: string) {
  return renderLuoguMarkdown(text);
}

function questionMaterialTitle(question: ProblemQuestion) {
  return question.groupTitle?.trim() || t("problemset.detail.sharedMaterial");
}

function isOptionChecked(question: ProblemQuestion, key: string) {
  const current = normalizeOptionAnswer(answers[question.id] ?? "").split(",").filter(Boolean);
  return current.includes(key);
}

function toggleOption(question: ProblemQuestion, key: string) {
  if (submitted.value) return;
  const current = normalizeOptionAnswer(answers[question.id] ?? "").split(",").filter(Boolean);
  if (isMultipleQuestion(question)) {
    const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
    answers[question.id] = next.sort().join(",");
    return;
  }
  answers[question.id] = current.includes(key) ? "" : key;
}

function setInputAnswer(question: ProblemQuestion, value: string) {
  if (submitted.value) return;
  answers[question.id] = value;
}

function questionButtonClass(question: ProblemQuestion) {
  if (results[question.id]) {
    return results[question.id].correct ? "correct" : "wrong";
  }
  return String(answers[question.id] ?? "").trim() ? "answered" : "";
}

function calculateLocalSubmission() {
  const localResults: Record<string, QuestionResult> = {};
  let score = 0;
  let max = 0;

  for (const question of questions.value) {
    const qid = String(question.id);
    const standardAnswer = String(question.answer ?? "").trim();
    const userAnswer = String(answers[qid] ?? "").trim();
    const weight = Number(question.score ?? 0);
    max += weight;

    const correct = question.type === "option"
      ? normalizeOptionAnswer(userAnswer) === normalizeOptionAnswer(standardAnswer)
      : userAnswer === standardAnswer;
    const earned = correct ? weight : 0;
    score += earned;

    localResults[qid] = {
      correct,
      earned: Number(earned.toFixed(2)),
      standardAnswer
    };
  }

  for (const key of Object.keys(results)) delete results[key];
  for (const [key, value] of Object.entries(localResults)) {
    results[key] = value;
  }

  submissionScore.value = Number(score.toFixed(2));
  maxScore.value = Number(max.toFixed(2));
  submitted.value = true;
  resetIntervals();
  clearLocalDraft();
}

function readLocalDraftSubmissionId(): number | null {
  try {
    const raw = localStorage.getItem(localDraftStorageKey.value);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalModeDraft>;
    if (parsed.version !== 1) return null;
    if (parsed.mode !== modeKey.value) return null;
    if (Number(parsed.problemsetId) !== problemsetId.value) return null;
    if (String(parsed.userKey ?? "") !== userStorageKey.value) return null;
    const id = Number(parsed.submissionId);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

async function bootstrapExamMode() {
  const resumeId = Number(route.query.resume ?? NaN);
  const forceNew = String(route.query.force ?? "").trim() === "1";
  let submission: SubmissionDetail;

  if (Number.isFinite(resumeId) && resumeId > 0) {
    submission = await resumeSubmission(resumeId);
  } else {
    // On page refresh (no resume query), try to recover the active
    // submission from the local draft so answers are not lost.
    const draftSubmissionId = readLocalDraftSubmissionId();
    if (draftSubmissionId && !forceNew) {
      try {
        submission = await resumeSubmission(draftSubmissionId);
      } catch {
        // Resume failed (e.g. submission already submitted/replaced);
        // fall through to start a new exam.
        submission = await startExamSubmission(problemsetId.value, forceNew);
      }
    } else {
      submission = await startExamSubmission(problemsetId.value, forceNew);
    }
  }

  submissionId.value = submission.id;
  remainingSeconds.value = Number(submission.remainingSeconds ?? 0);
  maxScore.value = Number(submission.maxScore ?? totalScore.value);
  submissionScore.value = Number(submission.score ?? 0);
  submitted.value = submission.status === "submitted";
  hydrateAnswers(submission.answers ?? {});
  hydrateResults(submission);
}

async function bootstrapTrainingMode() {
  // For logged-in users, create an in_progress submission for server-side autosave.
  // Guests just initialize locally.
  if (currentUser?.uid) {
    const resumeId = Number(route.query.resume ?? NaN);
    const forceNew = String(route.query.force ?? "").trim() === "1";

    if (Number.isFinite(resumeId) && resumeId > 0) {
      const submission = await resumeSubmission(resumeId);
      submissionId.value = submission.id;
      maxScore.value = Number(submission.maxScore ?? totalScore.value);
      submissionScore.value = Number(submission.score ?? 0);
      submitted.value = submission.status === "submitted";
      hydrateAnswers(submission.answers ?? {});
      hydrateResults(submission);
      return;
    }

    // On refresh, try to resume from local draft's submissionId
    if (!forceNew) {
      const draftSubmissionId = readLocalDraftSubmissionId();
      if (draftSubmissionId) {
        try {
          const submission = await resumeSubmission(draftSubmissionId);
          submissionId.value = submission.id;
          maxScore.value = Number(submission.maxScore ?? totalScore.value);
          submissionScore.value = Number(submission.score ?? 0);
          submitted.value = submission.status === "submitted";
          hydrateAnswers(submission.answers ?? {});
          hydrateResults(submission);
          return;
        } catch {
          // Resume failed; fall through to start new training session.
        }
      }
    }

    try {
      const submission = await startTrainingSubmission(problemsetId.value);
      submissionId.value = submission.id;
      maxScore.value = Number(submission.maxScore ?? totalScore.value);
      submissionScore.value = Number(submission.score ?? 0);
      submitted.value = submission.status === "submitted";
      hydrateAnswers(submission.answers ?? {});
      hydrateResults(submission);
      return;
    } catch {
      // Start failed (e.g. network error); fall through to local-only mode.
    }
  }

  // Guest or server-start-failed: local-only training
  submissionId.value = null;
  submitted.value = false;
  maxScore.value = totalScore.value;
  submissionScore.value = 0;
  remainingSeconds.value = 0;
  for (const key of Object.keys(results)) delete results[key];
  for (const question of questions.value) {
    answers[question.id] = "";
  }
}

async function loadPage() {
  loading.value = true;
  error.value = "";
  resetIntervals();
  try {
    await loadAutosaveIntervalSetting();
    detail.value = await problemsetApi.detail(problemsetId.value);
    if (isGuest.value && !guestPlayable.value) {
      error.value = t("common.loginFirst");
      return;
    }
    for (const question of questions.value) {
      answers[question.id] = "";
    }

    if (isExam.value) {
      if (isGuest.value) {
        await bootstrapTrainingMode();
        remainingSeconds.value = Math.max(60, Math.floor(Number(detail.value?.summary.durationHours ?? 2) * 3600));
      } else {
        await bootstrapExamMode();
      }
    } else {
      await bootstrapTrainingMode();
    }

    const restored = restoreFromLocalDraft();
    if (restored) {
      notifySuccess(t("problemset.mode.restoredDraft"));
    }
    if (isExam.value && !submitted.value) {
      startCountdown();
      showExamNoticeIfNeeded();
    }
    if (!submitted.value) {
      startAutosave();
    }

    if (isGuest.value && guestPlayable.value) {
      showGuestLoginModal.value = true;
    }
  } catch (err) {
    if (err instanceof ActiveExamConflictError) {
      const activeId = err.activeExam?.id;
      if (activeId) {
        allowNextLeaveWithoutConfirm();
        navigatingByUserAction = true;
        try {
          await router.replace(`/problemset/${problemsetId.value}?activeExam=${activeId}`);
        } finally {
          navigatingByUserAction = false;
        }
      }
      error.value = t("problemset.mode.activeExamConflict");
    } else {
      error.value = String((err as Error)?.message ?? err);
    }
  } finally {
    loading.value = false;
  }
}

async function pauseExam() {
  if (!submissionId.value || submitted.value || !currentUser?.uid) return;
  try {
    await pauseExamSubmission(submissionId.value, {
      answers: { ...answers },
      remainingSeconds: remainingSeconds.value
    });
    resetIntervals();
    clearLocalDraft();
    allowNextLeaveWithoutConfirm();
    navigatingByUserAction = true;
    try {
      await router.push(`/user/${currentUser.uid}`);
    } finally {
      navigatingByUserAction = false;
    }
  } catch (err) {
    navigatingByUserAction = false;
    skipLeaveConfirmOnce.value = false;
    error.value = String((err as Error)?.message ?? err);
    notifyError(error.value);
  }
}

async function submitExam(reason: "manual" | "timeout") {
  if (submitted.value) return;
  if (reason === "manual") {
    const confirmed = await askConfirm({
      title: t("problemset.mode.submitTitle"),
      message: t("problemset.mode.submitMessage"),
      confirmText: t("problemset.mode.submitConfirm"),
      cancelText: t("problemset.mode.submitCancel"),
      danger: true
    });
    if (!confirmed) return;
  }
  if (isGuest.value) {
    calculateLocalSubmission();
    notifySuccess(t("problemset.mode.localExamScored"));
    return;
  }

  if (!submissionId.value) return;

  try {
    const submission = await submitExamSubmission(submissionId.value, {
      answers: { ...answers },
      remainingSeconds: remainingSeconds.value
    });
    submitted.value = true;
    submissionScore.value = Number(submission.score ?? 0);
    maxScore.value = Number(submission.maxScore ?? totalScore.value);
    hydrateAnswers(submission.answers ?? {});
    hydrateResults(submission);
    resetIntervals();
    clearLocalDraft();
    notifySuccess(t("problemset.mode.examSubmitted"));
    await router.replace(`/problemset/${problemsetId.value}?submission=${submission.id}`);
  } catch (err) {
    error.value = String((err as Error)?.message ?? err);
    notifyError(error.value);
  }
}

async function saveTrainingRecord() {
  if (submitted.value) return;
  if (isGuest.value) {
    calculateLocalSubmission();
    notifySuccess(t("problemset.mode.localTrainingScored"));
    return;
  }
  try {
    const submission = await submitTrainingSubmission(problemsetId.value, {
      answers: { ...answers },
      submissionId: submissionId.value ?? undefined
    });
    submitted.value = true;
    submissionId.value = submission.id;
    submissionScore.value = Number(submission.score ?? 0);
    maxScore.value = Number(submission.maxScore ?? totalScore.value);
    hydrateResults(submission);
    clearLocalDraft();
    notifySuccess(t("problemset.mode.trainingSaved"));
    await router.replace(`/problemset/${problemsetId.value}?submission=${submission.id}`);
  } catch (err) {
    error.value = String((err as Error)?.message ?? err);
    notifyError(error.value);
  }
}

onBeforeRouteLeave(async () => {
  if (skipLeaveConfirmOnce.value) {
    skipLeaveConfirmOnce.value = false;
    return true;
  }
  return confirmLeaveIfNeeded();
});

onBeforeRouteUpdate(async () => {
  if (skipLeaveConfirmOnce.value) {
    skipLeaveConfirmOnce.value = false;
    return true;
  }
  return confirmLeaveIfNeeded();
});

onMounted(() => {
  window.addEventListener("beforeunload", handleBeforeUnload);
  loadPage();
});
watch(() => [route.params.id, route.path, route.query.resume, route.query.force], loadPage);
watch(loading, async (isLoading) => {
  if (isLoading) return;
  // Wait for Vue to flush DOM updates after loading finishes
  await nextTick();
  if (highlighterEnabled.value && modeLeftEl.value) {
    bindContainer(modeLeftEl.value);
  }
});
onUnmounted(() => {
  persistLocalDraft(true);
  window.removeEventListener("beforeunload", handleBeforeUnload);
  resetIntervals();
  clearNoticeTimer();
  unbindContainer();
});

function closeGuestLoginModal() {
  showGuestLoginModal.value = false;
}
</script>

<template>
  <TiLayout
    :title="pageTitle"
    :subtitle="subtitle"
    :use-panel="false"
    :loading="loading"
    :loading-label="t('problemset.mode.loading')"
  >
    <div class="problemset-mode-page page-shell">
      <div v-if="showGuestLoginModal" class="guest-login-modal-mask" @click.self="closeGuestLoginModal">
        <div class="guest-login-modal-card">
          <button class="guest-login-close" type="button" @click="closeGuestLoginModal">×</button>
          <h3>{{ t("problemset.mode.guestTitle") }}</h3>
          <p>{{ t("problemset.mode.guestMessage") }}</p>
          <div class="guest-login-actions">
            <button class="btn" type="button" @click="closeGuestLoginModal">{{ t("unsaved.continueAnswering") }}</button>
            <button class="btn primary" type="button" @click="router.push('/auth/login')">{{ t("common.goLogin") }}</button>
          </div>
        </div>
      </div>

      <div v-if="showingNotice" class="exam-notice">
        <p>{{ t("problemset.mode.noticePrefix") }}<a href="/user/_me/settings" target="_blank">{{ t("problemset.mode.noticeLink") }}</a>{{ t("problemset.mode.noticeSuffix") }}</p>
      </div>

      <div v-if="!loading && error" class="panel-card error-card">{{ error }}</div>
      <template v-else-if="!loading && detail">
        <section class="mode-layout">
          <div ref="modeLeftEl" class="mode-left">
            <article
              v-for="question in detail.questions"
              :id="`question-${question.id}`"
              :key="question.id"
              class="panel-card question-card"
            >
              <div class="question-head">
                <h3>{{ t("problemset.common.questionNumber", { index: question.index }) }}</h3>
                <AiAssistPanel
                  :question="question"
                  :question-label="t('problemset.common.questionNumber', { index: question.index })"
                  mode="hint-only"
                />
              </div>
              <p v-if="question.groupQuestionIndex" class="sub-question-label">
                {{ t("problemset.common.materialQuestionIndex", { index: question.groupQuestionIndex }) }}
                <span v-if="question.groupQuestionCount"> / {{ question.groupQuestionCount }}</span>
                {{ t("problemset.common.subQuestion") }}
              </p>
              <details v-if="question.sharedMaterial?.trim()" class="shared-material-panel" open>
                <summary class="shared-material-summary">
                  <span class="shared-material-arrow" aria-hidden="true"></span>
                  <span class="shared-material-title">{{ questionMaterialTitle(question) }}</span>
                </summary>
                <div class="shared-material-block">
                  <div class="shared-material-content luogu-markdown" v-html="renderMd(question.sharedMaterial)"></div>
                </div>
              </details>
              <div class="question-stem luogu-markdown" v-html="renderMd(question.stem)"></div>

              <div v-if="question.type === 'option'" class="mode-option-list">
                <label v-for="option in question.options" :key="option.key" class="mode-option-row">
                  <input
                    :type="isMultipleQuestion(question) ? 'checkbox' : 'radio'"
                    :name="`q-${question.id}`"
                    :checked="isOptionChecked(question, option.key)"
                    :disabled="submitted"
                    @change="toggleOption(question, option.key)"
                  />
                  <span class="mode-option-key">{{ option.key }}.</span>
                  <span class="mode-option-text luogu-markdown" v-html="renderMd(option.text)"></span>
                </label>
              </div>

              <div v-else class="input-wrap">
                <input
                  type="text"
                  :value="answers[question.id]"
                  :placeholder="question.inputPlaceholder || t('problemset.common.answerPlaceholder')"
                  :disabled="submitted"
                  @input="setInputAnswer(question, ($event.target as HTMLInputElement).value)"
                />
              </div>

              <p class="question-score">{{ t("problemset.detail.score", { score: question.score }) }}</p>
              <div v-if="submitted && results[question.id]" class="result">
                <p :class="results[question.id].correct ? 'ok' : 'ng'">
                  {{ results[question.id].correct ? t("problemset.mode.correct") : t("problemset.mode.wrong") }}
                </p>
                <p>{{ t("problemset.common.answerLabel", { answer: results[question.id].standardAnswer }) }}</p>
                <p>{{ t("problemset.detail.earned", { earned: results[question.id].earned, score: question.score }) }}</p>
                <div class="luogu-markdown" v-html="renderMd(question.analysis)"></div>
              </div>
            </article>
          </div>

          <aside class="panel-card mode-right">
            <div id="ai-sidebar-panel" class="ai-sidebar-target"></div>
            <div v-if="isExam" class="mode-timer-card" :class="{ danger: remainingSeconds <= 300 }">
              <span class="mode-timer-label">{{ t("problemset.mode.remainingTime") }}</span>
              <strong class="mode-timer-value">{{ formatDuration(remainingSeconds) }}</strong>
            </div>

            <div class="mode-summary-cards">
              <div class="mode-summary-card">
                <span class="mode-summary-label">{{ t("problemset.mode.answered") }}</span>
                <strong>{{ answeredCount }} / {{ detail.summary.questionCount }}</strong>
              </div>
              <div v-if="submitted" class="mode-summary-card">
                <span class="mode-summary-label">{{ t("problemset.mode.correctCount") }}</span>
                <strong>{{ correctCount }} {{ t("common.questions") }}</strong>
              </div>
              <div v-if="submitted" class="mode-summary-card">
                <span class="mode-summary-label">{{ t("problemset.mode.score") }}</span>
                <strong>{{ submissionScore }} / {{ maxScore }}</strong>
              </div>
            </div>

            <div class="actions mode-actions">
              <button v-if="isExam && !submitted && !!currentUser?.uid" class="btn warn" @click="pauseExam">{{ t("problemset.mode.pause") }}</button>
              <button v-if="isExam && !submitted" class="btn primary" @click="submitExam('manual')">{{ t("problemset.mode.submitNow") }}</button>
              <button v-if="!isExam && !submitted" class="btn primary" @click="saveTrainingRecord">
                {{ isGuest ? t("problemset.mode.submitAndView") : t("problemset.mode.saveTraining") }}
              </button>
            </div>

            <div class="mode-question-nav">
              <div class="mode-question-nav-head">
                <h3>{{ t("problemset.detail.questionList") }}</h3>
              </div>
              <div class="question-group-list">
                <template v-for="group in sidebarQuestionGroups" :key="group.key">
                  <section
                    v-if="group.isMaterialGroup"
                    class="question-group-block material"
                  >
                    <div class="question-group-title">{{ group.title }}</div>
                    <div class="question-grid">
                      <button
                        v-for="question in group.questions"
                        :key="question.id"
                        class="num-btn"
                        :class="questionButtonClass(question)"
                        @click="scrollToQuestion(question.id)"
                      >
                        {{ question.index }}
                      </button>
                    </div>
                  </section>

                  <button
                    v-else
                    class="num-btn num-btn-standalone"
                    :class="questionButtonClass(group.questions[0])"
                    @click="scrollToQuestion(group.questions[0].id)"
                  >
                    {{ group.questions[0].index }}
                  </button>
                </template>
              </div>
            </div>
          </aside>
        </section>
        <HighlightToolbar
          :x="toolbarState.x"
          :y="toolbarState.y"
          :visible="toolbarState.visible"
          @highlight="applyHighlight"
          @clear="clearHighlight"
          @close="dismissToolbar"
        />
      </template>
    </div>
  </TiLayout>
</template>
