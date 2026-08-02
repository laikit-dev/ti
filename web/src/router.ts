import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import NotFoundPage from "./pages/NotFoundPage.vue";
import ProblemsetPage from "./pages/ProblemsetPage.vue";
import ProblemsetSearchPage from "./pages/ProblemsetSearchPage.vue";
import ProblemsetCreatePage from "./pages/ProblemsetCreatePage.vue";
import ProblemsetEditPage from "./pages/ProblemsetEditPage.vue";
import ProblemsetDetailPage from "./pages/ProblemsetDetailPage.vue";
import ProblemsetModePage from "./pages/ProblemsetModePage.vue";
import AuthLoginPage from "./pages/AuthLoginPage.vue";
import AuthCpoauthCallbackPage from "./pages/AuthCpoauthCallbackPage.vue";
import AuthBannedPage from "./pages/AuthBannedPage.vue";
import UserProfilePage from "./pages/UserProfilePage.vue";
import UserSettingsPage from "./pages/UserSettingsPage.vue";
import SystemPageView from "./pages/SystemPageView.vue";
import AdminLayoutPage from "./pages/admin/AdminLayoutPage.vue";
import AdminUsersPage from "./pages/admin/AdminUsersPage.vue";
import AdminProblemsetsPage from "./pages/admin/AdminProblemsetsPage.vue";
import AdminQuestionsPage from "./pages/admin/AdminQuestionsPage.vue";
import AdminOauthPage from "./pages/admin/AdminOauthPage.vue";
import AdminSystemPagesPage from "./pages/admin/AdminSystemPagesPage.vue";
import AdminBackupPage from "./pages/admin/AdminBackupPage.vue";
import { loadLocalUser } from "./api/auth";
import { BANNED_ROUTE_PATH } from "./utils/authRedirect";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/problemset" },
  { path: "/problemset", component: ProblemsetPage },
  { path: "/search", component: ProblemsetSearchPage },
  { path: "/problemset/_new", component: ProblemsetCreatePage },
  { path: "/problemset/:id/edit", component: ProblemsetEditPage },
  { path: "/problemset/:id/exam", component: ProblemsetModePage },
  { path: "/problemset/:id/training", component: ProblemsetModePage },
  { path: "/problemset/:id", component: ProblemsetDetailPage },
  { path: "/auth/login", component: AuthLoginPage },
  { path: "/auth/cpoauth/callback", component: AuthCpoauthCallbackPage },
  { path: BANNED_ROUTE_PATH, component: AuthBannedPage },
  { path: "/system/:slug", component: SystemPageView },
  {
    path: "/user/_me",
    redirect: () => {
      const uid = loadLocalUser()?.uid ?? "";
      return uid ? `/user/${uid}` : "/auth/login";
    }
  },
  { path: "/user/_me/settings", component: UserSettingsPage },
  { path: "/user/:uid", component: UserProfilePage },
  {
    path: "/admin",
    component: AdminLayoutPage,
    children: [
      { path: "", redirect: "/admin/users" },
      { path: "users", component: AdminUsersPage },
      { path: "problemsets", component: AdminProblemsetsPage },
      { path: "questions", component: AdminQuestionsPage },
      { path: "oauth", component: AdminOauthPage },
      { path: "system-pages", component: AdminSystemPagesPage },
      { path: "backup", component: AdminBackupPage }
    ]
  },
  { path: "/:pathMatch(.*)*", component: NotFoundPage }
];

export const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to) => {
  const currentUser = loadLocalUser();
  if (currentUser?.isBanned && to.path !== BANNED_ROUTE_PATH) {
    return { path: BANNED_ROUTE_PATH };
  }
  return true;
});
