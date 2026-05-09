/* ========================================================== */
/*  guangxinzhao.com — bits of life support                   */
/* ========================================================== */

(() => {
  // ---- data-driven content: fetch JSON, render page + cache ---
  // Both the page sections and the terminal `cat` output are rendered
  // from these JSON files, so editing /data/*.json updates everything.
  const SITE = {};

  const fetchJson = async (url) => {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error("data fetch failed: " + url);
    return r.json();
  };

  const dotsFor = (k, total = 13) =>
    "." .repeat(Math.max(1, total - String(k).length));

  const renderHero = (d) => {
    const $name = document.getElementById("hero-name");
    const $role = document.getElementById("hero-role");
    if ($name) $name.innerHTML = (d.name || "").replace(/ /g, "&nbsp;");
    if ($role && d.subtitle) {
      $role.innerHTML = d.subtitle
        .map((s, i, arr) => {
          const txt = s.acc
            ? `<span class="acc">${s.text}</span>`
            : s.text;
          return i < arr.length - 1
            ? txt + ' <span class="sep">·</span> '
            : txt;
        })
        .join("");
    }
  };

  const renderAbout = (d) => {
    const $prose = document.getElementById("about-prose");
    if ($prose) {
      $prose.innerHTML = (d.paragraphs || [])
        .map((p) => `<p data-line>${p}</p>`)
        .join("");
    }
    const $neo = document.getElementById("about-neofetch");
    if ($neo && d.neofetch) {
      $neo.innerHTML = d.neofetch
        .map(([k, v, accent]) => {
          const cls = accent ? "v acc" : "v";
          return `<span class="k">${k}</span>${dotsFor(k)} <span class="${cls}">${v}</span>`;
        })
        .join("\n");
    }
  };

  const renderProjects = (d) => {
    const $list = document.getElementById("projects-list");
    if (!$list || !d.items) return;
    $list.innerHTML = d.items
      .map((p) => `
        <article class="proj" data-line>
          <div class="proj__perms">${p.perms || "drwxr-xr-x"}</div>
          <div class="proj__main">
            <div class="proj__name"><a href="${p.url}" target="_blank" rel="noopener">${p.name}<span class="ext">${p.ext || ""}</span></a> ${p.year ? `<span class="proj__year">${p.year}</span>` : ""}</div>
            <div class="proj__desc">${p.desc}</div>
            <div class="proj__tags">${(p.tags || []).map((t) => `<span>${t}</span>`).join("")}</div>
          </div>
          <div class="proj__arrow">→</div>
        </article>
      `)
      .join("");
  };

  const renderLog = (d) => {
    const $list = document.getElementById("log-list");
    if (!$list || !d.items) return;
    $list.innerHTML = d.items
      .map((e) => `
        <div class="log__entry" data-line>
          <div class="log__hash">${e.hash}</div>
          <div class="log__meta">${e.meta}</div>
          <div class="log__msg">${e.msg}</div>
          <div class="log__sub">${e.sub}</div>
        </div>
      `)
      .join("");
  };

  const renderContact = (d) => {
    const $intro = document.getElementById("contact-intro");
    if ($intro && d.intro) $intro.textContent = d.intro;
    const $list = document.getElementById("contact-list");
    if (!$list || !d.items) return;
    $list.innerHTML = d.items
      .map((it) => {
        const valHtml = it.href
          ? `<a href="${it.href}"${it.external ? ' target="_blank" rel="noopener"' : ""}>${it.v}</a>`
          : `<span style="color:${it.muted ? "var(--fg-mute)" : "var(--fg)"}">${it.v}</span>`;
        return `<li data-line><span class="k">${it.k}</span><span>${valHtml}</span></li>`;
      })
      .join("");
  };

  // public: kicked off below alongside fonts.ready so layout is final
  // before line-numbers measure
  const loadAndRenderAll = async () => {
    try {
      const [profile, about, projects, log, contact] = await Promise.all([
        fetchJson("/data/profile.json"),
        fetchJson("/data/about.json"),
        fetchJson("/data/projects.json"),
        fetchJson("/data/log.json"),
        fetchJson("/data/contact.json"),
      ]);
      SITE.profile = profile;
      SITE.about = about;
      SITE.projects = projects;
      SITE.log = log;
      SITE.contact = contact;
      renderHero(profile);
      renderAbout(about);
      renderProjects(projects);
      renderLog(log);
      renderContact(contact);
    } catch (e) {
      console.error("[data]", e);
    }
  };
  // expose for cat handler below
  window.__siteData = SITE;
  window.__siteLoaded = loadAndRenderAll();

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

  // Only attach the wheel-snap on devices with a real pointer (mouse/trackpad).
  // Touch-only devices keep native iOS/Android momentum scroll + CSS snap
  // (set in style.css via @media (pointer: coarse)).
  const hasFinePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (hasFinePointer) {
    window.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (snapBusy || Math.abs(e.deltaY) < 1) return;
      snapTo(nearestSectionIdx() + (e.deltaY > 0 ? 1 : -1));
    }, { passive: false });
  }

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

  // ---- gutter line numbers: rebuilt whenever content changes ---
  const $linenos = document.querySelector(".linenos");
  let lineSpans = [];

  const positionLines = () => {
    lineSpans.forEach(({ el, span }) => {
      // offsetTop is relative to main (position:relative)
      span.style.top = (el.offsetTop + 4) + "px";
    });
  };

  const updateActiveLine = () => {
    if (!lineSpans.length) return;
    const probe = window.scrollY + window.innerHeight * 0.25;
    let activeIdx = 0;
    lineSpans.forEach(({ el }, i) => {
      if (el.getBoundingClientRect().top + window.scrollY <= probe) activeIdx = i;
    });
    lineSpans.forEach(({ span }, i) =>
      span.classList.toggle("is-active", i === activeIdx)
    );
  };

  const setupLineNumbers = () => {
    if (!$linenos) return;
    $linenos.innerHTML = "";
    lineSpans = [];
    const els = document.querySelectorAll("[data-line]");
    els.forEach((el, i) => {
      const span = document.createElement("span");
      span.textContent = String(i + 1).padStart(2, "0");
      $linenos.appendChild(span);
      lineSpans.push({ el, span });
    });
    positionLines();
    updateActiveLine();
  };

  let raf = 0;
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; updateActiveLine(); }); };

  // initial pass for whatever's static + listeners
  setupLineNumbers();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setupLineNumbers);
  window.addEventListener("load", setupLineNumbers);
  window.addEventListener("resize", () => { positionLines(); updateActiveLine(); });
  window.addEventListener("scroll", onScroll, { passive: true });

  // re-run once data arrives — rendered sections have new [data-line] items
  if (window.__siteLoaded) {
    window.__siteLoaded.then(() => requestAnimationFrame(setupLineNumbers));
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

  // file aliases — what shell name maps to what data key
  const fileAlias = {
    "about":      "about",
    "about.md":   "about",
    ".about":     "about",
    "~/.about":   "about",
    "contact":    "contact",
    "contact.md": "contact",
    ".contact":   "contact",
    "~/.contact": "contact",
    "projects":   "projects",
    "projects.md":"projects",
    "cv":         "cv",
    "cv.md":      "cv",
    "cv.pdf":     "cv",
    "whoami":     "whoami",
    "whoami.txt": "whoami",
    "uname":      "uname",
    "uname.txt":  "uname",
  };

  const stripTags = (s) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = String(s || "");
    return tmp.textContent || "";
  };

  // formatters: turn live JSON into terminal-friendly markdown text
  const fileFormatters = {
    about: () => {
      const d = SITE.about;
      if (!d) return "(loading…)";
      const lines = ["# ~/.about", ""];
      d.paragraphs.forEach((p) => { lines.push(stripTags(p)); lines.push(""); });
      return lines.join("\n").trim();
    },
    contact: () => {
      const d = SITE.contact;
      if (!d) return "(loading…)";
      const lines = ["# ~/.contact", ""];
      d.items.forEach((it) => {
        lines.push(`${it.k.padEnd(7)} ${it.v}`);
      });
      if (d.intro) { lines.push("", "# " + d.intro); }
      return lines.join("\n");
    },
    projects: () => {
      const d = SITE.projects;
      if (!d) return "(loading…)";
      const lines = ["# ~/projects/", ""];
      d.items.forEach((p) => {
        const head = `${p.perms}  ${p.name}${p.ext || ""}` +
          (p.year ? `  (${stripTags(p.year)})` : "");
        lines.push(head);
        lines.push(stripTags(p.desc).split("\n").map(l => "  " + l).join("\n"));
        if (p.tags) lines.push("  tags: " + p.tags.join(", "));
        lines.push("");
      });
      return lines.join("\n");
    },
    cv: () => {
      const lines = ["# ~/cv.md", ""];
      lines.push("Web version: https://resume.guangxinzhao.com");
      lines.push("");
      if (SITE.log && SITE.log.items) {
        lines.push("## TIMELINE", "");
        SITE.log.items.forEach((e) => {
          lines.push(stripTags(e.meta));
          lines.push("  " + stripTags(e.msg));
          lines.push("  " + stripTags(e.sub));
          lines.push("");
        });
      }
      if (SITE.contact && SITE.contact.items) {
        lines.push("## CONTACT", "");
        SITE.contact.items.forEach((it) => {
          lines.push(`${it.k.padEnd(7)} ${it.v}`);
        });
      }
      return lines.join("\n");
    },
    whoami: () => {
      const p = SITE.profile;
      if (!p) return "(loading…)";
      const sub = (p.subtitle || []).map((s) => s.text).join(" · ");
      return [
        p.name,
        sub,
        "uid=1000(as3ert) gid=1000(as3ert) groups=graphics,rendering,coffee",
      ].join("\n");
    },
    uname: () =>
      "Linux guangxinzhao.com 6.13.0-amber-crt #1 SMP x86_64 GNU/Caffeine",
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

  const printFile = async (label, key) => {
    const fn = fileFormatters[key];
    if (!fn) {
      print(`<span class="err">no such file:</span> ${escapeHtml(key)}`);
      return;
    }
    // wait for site data if it isn't in yet
    if (!SITE[key === "uname" ? "_uname" : (key === "cv" ? "log" : key)]) {
      try { await window.__siteLoaded; } catch (_) {}
    }
    const text = fn();
    print(
      `<span class="term-head">$ ${escapeHtml(label)}</span>\n` +
      `<span class="term-rule">─── from /data/${escapeHtml(key)}.json ───</span>\n` +
      `<span class="term-body">${renderMd(text)}</span>`
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

      // cat <file> — formats live JSON data from /data/*.json
      if (cmd.startsWith("cat ")) {
        const arg = raw.slice(4).trim();
        const key = fileAlias[arg.toLowerCase()];
        if (!key) {
          print(`cat: <b>${escapeHtml(arg)}</b>: <span class="err">no such file</span>`);
          return;
        }
        await printFile(`cat ${arg}`, key);
        return;
      }

      // ls / ls -la — listing reflects what's actually fetchable
      if (cmd === "ls") { print(`about  contact  projects  cv  whoami  uname`); return; }
      if (cmd === "ls -la" || cmd === "ls -a") {
        print(
`drwx------  .ssh/
drwx------  .secrets/
drwxr-xr-x  data/                 <span style="color:var(--fg-mute)">json source of truth</span>
-rw-r--r--  about     <span style="color:var(--fg-mute)">→ /data/about.json</span>
-rw-r--r--  contact   <span style="color:var(--fg-mute)">→ /data/contact.json</span>
-rw-r--r--  projects  <span style="color:var(--fg-mute)">→ /data/projects.json</span>
-rw-r--r--  cv        <span style="color:var(--fg-mute)">→ /data/log.json + /data/contact.json</span>
-rw-r--r--  whoami    <span style="color:var(--fg-mute)">→ /data/profile.json</span>
-rw-r--r--  uname`
        );
        return;
      }

      // bare commands: same data, presented as 'cat <thing>'
      if (cmd === "whoami")              { await printFile("whoami", "whoami"); return; }
      if (cmd === "uname" || cmd === "uname -a") { await printFile("uname -a", "uname"); return; }
      if (cmd === "contact")             { await printFile("cat ~/.contact", "contact"); return; }
      if (cmd === "cv")                  { await printFile("cat ~/cv.md", "cv"); return; }
      if (cmd === "about")               { await printFile("cat ~/.about", "about"); return; }

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
