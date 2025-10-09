const MicBtn = document.getElementById('micBtn');
const FldBtn = document.getElementById('fldBtn');
const SetBtn = document.getElementById('setBtn');
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");


//保存しておいたユーザー情報を取り出して表示
document.addEventListener("DOMContentLoaded", () => {
  const userData = localStorage.getItem("user");
  if (userData) {
    const user = JSON.parse(userData);
    document.getElementById("userName").textContent = `ユーザー名: ${user.name}`;
    document.getElementById("orgName").textContent = `団体名: ${user.organization_name}`;
  }
});



//ログアウト処理
logoutBtn.addEventListener("click", async () => {
  localStorage.removeItem("user");
    try {
    const res = await fetch("../api/setting/logout", {
      method: 'POST',
      credentials: 'include' // Cookieをサーバーに送るために必要
    });

    const data = await res.json();
    if (data.success) {
      alert('ログアウトしました');
      // 必要なら画面遷移
      window.location.href = '../login';
    }
  } catch (err) {
    console.error(err);
  }
});



MicBtn.addEventListener('click', () => location.href = "../recording");
FldBtn.addEventListener('click', () => location.href = "../folder");
SetBtn.addEventListener('click', () => location.href = "../setting");
