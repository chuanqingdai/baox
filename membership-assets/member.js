(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const roles = {
    member: "普通会员",
    angel: "AI大师天使群",
    team: "团队内部成员",
  };
  const english = {
    member: "BAOX MEMBER",
    angel: "AI MASTER ANGEL",
    team: "BAOX INNER CIRCLE",
  };
  let state = null,
    loadError = "",
    nextPath = "/account/",
    mode = "login",
    pendingAvatar = "",
    authDialog;
  const safeNext = (value) =>
    /^\/(?!\/)[a-zA-Z0-9/_-]*(?:#[\w-]*)?$/.test(value || "") &&
    !value.startsWith("/api/")
      ? value
      : "/account/";
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch],
    );
  async function api(action, data, query = {}) {
    const url = new URL("/api/account", location.origin);
    url.searchParams.set("action", action);
    Object.entries(query).forEach(([key, value]) =>
      url.searchParams.set(key, value || ""),
    );
    let response;
    try {
      response = await fetch(url, {
        method: data ? "POST" : "GET",
        credentials: "same-origin",
        headers: data ? { "Content-Type": "application/json" } : {},
        body: data ? JSON.stringify(data) : undefined,
        cache: "no-store",
      });
    } catch {
      throw new Error("网络连接失败，请稍后重试。");
    }
    const result = await response
      .json()
      .catch(() => ({ error: "会员服务暂时不可用，请稍后重试。" }));
    if (!response.ok) {
      const error = new Error(result.error || "操作失败。");
      error.status = response.status;
      throw error;
    }
    return result;
  }
  function avatar(user, classes = "") {
    return user.avatar
      ? `<img class="${classes}" src="${esc(user.avatar)}" alt="${esc(user.nickname)}的头像">`
      : `<span class="${classes}" aria-hidden="true">${esc(user.nickname?.slice(0, 1) || "相")}</span>`;
  }
  function toast(message) {
    document.querySelector(".member-toast")?.remove();
    const el = document.createElement("div");
    el.className = "member-toast";
    el.role = "status";
    el.textContent = message;
    document.body.append(el);
    setTimeout(() => el.remove(), 4000);
  }
  async function imageData(file) {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type))
      throw new Error("请选择 JPG、PNG 或 WebP 图片。");
    if (file.size > 10 * 1024 * 1024) throw new Error("原图不能超过10MB。");
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    if (bitmap.width > 16000 || bitmap.height > 16000) {
      bitmap.close();
      throw new Error("原图尺寸过大，请选用较小的图片。");
    }
    const side = Math.min(bitmap.width, bitmap.height),
      canvas = document.createElement("canvas");
    canvas.width = canvas.height = 320;
    canvas
      .getContext("2d")
      .drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        320,
        320,
      );
    bitmap.close();
    let result = canvas.toDataURL("image/webp", 0.82);
    if (result.length > 115000) result = canvas.toDataURL("image/webp", 0.6);
    if (result.length > 120000)
      throw new Error("头像细节过多，请选用较小的图片。");
    return result;
  }
  function entry() {
    let el = $(".member-entry");
    if (!el) {
      el = document.createElement("div");
      el.className = "member-entry";
      const header = $(".masthead");
      if (header) header.append(el);
      else if (document.body.classList.contains("member-page")) {
        el.classList.add("is-floating");
        document.body.append(el);
      } else return;
    }
    if (state?.user)
      el.innerHTML = `<a href="/account/" aria-label="个人中心">${avatar(state.user, "entry-avatar")}<span class="entry-label">${esc(state.user.nickname)}</span></a>`;
    else {
      el.innerHTML =
        '<button type="button" data-open-login>登录 / 注册</button>';
      el.querySelector("button").onclick = () => openLogin(location.pathname);
    }
  }
  function renderDialog() {
    const register = mode === "register";
    pendingAvatar = "";
    authDialog.innerHTML = `<button class="modal-close" aria-label="关闭登录弹窗" type="button">×</button><p class="member-kicker">BAOX.AI MEMBERSHIP</p><h2>${register ? "加入万相" : "欢迎回来"}</h2><p class="member-note">${register ? "收藏专业，开启更多可能。" : "登录后，继续探索你的万相保藏。"}</p><div class="member-tabs" role="tablist"><button type="button" role="tab" aria-selected="${!register}" data-mode="login">账号登录</button><button type="button" role="tab" aria-selected="${register}" data-mode="register">创建账户</button></div><form class="member-form" id="auth-form">${register ? '<div class="member-avatar-upload"><span class="avatar-circle" id="registration-avatar">相</span><div><button class="avatar-picker" type="button" id="pick-avatar">上传头像（可选）</button><br><small>自动裁切并压缩为方形头像</small></div><input id="registration-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></div>' : ""}<label>账号<input name="username" autocomplete="username" required minlength="4" maxlength="32" pattern="[a-zA-Z][a-zA-Z0-9_]{3,31}" placeholder="4–32位字母、数字或下划线"></label>${register ? '<label>昵称<input name="nickname" autocomplete="nickname" required maxlength="32" placeholder="你希望被如何称呼"></label>' : ""}<label>密码<input name="password" type="password" autocomplete="${register ? "new-password" : "current-password"}" required ${register ? 'minlength="10"' : ""} maxlength="128" placeholder="${register ? "至少10位，包含字母和数字" : "请输入密码"}"></label>${register ? '<label>确认密码<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="10" maxlength="128" placeholder="再次输入密码"></label><small>注册后默认为普通会员，会员权限由管理员分配。</small>' : ""}<p class="member-error" role="alert" id="auth-error"></p><button class="member-button" type="submit">${register ? "创建账户" : "登录"}</button>${register ? "" : "<small>忘记密码？请联系管理员核实身份后处理。</small>"}</form>`;
    $(".modal-close", authDialog).onclick = () => authDialog.close();
    authDialog.querySelectorAll("[data-mode]").forEach(
      (button) =>
        (button.onclick = () => {
          mode = button.dataset.mode;
          renderDialog();
        }),
    );
    if (register) {
      $("#pick-avatar", authDialog).onclick = () =>
        $("#registration-file", authDialog).click();
      $("#registration-file", authDialog).onchange = async (event) => {
        try {
          pendingAvatar = await imageData(event.target.files[0]);
          $("#registration-avatar", authDialog).outerHTML =
            `<img class="avatar-circle" id="registration-avatar" src="${pendingAvatar}" alt="待上传头像">`;
        } catch (e) {
          $("#auth-error", authDialog).textContent = e.message;
        }
      };
    }
    $("#auth-form", authDialog).onsubmit = async (event) => {
      event.preventDefault();
      const form = event.target,
        button = $("[type=submit]", form),
        error = $("#auth-error", form),
        data = Object.fromEntries(new FormData(form));
      error.textContent = "";
      if (register && data.password !== data.confirmPassword) {
        error.textContent = "两次输入的密码不一致。";
        return;
      }
      button.disabled = true;
      button.textContent = register ? "正在创建…" : "正在登录…";
      try {
        await api(mode, { ...data, avatar: pendingAvatar });
        authDialog.close();
        location.assign(safeNext(nextPath));
      } catch (e) {
        error.textContent = e.message;
        button.disabled = false;
        button.textContent = register ? "创建账户" : "登录";
      }
    };
    setTimeout(() => $("[name=username]", authDialog)?.focus(), 50);
  }
  function openLogin(next = "/account/") {
    nextPath = safeNext(next);
    $("#mobile-nav")?.close();
    if (!authDialog) {
      authDialog = document.createElement("dialog");
      authDialog.className = "member-modal";
      authDialog.setAttribute("aria-label", "登录或注册");
      document.body.append(authDialog);
      authDialog.addEventListener("click", (event) => {
        if (event.target === authDialog) {
          const rect = authDialog.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            authDialog.close();
        }
      });
    }
    mode = "login";
    renderDialog();
    if (!authDialog.open) authDialog.showModal();
  }
  document.addEventListener(
    "click",
    async (event) => {
      const anchor = event.target.closest("a[href]");
      if (
        !anchor ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        anchor.target === "_blank"
      )
        return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin) return;
      const page = url.pathname.split("/").filter(Boolean)[0];
      if (
        ![
          "masterclass",
          "poster",
          "collection",
          "tool",
          "about",
          "activity",
          "zhibo",
          "zx202610",
          "2026syx",
          "information",
        ].includes(page)
      )
        return;
      if (page === "collection" && !state?.user) {
        event.preventDefault();
        openLogin(url.pathname + url.hash);
        return;
      }
      const access = state?.access?.find((item) => item.page === page);
      if (access && !access.allowed) {
        event.preventDefault();
        if (!state?.user) openLogin(url.pathname + url.hash);
        else toast("当前会员级别尚未开放该页面，请联系管理员。");
      }
    },
    true,
  );
  async function loadAccount() {
    const root = $("#account-content");
    if (!root) return;
    if (!state?.user) {
      root.innerHTML = `<div class="member-panel narrow"><h2>登录后查看个人中心</h2><p class="member-note">${esc(loadError || "管理你的个人资料、会员身份与账户安全。")}</p><button class="member-button" id="account-login">登录 / 注册</button></div>`;
      $("#account-login").onclick = () => openLogin("/account/");
      return;
    }
    const user = state.user;
    root.innerHTML = `<div class="member-grid"><aside class="member-stack"><section class="member-panel membership-card"><p class="member-kicker">YOUR BAOX IDENTITY</p><div class="member-identity">${avatar(user, "profile-avatar")}<div><h3>${esc(user.nickname)}</h3><p>@${esc(user.username)}</p></div></div><div class="member-badge"><img src="/membership-assets/badge-${user.tier}.svg" alt="${roles[user.tier]}徽章"><span>${roles[user.tier]}<small>${english[user.tier]}</small></span></div><div class="member-meta"><span>加入万相 · ${new Date(user.created_at).toLocaleDateString("zh-CN")}</span>${user.is_admin ? "<span>管理员身份</span>" : ""}</div></section>${user.is_admin ? '<a href="/admin/" class="member-button secondary">进入客户管理后台</a>' : ""}<button class="member-button secondary" id="logout">退出登录</button></aside><div class="member-stack"><section class="member-panel"><h2>个人资料</h2><form class="member-form" id="profile-form"><div class="member-avatar-upload">${avatar(user, "profile-avatar")}<div><button type="button" class="avatar-picker" id="profile-upload">更换头像</button><br><small>自动裁切 · 清晰轻量</small></div><input type="file" id="profile-file" accept="image/jpeg,image/png,image/webp" hidden></div><label>昵称<input name="nickname" value="${esc(user.nickname)}" maxlength="32" required></label><label>账号<input value="${esc(user.username)}" readonly aria-readonly="true"></label><p class="member-error" role="status"></p><div><button class="member-button" type="submit">保存资料</button></div></form></section><section class="member-panel"><h2>为你开放</h2><p class="member-note">你的会员可访问以下页面，权限由管理员统一管理。</p><div class="member-access">${state.access
      .filter((item) => item.allowed)
      .map((item) => `<a href="${item.url}">${esc(item.title)}</a>`)
      .join(
        "",
      )}</div></section><section class="member-panel"><h2>账户安全</h2><form class="member-form" id="password-form"><input name="username" autocomplete="username" value="${esc(user.username)}" hidden><label>当前密码<input name="currentPassword" type="password" autocomplete="current-password" required maxlength="128"></label><label>新密码<input name="password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required placeholder="至少10位，包含字母和数字"></label><label>确认新密码<input name="confirmPassword" type="password" autocomplete="new-password" required maxlength="128"></label><p class="member-error" role="status"></p><div><button class="member-button secondary" type="submit">更新密码</button></div><small>更新后，其他设备上的登录会失效。</small></form></section></div></div>`;
    let profileAvatar = user.avatar;
    $("#profile-upload").onclick = () => $("#profile-file").click();
    $("#profile-file").onchange = async (event) => {
      try {
        profileAvatar = await imageData(event.target.files[0]);
        $("#profile-form .profile-avatar").outerHTML =
          `<img class="profile-avatar" src="${profileAvatar}" alt="新头像预览">`;
      } catch (e) {
        toast(e.message);
      }
    };
    $("#profile-form").onsubmit = async (event) => {
      event.preventDefault();
      await formTask(event.target, async () => {
        const result = await api("profile", {
          nickname: new FormData(event.target).get("nickname"),
          avatar: profileAvatar,
        });
        state.user = result.user;
        entry();
        toast("个人资料已更新");
        await loadAccount();
      });
    };
    $("#password-form").onsubmit = async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target));
      await formTask(event.target, async () => {
        if (data.password !== data.confirmPassword)
          throw new Error("两次输入的密码不一致。");
        await api("password", data);
        event.target.reset();
        toast("密码已更新，其他设备已退出登录");
      });
    };
    $("#logout").onclick = async () => {
      try {
        await api("logout", {});
        location.assign("/");
      } catch (e) {
        toast(e.message);
      }
    };
  }
  async function formTask(form, task) {
    const button = $("[type=submit]", form),
      error = $(".member-error", form);
    button.disabled = true;
    error.textContent = "";
    try {
      await task();
    } catch (e) {
      error.textContent = e.message;
    } finally {
      button.disabled = false;
    }
  }
  let adminPage = 1,
    adminSearch = "",
    adminTier = "";
  async function loadUsers() {
    const root = $("#admin-users");
    if (!root) return;
    const data = await api("users", undefined, {
      search: adminSearch,
      tier: adminTier,
      page: adminPage,
    });
    $("#member-stats").innerHTML =
      `<div class="member-stat"><strong>${data.stats.reduce((sum, item) => sum + item.total, 0)}</strong><span>注册会员</span></div>${Object.entries(
        roles,
      )
        .map(
          ([tier, title]) =>
            `<div class="member-stat"><strong>${data.stats.find((item) => item.tier === tier)?.total || 0}</strong><span>${title}</span></div>`,
        )
        .join("")}`;
    root.innerHTML = data.users.length
      ? data.users
          .map(
            (user) =>
              `<form class="admin-row" data-id="${user.id}"><div class="admin-person">${avatar(user, "entry-initial")}<div><span>${esc(user.nickname)}${user.is_admin ? " · 管理员" : ""}</span><small>@${esc(user.username)} · ${new Date(user.created_at).toLocaleDateString("zh-CN")}</small></div></div><label>会员级别<select name="tier" ${user.is_admin ? "disabled" : ""}>${Object.entries(
                roles,
              )
                .map(
                  ([tier, label]) =>
                    `<option value="${tier}" ${user.tier === tier ? "selected" : ""}>${label}</option>`,
                )
                .join(
                  "",
                )}</select></label><label>账户状态<select name="status" ${user.is_admin ? "disabled" : ""}><option value="active" ${user.status === "active" ? "selected" : ""}>正常</option><option value="disabled" ${user.status === "disabled" ? "selected" : ""}>已停用</option></select></label><label>标签 · 逗号分隔<input name="tags" value="${esc(user.tags.join("，"))}" placeholder="如：上海、课程学员" maxlength="209"></label><button class="member-button secondary" type="submit">保存</button></form>`,
          )
          .join("")
      : '<div class="empty-state">未找到符合条件的会员</div>';
    root.querySelectorAll("form").forEach(
      (form) =>
        (form.onsubmit = async (event) => {
          event.preventDefault();
          const button = $("button", form);
          button.disabled = true;
          try {
            await api("user", {
              id: form.dataset.id,
              tier: $("[name=tier]", form).value,
              status: $("[name=status]", form).value,
              tags: $("[name=tags]", form)
                .value.split(/[,，]/)
                .map((s) => s.trim())
                .filter(Boolean),
            });
            toast("会员信息已保存");
            await loadUsers();
          } catch (e) {
            toast(e.message);
          } finally {
            button.disabled = false;
          }
        }),
    );
    $("#pagination").innerHTML =
      `<button class="member-button secondary" id="previous" ${data.page <= 1 ? "disabled" : ""}>上一页</button><span>第 ${data.page} 页 · 共 ${data.total} 人</span><button class="member-button secondary" id="next" ${data.page * 20 >= data.total ? "disabled" : ""}>下一页</button>`;
    $("#previous").onclick = () => {
      adminPage--;
      loadUsers().catch((e) => toast(e.message));
    };
    $("#next").onclick = () => {
      adminPage++;
      loadUsers().catch((e) => toast(e.message));
    };
  }
  async function loadAdmin() {
    const root = $("#admin-content");
    if (!root) return;
    if (!state?.user?.is_admin) {
      root.innerHTML = `<div class="member-panel narrow"><h2>${state?.user ? "管理员专属" : "请先登录管理员账号"}</h2><p class="member-note">${esc(loadError || "客户资料与权限设置仅对管理员开放。")}</p>${!state?.user ? '<button class="member-button" id="admin-login">管理员登录</button>' : '<a class="member-button secondary" href="/account/">返回个人中心</a>'}</div>`;
      $("#admin-login")?.addEventListener("click", () => openLogin("/admin/"));
      return;
    }
    root.innerHTML = `<div class="member-stats" id="member-stats"></div><div class="member-tabs admin-tabs" role="tablist"><button role="tab" aria-selected="true" data-admin-tab="members">客户管理</button><button role="tab" aria-selected="false" data-admin-tab="permissions">页面权限</button></div><section id="members"><form class="admin-toolbar" id="search-users"><input name="search" aria-label="搜索会员" placeholder="搜索账号、昵称或标签"><select name="tier" aria-label="筛选会员级别"><option value="">全部会员级别</option>${Object.entries(
      roles,
    )
      .map(([tier, title]) => `<option value="${tier}">${title}</option>`)
      .join(
        "",
      )}</select><button class="member-button" type="submit">查询</button></form><div class="admin-list" id="admin-users"></div><div class="admin-pagination" id="pagination"></div></section><section class="member-panel" id="permissions" hidden><h2>会员页面权限</h2><p class="member-note">团队内部成员可访问全部前台页面。勾选“游客”后，该页面对所有人公开；保藏始终要求登录。首页始终公开。<br>保存后立即生效，取消游客访问才会按会员级别限制页面。</p><form id="rules-form"><div class="rules-scroll"><table class="rules-table"><thead><tr><th>页面</th><th>游客</th><th>普通会员</th><th>AI大师天使群</th><th>团队内部成员</th></tr></thead><tbody id="rules-body"></tbody></table></div><p class="member-error" role="status"></p><div class="member-actions"><button class="member-button" type="submit">保存页面权限</button></div></form></section>`;
    root.querySelectorAll("[data-admin-tab]").forEach(
      (button) =>
        (button.onclick = () => {
          root
            .querySelectorAll("[data-admin-tab]")
            .forEach((tab) =>
              tab.setAttribute("aria-selected", String(tab === button)),
            );
          $("#members").hidden = button.dataset.adminTab !== "members";
          $("#permissions").hidden = button.dataset.adminTab !== "permissions";
        }),
    );
    $("#search-users").onsubmit = (event) => {
      event.preventDefault();
      const data = new FormData(event.target);
      adminSearch = data.get("search");
      adminTier = data.get("tier");
      adminPage = 1;
      loadUsers().catch((e) => toast(e.message));
    };
    const data = await api("rules");
    $("#rules-body").innerHTML = Object.entries(data.pages)
      .map(([page, title]) => {
        const rule = data.rules.find((item) => item.page === page);
        return `<tr data-page="${page}"><td>${esc(title)}</td><td><input type="checkbox" data-role="public" aria-label="${esc(title)}游客访问" ${rule?.public ? "checked" : ""} ${page === "collection" ? "disabled" : ""}></td>${["member", "angel"].map((tier) => `<td><input type="checkbox" data-role="${tier}" aria-label="${esc(title)}${roles[tier]}访问" ${rule?.tiers.includes(tier) ? "checked" : ""}></td>`).join("")}<td class="team-lock">始终开放</td></tr>`;
      })
      .join("");
    $("#rules-form").onsubmit = (event) => {
      event.preventDefault();
      formTask(event.target, async () => {
        const rules = [...$("#rules-body").rows].map((row) => ({
          page: row.dataset.page,
          public: $("[data-role=public]", row).checked,
          tiers: [
            "team",
            ...["member", "angel"].filter(
              (tier) => $(`[data-role=${tier}]`, row).checked,
            ),
          ],
        }));
        await api("save-rules", { rules });
        toast("页面权限已更新");
      });
    };
    await loadUsers();
  }
  async function init() {
    entry();
    try {
      state = await api("me");
    } catch (e) {
      loadError = e.message;
    }
    entry();
    await loadAccount();
    await loadAdmin().catch((e) => {
      const el = document.createElement("p");
      el.className = "member-error";
      el.textContent = e.message;
      $("#admin-content").append(el);
    });
    if (document.body.dataset.memberLogin !== undefined) {
      const requested = new URLSearchParams(location.search).get("next");
      nextPath = safeNext(
        requested ||
          (!location.pathname.startsWith("/login")
            ? location.pathname
            : "/account/"),
      );
      if (!state?.user) openLogin(nextPath);
      else if (!location.pathname.startsWith("/login")) location.reload();
      else location.assign(nextPath);
    }
    $("[data-login-launch]")?.addEventListener("click", () =>
      openLogin(nextPath),
    );
  }
  window.BaoxMember = { openLogin };
  init();
})();
