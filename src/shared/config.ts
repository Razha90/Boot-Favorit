// Semua nilai tunable aplikasi (dipakai client dan server). Lihat explore.md B5.
// Nilai di sini adalah DEFAULT; sebagian bisa ditimpa per event lewat events.settings_json.
export const CONFIG = {
  live: {
    tickMs: 2500, // jeda broadcast ke penonton
    maxFeedItemsPerTick: 5, // sisanya diringkas "+N ulasan baru"
    maxLiveViewers: 400, // di atas ini → mode polling
    reservedScreenSlots: 5, // slot WebSocket yang selalu tersedia untuk Mode Layar Besar
    pollIntervalMs: 15_000, // interval polling (opsi A)
    pollJitterRatio: 0.2, // ±20% acak agar klien tidak serentak
    snapshotTtlSec: 5, // s-maxage cache edge saat event berlangsung
    snapshotTtlSecAfterEnd: 60, // setelah event selesai data beku
    spotlightMs: 8000, // ganti spotlight
    screenPanelMs: 14_000, // lama tiap panel di Mode Layar Besar sebelum berganti
  },
  reveal: {
    // Animasi pemenang (A8, B20): 3-2-1 → juara 3 → 2 → 1 → daftar hasil; total ±13,5 detik.
    countdownStepMs: 1000,
    placeMs: 3500,
    /** Pemutaran langsung oleh admin hanya diputar bila baru terjadi (pengunjung terlambat tidak memutar ulang) */
    liveWindowMs: 90_000,
  },
  booth: {
    aboutMaxLength: 2000,
    aboutCollapsedLines: 4,
    maxProducts: 24, // bawaan; admin menimpanya per event (A14)
    maxProductsHardCap: 100,
    whatsapp: {
      messageMaxLength: 300,
      redirectRatePerMinute: 20,
      deleteDaysAfterEventEnd: 30,
    },
    share: { appendSrcParam: "share" },
    productPageSize: 6,
    productFilterMinProducts: 8,
    maxProductCategories: 8,
    productNameMax: 60,
    productDescMax: 300,
    maxPriceIdr: 99_999_999, // rupiah bulat, 0 = Gratis
    productBadges: ["limited", "new"], // sengaja tanpa "terlaris"/"favorit" karena menggiring
    wishlistMax: 50,
  },
  gallery: {
    intervalMs: 3500,
    resumeAfterTouchMs: 4000,
  },
  moderation: {
    severeAction: "hold",
    mildAction: "mask",
    holdContactInfo: true,
    maxReportsPerBoothPerHour: 20,
    suspiciousReportRatio: 0.6,
    suspiciousReportMin: 5,
    fuzzyMatching: false,
  },
  review: {
    maxCommentLength: 280,
    editableUntilVotingEnds: true,
    defaultCategories: ["Inovatif", "Ramah", "Seru", "Bermanfaat", "Kreatif", "Rapi"],
    maxCategoriesPerReview: 3,
  },
  ranking: {
    bayesPriorWeight: 5, // m
    minReviewsToRank: 3,
  },
  auth: {
    otpTtlMinutes: 10,
    otpMaxAttempts: 5,
    otpRequestsPerEmailPerHour: 5,
    sessionDays: 3,
  },
  spam: {
    maxReviewsPerVisitorPerMinute: 4,
    burstThresholdPerBoothPerMin: 12,
    /** Skor risiko ≥ ini → review ditahan (`held`) diam-diam untuk dicek admin (B9). */
    holdRiskThreshold: 60,
    /** Beberapa review dari ip_hash yang sama ke booth yang sama (WiFi kampus berbagi IP: hanya sinyal) */
    sameIpBoothThreshold: 4,
    /** Akun yang baru dibuat langsung memberi bintang 5 tanpa komentar (ms) */
    freshVisitorMs: 8_000,
    /** Pola sabotase: minimal jumlah review dari identitas yang sama agar pola dihitung */
    sabotageMinReviews: 3,
    /** Batas laju laporan komentar per pengunjung per jam */
    maxReportsPerVisitorPerHour: 10,
  },
  registration: {
    allowLateRegistrationDefault: true,
    adminReasonMinLength: 5,
    countdownShowWithinHours: 72,
  },
  net: {
    requestTimeoutMs: 15_000,
    otpCooldownSec: 45,
    idempotencyTtlHours: 24,
  },
  media: {
    maxRawFileMB: 15,
    quality: 0.82,
    logo: { fullPx: 512, thumbPx: 128, maxBytesFull: 120_000, maxBytesThumb: 20_000 },
    photo: { fullPx: 1280, thumbPx: 480, maxBytesFull: 400_000, maxBytesThumb: 60_000 },
    product: { fullPx: 960, thumbPx: 400, maxBytesFull: 250_000, maxBytesThumb: 40_000 },
    maxPhotosPerBooth: 6,
    // Foto OPSIONAL (A16): tidak ada batas minimum dan tidak ada pengaturan untuk mewajibkannya.
  },
  spotlight: {
    topReviewsCount: 2,
    minStars: 4,
    minCommentLength: 30,
    photoIntervalMs: 2600,
  },
  profile: {
    // Kelengkapan profil (A16): hanya untuk chip admin dan saran di portal.
    fullNeeds: ["cover", "description", "tagline", "boothNo"],
    nameMaxLength: 60,
    taglineMaxLength: 100,
    descriptionMaxLength: 300,
    boothNoMaxLength: 12,
    teamNameMaxLength: 60,
  },
  booths: {
    csvMaxRows: 500,
    csvChunkSize: 50,
  },
} as const;

export type Config = typeof CONFIG;
