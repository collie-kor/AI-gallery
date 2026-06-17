/* =========================================================
   profile.js — 마이페이지 (내 사진 목록 / 편집 / 삭제)
   profile.html 전용
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("myGrid");
  if (!grid) return; // 프로필 페이지가 아니면 종료

  const $ = (id) => document.getElementById(id);
  const editModal = $("editModal");
  let editingId = null;

  // 편집 폼: AI 드롭다운(그룹) + 카테고리 체크박스
  APP.fillGroupedSelect($("editAi"), window.APP_CONFIG.AI_TOOL_GROUPS);
  $("editCategoryChecks").innerHTML = window.APP_CONFIG.CATEGORIES
    .map((c) => `<label class="check-item"><input type="checkbox" value="${c}"><span>${c}</span></label>`)
    .join("");

  // 로그인 필수
  const user = await Auth.requireAuth();
  if (!user) return;

  let myName = user.user_metadata?.full_name || user.email?.split("@")[0] || "나";
  let myLevel = "Beginner";

  // 프로필 정보
  $("profileEmail").textContent = user.email || "";
  $("profileName").textContent = myName;

  // 팔로워 / 팔로잉 수
  const [fr, fg] = await Promise.all([
    sb.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user.id),
    sb.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
  ]);
  $("followerCount").textContent = fr.count || 0;
  $("followingCount").textContent = fg.count || 0;
  $("followerBtn").addEventListener("click", () => APP.showFollowList("followers", user.id));
  $("followingBtn").addEventListener("click", () => APP.showFollowList("following", user.id));

  // 탭 (내 사진 / 팔로잉 피드)
  let feedLoaded = false;
  document.querySelectorAll(".profile-tab").forEach((t) =>
    t.addEventListener("click", () => {
      document.querySelectorAll(".profile-tab").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      const mine = t.dataset.tab === "mine";
      $("tabMine").hidden = !mine;
      $("tabFeed").hidden = mine;
      if (!mine && !feedLoaded) { feedLoaded = true; loadFeed(); }
    })
  );

  /* ---------- 이름 변경 ---------- */
  const nameModal = $("nameModal");
  $("editNameBtn").addEventListener("click", () => {
    $("newName").value = myName;
    $("nameError").hidden = true;
    APP.openModal(nameModal);
  });
  $("nameForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const newName = $("newName").value.trim();
    if (!newName) { $("nameError").textContent = "이름을 입력하세요."; $("nameError").hidden = false; return; }

    const btn = $("nameSubmit");
    btn.disabled = true; btn.textContent = "저장 중...";

    // 1) 프로필 테이블(갤러리 작성자명) 2) 인증 메타데이터(헤더 칩)
    const { error: e1 } = await sb.from("users").update({ name: newName }).eq("id", user.id);
    const { error: e2 } = await sb.auth.updateUser({ data: { full_name: newName } });

    btn.disabled = false; btn.textContent = "저장";
    if (e1 || e2) { $("nameError").textContent = "변경 실패: " + (e1 || e2).message; $("nameError").hidden = false; return; }

    // 화면 즉시 반영
    myName = newName;
    $("profileName").textContent = newName;
    if (APP.currentUser) APP.currentUser.user_metadata = { ...APP.currentUser.user_metadata, full_name: newName };
    const chip = document.getElementById("navUserName");
    if (chip) chip.textContent = "👤 " + newName;
    APP.closeModal(nameModal);
  });

  await loadMyImages();

  /* ---------- 팔로잉 피드 ---------- */
  async function loadFeed() {
    const status = $("feedStatus"), empty = $("feedEmpty"), grid = $("feedGrid");
    status.hidden = false; status.textContent = "불러오는 중..."; empty.hidden = true; grid.innerHTML = "";

    const { data: f } = await sb.from("follows").select("following_id").eq("follower_id", user.id);
    const ids = (f || []).map((x) => x.following_id);
    if (ids.length === 0) { status.hidden = true; empty.hidden = false; return; }

    const { data, error } = await sb.from("images")
      .select("id, user_id, image_url, title, description, category, ai_tool, created_at, likes_count, views_count, downloads_count, reports_count, users(name, level)")
      .in("user_id", ids)
      .order("created_at", { ascending: false });

    if (error) { status.textContent = "불러오기 실패: " + error.message; return; }
    status.hidden = true;
    empty.hidden = data.length !== 0;
    grid.innerHTML = "";
    data.forEach((img) => grid.appendChild(APP.buildImageCard(img)));
  }

  /* ---------- 레벨/통계 카드 렌더 ---------- */
  function setBadge(el, level) {
    if (!el) return;
    el.className = "level-badge lvl-" + level.toLowerCase();
    el.textContent = level;
  }
  function renderLevel(score, tl, tv, td) {
    const info = APP.levelInfo(score);
    myLevel = info.name;
    setBadge($("profileLevelBadge"), info.name);
    setBadge($("myLevelBadge"), info.name);
    $("myScore").textContent = score;
    $("totLikes").textContent = tl;
    $("totViews").textContent = tv;
    $("totDownloads").textContent = td;
    if (info.nextMin == null) {
      $("levelBar").style.width = "100%";
      $("levelNext").textContent = "최고 레벨에 도달했습니다! 🏆";
    } else {
      const span = info.nextMin - info.min;
      const prog = span > 0 ? Math.min(100, Math.round(((score - info.min) / span) * 100)) : 0;
      $("levelBar").style.width = prog + "%";
      $("levelNext").textContent = `다음 레벨(${info.next})까지 ${info.nextMin - score}점 남음`;
    }
  }

  /* ---------- 내 사진 로드 ---------- */
  async function loadMyImages() {
    const status = $("myStatus");
    const empty = $("myEmpty");
    status.hidden = false; status.textContent = "불러오는 중...";
    empty.hidden = true;

    const { data, error } = await sb
      .from("images")
      .select("id, user_id, image_url, title, description, category, ai_tool, created_at, likes_count, views_count, downloads_count")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) { status.textContent = "불러오기 실패: " + error.message; return; }
    status.hidden = true;
    $("myCount").textContent = data.length;

    // 통계 합산 + 레벨 계산 (점수 = 좋아요×3 + 조회×1 + 다운로드×2)
    let tl = 0, tv = 0, td = 0;
    data.forEach((im) => { tl += im.likes_count || 0; tv += im.views_count || 0; td += im.downloads_count || 0; });
    renderLevel(tl * 3 + tv * 1 + td * 2, tl, tv, td);

    grid.innerHTML = "";
    empty.hidden = data.length !== 0;

    data.forEach((img) => {
      const card = document.createElement("article");
      card.className = "card";
      card.dataset.id = img.id;
      card.innerHTML = `
        <div class="card-img-wrap">
          <span class="card-badge">${APP.escapeHtml((Array.isArray(img.category) ? img.category[0] : img.category) || "")}</span>
          <img src="${APP.escapeHtml(img.image_url)}" alt="${APP.escapeHtml(img.title)}" loading="lazy" />
        </div>
        <div class="card-body">
          <h3 class="card-title">${APP.escapeHtml(img.title)}</h3>
          <p class="card-artist">🤖 ${APP.escapeHtml(img.ai_tool || "-")}</p>
          <div class="card-tags">${(Array.isArray(img.category) ? img.category : []).map((c) => `<span class="tag-cat">${APP.escapeHtml(c)}</span>`).join("")}</div>
          <p class="card-stats">❤️ <span class="st-like">${img.likes_count ?? 0}</span> · 👁 <span class="st-view">${img.views_count ?? 0}</span> · ⬇ <span class="st-dl">${img.downloads_count ?? 0}</span></p>
          <div class="card-actions">
            <button class="btn btn-ghost btn-sm" data-edit>편집</button>
            <button class="btn btn-danger btn-sm" data-del>삭제</button>
          </div>
        </div>`;
      card.querySelector("img").addEventListener("click", () => APP.openDetail(img, myName, myLevel));
      card.querySelector("[data-edit]").addEventListener("click", (e) => { e.stopPropagation(); openEdit(img); });
      card.querySelector("[data-del]").addEventListener("click", (e) => { e.stopPropagation(); removeImage(img); });
      grid.appendChild(card);
    });
  }

  /* ---------- 편집 ---------- */
  function openEdit(img) {
    editingId = img.id;
    $("editTitle").value = img.title;
    $("editAi").value = img.ai_tool || window.APP_CONFIG.AI_TOOLS[0];
    $("editDesc").value = img.description || "";
    // 카테고리 체크박스 상태 복원
    const cats = Array.isArray(img.category) ? img.category : [];
    document.querySelectorAll("#editCategoryChecks input[type=checkbox]").forEach((c) => {
      c.checked = cats.includes(c.value);
    });
    $("editError").hidden = true;
    APP.openModal(editModal);
  }

  $("editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editingId) return;

    const categories = [...document.querySelectorAll("#editCategoryChecks input:checked")].map((c) => c.value);
    if (categories.length === 0) {
      $("editError").textContent = "카테고리를 1개 이상 선택해 주세요."; $("editError").hidden = false; return;
    }

    const btn = $("editSubmit");
    btn.disabled = true; btn.textContent = "저장 중...";

    const { error } = await sb.from("images").update({
      title: $("editTitle").value.trim(),
      category: categories,
      ai_tool: $("editAi").value,
      description: $("editDesc").value.trim() || null,
    }).eq("id", editingId);

    btn.disabled = false; btn.textContent = "저장";

    if (error) { $("editError").textContent = "수정 실패: " + error.message; $("editError").hidden = false; return; }

    APP.closeModal(editModal);
    editingId = null;
    await loadMyImages(); // 즉시 반영
  });

  /* ---------- 삭제 (Storage + DB) ---------- */
  async function removeImage(img) {
    if (!confirm(`"${img.title}" 사진을 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return;

    // 1) Storage 파일 삭제 (public URL에서 경로 추출)
    try {
      const marker = `/object/public/${window.APP_CONFIG.STORAGE_BUCKET}/`;
      const idx = img.image_url.indexOf(marker);
      if (idx !== -1) {
        const path = decodeURIComponent(img.image_url.slice(idx + marker.length));
        await sb.storage.from(window.APP_CONFIG.STORAGE_BUCKET).remove([path]);
      }
    } catch (e) { /* 파일 삭제 실패해도 DB는 진행 */ }

    // 2) DB 행 삭제 (RLS: 본인 것만)
    const { error } = await sb.from("images").delete().eq("id", img.id);
    if (error) { alert("삭제 실패: " + error.message); return; }

    await loadMyImages();
  }
});
