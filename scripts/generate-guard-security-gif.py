from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "marketplace" / "extension" / "media" / "guard-security.gif"
WIDTH = 1120
HEIGHT = 630


def font(size: int, bold: bool = False):
    candidates = [
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


FONT_XS = font(18)
FONT_SM = font(22)
FONT_MD = font(28, True)
FONT_LG = font(44, True)
FONT_MONO = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 18) if Path("C:/Windows/Fonts/consola.ttf").exists() else FONT_XS


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def gradient_background(draw: ImageDraw.ImageDraw):
    for y in range(HEIGHT):
        t = y / HEIGHT
        r = lerp(5, 13, t)
        g = lerp(12, 25, t)
        b = lerp(11, 21, t)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))
    draw.ellipse((-220, -180, 420, 360), fill=(11, 83, 66))
    draw.ellipse((760, 360, 1320, 780), fill=(89, 46, 16))


def rounded(draw: ImageDraw.ImageDraw, box, radius=18, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(draw: ImageDraw.ImageDraw, xy, value, fill=(235, 245, 240), fnt=FONT_SM):
    draw.text(xy, value, fill=fill, font=fnt)


def nav(draw: ImageDraw.ImageDraw, active: str):
    rounded(draw, (50, 38, WIDTH - 50, 98), 20, fill=(9, 16, 15), outline=(39, 59, 53))
    text(draw, (76, 56), "DryLake Control Plane", (225, 244, 236), FONT_MD)
    items = [("Agent Control", 710), ("Security", 890)]
    for label, x in items:
        selected = label == active
        rounded(draw, (x, 50, x + 160, 86), 15, fill=(31, 185, 129) if selected else (18, 28, 26), outline=(58, 91, 80))
        text(draw, (x + 18, 57), label, (6, 16, 13) if selected else (190, 209, 200), FONT_XS)


def report_card(draw: ImageDraw.ImageDraw, x, y, w, h, title, value, accent=(52, 211, 153)):
    rounded(draw, (x, y, x + w, y + h), 16, fill=(9, 16, 15), outline=(42, 63, 57))
    text(draw, (x + 18, y + 16), title, (147, 168, 159), FONT_XS)
    text(draw, (x + 18, y + 48), value, accent, FONT_MD)


def finding_row(draw: ImageDraw.ImageDraw, y, severity, title, detail, color):
    rounded(draw, (76, y, WIDTH - 76, y + 64), 14, fill=(12, 20, 18), outline=(44, 66, 60))
    rounded(draw, (96, y + 18, 178, y + 46), 10, fill=color)
    text(draw, (112, y + 19), severity, (7, 11, 10), FONT_XS)
    text(draw, (198, y + 12), title, (232, 245, 239), FONT_SM)
    text(draw, (198, y + 38), detail, (151, 169, 160), FONT_XS)


def progress_frame(phase: int, tick: int):
    img = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    gradient_background(draw)
    nav(draw, "Security")
    text(draw, (76, 132), "Agentic Security Posture", (240, 249, 245), FONT_LG)
    text(draw, (80, 190), "Running local Guard scan. Nothing raw leaves your machine.", (169, 190, 180), FONT_SM)
    steps = [
        "Prompt injection rules",
        "Supply-chain scripts",
        "MCP/tool access",
        "IDE extension access",
        "Secret hygiene",
        "Blast radius + deploy surface",
        "Token waste",
        "Suspicious artifacts",
    ]
    for i, step in enumerate(steps):
        y = 246 + i * 40
        done = i < phase
        active = i == phase
        color = (52, 211, 153) if done else (251, 146, 60) if active else (53, 71, 65)
        draw.ellipse((84, y, 108, y + 24), fill=color)
        text(draw, (124, y - 2), step, (230, 244, 237) if done or active else (132, 150, 143), FONT_SM)
    pct = min(100, int(((phase + tick / 5) / len(steps)) * 100))
    rounded(draw, (76, 574, WIDTH - 76, 596), 11, fill=(17, 28, 25), outline=(54, 78, 70))
    rounded(draw, (76, 574, 76 + int((WIDTH - 152) * pct / 100), 596), 11, fill=(52, 211, 153))
    text(draw, (WIDTH - 162, 540), f"{pct}% scanned", (174, 245, 216), FONT_MONO)
    return img


def report_frame(tick: int):
    img = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    gradient_background(draw)
    nav(draw, "Security")
    text(draw, (76, 122), "Responsible Agent Score", (240, 249, 245), FONT_LG)
    score = 62 + min(tick, 8)
    report_card(draw, 76, 190, 240, 104, "SCORE", f"{score}/100")
    report_card(draw, 340, 190, 240, 104, "RANK", "Operator")
    report_card(draw, 604, 190, 220, 104, "TOP RISKS", "4")
    report_card(draw, 848, 190, 196, 104, "SECRETS", "Redacted")
    finding_row(draw, 324, "HIGH", "Prompt Injection Risk", "Rules file requests shell/network escalation", (251, 146, 60))
    finding_row(draw, 398, "HIGH", "Supply-Chain Risk", "Unpinned MCP package launched through npx", (251, 146, 60))
    finding_row(draw, 472, "MED", "IDE Extension Access", "Agent extension contributes terminal commands", (253, 224, 71))
    rounded(draw, (76, 560, 274, 602), 14, fill=(52, 211, 153))
    text(draw, (103, 568), "Open Report", (5, 12, 10), FONT_SM)
    rounded(draw, (296, 560, 498, 602), 14, fill=(18, 30, 27), outline=(68, 92, 84))
    text(draw, (328, 568), "Copy Summary", (221, 238, 230), FONT_SM)
    rounded(draw, (520, 560, 720, 602), 14, fill=(251, 146, 60))
    text(draw, (557, 568), "Fix with AI", (8, 11, 10), FONT_SM)
    return img


def cloud_frame(tick: int):
    img = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    gradient_background(draw)
    nav(draw, "Security")
    text(draw, (76, 124), "Approved Upload", (240, 249, 245), FONT_LG)
    text(draw, (80, 182), "Deep Cloud Analysis uses only approved, redacted Guard metadata.", (176, 196, 187), FONT_SM)
    rounded(draw, (76, 236, WIDTH - 76, 502), 22, fill=(9, 16, 15), outline=(58, 83, 75), width=2)
    allowed = ["Redacted findings", "MCP metadata", "Extension metadata", "Package scripts", "File path inventory"]
    blocked = ["Raw secrets", ".env values", "Private keys", "Full source tree", "Unapproved files"]
    text(draw, (116, 270), "Uploaded", (52, 211, 153), FONT_MD)
    text(draw, (610, 270), "Never uploaded", (251, 146, 60), FONT_MD)
    for i, item in enumerate(allowed):
        y = 324 + i * 30
        text(draw, (122, y), f"+ {item}", (213, 239, 229), FONT_SM)
    for i, item in enumerate(blocked):
        y = 324 + i * 30
        text(draw, (616, y), f"- {item}", (244, 207, 177), FONT_SM)
    pulse = 18 + (tick % 8) * 2
    rounded(draw, (390, 548, 730, 596), 18, fill=(52, 211, 153))
    text(draw, (430, 559), "Approve Deep Cloud Analysis", (5, 12, 10), FONT_SM)
    draw.ellipse((744, 558, 744 + pulse, 558 + pulse), outline=(52, 211, 153), width=3)
    return img


def team_frame(tick: int):
    img = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    gradient_background(draw)
    nav(draw, "Security")
    text(draw, (76, 124), "Team Security", (240, 249, 245), FONT_LG)
    text(draw, (80, 182), "Shared baseline, drift detection, team policy, and Continuous Watch.", (176, 196, 187), FONT_SM)
    cards = [
        ("Team Baseline", "Clean report marked as baseline", (76, 246)),
        ("Baseline Drift", "New MCP tools and extensions detected", (594, 246)),
        ("Team Policy", "MCP and extension allowlists enforced", (76, 390)),
        ("Continuous Watch", "Scheduled check-ins create history", (594, 390)),
    ]
    for title, body, (x, y) in cards:
        rounded(draw, (x, y, x + 450, y + 110), 18, fill=(10, 17, 15), outline=(50, 75, 67))
        text(draw, (x + 24, y + 22), title, (52, 211, 153), FONT_MD)
        text(draw, (x + 24, y + 62), body, (190, 210, 201), FONT_SM)
    rounded(draw, (76, 548, WIDTH - 76, 590), 16, fill=(18, 30, 27), outline=(68, 92, 84))
    offset = 88 + (tick % 10) * 78
    rounded(draw, (offset, 555, offset + 180, 583), 14, fill=(52, 211, 153))
    text(draw, (96, 600), "Watchdog stays local. Continuous Watch is Team Security only.", (151, 169, 160), FONT_XS)
    return img


def main():
    frames = []
    durations = []

    for phase in range(8):
        for tick in range(5):
            frames.append(progress_frame(phase, tick))
            durations.append(70)

    for tick in range(16):
        frames.append(report_frame(tick))
        durations.append(90)

    for tick in range(18):
        frames.append(cloud_frame(tick))
        durations.append(90)

    for tick in range(18):
        frames.append(team_frame(tick))
        durations.append(90)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
    )
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
