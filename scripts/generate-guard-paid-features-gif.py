from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "marketplace" / "extension" / "media" / "guard-paid-features.gif"
WIDTH = 1280
HEIGHT = 720
SCALE = 1

WINDOW_X = 40
WINDOW_Y = 34
WINDOW_W = 1200
WINDOW_H = 650
TITLE_H = 34
STATUS_H = 26
ACTIVITY_W = 52
SIDEBAR_W = 248
TAB_H = 36

COLORS = {
    "bg0": (6, 10, 14),
    "bg1": (12, 20, 27),
    "window": (30, 30, 30),
    "title": (35, 35, 36),
    "activity": (45, 45, 46),
    "sidebar": (37, 37, 38),
    "editor": (30, 30, 30),
    "tabbar": (43, 43, 44),
    "tab": (30, 30, 30),
    "tab_inactive": (45, 45, 46),
    "panel": (24, 28, 34),
    "panel2": (30, 35, 42),
    "line": (67, 76, 90),
    "muted": (160, 170, 184),
    "text": (236, 240, 245),
    "blue": (55, 148, 255),
    "green": (67, 214, 146),
    "amber": (255, 191, 87),
    "red": (255, 105, 97),
    "purple": (170, 137, 255),
    "cyan": (72, 207, 227),
}


