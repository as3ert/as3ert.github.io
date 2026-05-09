/* ========================================================== */
/*  guangxinzhao.com — bits of life support                   */
/* ========================================================== */

(() => {
  // ---- keep browser's default scroll-restore on refresh -------
  // strip any leftover #anchor from the URL (so refresh doesn't teleport
  // to a section the user clicked earlier)
  if (location.hash) {
    history.replaceState(null, '', location.pathname + location.search);
  }

  // ---- snap-on-wheel: one scroll input = jump to next section -
  // Browser never gets to scroll natively (preventDefault on every wheel).
  // Our own RAF animator runs the jump in 220ms; snapBusy debounce
  // collapses a multi-event trackpad gesture into a single jump.
  const snapSections = Array.from(document.querySelectorAll("main > section"));
  let snapBusy = false;

  const nearestSectionIdx = () => {
    const probe = window.scrollY + window.innerHeight * 0.35;
    let best = 0;
    snapSections.forEach((s, i) => { if (s.offsetTop <= probe) best = i; });
    return best;
  };

  const animateScrollTo = (targetY, duration = 380) => {
    const startY = window.scrollY;
    const distance = targetY - startY;
    if (Math.abs(distance) < 1) return;
    const startTime = performance.now();
    // cubic ease-in-out — gentle start, fast middle, gentle stop
    const ease = (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      window.scrollTo(0, startY + distance * ease(t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const snapTo = (i) => {
    i = Math.max(0, Math.min(snapSections.length - 1, i));
    const el = snapSections[i];
    if (!el) return;
    snapBusy = true;
    animateScrollTo(el.offsetTop, 380);
    setTimeout(() => { snapBusy = false; }, 420);
  };

  window.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (snapBusy || Math.abs(e.deltaY) < 1) return;
    snapTo(nearestSectionIdx() + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });

  // touch — swipe up/down
  let touchStartY = null;
  window.addEventListener("touchstart", (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener("touchend", (e) => {
    if (touchStartY === null || snapBusy) { touchStartY = null; return; }
    const dy = touchStartY - e.changedTouches[0].clientY;
    touchStartY = null;
    if (Math.abs(dy) < 60) return;
    snapTo(nearestSectionIdx() + (dy > 0 ? 1 : -1));
  }, { passive: true });

  // nav links — explicit click jumps to the section
  document.querySelectorAll(".sections a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const idx = snapSections.findIndex((s) => s.id === a.dataset.target);
      if (idx >= 0) snapTo(idx);
    });
  });
  // in-page anchors inside content (e.g. about → "See projects →")
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    if (a.closest(".sections")) return;
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href").slice(1);
      const el = id && document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
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

  // ---- gutter line numbers: one per [data-line] across page ---
  const $linenos = document.querySelector(".linenos");
  const dataLineEls = document.querySelectorAll("[data-line]");
  const lineSpans = [];

  if ($linenos && dataLineEls.length) {
    $linenos.innerHTML = "";
    dataLineEls.forEach((el, i) => {
      const span = document.createElement("span");
      span.textContent = String(i + 1).padStart(2, "0");
      $linenos.appendChild(span);
      lineSpans.push({ el, span });
    });

    const positionLines = () => {
      lineSpans.forEach(({ el, span }) => {
        // offsetTop is relative to main (which is position:relative)
        span.style.top = (el.offsetTop + 4) + "px";
      });
    };

    const updateActiveLine = () => {
      const probe = window.scrollY + window.innerHeight * 0.25;
      let activeIdx = 0;
      lineSpans.forEach(({ el }, i) => {
        if (el.getBoundingClientRect().top + window.scrollY <= probe) activeIdx = i;
      });
      lineSpans.forEach(({ span }, i) =>
        span.classList.toggle("is-active", i === activeIdx)
      );
    };

    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; updateActiveLine(); }); };

    const init = () => { positionLines(); updateActiveLine(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(init);
    window.addEventListener("load", init);
    window.addEventListener("resize", init);
    window.addEventListener("scroll", onScroll, { passive: true });
    init();
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
  // 'cat', 'whoami', 'uname' actually fetch real files at the
  // root — try `curl https://guangxinzhao.com/about.md` from a real
  // terminal, the page is just one of many readers.
  const $form = document.getElementById("prompt-form");
  const $in = document.getElementById("prompt-input");
  const $out = document.getElementById("term-output");

  // file resolver: maps shell-y filenames to real URLs
  const fileMap = {
    "about":      "/about.md",
    "about.md":   "/about.md",
    ".about":     "/about.md",
    "~/.about":   "/about.md",
    "contact":    "/contact.md",
    "contact.md": "/contact.md",
    ".contact":   "/contact.md",
    "~/.contact": "/contact.md",
    "projects":   "/projects.md",
    "projects.md":"/projects.md",
    "cv":         "/cv.md",
    "cv.md":      "/cv.md",
    "cv.pdf":     "/cv.md",
    "whoami":     "/whoami.txt",
    "uname":      "/uname.txt",
    "uname.txt":  "/uname.txt",
  };

  const cache = new Map();
  const fetchText = async (url) => {
    if (cache.has(url)) return cache.get(url);
    try {
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) return null;
      const t = await r.text();
      cache.set(url, t);
      return t;
    } catch (_) { return null; }
  };

  const print = (html) => { $out.innerHTML = html; };

  // tiny markdown → html renderer (just enough to make cat output feel
  // alive: # headings, `code`, **bold**, [text](url), auto-link email/url)
  const renderMd = (text) => {
    let s = escapeHtml(text);
    // # heading at start of line
    s = s.replace(/^# (.+)$/gm, '<span class="md-h">$1</span>');
    // ## subheading
    s = s.replace(/^## (.+)$/gm, '<span class="md-h2">$1</span>');
    // markdown links [text](url) — process before raw URL auto-link
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // inline `code`
    s = s.replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>');
    // **bold**
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    // auto-link emails (avoid double-wrapping)
    s = s.replace(/(^|[\s>(])([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      '$1<a href="mailto:$2">$2</a>');
    // auto-link bare https?:// urls
    s = s.replace(/(^|[\s>(])((?:https?:\/\/)[^\s<)]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    // auto-link bare github.com/... refs
    s = s.replace(/(^|[\s>(])(github\.com\/[a-zA-Z0-9._\/-]+)/g,
      '$1<a href="https://$2" target="_blank" rel="noopener">$2</a>');
    return s;
  };

  const printFile = async (label, url, fallback) => {
    print(`<span class="term-head">$ ${escapeHtml(label)}</span>\n<span class="term-rule">─── reading ${escapeHtml(url)} ───</span>`);
    const t = await fetchText(url);
    if (t === null) {
      print(fallback || `<span class="err">i/o error:</span> ${escapeHtml(url)}`);
      return;
    }
    print(
      `<span class="term-head">$ ${escapeHtml(label)}</span>\n` +
      `<span class="term-rule">─── ${escapeHtml(url)} ───</span>\n` +
      `<span class="term-body">${renderMd(t)}</span>`
    );
  };

  // ---- tab completion + arrow-key history -------------------
  const COMMANDS = [
    "about", "cat", "cd", "clear", "coffee", "contact", "cv", "date",
    "emacs", "exit", "help", "logout", "ls", "pwd", "sudo", "uname",
    "uptime", "vim", "whoami",
  ];
  const FILES = [
    "about", "about.md", ".about",
    "contact", "contact.md", ".contact",
    "projects", "projects.md",
    "cv", "cv.md",
    "whoami.txt", "uname.txt",
  ];
  const cmdHistory = [];
  let histIdx = 0;
  const longestCommonPrefix = (arr) => {
    if (!arr.length) return "";
    let p = arr[0];
    for (const s of arr) {
      while (s.toLowerCase().indexOf(p.toLowerCase()) !== 0) {
        p = p.slice(0, -1);
        if (!p) return "";
      }
    }
    return p;
  };

  if ($in) {
    $in.addEventListener("keydown", (e) => {
      // Tab — autocomplete
      if (e.key === "Tab") {
        e.preventDefault();
        const val = $in.value;
        let pool, prefix, build;
        if (val.startsWith("cat ")) {
          prefix = val.slice(4);
          pool = FILES;
          build = (s) => "cat " + s;
        } else {
          prefix = val;
          pool = COMMANDS;
          build = (s) => s + (s === "cat" ? " " : "");
        }
        const matches = pool.filter((c) =>
          c.toLowerCase().startsWith(prefix.toLowerCase())
        );
        if (matches.length === 1) {
          $in.value = build(matches[0]);
        } else if (matches.length > 1) {
          const lcp = longestCommonPrefix(matches);
          if (lcp.length > prefix.length) {
            $in.value = build(lcp);
          } else {
            // print options under prompt
            const items = matches
              .map((m) => `<span style="color:var(--fg)">${escapeHtml(m)}</span>`)
              .join("  ");
            print(items);
          }
        } else if (val === "") {
          // empty + tab → show all commands
          const items = COMMANDS
            .map((m) => `<span style="color:var(--fg)">${escapeHtml(m)}</span>`)
            .join("  ");
          print(items);
        }
        return;
      }

      // ArrowUp / ArrowDown — history navigation
      if (e.key === "ArrowUp") {
        if (!cmdHistory.length) return;
        e.preventDefault();
        histIdx = Math.max(0, histIdx - 1);
        $in.value = cmdHistory[histIdx] || "";
        // place cursor at end
        requestAnimationFrame(() => {
          $in.setSelectionRange($in.value.length, $in.value.length);
        });
        return;
      }
      if (e.key === "ArrowDown") {
        if (!cmdHistory.length) return;
        e.preventDefault();
        if (histIdx < cmdHistory.length - 1) {
          histIdx += 1;
          $in.value = cmdHistory[histIdx];
        } else {
          histIdx = cmdHistory.length;
          $in.value = "";
        }
        requestAnimationFrame(() => {
          $in.setSelectionRange($in.value.length, $in.value.length);
        });
      }
    });
  }

  if ($form && $in && $out) {
    $form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = $in.value.trim();
      $in.value = "";
      if (!raw) return;
      // record in history (skip exact dupe of last entry)
      if (cmdHistory[cmdHistory.length - 1] !== raw) cmdHistory.push(raw);
      histIdx = cmdHistory.length;
      const cmd = raw.toLowerCase();

      // cat <file> — fetches a real file from the server
      if (cmd.startsWith("cat ")) {
        const arg = raw.slice(4).trim();
        const url = fileMap[arg.toLowerCase()];
        if (!url) {
          print(`cat: <b>${escapeHtml(arg)}</b>: <span class="err">no such file</span>`);
          return;
        }
        await printFile(`cat ${arg}`, url);
        return;
      }

      // ls / ls -la — listing reflects what's actually fetchable
      if (cmd === "ls") { print(`about.md  contact.md  projects.md  cv.md  whoami.txt  uname.txt`); return; }
      if (cmd === "ls -la" || cmd === "ls -a") {
        print(
`drwx------  .ssh/
drwx------  .secrets/
-rw-r--r--  about.md
-rw-r--r--  contact.md
-rw-r--r--  projects.md
-rw-r--r--  cv.md
-rw-r--r--  whoami.txt
-rw-r--r--  uname.txt`
        );
        return;
      }

      // these all fetch real files
      if (cmd === "whoami")              { await printFile("whoami", "/whoami.txt"); return; }
      if (cmd === "uname" || cmd === "uname -a") { await printFile("uname -a", "/uname.txt"); return; }
      if (cmd === "contact")             { await printFile("cat ~/.contact", "/contact.md"); return; }
      if (cmd === "cv")                  { await printFile("cat ~/cv.md", "/cv.md"); return; }
      if (cmd === "about")               { await printFile("cat ~/.about", "/about.md"); return; }

      // synchronous fixed responses
      const fixed = {
        help:
          `commands: <b>cat</b> &lt;file&gt;, <b>ls</b>, <b>whoami</b>, <b>uname</b>, <b>contact</b>, <b>cv</b>, <b>about</b>, <b>clear</b>, <b>exit</b>\n<span style="color:var(--fg-mute)">tip: <b>Tab</b> autocompletes, <b>↑</b>/<b>↓</b> walks history. or curl <a href="/about.md" target="_blank" style="color:var(--amber)">/about.md</a> directly.</span>`,
        sudo:
          `<span class="err">[sudo] password for guangxin:</span> <span style="color:var(--fg-mute)">(nice try)</span>`,
        "rm -rf /":
          `<span class="err">refused.</span> not on this domain.`,
        "rm -rf /*":
          `<span class="err">refused.</span> not on this domain.`,
        vim:
          `:q! <span style="color:var(--fg-mute)">— exited successfully</span>`,
        emacs:
          `<span class="err">heresy detected.</span> see <b>vim</b>.`,
        coffee:
          `☕ brewing… <span style="color:var(--fg-mute)">(no-op, the thought counts)</span>`,
        uptime:
          `up <b>∞</b> days, load avg: 0.42, 1.13, 0.99`,
        date:
          escapeHtml(new Date().toString()),
        pwd:
          `/home/guangxin`,
        exit:
          null,
        logout:
          null,
        clear:
          "",
      };

      if (cmd in fixed) {
        if (cmd === "exit" || cmd === "logout") {
          $out.innerHTML = `logout.<br><span style="color:var(--fg-mute)">connection to guangxinzhao.com closed.</span>`;
          $in.disabled = true;
        } else if (cmd === "clear") {
          $out.innerHTML = "";
        } else {
          print(fixed[cmd]);
        }
        return;
      }

      if (cmd.startsWith("cd ")) {
        print(`<span style="color:var(--fg-mute)">(this is a single page; you are already home.)</span>`);
        return;
      }

      print(`<span class="err">command not found:</span> ${escapeHtml(raw)} <span style="color:var(--fg-mute)">— try <b>help</b></span>`);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  }
})();
