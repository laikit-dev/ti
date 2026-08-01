<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";
import { loadPublicSiteContentCached, type PublicSiteContent } from "../api/siteContent";

const SITE_START_DATE = "2025-01-01";
const publicSiteContent = ref<PublicSiteContent | null>(null);
const { t } = useI18n();

const siteDays = computed<number>(() => {
  const start = new Date(`${SITE_START_DATE}T00:00:00`);
  const now = new Date();
  const diff = Math.max(0, now.getTime() - start.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

const legalLinks = computed(() => {
  const items = [];
  if (publicSiteContent.value?.userAgreementPage) {
    items.push(publicSiteContent.value.userAgreementPage);
  }
  if (publicSiteContent.value?.privacyPolicyPage) {
    items.push(publicSiteContent.value.privacyPolicyPage);
  }
  return items;
});

onMounted(async () => {
  try {
    publicSiteContent.value = await loadPublicSiteContentCached();
  } catch {
    publicSiteContent.value = null;
  }
});
</script>

<template>
  <footer class="footer">
    <div class="footer-inner ui-grid">
      <div class="column firacode">
        <p>
          <i class="fa fa-copyright"></i>
          <span>{{ t("footer.copyright") }}</span>
          <a href="https://ti.luogu.me" target="_blank" rel="noreferrer" class="footer-link">ti.luogu.me</a>
        </p>
        <p class="group">
          <a href="https://github.com/laikit-dev/ti" target="_blank" rel="noreferrer" class="footer-link">
            <i class="fab fa-github"></i>
            <span>laikit-dev/ti</span>
          </a>
        </p>
        <p v-if="legalLinks.length > 0" class="group">
          <RouterLink
            v-for="item in legalLinks"
            :key="item.slug"
            :to="`/system/${item.slug}`"
            class="footer-link"
          >
            <i :class="item.systemKey === 'privacy_policy' ? 'fa fa-user-shield' : 'fa fa-file-contract'"></i>
            <span>{{ item.title }}</span>
          </RouterLink>
        </p>
      </div>

      <div class="column right firacode">
        <p>
          <i class="fa fa-code"></i>
          <span>{{ t("footer.developers") }}</span>
        </p>
        <p>
          <a href="https://qm.qq.com/q/QVM9YFEb26" target="_blank" rel="noreferrer" class="footer-link">
            <i class="fab fa-qq"></i>
            <span>{{ t("footer.qqGroup") }}</span>
          </a>
        </p>
        <p style="font-weight: bold;">
          <a href="https://www.rainyun.com/federico_" target="_blank" rel="noreferrer" class="footer-link">
            <i class="fa fa-server"></i>
            <span>{{ t("footer.sponsor") }}</span>
          </a>
        </p>
      </div>
    </div>
  </footer>
</template>
