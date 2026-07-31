export const enUS = {
  common: {
    appName: "Luogu Saver Quiz",
    loading: "Loading...",
    loadingPage: "Page loading",
    save: "Save",
    saving: "Saving...",
    create: "Create",
    creating: "Creating...",
    update: "Update",
    delete: "Delete",
    deleting: "Deleting...",
    edit: "Edit",
    preview: "Preview",
    reset: "Reset",
    refresh: "Refresh",
    search: "Search",
    cancel: "Cancel",
    confirm: "Confirm",
    submit: "Submit",
    back: "Back",
    open: "Open",
    yes: "Yes",
    no: "No",
    minutes: "minutes",
    hours: "hours",
    points: "pts",
    questions: "questions",
    success: "Success",
    error: "Error",
    tip: "Notice",
    pleaseConfirm: "Please confirm",
    notFound: "The requested page was not found.",
    invalidUser: "Invalid user.",
    loginFirst: "Please log in first.",
    goLogin: "Go to login",
    empty: "No content",
    all: "All"
  },
  locale: {
    label: "Language",
    zhCN: "简体中文",
    enUS: "English",
    jaJP: "日本語"
  },
  feedback: {
    defaultToastTitle: "Notice"
  },
  confirm: {
    ok: "Confirm",
    cancel: "Cancel"
  },
  unsaved: {
    title: "Leave this editor?",
    message: "You have unsaved changes. Leaving or refreshing this page will discard them. Continue?",
    leave: "Leave",
    stay: "Keep editing",
    answerTitle: "Leave this attempt?",
    answerMessage: "Your latest answers may be lost if you leave or refresh now. Continue?",
    continueAnswering: "Keep answering"
  },
  layout: {
    siteTitleSuffix: "Luogu Saver Quiz",
    menu: "Menu",
    nav: {
      problemsets: "Problemsets",
      createProblemset: "Create",
      search: "Search",
      home: "Home"
    },
    navTitle: {
      problemsets: "Problemsets",
      createProblemset: "Create problemset",
      search: "Search problemsets",
      home: "Open luogu.me"
    },
    themeLabel: "Theme",
    themeAuto: "Auto",
    themeDark: "Dark",
    themeLight: "Light",
    profile: "Profile",
    settings: "Settings",
    admin: "Admin",
    logout: "Log out",
    loginOrRegister: "Log in / Sign up"
  },
  footer: {
    copyright: "2025-2026 Luogu Saver Quiz",
    developers: "Developers: Federico2903 & Murasame & quanac-lcx",
    qqGroup: "User group: 1017248143 (click to join)",
    sponsor: "Powered by Rainyun"
  },
  auth: {
    loginRegister: "Log in / Sign up",
    loginSubtitle: "Log in / Sign up",
    loginTitle: "Log in / Sign up",
    loginTipPrefix: "Use",
    loginTipSuffix: "to log in or sign up. New users will be registered automatically.",
    loginPolicyTip: "By continuing, you agree to this site's and CP OAuth's agreements, terms, and policies.",
    userAgreement: "User Agreement",
    privacyPolicy: "Privacy Policy",
    continueWithCpoauth: "Continue with CP OAuth",
    adminToken: "Admin Token",
    adminTokenInvalid: "Invalid format",
    loginWithAdminToken: "Log in with Admin Token",
    loggingIn: "Logging in...",
    callbackProcessing: "Processing CP OAuth sign-in...",
    callbackFailed: "CP OAuth sign-in failed",
    callbackTitle: "CP OAuth Sign-in",
    callbackPending: "Please wait while we redirect you...",
    callbackBack: "Back to login",
    callbackMissingTicket: "Missing ticket. Unable to complete sign-in.",
    bannedTitle: "Something went wrong",
    bannedSubtitle: "Luogu Saver Quiz / Error",
    bannedHeading: "This account has been banned",
    bannedText: "This account can no longer access the site.",
    bannedContact: "For appeals, contact: i@hiac.me"
  },
  api: {
    backendUnavailable: "Backend unavailable: {url} (start the server first)",
    forbidden: "forbidden"
  },
  systemPage: {
    title: "System Page",
    subtitle: "System Page",
    loading: "Loading page...",
    updatedAt: "Last updated: {time}",
    notFoundTitle: "404"
  },
  pageNotFound: {
    title: "404 Page Not Found",
    subtitle: "404",
    heading: "404",
    description: "This page was not found",
    goHome: "Back to Home"
  },
  userNotFound: {
    title: "User Not Found",
    subtitle: "User Not Found",
    heading: "User Not Found",
    description: "This user does not exist or has been deleted.",
    goHome: "Back to Home"
  },
  problemSetNotFound: {
    title: "Problem Set Not Found",
    subtitle: "Problem Set Not Found",
    heading: "Problem Set Not Found",
    description: "This problem set does not exist or has been removed.",
    goHome: "Back to Home"
  },
  problemset: {
    types: {
      officialPublic: "Official",
      personalFeatured: "Featured",
      personalPublic: "Public",
      personalPrivate: "Private",
      other: "Other"
    },
    common: {
      name: "Name",
      description: "Description",
      durationMinutes: "Duration (minutes)",
      type: "Visibility",
      config: "Question config",
      livePreview: "Live preview",
      questionNumber: "Question {index}",
      materialGroupWithIndex: "Material set {index}",
      materialQuestionIndex: "Material question {index}",
      subQuestion: "sub-question",
      input: "Input",
      option: "Choice",
      analysis: "Analysis:",
      answerLabel: "Answer: {answer}",
      answerPlaceholder: "Enter your answer",
      typeLabel: "Type: {type} | Score: {score}"
    },
    list: {
      title: "Problemsets",
      subtitle: "Luogu Saver Quiz / Problemsets",
      official: "Official",
      featured: "Featured",
      create: "Create problemset",
      empty: "No problemsets in this tab yet"
    },
    search: {
      title: "Search",
      subtitle: "Luogu Saver Quiz / Search",
      placeholder: "Search by problemset ID, title, description, or author",
      back: "Back to problemsets",
      searching: "Searching...",
      idle: "Type something and press Enter to search.",
      empty: "No matching official, featured, or public problemsets were found"
    },
    create: {
      title: "Create Problemset",
      subtitle: "Luogu Saver Quiz / Problemsets / Create",
      heading: "Create problemset",
      adminIdPlaceholder: "Admins can set a custom ID. Leave blank to auto-assign.",
      namePlaceholder: "Enter a name",
      descriptionPlaceholder: "For example: 25 questions including reading code, fill-in-the-blank, and multiple choice.",
      configSummary: "Config format",
      configPlaceholder: "Follow the rules above. You can also insert the template below to get familiar with the format. The content will render live.",
      previewEmpty: "Enter some config text to preview it here",
      fillTemplate: "Insert template",
      submit: "Create problemset",
      parsedCount: "{count} questions parsed",
      materialGroupCount: ", including {count} material groups",
      created: "Created successfully. Problemset ID: {id}",
      ruleTemplate: `:::group title="Read the program"
[material]
Read the program below and answer the questions.

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
If the input is \`3 4\`, what will be printed?
[/stem]
[options answer="B"]
A. 5
B. 7
C. 9
D. 11
[/options]
[analysis]
3+4=7, so the output is 7.
[/analysis]
:::

:::question type="input" score="2"
[stem]
If \`x = a + b\` is changed to \`x = a * b\`, what will be printed for input \`3 4\`?
[/stem]
[input answer="12" placeholder="Write the exact output"]
[/input]
:::
:::

:::question type="option" score="2.5"
[stem]
Question stem (Markdown / LaTeX supported)
[/stem]
[options answer="A,C"]
A. Option A
B. Option B
C. Option C
[/options]
[analysis]
This is the explanation block. You can describe the solution idea or add related notes here. Markdown and LaTeX are both supported.
[/analysis]
:::

:::question type="input" score="3"
[stem]
This is an input question stem with Markdown and LaTeX support. This sample intentionally has no explanation.
[/stem]
[input answer="42" placeholder="Optional hint for the expected format"]
[/input]
:::`,
      rules: {
        item1: "Wrap each question with :::question at the start and ::: at the end.",
        item2: "Place the stem inside [stem]...[/stem]. Markdown, LaTeX, and code blocks are supported.",
        item3: "Multiple choice: wrap all options with [options answer=\"A,C\"]...[/options], one per line (e.g. A. option text), up to 26.",
        item4: "Fill-in-the-blank: use [input answer=\"answer\" placeholder=\"hint\"][/input]. The placeholder is optional.",
        item5: "Explanation (optional): wrap with [analysis]...[/analysis]. Markdown and LaTeX are supported.",
        item6: "Material group: wrap with :::group title=\"Title\", place shared material inside [material]...[/material], then add :::question blocks.",
        item7: "A single :::group can contain multiple :::question blocks, ideal for reading-code or fill-in-code tasks.",
        item8: "Nested :::group inside :::group is not supported."
      },
      aiGenSummary: "AI-assisted generation",
      aiGenTip: "You can use AI to conveniently create formatted question configs. See the tutorial at",
      aiGenLinkText: "this page",
      errors: {
        titleRequired: "Please enter a name.",
        descriptionRequired: "Please enter a description.",
        durationInvalid: "Duration must be a positive number.",
        configRequired: "Please enter the question config.",
        idInvalid: "ID must be a positive integer."
      }
    },
    edit: {
      title: "Edit Problemset",
      subtitle: "Luogu Saver Quiz / Problemsets / Edit",
      heading: "Edit problemset",
      loading: "Loading problemset",
      save: "Save changes",
      deleteButton: "Delete problemset",
      updated: "Updated successfully.",
      deleteTitle: "Delete problemset",
      deleteMessage: "Delete this problemset permanently? This cannot be undone.",
      deleteConfirm: "Delete",
      idLabel: "Unique identifier (ID)",
      previewEmpty: "Your config will render here in real time."
    },
    detail: {
      pageTitleFallback: "Problemsets {id}",
      sharedMaterial: "Shared material",
      subtitle: "Luogu Saver Quiz / Problemsets / Detail",
      loading: "Loading problemset",
      exam: "Timed exam",
      training: "Free practice",
      edit: "Edit problemset",
      questionCount: "Questions",
      duration: "Duration",
      tabs: {
        description: "Description",
        question: "Questions",
        history: "History"
      },
      inputPreview: "Input preview",
      score: "Score: {score}",
      showAnswer: "Show answer and analysis",
      hideAnswer: "Hide answer and analysis",
      yourAnswer: "Your answer: {answer}",
      emptyAnswer: "(empty)",
      earned: "Score: {earned} / {score}",
      showAnalysis: "Show analysis",
      hideAnalysis: "Hide analysis",
      noHistory: "No history yet.",
      submittedAt: "Submitted at {time}",
      recentSubmissions: "Recent submissions",
      expand: "Expand",
      collapse: "Collapse",
      questionList: "Question list",
      conflictMessage: "{id} - {title} is already in progress. Start a new timed exam and discard the previous state? You can also resume it from your profile.",
      forceStart: "Discard and start new exam"
    },
    mode: {
      exam: "Timed exam",
      training: "Free practice",
      loading: "Loading questions",
      restoredDraft: "Recovered the local autosave draft.",
      activeExamConflict: "A timed exam is already in progress. Please resume it from your profile first.",
      submitTitle: "Submit now?",
      submitMessage: "Submitting will save the record and reveal the explanations. Continue?",
      submitConfirm: "Submit",
      submitCancel: "Review once more",
      localExamScored: "Scored locally. Sign in to save the submission history.",
      examSubmitted: "Submitted successfully. A history record has been created.",
      localTrainingScored: "Scored locally. Sign in to save the practice record.",
      trainingSaved: "Practice record saved.",
      guestTitle: "You are not signed in",
      guestMessage: "You are answering in guest mode. Scores will not be saved to your profile, and you will not be able to view history or use AI hints and explanations.",
      noticePrefix: "The countdown starts when the exam begins. You can pause during the exam, and your answers will autosave locally and to the cloud at intervals (",
      noticeLink: "configure autosave interval here",
      noticeSuffix: "). If you refresh or close the page accidentally, you can resume it from your profile.",
      correct: "Correct",
      wrong: "Incorrect",
      remainingTime: "Remaining time",
      answered: "Answered",
      correctCount: "Correct",
      score: "Score",
      pause: "Pause",
      submitNow: "Submit",
      submitAndView: "Submit and view result",
      saveTraining: "Save practice record"
    },
    ai: {
      modelLabel: "AI Model",
      longPressHint: "{seconds}s",
      panelTitle: "{question}",
      hintOption: "View AI hint",
      solutionOption: "View AI solution",
      hintTitle: "AI Hint",
      solutionTitle: "AI Solution",
      pendingTitle: "Warning",
      pendingContent: "Are you sure you want to view this? It is recommended to think a bit longer first. All content is AI-generated and provided without any guarantee.",
      confirmHintTitle: "View hint?",
      confirmSolutionTitle: "View solution?",
      confirmMessage: "Are you sure you want to view this? It is recommended to think a bit longer first. All content is AI-generated and provided without any guarantee.",
      confirmWait: "Wait {seconds} seconds",
      confirmNow: "Continue",
      hintIntro: "Here is a hint for {question}:",
      hintOptionStep1: "Extract the question conditions first, then check whether each option satisfies them.",
      hintOptionStep2: "If multiple options seem correct, eliminate the ones that conflict with the prompt first.",
      hintOptionStep3: "Before finalizing, substitute your conclusion back into the conditions once more.",
      hintInputStep1: "Write down the intermediate value or relation you need to compute first.",
      hintInputStep2: "Format your answer exactly as required, including letter case and spaces.",
      hintInputStep3: "Test boundary cases to ensure nothing is missing.",
      hintStemFocus: "You can start from this key part of the prompt: {stem}",
      hintNoStem: "question content",
      solutionIntro: "Here is a reference solution for {question}:",
      solutionAnswerLine: "Standard answer: {answer}",
      solutionYourAnswerLine: "Your answer: {answer}",
      solutionCorrectnessLine: "Result: {value}",
      solutionScoreLine: "Score: {earned} / {score}",
      solutionAnalysisTitle: "Analysis:",
      solutionAnalysisFallback: "No analysis is available. It is recommended to review the prompt together with the standard answer."
    }
  },
  profile: {
    title: "Profile - {uid}",
    subtitle: "Luogu Saver Quiz / Profile",
    records: "Records",
    problemsets: "Problemsets",
    loading: "Loading user profile...",
    activeExam: "Currently active:",
    resumeExam: "Resume this exam",
    loadingRecords: "Loading records...",
    noSubmissions: "No submissions yet.",
    problemsetFallback: "Problemset {id}",
    viewSubmission: "View submission",
    recordsHidden: "This user has hidden their practice records.",
    banned: "This user has been banned.",
    bio: "Bio",
    bioEmpty: "This user has not written a bio yet.",
    modeExam: "Timed exam",
    modeTraining: "Practice"
  },
  settings: {
    title: "Settings",
    subtitle: "Luogu Saver Quiz / Account settings",
    loading: "Loading settings",
    saved: "Settings saved.",
    noticeTitle: "Note",
    noticePrefix: "Remember to click Save Settings below. To change your avatar, display name, or bio, visit ",
    noticeLink: "this page",
    noticeSuffix: " and then sign in again to sync the updates.",
    recordsPublic: "Make practice records public",
    public: "Public",
    private: "Only visible to you and admins",
    analysisMode: "Submission analysis expansion",
    analysisWrongOnly: "Expand explanations for wrong answers only",
    analysisNone: "Do not expand any explanation",
    analysisAll: "Expand all explanations",
    analysisDesc: "Applies to the submission detail page (/problemset/:id?submission=:sid).",
    autosaveTitle: "Autosave interval",
    autosaveDesc: "Used for local and cloud autosave recovery in timed exams and free practice. This means you can restore your answers even after switching browsers or devices, as long as you sign in to the same account.",
    aiModelTitle: "Default AI model",
    aiModelDesc: "Used for AI hints and solutions.",
    aiQuotaLimited: "{remaining} / {limit} left today, {used} used",
    aiQuotaUnlimited: "{used} used today, unlimited",
    coverUrl: "Profile cover URL",
    coverPlaceholder: "Leave empty to use the default cover",
    highlighterTitle: "Highlighter toolbar",
    highlighterDesc: "Show the highlighter floating toolbar when selecting text in question content.",
    highlighterShow: "Show",
    highlighterHide: "Hide",
    coverDesc: "Only http(s) URLs are supported.",
    clearCover: "Clear cover image",
    save: "Save settings",
    autosave: {
      "30": "30 seconds",
      "60": "60 seconds",
      "120": "120 seconds",
      "300": "5 minutes",
      "600": "10 minutes",
      off: "Disabled"
    }
  },
  admin: {
    subtitle: "Luogu Saver Quiz / Admin",
    menu: "Admin menu",
    noPermission: "Insufficient permissions",
    nav: {
      users: "Users",
      problemsets: "Problemsets",
      questions: "Questions",
      oauth: "OAuth",
      systemPages: "System Pages",
      backup: "Backup & Restore"
    },
    titles: {
      users: "Admin / Users",
      problemsets: "Admin / Problemsets",
      questions: "Admin / Questions",
      oauth: "Admin / OAuth",
      systemPages: "Admin / System Pages",
      backup: "Admin / Backup & Restore"
    },
    common: {
      select: "Select",
      actions: "Actions",
      selectAll: "Select all",
      clearSelection: "Clear selection",
      bulkDelete: "Bulk delete"
    },
    oauth: {
      saved: "OAuth config saved.",
      tokenCreated: "Created admin token: {token}",
      tokenDeleted: "Admin token deleted.",
      configAnchor: "CP OAuth",
      tokenAnchor: "Admin Token",
      configHeading: "CP OAuth Config",
      configHint: "Configure the OAuth platform callback URL to match the callbackUrl entered here.",
      clientIdPlaceholder: "Enter Client ID",
      clientSecretPlaceholder: "Enter Client Secret",
      save: "Save config",
      creatingToken: "Creating...",
      createToken: "Create token",
      tokenHint: "Keep at most 2 tokens. Each token is 32 characters long and case-sensitive.",
      createdBy: "Created by",
      createdAt: "Created at",
      noTokens: "No tokens yet"
    },
    ai: {
      saved: "AI config saved.",
      configAnchor: "AI Config",
      configHeading: "AI Config",
      configHint: "Configure OpenAI-compatible Chat Completions models, secrets, and prompts. User-facing settings only expose enabled model names.",
      addModel: "Add model",
      systemDefaultModel: "System default model",
      promptsTitle: "Prompt settings",
      hintSystemPrompt: "Hint system prompt",
      solutionSystemPrompt: "Solution system prompt",
      hintUserPrompt: "Hint user prompt",
      solutionUserPrompt: "Solution user prompt",
      enabled: "Enabled",
      name: "Name",
      baseUrl: "Base URL",
      model: "Model",
      secret: "Secret",
      dailyLimit: "Daily limit",
      defaultModelName: "Default model",
      modelNameFallback: "Model {index}"
    },
    systemPages: {
      settingsSaved: "System page settings saved.",
      updated: "System page updated.",
      created: "System page created.",
      deleted: "System page deleted.",
      deleteTitle: "Delete system page",
      deleteMessage: "Delete \"{title}\"? Its URL will stop working after removal.",
      siteSettings: "Site Settings",
      customPages: "Custom Pages",
      pageEditor: "Page Editor",
      loginNotice: "Login Page Notice",
      markdownPlaceholder: "Markdown supported",
      path: "Path",
      pageTitle: "Title",
      markdownContent: "Markdown Content",
      saveSettings: "Save Site Settings",
      newPage: "New Page",
      updatedAt: "Updated At",
      empty: "No custom system pages yet.",
      editPage: "Edit System Page",
      createPage: "Create System Page",
      urlSlug: "URL Slug",
      slugPlaceholder: "about-us",
      titlePlaceholder: "About Us",
      slugFallback: "your-page-slug",
      savePage: "Save Page"
    },
    problemsets: {
      selectEditFirst: "Choose a problemset from the list before editing.",
      updated: "Problemset {id} updated.",
      deleteTitle: "Delete problemset",
      deleteMessage: "Delete problemset {id} and all of its questions?",
      deleted: "Problemset {id} deleted.",
      selectFirst: "Select at least one problemset first.",
      bulkDeleteTitle: "Bulk delete problemsets",
      bulkDeleteMessage: "Delete {count} problemsets and all of their questions? This cannot be undone.",
      bulkDeleteConfirm: "Delete selected",
      deleteFailed: "Failed to delete problemset {id}: {reason}",
      bulkDeleted: "Bulk delete finished: {success}/{total}",
      listAnchor: "Problemset list",
      editAnchor: "Edit problemset",
      createAnchor: "Create problemset",
      listHeading: "Problemset list",
      durationHours: "Duration (hours)",
      questionCount: "Questions",
      editHeading: "Edit problemset",
      editHint: "Click Edit in the list above to load a problemset here.",
      save: "Save problemset"
    },
    users: {
      selectEditFirst: "Choose a user from the list before editing.",
      updated: "User {uid} updated.",
      selectFirst: "Select at least one user first.",
      selectedCount: "Selected: {count}",
      continue: "Continue",
      operationFailed: "Failed to process user {uid}: {reason}",
      batchCompleted: "Batch completed: {success}/{total} succeeded.",
      batchPromoteTitle: "Promote selected",
      batchPromoteMessage: "Promote the selected users to admins.",
      batchDemoteTitle: "Demote selected",
      batchDemoteMessage: "Remove admin privileges from the selected users.",
      batchBanTitle: "Ban selected",
      batchBanMessage: "Ban the selected users.",
      batchUnbanTitle: "Unban selected",
      batchUnbanMessage: "Unban the selected users.",
      batchDeleteTitle: "Delete selected",
      batchDeleteMessage: "Delete the selected users permanently.",
      cannotDemoteSelf: "You cannot remove admin privileges from the current admin account.",
      promoted: "{uid} is now an admin.",
      demoted: "{uid} is no longer an admin.",
      cannotBanSelf: "You cannot ban the current admin account.",
      banned: "{uid} has been banned.",
      unbanned: "{uid} has been unbanned.",
      listAnchor: "User list",
      editAnchor: "Edit user",
      listHeading: "User list",
      selfHint: "Admins will not ban, delete, or demote themselves.",
      username: "Display name",
      email: "Email",
      admin: "Admin",
      bannedLabel: "Banned",
      demote: "Demote",
      promote: "Promote",
      unban: "Unban",
      ban: "Ban",
      editHeading: "Edit user",
      editHint: "Click Edit in the list above to populate this form.",
      editable: "Editable",
      save: "Save changes"
    },
    questions: {
      selectFirst: "Select at least one question first.",
      bulkDeleteTitle: "Bulk delete questions",
      bulkDeleteMessage: "Delete {count} questions?",
      bulkDeleteConfirm: "Delete selected",
      deleteFailed: "Failed to delete question #{id}: {reason}",
      bulkDeleted: "Bulk delete finished: {success}/{total}",
      selectProblemsetFirst: "Choose a problemset first.",
      updated: "Question #{id} updated.",
      created: "Question created.",
      deleteTitle: "Delete question",
      deleteMessage: "Delete question #{id}?",
      deleted: "Question #{id} deleted.",
      listAnchor: "Question list",
      editAnchor: "Edit question",
      heading: "Question manager",
      refreshProblemsets: "Refresh problemsets",
      refreshQuestions: "Refresh questions",
      stem: "Stem",
      score: "Score",
      answer: "Answer",
      editTitle: "Edit question #{id}",
      createTitle: "Create question",
      index: "Index",
      indexPlaceholder: "Leave empty to append automatically",
      questionType: "Question type",
      options: "Choices (one per line, e.g. A. Option A)",
      inputPlaceholder: "Input placeholder",
      answerPlaceholder: "For choice questions, e.g. A,C",
      deleteCurrent: "Delete current question"
    },
    backup: {
      exportTitle: "Export Backup",
      exportHint: "Select data to back up. Optionally set a password for encryption.",
      selectContent: "Select content to back up",
      problemsets: "Problemsets (with questions)",
      oauth: "OAuth Config",
      systemPages: "System Pages",
      users: "Users",
      aiConfig: "AI Config",
      submissions: "Submissions",
      adminTokens: "Admin Tokens",
      passwordLabel: "Backup password (optional)",
      passwordPlaceholder: "Leave empty for no encryption",
      exportBtn: "Export Backup",
      exporting: "Exporting…",
      exportSuccess: "Backup exported successfully.",
      restoreTitle: "Restore Backup",
      restoreHint: "Select a backup JSON file. Enter password if encrypted. Choose content to restore.",
      backupFile: "Backup file",
      selectedFile: "Selected",
      selectRestoreContent: "Select content to restore",
      restorePasswordPlaceholder: "Enter password for encrypted backup",
      restoreBtn: "Restore Backup",
      restoring: "Restoring…",
      restoreSuccess: "Backup restored successfully.",
      restoreConfirmTitle: "Confirm Restore",
      restoreConfirmMessage: "This will overwrite current data and cannot be undone. Continue?",
      noFileSelected: "Please select a backup file first.",
      invalidJson: "Invalid backup file format. Unable to parse JSON."
    }
  },
  parser: {
    blockNotClosed: "The block starting at line {line} with :::{kind} is missing a closing ::: marker",
    questionTypeInvalid: "Question at line {line} only supports type=option or type=input",
    questionScoreInvalid: "Question at line {line} must have a positive score",
    questionStemMissing: "Question at line {line} is missing [stem]...[/stem]",
    optionSectionMissing: "Option question at line {line} is missing [options answer=A]...[/options]",
    optionCountInvalid: "Option question at line {line} must have between 2 and 26 choices",
    optionAnswerMissing: "Option question at line {line} needs a non-empty answer, such as answer=A or answer=A,C",
    inputSectionMissing: "Input question at line {line} is missing [input answer=xxx placeholder=hint]...[/input]",
    inputAnswerMissing: "Input question at line {line} needs a non-empty answer",
    groupMaterialMissing: ":::group at line {line} is missing [material]...[/material]",
    groupQuestionMissing: ":::group at line {line} must contain at least one :::question",
    groupNestedUnsupported: "Nested :::group blocks are not supported inside the :::group at line {line}",
    noQuestionParsed: "No questions were parsed. Please check the config format."
  },
  highlighter: {
    red: "Red highlighter",
    yellow: "Yellow highlighter",
    green: "Green highlighter",
    clear: "Clear"
  }
} as const;
