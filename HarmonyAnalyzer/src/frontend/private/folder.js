// DOM
const fileListContainer = document.getElementById("fileList");
const MicBtn = document.getElementById("micBtn");
const FldBtn = document.getElementById("fldBtn");
const SetBtn = document.getElementById("setBtn");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const viewToggle = document.getElementById("viewToggle");
const countText = document.getElementById("countText");
const breadcrumb = document.querySelector(".breadcrumbs .current");
const noResults = document.getElementById("noResults");
const analyzeBtn = document.getElementById("analyzeBtn");
const deleteBtn = document.getElementById("deleteBtn");//ADD


// 設定保存キー
const STORAGE_KEY = {
  SEARCH: "folder_search",
  SORT: "folder_sort",
  VIEW: "folder_view"
};

// 選択中のファイル
let selectedSoundId = [];




// URL パラメータ取得
function getFolderPathFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("path")) {
    return params.get("path");
  }

  // ログインユーザー情報から団体名を取得
  const userData = localStorage.getItem("user");
  if (userData) {
    const user = JSON.parse(userData);
    return user.organization_name || "団体未設定";
  }

  return "団体未設定"; // fallback
}


// API 取得
async function fetchFolderItems(folderPath) {
  const userData = JSON.parse(localStorage.getItem("user"));
  const orgName = userData?.organization_name;

  const url = `/api/folder/list-files/${encodeURIComponent(folderPath)}`;
  const response = await fetch(url, {
    headers: { "x-org-name": encodeURIComponent(orgName) }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}


function formatBreadcrumbPath(path) {
  const parts = path.split("/");
  return parts.map(p => {
    // 曲名フォルダは "曲名_テンポ_拍子" の形式
    const m = p.match(/^(.+?)_(\d+)_([\d/]+)$/);
    if (m) {
      return m[1]; // 曲名だけ返す
    }
    return p;
  }).join("/");
}


// フォルダ一覧用：表示名を加工
function getFolderDisplayName(name, isDirectory) {
  if (isDirectory) {
    // 曲名フォルダ判定
    const m = name.match(/^(.+?)_(\d+)_([\d/]+)$/);
    if (m) {
      const title = m[1];
      const tempo = m[2];
      const meter = m[3];
      return `${title}　テンポ: ${tempo}　拍子: ${meter}`;
    }
  }
  // 通常はそのまま
  return getDisplayName(name);
}



// 描画
function renderItems(items, { search, sort, view }) {
  let filtered = items.filter(it => it.name?.toLowerCase().includes(search?.toLowerCase()));

  // ソート
  if (sort === "name-asc") filtered.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  if (sort === "name-desc") filtered.sort((a, b) => b.name.localeCompare(a.name, "ja"));
  if (sort === "date-asc") filtered.sort((a, b) => new Date(a.mtime) - new Date(b.mtime));
  if (sort === "date-desc") filtered.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));

  // 件数
  countText.textContent = `${filtered.length} 件`;

  // 表示切替
  fileListContainer.classList.toggle("grid-view", view === "grid");
  fileListContainer.classList.toggle("list-view", view === "list");

  // 内容クリア
  fileListContainer.innerHTML = "";
  noResults.classList.add("hidden");

  if (filtered.length === 0) {
    noResults.classList.remove("hidden");
    return;
  }

  // アイテム描画
  for (const item of filtered) {
    if (!item.is_directory && !item.name.match(/\.webm$/i)) continue;
    
    const el = document.createElement("div");
    el.className = "file-item";
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", item.name);

    const icon = document.createElement("img");
    icon.className = "file-icon";
    icon.src = item.is_directory ? "image/folder-icon.png" : "image/file-icon.png";
    icon.alt = item.is_directory ? "フォルダ" : "ファイル";

    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = getDisplayName(item.name, item.is_directory);

    el.appendChild(icon);
    el.appendChild(name);

    if (item.is_directory) {
      el.addEventListener("click", () => {
        const newPath = `${getFolderPathFromUrl()}/${item.name}`;
        history.pushState({ path: newPath }, "", `?path=${encodeURIComponent(newPath)}`);
        loadFolder(newPath);
      });
    } else {
      el.addEventListener("click", () => toggleFileSelection(item.soundId, el));
    }

    el.addEventListener("keydown", ev => {
      if (ev.key === "Enter") el.click();
    });

    fileListContainer.appendChild(el);
  }
}

//ADD
// 選択トグル
function toggleFileSelection(soundId, element) {
  const idx = selectedSoundId.indexOf(soundId);
  if (idx >= 0) {
    selectedSoundId.splice(idx, 1);
    element.classList.remove("selected");
  } else {
    selectedSoundId.push(soundId);
    element.classList.add("selected");
  }
  updateButtons(); 
}

//ADD
// 分析ボタン更新
function updateButtons() { //関数名変更しました
  if (selectedSoundId.length === 0) {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "分析を見る";
    deleteBtn.disabled = true; 
    deleteBtn.textContent = "選択した音源を削除";
  } else {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = `分析を見る (${selectedSoundId.length})`;
    deleteBtn.disabled = false; 
    deleteBtn.textContent = `選択した音源を削除 (${selectedSoundId.length})`;
  }
}



function formatBreadcrumbPath(path) {
  const parts = path.split("/");
  return parts.map((part, idx) => {
    // 曲名フォルダのとき（例: SongName_120_4-4）
    const m = part.match(/^(.+?)_(\d+)_([\d-]+)$/);
    if (m && idx >= 2) { 
      return m[1]; // 曲名だけ返す
    }
    return part;
  }).join("/");
}



