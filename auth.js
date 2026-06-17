/* =========================================================
   auth.js — Supabase 클라이언트 + 인증
   모든 페이지에서 로드됨. 전역 window.sb, window.Auth 제공.
   ========================================================= */

const CFG = window.APP_CONFIG;

// 설정 여부 확인
const CONFIGURED =
  CFG.SUPABASE_URL && !CFG.SUPABASE_URL.includes("your-project") &&
  CFG.SUPABASE_ANON_KEY && !CFG.SUPABASE_ANON_KEY.includes("your-");

// Supabase 클라이언트 (전역)
window.sb = CONFIGURED
  ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY)
  : null;

if (!CONFIGURED) console.warn("[AIGallery] config.js의 Supabase 값이 비어 있습니다.");

window.Auth = {
  configured: CONFIGURED,

  async getUser() {
    if (!sb) return null;
    const { data } = await sb.auth.getUser();
    return data.user || null;
  },

  // 인증 필요한 페이지에서 호출 — 미로그인 시 로그인 페이지로 이동
  async requireAuth() {
    const user = await this.getUser();
    if (!user) {
      window.location.href = "index.html";
      return null;
    }
    return user;
  },

  async signInWithGoogle() {
    return sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: new URL("gallery.html", window.location.href).href },
    });
  },

  async signInEmail(email, password) {
    return sb.auth.signInWithPassword({ email, password });
  },

  async signUpEmail(email, password, name) {
    return sb.auth.signUp({
      email, password,
      options: { data: { full_name: name || email.split("@")[0] } },
    });
  },

  async signOut() {
    await sb?.auth.signOut();
    window.location.href = "index.html";
  },
};

/* ---------------------------------------------------------
   로그인 페이지 (index.html) 전용 로직
   --------------------------------------------------------- */
function initLoginPage() {
  const form = document.getElementById("authForm");
  if (!form) return; // 로그인 페이지가 아니면 종료

  const $ = (id) => document.getElementById(id);
  let mode = "login";

  // 이미 로그인 상태면 갤러리로
  Auth.getUser().then((u) => { if (u) window.location.href = "gallery.html"; });

  function setMode(m) {
    mode = m;
    document.querySelectorAll(".auth-tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.tab === m));
    $("authSubmit").textContent = m === "login" ? "로그인" : "회원가입";
    document.querySelectorAll(".signup-only").forEach((el) => (el.hidden = m === "login"));
    $("authError").hidden = true;
    $("authNote").hidden = true;
  }
  document.querySelectorAll(".auth-tab").forEach((t) =>
    t.addEventListener("click", () => setMode(t.dataset.tab)));

  // 소셜 로그인
  $("googleBtn").addEventListener("click", async () => {
    if (!CONFIGURED) return showErr("Supabase가 설정되지 않았습니다.");
    const { error } = await Auth.signInWithGoogle();
    if (error) showErr(error.message);
  });

  // 이메일 로그인 / 회원가입
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!CONFIGURED) return showErr("Supabase가 설정되지 않았습니다.");
    const email = $("authEmail").value.trim();
    const pw = $("authPassword").value;
    const name = $("authName").value.trim();

    if (mode === "signup") {
      const { error } = await Auth.signUpEmail(email, pw, name);
      if (error) return showErr(error.message);
      showNote("가입 완료! 이메일 인증이 필요할 수 있습니다. 메일함을 확인 후 로그인하세요.");
      setMode("login");
    } else {
      const { error } = await Auth.signInEmail(email, pw);
      if (error) return showErr("로그인 실패: " + error.message);
      window.location.href = "gallery.html";
    }
  });

  function showErr(msg) { const el = $("authError"); el.textContent = msg; el.hidden = false; }
  function showNote(msg) { const el = $("authNote"); el.textContent = msg; el.hidden = false; }
}

document.addEventListener("DOMContentLoaded", initLoginPage);
