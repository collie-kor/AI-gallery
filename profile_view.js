/* =========================================================
   profile_view.js — 다른 유저의 공개 프로필 (profile_view.html)
   ?id=<user_id> 로 진입. 본인이면 마이페이지로 리다이렉트.
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("pvGrid");
  if (!grid) return;

  const $ = (id) => document.getElementById(id);
  const status = $("pvStatus");

  const params = new URLSearchParams(location.search);
  const targetId = params.get("id");
  if (!targetId) { window.location.href = "gallery.html"; return; }

  // 헤더 인증 상태가 먼저 세팅되도록 잠깐 대기 후 본인 여부 판단
  const me = await Auth.getUser();
  APP.currentUser = me || null;
  if (me && me.id === targetId) { window.location.href = "profile.html"; return; }

  if (!window.sb) { status.textContent = "⚠️ config.js 설정이 필요합니다."; return; }

  // 1) 유저 프로필
  const { data: u, error } = await sb.from("users")
    .select("id, name, level, total_score").eq("id", targetId).maybeSingle();
  if (error || !u) { status.textContent = "존재하지 않는 유저입니다."; return; }

  status.hidden = true;
  $("pvHead").hidden = false;
  $("pvName").textContent = u.name || "익명";
  setBadge($("pvLevelBadge"), u.level || "Beginner");
  $("pvScore").textContent = u.total_score || 0;

  // 2) 카운트 (업로드/팔로워/팔로잉)
  const [up, fr, fg] = await Promise.all([
    sb.from("images").select("*", { count: "exact", head: true }).eq("user_id", targetId),
    sb.from("follows").select("*", { count: "exact", head: true }).eq("following_id", targetId),
    sb.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", targetId),
  ]);
  $("pvUploads").textContent = up.count || 0;
  $("pvFollowers").textContent = fr.count || 0;
  $("pvFollowing").textContent = fg.count || 0;
  $("pvFollowersBtn").addEventListener("click", () => APP.showFollowList("followers", targetId));
  $("pvFollowingBtn").addEventListener("click", () => APP.showFollowList("following", targetId));

  // 3) 팔로우 버튼 (로그인 시에만, 본인 아님은 이미 보장)
  const fbtn = $("profileFollowBtn");
  if (me) {
    fbtn.hidden = false;
    const { data: rel } = await sb.from("follows").select("id")
      .eq("follower_id", me.id).eq("following_id", targetId).maybeSingle();
    renderFollow(!!rel);
    fbtn.addEventListener("click", async () => {
      const following = fbtn.dataset.following === "1";
      if (following) {
        await sb.from("follows").delete().eq("follower_id", me.id).eq("following_id", targetId);
        renderFollow(false);
        $("pvFollowers").textContent = Math.max(0, Number($("pvFollowers").textContent) - 1);
      } else {
        const { error: e2 } = await sb.from("follows").insert({ follower_id: me.id, following_id: targetId });
        if (e2) return;
        renderFollow(true);
        $("pvFollowers").textContent = Number($("pvFollowers").textContent) + 1;
      }
    });
  }

  // 4) 이미지 갤러리
  $("pvGalleryTitle").hidden = false;
  const { data: imgs } = await sb.from("images")
    .select("id, user_id, image_url, title, description, category, ai_tool, created_at, likes_count, views_count, downloads_count, reports_count, users(name, level)")
    .eq("user_id", targetId)
    .order("created_at", { ascending: false });

  $("pvEmpty").hidden = (imgs && imgs.length) ? true : false;
  (imgs || []).forEach((img) => grid.appendChild(APP.buildImageCard(img)));

  /* ---- helpers ---- */
  function renderFollow(following) {
    fbtn.dataset.following = following ? "1" : "0";
    fbtn.textContent = following ? "팔로잉" : "+ 팔로우";
    fbtn.classList.toggle("following", following);
  }
  function setBadge(el, level) {
    if (!el) return;
    el.className = "level-badge lvl-" + (level || "Beginner").toLowerCase();
    el.textContent = level || "Beginner";
  }
});
