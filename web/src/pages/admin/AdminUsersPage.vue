<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  banUser,
  deleteUser,
  downloadUserPersonalData,
  fetchAdminUsers,
  promoteUser,
  updateUser
} from "../../api/admin";
import type { AuthUser } from "../../api/auth";
import { askConfirm, notifyError, notifySuccess, notifyWarning } from "../../composables/feedback";
import { useAdminAccess } from "./useAdminAccess";

const { t } = useI18n();
const { user: currentUser } = useAdminAccess();
const users = ref<AuthUser[]>([]);
const loading = ref(false);
const selected = ref<string[]>([]);
const editingUid = ref("");
const downloadingUid = ref("");

const editForm = reactive({
  uid: "",
  username: "",
  email: ""
});

const allSelected = computed(() => users.value.length > 0 && selected.value.length === users.value.length);
const selectedSet = computed(() => new Set(selected.value));

function isSelf(uid: string) {
  return uid === currentUser?.uid;
}

async function loadUsers() {
  loading.value = true;
  try {
    users.value = await fetchAdminUsers();
    selected.value = selected.value.filter((uid) => users.value.some((item) => item.uid === uid));
  } catch (err) {
    notifyError(String((err as Error)?.message ?? err));
  } finally {
    loading.value = false;
  }
}

function toggleAll() {
  if (allSelected.value) {
    selected.value = [];
  } else {
    selected.value = users.value.map((item) => item.uid);
  }
}

function toggleOne(uid: string) {
  if (selectedSet.value.has(uid)) {
    selected.value = selected.value.filter((item) => item !== uid);
  } else {
    selected.value = [...selected.value, uid];
  }
}