def load_font(size: int, bold: bool = False, mono: bool = False) -> ImageFont.ImageFont:
    if mono:
        candidates = [
            Path("C:/Windows/Fonts/consolab.ttf" if bold else "C:/Windows/Fonts/consola.ttf"),
            Path("C:/Windows/Fonts/courbd.ttf" if bold else "C:/Windows/Fonts/cour.ttf"),
        ]
    else:
        candidates = [
            Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
            Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


FONT_10 = load_font(10)
FONT_11 = load_font(11)
FONT_12 = load_font(12)
FONT_13 = load_font(13)
FONT_14 = load_font(14)
FONT_15 = load_font(15)
FONT_16 = load_font(16)
FONT_18 = load_font(18, True)
FONT_20 = load_font(20, True)
FONT_24 = load_font(24, True)
FONT_30 = load_font(30, True)
FONT_MONO_11 = load_font(11, mono=True)
FONT_MONO_12 = load_font(12, mono=True)
FONT_MONO_13 = load_font(13, mono=True)


def clamp(value: float, lo: float = 0, hi: float = 1) -> float:
    return max(lo, min(hi, value))


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def mix(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(lerp(a, b, t) for a, b in zip(c1, c2))


def rounded(draw: ImageDraw.ImageDraw, box, radius=10, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def rect(draw: ImageDraw.ImageDraw, box, fill):
    draw.rectangle(box, fill=fill)


def text(draw: ImageDraw.ImageDraw, xy, value: str, fill=None, font=None, anchor=None):
    draw.text(xy, value, fill=fill or COLORS["text"], font=font or FONT_13, anchor=anchor)


def text_width(draw: ImageDraw.ImageDraw, value: str, font) -> int:
    box = draw.textbbox((0, 0), value, font=font)
    return box[2] - box[0]


def truncate(draw: ImageDraw.ImageDraw, value: str, font, max_width: int) -> str:
    if text_width(draw, value, font) <= max_width:
        return value
    suffix = "..."
    while value and text_width(draw, value + suffix, font) > max_width:
        value = value[:-1]
    return value + suffix


def background(draw: ImageDraw.ImageDraw):
    for y in range(HEIGHT):
        t = y / HEIGHT
        color = mix(COLORS["bg0"], COLORS["bg1"], t)
        draw.line([(0, y), (WIDTH, y)], fill=color)
    draw.ellipse((-180, -130, 360, 330), fill=(8, 52, 74))
    draw.ellipse((820, 410, 1270, 780), fill=(76, 45, 13))
    draw.ellipse((560, -220, 1040, 210), fill=(27, 38, 63))


def draw_icon(draw: ImageDraw.ImageDraw, x: int, y: int, label: str, active: bool = False):
    color = COLORS["text"] if active else (142, 148, 158)
    if active:
        draw.rectangle((WINDOW_X, y - 17, WINDOW_X + 3, y + 17), fill=COLORS["blue"])
    if label == "files":
        draw.rectangle((x - 8, y - 11, x + 5, y + 8), outline=color, width=2)
        draw.line((x - 4, y - 15, x + 10, y - 15, x + 10, y + 4), fill=color, width=2)
    elif label == "search":
        draw.ellipse((x - 10, y - 10, x + 5, y + 5), outline=color, width=2)
        draw.line((x + 4, y + 4, x + 12, y + 12), fill=color, width=2)
    elif label == "source":
        draw.ellipse((x - 9, y - 10, x - 1, y - 2), outline=color, width=2)
        draw.ellipse((x + 5, y - 2, x + 13, y + 6), outline=color, width=2)
        draw.ellipse((x - 9, y + 7, x - 1, y + 15), outline=color, width=2)
        draw.line((x - 1, y + 2, x + 5, y + 2), fill=color, width=2)
        draw.line((x - 4, y - 2, x - 4, y + 7), fill=color, width=2)
    elif label == "guard":
        pts = [(x, y - 15), (x + 13, y - 8), (x + 10, y + 9), (x, y + 16), (x - 10, y + 9), (x - 13, y - 8)]
        draw.polygon(pts, outline=color, fill=(40, 52, 61) if active else None)
        draw.line((x - 5, y, x - 1, y + 5, x + 7, y - 6), fill=color, width=2)
    elif label == "extensions":
        for dx, dy in [(-8, -8), (4, -8), (-8, 4), (4, 4)]:
            rounded(draw, (x + dx, y + dy, x + dx + 8, y + dy + 8), 2, outline=color, fill=None, width=2)


def draw_shell(draw: ImageDraw.ImageDraw, scene_name: str, status: str, focus: str = "security") -> tuple[int, int, int, int]:
    background(draw)
    rounded(draw, (WINDOW_X, WINDOW_Y, WINDOW_X + WINDOW_W, WINDOW_Y + WINDOW_H), 18, fill=COLORS["window"], outline=(85, 92, 102), width=2)

    # Title bar with VS Code chrome.
    rect(draw, (WINDOW_X + 1, WINDOW_Y + 1, WINDOW_X + WINDOW_W - 1, WINDOW_Y + TITLE_H), COLORS["title"])
    menu_x = WINDOW_X + 16
    for item in ["File", "Edit", "Selection", "View", "Go", "Run", "Terminal", "Help"]:
        text(draw, (menu_x, WINDOW_Y + 10), item, (204, 204, 204), FONT_11)
        menu_x += text_width(draw, item, FONT_11) + 15
    cmd_x = WINDOW_X + 410
    rounded(draw, (cmd_x, WINDOW_Y + 6, cmd_x + 326, WINDOW_Y + 27), 6, fill=(48, 48, 50), outline=(84, 84, 87))
    text(draw, (cmd_x + 14, WINDOW_Y + 10), "DryLake Guard: Security Pro workspace", (214, 214, 216), FONT_11)
    text(draw, (WINDOW_X + WINDOW_W - 83, WINDOW_Y + 10), "-", (205, 205, 205), FONT_15)
    text(draw, (WINDOW_X + WINDOW_W - 55, WINDOW_Y + 10), "[]", (205, 205, 205), FONT_12)
    text(draw, (WINDOW_X + WINDOW_W - 27, WINDOW_Y + 9), "x", (235, 132, 124), FONT_14)

    work_top = WINDOW_Y + TITLE_H
    work_bottom = WINDOW_Y + WINDOW_H - STATUS_H
    rect(draw, (WINDOW_X, work_top, WINDOW_X + ACTIVITY_W, work_bottom), COLORS["activity"])
    rect(draw, (WINDOW_X + ACTIVITY_W, work_top, WINDOW_X + ACTIVITY_W + SIDEBAR_W, work_bottom), COLORS["sidebar"])
    editor_x = WINDOW_X + ACTIVITY_W + SIDEBAR_W
    rect(draw, (editor_x, work_top, WINDOW_X + WINDOW_W, work_bottom), COLORS["editor"])

    # Activity bar.
    icon_y = work_top + 36
    draw_icon(draw, WINDOW_X + 26, icon_y, "files")
    draw_icon(draw, WINDOW_X + 26, icon_y + 46, "search")
    draw_icon(draw, WINDOW_X + 26, icon_y + 92, "source")
    draw_icon(draw, WINDOW_X + 26, icon_y + 138, "guard", active=True)
    draw_icon(draw, WINDOW_X + 26, icon_y + 184, "extensions")

    # Explorer/sidebar.
    sx = WINDOW_X + ACTIVITY_W
    text(draw, (sx + 14, work_top + 12), "EXPLORER", (188, 188, 190), FONT_10)
    text(draw, (sx + 14, work_top + 42), "DRYLAKE-WORKSPACE", COLORS["text"], FONT_12)
    files = [
        (".cursor", False),
        ("mcp.json", focus == "policy"),
        ("AGENTS.md", False),
        ("package.json", False),
        ("security-report.drylake", focus in {"report", "fix", "upload", "saved"}),
        ("team-policy.yml", focus == "policy"),
    ]
    fy = work_top + 68
    for name, selected in files:
        if selected:
            rect(draw, (sx + 5, fy - 2, sx + SIDEBAR_W - 6, fy + 21), (55, 68, 82))
        prefix = "v " if name == ".cursor" else "  "
        text(draw, (sx + 18, fy + 2), prefix + name, COLORS["text"] if selected else (191, 196, 204), FONT_12)
        fy += 24
    text(draw, (sx + 14, fy + 14), "DRYLAKE GUARD", (188, 188, 190), FONT_10)
    guard_items = [
        ("Security report", focus in {"report", "fix"}),
        ("Deep Cloud Analysis", focus == "upload"),
        ("Saved reports", focus == "saved"),
        ("Team Baseline", focus == "baseline"),
        ("Policy", focus == "policy"),
        ("Continuous Watch", focus == "watch"),
        ("Local Watchdog", focus == "watchdog"),
    ]
    gy = fy + 40
    for name, selected in guard_items:
        if selected:
            rounded(draw, (sx + 10, gy - 2, sx + SIDEBAR_W - 12, gy + 24), 5, fill=(49, 61, 74), outline=(76, 91, 108))
        text(draw, (sx + 22, gy + 4), name, COLORS["text"] if selected else (166, 176, 189), FONT_12)
        gy += 28

    # Tabs.
    rect(draw, (editor_x, work_top, WINDOW_X + WINDOW_W, work_top + TAB_H), COLORS["tabbar"])
    tabs = ["DryLake Guard", "security-report.drylake", "team-policy.yml"]
    tx = editor_x + 8
    for tab in tabs:
        active = (tab == "DryLake Guard" and focus not in {"policy"}) or (tab == "team-policy.yml" and focus == "policy")
        tab_w = max(132, min(210, text_width(draw, tab, FONT_12) + 34))
        fill = COLORS["tab"] if active else COLORS["tab_inactive"]
        rect(draw, (tx, work_top + 3, tx + tab_w, work_top + TAB_H), fill)
        if active:
            rect(draw, (tx, work_top + 3, tx + tab_w, work_top + 5), COLORS["blue"])
        text(draw, (tx + 12, work_top + 13), tab, COLORS["text"] if active else (181, 186, 194), FONT_12)
        tx += tab_w + 2

    # Webview content shell.
    cx = editor_x + 16
    cy = work_top + TAB_H + 14
    cw = WINDOW_X + WINDOW_W - cx - 16
    ch = work_bottom - cy - 14
    rounded(draw, (cx, cy, cx + cw, cy + ch), 14, fill=(19, 24, 31), outline=(70, 79, 94))
    rect(draw, (cx + 1, cy + 1, cx + cw - 1, cy + 43), (24, 30, 39))
    text(draw, (cx + 18, cy + 13), "DryLake Control Plane", COLORS["text"], FONT_14)
    text(draw, (cx + 190, cy + 13), "> Security", (163, 174, 190), FONT_14)
    rounded(draw, (cx + cw - 210, cy + 10, cx + cw - 18, cy + 32), 8, fill=(34, 48, 45), outline=(74, 196, 140))
    text(draw, (cx + cw - 196, cy + 15), "Security Pro + Team Security", (183, 245, 215), FONT_11)

    # Status bar.
    rect(draw, (WINDOW_X + 1, work_bottom, WINDOW_X + WINDOW_W - 1, WINDOW_Y + WINDOW_H - 1), (29, 99, 147))
    status_items = ["main", "DryLake: Connected", "Entitlements: fresh", status]
    px = WINDOW_X + 12
    for item in status_items:
        text(draw, (px, work_bottom + 7), item, (241, 248, 255), FONT_11)
        px += text_width(draw, item, FONT_11) + 22
    text(draw, (WINDOW_X + WINDOW_W - 184, work_bottom + 7), scene_name, (241, 248, 255), FONT_11)

    return cx + 18, cy + 56, cw - 36, ch - 70


def pill(draw: ImageDraw.ImageDraw, x: int, y: int, label: str, color, text_color=(10, 13, 18)):
    w = text_width(draw, label, FONT_11) + 20
    rounded(draw, (x, y, x + w, y + 22), 8, fill=color, outline=None)
    text(draw, (x + 10, y + 5), label, text_color, FONT_11)
    return w


def panel(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, title: str | None = None, accent=None):
    rounded(draw, (x, y, x + w, y + h), 12, fill=COLORS["panel"], outline=(68, 78, 94))
    if accent:
        rect(draw, (x, y, x + 4, y + h), accent)
    if title:
        text(draw, (x + 14, y + 12), title, COLORS["text"], FONT_15)


def button(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, label: str, fill, fg=(10, 13, 18), outline=None):
    rounded(draw, (x, y, x + w, y + h), 8, fill=fill, outline=outline or fill)
    tw = text_width(draw, label, FONT_12)
    text(draw, (x + (w - tw) // 2, y + (h - 13) // 2), label, fg, FONT_12)


def row(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, severity: str, title: str, detail: str, color, pulse: float = 0):
    fill = mix((28, 33, 40), (42, 55, 52), pulse)
    outline = mix((67, 78, 94), color, pulse)
    rounded(draw, (x, y, x + w, y + 48), 10, fill=fill, outline=outline, width=1)
    pill(draw, x + 12, y + 13, severity, color)
    text(draw, (x + 92, y + 9), title, COLORS["text"], FONT_13)
    text(draw, (x + 92, y + 27), detail, COLORS["muted"], FONT_11)


def progress(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, value: float, label: str, color):
    text(draw, (x, y), label, COLORS["muted"], FONT_11)
    rounded(draw, (x, y + 18, x + w, y + 27), 5, fill=(37, 43, 52), outline=(67, 78, 94))
    rounded(draw, (x, y + 18, x + int(w * clamp(value)), y + 27), 5, fill=color, outline=None)


def check_item(draw: ImageDraw.ImageDraw, x: int, y: int, label: str, ok: bool = True, muted: bool = False):
    color = COLORS["green"] if ok else COLORS["red"]
    rounded(draw, (x, y, x + 16, y + 16), 4, fill=(23, 34, 31) if ok else (44, 28, 30), outline=color)
    text(draw, (x + 4, y + 1), "v" if ok else "!", color, FONT_11)
    text(draw, (x + 24, y + 1), label, COLORS["muted"] if muted else COLORS["text"], FONT_12)


def draw_report(draw: ImageDraw.ImageDraw, t: float):
    x, y, w, h = draw_shell(draw, "Guard report", "Watchdog: local-only", "report")
    text(draw, (x, y), "Extension-side Guard report", COLORS["text"], FONT_24)
    text(draw, (x, y + 31), "Readable locally. Paid actions resolve against server entitlements before they run.", COLORS["muted"], FONT_13)

    score_w = 178
    findings_x = x + score_w + 18
    findings_w = w - score_w - 18
    panel(draw, x, y + 66, score_w, 118, "Responsible Agent Score", COLORS["green"])
    text(draw, (x + 18, y + 105), "71", COLORS["green"], FONT_30)
    text(draw, (x + 66, y + 116), "/100", COLORS["muted"], FONT_16)
    text(draw, (x + 18, y + 148), "Operator", COLORS["text"], FONT_18)

    panel(draw, findings_x, y + 66, findings_w, 118, "Top findings", COLORS["amber"])
    row(draw, findings_x + 16, y + 104, findings_w - 32, "HIGH", "Prompt rules request shell/network escalation", "AGENTS.md line 18, redacted excerpt", COLORS["amber"], t)
    row(draw, findings_x + 16, y + 157, findings_w - 32, "HIGH", "MCP package launched through unpinned npx", ".cursor/mcp.json, package metadata", COLORS["red"], 1 - t * 0.4)

    rounded(draw, (x, y + 202, x + w, y + 246), 10, fill=(24, 30, 38), outline=(68, 78, 94))
    text(draw, (x + 16, y + 216), "Report actions", COLORS["muted"], FONT_12)
    button(draw, x + 132, y + 210, 126, 28, "Open Report", (92, 150, 255))
    button(draw, x + 272, y + 210, 128, 28, "Copy Summary", (64, 209, 173))
    button(draw, x + 414, y + 210, 140, 28, "Fix with AI", COLORS["amber"])
    text(draw, (x + 574, y + 217), "Security Pro required for remediation", COLORS["muted"], FONT_11)

    labels = [
        ("Prompt Injection Risk", "HIGH"),
        ("Supply-Chain Risk", "HIGH"),
        ("MCP / Tool Access", "MED"),
        ("IDE Extension Access", "MED"),
        ("Secret Hygiene", "LOW"),
        ("Token Waste / IDE Bloat", "INFO"),
        ("Suspicious Artifact Review", "MED"),
        ("Deploy Surface", "HIGH"),
    ]
    yy = y + 264
    row_w = (w - 24) // 2
    for idx, (name, sev) in enumerate(labels):
        xx = x + (idx % 2) * (row_w + 24)
        cy = yy + (idx // 2) * 52
        color = COLORS["red"] if sev == "HIGH" else COLORS["amber"] if sev == "MED" else COLORS["green"] if sev == "LOW" else COLORS["cyan"]
        row(draw, xx, cy, row_w, sev, name, "finding details available in report", color, 0.15 if idx == int(t * 7) else 0)


def draw_fix(draw: ImageDraw.ImageDraw, t: float):
    x, y, w, h = draw_shell(draw, "Fix with AI", "Server entitlement checked", "fix")
    text(draw, (x, y), "Fix with AI remediation plan", COLORS["text"], FONT_24)
    text(draw, (x, y + 31), "Security Pro action: redacted scan summary only, grouped by severity and effort.", COLORS["muted"], FONT_13)

    panel(draw, x, y + 66, 330, 338, "Plan input", COLORS["blue"])
    check_item(draw, x + 18, y + 104, "Entitlement: canUseFixWithAI")
    check_item(draw, x + 18, y + 134, "Raw secrets: excluded")
    check_item(draw, x + 18, y + 164, "Findings: redacted")
    check_item(draw, x + 18, y + 194, "Dependency metadata: included")
    check_item(draw, x + 18, y + 224, "Full source tree: blocked", ok=False)
    progress(draw, x + 18, y + 262, 292, 0.25 + 0.65 * t, "Generating review-ready plan", COLORS["blue"])

    panel(draw, x + 352, y + 66, w - 352, 338, "Remediation output", COLORS["green"])
    sections = [
        ("Critical risks", "Remove remote prompt include and pin MCP server package"),
        ("Quick fixes", "Add agent ignore rules for build/log/vendor directories"),
        ("MCP hardening", "Restrict env exposure and deny shell gateway by default"),
        ("Supply-chain cleanup", "Replace postinstall download pipe with verified release asset"),
        ("Prompt/rules cleanup", "Delete safety override language from AGENTS.md"),
    ]
    for i, (title, detail) in enumerate(sections):
        yy = y + 105 + i * 53
        alpha = clamp((t * 6) - i)
        row(draw, x + 370, yy, w - 390, "STEP", title, detail, mix(COLORS["blue"], COLORS["green"], alpha), alpha)
    button(draw, x + w - 190, y + 363, 164, 30, "Copy fix plan", COLORS["green"])


def draw_upload(draw: ImageDraw.ImageDraw, t: float):
    x, y, w, h = draw_shell(draw, "Deep Cloud Analysis", "Upload approval pending", "upload")
    text(draw, (x, y), "Approved upload for Deep Cloud Analysis", COLORS["text"], FONT_24)
    text(draw, (x, y + 31), "The extension shows exactly what will be uploaded before anything leaves the workstation.", COLORS["muted"], FONT_13)

    panel(draw, x, y + 66, 458, 338, "Approved for upload", COLORS["green"])
    approved = [
        "scan manifest and score summary",
        "redacted findings and excerpts",
        "dependency metadata and package scripts",
        "MCP tool metadata and launch commands",
        "extension metadata and activation events",
        "selected prompt/rule files after approval",
    ]
    for i, label in enumerate(approved):
        check_item(draw, x + 22, y + 106 + i * 34, label, True)
    button(draw, x + 22, y + 360, 188, 32, "Approve upload", COLORS["green"])
    button(draw, x + 224, y + 360, 120, 32, "Cancel", (83, 91, 104), (236, 240, 245))

    panel(draw, x + 480, y + 66, w - 480, 338, "Blocked from upload", COLORS["red"])
    blocked = [
        "raw secrets and private keys",
        ".env values and database URLs",
        "full source tree",
        "unapproved source files",
        "raw cloud tokens",
    ]
    for i, label in enumerate(blocked):
        check_item(draw, x + 502, y + 106 + i * 38, label, False)
    progress(draw, x + 502, y + 314, w - 524, 0.12 + 0.78 * t, "Redaction guardrail", COLORS["green"])
    text(draw, (x + 502, y + 354), "Cloud job stores report state and returns correlated risk results.", COLORS["muted"], FONT_12)


def draw_saved(draw: ImageDraw.ImageDraw, t: float):
    x, y, w, h = draw_shell(draw, "Saved report", "Website report linked", "saved")
    text(draw, (x, y), "Saved report linked to website detail", COLORS["text"], FONT_24)
    text(draw, (x, y + 31), "The extension can reopen the persisted report while billing/account pages stay source-of-truth.", COLORS["muted"], FONT_13)

    panel(draw, x, y + 66, 400, 338, "Extension report record", COLORS["blue"])
    text(draw, (x + 22, y + 108), "report_id: rpt_guard_7f32", COLORS["text"], FONT_MONO_13)
    text(draw, (x + 22, y + 136), "source: local + cloud", COLORS["text"], FONT_MONO_13)
    text(draw, (x + 22, y + 164), "redaction_version: 3", COLORS["text"], FONT_MONO_13)
    text(draw, (x + 22, y + 192), "plan: security_pro", COLORS["text"], FONT_MONO_13)
    progress(draw, x + 22, y + 230, 348, 1, "Saved to DryLake account", COLORS["green"])
    button(draw, x + 22, y + 292, 168, 32, "Open website", COLORS["blue"])
    button(draw, x + 204, y + 292, 144, 32, "Copy link", COLORS["green"])

    panel(draw, x + 426, y + 66, w - 426, 338, "Website detail preview", COLORS["purple"])
    rounded(draw, (x + 448, y + 104, x + w - 24, y + 142), 8, fill=(12, 18, 24), outline=(73, 83, 98))
    text(draw, (x + 462, y + 117), "drylake.xupracorp.com/security/reports/rpt_guard_7f32", COLORS["cyan"], FONT_12)
    cards = [("Score", "71"), ("Critical", "2"), ("Cloud review", "Complete"), ("Owner", "you")]
    for i, (label, value) in enumerate(cards):
        xx = x + 448 + (i % 2) * 176
        yy = y + 166 + (i // 2) * 78
        panel(draw, xx, yy, 154, 58, None, None)
        text(draw, (xx + 14, yy + 10), label, COLORS["muted"], FONT_11)
        text(draw, (xx + 14, yy + 29), value, COLORS["text"], FONT_16)
    text(draw, (x + 448, y + 332), "Same report can be reviewed by website, extension, or team workspace.", COLORS["muted"], FONT_12)


def draw_baseline(draw: ImageDraw.ImageDraw, t: float):
    x, y, w, h = draw_shell(draw, "Team Baseline", "Baseline drift detected", "baseline")
    text(draw, (x, y), "Team Baseline drift", COLORS["text"], FONT_24)
    text(draw, (x, y + 31), "Team Security compares future scans against the approved clean baseline.", COLORS["muted"], FONT_13)

    panel(draw, x, y + 66, w, 338, "Baseline diff", COLORS["amber"])
    columns = ["Category", "Baseline", "Current", "Diff"]
    col_x = [x + 24, x + 296, x + 476, x + 660]
    for i, label in enumerate(columns):
        text(draw, (col_x[i], y + 106), label, COLORS["muted"], FONT_12)
    rows = [
        ("Prompt injection risks", "1 medium", "2 high", "+1 worsened"),
        ("MCP tools", "approved: 5", "approved: 5, new: 1", "+untrusted-mcp"),
        ("IDE extensions", "12", "14", "+2 new"),
        ("Secrets", "0", "1 redacted", "+new secret"),
        ("Deploy surfaces", "Docker only", "Docker + Terraform", "+terraform"),
        ("Suspicious artifacts", "0", "1 archive", "+review"),
    ]
    for i, values in enumerate(rows):
        yy = y + 134 + i * 40
        color = COLORS["red"] if i in {0, 3} else COLORS["amber"]
        rounded(draw, (x + 16, yy - 6, x + w - 16, yy + 27), 8, fill=(28, 33, 40), outline=mix((67, 78, 94), color, 0.35 + 0.35 * (i == int(t * len(rows)))))
        for j, value in enumerate(values):
            fill = color if j == 3 else COLORS["text"]
            text(draw, (col_x[j], yy), str(value), fill, FONT_12)
    button(draw, x + w - 220, y + 368, 190, 32, "Open baseline diff", COLORS["amber"])


def draw_policy(draw: ImageDraw.ImageDraw, t: float):
    x, y, w, h = draw_shell(draw, "Team policy", "MCP denylist enforced", "policy")
    text(draw, (x, y), "Team policy and MCP denylist", COLORS["text"], FONT_24)
    text(draw, (x, y + 31), "Team Security applies policy to structured MCP and extension inventory, not substring guesses.", COLORS["muted"], FONT_13)

    panel(draw, x, y + 66, 372, 338, "team-security-policy.yml", COLORS["purple"])
    code = [
        "mcp:",
        "  denylist:",
        "    - untrusted-proxy-mcp",
        "    - shell-broker-*",
        "  allow_env:",
        "    - GITHUB_TOKEN_READONLY",
        "extensions:",
        "  denylist:",
        "    - unknown.remote-runner",
    ]
    for i, line in enumerate(code):
        color = COLORS["red"] if "untrusted" in line or "shell-broker" in line or "unknown" in line else COLORS["text"]
        text(draw, (x + 24, y + 104 + i * 27), line, color, FONT_MONO_13)

    panel(draw, x + 396, y + 66, w - 396, 338, "Policy evaluation", COLORS["red"])
    row(draw, x + 416, y + 106, w - 436, "DENY", "untrusted-proxy-mcp", "MCP server found in .cursor/mcp.json", COLORS["red"], 1)
    row(draw, x + 416, y + 166, w - 436, "DENY", "unknown.remote-runner", "Extension contributes terminal + remote execution", COLORS["red"], 0.65 + 0.25 * t)
    row(draw, x + 416, y + 226, w - 436, "ALLOW", "github-readonly-mcp", "Approved env scope and pinned package", COLORS["green"], 0.2)
    button(draw, x + 416, y + 344, 186, 32, "View policy history", COLORS["purple"], (248, 248, 255))


def draw_watch(draw: ImageDraw.ImageDraw, t: float):
    x, y, w, h = draw_shell(draw, "Continuous Watch", "Team check-in history", "watch")
    text(draw, (x, y), "Continuous Watch event history", COLORS["text"], FONT_24)
    text(draw, (x, y + 31), "Team feature: recurring check-ins detect baseline drift and policy violations.", COLORS["muted"], FONT_13)

    panel(draw, x, y + 66, 284, 338, "Team Security", COLORS["green"])
    progress(draw, x + 22, y + 112, 238, 1, "Entitlement", COLORS["green"])
    check_item(draw, x + 22, y + 160, "canUseContinuousWatch")
    check_item(draw, x + 22, y + 194, "canUseTeamBaseline")
    check_item(draw, x + 22, y + 228, "canManageTeamPolicy")
    text(draw, (x + 22, y + 286), "Individual Security Pro gets local Watchdog, not team-wide monitoring.", COLORS["muted"], FONT_12)

    panel(draw, x + 308, y + 66, w - 308, 338, "Recent events", COLORS["cyan"])
    events = [
        ("09:02", "policy_violation", "Denied MCP server appeared in workspace"),
        ("09:05", "baseline_drift", "New Terraform deploy surface detected"),
        ("09:11", "resolved_risk", "Prompt include removed from AGENTS.md"),
        ("09:18", "extension_added", "Remote runner extension requires review"),
        ("09:30", "check_in", "Workspace scan completed with score 74"),
    ]
    for i, (tm, kind, detail) in enumerate(events):
        yy = y + 106 + i * 55
        draw.line((x + 330, yy + 16, x + 330, yy + 50), fill=(76, 91, 108), width=2)
        draw.ellipse((x + 322, yy + 8, x + 338, yy + 24), fill=COLORS["cyan"] if i != 0 else COLORS["red"])
        text(draw, (x + 352, yy + 2), f"{tm}  {kind}", COLORS["text"], FONT_13)
        text(draw, (x + 352, yy + 22), detail, COLORS["muted"], FONT_12)


def draw_watchdog(draw: ImageDraw.ImageDraw, t: float):
    x, y, w, h = draw_shell(draw, "Local Watchdog", "Local-only protection", "watchdog")
    text(draw, (x, y), "Local Watchdog indicator", COLORS["text"], FONT_24)
    text(draw, (x, y + 31), "Security Pro local protection runs only while the editor is open.", COLORS["muted"], FONT_13)

    panel(draw, x, y + 66, 430, 338, "Watched files", COLORS["green"])
    watched = [
        "MCP config changes",
        "CLAUDE.md / AGENTS.md / .cursor/rules",
        "package scripts and lockfiles",
        ".env changes without uploading values",
        "CI/CD, Docker, Terraform, Kubernetes",
        "deployment and deletion scripts",
    ]
    for i, label in enumerate(watched):
        check_item(draw, x + 22, y + 106 + i * 36, label, True)

    panel(draw, x + 456, y + 66, w - 456, 338, "Local alert", COLORS["amber"])
    rounded(draw, (x + 480, y + 114, x + w - 28, y + 196), 12, fill=(49, 42, 29), outline=COLORS["amber"], width=2)
    text(draw, (x + 502, y + 134), "Changed file", COLORS["muted"], FONT_12)
    text(draw, (x + 502, y + 154), ".cursor/mcp.json", COLORS["text"], FONT_MONO_13)
    text(draw, (x + 502, y + 220), "Risk category", COLORS["muted"], FONT_12)
    text(draw, (x + 502, y + 240), "MCP tool access changed", COLORS["amber"], FONT_18)
    button(draw, x + 502, y + 294, 148, 32, "Rerun scan", COLORS["amber"])
    button(draw, x + 664, y + 294, 156, 32, "Open diff", COLORS["blue"])
    progress(draw, x + 502, y + 350, w - 526, 0.25 + 0.65 * t, "Monitoring while workspace is open", COLORS["green"])


SCENES = [
    draw_report,
    draw_fix,
    draw_upload,
    draw_saved,
    draw_baseline,
    draw_policy,
    draw_watch,
    draw_watchdog,
]


def make_frames() -> tuple[list[Image.Image], list[int]]:
    frames: list[Image.Image] = []
    durations: list[int] = []
    for scene in SCENES:
        for i in range(9):
            img = Image.new("RGB", (WIDTH, HEIGHT))
            draw = ImageDraw.Draw(img)
            t = i / 8
            scene(draw, t)
            frames.append(img)
            durations.append(190 if i < 8 else 1080)
    return frames, durations


def save_gif(frames: Iterable[Image.Image], durations: list[int]) -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    palette_frames: list[Image.Image] = []
    for frame in frames:
        palette_frames.append(frame.convert("P", palette=Image.Palette.ADAPTIVE, colors=192))
    first, *rest = palette_frames
    first.save(
        OUT,
        save_all=True,
        append_images=rest,
        duration=durations,
        loop=0,
        optimize=True,
        disposal=2,
    )


if __name__ == "__main__":
    frames, durations = make_frames()
    save_gif(frames, durations)
    print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes)")

