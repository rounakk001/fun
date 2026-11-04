"""
Yeonix ML-Powered Video Platform - Professional PowerPoint Presentation Generator
Student: Krishna Singh | Reg No: 12302957 | Section: K3E2345 | Roll No: 5
Submitted to: Ansh Pratap Singh | Lovely Professional University, Phagwara Punjab
"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.dml import MSO_THEME_COLOR
from pptx.oxml.ns import qn
from pptx.oxml import parse_xml
from lxml import etree
import copy

# ─── CONFIG ────────────────────────────────────────────────────────────────────
IMG_DIR = r"C:\Users\rouna\.gemini\antigravity\brain\90ba4b59-eb63-4d53-a296-f39283c43708\.user_uploaded"
OUTPUT_PATH = r"C:\Users\rouna\Downloads\Yeonix-main\Yeonix_Presentation.pptx"

# ─── THEME COLORS ──────────────────────────────────────────────────────────────
NAVY        = RGBColor(0x0B, 0x1D, 0x3A)   # Deep navy (bg)
NAVY_LIGHT  = RGBColor(0x10, 0x2B, 0x55)   # Slide content bg
ACCENT      = RGBColor(0xFF, 0x6B, 0x35)   # Orange accent
ACCENT2     = RGBColor(0x00, 0xC8, 0xFF)   # Cyan accent
WHITE       = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY  = RGBColor(0xCC, 0xD6, 0xE8)
GREEN_OK    = RGBColor(0x2E, 0xCC, 0x71)
CODE_BG     = RGBColor(0x0D, 0x1B, 0x2A)
GOLD        = RGBColor(0xFF, 0xD7, 0x00)

prs = Presentation()
prs.slide_width  = Inches(13.33)
prs.slide_height = Inches(7.5)

BLANK = prs.slide_layouts[6]  # Completely blank layout

# ─── HELPER FUNCTIONS ──────────────────────────────────────────────────────────

def hex_fill(shape, hex_rgb: RGBColor):
    """Fills a shape with a solid color."""
    fill = shape.fill
    fill.solid()
    fill.fore_color.rgb = hex_rgb

def add_rect(slide, left, top, width, height, color: RGBColor, alpha=None):
    """Add a filled rectangle."""
    shape = slide.shapes.add_shape(
        1,  # MSO_SHAPE_TYPE.RECTANGLE
        Inches(left), Inches(top), Inches(width), Inches(height)
    )
    shape.line.fill.background()
    hex_fill(shape, color)
    return shape

def add_text_box(slide, text, left, top, width, height,
                 font_size=18, bold=False, italic=False,
                 color=WHITE, align=PP_ALIGN.LEFT,
                 font_name="Calibri", word_wrap=True):
    txBox = slide.shapes.add_textbox(
        Inches(left), Inches(top), Inches(width), Inches(height)
    )
    txBox.word_wrap = word_wrap
    tf = txBox.text_frame
    tf.word_wrap = word_wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.name = font_name
    run.font.size = Pt(font_size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return txBox

def add_multiline_textbox(slide, lines, left, top, width, height,
                          font_name="Calibri", base_size=14, color=WHITE,
                          line_spacing_pt=None):
    """
    lines: list of (text, font_size, bold, italic, color_override_or_None)
    """
    txBox = slide.shapes.add_textbox(
        Inches(left), Inches(top), Inches(width), Inches(height)
    )
    txBox.word_wrap = True
    tf = txBox.text_frame
    tf.word_wrap = True

    for i, item in enumerate(lines):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        
        if isinstance(item, str):
            text, size, bold, italic, clr = item, base_size, False, False, None
        else:
            text = item[0]
            size = item[1] if len(item) > 1 else base_size
            bold = item[2] if len(item) > 2 else False
            italic = item[3] if len(item) > 3 else False
            clr = item[4] if len(item) > 4 else None

        run = p.add_run()
        run.text = text
        run.font.name = font_name
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.italic = italic
        run.font.color.rgb = clr if clr else color
    return txBox

def add_image_safe(slide, filename, left, top, width=None, height=None):
    path = os.path.join(IMG_DIR, filename)
    if not os.path.exists(path):
        return None
    try:
        if width and height:
            pic = slide.shapes.add_picture(path, Inches(left), Inches(top), Inches(width), Inches(height))
        elif width:
            pic = slide.shapes.add_picture(path, Inches(left), Inches(top), Inches(width))
        elif height:
            pic = slide.shapes.add_picture(path, Inches(left), Inches(top), height=Inches(height))
        else:
            pic = slide.shapes.add_picture(path, Inches(left), Inches(top))
        return pic
    except Exception as e:
        print(f"Warning: Could not add image {filename}: {e}")
        return None

def slide_bg(slide, color=NAVY):
    """Set slide background color."""
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_divider_line(slide, top, left=0.5, width=12.33, color=ACCENT, thickness=2):
    """Adds a thin horizontal line."""
    from pptx.util import Pt as PtUnit
    line = slide.shapes.add_shape(1, Inches(left), Inches(top), Inches(width), Pt(thickness))
    hex_fill(line, color)
    line.line.fill.background()

def add_bullet_item(tf, text, size=13, color=WHITE, bullet_char="▸", accent=ACCENT2):
    p = tf.add_paragraph()
    p.alignment = PP_ALIGN.LEFT
    # Bullet
    r1 = p.add_run()
    r1.text = bullet_char + "  "
    r1.font.name = "Calibri"
    r1.font.size = Pt(size)
    r1.font.bold = True
    r1.font.color.rgb = accent
    # Text
    r2 = p.add_run()
    r2.text = text
    r2.font.name = "Calibri"
    r2.font.size = Pt(size)
    r2.font.color.rgb = color
    return p

def add_code_box(slide, code_text, left, top, width, height, title="Code"):
    """Add a code block with dark background."""
    # Dark code bg
    add_rect(slide, left, top, width, height, CODE_BG)
    # Left accent bar
    add_rect(slide, left, top, 0.05, height, ACCENT2)

    txBox = slide.shapes.add_textbox(
        Inches(left + 0.12), Inches(top + 0.05), Inches(width - 0.2), Inches(height - 0.1)
    )
    txBox.word_wrap = True
    tf = txBox.text_frame
    tf.word_wrap = True

    # Title line
    p0 = tf.paragraphs[0]
    r0 = p0.add_run()
    r0.text = f"// {title}"
    r0.font.name = "Consolas"
    r0.font.size = Pt(9)
    r0.font.color.rgb = ACCENT2
    r0.font.bold = True

    for line in code_text.strip().split("\n"):
        p = tf.add_paragraph()
        r = p.add_run()
        r.text = line
        r.font.name = "Consolas"
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(0xCC, 0xE8, 0xFF)
    return txBox

def add_stat_box(slide, left, top, width, height, value, label, bg_color, value_color=WHITE):
    """Adds a stat card (value + label)."""
    add_rect(slide, left, top, width, height, bg_color)
    # Value
    add_text_box(slide, value, left + 0.1, top + 0.1, width - 0.2, height * 0.55,
                 font_size=26, bold=True, color=value_color, align=PP_ALIGN.CENTER)
    # Label
    add_text_box(slide, label, left + 0.05, top + height * 0.55, width - 0.1, height * 0.45,
                 font_size=11, bold=False, color=LIGHT_GRAY, align=PP_ALIGN.CENTER)

# ──────────────────────────────────────────────────────────────────────────────
# SLIDE 1: TITLE SLIDE
# ──────────────────────────────────────────────────────────────────────────────
def make_slide_1_title():
    slide = prs.slides.add_slide(BLANK)
    slide_bg(slide, NAVY)

    # Gradient overlay band at top
    add_rect(slide, 0, 0, 13.33, 0.08, ACCENT)
    add_rect(slide, 0, 7.42, 13.33, 0.08, ACCENT)

    # Left accent bar
    add_rect(slide, 0, 0, 0.12, 7.5, ACCENT2)

    # Platform title
    add_text_box(slide, "YEONIX", 0.5, 0.7, 9, 1.4,
                 font_size=72, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
    add_text_box(slide, "ML-Powered Video Platform", 0.5, 2.0, 9, 0.8,
                 font_size=30, bold=False, color=ACCENT2, align=PP_ALIGN.LEFT)
    add_text_box(slide, "MongoDB | Express | React | Node.js | Python FastAPI", 0.5, 2.75, 9.5, 0.5,
                 font_size=14, bold=False, color=LIGHT_GRAY, align=PP_ALIGN.LEFT, italic=True)

    # Divider
    add_divider_line(slide, 3.4, 0.5, 12.0, ACCENT, 3)

    # Student info card (bottom-right box)
    add_rect(slide, 8.3, 3.6, 4.8, 3.5, NAVY_LIGHT)
    add_rect(slide, 8.3, 3.6, 0.06, 3.5, ACCENT)

    info_lines = [
        ("Krishna Singh", 16, True, False, WHITE),
        ("Reg No: 12302957", 12, False, False, LIGHT_GRAY),
        ("Section: K3E2345  |  Roll No: 5", 12, False, False, LIGHT_GRAY),
        ("", 8, False, False, WHITE),
        ("Submitted to:", 11, False, True, ACCENT2),
        ("Ansh Pratap Singh", 13, True, False, WHITE),
        ("", 8, False, False, WHITE),
        ("Lovely Professional University", 11, False, False, LIGHT_GRAY),
        ("Phagwara, Punjab", 11, False, False, LIGHT_GRAY),
    ]
    add_multiline_textbox(slide, info_lines, 8.55, 3.75, 4.5, 3.2)

    # Left side bullets
    txBox = slide.shapes.add_textbox(Inches(0.5), Inches(3.6), Inches(7.5), Inches(3.5))
    txBox.word_wrap = True
    tf = txBox.text_frame
    tf.word_wrap = True

    p0 = tf.paragraphs[0]
    r0 = p0.add_run()
    r0.text = "Project Highlights"
    r0.font.name = "Calibri"
    r0.font.size = Pt(16)
    r0.font.bold = True
    r0.font.color.rgb = ACCENT

    for item in [
        "Full-stack MERN video sharing platform",
        "Content-Based TF-IDF + Collaborative SVD ML engine",
        "MongoDB Atlas + Local fallback resilience",
        "Real-time Creator Analytics Dashboard",
        "57 automated tests across backend & ML service",
    ]:
        add_bullet_item(tf, item, size=12, color=LIGHT_GRAY)

make_slide_1_title()
print("Slide 1: Title OK")

# ──────────────────────────────────────────────────────────────────────────────
# SLIDE 2: AGENDA / TABLE OF CONTENTS
# ──────────────────────────────────────────────────────────────────────────────
def make_slide_2_agenda():
    slide = prs.slides.add_slide(BLANK)
    slide_bg(slide, NAVY)
    add_rect(slide, 0, 0, 0.12, 7.5, ACCENT2)
    add_rect(slide, 0.12, 0, 13.21, 1.1, NAVY_LIGHT)

    add_text_box(slide, "Agenda", 0.4, 0.15, 12, 0.8,
                 font_size=36, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
    add_divider_line(slide, 1.1, 0.5, 12.5, ACCENT, 2)

    agenda_items = [
        ("01", "Problem Statement & Project Overview"),
        ("02", "System Architecture — MERN + Python ML"),
        ("03", "MongoDB Database Design & Schemas"),
        ("04", "Aggregation Pipelines & Creator Dashboard"),
        ("05", "ML Recommendation Engine — Content-Based & Hybrid"),
        ("06", "Live Demo — Up Next: Rajpal Comedy Fix"),
        ("07", "Testing & Benchmarks"),
        ("08", "Security, Scalability & Future Roadmap"),
        ("09", "Conclusion"),
    ]

    col1 = agenda_items[:5]
    col2 = agenda_items[5:]

    for i, (num, title) in enumerate(col1):
        top = 1.3 + i * 1.1
        add_rect(slide, 0.5, top, 0.6, 0.7, ACCENT)
        add_text_box(slide, num, 0.5, top, 0.6, 0.7,
                     font_size=18, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
        add_text_box(slide, title, 1.2, top + 0.05, 5.5, 0.65,
                     font_size=13, bold=False, color=LIGHT_GRAY)

    for i, (num, title) in enumerate(col2):
        top = 1.3 + i * 1.1
        add_rect(slide, 7.2, top, 0.6, 0.7, ACCENT2)
        add_text_box(slide, num, 7.2, top, 0.6, 0.7,
                     font_size=18, bold=True, color=NAVY, align=PP_ALIGN.CENTER)
        add_text_box(slide, title, 7.9, top + 0.05, 5.2, 0.65,
                     font_size=13, bold=False, color=LIGHT_GRAY)

make_slide_2_agenda()
print("Slide 2: Agenda OK")

# ──────────────────────────────────────────────────────────────────────────────
# SLIDE 3: PROBLEM STATEMENT & OVERVIEW
# ──────────────────────────────────────────────────────────────────────────────
def make_slide_3_problem():
    slide = prs.slides.add_slide(BLANK)
    slide_bg(slide, NAVY)
    add_rect(slide, 0, 0, 0.12, 7.5, ACCENT)
    add_rect(slide, 0.12, 0, 13.21, 1.1, NAVY_LIGHT)
    add_text_box(slide, "01  Problem Statement & Overview", 0.4, 0.15, 12, 0.8,
                 font_size=30, bold=True, color=WHITE)
    add_divider_line(slide, 1.1, 0.5, 12.5, ACCENT, 2)

    # Left: Problem box
    add_rect(slide, 0.3, 1.25, 6.0, 5.8, NAVY_LIGHT)
    add_rect(slide, 0.3, 1.25, 0.07, 5.8, ACCENT)

    add_text_box(slide, "❌  The Problem", 0.55, 1.35, 5.6, 0.5,
                 font_size=15, bold=True, color=ACCENT)

    problems_tf = slide.shapes.add_textbox(Inches(0.55), Inches(1.85), Inches(5.6), Inches(3.5))
    problems_tf.word_wrap = True
    tf = problems_tf.text_frame
    tf.word_wrap = True
    p0 = tf.paragraphs[0]
    p0.add_run().text = ""

    for prob in [
        "No intelligent content recommendations — videos shown in chronological order only",
        "Comedy video 'Tushar Basra' showed 'ML Tutorial' next — completely irrelevant",
        "No interaction tracking — views, watch duration, skips not captured",
        "MongoDB Atlas SSL failures crashed the Express server in institutional WiFi",
        "Auth interceptor loop: logging out and re-signing in triggered 401 error storms",
    ]:
        add_bullet_item(tf, prob, size=11.5, color=LIGHT_GRAY, bullet_char="✗", accent=ACCENT)

    # Right: Solution box
    add_rect(slide, 6.8, 1.25, 6.2, 5.8, NAVY_LIGHT)
    add_rect(slide, 6.8, 1.25, 0.07, 5.8, GREEN_OK)

    add_text_box(slide, "✅  The Solution", 7.05, 1.35, 5.8, 0.5,
                 font_size=15, bold=True, color=GREEN_OK)

    solutions_tf = slide.shapes.add_textbox(Inches(7.05), Inches(1.85), Inches(5.7), Inches(3.5))
    solutions_tf.word_wrap = True
    tf2 = solutions_tf.text_frame
    tf2.word_wrap = True
    p00 = tf2.paragraphs[0]
    p00.add_run().text = ""

    for sol in [
        "Python FastAPI ML microservice — TF-IDF Content-Based + Hybrid recommendations",
        "ML now surfaces RAJPAL FUNNY VIDEO (score: 0.1486) as #1 for comedy content",
        "Phase 2: interaction.model.js — 7 event types tracked per video session",
        "Dual-tier DB: Atlas primary → Local MongoDB 127.0.0.1 failover with retry",
        "Auth bypass list in axiosInstance.js — no more refresh-token loops on logout",
    ]:
        add_bullet_item(tf2, sol, size=11.5, color=LIGHT_GRAY, bullet_char="✓", accent=GREEN_OK)

make_slide_3_problem()
print("Slide 3: Problem Statement OK")

# ──────────────────────────────────────────────────────────────────────────────
# SLIDE 4: SYSTEM ARCHITECTURE
# ──────────────────────────────────────────────────────────────────────────────
def make_slide_4_architecture():
    slide = prs.slides.add_slide(BLANK)
    slide_bg(slide, NAVY)
    add_rect(slide, 0, 0, 0.12, 7.5, ACCENT2)
    add_rect(slide, 0.12, 0, 13.21, 1.1, NAVY_LIGHT)
    add_text_box(slide, "02  System Architecture", 0.4, 0.15, 12, 0.8,
                 font_size=30, bold=True, color=WHITE)
    add_divider_line(slide, 1.1, 0.5, 12.5, ACCENT2, 2)

    # Architecture boxes
    layers = [
        ("🖥️  Frontend Layer", "React 18 + Vite\nReact Router 6\nAxios + httpOnly Cookies\nPort: 5173", ACCENT2, NAVY),
        ("⚙️  Backend Layer", "Express.js (Node.js)\nMongoDB Mongoose ODM\nJWT + Refresh Tokens\nPort: 8000", ACCENT, WHITE),
        ("🤖  ML Service Layer", "Python FastAPI\nTF-IDF + SVD + MMR\nCosine Similarity\nPort: 5000", GREEN_OK, NAVY),
        ("🗄️  Database Layer", "MongoDB (Primary)\nAtlas Cloud Cluster\n↓ Local 127.0.0.1\nResilience Fallback", RGBColor(0x9B, 0x59, 0xB6), WHITE),
        ("☁️  Media Layer", "Cloudinary CDN\nVideo Streaming URLs\nThumbnail Storage\nDuration Metadata", GOLD, NAVY),
    ]

    total_width = 12.5
    box_width = total_width / len(layers)
    for i, (title, content, bg, fg) in enumerate(layers):
        left = 0.4 + i * box_width
        add_rect(slide, left, 1.3, box_width - 0.1, 1.0, bg)
        add_text_box(slide, title, left + 0.05, 1.32, box_width - 0.15, 0.96,
                     font_size=11, bold=True, color=fg, align=PP_ALIGN.CENTER)

        # Arrow down
        if i < len(layers) - 1:
            add_text_box(slide, "⟷", left + box_width - 0.25, 1.6, 0.5, 0.5,
                         font_size=18, bold=True, color=LIGHT_GRAY, align=PP_ALIGN.CENTER)

        # Content box below
        add_rect(slide, left, 2.4, box_width - 0.1, 2.8, NAVY_LIGHT)
        content_tf = slide.shapes.add_textbox(
            Inches(left + 0.08), Inches(2.5), Inches(box_width - 0.25), Inches(2.6)
        )
        content_tf.word_wrap = True
        tf = content_tf.text_frame
        tf.word_wrap = True
        for j, line in enumerate(content.split("\n")):
            if j == 0:
                p = tf.paragraphs[0]
            else:
                p = tf.add_paragraph()
            r = p.add_run()
            r.text = line
            r.font.name = "Calibri"
            r.font.size = Pt(10.5)
            r.font.color.rgb = LIGHT_GRAY if j > 0 else WHITE
            r.font.bold = (j == 0)

    # Data Flow Label
    add_text_box(slide, "Request / Response Data Flow", 0.4, 5.3, 12.5, 0.4,
                 font_size=12, bold=False, color=LIGHT_GRAY, align=PP_ALIGN.CENTER, italic=True)

    # Tech stack strip
    add_rect(slide, 0, 5.75, 13.33, 1.5, NAVY_LIGHT)
    add_text_box(slide, "Tech Stack:", 0.4, 5.85, 1.5, 0.4, font_size=12, bold=True, color=ACCENT)
    stack_items = ["MongoDB", "Express.js", "React 18", "Node.js", "Python 3.12",
                   "FastAPI", "scikit-learn", "Cloudinary", "Mongoose ODM", "JWT Auth"]
    for i, item in enumerate(stack_items):
        col = i % 5
        row = i // 5
        add_rect(slide, 1.9 + col * 2.25, 5.82 + row * 0.62, 2.1, 0.52, RGBColor(0x1A, 0x3A, 0x6E))
        add_text_box(slide, item, 1.95 + col * 2.25, 5.85 + row * 0.62, 2.0, 0.45,
                     font_size=11, bold=True, color=ACCENT2, align=PP_ALIGN.CENTER)

make_slide_4_architecture()
print("Slide 4: Architecture OK")

# ──────────────────────────────────────────────────────────────────────────────
# SLIDE 5: MONGODB DATABASE DESIGN
# ──────────────────────────────────────────────────────────────────────────────
def make_slide_5_mongodb():
    slide = prs.slides.add_slide(BLANK)
    slide_bg(slide, NAVY)
    add_rect(slide, 0, 0, 0.12, 7.5, GREEN_OK)
    add_rect(slide, 0.12, 0, 13.21, 1.1, NAVY_LIGHT)
    add_text_box(slide, "03  MongoDB Database Design & Schemas", 0.4, 0.15, 12, 0.8,
                 font_size=30, bold=True, color=WHITE)
    add_divider_line(slide, 1.1, 0.5, 12.5, GREEN_OK, 2)

    # Left: Collections overview
    add_rect(slide, 0.3, 1.25, 4.5, 5.9, NAVY_LIGHT)
    add_text_box(slide, "🗃️  Collections (7 Total)", 0.45, 1.35, 4.2, 0.45,
                 font_size=13, bold=True, color=GREEN_OK)

    collections = [
        ("users", "Username, email, avatar, watchHistory[]"),
        ("videos", "Title, tags[], category, views, owner"),
        ("likes", "video: ObjectId, likedBy, isDislike"),
        ("subscriptions", "subscriber: ObjectId, channel: ObjectId"),
        ("comments", "content, video, owner"),
        ("playlists", "name, videos: [ObjectId], owner"),
        ("interactions", "Phase 2: watch, click, like events"),
    ]
    col_tf = slide.shapes.add_textbox(Inches(0.45), Inches(1.85), Inches(4.2), Inches(5.1))
    col_tf.word_wrap = True
    tf = col_tf.text_frame
    tf.word_wrap = True
    p0 = tf.paragraphs[0]; p0.add_run().text = ""
    for coll, desc in collections:
        p = tf.add_paragraph()
        r1 = p.add_run()
        r1.text = f"  {coll}  "
        r1.font.name = "Consolas"
        r1.font.size = Pt(11)
        r1.font.bold = True
        r1.font.color.rgb = ACCENT2
        r2 = p.add_run()
        r2.text = desc
        r2.font.name = "Calibri"
        r2.font.size = Pt(10)
        r2.font.color.rgb = LIGHT_GRAY

    # Right: Code snippet - Video Schema
    add_code_box(slide, """const videoSchema = new Schema({
  videoFile: { type: String, required: true },
  thumbnail: { type: String, required: true },
  title:     { type: String, required: true, index: true },
  description:{ type: String, required: true },
  duration:  { type: Number, required: true },
  views:     { type: Number, default: 0, index: true },
  isPublished:{ type: Boolean, default: true },
  tags:      [{ type: String, lowercase: true }],  // Multikey index
  category:  { type: String, default: "General", index: true },
  owner:     { type: Schema.Types.ObjectId, ref: "User", index: true }
}, { timestamps: true });