function startEdit(target: AuthUser) {
  editingUid.value = target.uid;
  editForm.uid = target.uid;
  editForm.username = target.username;
  editForm.email = target.email;
  document.getElementById("user-edit")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function submitEdit() {
  if (!editingUid.value) {
    notifyWarning(t("admin.users.selectEditFirst"));
    return;
  }
  try {
    const updated = await updateUser(editingUid.value, {
      uid: editForm.uid.trim(),
      username: editForm.username.trim(),
      email: editForm.email.trim()
    });
    editingUid.value = updated.uid;
    notifySuccess(t("admin.users.updated", { uid: updated.uid }));
    await loadUsers();
  } catch (err) {
    notifyError(String((err as Error)?.message ?? err));
  }
}

async function runBatch(title: string, message: string, task: (uid: string) => Promise<void>) {
  if (selected.value.length === 0) {
    notifyWarning(t("admin.users.selectFirst"));
    return;
  }
  const confirmed = await askConfirm({
    title,
    message: `${message}\n${t("admin.users.selectedCount", { count: selected.value.length })}`,
    confirmText: t("admin.users.continue"),
    cancelText: t("common.cancel"),
    danger: true
  });
  if (!confirmed) return;

  let success = 0;
  for (const uid of selected.value) {
    try {
      await task(uid);
      success += 1;
    } catch (err) {
      notifyError(t("admin.users.operationFailed", { uid, reason: String((err as Error)?.message ?? err) }));
    }
  }
  notifySuccess(t("admin.users.batchCompleted", { success, total: selected.value.length }));
  await loadUsers();
}

async function batchPromote() {
  await runBatch(t("admin.users.batchPromoteTitle"), t("admin.users.batchPromoteMessage"), async (uid) => {
    await updateUser(uid, { isAdmin: true });
  });
}

async function batchDemote() {
  await runBatch(t("admin.users.batchDemoteTitle"), t("admin.users.batchDemoteMessage"), async (uid) => {
    if (isSelf(uid)) return;
    await updateUser(uid, { isAdmin: false });
  });
}

async function batchBan(nextBanned: boolean) {
  await runBatch(
    nextBanned ? t("admin.users.batchBanTitle") : t("admin.users.batchUnbanTitle"),
    nextBanned ? t("admin.users.batchBanMessage") : t("admin.users.batchUnbanMessage"),
    async (uid) => {
    if (nextBanned && isSelf(uid)) return;
    await banUser(uid, nextBanned);
  });
}

async function batchDelete() {
  await runBatch(t("admin.users.batchDeleteTitle"), t("admin.users.batchDeleteMessage"), async (uid) => {
    if (isSelf(uid)) return;
    await deleteUser(uid);
  });
}

async function singlePromote(uid: string) {
  try {
    const target = users.value.find((item) => item.uid === uid);
    const nextAdmin = !Boolean(target?.isAdmin);
    if (!nextAdmin && isSelf(uid)) {
      notifyWarning(t("admin.users.cannotDemoteSelf"));
      return;
    }
    if (nextAdmin) {
      await promoteUser(uid);
    } else {
      await updateUser(uid, { isAdmin: false });
    }
    notifySuccess(nextAdmin ? t("admin.users.promoted", { uid }) : t("admin.users.demoted", { uid }));
    await loadUsers();
  } catch (err) {
    notifyError(String((err as Error)?.message ?? err));
  }
}

async function singleToggleBan(uid: string, banned: boolean) {
  try {
    if (banned && isSelf(uid)) {
      notifyWarning(t("admin.users.cannotBanSelf"));
      return;
    }
    await banUser(uid, banned);
    notifySuccess(banned ? t("admin.users.banned", { uid }) : t("admin.users.unbanned", { uid }));
    await loadUsers();
  } catch (err) {
    notifyError(String((err as Error)?.message ?? err));
  }
}

async function downloadPersonalData(uid: string) {
  if (downloadingUid.value) return;
  downloadingUid.value = uid;
  try {
    const { blob, filename } = await downloadUserPersonalData(uid);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    notifySuccess(t("admin.users.exported", { uid }));
  } catch (err) {
    notifyError(String((err as Error)?.message ?? err));
  } finally {
    downloadingUid.value = "";
  }
}

onMounted(loadUsers);
</script>

<template>
  <div class="admin-page">
    <nav class="admin-anchor-nav">
      <a href="#users-table">{{ t("admin.users.listAnchor") }}</a>
      <a href="#user-edit">{{ t("admin.users.editAnchor") }}</a>
    </nav>

    <section id="users-table" class="admin-card">
      <div class="admin-head">
        <h3>{{ t("admin.users.listHeading") }}</h3>
        <button class="admin-btn" type="button" @click="loadUsers">{{ t("common.refresh") }}</button>
      </div>
      <div class="admin-toolbar">
        <button class="admin-btn" type="button" @click="toggleAll">{{ allSelected ? t("admin.common.clearSelection") : t("admin.common.selectAll") }}</button>
        <button class="admin-btn" type="button" @click="batchPromote">{{ t("admin.users.batchPromoteTitle") }}</button>
        <button class="admin-btn" type="button" @click="batchDemote">{{ t("admin.users.batchDemoteTitle") }}</button>
        <button class="admin-btn" type="button" @click="batchBan(true)">{{ t("admin.users.batchBanTitle") }}</button>
        <button class="admin-btn" type="button" @click="batchBan(false)">{{ t("admin.users.batchUnbanTitle") }}</button>
        <button class="admin-btn danger" type="button" @click="batchDelete">{{ t("admin.common.bulkDelete") }}</button>
      </div>
      <p class="admin-hint">{{ t("admin.users.selfHint") }}</p>

      <p v-if="loading">{{ t("common.loading") }}</p>
      <table v-else class="admin-table">
        <thead>
          <tr>
            <th>{{ t("admin.common.select") }}</th>
            <th>UID</th>
            <th>{{ t("admin.users.username") }}</th>
            <th>{{ t("admin.users.email") }}</th>
            <th>{{ t("admin.users.admin") }}</th>
            <th>{{ t("admin.users.bannedLabel") }}</th>
            <th>{{ t("admin.common.actions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in users" :key="item.uid">
            <td><input type="checkbox" :checked="selectedSet.has(item.uid)" @change="toggleOne(item.uid)" /></td>
            <td>{{ item.uid }}</td>
            <td>{{ item.username }}</td>
            <td>{{ item.email }}</td>
            <td>{{ item.isAdmin ? t("common.yes") : t("common.no") }}</td>
            <td>{{ item.isBanned ? t("common.yes") : t("common.no") }}</td>
            <td class="actions">
              <button class="admin-btn" type="button" :disabled="Boolean(downloadingUid)" @click="downloadPersonalData(item.uid)">
                <i class="fa-solid fa-download" aria-hidden="true"></i>
                {{ downloadingUid === item.uid ? t("admin.users.exporting") : t("admin.users.exportData") }}
              </button>
              <button class="admin-btn" type="button" @click="startEdit(item)">{{ t("common.edit") }}</button>
              <button class="admin-btn" type="button" @click="singlePromote(item.uid)">{{ item.isAdmin ? t("admin.users.demote") : t("admin.users.promote") }}</button>
              <button class="admin-btn" type="button" @click="singleToggleBan(item.uid, !item.isBanned)">
                {{ item.isBanned ? t("admin.users.unban") : t("admin.users.ban") }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section id="user-edit" class="admin-card">
      <h3>{{ t("admin.users.editHeading") }}</h3>
      <p class="admin-hint">{{ t("admin.users.editHint") }}</p>
      <div class="admin-form-grid">
        <label>
          <span>UID</span>
          <input v-model.trim="editForm.uid" type="text" :placeholder="t('admin.users.editable')" />
        </label>
        <label>
          <span>{{ t("admin.users.username") }}</span>
          <input v-model.trim="editForm.username" type="text" :placeholder="t('admin.users.editable')" />
        </label>
        <label>
          <span>{{ t("admin.users.email") }}</span>
          <input v-model.trim="editForm.email" type="email" :placeholder="t('admin.users.editable')" />
        </label>
      </div>
      <div class="admin-actions">
        <button class="admin-btn primary" type="button" @click="submitEdit">{{ t("admin.users.save") }}</button>
      </div>
    </section>
  </div>
</template>
