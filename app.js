/* =========================================================
   app.js — 공통 로직 (헤더/내비, 광고, 상세 모달, 유틸, 프로필)
   모든 페이지에서 로드.
   ========================================================= */

const APP = {
  /* ---------- 유틸 ---------- */
  escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  },
  fmtDate(iso) { return new Date(iso).toLocaleDateString("ko-KR"); },

  // <select> 옵션 채우기 (단일 출처: config.js)
  fillSelect(sel, items, { includeAll = false, allLabel = "전체", placeholder = null } = {}) {
    if (!sel) return;
    const opts = [];
    if (includeAll) opts.push(`<option value="all">${allLabel}</option>`);
    if (placeholder) opts.push(`<option value="" disabled selected>${placeholder}</option>`);
    items.forEach((i) => opts.push(`<option value="${APP.escapeHtml(i)}">${APP.escapeHtml(i)}</option>`));
    sel.innerHTML = opts.join("");
  },

  // 그룹(optgroup)으로 <select> 채우기
  fillGroupedSelect(sel, groups, { placeholder = null } = {}) {
    if (!sel) return;
    const opts = [];
    if (placeholder) opts.push(`<option value="" disabled selected>${placeholder}</option>`);
    groups.forEach((g) => {
      opts.push(`<optgroup label="${APP.escapeHtml(g.label)}">`);
      g.tools.forEach((t) => opts.push(`<option value="${APP.escapeHtml(t)}">${APP.escapeHtml(t)}</option>`));
      opts.push(`</optgroup>`);
    });
    sel.innerHTML = opts.join("");
  },

  // 카테고리 배열 → 표시 문자열
  catText(cat) { return Array.isArray(cat) ? cat.join(", ") : (cat || ""); },

  // 검색 동의어(한↔영) — 입력 단어와 같은 그룹의 모든 단어 반환
  synonymsOf(word) {
    const w = String(word).toLowerCase();
    const out = new Set();
    (window.APP_CONFIG.SEARCH_SYNONYMS || []).forEach((group) => {
      if (group.some((g) => g.toLowerCase() === w)) group.forEach((g) => out.add(g));
    });
    return [...out];
  },

  /* ---------- 레벨 ---------- */
  LEVELS: [
    { name: "Beginner", min: 0 },
    { name: "Novice", min: 100 },
    { name: "Intermediate", min: 300 },
    { name: "Advanced", min: 700 },
    { name: "Expert", min: 1500 },
    { name: "Master", min: 3000 },
    { name: "Grandmaster", min: 6000 },
  ],
  levelInfo(score) {
    const L = APP.LEVELS; let i = 0;
    for (let k = 0; k < L.length; k++) if (score >= L[k].min) i = k;
    const next = L[i + 1] || null;
    return { name: L[i].name, min: L[i].min, next: next ? next.name : null, nextMin: next ? next.min : null };
  },
  levelBadgeHTML(level) {
    const lv = level || "Beginner";
    return `<span class="level-badge lvl-${lv.toLowerCase()}">${APP.escapeHtml(lv)}</span>`;
  },

  // 갤러리/피드/프로필 공용 이미지 카드 생성
  buildImageCard(img) {
    const author = img.users?.name || "익명";
    const level = img.users?.level || "Beginner";
    const cats = Array.isArray(img.category) ? img.category : [];
    const flagged = (img.reports_count ?? 0) >= 5;
    const card = document.createElement("article");
    card.className = "card" + (flagged ? " flagged" : "");
    card.dataset.id = img.id;
    card.innerHTML = `
      <div class="card-img-wrap">
        <span class="card-badge">🤖 ${APP.escapeHtml(img.ai_tool || "-")}</span>
        <img src="${APP.escapeHtml(img.image_url)}" alt="${APP.escapeHtml(img.title)}" loading="lazy" />
        ${flagged ? '<span class="flag-label">⚠ 신고 누적 이미지</span>' : ""}
      </div>
      <div class="card-body">
        <h3 class="card-title">${APP.escapeHtml(img.title)}</h3>
        <p class="card-artist">${APP.levelBadgeHTML(level)} by <span class="author-link">${APP.escapeHtml(author)}</span></p>
        <div class="card-tags">${cats.map((c) => `<span class="tag-cat">${APP.escapeHtml(c)}</span>`).join("")}</div>
        <p class="card-stats">❤️ <span class="st-like">${img.likes_count ?? 0}</span> · 👁 <span class="st-view">${img.views_count ?? 0}</span> · ⬇ <span class="st-dl">${img.downloads_count ?? 0}</span></p>
      </div>`;
    card.addEventListener("click", () => APP.openDetail(img, author, level));
    const al = card.querySelector(".author-link");
    if (al) al.addEventListener("click", (e) => { e.stopPropagation(); APP.gotoUser(img.user_id); });
    return card;
  },

  /* ---------- 모달 ---------- */
  openModal(m) { m.hidden = false; document.body.style.overflow = "hidden"; },
  closeModal(m) { m.hidden = true; document.body.style.overflow = ""; },

  /* ---------- 상세 모달 (갤러리/프로필 공용) ---------- */
  openDetail(img, author, level) {
    const modal = document.getElementById("detailModal");
    if (!modal) return;
    document.getElementById("modalImg").src = img.image_url;
    document.getElementById("modalImg").alt = img.title;
    document.getElementById("modalCategory").textContent = APP.catText(img.category);
    document.getElementById("modalTitle").textContent = img.title;
    const artistEl = document.getElementById("modalArtist");
    artistEl.innerHTML =
      APP.levelBadgeHTML(level) + ' 제작자: <a href="#" class="author-link">' + APP.escapeHtml(author || "익명") + "</a>";
    const link = artistEl.querySelector(".author-link");
    if (link) link.addEventListener("click", (e) => { e.preventDefault(); APP.gotoUser(img.user_id); });
    APP.setupFollow(img);
    APP.setupReport(img);
    document.getElementById("modalDesc").textContent = img.description || "(설명 없음)";
    const aiEl = document.getElementById("modalAi");
    if (aiEl) aiEl.textContent = img.ai_tool || "-";
    document.getElementById("modalDate").textContent = APP.fmtDate(img.created_at);

    // 통계 (좋아요/조회/다운로드)
    const likeCountEl = document.getElementById("likeCount");
    const viewCountEl = document.getElementById("viewCount");
    const dlCountEl = document.getElementById("downloadCount");
    if (likeCountEl) likeCountEl.textContent = img.likes_count ?? 0;
    if (viewCountEl) viewCountEl.textContent = img.views_count ?? 0;
    if (dlCountEl) dlCountEl.textContent = img.downloads_count ?? 0;
    APP.setupLike(img);
    // 조회수 +1 (.then으로 실제 실행). 단, 본인 이미지는 제외
    const isOwnView = APP.currentUser && img.user_id && APP.currentUser.id === img.user_id;
    if (window.sb && !isOwnView) {
      sb.rpc("increment_views", { img_id: img.id }).then(({ data, error }) => {
        if (!error && typeof data === "number") {
          img.views_count = data;
          if (viewCountEl) viewCountEl.textContent = data;
          APP._updateCardStat(img.id, "view", data);
        }
      });
    }

    const dlBtn = document.getElementById("downloadBtn");
    if (dlBtn) dlBtn.onclick = () => APP.downloadImage(img);
    APP.openModal(modal);
    APP.renderAd("detail");
  },

  /* ---------- 광고 ---------- */
  renderAd(key) {
    const client = window.APP_CONFIG.ADSENSE?.CLIENT;
    const slot = window.APP_CONFIG.ADSENSE?.SLOTS?.[key];
    document.querySelectorAll(`.ad-slot[data-ad="${key}"]`).forEach((box) => {
      if (box.dataset.rendered === "1") return;
      if (client && slot) {
        // ===== Google AdSense 광고 단위 (승인 후 활성화됨) =====
        box.innerHTML =
          `<ins class="adsbygoogle" style="display:block" data-ad-client="${client}" ` +
          `data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
      } else {
        box.innerHTML = `<span class="ad-placeholder">광고 영역 (${key})</span>`;
      }
      box.dataset.rendered = "1";
    });
  },
  renderStaticAds() { ["header", "sidebar", "footer"].forEach((k) => APP.renderAd(k)); },

  /* ---------- 헤더: 인증 상태 + 활성 내비 ---------- */
  async setupHeader() {
    // 활성 메뉴 표시
    const page = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("[data-nav]").forEach((a) =>
      a.classList.toggle("active", a.getAttribute("href") === page));

    const guest = document.getElementById("navGuest");
    const userBox = document.getElementById("navUser");
    if (!guest || !userBox) return;

    const user = await Auth.getUser();
    APP.currentUser = user || null;
    if (user) {
      guest.hidden = true;
      userBox.hidden = false;
      // 표시 이름은 public.users.name 을 기준으로 (Google 재로그인 시 메타데이터가 덮어써지는 문제 방지)
      let name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0];
      if (window.sb) {
        const { data } = await sb.from("users").select("name").eq("id", user.id).maybeSingle();
        if (data && data.name) name = data.name;
      }
      APP.currentName = name;
      const chip = document.getElementById("navUserName");
      if (chip) chip.textContent = "👤 " + name;
    } else {
      guest.hidden = false;
      userBox.hidden = true;

      // 미로그인 시 업로드/내 프로필 클릭 → 안내 모달
      document.querySelectorAll('a[href="upload.html"], a[href="profile.html"]').forEach((a) =>
        a.addEventListener("click", (e) => {
          e.preventDefault();
          const msg = a.getAttribute("href") === "profile.html"
            ? "내 프로필은 로그인 후 이용할 수 있어요."
            : "업로드는 로그인 후 이용할 수 있어요.";
          APP.showLoginRequired(msg);
        })
      );
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", () => Auth.signOut());
  },

  // 카드의 통계 숫자 즉시 갱신 (type: like | view | dl)
  _updateCardStat(id, type, value) {
    document.querySelectorAll(`.card[data-id="${id}"] .st-${type}`)
      .forEach((el) => (el.textContent = value));
  },

  /* ---------- 토스트 ---------- */
  toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2500);
  },

  /* ---------- 유저 프로필로 이동 ---------- */
  gotoUser(userId) {
    if (!userId) return;
    if (APP.currentUser && APP.currentUser.id === userId) window.location.href = "profile.html";
    else window.location.href = "profile_view.html?id=" + encodeURIComponent(userId);
  },

  /* ---------- 팔로워/팔로잉 목록 모달 (인스타 형식) ---------- */
  async showFollowList(mode, userId) {
    const title = mode === "followers" ? "팔로워" : "팔로잉";
    const idCol = mode === "followers" ? "follower_id" : "following_id";
    const whereCol = mode === "followers" ? "following_id" : "follower_id";

    let users = [];
    if (window.sb) {
      const { data: rows } = await sb.from("follows").select(idCol).eq(whereCol, userId);
      const ids = (rows || []).map((r) => r[idCol]);
      if (ids.length) {
        const { data: us } = await sb.from("users").select("id, name, level").in("id", ids);
        users = us || [];
      }
    }

    let modal = document.getElementById("userListModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal-overlay";
      modal.id = "userListModal";
      modal.innerHTML = `
        <div class="userlist-box" role="dialog" aria-modal="true">
          <button class="modal-close" data-close-modal aria-label="닫기">&times;</button>
          <h2 class="userlist-title"></h2>
          <div class="userlist" id="userListBody"></div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", (e) => { if (e.target === modal) APP.closeModal(modal); });
      modal.querySelector("[data-close-modal]").addEventListener("click", () => APP.closeModal(modal));
    }
    modal.querySelector(".userlist-title").textContent = `${title} ${users.length}`;
    const body = modal.querySelector("#userListBody");
    if (users.length === 0) {
      body.innerHTML = `<p class="userlist-empty">아직 없습니다.</p>`;
    } else {
      body.innerHTML = "";
      users.forEach((u) => {
        const row = document.createElement("button");
        row.className = "userlist-row";
        row.innerHTML =
          `<span class="userlist-avatar">👤</span>${APP.levelBadgeHTML(u.level)}<span class="userlist-name">${APP.escapeHtml(u.name || "익명")}</span>`;
        row.addEventListener("click", () => { APP.closeModal(modal); APP.gotoUser(u.id); });
        body.appendChild(row);
      });
    }
    APP.openModal(modal);
  },

  /* ---------- 팔로우 ---------- */
  async setupFollow(img) {
    const btn = document.getElementById("followBtn");
    if (!btn) return;
    const me = APP.currentUser;
    if (!me || !img.user_id || me.id === img.user_id) { btn.hidden = true; return; }
    btn.hidden = false;
    const { data } = await sb.from("follows").select("id")
      .eq("follower_id", me.id).eq("following_id", img.user_id).maybeSingle();
    APP._renderFollow(btn, !!data);
    btn.onclick = () => APP._toggleFollow(img.user_id);
  },
  _renderFollow(btn, following) {
    btn.dataset.following = following ? "1" : "0";
    btn.textContent = following ? "팔로잉" : "+ 팔로우";
    btn.classList.toggle("following", following);
  },
  async _toggleFollow(targetId) {
    if (!APP.currentUser) { APP.showLoginRequired("팔로우는 로그인 후 이용할 수 있어요."); return; }
    const btn = document.getElementById("followBtn");
    const following = btn.dataset.following === "1";
    if (following) {
      await sb.from("follows").delete().eq("follower_id", APP.currentUser.id).eq("following_id", targetId);
      APP._renderFollow(btn, false);
    } else {
      const { error } = await sb.from("follows").insert({ follower_id: APP.currentUser.id, following_id: targetId });
      if (error) return;
      APP._renderFollow(btn, true);
    }
  },

  /* ---------- 신고 ---------- */
  setupReport(img) {
    const btn = document.getElementById("reportBtn");
    if (!btn) return;
    const me = APP.currentUser;
    if (me && img.user_id && me.id === img.user_id) { btn.hidden = true; return; } // 본인 이미지 신고 불가
    btn.hidden = false;
    btn.onclick = () => {
      if (!APP.currentUser) { APP.showLoginRequired("신고는 로그인 후 이용할 수 있어요."); return; }
      APP.showReportModal(img);
    };
  },
  showReportModal(img) {
    const reasons = ["부적절한 콘텐츠", "저작권 침해", "스팸/광고", "혐오/폭력적 내용", "기타"];
    let modal = document.getElementById("reportModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal-overlay";
      modal.id = "reportModal";
      modal.innerHTML = `
        <div class="alert-box" role="dialog" aria-modal="true">
          <button class="modal-close" data-close-modal aria-label="닫기">&times;</button>
          <h2 class="alert-title">이미지 신고</h2>
          <p class="alert-text">신고 사유를 선택해 주세요.</p>
          <div class="report-reasons">
            ${reasons.map((r) => `<button class="report-reason" type="button">${r}</button>`).join("")}
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", (e) => { if (e.target === modal) APP.closeModal(modal); });
      modal.querySelector("[data-close-modal]").addEventListener("click", () => APP.closeModal(modal));
    }
    // 매번 현재 이미지에 맞게 사유 버튼 핸들러 갱신
    modal.querySelectorAll(".report-reason").forEach((b) => {
      b.onclick = () => APP._submitReport(img, b.textContent, modal);
    });
    APP.openModal(modal);
  },
  async _submitReport(img, reason, modal) {
    const { error } = await sb.from("reports").insert({
      reporter_id: APP.currentUser.id, image_id: img.id, reason,
    });
    APP.closeModal(modal);
    if (error) {
      if (error.code === "23505") APP.toast("이미 신고한 이미지예요.");
      else APP.toast("신고 실패: " + error.message);
    } else {
      APP.toast("신고가 접수되었습니다.");
    }
  },

  /* ---------- 좋아요 ---------- */
  async setupLike(img) {
    const btn = document.getElementById("likeBtn");
    if (!btn) return;
    let liked = false;
    if (APP.currentUser && window.sb) {
      const { data } = await sb.from("likes").select("id")
        .eq("image_id", img.id).eq("user_id", APP.currentUser.id).maybeSingle();
      liked = !!data;
    }
    APP._renderLike(liked);
    btn.onclick = () => APP._toggleLike(img);
  },
  _renderLike(liked) {
    const btn = document.getElementById("likeBtn");
    if (!btn) return;
    btn.dataset.liked = liked ? "1" : "0";
    const icon = document.getElementById("likeIcon");
    if (icon) icon.textContent = liked ? "❤️" : "🤍";
  },
  async _toggleLike(img) {
    if (!APP.currentUser) { APP.showLoginRequired("좋아요는 로그인 후 이용할 수 있어요."); return; }
    const btn = document.getElementById("likeBtn");
    const countEl = document.getElementById("likeCount");
    const liked = btn.dataset.liked === "1";
    let n = Number(countEl.textContent) || 0;
    if (liked) {
      await sb.from("likes").delete().eq("image_id", img.id).eq("user_id", APP.currentUser.id);
      APP._renderLike(false);
      n = Math.max(0, n - 1);
    } else {
      const { error } = await sb.from("likes").insert({ image_id: img.id, user_id: APP.currentUser.id });
      if (error) return; // 중복 등
      APP._renderLike(true);
      n = n + 1;
    }
    countEl.textContent = n;
    APP._updateCardStat(img.id, "like", n);
  },

  /* ---------- 이미지 다운로드 (누구의 이미지든) ---------- */
  async downloadImage(img) {
    const btn = document.getElementById("downloadBtn");
    const bucket = window.APP_CONFIG.STORAGE_BUCKET;
    const orig = btn ? btn.textContent : "";
    try {
      if (btn) { btn.disabled = true; btn.textContent = "다운로드 중..."; }

      // 공개 URL에서 Storage 경로 추출 → SDK로 다운로드 (CORS 안전)
      let blob;
      const marker = `/object/public/${bucket}/`;
      const idx = img.image_url.indexOf(marker);
      if (idx !== -1 && window.sb) {
        const path = decodeURIComponent(img.image_url.slice(idx + marker.length));
        const { data, error } = await sb.storage.from(bucket).download(path);
        if (error) throw error;
        blob = data;
      } else {
        const res = await fetch(img.image_url);
        blob = await res.blob();
      }

      const ext = (blob.type && blob.type.split("/")[1]) || img.image_url.split(".").pop() || "jpg";
      const safeName = (img.title || "image").replace(/[\\/:*?"<>|]/g, "_");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // 다운로드수 +1 (.then으로 실제 실행). 단, 본인 이미지는 제외
      const isOwnDl = APP.currentUser && img.user_id && APP.currentUser.id === img.user_id;
      if (window.sb && !isOwnDl) {
        sb.rpc("increment_downloads", { img_id: img.id }).then(({ data, error }) => {
          if (!error && typeof data === "number") {
            const dc = document.getElementById("downloadCount");
            if (dc) dc.textContent = data;
            APP._updateCardStat(img.id, "dl", data);
          }
        });
      }
    } catch (e) {
      // 실패 시 새 탭으로 열기 (사용자가 직접 저장)
      window.open(img.image_url, "_blank");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = orig || "⬇ 이미지 다운로드"; }
    }
  },

  /* ---------- 로그인 필요 안내 모달 ---------- */
  showLoginRequired(message = "업로드는 로그인 후 이용할 수 있어요.") {
    let modal = document.getElementById("loginRequiredModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal-overlay";
      modal.id = "loginRequiredModal";
      modal.innerHTML = `
        <div class="alert-box" role="dialog" aria-modal="true">
          <div class="alert-icon">🔒</div>
          <h2 class="alert-title">로그인이 필요한 서비스입니다</h2>
          <p class="alert-text" id="loginRequiredText"></p>
          <div class="alert-actions">
            <button class="btn btn-ghost" data-close-modal>닫기</button>
            <button class="btn btn-primary" id="loginRequiredGo">로그인하기</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", (e) => { if (e.target === modal) APP.closeModal(modal); });
      modal.querySelector("[data-close-modal]").addEventListener("click", () => APP.closeModal(modal));
      modal.querySelector("#loginRequiredGo").addEventListener("click", () => { window.location.href = "index.html"; });
    }
    document.getElementById("loginRequiredText").textContent = message;
    APP.openModal(modal);
  },

  /* ---------- 모달 닫기 공통 바인딩 ---------- */
  bindModalClose() {
    document.querySelectorAll(".modal-overlay").forEach((m) => {
      m.addEventListener("click", (e) => { if (e.target === m) APP.closeModal(m); });
    });
    document.querySelectorAll("[data-close-modal]").forEach((b) => {
      const overlay = b.closest(".modal-overlay");
      b.addEventListener("click", () => APP.closeModal(overlay));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".modal-overlay").forEach((m) => { if (!m.hidden) APP.closeModal(m); });
    });
  },
};
window.APP = APP;

/* =========================================================
   초기화 (전 페이지 공통)
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  APP.setupHeader();
  APP.renderStaticAds();
  APP.bindModalClose();
});