// Phase 2 — Interaction Schema
const interactionSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: "User" },
  sessionId: { type: String, required: true },
  videoId:   { type: Schema.Types.ObjectId, ref: "Video" },
  eventType: { type: String, enum: ["watch","like","click","skip"] },
  watchDuration:  { type: Number, default: 0 },
  completionPct:  { type: Number, min: 0, max: 100 }
}, { timestamps: true });""",
        5.0, 1.2, 8.1, 6.1, title="video.model.js + interaction.model.js")

make_slide_5_mongodb()
print("Slide 5: MongoDB Schemas OK")

# ──────────────────────────────────────────────────────────────────────────────
# SLIDE 6: AGGREGATION PIPELINES + CREATOR DASHBOARD SCREENSHOT
# ──────────────────────────────────────────────────────────────────────────────
def make_slide_6_aggregation():
    slide = prs.slides.add_slide(BLANK)
    slide_bg(slide, NAVY)
    add_rect(slide, 0, 0, 0.12, 7.5, GOLD)
    add_rect(slide, 0.12, 0, 13.21, 1.1, NAVY_LIGHT)
    add_text_box(slide, "04  Aggregation Pipelines & Creator Dashboard", 0.4, 0.15, 12, 0.8,
                 font_size=28, bold=True, color=WHITE)
    add_divider_line(slide, 1.1, 0.5, 12.5, GOLD, 2)

    # Code left
    add_code_box(slide, """// Channel Stats Aggregation (dashboard.controller.js)
