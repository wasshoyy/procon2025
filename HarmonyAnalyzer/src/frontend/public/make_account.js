const newMakeBtn = document.getElementById('newMakeBtn');

newMakeBtn.addEventListener("click", async () => {
  const name = document.getElementById("new_name").value;
  const password = document.getElementById("new_password").value;
  const rpassword = document.getElementById("new_rpassword").value;
  const invite_code = document.getElementById("invite_code").value;
  const error = document.getElementById("error");

  error.classList.remove("show"); // 念のため最初に非表示


  if (!name || !invite_code || !password) {
  error.classList.add("show");
  error.innerText = "すべての項目を入力してください";
  return;
  }


  if (password !== rpassword) {
    error.classList.add("show");
    error.innerText = "パスワードが一致しません";
    return;
  }

  try {
    const response = await fetch(`../api/make_account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password , invite_code}),//###0908
    });
    const result = await response.json();

    if (result.success) {
      location.href = "../login";
    } else {
      error.classList.add("show");
      error.innerText = result.message || "アカウント作成に失敗しました";
    }

  } catch (e) {
    error.classList.add("show");
    error.innerText = "サーバーエラーが発生しました";
    console.error(e);
  }
});