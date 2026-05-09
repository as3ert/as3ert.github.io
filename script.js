/* ========================================================== */
/*  guangxinzhao.com — bits of life support                   */
/* ========================================================== */

(() => {
  // ---- don't let browsers fight us on scroll position ---------
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  // strip any leftover #anchor from the URL so refresh doesn't teleport
  if (location.hash) {
    history.replaceState(null, '', location.pathname + location.search);
  }

  // ---- nav links: scroll without polluting the URL ------------
  document.querySelectorAll('.sections a').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const el = document.getElementById(a.dataset.target);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  // also for in-page anchors inside content (e.g. about → projects)
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    if (a.closest('.sections')) return;
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const el = id && document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // ---- Stuttgart clock (HH:MM:SS) -----------------------------
  const $clock = document.getElementById("clock");
  const tickClock = () => {
    const t = new Date().toLocaleTimeString("en-GB", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    if ($clock) $clock.textContent = t + " CET";
  };
  tickClock();
  setInterval(tickClock, 1000);

  // ---- footer build info -------------------------------------
  const $hash = document.getElementById("build-hash");
  const $date = document.getElementById("build-date");
  // 7-char pseudo-hash that's stable per "session" — looks like a real git short SHA
  const seed = "guangxin-" + (document.lastModified || Date.now());
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  if ($hash) $hash.textContent = Math.abs(h).toString(16).padStart(7, "0").slice(0, 7);

  if ($date) {
    const d = new Date(document.lastModified);
    $date.textContent = d.toISOString().slice(0, 10);
  }

  // ---- section scroll-spy ------------------------------------
  const links = document.querySelectorAll(".sections a");
  const targets = [...links].map((a) =>
    document.getElementById(a.dataset.target)
  );
  if ("IntersectionObserver" in window && targets.every(Boolean)) {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            links.forEach((l) => l.classList.remove("is-active"));
            const idx = targets.indexOf(e.target);
            if (links[idx]) links[idx].classList.add("is-active");
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    targets.forEach((t) => obs.observe(t));
  }

  // ---- vim-ish keyboard nav ----------------------------------
  // j: next section, k: previous, gg: top, G: bottom
  const sectionIds = ["whoami", "about", "projects", "log", "contact"];
  let lastKey = "";
  let lastKeyAt = 0;

  const indexOfNearest = () => {
    const y = window.scrollY + window.innerHeight * 0.3;
    let best = 0;
    sectionIds.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el && el.offsetTop <= y) best = i;
    });
    return best;
  };

  const goto = (i) => {
    const id = sectionIds[Math.max(0, Math.min(sectionIds.length - 1, i))];
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const now = Date.now();
    if (e.key === "j") goto(indexOfNearest() + 1);
    else if (e.key === "k") goto(indexOfNearest() - 1);
    else if (e.key === "G") goto(sectionIds.length - 1);
    else if (e.key === "g") {
      if (lastKey === "g" && now - lastKeyAt < 600) goto(0);
    } else if (e.key === "?") {
      const $i = document.getElementById("prompt-input");
      if ($i) {
        $i.focus();
        $i.value = "help";
        $i.dispatchEvent(new Event("input"));
      }
    }
    lastKey = e.key;
    lastKeyAt = now;
  });

  // ---- terminal prompt: tiny shell ---------------------------
  const $form = document.getElementById("prompt-form");
  const $in = document.getElementById("prompt-input");
  const $out = document.getElementById("term-output");
  if ($form && $in && $out) {
    const print = (html) => {
      $out.innerHTML = html;
    };

    const cmds = {
      help: () =>
        `available: <b>whoami</b>, <b>ls</b>, <b>cat</b> <span style="color:var(--fg-mute)">[file]</span>, <b>contact</b>, <b>cv</b>, <b>sudo</b>, <b>clear</b>, <b>exit</b>`,
      whoami: () =>
        `<b>guangxin</b> · stuttgart, de · uid=1000(as3ert) gid=1000(as3ert) groups=hardware,graphics,coffee`,
      ls: () =>
        `about.md  projects/  contact  cv.pdf  .ssh/  .secrets/`,
      "ls -la": () =>
        `drwx------  .ssh\ndrwx------  .secrets\n-rw-r--r--  about.md\ndrwxr-xr-x  projects\n-rw-r--r--  contact\n-rw-r--r--  cv.pdf`,
      "cat about.md": () => {
        document.getElementById("about").scrollIntoView({ behavior: "smooth" });
        return `<span class="ok">→</span> see <b>~/.about</b> below.`;
      },
      "cat contact": () => {
        document.getElementById("contact").scrollIntoView({ behavior: "smooth" });
        return `<span class="ok">→</span> see <b>~/.contact</b> below.`;
      },
      contact: () =>
        `email: <a href="mailto:as3ertpro@gmail.com" style="color:var(--amber)">as3ertpro@gmail.com</a> · git: <a href="https://github.com/as3ert" target="_blank" rel="noopener" style="color:var(--amber)">github.com/as3ert</a>`,
      cv: () =>
        `cv: <span class="err">file not found</span>. drop a line, i'll send one.`,
      sudo: () =>
        `<span class="err">[sudo] password for guangxin:</span> <span style="color:var(--fg-mute)">(nice try)</span>`,
      "rm -rf /": () =>
        `<span class="err">refused.</span> not on this domain.`,
      vim: () =>
        `:q! <span style="color:var(--fg-mute)">— exited successfully</span>`,
      emacs: () =>
        `<span class="err">heresy detected.</span> see <b>vim</b>.`,
      coffee: () =>
        `☕ brewing… <span style="color:var(--fg-mute)">(this is a no-op but the thought counts)</span>`,
      uname: () => `Linux guangxinzhao.com 6.13.0-amber-crt #1 SMP <span style="color:var(--fg-mute)">x86_64 GNU/Caffeine</span>`,
      uptime: () => `up <b>∞</b> days, load avg: 0.42, 1.13, 0.99`,
      date: () => new Date().toString(),
      pwd: () => `/home/guangxin`,
      exit: () => {
        $out.innerHTML = `logout.<br><span style="color:var(--fg-mute)">connection to guangxinzhao.com closed.</span>`;
        $in.disabled = true;
        return null;
      },
      clear: () => {
        $out.innerHTML = "";
        $in.value = "";
        return null;
      },
    };

    $form.addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = $in.value.trim();
      if (!raw) return;
      const cmd = raw.toLowerCase();
      const fn =
        cmds[cmd] ||
        Object.entries(cmds).find(([k]) => k === cmd || k.startsWith(cmd + " "))?.[1];

      if (fn) {
        const r = fn();
        if (r !== null) print(r);
      } else if (cmd.startsWith("cat ")) {
        print(`cat: <b>${escapeHtml(raw.slice(4))}</b>: <span class="err">no such file</span>`);
      } else if (cmd.startsWith("cd ")) {
        print(`<span style="color:var(--fg-mute)">(this is a single page; you are already home.)</span>`);
      } else {
        print(
          `<span class="err">command not found:</span> ${escapeHtml(raw)} <span style="color:var(--fg-mute)">— try <b>help</b></span>`
        );
      }
      $in.value = "";
    });
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  }
})();
