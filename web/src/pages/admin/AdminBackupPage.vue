<script setup lang="ts">
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { exportBackup, restoreBackup, type BackupSelections } from "../../api/admin";
import { askConfirm, notifyError, notifySuccess } from "../../composables/feedback";

const { t } = useI18n();

const exporting = ref(false);
const restoring = ref(false);

const exportSelections = reactive<BackupSelections>({
  problemsets: true,
  oauth: true,
  systemPages: true,
  users: true,
  aiConfig: true,
  submissions: true,
  s3Config: true
});

const exportPassword = ref("");

const restoreSelections = reactive<BackupSelections>({
  problemsets: true,
  oauth: true,
  systemPages: true,
  users: true,
  aiConfig: true,
  submissions: true,
  s3Config: true
});

const restorePassword = ref("");
const restoreFile = ref<File | null>(null);
const restoreFileLabel = ref("");

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    restoreFile.value = input.files[0];
    restoreFileLabel.value = input.files[0].name;
  } else {
    restoreFile.value = null;
    restoreFileLabel.value = "";
  }
}

function downloadJson(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function handleExport() {
  exporting.value = true;
  try {
    const data = await exportBackup(exportSelections, exportPassword.value);
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const prefix = exportPassword.value ? "ti-encrypted-backup" : "ti-backup";
    downloadJson(data, `${prefix}-${ts}.json`);
    notifySuccess(t("admin.backup.exportSuccess"));
  } catch (err) {
    notifyError(String((err as Error)?.message ?? err));
  } finally {
    exporting.value = false;
  }
}

async function handleRestore() {
  if (!restoreFile.value) {
    notifyError(t("admin.backup.noFileSelected"));
    return;
  }

  const confirmed = await askConfirm({
    title: t("admin.backup.restoreConfirmTitle"),
    message: t("admin.backup.restoreConfirmMessage"),
    confirmText: t("admin.backup.restoreBtn"),
    cancelText: t("common.cancel"),
    danger: true
  });
  if (!confirmed) return;

  restoring.value = true;
  try {
    const text = await restoreFile.value.text();
    let backupData: unknown;
    try {
      backupData = JSON.parse(text);
    } catch {
      notifyError(t("admin.backup.invalidJson"));
      restoring.value = false;
      return;
    }
    await restoreBackup(backupData, restoreSelections, restorePassword.value);
    notifySuccess(t("admin.backup.restoreSuccess"));
  } catch (err) {
    notifyError(String((err as Error)?.message ?? err));
  } finally {
    restoring.value = false;
  }
}
</script>

<template>
  <div class="admin-page">
    <section id="backup-export" class="admin-card">
      <div class="admin-head">
        <h3>{{ t("admin.backup.exportTitle") }}</h3>
      </div>
      <p class="admin-hint">{{ t("admin.backup.exportHint") }}</p>

      <form @submit.prevent="handleExport">
        <div class="admin-form-grid">
          <fieldset class="backup-checkbox-group">
            <legend>{{ t("admin.backup.selectContent") }}</legend>
            <label class="backup-checkbox">
              <input v-model="exportSelections.problemsets" type="checkbox" />
              <span>{{ t("admin.backup.problemsets") }}</span>
            </label>
            <label class="backup-checkbox">
              <input v-model="exportSelections.oauth" type="checkbox" />
              <span>{{ t("admin.backup.oauth") }}</span>
            </label>
            <label class="backup-checkbox">
              <input v-model="exportSelections.systemPages" type="checkbox" />
              <span>{{ t("admin.backup.systemPages") }}</span>
            </label>
            <label class="backup-checkbox">
              <input v-model="exportSelections.users" type="checkbox" />
              <span>{{ t("admin.backup.users") }}</span>
            </label>
            <label class="backup-checkbox">
              <input v-model="exportSelections.aiConfig" type="checkbox" />
              <span>{{ t("admin.backup.aiConfig") }}</span>
            </label>
            <label class="backup-checkbox">
              <input v-model="exportSelections.submissions" type="checkbox" />
              <span>{{ t("admin.backup.submissions") }}</span>
            </label>
            <label class="backup-checkbox">
              <input v-model="exportSelections.s3Config" type="checkbox" />
              <span>{{ t("admin.backup.s3Config") }}</span>
            </label>
          </fieldset>

          <label>
            <span>{{ t("admin.backup.passwordLabel") }}</span>
            <input v-model="exportPassword" type="password" :placeholder="t('admin.backup.passwordPlaceholder')" autocomplete="off" />
          </label>
        </div>

        <div class="admin-actions">
          <button class="admin-btn primary" type="submit" :disabled="exporting">
            {{ exporting ? t("admin.backup.exporting") : t("admin.backup.exportBtn") }}
          </button>
        </div>
      </form>
    </section>

    <section id="backup-restore" class="admin-card">
      <div class="admin-head">
        <h3>{{ t("admin.backup.restoreTitle") }}</h3>
      </div>
      <p class="admin-hint">{{ t("admin.backup.restoreHint") }}</p>

      <form @submit.prevent="handleRestore">
        <div class="admin-form-grid">
          <label>
            <span>{{ t("admin.backup.backupFile") }}</span>
            <input type="file" accept=".json,application/json" @change="handleFileChange" />
          </label>
          <p v-if="restoreFileLabel" class="admin-hint">{{ t("admin.backup.selectedFile") }}: {{ restoreFileLabel }}</p>

          <label>
            <span>{{ t("admin.backup.passwordLabel") }}</span>
            <input v-model="restorePassword" type="password" :placeholder="t('admin.backup.restorePasswordPlaceholder')" autocomplete="off" />
          </label>

          <fieldset class="backup-checkbox-group">
            <legend>{{ t("admin.backup.selectRestoreContent") }}</legend>
            <label class="backup-checkbox">
              <input v-model="restoreSelections.problemsets" type="checkbox" />
              <span>{{ t("admin.backup.problemsets") }}</span>
            </label>
            <label class="backup-checkbox">
              <input v-model="restoreSelections.oauth" type="checkbox" />
              <span>{{ t("admin.backup.oauth") }}</span>
            </label>
            <label class="backup-checkbox">
              <input v-model="restoreSelections.systemPages" type="checkbox" />
              <span>{{ t("admin.backup.systemPages") }}</span>
            </label>
            <label class="backup-checkbox">
              <input v-model="restoreSelections.users" type="checkbox" />
              <span>{{ t("admin.backup.users") }}</span>
            </label>
            <label class="backup-checkbox">
              <input v-model="restoreSelections.aiConfig" type="checkbox" />
              <span>{{ t("admin.backup.aiConfig") }}</span>
            </label>
            <label class="backup-checkbox">
              <input v-model="restoreSelections.submissions" type="checkbox" />
              <span>{{ t("admin.backup.submissions") }}</span>
            </label>
            <label class="backup-checkbox">
              <input v-model="restoreSelections.s3Config" type="checkbox" />
              <span>{{ t("admin.backup.s3Config") }}</span>
            </label>
          </fieldset>
        </div>

        <div class="admin-actions">
          <button class="admin-btn danger" type="submit" :disabled="restoring">
            {{ restoring ? t("admin.backup.restoring") : t("admin.backup.restoreBtn") }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.backup-checkbox-group {
  border: 1px solid var(--app-border-strong);
  border-radius: 4px;
  padding: 10px 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.backup-checkbox-group legend {
  color: var(--app-text);
  font-weight: 600;
  font-size: 14px;
  padding: 0 4px;
}

.backup-checkbox {
  display: inline-flex !important;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--app-text);
}

.backup-checkbox input[type="checkbox"] {
  width: auto;
  accent-color: var(--app-primary);
}
</style>
