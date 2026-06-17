/* =========================================================
   gallery.js — 갤러리 + 검색 + 사이드바 다중 필터 (gallery.html)
   - 검색: 제목 부분일치(ilike)
   - 필터: AI 툴(다중) + 카테고리(다중), 검색과 동시 적용
   - AI는 .in(), 카테고리(배열)는 .contains() (선택한 카테고리를 모두 포함해야 표시)
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const gallery = document.getElementById("gallery");
  if (!gallery) return;

  const $ = (id) => document.getElementById(id);
  const SHOW_LIMIT = 8;

  const status = $("statusMsg");
  const empty = $("emptyMsg");
  const countEl = $("galleryCount");
  const badge = $("filterCount");

  let term = "";
  let sort = "recent"; // "recent" | "popular"
  const selAi = new Set();
  const selCat = new Set();

  /* ---------- 정렬 (하나만 선택) ---------- */
  const sortRecent = $("sortRecent");
  const sortPopular = $("sortPopular");
  function setSort(s) {
    sort = s;
    sortRecent.checked = s === "recent";
    sortPopular.checked = s === "popular";
    load();
  }
  sortRecent.addEventListener("change", () => setSort("recent"));
  sortPopular.addEventListener("change", () => setSort("popular"));

  /* ---------- 필터 체크리스트 생성 ---------- */
  // AI: 그룹별
  buildGroupedChecks($("aiFilterList"), window.APP_CONFIG.AI_TOOL_GROUPS, selAi);
  applyShowMore($("aiFilterList"), $("aiShowMore"), SHOW_LIMIT);
  // 카테고리: 평탄
  buildFlatChecks($("catFilterList"), window.APP_CONFIG.CATEGORIES, selCat);
  applyShowMore($("catFilterList"), $("catShowMore"), SHOW_LIMIT);

  function checkItem(value, set) {
    const label = document.createElement("label");
    label.className = "check-item";
    label.innerHTML =
      `<input type="checkbox" value="${APP.escapeHtml(value)}"><span>${APP.escapeHtml(value)}</span>`;
    label.querySelector("input").addEventListener("change", (e) => {
      e.target.checked ? set.add(value) : set.delete(value);
      updateBadge();
      load();
    });
    return label;
  }
  function buildFlatChecks(container, items, set) {
    container.innerHTML = "";
    items.forEach((v) => container.appendChild(checkItem(v, set)));
  }
  function buildGroupedChecks(container, groups, set) {
    container.innerHTML = "";
    groups.forEach((g) => {
      const wrap = document.createElement("div");
      wrap.className = "filter-group";
      const lbl = document.createElement("div");
      lbl_text(lbl, g.label);
      wrap.appendChild(lbl);
      g.tools.forEach((t) => wrap.appendChild(checkItem(t, set)));
      container.appendChild(wrap);
    });
  }
  function lbl_text(el, text) { el.className = "filter-group-label"; el.textContent = text; }

  /* ---------- 더 보기 / 접기 ---------- */
  function applyShowMore(container, btn, limit) {
    const items = [...container.querySelectorAll(".check-item")];
    if (items.length <= limit) { btn.hidden = true; return; }
    let expanded = false;
    const apply = () => {
      items.forEach((it, i) => it.classList.toggle("extra-hidden", !expanded && i >= limit));
      container.querySelectorAll(".filter-group").forEach((g) => {
        const gi = [...g.querySelectorAll(".check-item")];
        g.classList.toggle("extra-hidden", gi.length > 0 && gi.every((it) => it.classList.contains("extra-hidden")));
      });
      btn.textContent = expanded ? "접기" : "더 보기";
    };
    btn.hidden = false;
    btn.addEventListener("click", () => { expanded = !expanded; apply(); });
    apply();
  }

  /* ---------- 섹션 접기/펼치기 ---------- */
  document.querySelectorAll("[data-section-toggle]").forEach((head) => {
    head.addEventListener("click", () => {
      const sec = head.closest(".filter-section");
      sec.dataset.open = sec.dataset.open === "1" ? "0" : "1";
    });
  });

  /* ---------- 카운트 뱃지 ---------- */
  function updateBadge() {
    const n = selAi.size + selCat.size;
    badge.textContent = n;
    badge.hidden = n === 0;
  }

  /* ---------- 리셋 ---------- */
  $("filterReset").addEventListener("click", () => {
    selAi.clear(); selCat.clear();
    document.querySelectorAll(".filter-panel input[type=checkbox]").forEach((c) => (c.checked = false));
    $("searchInput").value = ""; term = "";
    sort = "recent"; sortRecent.checked = true; sortPopular.checked = false; // 정렬 기본값 복귀
    updateBadge();
    load();
  });

  /* ---------- 모바일 슬라이드 ---------- */
  const panel = $("filterPanel");
  const backdrop = $("filterBackdrop");
  const openPanel = () => { panel.classList.add("open"); backdrop.hidden = false; };
  const closePanel = () => { panel.classList.remove("open"); backdrop.hidden = true; };
  $("filterToggle").addEventListener("click", openPanel);
  $("filterClose").addEventListener("click", closePanel);
  backdrop.addEventListener("click", closePanel);

  /* ---------- 검색 (디바운싱 500ms) ---------- */
  let timer = null;
  $("searchInput").addEventListener("input", (e) => {
    clearTimeout(timer);
    term = e.target.value.trim();
    timer = setTimeout(load, 500);
  });

  // 현재 정렬/필터가 적용된 새 쿼리 생성
  function baseQuery() {
    let q = sb.from("images")
      .select("id, user_id, image_url, title, description, category, ai_tool, created_at, likes_count, views_count, downloads_count, reports_count, users(name, level)");
    // 정렬: 인기순 또는 시간순(최신)
    if (sort === "popular") q = q.order("popularity", { ascending: false }).order("created_at", { ascending: false });
    else q = q.order("created_at", { ascending: false });
    if (selAi.size) q = q.in("ai_tool", [...selAi]);
    // 선택한 카테고리를 "모두" 포함 (AND)
    if (selCat.size) q = q.contains("category", [...selCat]);
    return q;
  }

  /* ---------- 로드 + 렌더 ---------- */
  async function load() {
    if (!window.sb) { status.hidden = false; status.textContent = "⚠️ config.js에 Supabase 정보를 입력하세요."; return; }
    status.hidden = false; status.textContent = "불러오는 중..."; empty.hidden = true;

    let rows;
    if (term) {
      // 단어별 OR 검색용 tsquery (특수문자 제거)
      const tsq = term.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean).join(" | ");
      // 1) Full-Text Search  2) ilike 부분일치 — 합쳐서 중복 제거 (FTS 우선)
      const [fts, ilk] = await Promise.all([
        tsq ? baseQuery().textSearch("search_vector", tsq, { config: "simple" }) : Promise.resolve({ data: [] }),
        baseQuery().ilike("title", `%${term}%`),
      ]);
      if (fts.error && ilk.error) { status.textContent = "불러오기 실패: " + (fts.error || ilk.error).message; return; }
      const seen = new Set();
      rows = [];
      [...(fts.data || []), ...(ilk.data || [])].forEach((r) => {
        if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); }
      });
    } else {
      const { data, error } = await baseQuery();
      if (error) { status.textContent = "불러오기 실패: " + error.message; return; }
      rows = data || [];
    }

    status.hidden = true;
    render(rows);
  }

  function render(list) {
    countEl.textContent = term ? `${list.length}개의 결과` : `총 ${list.length}개의 이미지`;
    gallery.innerHTML = "";
    empty.hidden = list.length !== 0;
    if (list.length === 0) {
      const t = empty.querySelector(".empty-title");
      const s = empty.querySelector(".empty-sub");
      if (term) { t.textContent = "검색 결과가 없어요"; s.textContent = "다른 키워드로 검색해보세요"; }
      else { t.textContent = "조건에 맞는 사진이 없어요"; s.textContent = "필터를 바꾸거나 첫 작품을 공유해 보세요!"; }
    }

    list.forEach((img, i) => {
      const card = APP.buildImageCard(img);
      card.style.animationDelay = `${i * 0.03}s`;
      gallery.appendChild(card);
    });
  }

  load();
});
