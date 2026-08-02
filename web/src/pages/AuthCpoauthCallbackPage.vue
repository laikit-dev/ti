<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import TiLayout from "../layouts/TiLayout.vue";
import { redeemCpoauthTicket, saveLocalUser } from "../api/auth";
import { BANNED_ROUTE_PATH, isBannedMessage } from "../utils/authRedirect";
import { useAppLocale } from "../i18n";
import type { AppLocale } from "../i18n/messages";
import { setThemeMode, nextThemeMode, useThemeMode } from "../theme/useTheme";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { currentLocale, localeOptions, setLocale } = useAppLocale();
const { themeMode, isDarkTheme } = useThemeMode();
const pending = ref(true);
const message = ref(t("auth.callbackProcessing"));
const error = ref("");

const currentThemeIconClass = computed(() => {
  if (themeMode.value === "auto") return "fa-solid fa-desktop";
  return themeMode.value === "dark" ? "fa-regular fa-moon" : "fa-regular fa-sun";
});

const currentThemeLabel = computed(() => {
  if (themeMode.value === "auto") return t("layout.themeAuto");
  return themeMode.value === "dark" ? t("layout.themeDark") : t("layout.themeLight");
});

function handleThemeToggle() {
  setThemeMode(nextThemeMode(themeMode.value));
}

function handleLocaleChange(event: Event) {
  setLocale((event.target as HTMLSelectElement).value as AppLocale);
}

onMounted(async () => {
  const ticket = String(route.query.ticket ?? "").trim();
  const directError = String(route.query.error ?? "").trim();

  if (directError) {
    if (isBannedMessage(directError)) {
      await router.replace(BANNED_ROUTE_PATH);
      return;
    }
    pending.value = false;
    error.value = decodeURIComponent(directError);
    message.value = t("auth.callbackFailed");
    return;
  }

  if (!ticket) {
    pending.value = false;
    error.value = t("auth.callbackMissingTicket");
    message.value = t("auth.callbackFailed");
    return;
  }

  try {
    const { user, returnTo } = await redeemCpoauthTicket(ticket);
    saveLocalUser(user);
    await router.replace(user.isBanned ? BANNED_ROUTE_PATH : (returnTo || "/problemset"));
  } catch (err) {
    pending.value = false;
    error.value = String((err as Error)?.message ?? err);
    message.value = t("auth.callbackFailed");
  }
});
</script>

<template>
  <TiLayout :subtitle="t('auth.callbackTitle')" :show-top-bar="false" :show-title="false" :use-panel="false">
    <section class="callback-wrap auth-callback-page">
      <div class="callback-card">
        <div class="auth-card-controls">
          <label class="locale-control top-control">
            <span class="locale-control__icon" aria-hidden="true">
              <i class="fa-solid fa-language"></i>
            </span>
            <select class="locale-control__select" :aria-label="t('locale.label')" :value="currentLocale" @change="handleLocaleChange">
              <option v-for="option in localeOptions" :key="option.value" :value="option.value">
                {{ t(option.labelKey) }}
              </option>
            </select>
          </label>

          <button
            type="button"
            class="theme-toggle top-control"
            :title="`${t('layout.themeLabel')}: ${currentThemeLabel}`"
            :aria-label="`${t('layout.themeLabel')}: ${currentThemeLabel}`"
            :aria-pressed="isDarkTheme"
            @click="handleThemeToggle"
          >
            <i :class="currentThemeIconClass"></i>
          </button>
        </div>

        <h2>{{ message }}</h2>
        <p v-if="pending">{{ t("auth.callbackPending") }}</p>
        <template v-else>
          <p class="error" v-if="error">{{ error }}</p>
          <router-link class="back" to="/auth/login">{{ t("auth.callbackBack") }}</router-link>
        </template>
      </div>
    </section>
  </TiLayout>
</template>
