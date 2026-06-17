/* =========================================================
   config.js — Supabase 설정
   ---------------------------------------------------------
   ⚠️ 브라우저용 Vanilla JS는 .env 파일을 직접 읽을 수 없습니다.
      (.env는 빌드 도구가 있는 환경에서만 동작)
      그래서 실제 값은 이 파일에 담고, .env / .env.example 은
      "값의 출처(기록용)"로 함께 둡니다.
   ⚠️ 여기에는 anon(publishable) 키만! service_role 키 금지.
   ========================================================= */

window.APP_CONFIG = {
  SUPABASE_URL: "https://rtmxafordzxnwhaogzra.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0bXhhZm9yZHp4bndoYW9nenJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NjAxMTcsImV4cCI6MjA5NzEzNjExN30.v4EKQWmROwVEYl6iw9d5oPYJHlX5ggZHdrIO8dexCck",

  STORAGE_BUCKET: "images",

  // 카테고리 (전 페이지 공통, 다중 선택)
  CATEGORIES: [
    "사람", "연인/커플", "가족", "동물", "자연", "풍경", "도시", "건물/건축물",
    "탈것", "판타지", "SF/사이버펑크", "캐릭터", "히어로", "신화/전설",
    "괴물/크리처", "우주", "바다", "꽃/식물", "정물", "감정/추상",
    "동화", "중세", "해적", "닌자/무협", "스포츠", "음악", "음식",
    "반려동물", "계절", "기념일", "게임", "영화 패러디", "책/소설 장면",
    "세계여행", "캠핑", "꿈속 세계",
  ],

  // 사용 AI 툴 (그룹별 — 업로드/필터/편집 공통 단일 출처)
  AI_TOOL_GROUPS: [
    {
      label: "이미지 생성 AI",
      tools: [
        "Midjourney", "DALL-E 3", "Stable Diffusion", "Adobe Firefly",
        "Runway ML", "Pika Labs", "Leonardo AI", "Ideogram",
        "Playground AI", "Canva AI", "Bing Image Creator",
        "NightCafe", "BlueWillow", "SeaArt", "Tensor.Art",
        "Krea AI", "Magnific AI", "Flux", "Kling AI", "Hailuo AI",
      ],
    },
    {
      label: "텍스트 기반 AI (이미지 생성 기능 포함)",
      tools: ["ChatGPT (DALL-E)", "Claude (Artifacts)", "Gemini", "Grok"],
    },
    { label: "기타", tools: ["기타"] },
  ],

  // 위 그룹을 펼친 평탄 목록 (편의용)
  get AI_TOOLS() {
    return this.AI_TOOL_GROUPS.flatMap((g) => g.tools);
  },

  // Google AdSense — 승인된 값으로 교체하세요. 비우면 자리표시 박스 표시.
  ADSENSE: {
    CLIENT: "", // 예: "ca-pub-1234567890123456"
    SLOTS: { header: "", sidebar: "", footer: "", detail: "" },
  },
};
