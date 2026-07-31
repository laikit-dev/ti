export const zhCN = {
  common: {
    appName: "保存站有题",
    loading: "加载中...",
    loadingPage: "页面加载中",
    save: "保存",
    saving: "保存中...",
    create: "创建",
    creating: "创建中...",
    update: "更新",
    delete: "删除",
    deleting: "删除中...",
    edit: "编辑",
    preview: "预览",
    reset: "重置",
    refresh: "刷新",
    search: "搜索",
    cancel: "取消",

    minutes: "分钟",
    hours: "小时",
    points: "分",
    questions: "题",
    success: "成功",
    error: "失败",
    tip: "提示",
    pleaseConfirm: "请确认",
    notFound: "未找到对应页面。",
    invalidUser: "无效用户。",
    loginFirst: "请先登录。",
    goLogin: "去登录",
    empty: "暂无内容",
    all: "全部"
  },
  locale: {
    label: "语言",
    zhCN: "简体中文",
    enUS: "English",
    jaJP: "日本語"
  },
  feedback: {
    defaultToastTitle: "提示"
  },
  confirm: {
    ok: "确定",
    cancel: "取消"
  },
  unsaved: {
    title: "确认离开当前编辑？",
    message: "你有尚未保存的修改，离开或刷新页面会丢失这些内容。确定继续吗？",
    leave: "离开",
    stay: "继续编辑",
    answerTitle: "确认离开当前作答？",
    answerMessage: "你正在作答中，离开或刷新可能丢失最新进度。确定继续吗？",
    continueAnswering: "继续作答"
  },
  layout: {
    siteTitleSuffix: "保存站有题",
    menu: "菜单",
    nav: {
      problemsets: "题库",
      createProblemset: "新建题目",
      search: "搜索",
      home: "保存站"
    },
    navTitle: {
      problemsets: "题库",
      createProblemset: "新建题目",
      search: "搜索题目",
      home: "前往保存站"
    },
    themeLabel: "主题",
    themeAuto: "跟随系统",
    themeDark: "深色模式",
    themeLight: "浅色模式",
    profile: "个人中心",
    settings: "个人设置",
    admin: "管理后台",
    logout: "退出登录",
    loginOrRegister: "登录 / 注册"
  },
  footer: {
    copyright: "2025-2026 保存站有题",
    developers: "开发者：Federico2903 & Murasame & quanac-lcx",
    qqGroup: "保存站用户群：1017248143（点击加入）",
    sponsor: "由 雨云 提供支持"
  },
  auth: {
    loginRegister: "登录 / 注册",
    loginSubtitle: "登录 / 注册",
    loginTitle: "登录 / 注册",
    loginTipPrefix: "请使用",
    loginTipSuffix: "登录或注册。未注册的用户将自动完成注册。",
    loginPolicyTip: "点击下方按钮即表示你同意本站及 CP OAuth 的相关协议、条款和政策。",
    userAgreement: "用户协议",
    privacyPolicy: "隐私政策",
    continueWithCpoauth: "使用 CP OAuth 继续",
    adminToken: "Admin Token",
    adminTokenInvalid: "格式有误",
    loginWithAdminToken: "使用 Admin Token 登录",
    loggingIn: "登录中...",
    callbackProcessing: "正在处理 CP OAuth 登录...",
    callbackFailed: "CP OAuth 登录失败",
    callbackTitle: "CP OAuth 登录",
    callbackPending: "请稍候，正在跳转...",
    callbackBack: "返回登录页",
    callbackMissingTicket: "缺少 ticket，无法完成登录。",
    bannedTitle: "出错了",
    bannedSubtitle: "保存站有题 / 错误",
    bannedHeading: "你已被封禁！",
    bannedText: "该账号当前无法继续访问本站。",
    bannedContact: "如需申诉，请联系：i@hiac.me"
  },
  api: {
    backendUnavailable: "后端服务不可用：{url}（请先启动 server）",
    forbidden: "forbidden"
  },
  systemPage: {
    title: "系统页面",
    subtitle: "系统页面",
    loading: "页面加载中...",
    updatedAt: "最后更新：{time}",
    notFoundTitle: "404"
  },
  pageNotFound: {
    title: "404",
    subtitle: "404",
    heading: "404",
    description: "该页面未找到",
    goHome: "返回首页"
  },
  userNotFound: {
    title: "用户未找到",
    subtitle: "用户未找到",
    heading: "用户未找到",
    description: "该用户不存在或已被删除。",
    goHome: "返回首页"
  },
  problemSetNotFound: {
    title: "题单未找到",
    subtitle: "题单未找到",
    heading: "题单未找到",
    description: "该题单不存在或已被移除。",
    goHome: "返回首页"
  },
  problemset: {
    types: {
      officialPublic: "官方公开",
      personalFeatured: "个人精选",
      personalPublic: "个人公开",
      personalPrivate: "个人私有",
      other: "其他"
    },
    common: {
      name: "名称",
      description: "测验描述",
      durationMinutes: "测试时间长度（分钟）",
      type: "题目类型",
      config: "题目配置文件",
      livePreview: "实时预览",
      questionNumber: "第 {index} 题",
      materialGroupWithIndex: "材料题 {index}",
      materialQuestionIndex: "材料题第 {index}",
      subQuestion: "小题",
      input: "填空",
      option: "选择",
      analysis: "解析：",
      answerLabel: "答案：{answer}",
      answerPlaceholder: "请输入答案",
      typeLabel: "类型：{type}｜分值：{score}"
    },
    list: {
      title: "题库",
      subtitle: "保存站有题 / 试题列表",
      official: "官方题目",
      featured: "个人精选",
      create: "新建题目",
      empty: "当前分栏下暂无题目"
    },
    search: {
      title: "搜索",
      subtitle: "保存站有题 / 搜索",
      placeholder: "搜索题目 ID、标题、描述或作者用户名",
      back: "返回题库",
      searching: "搜索中...",
      idle: "请输入文本。按下 Enter 键开始搜索。",
      empty: "没有找到匹配的官方公开、个人精选或个人公开题目"
    },
    create: {
      title: "新建题目",
      subtitle: "保存站有题 / 题库 / 新建题目",
      heading: "创建试卷",
      adminIdPlaceholder: "你是管理员，可以自定义。留空会自动分配",
      namePlaceholder: "填写名称",
      descriptionPlaceholder: "例如：共 25 题，含阅读程序、补全代码、选择题与填空题。",
      configSummary: "题目配置格式",
      configPlaceholder: "按上方规则填写。也可以点击下方填入模板熟悉一下格式。输入的内容会实时渲染在下方。",
      previewEmpty: "请输入文本",
      fillTemplate: "填入模板",
      submit: "创建试卷",
      parsedCount: "当前共解析到 {count} 题",
      materialGroupCount: "，其中材料题分组 {count} 组",
      created: "创建成功，试卷 ID 为 {id}",
      ruleTemplate: `:::group title="阅读程序"
[material]
请阅读程序，完成下面小题。

\`\`\`cpp
#include <iostream>
using namespace std;

int main() '{'
    int a, b;
    cin >> a >> b;
    int x = a + b;
    cout << x << endl;
    return 0;
'}
\`\`\`
[/material]

:::question type="option" score="2"
[stem]
如果输入 \`3 4\`，输出结果是多少？
[/stem]
[options answer="B"]
A. 5
B. 7
C. 9
D. 11
[/options]
[analysis]
3+4=7，所以输出结果是 7。
[/analysis]
:::

:::question type="input" score="2"
[stem]
如果把 \`x = a + b\` 改成 \`x = a * b\`，输入 \`3 4\` 时输出结果是多少？
[/stem]
[input answer="12" placeholder="请直接填写输出结果"]
[/input]
:::
:::

:::question type="option" score="2.5"
[stem]
题干（支持 Markdown / LaTeX）
[/stem]
[options answer="A,C"]
A. 选项A
B. 选项B
C. 选项C
[/options]
[analysis]
我是本题的解析，可以告诉用户这道题的解题思路，或者写一些相关的知识点。解析部分同样支持 Markdown 和 LaTeX，可以写得很丰富哦，也可以不写。用户无法在测试时查看解析。
[/analysis]
:::

:::question type="input" score="3"
[stem]
填空题题干，支持 Markdown 和 LaTeX。聪明的你应该也已经看到了，本题没有解析。
[/stem]
[input answer="42" placeholder="这是提示语，可以告诉用户填写的格式，也可以不写"]
[/input]
:::`,
      rules: {
        item1: "每道题用 :::question 开头、::: 结尾包裹。",
        item2: "题干写在 [stem]...[/stem] 内，支持 Markdown、LaTeX 和代码块。",
        item3: "选择题：用 [options answer=\"A,C\"]...[/options] 包裹全部选项，每行一个（如 A. 选项文本），最多 26 个。",
        item4: "填空题：用 [input answer=\"答案\" placeholder=\"提示语\"][/input] 定义，placeholder 可选。",
        item5: "解析（可选）：用 [analysis]...[/analysis] 包裹，支持 Markdown 和 LaTeX。",
        item6: "材料题：用 :::group title=\"标题\" 包裹，内部先写 [material]...[/material] 放共享材料，再放多道 :::question。",
        item7: "一个 :::group 内可包含多道 :::question，适合阅读程序、补全代码等场景。",
        item8: "暂不支持 :::group 嵌套 :::group。"
      },
      aiGenSummary: "AI 辅助生成",
      aiGenTip: "可以使用AI方便地创建格式化的题目配置文件，教程详见",
      aiGenLinkText: "此页面",
      errors: {
        titleRequired: "请填写名称。",
        descriptionRequired: "请填写测验描述。",
        durationInvalid: "测试时间长度必须为正数。",
        configRequired: "请填写题目配置文件。",
        idInvalid: "ID 必须是正整数。"
      }
    },
    edit: {
      title: "修改题目",
      subtitle: "保存站有题 / 题库 / 修改题目",
      heading: "修改试卷",
      loading: "题目加载中",
      save: "保存修改",
      deleteButton: "删除试卷",
      updated: "修改成功。",
      deleteTitle: "删除试卷",
      deleteMessage: "确认删除当前试卷吗？删除后不可恢复。",
      deleteConfirm: "确认删除",
      idLabel: "唯一标识符（ID）",
      previewEmpty: "这里会实时渲染你输入的题目配置。"
    },
    detail: {
      pageTitleFallback: "题库 {id}",
      sharedMaterial: "共享材料",
      subtitle: "保存站有题 / 试题列表 / 试题详情",
      loading: "试题加载中",
      exam: "限时测试",
      training: "自由练习",
      edit: "修改题目",
      questionCount: "题目数量",
      duration: "测试时间",
      tabs: {
        description: "试题描述",
        question: "查看题目",
        history: "历史答卷"
      },
      inputPreview: "作答输入框预览",
      score: "本题共 {score} 分",
      showAnswer: "显示答案与解析",
      hideAnswer: "隐藏答案与解析",
      yourAnswer: "你的作答：{answer}",
      emptyAnswer: "（空）",
      earned: "得分：{earned} / {score} 分",
      showAnalysis: "显示解析",
      hideAnalysis: "隐藏解析",
      noHistory: "暂无历史提交。",
      submittedAt: "提交于 {time}",
      recentSubmissions: "最近提交记录",
      expand: "展开",
      collapse: "收起",
      questionList: "题目列表",
      conflictMessage: "{id} - {title} 正在进行中，是否删除上次状态并开始新的测试？（你也可以去个人中心恢复上次考试。）",
      forceStart: "覆盖并开始新测试"
    },
    mode: {
      exam: "限时测试",
      training: "自由练习",
      loading: "题目加载中",
      restoredDraft: "已恢复本地自动保存草稿。",
      activeExamConflict: "检测到你有未完成的限时测试，请先到个人中心恢复。",
      submitTitle: "确认交卷",
      submitMessage: "交卷后会保存记录并显示解析，确认继续吗？",
      submitConfirm: "确认交卷",
      submitCancel: "再检查一下",
      localExamScored: "已完成本地判分。登录后可保存历史记录。",
      examSubmitted: "交卷成功，已生成历史答卷。",
      localTrainingScored: "已完成本地判分。登录后可保存练习记录。",
      trainingSaved: "练习记录已保存。",
      guestTitle: "你未登录！",
      guestMessage: "你当前正在以游客模式作答，成绩不会被保存到个人中心，也无法查看做题记录或调用 AI 来获取提示及解析。",
      noticePrefix: "考试开始后倒计时开始，途中可以暂停，你的答案将间隔一定时间自动保存到本地和云端（",
      noticeLink: "此处设置自动保存间隔",
      noticeSuffix: "）。不小心刷新或关闭可到个人中心找回考试页面。",
      correct: "回答正确",
      wrong: "回答错误",
      remainingTime: "剩余时间",
      answered: "已作答",
      correctCount: "正确题数",
      score: "得分",
      pause: "暂停",
      submitNow: "交卷",
      submitAndView: "提交并查看结果",
      saveTraining: "保存练习记录"
    },
    ai: {
      modelLabel: "AI 模型",
      longPressHint: "{seconds}秒",
      panelTitle: "{question}",
      hintOption: "查看 AI 提示",
      solutionOption: "查看 AI 解答",
      hintTitle: "AI 提示",
      solutionTitle: "AI 解答",
      pendingTitle: "警告",
      pendingContent: "确认要查看吗？建议先多思考一会儿哦。所有内容均为人工智能生成，不作任何保证。",
      confirmHintTitle: "确认查看提示吗",
      confirmSolutionTitle: "确认查看解答吗",
      confirmMessage: "确认要查看吗？建议先多思考一会儿哦。所有内容均为人工智能生成，不作任何保证。",
      confirmWait: "等待 {seconds} 秒",
      confirmNow: "继续",
      hintIntro: "以下是 {question} 的思路提示：",
      hintOptionStep1: "先提炼题目条件，再判断每个选项是否满足。",
      hintOptionStep2: "遇到多个看起来正确的选项时，优先排除与题干矛盾的项。",
      hintOptionStep3: "最终答案前，再用题干条件回代验证一遍。",
      hintInputStep1: "先写出你要计算或推导的中间量。",
      hintInputStep2: "按题目给定格式组织答案，留意大小写和空格。",
      hintInputStep3: "代入边界情况，确认答案没有遗漏。",
      hintStemFocus: "可优先关注题干中的这部分信息：{stem}",
      hintNoStem: "题干内容",
      solutionIntro: "以下是 {question} 的解答参考：",
      solutionAnswerLine: "标准答案：{answer}",
      solutionYourAnswerLine: "你的作答：{answer}",
      solutionCorrectnessLine: "判定结果：{value}",
      solutionScoreLine: "本题得分：{earned} / {score}",
      solutionAnalysisTitle: "题目解析：",
      solutionAnalysisFallback: "暂无解析，建议结合题干和标准答案复盘。"
    }
  },
  profile: {
    title: "个人中心 - {uid}",
    subtitle: "保存站有题 / 用户中心",
    records: "做题记录",
    problemsets: "TA 的题目",
    loading: "加载用户信息中...",
    activeExam: "正在进行中：",
    resumeExam: "继续本场考试",
    loadingRecords: "加载记录中...",
    noSubmissions: "暂无历史答卷。",
    problemsetFallback: "试卷 {id}",
    viewSubmission: "查看历史答卷",
    recordsHidden: "该用户设置了隐私保护，无法查看练习记录。",
    banned: "该用户已被封禁。",
    bio: "TA 的个人简介",
    bioEmpty: "TA 还没有填写简介。",
    modeExam: "限时训练",
    modeTraining: "练习"
  },
  settings: {
    title: "个人设置",
    subtitle: "保存站有题 / 账户设置",
    loading: "设置加载中",
    saved: "设置已保存。",
    noticeTitle: "注意",
    noticePrefix: "修改后记得点击底部“保存设置”。如需修改头像、显示名称、个人简介，请",
    noticeLink: "前往此处",
    noticeSuffix: "，修改后重新登录才会同步。",
    recordsPublic: "做题记录公开可见",
    public: "公开",
    private: "仅自己和管理员可见",
    analysisMode: "Submission 解析展开策略",
    analysisWrongOnly: "仅展开错题解析",
    analysisNone: "不展开任何解析",
    analysisAll: "展开所有解析",
    analysisDesc: "作用于提交记录页（/problemset/:id?submission=:sid）。",
    autosaveTitle: "作答自动保存间隔",
    autosaveDesc: "用于限时测试和自由练习的本地和云端自动保存恢复。这意味着您即使更换了浏览器或设备，登录到当前账号后仍可以恢复您的作答数据。",
    aiModelTitle: "默认 AI 模型",
    aiModelDesc: "用于题目 AI 提示和解析。",
    aiQuotaLimited: "今日剩余 {remaining} / {limit} 次，已用 {used} 次",
    aiQuotaUnlimited: "今日已用 {used} 次，不限次数",
    coverUrl: "个人资料背景图 URL",
    coverPlaceholder: "留空则使用默认背景",
    coverDesc: "仅支持 http(s) 链接。",
    highlighterTitle: "荧光笔工具栏",
    highlighterDesc: "在题目内容中框选文字时是否显示荧光笔悬浮工具栏。",
    highlighterShow: "显示",
    highlighterHide: "不显示",
    clearCover: "清空背景图",
    save: "保存设置",
    autosave: {
      "30": "30 秒",
      "60": "60 秒",
      "120": "120 秒",
      "300": "5 分钟",
      "600": "10 分钟",
      off: "不开启"
    }
  },
  admin: {
    subtitle: "保存站有题 / 管理后台",
    menu: "管理菜单",
    noPermission: "权限不足",
    nav: {
      users: "用户管理",
      problemsets: "试卷管理",
      questions: "试题管理",
      oauth: "OAuth 配置",
      systemPages: "系统页面",
      backup: "备份与还原"
    },
    titles: {
      users: "后台管理 / 用户",
      problemsets: "后台管理 / 试卷",
      questions: "后台管理 / 试题",
      oauth: "后台管理 / OAuth",
      systemPages: "后台管理 / 系统页面",
      backup: "后台管理 / 备份与还原"
    },
    common: {
      select: "选择",
      actions: "操作",
      selectAll: "全选",
      clearSelection: "取消全选",
      bulkDelete: "批量删除"
    },
    oauth: {
      saved: "OAuth 配置已保存。",
      tokenCreated: "已创建 admin token：{token}",
      tokenDeleted: "admin token 已删除。",
      configAnchor: "CP OAuth 配置",
      tokenAnchor: "Admin Token",
      configHeading: "CP OAuth 配置",
      configHint: "请在 OAuth 平台把回调地址配置为此处填写的 callbackUrl。",
      clientIdPlaceholder: "请输入 Client ID",
      clientSecretPlaceholder: "请输入 Client Secret",
      save: "保存配置",
      creatingToken: "生成中...",
      createToken: "生成 Token",
      tokenHint: "最多保留 2 个 token；长度 32 位，包含大小写字母和数字，校验区分大小写。",
      createdBy: "创建人",
      createdAt: "创建时间",
      noTokens: "暂无 token"
    },
    s3: {
      saved: "S3 配置已保存。",
      configAnchor: "S3 CDN 配置",
      configHeading: "S3 CDN 配置",
      configHint: "配置 S3 兼容存储用于加速静态资源分发。上传脚本将从数据库读取这些配置。",
      region: "Region",
      bucket: "Bucket",
      endpoint: "Endpoint",
      cdnBaseUrl: "CDN Base URL",
      accessKeyId: "Access Key ID",
      secretAccessKey: "Secret Access Key",
      prefix: "Prefix",
      concurrency: "并发数",
      forcePathStyle: "Force Path Style"
    },
    ai: {
      saved: "AI 配置已保存。",
      configAnchor: "AI 配置",
      configHeading: "AI 配置",
      configHint: "配置兼容 OpenAI Chat Completions 的模型、密钥与提示词。用户设置页只会展示已启用模型的名称。",
      addModel: "添加模型",
      systemDefaultModel: "系统默认模型",
      promptsTitle: "提示词配置",
      hintSystemPrompt: "提示 System Prompt",
      solutionSystemPrompt: "解析 System Prompt",
      hintUserPrompt: "提示 User Prompt",
      solutionUserPrompt: "解析 User Prompt",
      enabled: "启用",
      name: "名称",
      baseUrl: "Base URL",
      model: "模型",
      secret: "密钥",
      dailyLimit: "每日限额",
      defaultModelName: "默认模型",
      modelNameFallback: "模型 {index}"
    },
    systemPages: {
      settingsSaved: "系统页面配置已保存。",
      updated: "系统页面已更新。",
      created: "系统页面已创建。",
      deleted: "系统页面已删除。",
      deleteTitle: "删除系统页面",
      deleteMessage: "确认删除\u201C{title}\u201D？删除后其 URL 将无法访问。",
      siteSettings: "网站配置",
      customPages: "自定义页面",
      pageEditor: "页面编辑器",
      loginNotice: "登录页公告",
      markdownPlaceholder: "支持 Markdown",
      path: "路径",
      pageTitle: "标题",
      markdownContent: "Markdown 内容",
      saveSettings: "保存网站配置",
      newPage: "新建页面",
      updatedAt: "更新时间",
      empty: "暂无自定义系统页面。",
      editPage: "编辑系统页面",
      createPage: "创建系统页面",
      urlSlug: "URL 标识",
      slugPlaceholder: "about-us",
      titlePlaceholder: "关于我们",
      slugFallback: "your-page-slug",
      savePage: "保存页面"
    },
    problemsets: {
      selectEditFirst: "请先从试卷列表选择“编辑”。",
      updated: "试卷 {id} 更新成功。",
      deleteTitle: "删除试卷",
      deleteMessage: "确认删除试卷 {id} 及其所有试题吗？",
      deleted: "试卷 {id} 已删除。",
      selectFirst: "请先勾选试卷。",
      bulkDeleteTitle: "批量删除试卷",
      bulkDeleteMessage: "将删除 {count} 个试卷及其题目，此操作不可恢复。",
      bulkDeleteConfirm: "确认删除",
      deleteFailed: "试卷 {id} 删除失败：{reason}",
      bulkDeleted: "批量删除完成：{success}/{total}",
      listAnchor: "试卷列表",
      editAnchor: "编辑试卷",
      createAnchor: "创建试卷",
      listHeading: "试卷列表",
      durationHours: "时长(小时)",
      questionCount: "题目数",
      editHeading: "编辑试卷",
      editHint: "先在试卷列表中点击“编辑”。",
      save: "保存试卷"
    },
    users: {
      selectEditFirst: "请先从用户列表选择一个用户进行编辑。",
      updated: "用户 {uid} 更新成功。",
      selectFirst: "请先勾选要操作的用户。",
      selectedCount: "当前选中：{count} 人",
      continue: "继续执行",
      operationFailed: "用户 {uid} 处理失败：{reason}",
      batchCompleted: "批量操作完成：成功 {success}/{total}。",
      batchPromoteTitle: "批量提权",
      batchPromoteMessage: "将选中用户提升为管理员。",
      batchDemoteTitle: "批量解除管理员",
      batchDemoteMessage: "将移除选中用户的管理员权限。",
      batchBanTitle: "批量封禁",
      batchBanMessage: "将封禁选中用户。",
      batchUnbanTitle: "批量解封",
      batchUnbanMessage: "将解封选中用户。",
      batchDeleteTitle: "批量删除用户",
      batchDeleteMessage: "删除后不可恢复。",
      cannotDemoteSelf: "不能解除当前登录管理员自己的权限。",
      promoted: "{uid} 已提升为管理员。",
      demoted: "{uid} 已解除管理员。",
      cannotBanSelf: "不能封禁当前登录管理员。",
      banned: "{uid} 已封禁。",
      unbanned: "{uid} 已解封。",
      listAnchor: "用户列表",
      editAnchor: "编辑用户",
      listHeading: "用户列表",
      selfHint: "提示：管理员不会封禁/删除/降权自己。",
      username: "显示名称",
      email: "邮箱",
      admin: "管理员",
      bannedLabel: "封禁",
      demote: "解除提权",
      promote: "提权",
      unban: "解封",
      ban: "封禁",
      editHeading: "编辑用户",
      editHint: "先在上面列表点击`编辑`自动带入。",
      editable: "可修改",
      save: "保存修改"
    },
    questions: {
      selectFirst: "请先勾选要删除的题目。",
      bulkDeleteTitle: "批量删除题目",
      bulkDeleteMessage: "确认删除 {count} 道题目吗？",
      bulkDeleteConfirm: "确认删除",
      deleteFailed: "题目 #{id} 删除失败：{reason}",
      bulkDeleted: "批量删除完成：{success}/{total}",
      selectProblemsetFirst: "请先选择试卷。",
      updated: "题目 #{id} 更新成功。",
      created: "题目创建成功。",
      deleteTitle: "删除题目",
      deleteMessage: "确认删除题目 #{id} 吗？",
      deleted: "题目 #{id} 已删除。",
      listAnchor: "题目列表",
      editAnchor: "编辑题目",
      heading: "题目管理",
      refreshProblemsets: "刷新试卷",
      refreshQuestions: "刷新题目",
      stem: "题干",
      score: "分值",
      answer: "答案",
      editTitle: "编辑题目 #{id}",
      createTitle: "新建题目",
      index: "题号",
      indexPlaceholder: "留空自动追加",
      questionType: "题型",
      options: "选项（每行一个，示例 A. 选项A）",
      inputPlaceholder: "输入框提示",
      answerPlaceholder: "选择题示例 A,C",
      deleteCurrent: "删除当前题目"
    },
    backup: {
      exportTitle: "导出备份",
      exportHint: "选择需要备份的数据内容，可选设置密码进行加密。",
      selectContent: "选择备份内容",
      problemsets: "试卷（含题目）",
      oauth: "OAuth 配置",
      systemPages: "系统页面",
      users: "用户",
      aiConfig: "AI 配置",
      submissions: "提交记录",
      s3Config: "S3 CDN 配置",
      adminTokens: "Admin Token",
      passwordLabel: "备份密码（可选）",
      passwordPlaceholder: "留空则不加密",
      exportBtn: "导出备份",
      exporting: "导出中…",
      exportSuccess: "备份文件已导出。",
      restoreTitle: "还原备份",
      restoreHint: "选择备份 JSON 文件，如有加密请输入密码，勾选需要还原的内容。",
      backupFile: "备份文件",
      selectedFile: "已选择",
      selectRestoreContent: "选择还原内容",
      restorePasswordPlaceholder: "加密备份请输入密码",
      restoreBtn: "还原备份",
      restoring: "还原中…",
      restoreSuccess: "备份已成功还原。",
      restoreConfirmTitle: "确认还原",
      restoreConfirmMessage: "此操作将覆盖当前数据，不可撤销。请确认是否继续？",
      noFileSelected: "请先选择备份文件。",
      invalidJson: "备份文件格式无效，无法解析 JSON。"
    }
  },
  parser: {
    blockNotClosed: "第 {line} 行开始的 :::{kind} 没有找到结束标记 :::",
    questionTypeInvalid: "第 {line} 行的题目 type 只支持 option 或 input",
    questionScoreInvalid: "第 {line} 行的题目 score 必须为正数",
    questionStemMissing: "第 {line} 行的题目缺少 [stem]...[/stem]",
    optionSectionMissing: "第 {line} 行的选择题缺少 [options answer=A]...[/options]",
    optionCountInvalid: "第 {line} 行的选择题选项数量必须在 2 到 26 之间",
    optionAnswerMissing: "第 {line} 行的选择题 answer 不能为空，例如 answer=A 或 answer=A,C",
    inputSectionMissing: "第 {line} 行的填空题缺少 [input answer=xxx placeholder=提示]...[/input]",
    inputAnswerMissing: "第 {line} 行的填空题 answer 不能为空",
    groupMaterialMissing: "第 {line} 行的 :::group 缺少 [material]...[/material]",
    groupQuestionMissing: "第 {line} 行的 :::group 下面至少要包含一道 :::question",
    groupNestedUnsupported: "第 {line} 行的 :::group 内暂不支持再嵌套 :::group",
    noQuestionParsed: "没有解析到题目，请检查配置格式。"
  },
  highlighter: {
    red: "红色荧光笔",
    yellow: "黄色荧光笔",
    green: "绿色荧光笔",
    clear: "清除"
  }
} as const;
