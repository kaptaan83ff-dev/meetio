# Design System: MeetIO

## 1. Visual Theme & Atmosphere

The MeetIO design system is a masterclass in **Neo-Brutalism**, blending high-contrast industrial aesthetics with a playful, "hacker-utility" vibe. It abandons traditional soft shadows and gradients in favor of **hard 2-3px borders**, **rigid 4px drop shadows**, and a palette that screams for attention using high-voltage primaries like `#ffe500` (Sun Yellow) and `#ff4f8b` (Electric Pink) against a warm, paper-like `#fff1e6` (Cream) canvas.

The atmosphere is one of "Raw Precision." It feels like a live system process — a shell session rendered visible, a kernel log made tactile. Key motifs include **dot-grid overlays** (reminiscent of architectural blueprints), **process viewport chrome** (three-dot signal indicators: ERR / WARN / OK), and **mono-weighted iconography**. The depth is entirely functional — elements don't "glow" or "float"; they are "lifted" or "pressed" onto the canvas with fixed mathematical offsets. It is serious enough to represent AI engineering, but bold enough to feel like a custom-compiled runtime no one else is running.

**Key Characteristics:**

- **Neo-Brutalist Architecture:** Heavy black borders and hard-edge shadows define every container.
- **High-Voltage Contrast:** Bold black-on-yellow and black-on-pink combinations for maximum impact.
- **Architectural Canvas:** A warm `#fff1e6` cream background that feels more premium than pure white.
- **Interactive "Lift":** Elements physically shift (translate) on hover/active states to simulate tactile feedback.
- **Process Viewport:** Every container is a named system process — `PROC/LOBBY:01`, `STREAM/AUDIO:02` — with stdout-style status readouts in the header bar.
- **Kernel Typography:** Archivo Black as the process name / command; Inter as the stdout body. Every label reads like a flag: `--join-as-guest`, `STATUS::WAITING`.

## 2. Color Palette & Roles

### Primary (The Energy)

- **Sun Yellow** (`#ffe500`): The primary brand color. Used for major section backgrounds, primary CTAs, and high-importance highlights. It is the "engine" of the visual system.
- **Ink Black** (`#0a0a0a`): Used for all borders, shadows, and primary text. It is never pure black, but a deep, high-contrast ink that anchors the system.

### Secondary & Accent

- **Electric Pink** (`#ff4f8b`): The secondary highlight. Used for ERR signal indicators and specific process headers. Counter-accent to yellow.
- **Neon Lime** (`#c6ff3d`): Used for OK/success signal indicators, active status dots, and "process running" states.
- **Royal Blue** (`#0052ff`): Reserved for specific utility process panels (e.g., `PROC/GPU-CLUSTER`) to break the warm palette and signal "technical" infrastructure.

### Surface & Background

- **Cream Canvas** (`#fff1e6`): The default page surface. Provides a warm, premium "paper" feel that reduces the harshness of high-contrast black borders.
- **Ghost White** (`#ffffff`): Used inside process panels and window frames to differentiate "stdout areas" from the "canvas."
- **Translucent Ink** (`rgba(10, 10, 10, 0.08)`): Used for the dot-grid overlay that covers hero and section backgrounds.

### Text Hierarchy

- **Headline Ink** (`#0a0a0a`): Default for all display and body text on light backgrounds.
- **Inverted Yellow** (`#ffe500`): Used for text on dark backgrounds (e.g., black buttons, process header bars).
- **Muted Metadata** (`rgba(10, 10, 10, 0.6)`): Used for secondary labels, PID counts, and micro-text.

## 3. Typography Rules

### Font Family

- **Archivo Black**: The signature display font. Used for the wordmark, massive hero headlines, process names, and button labels. It is heavy, condensed, and carries the "Brutalist" weight. Think: the command you type.
- **Inter**: The UI and body workhorse. Used for descriptive text, secondary labels, and stdout-style content. Provides legibility and a modern "tech" feel. Think: the output you read.
- **Monospace (System)**: Used for process IDs, status strings, error codes, and device paths — any string that represents machine state. Examples: `ERR::CAM_DENIED`, `PROC/LOBBY:01`, `STATUS::WAITING`. These are data, not labels.

### Hierarchy

