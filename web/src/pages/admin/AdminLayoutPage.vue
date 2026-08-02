<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import TiLayout from "../../layouts/TiLayout.vue";
import { useAdminAccess } from "./useAdminAccess";

const route = useRoute();
const { t } = useI18n();
const { user, isAdmin } = useAdminAccess();
const mobileMenuOpen = ref(false);

const navSections = computed(() => [
  {
    label: t("admin.sections.content"),
    items: [
      { to: "/admin/problemsets", icon: "fa-solid fa-file-lines", label: t("admin.nav.problemsets"), description: t("admin.navDescriptions.problemsets") },
      { to: "/admin/questions", icon: "fa-solid fa-list-check", label: t("admin.nav.questions"), description: t("admin.navDescriptions.questions") },
      { to: "/admin/system-pages", icon: "fa-solid fa-window-maximize", label: t("admin.nav.systemPages"), description: t("admin.navDescriptions.systemPages") }
    ]
  },
  {
    label: t("admin.sections.access"),
    items: [
      { to: "/admin/users", icon: "fa-solid fa-users", label: t("admin.nav.users"), description: t("admin.navDescriptions.users") }
    ]
  },
  {
    label: t("admin.sections.system"),
    items: [
      { to: "/admin/oauth", icon: "fa-solid fa-plug", label: t("admin.nav.services"), description: t("admin.navDescriptions.services") },
      { to: "/admin/backup", icon: "fa-solid fa-database", label: t("admin.nav.backup"), description: t("admin.navDescriptions.backup") }
    ]
  }
]);

const activeNavItem = computed(() =>
  navSections.value.flatMap((section) => section.items).find((item) => route.path.startsWith(item.to))
);

function isActive(to: string) {
  return route.path.startsWith(to);
}

watch(() => route.path, () => {
  mobileMenuOpen.value = false;
});

const pageTitle = computed(() => {
  if (route.path.startsWith("/admin/problemsets")) return t("admin.titles.problemsets");
  if (route.path.startsWith("/admin/questions")) return t("admin.titles.questions");
  if (route.path.startsWith("/admin/oauth")) return t("admin.titles.services");
  if (route.path.startsWith("/admin/system-pages")) return t("admin.titles.systemPages");
  if (route.path.startsWith("/admin/backup")) return t("admin.titles.backup");
  return t("admin.titles.users");
});
</script>

<template>
  <TiLayout :title="pageTitle" :subtitle="t('admin.subtitle')" :use-panel="false">
    <section class="admin-shell page-shell">
      <div v-if="!user" class="admin-card admin-notice">
        <p>{{ t("common.loginFirst") }}</p>
        <RouterLink to="/auth/login">{{ t("common.goLogin") }}</RouterLink>
      </div>

      <div v-else-if="!isAdmin" class="admin-card admin-notice">
        <p>{{ t("admin.noPermission") }}</p>
      </div>

      <template v-else>
        <aside class="admin-nav admin-card" :class="{ 'is-open': mobileMenuOpen }">
          <div class="admin-nav-head">
            <span class="admin-nav-brand-icon" aria-hidden="true"><i class="fa-solid fa-sliders"></i></span>
            <div>
              <h3>{{ t("admin.managementCenter") }}</h3>
              <p>{{ t("admin.menuHint") }}</p>
            </div>
            <button
              class="admin-nav-toggle"
              type="button"
              :aria-expanded="mobileMenuOpen"
              :aria-label="t('admin.menu')"
              @click="mobileMenuOpen = !mobileMenuOpen"
            >
              <span>{{ activeNavItem?.label || t("admin.menu") }}</span>
              <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </button>
          </div>

          <nav class="admin-nav-groups" :aria-label="t('admin.menu')">
            <section v-for="section in navSections" :key="section.label" class="admin-nav-group">
              <h4>{{ section.label }}</h4>
              <RouterLink
                v-for="item in section.items"
                :key="item.to"
                :to="item.to"
                class="admin-nav-link"
                :class="{ active: isActive(item.to) }"
                :aria-current="isActive(item.to) ? 'page' : undefined"
              >
                <span class="admin-nav-link-icon" aria-hidden="true"><i :class="item.icon"></i></span>
                <span class="admin-nav-link-copy">
                  <strong>{{ item.label }}</strong>
                  <small>{{ item.description }}</small>
                </span>
                <i class="admin-nav-link-arrow fa-solid fa-chevron-right" aria-hidden="true"></i>
              </RouterLink>
            </section>

            <RouterLink to="/problemset" class="admin-nav-back">
              <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
              <span>{{ t("admin.backToSite") }}</span>
            </RouterLink>
          </nav>
        </aside>
        <main class="admin-main">
          <RouterView />
        </main>
      </template>
    </section>
  </TiLayout>
</template>
