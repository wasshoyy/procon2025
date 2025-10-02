const loginBtn = document.getElementById("loginBtn");
const MicBtn = document.getElementById('makeBtn');
const MicTBtn = document.getElementById('makeTBtn');//###0908

const helpLink = document.getElementById("helpLink");
const helpPopup = document.getElementById("helpPopup");
const popupClose = document.querySelector(".popup-close")

const error = document.getElementById("error");
let isFailed = false;

// if (!isFailed) {
error.classList.remove("show");
// }

loginBtn.addEventListener("click", async () => {
  const name = document.getElementById("name").value;
  const password = document.getElementById("password").value;
  
  try {
    const response = await fetch(`../api/login`, { // バックエンドURL
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });

    const result = await response.json();

    if (result.success) {
      // ログイン成功
      isFailed = false;
      error.classList.remove("show"); // 念のため消す

      //###0908  返ってきたユーザー情報を localStorage に保存
      localStorage.setItem("user", JSON.stringify(result.user));
      
      window.location.href = "../recording";
    } else {
      // ログイン失敗
      isFailed = true;
      error.classList.add("show"); // 表示する
      // errorMsg.textContent = result.message || "認証に失敗しました";
      // errorMsg.classList.add("show");  // 表示
    }
  } catch (e) {
    isFailed = true;
    error.textContent = "通信エラーが発生しました";
    // error.classList.add("show");  // 表示
  }
});

//###0908変更
makeTBtn.addEventListener("click", () => {
  location.href = "../make_account1";
});

makeBtn.addEventListener("click", () => {
  location.href = "../make_account";
});



helpLink.onclick = () => {
  helpPopup.style.display = "block";
};

popupClose.onclick = () => {
  helpPopup.style.display = "none";
};

window.onclick = (e) => {
  if (e.target !== helpLink && !helpPopup.contains(e.target)) {
    helpPopup.style.display = "none"; // 外をクリックしたら閉じる
  }
};