// フォルダ読み込み
async function loadFolder(folderPath) {
  if (breadcrumb) breadcrumb.textContent = formatBreadcrumbPath(folderPath);
  selectedSoundId = [];
  updateButtons();
  
  const search = localStorage.getItem(STORAGE_KEY.SEARCH) || "";
  const sort = localStorage.getItem(STORAGE_KEY.SORT) || "date-desc";
  const view = localStorage.getItem(STORAGE_KEY.VIEW) || "list";

  searchInput.value = search;
  sortSelect.value = sort;
  viewToggle.value = view;

  try {
    document.body.classList.add("processing-lock");
    const items = await fetchFolderItems(folderPath);
    renderItems(items, { search, sort, view });

    // イベント
    searchInput.oninput = e => {
      const v = e.target.value;
      localStorage.setItem(STORAGE_KEY.SEARCH, v);
      renderItems(items, { search: v, sort: sortSelect.value, view: viewToggle.value });
    };
    sortSelect.onchange = e => {
      localStorage.setItem(STORAGE_KEY.SORT, e.target.value);
      renderItems(items, { search: searchInput.value, sort: e.target.value, view: viewToggle.value });
    };
    viewToggle.onchange = e => {
      localStorage.setItem(STORAGE_KEY.VIEW, e.target.value);
      renderItems(items, { search: searchInput.value, sort: sortSelect.value, view: e.target.value });
    };
  } catch (err) {
    console.error("フォルダ取得失敗:", err);
    fileListContainer.innerHTML = "<p>フォルダリストの取得に失敗しました。</p>";
  } finally {
    document.body.classList.remove("processing-lock");
  }
}

// 初期化
document.addEventListener("DOMContentLoaded", () => {
  const folderPath = getFolderPathFromUrl();
  loadFolder(folderPath);
});

// popstate対応
window.addEventListener("popstate", ev => {
  const path = ev.state?.path || getFolderPathFromUrl();
  loadFolder(path);
});

// ナビボタン
MicBtn.addEventListener("click", () => location.href = "../recording");
FldBtn.addEventListener("click", () => location.href = "../folder");
SetBtn.addEventListener("click", () => location.href = "../setting");

// 分析ボタン
analyzeBtn.addEventListener("click", () => {
  if (selectedSoundId.length === 0) return;
  console.log(`selectedSoundId: ${selectedSoundId}`);
  location.href = `/feedback/?ids=${selectedSoundId.join(',')}`;
  /*
  const form = document.createElement("form");
  form.method = "GET";
  form.action = `/files/items?ids=${selectedSoundId.join(',')}`;

  for (const f of selectedSoundId) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "files[]";
    input.value = f;
    form.appendChild(input);
  }

  const originInput = document.createElement("input");
  originInput.type = "hidden";
  originInput.name = "origin";
  originInput.value = getFolderPathFromUrl();
  form.appendChild(originInput);

  document.body.appendChild(form);
  form.submit();
  */
});


//ADD
// 削除ボタンイベントリスナーの追加
deleteBtn.addEventListener("click", async () => {
  if (selectedSoundId.length === 0) return;

  const confirmation = window.confirm(`本当に${selectedSoundId.length}件の音源を削除しますか？`);
  if (!confirmation) {
    return;
  }

  try {
    const response = await fetch('/api/folder/delete-files', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: selectedSoundId }),
    });

    if (!response.ok) {
      throw new Error('削除に失敗しました。');
    }

    alert('音源が正常に削除されました。');
    loadFolder(getFolderPathFromUrl());
  } catch (error) {
    console.error('削除エラー:', error);
    alert('音源の削除中にエラーが発生しました。');
  }
});




document.addEventListener("DOMContentLoaded", () => {
  const userData = localStorage.getItem("user");
  if (userData) {
    const user = JSON.parse(userData);
  }

  const folderPath = getFolderPathFromUrl();
  loadFolder(folderPath);
});




function formatDisplayName(userName, timestamp) {
  const year = timestamp.slice(0, 4);
  const month = timestamp.slice(4, 6);
  const day = timestamp.slice(6, 8);
  const hour = timestamp.slice(8, 10);
  const minute = timestamp.slice(10, 12);

  return `${userName}_${year}_${month}_${day}_${hour}:${minute}.wav`;
}

function getDisplayName(fileName, isDirectory = false) {
  if (isDirectory) {
    // 曲名_テンポ_拍子 の形式かチェック
    const m = fileName.match(/^(.+?)_(\d+)_([\d-]+)$/);
    if (m) {
      const song = m[1];
      const tempo = m[2];
      const meter = m[3].replace("-", "/"); // 4-4 → 4/4
      return `${song}　　(テンポ：${tempo}　拍子：${meter})`;
    }
    return fileName;
  } else {
    // 音源ファイル名 (user_yyyymmdd_HHMMSS.拡張子)
    const m = fileName.match(/^(.+?)_(\d{8})_(\d{6})\.(wav|webm|pkl)$/);
    if (m) {
      const userName = m[1];
      const date = m[2]; // yyyymmdd
      const time = m[3]; // HHMMSS

      const year = date.slice(0, 4);
      const month = date.slice(4, 6);
      const day = date.slice(6, 8);
      const hour = time.slice(0, 2);
      const minute = time.slice(2, 4);
      // 秒は使わない
      return `${userName}_${year}_${month}_${day}_${hour}:${minute}`;
    }
    return fileName;
  }
}