| Role           | Font          | Size           | Weight | Line Height | Letter Spacing | Notes                                          |
| -------------- | ------------- | -------------- | ------ | ----------- | -------------- | ---------------------------------------------- |
| Mega Headline  | Archivo Black | 120px / 7.5rem | 900    | 0.90        | -2.3px         | Top-of-page hero headlines                     |
| Section Header | Archivo Black | 48px / 3rem    | 900    | 1.00        | -1.0px         | Main section titles (e.g., "AI TOOLS")         |
| Card Title     | Archivo Black | 24px / 1.5rem  | 900    | 1.10        | -0.5px         | Process panel and module headlines             |
| Nav Link       | Archivo Black | 12px / 0.75rem | 400    | 1.00        | 0.6px          | UPPERCASE, tracking-wider                      |
| Body Text      | Inter         | 20px / 1.25rem | 500    | 1.55        | 0px            | Primary stdout / reading content               |
| Small Label    | Archivo Black | 12px / 0.75rem | 400    | 1.20        | 0.8px          | UPPERCASE, used for `PID::01 / LOBBY`          |
| Tag / Badge    | Inter         | 11px / 0.69rem | 700    | 1.00        | 0.5px          | UPPERCASE, inside small pills                  |
| Status String  | Monospace     | 11px           | 400    | 1.20        | 0.5px          | Machine state only: `OK::JOINED`, `ERR::LOCKED`|

### Principles

- **Weight is Authority:** Use Archivo Black for almost all UI triggers (buttons, nav, process headers). Inter is reserved purely for "information." Monospace is reserved purely for "machine state."
- **Tight Leading on Headlines:** Huge headlines (120px) must use a line-height of `0.9` to create a dense, "blocky" visual impact.
- **UPPERCASE Everything for UI:** Nav links, button text, and process labels are almost exclusively uppercase with wide tracking (`0.6px` to `0.8px`).
- **No Italics:** The system relies on weight and color for emphasis, never slant.
- **System Monospace for Status Strings:** Any string that represents a machine state, process ID, error code, or device path must use system monospace — never Archivo Black or Inter. Examples: `ERR::CAM_DENIED`, `PROC/LOBBY:01`, `SYS/BLUR-MODEL:LOADING`. These are data, not labels.

## 4. Component Stylings

### Buttons

**Primary — The "Sun Yellow" Lift**

- **Background:** `#ffe500` (Sun Yellow)
- **Border:** `2px solid #0a0a0a`
- **Text:** `#0a0a0a` (Ink Black), Archivo Black 12px UPPERCASE
- **Shadow:** `4px 4px 0px 0px #0a0a0a` (Hard shadow)
- **Hover:** Translate `translate(-2px, -2px)`, shadow increases to `7px 7px 0px 0px #0a0a0a`.
- **Active:** Translate `translate(2px, 2px)`, shadow reduces to `1px 1px 0px 0px #0a0a0a`.

**Secondary — The "Inky" Inverse**

- **Background:** `#0a0a0a` (Ink Black)
- **Border:** `2px solid #ffe500`
- **Text:** `#ffe500` (Sun Yellow), Archivo Black 12px UPPERCASE
- **Shadow:** `4px 4px 0px 0px #ffe500`
- **Hover:** Matches primary behavior but with yellow accents.

**Nav Button (Tertiary)**

- **Background:** Transparent / Cream
- **Border:** `2px solid #0a0a0a`
- **Shadow:** `4px 4px 0px 0px #0a0a0a`
- **Hover:** Translates `-2px, -2px` with shadow expansion.

### Cards & Containers

**The "Process Window" (System Panels)**

Each card represents a named system process. The header bar is the process nameplate; the chrome dots are signal indicators (ERR / WARN / OK), not decorative UI elements.

- **Container:** `3px solid #0a0a0a` border.
- **Header Bar:** 32px height, solid background (matching section color or `#0a0a0a` for dark process headers). Label follows process/path syntax — e.g., `PROC/MEETING-INFO`, `SYS/CAM-STREAM`, `IO/DEVICE-CONFIG`, `AUTH/GUEST-ACCESS`.
- **Chrome:** Three signal dots on the left — Pink (`#ff4f8b` = ERR), Yellow (`#ffe500` = WARN), Lime (`#c6ff3d` = OK).
- **Body:** `#ffffff` background with internal dot-grid overlay.
- **Corners:** Sharp 0px or very tight 2px radius (Neo-Brutalism favors sharp corners).

