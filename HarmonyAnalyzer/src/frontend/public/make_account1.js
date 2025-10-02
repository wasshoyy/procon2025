const newMakeBtn = document.getElementById('newMakeBtn');

newMakeBtn.addEventListener("click", async () => {
  const orgName = document.getElementById("name_org").value.trim();
  const inviteCode = document.getElementById("invite_code").value.trim();
  const error = document.getElementById("error");

  error.classList.remove("show"); // 念のため最初に非表示



  if (!orgName || !inviteCode) {
  error.classList.add("show");
  error.innerText = "すべての項目を入力してください";
  return;
  }


  try {
    const response = await fetch(`../api/make_account1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({orgName, inviteCode }),
    });
    const result = await response.json();

    if (result.success) {
      location.href = "../login";
    } else {
      error.classList.add("show");
      error.innerText = result.message || "団体作成に失敗しました";
    }

  } catch (e) {
    error.classList.add("show");
    error.innerText = "サーバーエラーが発生しました";
    console.error(e);
  }
});