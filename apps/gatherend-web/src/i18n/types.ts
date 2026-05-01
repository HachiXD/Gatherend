// Supported locales
export type Locale = "en" | "es";

export const SUPPORTED_LOCALES: Locale[] = ["en", "es"];
export const DEFAULT_LOCALE: Locale = "en";

// Language display names
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

// Type for nested translation keys
export type TranslationKeys = {
  // Common UI elements
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    close: string;
    loading: string;
    error: string;
    success: string;
    confirm: string;
    back: string;
    next: string;
    search: string;
    settings: string;
    profile: string;
    logout: string;
    login: string;
    signUp: string;
    or: string;
    and: string;
    yes: string;
    no: string;
    none: string;
    all: string;
    select: string;
    selected: string;
    optional: string;
    required: string;
    uploading: string;
    online: string;
    offline: string;
    members: string;
    member: string;
    uploadBoardImage: string;
    uploadFile: string;
  };

  // Navigation
  navigation: {
    discovery: string;
    boards: string;
    directMessages: string;
    createBoard: string;
    joinBoard: string;
    home: string;
  };

  // Profile settings
  profile: {
    title: string;
    subtitle: string;
    username: string;
    usernamePlaceholder: string;
    identifier: string;
    color: string;
    style: string;
    styleNormal: string;
    styleBold: string;
    styleItalic: string;
    aboutMe: string;
    aboutMePlaceholder: string;
    badgeText: string;
    badgePlaceholder: string;
    badgeSticker: string;
    selectedSticker: string;
    noStickers: string;
    loadingStickers: string;
    uploading: string;
    languages: string;
    mainLanguage: string;
    mainLanguageDescription: string;
    secondaryLanguages: string;
    secondaryLanguagesDescription: string;
    addLanguage: string;
    languagesDescription: string;
    accountInfo: string;
    email: string;
    userId: string;
    profileDetails: string;
    saveChanges: string;
    saving: string;
    updateSuccess: string;
    updateError: string;
    selectAtLeastOneLanguage: string;
    editAvatar: string;
  };

  // Board related
  board: {
    create: string;
    join: string;
    leave: string;
    delete: string;
    settings: string;
    invite: string;
    members: string;
    channels: string;
    boardChats: (boardName: string) => string;
    textChannels: string;
    voiceChannels: string;
    createChannel: string;
    deleteChannel: string;
    editChannel: string;
    general: string;
    welcome: string;
    description: string;
    noBoards: string;
    joinedBoards: string;
    publicBoards: string;
    privateBoards: string;
    memberCount: string;
    maxMembers: string;
    slots: string;
    availableSlots: string;
    fullBoard: string;
    // Dropdown menu
    invitePeople: string;
    boardSettings: string;
    createCategory: string;
    createRoom: string;
    leaveBoard: string;
  };

  // Chat/Messages
  chat: {
    sendMessage: string;
    messagePlaceholder: string;
    messagePlaceholderShort: string;
    editMessage: string;
    deleteMessage: string;
    replyTo: string;
    pinMessage: string;
    unpinMessage: string;
    pinnedMessages: string;
    noPinnedMessages: string;
    reactions: string;
    addReaction: string;
    typeMessage: string;
    noMessages: string;
    loadingMessages: string;
    messageDeleted: string;
    messageEdited: string;
    today: string;
    yesterday: string;
    sentAt: string;
    replyingTo: string;
    sticker: string;
    file: string;
    image: string;
    pdf: string;
    pressEnterToSend: string;
    message: string;
    reply: string;
    edit: string;
    delete: string;
    addToCollection: string;
    more: string;
    reportMessage: string;
    retrying: string;
    retry: string;
    editedMessagePlaceholder: string;
    cancel: string;
    save: string;
    escToCancelEnterToSave: string;
    // Welcome messages
    welcomeTo: string;
    welcomeJoined: string;
    welcomeHopeGoodTime: string;
    greetingsThisIs: string;
    hopeGreatTimeIn: string;
    shareAndEnjoy: string;
    wishingGreatConversation: string;
    // Video call
    startVoiceCall: string;
    endVoiceCall: string;
    // Attachments
    oneAttachmentAtATime: string;
    uploadInProgress: string;
    uploadTooLarge: string;
    uploadFailed: string;
    sendFailed: string;
    onlyFirstImageUsed: string;
    deletedMember: string;
  };

  // Emoji Picker
  emojiPicker: {
    search: string;
    smileys: string;
    people: string;
    animals: string;
    food: string;
    travel: string;
    activities: string;
    objects: string;
    symbols: string;
    flags: string;
    recent: string;
  };

  // Direct messages
  dm: {
    title: string;
    newConversation: string;
    noConversations: string;
    startConversation: string;
    searchUsers: string;
    selectUser: string;
    // Rightbar
    social: string;
    addFriend: string;
    noActiveConversations: string;
    noMessagesYet: string;
    messageDeleted: string;
    sentAFile: string;
    deleteConversation: string;
  };

  // Board rightbar
  rightbar: {
    members: string;
  };

  // Discovery
  discovery: {
    title: string;
    subtitle: string;
    exploreBoards: string;
    recommended: string;
    trending: string;
    newest: string;
    searchBoards: string;
    noResults: string;
    filters: string;
    language: string;
    category: string;
    sortBy: string;
    meetNewFriends: string;
    // Feed
    searching: string;
    loadMore: string;
    noResultsFound: string;
    newBoards: string;
    refresh: string;
    // Board card
    reportBoard: string;
    reportCommunity: string;
    noDescriptionAvailable: string;
    joining: string;
    join: string;
    noBoardsFoundMatching: string;
    somethingWentWrong: string;
  };

  posts: {
    imagePreviewTitle: string;
    refreshPosts: string;
    noPostsInCommunity: string;
    pinned: string;
    closed: string;
    editPost: string;
    deletePost: string;
    reportPost: string;
    editPostPlaceholder: string;
    editCommentPlaceholder: string;
    writeCommentPlaceholder: string;
    attachImage: string;
    removeImage: string;
    commentAttachmentAlt: string;
    commentImageAlt: string;
    sendComment: string;
    publish: string;
    publishing: string;
    uploadImage: string;
    uploadingImage: string;
    postTitlePlaceholder: string;
    postContentPlaceholder: string;
    escToCancelCtrlEnterToSave: string;
    escToCancelCtrlEnterToSend: string;
    escToCancelCtrlEnterToPublish: string;
    replyToOriginalPoster: string;
    deletedComment: string;
    deletedCommentInline: string;
    openCommentActions: string;
    reportComment: string;
    loadingComments: string;
    hideOmittedComments: string;
    expandOmittedComments: (count: number) => string;
    publishSuccess: string;
    publishError: string;
    pasteImageUploadError: string;
    uploadImageError: (error: string) => string;
  };

  // Voice/Media
  voice: {
    joinVoice: string;
    leaveVoice: string;
    mute: string;
    unmute: string;
    deafen: string;
    undeafen: string;
    screenShare: string;
    stopScreenShare: string;
    camera: string;
    stopCamera: string;
    inVoiceChannel: string;
    connecting: string;
    connected: string;
    disconnected: string;
    maximize: string;
    minimize: string;
    leaveCall: string;
    cancelConnection: string;
    loadingVoiceChannel: string;
    noOneHere: string;
    beFirstToJoin: string;
    joinCall: string;
    maxPresentersReached: string;
    reconnecting: string;
  };

  // Overlays
  overlays: {
    boardSettings: {
      title: string;
      tabs: {
        general: string;
        members: string;
        bans: string;
        history: string;
        dangerZone: string;
      };
      general: {
        title: string;
        subtitle: string;

        bumpButton: string;
        bumpSuccess: string;
        bumpError: string;
        bumpCooldown: string;
        bumping: string;

        boardNameLabel: string;
        boardNamePlaceholder: string;

        tagLabel: string;
        tagPlaceholder: string;

        descriptionLabel: string;
        descriptionPlaceholder: string;

        discoverySeatsLabel: string;
        discoverySeatsDescription: string;

        inviteSeatsLabel: string;
        inviteSeatsDescription: string;

        saveChanges: string;
        saving: string;

        updateSuccess: string;
        updateError: string;
        moderationErrorDescription: string;
      };

      members: {
        title: string;
        roleLabel: string;
        actions: string;
        kick: string;
        ban: string;
        warn: string;
        removeWarning: string;
        warnSuccess: string;
        warnError: string;
        removeWarningSuccess: string;
        removeWarningError: string;
        autoBanTriggered: string;
        roles: {
          guest: string;
          moderator: string;
          admin: string;
        };
      };

      bans: {
        title: string;
        loading: string;
        user: string;
        users: string;
        bannedFromThisBoard: string;
        emptyTitle: string;
        emptyDescription: string;
        bannedOn: string;
        autoBanLabel: string;
        manualBanLabel: string;
        autoBanDescription: string;
        manualBanDescription: string;
        unban: string;
        unbanSuccess: string;
        unbanError: string;
      };

      history: {
        title: string;
        loading: string;
        entry: string;
        entries: string;
        emptyTitle: string;
        emptyDescription: string;
        actions: {
          warning: string;
          removeWarning: string;
          ban: string;
          unban: string;
          kick: string;
          autoBan: string;
          autoUnban: string;
        };
        descriptions: {
          warning: string;
          removeWarning: string;
          ban: string;
          unban: string;
          kick: string;
          autoBan: string;
          autoUnban: string;
        };
      };

      dangerZone: {
        title: string;
        subtitle: string;
        deleteSectionTitle: string;
        deleteSectionDescription: string;
        deleteBoardButton: string;
        confirmTitle: string;
        confirmQuestion: string;
        confirmWillBeDeleted: string;
        deleting: string;
        deleteSuccess: string;
        deleteError: string;
      };
    };
    profileSettings: {
      title: string;
      tabs: {
        profile: string;
      };
    };
    userSettings: {
      title: string;
      tabs: {
        account: string;
        logout: string;
        dangerZone: string;
      };
      account: {
        title: string;
        subtitle: string;
        redirecting: string;
      };
      logout: {
        title: string;
        subtitle: string;
        signOut: string;
        signOutDescription: string;
        logOutButton: string;
        signingOut: string;
        logoutSuccess: string;
        logoutError: string;
        note: string;
        noteText: string;
      };
      dangerZone: {
        title: string;
        subtitle: string;
        warning: string;
        deleteSectionTitle: string;
        deleteSectionDescription: string;
        deleteAccount: string;
        confirmTitle: string;
        confirmQuestion: string;
        confirmWillBeDeleted: string;
        deleting: string;
        deletingAccount: string;
        deleteSuccess: string;
        deleteError: string;
      };
    };
  };

  // Modals
  modals: {
    createBoard: {
      title: string;
      nameLabel: string;
      namePlaceholder: string;
      descriptionLabel: string;
      descriptionPlaceholder: string;
      createButton: string;
      subtitle: string;
      tagLabel: string;
      tagPlaceholder: string;
      tellUsMore: string;
      publicSeats: string;
      publicSeatsDescription: string;
      inviteSeats: string;
      inviteSeatsDescription: string;
      publicOptionLabel: string;
      privateOptionLabel: string;

      success: string;
      error: string;
      moderationError: string;
    };
    deleteBoard: {
      title: string;
      description: string;
      willBeDeleted: string;
      confirmButton: string;
    };
    leaveBoard: {
      title: string;
      description: string;
      confirmButton: string;
    };
    invite: {
      title: string;
      description: string;
      inviteEnabledLabel: string;
      boardInviteLinkLabel: string;
      copyLink: string;
      linkCopied: string;
      expiresIn: string;
      generateNewLink: string;
    };
    createChannel: {
      title: string;
      nameLabel: string;
      namePlaceholder: string;
      typeLabel: string;
      text: string;
      voice: string;
      create: string;
      success: string;
      error: string;
      nameRequired: string;
    };
    editChannel: {
      title: string;
      nameLabel: string;
      namePlaceholder: string;
      typeLabel: string;
      text: string;
      voice: string;
      success: string;
      error: string;
    };
    deleteChannel: {
      title: string;
      description: string;
      willBeDeleted: string;
    };
    deleteMessage: {
      title: string;
      description: string;
      willBeDeleted: string;
      confirmButton: string;
    };
    deleteCategory: {
      title: string;
      description: string;
      willBeDeleted: string;
    };
    deleteCommunityPost: {
      title: string;
      description: string;
      willBeDeleted: string;
    };
    deleteCommunityPostComment: {
      title: string;
      description: string;
      willBeDeleted: string;
    };
    createCategory: {
      title: string;
      nameLabel: string;
      namePlaceholder: string;
      nameRequired: string;
      nameTooLong: string;
    };
    editCategory: {
      title: string;
      nameLabel: string;
      namePlaceholder: string;
      nameRequired: string;
      nameTooLong: string;
    };
    editBoard: {
      title: string;
      subtitle: string;
      nameLabel: string;
      namePlaceholder: string;
      nameRequired: string;
      imageRequired: string;
    };
    members: {
      title: string;
      membersCount: string;
      role: string;
      guest: string;
      moderator: string;
      kick: string;
    };
    messageFile: {
      title: string;
      subtitle: string;
      attachmentRequired: string;
    };
    pinnedMessages: {
      title: string;
      messageCount: string;
      noMessages: string;
    };
    addFriend: {
      title: string;
      subtitle: string;
      inputLabel: string;
      inputPlaceholder: string;
      sendRequest: string;
      sending: string;
      pendingRequests: string;
      noPendingRequests: string;
      accept: string;
      reject: string;
      enterUsername: string;
      loading: string;
      close: string;
    };
    theme: {
      title: string;
      baseColor: string;
      themeMode: string;
      dark: string;
      light: string;
      gradient: string;
      useGradient: string;
      gradientType: string;
      linear: string;
      radial: string;
      gradientAngle: string;
      gradientColors: string;
      addColor: string;
      presets: string;
      resetToDefault: string;
      saving: string;
      saveSuccess: string;
      saveError: string;
      preview: string;
      cancel: string;
      save: string;
      reset: string;
      mode: string;
      colors: string;
      angle: string;
      type: string;
    };
    myCommunities: {
      title: string;
      searchPlaceholder: string;
      noResults: string;
      noCommunities: string;
      memberOf: string;
      community: string;
      communities: string;
    };
    report: {
      reportBoard: string;
      reportUser: string;
      reportMessage: string;
      reportCommunity: string;
      reportCommunityPost: string;
      reportCommunityPostComment: string;
      reportBoardDescription: string;
      reportUserDescription: string;
      reportMessageDescription: string;
      reportCommunityDescription: string;
      reportCommunityPostDescription: (author: string) => string;
      reportCommunityPostCommentDescription: (author: string) => string;
      selectCategory: string;
      whyReporting: string;
      additionalDetails: string;
      additionalDetailsPlaceholder: string;
      submit: string;
      submitting: string;
      success: string;
      successMessage: string;
      error: string;
      cancel: string;
      boardPreview: string;
      messagePreview: string;
      userBeingReported: string;
      communityPreview: string;
      postPreview: string;
      commentPreview: string;
      imageOnlyPost: string;
      imageOnlyComment: string;
      noContent: string;
      unknownAuthor: string;
      categories: {
        childSafety: string;
        childSafetyDescription: string;
        childSafetyMessageDescription: string;
        childSafetyProfileDescription: string;
        childSafetyPostDescription: string;
        childSafetyCommentDescription: string;
        sexualContent: string;
        sexualContentDescription: string;
        sexualContentMessageDescription: string;
        sexualContentProfileDescription: string;
        sexualContentPostDescription: string;
        sexualContentCommentDescription: string;
        harassment: string;
        harassmentDescription: string;
        harassmentMessageDescription: string;
        harassmentProfileDescription: string;
        harassmentPostDescription: string;
        harassmentCommentDescription: string;
        hateSpeech: string;
        hateSpeechDescription: string;
        hateSpeechMessageDescription: string;
        hateSpeechProfileDescription: string;
        hateSpeechPostDescription: string;
        hateSpeechCommentDescription: string;
        spam: string;
        spamDescription: string;
        spamMessageDescription: string;
        spamProfileDescription: string;
        spamPostDescription: string;
        spamCommentDescription: string;
        impersonation: string;
        impersonationDescription: string;
        impersonationMessageDescription: string;
        impersonationProfileDescription: string;
        impersonationPostDescription: string;
        impersonationCommentDescription: string;
        other: string;
        otherDescription: string;
        otherMessageDescription: string;
        otherProfileDescription: string;
        otherPostDescription: string;
        otherCommentDescription: string;
      };
    };
  };

  // Errors and validations
  errors: {
    somethingWentWrong: string;
    networkError: string;
    unauthorized: string;
    notFound: string;
    validationError: string;
    fileTooBig: string;
    invalidFileType: string;
    uploadFailed: string;
    usernameTooShort: string;
    usernameTooLong: string;
    invalidUsername: string;
    descriptionTooLong: string;
    badgeTooLong: string;
  };

  // Tooltips
  tooltips: {
    directMessages: string;
    addBoard: string;
    discoverBoards: string;
    userSettings: string;
    notifications: string;
    search: string;
    moreOptions: string;
    sendMessage: string;
    attachFile: string;
    addEmoji: string;
    addSticker: string;
  };

  // Moderation
  moderation: {
    dashboard: string;
    reports: string;
    history: string;
    bannedUsers: string;
    userLookup: string;
    boardLookup: string;
    pendingInvestigations: string;
    stats: string;
    warnings: string;
    strikes: string;
    kick: string;
    ban: string;
    unban: string;
    warn: string;
    mute: string;
    unmute: string;
    reason: string;
    duration: string;
    permanent: string;
    moderationLog: string;
    noReports: string;
    reportsSubtitle: string;
    reportsQueueEmptyDescription: string;
    reportUser: string;
    reportMessage: string;
    reportReason: string;
    historySubtitle: string;
    noHistory: string;
    historyEmptyDescription: string;
    warning: string;
    removeWarning: string;
    strike: string;
    removeStrike: string;
    clearStrikes: string;
    note: string;
    autoBan: string;
    autoUnban: string;
    autoBanDescription: string;
    autoUnbanDescription: string;
    unknownAdmin: string;
    unknownUser: string;
    warningStatus: string;
    bannedUsersSubtitle: string;
    totalBannedUsers: string;
    noBannedUsers: string;
    noBannedUsersDescription: string;
    noReasonProvided: string;
    bannedOn: string;
    unbanSuccess: string;
    unbanError: string;
  };

  // Time
  time: {
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
    weeksAgo: string;
    monthsAgo: string;
    yearsAgo: string;
  };

  // Status
  status: {
    online: string;
    idle: string;
    doNotDisturb: string;
    invisible: string;
    offline: string;
  };

  // Socket indicator
  socketIndicator: {
    fallbackPolling: string;
    liveUpdates: string;
  };

  // Theme toggle
  theme: {
    toggle: string;
    light: string;
    dark: string;
    system: string;
  };

  // User menu
  userMenu: {
    you: string;
    personalizeProfile: string;
    opening: string;
    sendPrivateMessage: string;
    more: string;
    reportUser: string;
    profile: string;
    myTheme: string;
    myCommunities: string;
    userMenuLabel: string;
  };

  // Auth
  auth: {
    // Common
    email: string;
    password: string;
    enterYourEmail: string;
    enterYourPassword: string;
    orContinueWith: string;
    google: string;
    discord: string;
    // Sign In
    welcomeBack: string;
    signInToContinue: string;
    signIn: string;
    dontHaveAccount: string;
    signUp: string;
    invalidCredentials: string;
    invalidEmailOrPassword: string;
    wrongPassword: string;
    emailNotRegistered: string;
    noPasswordAccount: string;
    noPasswordAccountDesc: string;
    clickToCreatePassword: string;
    emailVerifiedSuccess: string;
    emailNotVerifiedYet: string;
    verificationEmailResent: string;
    // Sign Up
    createYourAccount: string;
    joinGatherend: string;
    username: string;
    chooseYourUsername: string;
    usernameTooShort: string;
    checking: string;
    youllBe: string;
    usernameNotAvailable: string;
    errorCheckingUsername: string;
    createPassword: string;
    passwordMinLength: string;
    invalidEmail: string;
    passwordTooShort: string;
    continue: string;
    alreadyHaveAccount: string;
    failedToCreateAccount: string;
    // Verification
    verificationCodeSent: string;
    verificationCode: string;
    enter6DigitCode: string;
    verifyEmail: string;
    didntReceiveCode: string;
    back: string;
    invalidVerificationCode: string;
    failedToResendCode: string;
    tooManyAttempts: string;
    tooManyResendAttempts: string;
    // Password Reset/Create
    forgotPassword: string;
    resetPassword: string;
    resetPasswordDesc: string;
    resetPasswordOAuthDesc: string;
    sendVerificationCode: string;
    checkYourEmail: string;
    verifyCode: string;
    setYourPassword: string;
    setPasswordDesc: string;
    newPassword: string;
    enterNewPassword: string;
    confirmPassword: string;
    confirmNewPassword: string;
    setPassword: string;
    passwordsDoNotMatch: string;
    passwordCreated: string;
    passwordCreatedDesc: string;
    continueToGatherend: string;
    backToSignIn: string;
    failedToSendCode: string;
    verificationFailed: string;
    failedToSetPassword: string;
  };

  // User search
  userSearch: {
    placeholder: string;
    searching: string;
    noUsersFound: string;
  };

  // Sticker picker
  stickerPicker: {
    stickers: string;
    uploadCustomSticker: string;
    maxStickersReached: string;
    deleteFromCollection: string;
    stickerUploaded: string;
    stickerDeleted: string;
    fileSizeTooLarge: string;
    onlyImagesAllowed: string;
    uploadFailed: string;
    deleteFailed: string;
  };

  // Landing page
  landing: {
    appName: string;
    alphaVersion: string;
    heroTitle: string;
    heroDescription: string;
    ctaButton: string;
    sourceCodeButton: string;
    footerCopyright: string;
    footerBuiltBy: string;
    footerFaq: string;
    footerPrivacyPolicy: string;
    footerTos: string;
    footerContact: string;
  };

  publicPages: {
    faq: {
      title: string;
      content: string;
    };
    privacyPolicy: {
      title: string;
      effectiveDate: string;
      content: string;
    };
    tos: {
      title: string;
      effectiveDate: string;
      content: string;
    };
    deleteAccount: {
      title: string;
      effectiveDate: string;
      emailButtonLabel: string;
      content: string;
    };
    childSafety: {
      title: string;
      effectiveDate: string;
      content: string;
    };
  };
};

// Helper type to get all possible dot-notation keys
type DotPrefix<T extends string> = T extends "" ? "" : `.${T}`;

// Depth-limited dot-notation keys to avoid TS "excessively deep" instantiation
type PrevDepth = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

type DotNestedKeys<T, Depth extends number = 6> = Depth extends 0
  ? ""
  : T extends object
    ? {
        [K in Extract<keyof T, string>]: T[K] extends object
          ? `${K}${DotPrefix<DotNestedKeys<T[K], PrevDepth[Depth]>>}`
          : K;
      }[Extract<keyof T, string>]
    : "";

export type TranslationKey = DotNestedKeys<TranslationKeys>;