const channelStats = await Video.aggregate([
  // Stage 1: Filter this creator's videos
  { $match: { owner: new ObjectId(req.user._id) } },
  
  // Stage 2: JOIN Likes collection
  { $lookup: {
      from: "likes", localField: "_id",
      foreignField: "video", as: "videoLikes"
  }},
  
  // Stage 3: GROUP — sum views, videos, likes
  { $group: {
      _id: null,
      totalViews:  { $sum: "$views" },
      totalVideos: { $sum: 1 },
      totalLikes:  { $sum: { $size: "$videoLikes" } }
  }}
]);
// Subscriber count from Subscriptions collection
const subs = await Subscription.countDocuments(
  { channel: req.user._id }
);""",
        0.3, 1.2, 6.5, 5.5, title="MongoDB Aggregation Pipeline")

    # Screenshot right
    img = add_image_safe(slide, "media_1793686266670_ac9bf45e.png", 7.0, 1.2, 6.1)
    if img:
        # Keep aspect ratio by adjusting height
        pass

    # Caption
    add_text_box(slide, "Figure: Creator Dashboard — Total Views: 11 | Likes: 2 | Videos: 3",
                 7.0, 6.5, 6.1, 0.5, font_size=9, italic=True, color=LIGHT_GRAY, align=PP_ALIGN.CENTER)

    # Stats strip bottom-left
    stats = [("$match", "Filter Stage"), ("$lookup", "JOIN Stage"), ("$group", "Reduce Stage")]
    for i, (op, label) in enumerate(stats):
        add_rect(slide, 0.4 + i * 2.1, 6.5, 1.9, 0.75, RGBColor(0x1A, 0x3A, 0x6E))
        add_text_box(slide, op, 0.4 + i * 2.1, 6.52, 1.9, 0.4,
                     font_size=14, bold=True, color=GOLD, align=PP_ALIGN.CENTER, font_name="Consolas")
        add_text_box(slide, label, 0.4 + i * 2.1, 6.9, 1.9, 0.3,
                     font_size=9, color=LIGHT_GRAY, align=PP_ALIGN.CENTER)

make_slide_6_aggregation()
print("Slide 6: Aggregation + Dashboard OK")

# ──────────────────────────────────────────────────────────────────────────────
# SLIDE 7: SEARCH + LIKED VIDEOS SCREENSHOTS
# ──────────────────────────────────────────────────────────────────────────────
def make_slide_7_search():
    slide = prs.slides.add_slide(BLANK)
    slide_bg(slide, NAVY)
    add_rect(slide, 0, 0, 0.12, 7.5, ACCENT2)
    add_rect(slide, 0.12, 0, 13.21, 1.1, NAVY_LIGHT)
    add_text_box(slide, "05  Search, Regex Matching & $lookup Joins", 0.4, 0.15, 12, 0.8,
                 font_size=28, bold=True, color=WHITE)
    add_divider_line(slide, 1.1, 0.5, 12.5, ACCENT2, 2)

    # Left image: Search screenshot
    add_text_box(slide, "Search: 'rajpal' — MongoDB Regex Match", 0.3, 1.18, 6.2, 0.35,
                 font_size=12, bold=True, color=ACCENT2)
    add_image_safe(slide, "media_1793686255104_fb21a3dd.png", 0.3, 1.55, 6.0)

    # Right image: Liked videos screenshot
    add_text_box(slide, "Liked Videos — $lookup: Likes → Videos", 6.8, 1.18, 6.2, 0.35,
                 font_size=12, bold=True, color=GREEN_OK)
    add_image_safe(slide, "media_1793686273157_60aa17ef.png", 6.8, 1.55, 6.0)

    # Bottom: explanation strip
    add_rect(slide, 0.3, 6.3, 12.7, 1.0, NAVY_LIGHT)
    info_tf = slide.shapes.add_textbox(Inches(0.5), Inches(6.35), Inches(12.3), Inches(0.9))
    info_tf.word_wrap = True
    tf = info_tf.text_frame
    tf.word_wrap = True

    p0 = tf.paragraphs[0]
    r = p0.add_run()
    r.text = "Search Pipeline: "
    r.font.bold = True; r.font.size = Pt(11); r.font.color.rgb = ACCENT2; r.font.name = "Calibri"
    r2 = p0.add_run()
    r2.text = "$match → { $or: [ {title: {$regex: query, $options:'i'}}, {tags: {$in:[RegExp]}} ] }  |  "
    r2.font.size = Pt(10.5); r2.font.color.rgb = LIGHT_GRAY; r2.font.name = "Consolas"

    p1 = tf.add_paragraph()
    r3 = p1.add_run()
    r3.text = "Liked Videos: "
    r3.font.bold = True; r3.font.size = Pt(11); r3.font.color.rgb = GREEN_OK; r3.font.name = "Calibri"
    r4 = p1.add_run()
    r4.text = "$lookup: { from:'likes', localField:'_id', foreignField:'video' } — MongoDB left outer join across collections"
    r4.font.size = Pt(10.5); r4.font.color.rgb = LIGHT_GRAY; r4.font.name = "Calibri"

make_slide_7_search()
print("Slide 7: Search & Liked Videos OK")

# ──────────────────────────────────────────────────────────────────────────────
# SLIDE 8: ML RECOMMENDATION ENGINE
# ──────────────────────────────────────────────────────────────────────────────
def make_slide_8_ml():
    slide = prs.slides.add_slide(BLANK)
    slide_bg(slide, NAVY)
    add_rect(slide, 0, 0, 0.12, 7.5, ACCENT)
    add_rect(slide, 0.12, 0, 13.21, 1.1, NAVY_LIGHT)
    add_text_box(slide, "06  ML Recommendation Engine", 0.4, 0.15, 12, 0.8,
                 font_size=30, bold=True, color=WHITE)
    add_divider_line(slide, 1.1, 0.5, 12.5, ACCENT, 2)

    # Three algorithm cards
    algorithms = [
        ("Content-Based\nTF-IDF", ACCENT,
         "Extracts video metadata from MongoDB\n(title × 3.0, tags × 2.5, category × 2.0)\nBuilds TF-IDF sparse matrix\nCosine Similarity → ranked candidates\n\nBest for: Item-to-item matching\n(Tushar Basra → Rajpal score: 0.1486)"),
        ("Collaborative\nSVD Matrix", ACCENT2,
         "Interaction matrix from MongoDB\nUser×Video implicit feedback signals\nTruncatedSVD (n_components=50)\nFills cold-start via popularity fallback\n\nBest for: User preference modeling\n(watch time weighted)"),
        ("Popularity\nGravity Model", GREEN_OK,
         "Time-decayed engagement scoring:\nViews ×1.0 + Completions ×2.5\n+ Likes ×3.0 − Penalties\n÷ (Age_hours + 2.0)^1.5\n\nBest for: Cold start & trending\n(New users / new videos)"),
    ]

    for i, (title, color, desc) in enumerate(algorithms):
        left = 0.3 + i * 4.3
        add_rect(slide, left, 1.25, 4.15, 0.8, color)
        add_text_box(slide, title, left, 1.25, 4.15, 0.8,
                     font_size=16, bold=True, color=NAVY if color == ACCENT2 or color == GREEN_OK else WHITE,
                     align=PP_ALIGN.CENTER)
        add_rect(slide, left, 2.1, 4.15, 4.2, NAVY_LIGHT)
        desc_tf = slide.shapes.add_textbox(Inches(left + 0.1), Inches(2.18), Inches(3.95), Inches(4.0))
        desc_tf.word_wrap = True
        tf = desc_tf.text_frame
        tf.word_wrap = True
        p0 = tf.paragraphs[0]; p0.add_run().text = ""
        for line in desc.split("\n"):
            p = tf.add_paragraph()
            r = p.add_run()
            r.text = line
            r.font.name = "Calibri"
            r.font.size = Pt(11.5)
            r.font.color.rgb = LIGHT_GRAY if not line.startswith("Best for") else ACCENT2
            r.font.bold = line.startswith("Best for")

    # Bottom: Hybrid Engine
    add_rect(slide, 0.3, 6.4, 12.7, 0.85, RGBColor(0x1A, 0x3A, 0x6E))
    add_rect(slide, 0.3, 6.4, 0.07, 0.85, GOLD)
    add_text_box(slide, "Hybrid Engine:  0.6 × Content-Based  +  0.3 × Collaborative  +  0.1 × Popularity  →  MMR Re-ranking (λ=0.7)  →  MongoDB Hydration",
                 0.5, 6.45, 12.3, 0.75, font_size=12, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

make_slide_8_ml()
print("Slide 8: ML Engine OK")

# ──────────────────────────────────────────────────────────────────────────────
# SLIDE 9: LIVE DEMO — RAJPAL FIX (Watch Page Screenshot)
# ──────────────────────────────────────────────────────────────────────────────
def make_slide_9_demo():
    slide = prs.slides.add_slide(BLANK)
    slide_bg(slide, NAVY)
    add_rect(slide, 0, 0, 0.12, 7.5, GOLD)
    add_rect(slide, 0.12, 0, 13.21, 1.1, NAVY_LIGHT)
    add_text_box(slide, "07  Live Demo — Up Next: Comedy → Comedy Fix", 0.4, 0.15, 12, 0.8,
                 font_size=28, bold=True, color=WHITE)
    add_divider_line(slide, 1.1, 0.5, 12.5, GOLD, 2)

    # Large watch page screenshot
    add_image_safe(slide, "media_1793684773401_26c4bc20.png", 0.3, 1.2, 7.5)

    # Right panel: explanation
    add_rect(slide, 8.1, 1.2, 5.0, 6.0, NAVY_LIGHT)
    add_rect(slide, 8.1, 1.2, 0.07, 6.0, GOLD)

    right_tf = slide.shapes.add_textbox(Inches(8.3), Inches(1.3), Inches(4.65), Inches(5.7))
    right_tf.word_wrap = True
    tf = right_tf.text_frame
    tf.word_wrap = True

    p0 = tf.paragraphs[0]
    r0 = p0.add_run()
    r0.text = "Before vs. After"
    r0.font.name = "Calibri"; r0.font.size = Pt(15); r0.font.bold = True
    r0.font.color.rgb = GOLD

    lines = [
        ("", 6, False, False, WHITE),
        ("❌  BEFORE (chronological):", 12, True, False, ACCENT),
        ("Next video: Machine Learning Explained\n(wrong category — Technology!)", 11, False, False, LIGHT_GRAY),
        ("", 6, False, False, WHITE),
        ("✅  AFTER (ML-powered):", 12, True, False, GREEN_OK),
        ("Next video: RAJPAL FUNNY VIDEO", 11, False, False, LIGHT_GRAY),
        ("Category: Comedy | Score: 0.1486", 11, False, True, ACCENT2),
        ("Algorithm: content_based_hybrid", 10, False, True, ACCENT2),
        ("", 6, False, False, WHITE),
        ("🔢  Similarity Scores:", 12, True, False, GOLD),
        ("#1 RAJPAL FUNNY VIDEO  → 0.1486", 11, False, False, GREEN_OK),
        ("#2 MSDHONI FINISHER    → 0.0066", 11, False, False, LIGHT_GRAY),
        ("#3 JAVASCRIPT Explained → 0.0071", 11, False, False, LIGHT_GRAY),
        ("", 6, False, False, WHITE),
        ("Tags driving the match:", 11, True, False, ACCENT2),
        ("comedy • funny • humor • standup", 11, False, True, LIGHT_GRAY),
        ("bollywood • laughter (shared tokens)", 10, False, True, LIGHT_GRAY),
    ]
    add_multiline_textbox(slide, lines, 8.3, 2.05, 4.65, 5.0)

make_slide_9_demo()
print("Slide 9: Live Demo OK")

# ──────────────────────────────────────────────────────────────────────────────
# SLIDE 10: INDEXING STRATEGY
# ──────────────────────────────────────────────────────────────────────────────
def make_slide_10_indexing():
    slide = prs.slides.add_slide(BLANK)
    slide_bg(slide, NAVY)
    add_rect(slide, 0, 0, 0.12, 7.5, ACCENT2)
    add_rect(slide, 0.12, 0, 13.21, 1.1, NAVY_LIGHT)
    add_text_box(slide, "08  MongoDB Indexing & Query Optimization", 0.4, 0.15, 12, 0.8,
                 font_size=28, bold=True, color=WHITE)
    add_divider_line(slide, 1.1, 0.5, 12.5, ACCENT2, 2)

    # Index table
    headers = ["Index Type", "Collection / Fields", "Impact"]
    rows_data = [
        ("Single-Field Unique", "users: { username: 1 }, { email: 1 }", "O(log N) login lookups; prevents credential duplicates"),
        ("Multikey B-Tree", "videos: { tags: 1 }", "Indexes every array element; instant tag-based content search"),
        ("Compound Covering", "interactions: { userId:1, videoId:1, eventType:1 }", "Eliminates sort; 0ms interaction query (was ~150ms COLLSCAN)"),
        ("Time-Decay Sort", "interactions: { videoId:1, eventType:1, createdAt:-1 }", "Powers trending gravity window without in-memory sort"),
        ("Unique Pair", "likes: { video:1, likedBy:1 } unique:true", "Prevents duplicate likes at DB level"),
    ]

    col_widths = [2.2, 5.3, 5.2]
    col_lefts = [0.3, 2.6, 8.0]
    header_top = 1.25

    # Header row
    for j, (header, cw, cl) in enumerate(zip(headers, col_widths, col_lefts)):
        add_rect(slide, cl, header_top, cw, 0.5, NAVY_LIGHT if j == 0 else RGBColor(0x10, 0x2B, 0x55))
        add_rect(slide, cl, header_top, 0.05, 0.5, ACCENT2)
        add_text_box(slide, header, cl + 0.08, header_top, cw - 0.1, 0.5,
                     font_size=11, bold=True, color=ACCENT2, align=PP_ALIGN.LEFT)

    for i, (idx_type, fields, impact) in enumerate(rows_data):
        row_top = 1.85 + i * 0.92
        row_bg = NAVY_LIGHT if i % 2 == 0 else RGBColor(0x0E, 0x22, 0x42)
        for j, (text, cw, cl) in enumerate(zip([idx_type, fields, impact], col_widths, col_lefts)):
            add_rect(slide, cl, row_top, cw, 0.82, row_bg)
            clr = GOLD if j == 0 else (RGBColor(0xA8, 0xD8, 0xFF) if j == 1 else LIGHT_GRAY)
            fn = "Consolas" if j == 1 else "Calibri"
            add_text_box(slide, text, cl + 0.08, row_top + 0.05, cw - 0.12, 0.72,
                         font_size=9.5 if j == 1 else 10.5, color=clr, font_name=fn)

    # Bottom note
    add_text_box(slide, "explain('executionStats') confirms COLLSCAN → IXSCAN transition: executionTimeMillis: 0ms for compound index queries",
                 0.3, 6.65, 12.7, 0.55, font_size=10, italic=True, color=LIGHT_GRAY, align=PP_ALIGN.CENTER)

make_slide_10_indexing()
print("Slide 10: Indexing OK")

# ──────────────────────────────────────────────────────────────────────────────
# SLIDE 11: TESTING & BENCHMARKS
# ──────────────────────────────────────────────────────────────────────────────
def make_slide_11_testing():
    slide = prs.slides.add_slide(BLANK)
    slide_bg(slide, NAVY)
    add_rect(slide, 0, 0, 0.12, 7.5, GREEN_OK)
    add_rect(slide, 0.12, 0, 13.21, 1.1, NAVY_LIGHT)
    add_text_box(slide, "09  Testing & Benchmarks", 0.4, 0.15, 12, 0.8,
                 font_size=30, bold=True, color=WHITE)
    add_divider_line(slide, 1.1, 0.5, 12.5, GREEN_OK, 2)

    # Big stat boxes
    stat_data = [
        ("57", "Total Tests\nPassing", RGBColor(0x27, 0xAE, 0x60)),
        ("17", "Backend\nNode.js Tests", ACCENT2),
        ("40", "Python ML\nService Tests", ACCENT),
        ("100%", "Pass Rate\n(0 failures)", GOLD),
    ]
    for i, (val, label, color) in enumerate(stat_data):
        add_stat_box(slide, 0.5 + i * 3.15, 1.2, 2.9, 1.5, val, label, color,
                     value_color=NAVY if color in [ACCENT2, GREEN_OK, GOLD] else WHITE)

    # Left: Backend test coverage
    add_rect(slide, 0.3, 2.85, 6.2, 4.0, NAVY_LIGHT)
    add_rect(slide, 0.3, 2.85, 0.07, 4.0, ACCENT2)
    add_text_box(slide, "Backend Test Coverage", 0.5, 2.95, 5.9, 0.4,
                 font_size=13, bold=True, color=ACCENT2)
    be_tf = slide.shapes.add_textbox(Inches(0.5), Inches(3.4), Inches(5.9), Inches(3.3))
    be_tf.word_wrap = True
    tf = be_tf.text_frame; tf.word_wrap = True
    p0 = tf.paragraphs[0]; p0.add_run().text = ""
    backend_tests = [
        "Interaction model creation & validation",
        "Compound index enforcement (no duplicates)",
        "Session middleware UUID generation (anon)",
        "dislike toggling (isDislike: true/false)",
        "Video schema: tags[] & category fields",
        "JWT middleware verifyJWTOptional flow",
        "Auth interceptor bypass list (login/logout)",
    ]
    for t in backend_tests:
        add_bullet_item(tf, t, size=11, color=LIGHT_GRAY, bullet_char="✓", accent=GREEN_OK)

    # Right: ML test coverage
    add_rect(slide, 6.8, 2.85, 6.2, 4.0, NAVY_LIGHT)
    add_rect(slide, 6.8, 2.85, 0.07, 4.0, ACCENT)
    add_text_box(slide, "Python ML Test Coverage", 7.0, 2.95, 5.9, 0.4,
                 font_size=13, bold=True, color=ACCENT)
    ml_tf = slide.shapes.add_textbox(Inches(7.0), Inches(3.4), Inches(5.9), Inches(3.3))
    ml_tf.word_wrap = True
    tf2 = ml_tf.text_frame; tf2.word_wrap = True
    p00 = tf2.paragraphs[0]; p00.add_run().text = ""
    ml_tests = [
        "TF-IDF vectorization & cosine similarity matrix",
        "Content-based recommendation ranking order",
        "SVD matrix factorization (n_components=50)",
        "Collaborative filtering cold-start fallback",
        "Gravity trending decay formula verification",
        "MMR diversity re-ranking (λ=0.7)",
        "Hybrid score normalization & blending",
        "FastAPI route validation & response schemas",
        "MongoDB Atlas → local failover ping test",
    ]
    for t in ml_tests:
        add_bullet_item(tf2, t, size=11, color=LIGHT_GRAY, bullet_char="✓", accent=GREEN_OK)

make_slide_11_testing()
print("Slide 11: Testing OK")

# ──────────────────────────────────────────────────────────────────────────────
# SLIDE 12: SECURITY & SCALABILITY
# ──────────────────────────────────────────────────────────────────────────────
def make_slide_12_security():
    slide = prs.slides.add_slide(BLANK)
    slide_bg(slide, NAVY)
    add_rect(slide, 0, 0, 0.12, 7.5, RGBColor(0x9B, 0x59, 0xB6))
    add_rect(slide, 0.12, 0, 13.21, 1.1, NAVY_LIGHT)
    add_text_box(slide, "10  Security, Scalability & Future Roadmap", 0.4, 0.15, 12, 0.8,
                 font_size=28, bold=True, color=WHITE)
    add_divider_line(slide, 1.1, 0.5, 12.5, RGBColor(0x9B, 0x59, 0xB6), 2)

    purple = RGBColor(0x9B, 0x59, 0xB6)

    # Security left
    add_rect(slide, 0.3, 1.25, 4.0, 5.9, NAVY_LIGHT)
    add_rect(slide, 0.3, 1.25, 0.07, 5.9, purple)
    add_text_box(slide, "🔐  Security", 0.5, 1.35, 3.7, 0.45, font_size=14, bold=True, color=purple)
    sec_tf = slide.shapes.add_textbox(Inches(0.5), Inches(1.85), Inches(3.7), Inches(5.1))
    sec_tf.word_wrap = True
    tf = sec_tf.text_frame; tf.word_wrap = True
    p0 = tf.paragraphs[0]; p0.add_run().text = ""
    for s in [
        "bcrypt (salt=10) password hashing",
        "JWT Access (15min) + Refresh (7day) tokens",
        "httpOnly cookie storage (XSS protection)",
        "Mongoose schema-level input validation",
        "CORS origin whitelist (port 5173 only)",
        "MongoDB RBAC roles (read/write separation)",
        "Auth bypass list prevents token-refresh loops",
        "verifyJWTOptional for public endpoints",
    ]:
        add_bullet_item(tf, s, size=11, color=LIGHT_GRAY, bullet_char="🔒", accent=purple)

    # Scalability center
    add_rect(slide, 4.5, 1.25, 4.3, 5.9, NAVY_LIGHT)
    add_rect(slide, 4.5, 1.25, 0.07, 5.9, ACCENT2)
    add_text_box(slide, "📈  Scalability", 4.7, 1.35, 4.0, 0.45, font_size=14, bold=True, color=ACCENT2)
    sc_tf = slide.shapes.add_textbox(Inches(4.7), Inches(1.85), Inches(4.0), Inches(5.1))
    sc_tf.word_wrap = True
    tf2 = sc_tf.text_frame; tf2.word_wrap = True
    p00 = tf2.paragraphs[0]; p00.add_run().text = ""
    for s in [
        "MongoDB horizontal sharding ready",
        "Replica sets for high availability",
        "Mongoose pool (maxPoolSize: 100)",
        "60s in-memory LRU recommendation cache",
        "2.5s ML service timeout with Express fallback",
        "Cloudinary CDN for media delivery",
        "Vite code splitting & lazy-loaded routes",
        "Aggregate pagination (limit/skip streaming)",
    ]:
        add_bullet_item(tf2, s, size=11, color=LIGHT_GRAY, bullet_char="⚡", accent=ACCENT2)

    # Future roadmap right
    add_rect(slide, 9.0, 1.25, 4.0, 5.9, NAVY_LIGHT)
    add_rect(slide, 9.0, 1.25, 0.07, 5.9, GREEN_OK)
    add_text_box(slide, "🚀  Future Roadmap", 9.2, 1.35, 3.7, 0.45, font_size=14, bold=True, color=GREEN_OK)
    fr_tf = slide.shapes.add_textbox(Inches(9.2), Inches(1.85), Inches(3.7), Inches(5.1))
    fr_tf.word_wrap = True
    tf3 = fr_tf.text_frame; tf3.word_wrap = True
    p000 = tf3.paragraphs[0]; p000.add_run().text = ""
    for s in [
        "Graph-based GNN recommendation model",
        "Real-time WebSocket view count updates",
        "MongoDB Atlas Search (vector embeddings)",
        "A/B test framework for ML models",
        "Redis cache layer for hot trending data",
        "Kubernetes pod autoscaling",
        "Multilingual subtitle support",
        "Live streaming (WebRTC) integration",
    ]:
        add_bullet_item(tf3, s, size=11, color=LIGHT_GRAY, bullet_char="→", accent=GREEN_OK)

make_slide_12_security()
print("Slide 12: Security & Roadmap OK")

# ──────────────────────────────────────────────────────────────────────────────
# SLIDE 13: CONCLUSION
# ──────────────────────────────────────────────────────────────────────────────
def make_slide_13_conclusion():
    slide = prs.slides.add_slide(BLANK)
    slide_bg(slide, NAVY)
    add_rect(slide, 0, 0, 13.33, 0.08, ACCENT)
    add_rect(slide, 0, 7.42, 13.33, 0.08, ACCENT)
    add_rect(slide, 0, 0, 0.12, 7.5, ACCENT)

    # Central conclusion block
    add_rect(slide, 0.3, 0.2, 12.7, 1.0, NAVY_LIGHT)
    add_text_box(slide, "11  Conclusion & Key Achievements", 0.5, 0.3, 12.2, 0.8,
                 font_size=32, bold=True, color=WHITE)
    add_divider_line(slide, 1.25, 0.5, 12.3, ACCENT, 2)

    # Achievement cards
    achievements = [
        ("🗄️", "MongoDB\nExcellence",
         "7 collections, compound indexes, aggregation pipelines delivering sub-10ms queries for live analytics", GREEN_OK),
        ("🤖", "ML Recommendation\nFixed",
         "TF-IDF content-based engine now surfaces comedy→comedy with 20× higher similarity scores", ACCENT2),
        ("🔗", "Full-Stack\nIntegration",
         "React frontend ↔ Express backend ↔ Python ML microservice — fully wired end-to-end", ACCENT),
        ("🧪", "Test\nVerified",
         "57 automated tests passing — 17 backend + 40 ML service — 100% pass rate, 0 failures", GOLD),
    ]

    for i, (icon, title, desc, color) in enumerate(achievements):
        left = 0.3 + i * 3.2
        add_rect(slide, left, 1.4, 3.1, 0.7, color)
        add_text_box(slide, f"{icon}  {title}", left, 1.4, 3.1, 0.7,
                     font_size=13, bold=True, color=NAVY, align=PP_ALIGN.CENTER)
        add_rect(slide, left, 2.15, 3.1, 2.1, NAVY_LIGHT)
        add_text_box(slide, desc, left + 0.1, 2.2, 2.9, 2.0,
                     font_size=11, color=LIGHT_GRAY, word_wrap=True)

    # Big quote
    add_rect(slide, 0.3, 4.4, 12.7, 1.3, RGBColor(0x0D, 0x1B, 0x2A))
    add_rect(slide, 0.3, 4.4, 0.08, 1.3, GOLD)
    add_text_box(slide,
                 '"Yeonix demonstrates that MongoDB\'s flexible document model, combined with Python ML microservices, '
                 'enables video platforms to deliver intelligent, personalized content discovery at scale — '
                 'transforming a chronological video list into a semantically aware recommendation engine."',
                 0.55, 4.48, 12.2, 1.2, font_size=12, italic=True, color=WHITE, align=PP_ALIGN.CENTER)

    # Student info strip at bottom
    add_rect(slide, 0.3, 5.85, 12.7, 1.4, NAVY_LIGHT)
    add_text_box(slide, "Krishna Singh  |  Reg No: 12302957  |  Section: K3E2345  |  Roll No: 5",
                 0.5, 5.95, 12.2, 0.5, font_size=13, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text_box(slide, "Submitted to: Ansh Pratap Singh  |  Lovely Professional University, Phagwara Punjab",
                 0.5, 6.45, 12.2, 0.5, font_size=12, color=LIGHT_GRAY, align=PP_ALIGN.CENTER, italic=True)

    # Thank you
    add_text_box(slide, "Thank You  🙏", 3.5, 7.0, 6.3, 0.45,
                 font_size=20, bold=True, color=ACCENT, align=PP_ALIGN.CENTER)

make_slide_13_conclusion()
print("Slide 13: Conclusion OK")

# ─── SAVE ──────────────────────────────────────────────────────────────────────
prs.save(OUTPUT_PATH)
print("Presentation saved successfully!")
print("File: " + OUTPUT_PATH)
print("Total slides: " + str(len(prs.slides)))

