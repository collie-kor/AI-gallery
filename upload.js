/* =========================================================
   upload.js — 이미지 업로드 (upload.html 전용)
   Storage 업로드 → 공개 URL → images 테이블 insert
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("uploadForm");
  if (!form) return; // 업로드 페이지가 아니면 종료

  const $ = (id) => document.getElementById(id);
  let file = null;

  // AI 툴 드롭다운 채우기 (그룹)
  APP.fillGroupedSelect($("aiInput"), window.APP_CONFIG.AI_TOOL_GROUPS, { placeholder: "AI 툴 선택" });

  // 카테고리 체크박스는 upload.html에 하드코딩되어 있습니다 (36개, 4열).

  // 로그인 필수
  const user = await Auth.requireAuth();
  if (!user) return;

  // 파일 선택 + 미리보기
  $("fileInput").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return err("이미지 파일만 업로드할 수 있습니다.");
    if (f.size > 5 * 1024 * 1024) return err("파일 크기는 5MB 이하여야 합니다.");
    file = f;
    $("previewImg").src = URL.createObjectURL(f);
    $("previewWrap").hidden = false;
    $("uploadError").hidden = true;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!file) return err("사진을 선택해 주세요.");

    const categories = [...document.querySelectorAll("#categoryChecks input:checked")].map((c) => c.value);
    if (categories.length === 0) return err("카테고리를 1개 이상 선택해 주세요.");

    const btn = $("submitBtn");
    btn.disabled = true; btn.textContent = "업로드 중...";

    try {
      // 1) Storage 업로드: <user_id>/<timestamp>.<ext>
      const ext = file.name.split(".").pop().toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage
        .from(window.APP_CONFIG.STORAGE_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;

      // 2) 공개 URL
      const { data: pub } = sb.storage
        .from(window.APP_CONFIG.STORAGE_BUCKET).getPublicUrl(path);

      // 3) DB insert
      const { error: dbErr } = await sb.from("images").insert({
        user_id: user.id,
        image_url: pub.publicUrl,
        title: $("titleInput").value.trim(),
        description: $("descInput").value.trim() || null,
        category: categories,
        ai_tool: $("aiInput").value,
      });
      if (dbErr) throw dbErr;

      // 완료 → 프로필로 이동
      window.location.href = "profile.html";
    } catch (e2) {
      err("업로드 실패: " + (e2.message || e2));
      btn.disabled = false; btn.textContent = "공유하기";
    }
  });

  function err(msg) { const el = $("uploadError"); el.textContent = msg; el.hidden = false; }
});