**Section Block**

- **Padding:** 80px vertical, 56px horizontal.
- **Top Border:** `1px solid rgba(10, 10, 10, 1.0)` separating major horizontal divisions.
- **Visual Kicker:** Process ID labels in the format `PID::01 / LOBBY`, `PID::02 / DEVICES`, `PID::03 / AUTH` — pinned to the top-left of each section. Reads like a process table entry. Always uppercase, always Archivo Black at 0.4 opacity.

### Navigation

- **Main Nav:** Sticky header, 64px-80px height.
- **Background:** `#fff1e6` (Cream) with 90% opacity.
- **Bottom Border:** `2px solid #0a0a0a`.
- **Logo:** "MeetIO" in Archivo Black 16px, accompanied by a custom "Microchip" icon in a square border.
- **Layout:** Flex row with `gap-4` or `gap-6` between outlined buttons.

## 5. Layout Principles

### Spacing System

- **Base Unit:** 8px.
- **Scale:** 8, 16, 24, 32, 40, 48, 56, 64, 80, 120.
- **Section Padding:** Large 80px or 120px vertical gaps between major process blocks to allow the bold typography to "breathe."
- **Grid:** 12-column grid on desktop; collapses to 1-column on mobile.
- **Max Width:** Container capped at `1360px` for ultra-wide displays.

### Whitespace Philosophy

Whitespace is not "empty" in this system; it is often filled with a **dot-grid texture** — reminiscent of graph paper in an engineering notebook or the idle pattern of an unoccupied terminal buffer. This prevents the UI from feeling sparse and instead makes it feel like a populated process environment. Content is tightly packed within process panels, but the panels themselves are given generous margins on the canvas.

## 6. Depth & Elevation

| Level | Treatment                          | Use                                                     |
| ----- | ---------------------------------- | ------------------------------------------------------- |
| 0     | No border, dot-grid texture        | Background canvas (`#fff1e6`)                           |
| 1     | `1px solid #0a0a0a`                | Inline tags, small metadata separators                  |
| 2     | `2px solid #0a0a0a` + `4px shadow` | Default state for buttons and small process panels      |
| 3     | `3px solid #0a0a0a` + `4px shadow` | Main content "Process Windows"                          |
| 4     | `2px solid #0a0a0a` + `7px shadow` | Hover state (process "lifts" off the canvas)            |
| 5     | `2px solid #0a0a0a` + `1px shadow` | Active/Pressed state (process "written" into the page)  |

**The Shadow Rule:** Shadows must always be solid hex codes (`#0a0a0a` or `#ffe500`). Blur is strictly prohibited (`0px`).

## 7. Do's and Don'ts

### Do

- **Do** use hard-edged shadows with `0px` blur.
- **Do** translate elements by exactly `-2px` on hover to match the shadow increase.
- **Do** use Archivo Black for all headings and interactive triggers.
- **Do** wrap primary content in "Process Window" frames with the three-dot signal chrome.
- **Do** maintain the 2-3px border weight across all UI elements.
- **Do** use the dot-grid overlay (`opacity 0.08`) on all major background surfaces.
- **Do** use system monospace for all machine-state strings: `ERR::CAM_DENIED`, `STATUS::WAITING`, `OK::JOINED`.
- **Do** name all process panel headers using path syntax: `PROC/`, `SYS/`, `IO/`, `AUTH/`.

### Don't

- **Don't** use border-radius larger than 4px. Most elements should be perfectly square.
- **Don't** use gradients or soft drop-shadows.
- **Don't** use low-contrast colors. If it's not bold, it doesn't belong.
- **Don't** use Inter for headlines. It is a stdout utility font only.
- **Don't** omit the black borders on buttons — they are the skeleton of the design.
- **Don't** use plain English for status strings ("Camera denied", "Meeting locked"). Always use flag/code syntax: `ERR::CAM_DENIED`, `STATUS::MEETING_LOCKED`.
- **Don't** typeset status strings in Archivo Black or Inter — they must always render in system monospace.

## 8. Responsive Behavior

### Breakpoints

