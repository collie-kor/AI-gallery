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

  // 검색 동의어(한↔영) — 한 그룹 안의 단어들은 서로 같은 뜻으로 매칭됩니다.
  // 예: "honey"로 검색하면 제목 "꿀"도 나옴. 필요한 단어는 자유롭게 추가하세요.
  SEARCH_SYNONYMS: [
    ["꿀", "honey"], ["고양이", "냥이", "cat", "kitty"], ["강아지", "개", "dog", "puppy"],
    ["동물", "animal"], ["새", "bird"], ["물고기", "fish"], ["나비", "butterfly"],
    ["꽃", "flower"], ["장미", "rose"], ["나무", "tree"], ["숲", "forest"], ["식물", "plant"],
    ["바다", "sea", "ocean"], ["산", "mountain"], ["강", "river"], ["호수", "lake"],
    ["하늘", "sky"], ["별", "star"], ["달", "moon"], ["태양", "해", "sun"], ["우주", "space", "galaxy", "universe"],
    ["눈", "snow"], ["비", "rain"], ["구름", "cloud"], ["불", "fire", "flame"], ["물", "water"],
    ["도시", "city"], ["건물", "building"], ["밤", "night"], ["풍경", "landscape", "scenery"],
    ["자연", "nature"], ["겨울", "winter"], ["여름", "summer"], ["봄", "spring"], ["가을", "autumn", "fall"],
    ["사람", "person", "people"], ["여자", "woman", "girl"], ["남자", "man", "boy"], ["아기", "baby"],
    ["가족", "family"], ["연인", "커플", "couple"], ["사랑", "love"], ["천사", "angel"], ["악마", "demon", "devil"],
    ["로봇", "robot"], ["용", "dragon"], ["괴물", "monster"], ["마법", "magic"], ["전사", "warrior"],
    ["공주", "princess"], ["왕", "king"], ["기사", "knight"], ["히어로", "hero"], ["판타지", "fantasy"],
    ["음식", "food"], ["커피", "coffee"], ["자동차", "차", "car"], ["비행기", "airplane", "plane"],
    ["기차", "train"], ["배", "ship", "boat"], ["성", "castle"], ["게임", "game"], ["음악", "music"],
    ["초상화", "portrait"], ["추상", "abstract"], ["감정", "emotion"], ["꿈", "dream"],
  ],

  // Google AdSense — 승인된 값으로 교체하세요. 비우면 자리표시 박스 표시.
  ADSENSE: {
    CLIENT: "", // 예: "ca-pub-1234567890123456"
    SLOTS: { header: "", sidebar: "", footer: "", detail: "" },
  },
};