- **Desktop:** `1440px+`. Full 12-column grid, 120px hero text, 80px section padding.
- **Laptop:** `1024px - 1439px`. Container shrinks to `100% - 48px` padding. Nav links stay visible.
- **Tablet:** `768px - 1023px`. 2-column grid for process panels. Hero text scales to 80px. Nav collapses to hamburger menu.
- **Mobile:** `< 767px`. 1-column stack. Section padding drops to 24px. Hero text scales to 48px.

### Strategy

- **Typography Scaling:** Headings use fluid scaling (e.g., `clamp(3rem, 10vw, 7.5rem)`).
- **Component Integrity:** Hard shadows and borders do not scale down — they remain fixed (4px shadow, 2px border) even on small screens to maintain the "Brutalist" feel.
- **Touch Targets:** Buttons maintain a minimum height of 44px on mobile, but keep their heavy borders.

## 9. Agent Prompt Guide

### Quick Color Reference

- **Canvas:** `#fff1e6` (Cream)
- **Ink:** `#0a0a0a`
- **Primary:** `#ffe500` (Yellow)
- **Secondary:** `#ff4f8b` (Pink / ERR signal)
- **Accent:** `#c6ff3d` (Lime / OK signal)

### Terminal Vocabulary Reference

When writing copy, labels, or status text for any UI element, use this vocabulary map:

| Plain English         | Terminal Equivalent          |
| --------------------- | ---------------------------- |
| Section label         | `PID::01 / LOBBY`            |
| Card / panel title    | `PROC/MEETING-INFO`          |
| Camera panel          | `SYS/CAM-STREAM`             |
| Device config panel   | `IO/DEVICE-CONFIG`           |
| Auth / guest panel    | `AUTH/GUEST-ACCESS`          |
| Camera denied error   | `ERR::CAM_DENIED`            |
| Meeting locked        | `STATUS::MEETING_LOCKED`     |
| Waiting for host      | `STATUS::WAITING`            |
| Joined successfully   | `OK::JOINED`                 |
| Meeting full          | `WARN::MEETING_FULL`         |
| Blur model loading    | `SYS/BLUR-MODEL:LOADING`     |
| Noise cancel active   | `IO/NOISE-CANCEL:ACTIVE`     |

### Example Component Prompts

1. _"Create a Neo-Brutalist primary button: Background `#ffe500`, 2px solid `#0a0a0a` border, `4px 4px 0px 0px #0a0a0a` hard shadow. Text is 'EXECUTE — JOIN SESSION' in 12px Archivo Black UPPERCASE. On hover, translate by -2px -2px and increase shadow to 7px."_
2. _"Design a Process Window panel: 3px solid `#0a0a0a` border, sharp corners. A 32px header bar with background `#0a0a0a`, label `PROC/MEETING-INFO` in 9px Archivo Black uppercase `#ffe500`, letter-spacing 1.2px. Three signal dots on the left: Pink (ERR), Yellow (WARN), Lime (OK). Inside, a `#ffffff` background with a radial-gradient dot grid pattern (1.5px dots, 20px apart, 0.08 opacity)."_
3. _"Build a hero headline: 'WE BUILD ENTERTAINMENT' in 120px Archivo Black, line-height 0.9, letter-spacing -2.3px, color `#0a0a0a`. Place on a `#fff1e6` background with a dot-grid texture."_
4. _"Create a section kicker label in process ID syntax: `PID::01 / LOBBY` in 9px Archivo Black, uppercase, color `#0a0a0a` at 0.4 opacity, letter-spacing 0.8px. It should read like a process table entry, not a breadcrumb."_
5. _"Build a process window header bar: background `#0a0a0a`, label reads `SYS/CAM-STREAM:01` in 9px Archivo Black uppercase yellow, letter-spacing 1.2px. Three signal indicator dots on left in pink/yellow/lime — these are ERR/WARN/OK states, not decorative elements."_
6. _"Render all inline status text as shell-style flags and exit codes using system monospace font: `STATUS::WAITING`, `ERR::CAM_DENIED`, `OK::JOINED`, `WARN::MEETING_FULL`. Never use plain English labels inside UI triggers or status readouts."_
7. _"Design an error state for the camera process panel (`SYS/CAM-STREAM`): the 16:9 video area goes `#0a0a0a`, a pink-bordered icon appears center, and status text reads `ERR::CAM_DENIED` in system monospace. Below it, a subdued Inter body line: 'Enable camera in browser settings and reload.' The panel header dot shifts to solid pink (ERR signal active)."_
