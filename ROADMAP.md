ROADMAP 2.0 — AgentForge-Command: Polish, Perfection & Production Excellence
═══════════════════════════════════════════════════════════════════════════════

Vision:
Von "Production-Ready" zu "Delightfully Polished."
Jedes Pixel, jede Animation, jede Interaktion, jedes Mascottchen optimiert.
Zero bugs. Premium UX. Wow-Factor.

Struktur: 50 Runs über 6 Tiers.
Jeder Tier = Thema (UI/UX, Mascots, Performance, Bugs, Workflow, Polish).
Jeder Run = 1–3 Tage Claude Code + local verification.

═══════════════════════════════════════════════════════════════════════════════
TIER 1: VISUAL POLISH & DESIGN SYSTEM (8 Runs)
═══════════════════════════════════════════════════════════════════════════════

RUN 1.1: Design System Foundation
─────────────────────────────────────
Goal: Centralized color palette, typography, spacing, shadows.
Deliverables:
  - docs/DESIGN_SYSTEM.md (11-point grid, Fibonacci spacing)
  - gui/public/arena/design-tokens.css (CSS custom properties)
    --color-atlas: #2d3748
    --color-sentinel: #e53e3e
    --color-aurora: #5a67d8
    --color-vanguard: #38a169
    --color-accent-success: #48bb78
    --color-accent-warn: #ed8936
    --color-accent-error: #f56565
    --spacing-xs: 4px
    --spacing-sm: 8px
    --spacing-md: 16px
    --spacing-lg: 24px
    --spacing-xl: 32px
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.12)
    --shadow-md: 0 4px 12px rgba(0,0,0,0.15)
    --shadow-lg: 0 12px 32px rgba(0,0,0,0.2)
  - Figma preview (if you have access; optional)
Tests:
  - Verify all --color-* variables used consistently
  - No hardcoded colors left in .css or .js
Commit: design(tokens): establish centralized design system


RUN 1.2: Arena Card Refinement
──────────────────────────────────
Goal: Perfect specialist cards — hover states, focus rings, animations.
Current issues (audit):
  - Hover state unclear (what should happen?)
  - Focus ring missing on keyboard nav
  - Card transitions janky on slow connections
  - Worktree badge overlaps text (spacing bug)
  - Action buttons (pin/delete) not discoverable
Deliverables:
  - Refined card styles (hover → slight lift + shadow increase)
  - Focus ring: 2px solid --color-accent-success, border-radius 4px
  - Smooth transitions (150ms cubic-bezier(0.4, 0, 0.2, 1))
  - Badge repositioned (top-right corner, no overlap)
  - Action buttons: visible on hover, labeled with title attr
  - Accessibility: aria-label on all interactive elements
Tests:
  - Keyboard nav (Tab) highlights all cards
  - Hover state consistent across 4 agents (Atlas/Sentinel/Aurora/Vanguard)
  - Focus ring visible in high-contrast mode
Commit: ui(cards): refine hover/focus/animation + badge spacing


RUN 1.3: Broadcast Bar UX
──────────────────────────
Goal: Input field = clear, responsive, error states.
Current issues:
  - Placeholder text unclear ("Enter a goal...")
  - No visual feedback on focus
  - Send button (Enter key) feedback missing
  - Error state (invalid goal) not shown
  - Accessibility: no label (screen readers confused)
Deliverables:
  - Add <label> (screen-reader-only) + aria-labelledby
  - Focus state: border color → --color-accent-success, shadow
  - Placeholder refined: "What should the swarm do?"
  - Send button: visual feedback (pulse on press, brief success flash)
  - Error state: red border + error text below
  - Mobile: full-width on small screens, responsive padding
Tests:
  - Focus ring visible on keyboard input
  - Enter key sends + visual feedback
  - Max-length enforced (255 chars), counter shown
  - Error state triggered on empty/whitespace
Commit: ui(broadcast): improve input clarity + feedback + a11y


RUN 1.4: Drawer & Specialist Details
──────────────────────────────────────
Goal: Sidebar panel = premium, readable, interactive.
Current issues:
  - Text alignment jagged (mixed font sizes)
  - Log output (monospace) doesn't wrap nicely
  - Git status too raw (needs syntax highlighting)
  - Buttons at bottom cramped
  - Close button (X) easy to miss
  - Dark mode: text too light in places
Deliverables:
  - Consistent typography (h2 for agent name, body for stats)
  - Log output: <pre> with syntax highlighting (highlight.js for code blocks)
  - Git status: green for added, red for deleted, yellow for modified
  - Button group (stop/kill/refresh): 3-column grid, hover states
  - Close button: large, visible, Esc key support (already there, just highlight)
  - Dark mode audit: all text meets WCAG AA (4.5:1 contrast)
  - Max-width on text (55 chars per line, optimal reading)
Tests:
  - Drawer opens/closes smoothly (150ms animation)
  - Long agent names don't break layout
  - Syntax highlighting works for multi-language logs (js/json/bash)
  - Git status colors visible in both light + dark modes
  - Button hover states consistent
Commit: ui(drawer): polish typography + syntax + contrast + layout


RUN 1.5: Mascot Character Polish
──────────────────────────────────
Goal: Each mascot = unique, recognizable, delightful.
Current mascots (audit):
  - Atlas (main commander) → rework: more authoritative, subtle glow
  - Sentinel (security) → rework: shield motif, sharp/vigilant look
  - Aurora (learning) → rework: light/glow motif, curious expression
  - Vanguard (execution) → rework: forward-leaning, dynamic pose
Deliverables:
  - SVG refinements for each (30–50 iterations per mascot)
    - Smoother curves (fewer nodes, Bézier optimization)
    - Proportions balanced (golden ratio where applicable)
    - Unique color palettes (match their agent roles)
    - Micro-expressions (eyes, mouth) convey personality
  - Hover animations (slight rotation/bob, 2–3 sec cycle)
  - Loading state: pulsing glow or subtle spin
  - Idle animation: breathing (subtle scale 0.98–1.02)
  - Active state: more vibrant (saturation +10 %)
  - gui/public/arena/mascots.svg + mascots.js refactor
Tests:
  - SVG renders crisp at 64px, 128px, 256px (no pixelation)
  - Hover animation smooth (60fps, no jank)
  - All 4 mascots have unique color + personality
  - Accessibility: decorative svg marked as aria-hidden
Commit: ui(mascots): refine proportions/animations/personality


RUN 1.6: Dark Mode + Contrast Audit
────────────────────────────────────
Goal: All UI elements readable in dark mode, WCAG AA compliance.
Current audit:
  - Some text @ 3:1 contrast (fails AA for normal text)
  - Card backgrounds too dark (hard to distinguish active card)
  - Mascot colors muted in dark (less personality)
Tests run locally:
  - axe-core + manual check
Deliverables:
  - Adjust --color-* variables for dark mode (via prefers-color-scheme)
  - Text colors: ensure 4.5:1 minimum (normal text), 3:1 (large text)
  - Card states: active card has visible border (--color-accent-success)
  - Mascot colors: slightly boost saturation in dark mode
  - Dark mode toggle (if not already implemented): localStorage + media query
  - Focus rings: adjusted for visibility in both modes
Tests:
  - axe-core dark mode audit ✅
  - Manual check: every text element readable in both modes
  - Contrast checker: all text passes AA (or AAA if low vision)
Commit: a11y(dark-mode): ensure WCAG AA contrast + refinement


RUN 1.7: Responsive Design (Mobile-First Polish)
──────────────────────────────────────────────────
Goal: Perfect on 375px (mobile) → 1920px (desktop).
Current audit:
  - Arena cards stack awkwardly on tablet
  - Broadcast bar button overlaps text on mobile
  - Drawer sidebar takes full height (no scroll)
  - Mascot sizes inconsistent across breakpoints
Deliverables:
  - Breakpoint tiers:
    - Mobile (375–599px): 1-column cards, full-width input, drawer overlay
    - Tablet (600–1023px): 2-column cards, side-by-side layout starts
    - Desktop (1024px+): current layout, optimized
  - Card sizes: responsive --card-width (calc(100% - 16px) on mobile)
  - Mascot sizes: scale based on viewport (clamp(48px, 10vw, 256px))
  - Touch targets: min 44px (mobile), 32px (desktop)
  - Drawer: modal overlay on mobile, slide panel on desktop
Tests:
  - Screenshot tests at 375px / 768px / 1920px
  - Touch target sizes verified (44px on mobile)
  - No horizontal scroll on mobile
  - Performance: layout shift scores (CLS < 0.1)
Commit: ui(responsive): mobile-first polish + breakpoint optimization


RUN 1.8: Loading States & Transitions
──────────────────────────────────────
Goal: Every async action has clear, delightful feedback.
Current issues:
  - Server startup: no loading indicator
  - Agent spawn: card appears instantly (jarring)
  - Goal dispatch: no feedback until agents respond
  - Errors: appear silently, dismissed silently
Deliverables:
  - Loading skeleton screens (Sentinel/Aurora/Vanguard cards)
  - Spinner animations: smooth, on-brand (mascot colors)
  - Progress indicators: % complete for goal dispatch
  - Success toast: brief confirmation (1.5s auto-dismiss)
  - Error toast: persistent until dismissed, red highlight
  - Transition animations: stagger (50ms between cards)
  - Disabled states: greyed out, :disabled pseudo-class
Tests:
  - Skeleton screens visible for ≥1s
  - Spinners 60fps (no jank)
  - Toasts appear/dismiss with 200ms transition
  - Error toasts remain visible, don't auto-dismiss
Commit: ui(feedback): add loading skeletons + toasts + transitions

═══════════════════════════════════════════════════════════════════════════════
TIER 2: MASCOT CHARACTER DEEP-DIVE (7 Runs)
═══════════════════════════════════════════════════════════════════════════════

RUN 2.1: Atlas Prime (Commander) Character Study
──────────────────────────────────────────────────
Goal: Atlas = visually commanding, trusted, decisive.
Deliverables:
  - Character audit: proportions, personality, color palette
  - Pose refinement: standing (not sitting), forward-facing
  - Eyes: sharp, intelligent (maybe slight glow?)
  - Color: primary blue (--color-atlas #2d3748) + accent gold/brass
  - Animations:
    - Idle: subtle breathing (0.98–1.02 scale, 3s cycle)
    - Hover: slight nod (rotation ±2°, 2s cycle)
    - Active: pulse glow (opacity 0.8–1.0, 1.5s)
  - SVG optimization: reduce nodes by 30–40% (use shape combines)
  - Size consistency: 256px canvas, scalable to 64px without loss
Tests:
  - SVG renders crisp at all sizes
  - Animations smooth (60fps)
  - Personality immediately recognizable
  - Colors match design tokens
Commit: design(mascot-atlas): refine proportions + animations + personality


RUN 2.2: Sentinel (Security) Character Study
──────────────────────────────────────────────
Goal: Sentinel = vigilant, protective, sharp.
Deliverables:
  - Character: shield-carrying guardian, alert posture
  - Eyes: scanning (maybe moving left-to-right in idle?)
  - Color: red (--color-sentinel #e53e3e) + dark gray
  - Shield: prominent (SVG element with border highlight)
  - Animations:
    - Idle: scanning gaze (eyes move, 2s cycle)
    - Hover: shield raises (slight upward movement, 1.5s)
    - Active: alert pulse (color brightens, 1s)
  - SVG optimization: grouped shield + body for easier interaction
Tests:
  - Shield clearly visible + distinct
  - Eye movement smooth + non-distracting
  - Alert state clearly communicates "guarding"
Commit: design(mascot-sentinel): add shield + scanning animation + personality


RUN 2.3: Aurora (Learning) Character Study
─────────────────────────────────────────────
Goal: Aurora = inquisitive, luminous, growth-oriented.
Deliverables:
  - Character: floating/ascending pose, open/welcoming
  - Eyes: wide, curious (maybe sparkle effect?)
  - Color: blue/purple (--color-aurora #5a67d8) + white highlights
  - Light motif: aura/glow around character
  - Animations:
    - Idle: subtle float (vertical bob, 4s cycle)
    - Hover: sparkle (brief twinkle at eyes, 2s)
    - Active: glow intensifies (shadow grows, 1.5s)
  - SVG: glow effect as separate <defs> <filter> (reusable)
Tests:
  - Float animation smooth, not nauseating
  - Sparkles subtle, not annoying
  - Aura effect visible but not overwhelming
Commit: design(mascot-aurora): add float + sparkle + glow + personality


RUN 2.4: Vanguard (Execution) Character Study
────────────────────────────────────────────────
Goal: Vanguard = dynamic, forward-moving, action-oriented.
Deliverables:
  - Character: forward-leaning, action pose (maybe mid-stride?)
  - Eyes: determined, focused
  - Color: green (--color-vanguard #38a169) + accent orange
  - Forward arrow/motion: integrated into design
  - Animations:
    - Idle: subtle forward lean (rotation ±1°, 2s)
    - Hover: stepping motion (horizontal translate, 1.5s)
    - Active: sprint (faster movement, more vibrant color)
  - SVG: optimize for motion (smooth paths, minimal complexity)
Tests:
  - Motion suggests "action" without looking rushed
  - Color conveys "go/execute"
  - Personality distinct from others
Commit: design(mascot-vanguard): add motion + stride + personality


RUN 2.5: Mascot Interaction States (All 4)
──────────────────────────────────────────────
Goal: Unified mascot behavior across states.
States to implement:
  - Idle: breathing, subtle micro-movements
  - Hover (on card): engage (look at user, lean in)
  - Active (running): faster animation, more vibrant
  - Error: distressed look (eyes change, maybe shake)
  - Success: celebration (jump, sparkles, or victory pose)
  - Loading: spinning or progress indicator integrated
Deliverables:
  - gui/public/arena/mascot-states.css (state-based classes)
  - gui/public/arena/ui.js: toggle states based on agent status
  - Timing: consistent across all mascots (don't let them clash)
Tests:
  - Each mascot responds to all 6 states
  - Animations don't conflict or pile up
  - State transitions smooth (150–200ms)
Commit: ui(mascots): implement unified state system (idle/hover/active/error/success)


RUN 2.6: Mascot Voice/Personality (Flavor Text)
──────────────────────────────────────────────────
Goal: Each mascot has character (hints in tooltips/labels).
Deliverables:
  - Flavor text (one-liners for each state):
    - Atlas: "Standing by. What's the mission?"
    - Sentinel: "All quiet. Watching."
    - Aurora: "Ready to learn something new."
    - Vanguard: "Let's move fast."
  - Hover tooltips: agent role + short description
  - Error messages: mascot-flavored (e.g., "Sentinel reports: Access denied.")
  - Success messages: celebratory (e.g., "Aurora discovered: [result]")
  - gui/public/arena/mascot-voices.js (config object)
Tests:
  - Tooltips appear on hover (100ms delay)
  - Messages match mascot personality
  - No typos or inconsistencies
Commit: design(mascots): add flavor text + personality voices


RUN 2.7: Mascot Accessibility (All 4)
──────────────────────────────────────
Goal: Mascots convey status to all users.
Current issues:
  - Status conveyed only via animation (fails for reduced-motion)
  - Screen readers: mascots are aria-hidden (correct for decoration)
  - Color-only cues (red=error, green=success) fail for colorblind
Deliverables:
  - Reduced-motion: disable animations, use static +visual cues
  - Icons: add subtle status badges (✓ = success, ! = error)
  - ARIA: agent status conveyed via aria-live region ("Sentinel is running")
  - Color + icons: don't rely on color alone
  - Text fallback: accessible name for agent card ("Sentinel - Security Agent - Running")
Tests:
  - prefers-reduced-motion: animations disabled ✅
  - Screen reader: announces agent status
  - Color-blind mode: status readable without color
  - Keyboard: all agent cards have focus states
Commit: a11y(mascots): add status indicators + icons + aria-live regions

═══════════════════════════════════════════════════════════════════════════════
TIER 3: PERFORMANCE & SMOOTHNESS (6 Runs)
═══════════════════════════════════════════════════════════════════════════════

RUN 3.1: Animation Performance Audit
──────────────────────────────────────
Goal: All animations 60fps, no jank, GPU-accelerated.
Tools:
  - DevTools Performance tab
  - Lighthouse
  - Web Vitals (CLS, LCP, FID)
Current audit:
  - Card transitions: check FPS (target ≥55fps on low-end devices)
  - Mascot animations: check for layout thrashing
  - Drawer slide: check for GPU acceleration
Deliverables:
  - Use transform/opacity (GPU-accelerated) not top/left/width
  - Avoid reflows: batch DOM updates
  - Debounce resize handlers (ResizeObserver)
  - Profile on low-end device (Pixel 3a or similar)
  - Fix any jank (measure, optimize, re-measure)
Tests:
  - DevTools: frame rate ≥55fps during mascot animations
  - Lighthouse: Performance score ≥85
  - CLS < 0.1 (no layout shift)
Commit: perf(animations): gpu-accelerate + eliminate layout thrashing


RUN 3.2: Bundle Size & Code Splitting
───────────────────────────────────────
Goal: Fast load, fast interact.
Current audit:
  - gui/public/arena/ui.js: how many KB?
  - Total bundle (js + css): measure
Deliverables:
  - Analyze with `npm run build -- --visualize` (if available)
  - Split large components (e.g., drawer, broadcast bar) into lazy modules
  - Remove unused dependencies (audit with npm ls)
  - Minify CSS (postcss-csso or similar)
  - Tree-shake dead code (webpack/vite automatically, but verify)
  - Gzip target: ui.js ≤100 KB (gzipped)
Tests:
  - Bundle size: measure + document in BENCHMARKS.md
  - Load time: <2s on 3G (simulated)
  - Interaction-to-paint: <100ms (button click → visible feedback)
Commit: perf(bundle): code-split + minify + measure


RUN 3.3: Network Resilience
─────────────────────────────
Goal: Handle slow/flaky networks gracefully.
Current issues:
  - Long-running operations: UI freezes if WebSocket times out
  - Large outputs: buffer can overflow
  - Reconnect: manual (user hits reload) or automatic?
Deliverables:
  - Reconnect logic: auto-retry with exponential backoff (1s, 2s, 4s, 8s, stop)
  - Timeout handlers: show spinner, allow manual retry
  - Output buffering: cap at 1 MB per agent (oldest entries dropped)
  - Network status indicator: show connection state (online/offline/reconnecting)
  - Graceful degradation: if server down, show cached data + offline mode
Tests:
  - Simulate network slowdown (DevTools throttling)
  - Verify reconnect works (kill server, restart, auto-reconnect)
  - Offline mode: UI still usable (read-only)
Commit: network(resilience): auto-reconnect + offline mode + buffering caps


RUN 3.4: Scroll Performance
──────────────────────────────
Goal: Arena doesn't stutter when scrolling.
Current audit:
  - Arena cards: how many? (100+ cards = performance issue)
  - Scroll performance: FPS during scroll?
Deliverables:
  - Virtual scrolling (only render visible cards): react-window or custom
  - Or: Intersection Observer (lazy-render cards as they enter viewport)
  - Optimize card rendering (memoize components, avoid re-renders)
  - Measure scroll frame rate (target ≥55fps)
Tests:
  - Add 100+ cards via harness
  - Scroll smoothly (60fps)
  - Card interactions work (hover, click) even with 100+ cards
Commit: perf(scroll): add virtual scrolling + intersection observer


RUN 3.5: Memory Leaks Audit
─────────────────────────────
Goal: Long-running cockpit doesn't leak memory.
Tools:
  - DevTools Memory tab (heap snapshots)
  - Chrome DevTools Detached DOM Audit
Current audit:
  - Are old event listeners being removed?
  - Are WebSocket frames properly freed?
  - Are DOM nodes properly removed when drawer closes?
Deliverables:
  - Verify: removeEventListener called (or use once: true)
  - Verify: cleanup on drawer close (remove all listeners)
  - Verify: PTY buffers freed when agent stops
  - Profile: run cockpit for 10 min, take heap snapshot every minute
  - Fix any memory growth (linear → stable)
Tests:
  - Heap snapshots: memory stable (not growing 1 MB/min)
  - Detached DOM: <10 nodes at any time
  - No console warnings about memory
Commit: fix(memory): eliminate leaks + add cleanup handlers


RUN 3.6: Lighthouse Full Audit + Fix
──────────────────────────────────────
Goal: Lighthouse score ≥90 (Performance, Accessibility, Best Practices).
Deliverables:
  - Run Lighthouse (npm audit via DevTools)
  - Fix top issues:
    - Unused CSS
    - Missing alt text (images)
    - Slow main-thread work
    - Accessibility violations
  - Document in BENCHMARKS.md
Tests:
  - Lighthouse score ≥90 on all categories
  - No red warnings
Commit: audit(lighthouse): achieve ≥90 score on all categories

═══════════════════════════════════════════════════════════════════════════════
TIER 4: UX/WORKFLOW BUGS & EDGE CASES (15 Runs)
═══════════════════════════════════════════════════════════════════════════════

RUN 4.1: Broadcast Bar Edge Cases
────────────────────────────────────
Issues:
  - Input allows > 255 chars (should truncate or error)
  - Enter key on IME (Japanese input): double-submit?
  - Copy-paste with newlines: should strip or error?
  - Very long goal text: wraps weirdly
Deliverables:
  - Enforce maxlength="255" on input
  - Show char counter (200/255)
  - Handle IME: debounce Enter key (100ms)
  - Strip newlines from pasted text
  - Test on real IME (or simulate)
Tests:
  - Paste 300-char text: truncates to 255
  - IME input (Japanese): no double-submit
  - Newlines stripped on paste
  - Counter updates smoothly
Commit: fix(broadcast): handle edge cases (IME, paste, length)


RUN 4.2: Card Click/Hover Timing Issues
──────────────────────────────────────────
Issues:
  - Rapid clicks: drawer opens/closes multiple times
  - Hover + mobile touch: hover state persists
  - Clicking while drawer open: should close or stay?
Deliverables:
  - Debounce clicks (300ms): only one open at a time
  - On mobile: click toggles (no hover state)
  - Clicking card while drawer open: close drawer first (or swap)
  - Track drawer state (open/closing) to prevent race conditions
Tests:
  - Rapid clicks: drawer opens once (not 3x)
  - Mobile: hover state only on desktop
  - Click card while drawer open: smooth transition to new card
Commit: fix(cards): debounce clicks + mobile hover handling


RUN 4.3: Drawer Scroll Behavior
──────────────────────────────────
Issues:
  - Long output: scroll position resets when agent updates
  - Scroll to bottom on new message (expected UX)
  - But: if user scrolls up (to read history), don't auto-scroll
Deliverables:
  - Detect user scroll: if scrolled to bottom, auto-scroll on new message
  - If scrolled up: don't jump, show visual indicator ("New message" button)
  - Button: click to jump to latest
Tests:
  - New message arrives: scrolls to bottom (if already there)
  - Scroll up: auto-scroll disabled, button appears
  - Click button: jumps to bottom
Commit: fix(drawer): smart scroll behavior (pinned vs. history)


RUN 4.4: Mascot SVG Rendering Bugs
──────────────────────────────────────
Issues:
  - SVG renders blurry on some zoom levels
  - Animations sometimes pause (GPU throttling?)
  - Colors flicker on state change
Deliverables:
  - Use vector-effect="non-scaling-stroke" if needed
  - Check for will-change: transform on animated elements
  - Batch color changes (use CSS var, not inline style updates)
  - Test on real devices (not just desktop)
Tests:
  - SVG sharp at all zoom levels (DevTools simulate)
  - Animations smooth even with GPU throttling (DevTools simulated)
  - Colors stable (no flicker on state change)
Commit: fix(mascots): eliminate blur + flicker + stutter


RUN 4.5: Keyboard Navigation Edge Cases
──────────────────────────────────────────
Issues:
  - Tab order confusing (input → first card → last card → button)
  - Shift+Tab: goes backward but drawer doesn't close
  - Enter on broadcast: works, but focus stays in input
Deliverables:
  - Define logical tab order (input → cards → broadcast area)
  - After broadcast: focus returns to input (ready for next goal)
  - Escape: closes drawer, returns focus to card
  - Tab from last card: wraps to input (or out of cockpit)
Tests:
  - Tab navigation logical (left-to-right, top-to-bottom)
  - Shift+Tab works backward
  - Focus visible at all times
  - Escape closes drawer
Commit: a11y(keyboard): fix tab order + escape handling


RUN 4.6: Notification/Toast Stacking
───────────────────────────────────────
Issues:
  - Multiple errors: toasts pile up off-screen
  - Long message: toasts wrap strangely
  - Auto-dismiss: works, but user might not notice dismissal
Deliverables:
  - Max 3 toasts visible at once (queue older ones)
  - Toast max-width: 90vw (mobile-friendly)
  - Success: 2s auto-dismiss
  - Error: persistent until user dismisses
  - Grouping: duplicate messages collapse into one (with count)
Tests:
  - Trigger 5 errors: only 3 visible, 4th in queue
  - Click dismiss: next toast appears
  - Long message: wraps cleanly
Commit: fix(toasts): implement stacking + grouping + auto-dismiss


RUN 4.7: Drawer Close Button & Gesture Support
────────────────────────────────────────────────
Issues:
  - X button small on mobile (hard to tap)
  - Swipe-to-close (mobile): not implemented
  - Clicking outside drawer: should close?
Deliverables:
  - X button: 44px touch target
  - Swipe from left to right: close drawer (on mobile)
  - Backdrop click: close drawer (modal behavior)
  - Animate close (slide out, 200ms)
Tests:
  - X button: 44px × 44px
  - Swipe gesture: works on mobile (simulated in DevTools)
  - Backdrop click: closes drawer
Commit: fix(drawer): improve close UX (tap target + swipe + backdrop)


RUN 4.8: Status Synchronization Bugs
───────────────────────────────────────
Issues:
  - Agent card shows "running" but process already exited
  - Workspace view doesn't match server state
  - Timestamp mismatch between client + server
Deliverables:
  - Regular sync: fetch /api/health every 5s
  - Update card states based on server response
  - Show last-sync time (subtle, bottom-right)
  - Detect stale data (if sync older than 10s, show warning)
Tests:
  - Kill PTY server-side: card updates within 5s
  - Long operation: sync keeps card state accurate
  - Server restart: client detects + updates
Commit: fix(sync): implement health check + stale data detection


RUN 4.9: Agent Spawn Race Conditions
──────────────────────────────────────
Issues:
  - Spam "spawn agent" button: multiple PTYs created
  - Drag-and-drop card while spawning: weird state
  - Stop agent while spawning: cleanup issues
Deliverables:
  - Disable spawn button during spawn (2s timeout)
  - Lock card state: no moves while spawning
  - Stop during spawn: clean up half-started PTY
  - Debounce spawn requests (300ms)
Tests:
  - Spam spawn button: only one PTY created
  - Stop during spawn: clean state (no orphaned PTYs)
  - Card state consistent with server
Commit: fix(spawn): debounce + state locking + cleanup


RUN 4.10: Output Encoding Issues
──────────────────────────────────
Issues:
  - Non-UTF8 output: garbled text in drawer
  - ANSI escape codes: not always stripped
  - Emoji in output: sometimes broken (surrogate pairs)
Deliverables:
  - Decode as UTF-8 with replacement char (U+FFFD)
  - Strip/parse ANSI codes (colors, bold, etc.)
  - Handle emoji correctly (use TextEncoder for proper handling)
  - Test with real-world PTY output (bash, node, python)
Tests:
  - Non-UTF8 bytes: displayed as U+FFFD (not garbled)
  - ANSI codes: visible as readable output (not visible escape codes)
  - Emoji: displays correctly
Commit: fix(encoding): handle non-utf8 + ansi + emoji


RUN 4.11: Persistent Data Corruption Recovery
──────────────────────────────────────────────────
Issues:
  - arena.json malformed: cockpit refuses to start
  - sessions.json: partial write leaves it corrupted
  - .team/ directory: orphaned worktrees after crash
Deliverables:
  - On startup: validate arena.json (schema), back up if invalid
  - On invalid session: auto-remove (with warning)
  - Orphaned worktrees: detect on startup (branch exists, no card), offer delete
  - Graceful fallback: empty arena.json (fresh state) if all else fails
Tests:
  - Corrupt arena.json: server starts with backup
  - Partial session.json write: cleaned automatically
  - Orphaned worktree: detected, user prompted to delete
Commit: fix(recovery): improve data corruption handling


RUN 4.12: Focus Management in Modal Dialogs
──────────────────────────────────────────────
Issues:
  - Spawn modal opens: focus doesn't move to first input
  - Tab in modal: goes behind modal to main content
  - Close modal: focus doesn't return to trigger button
Deliverables:
  - On modal open: focus to first focusable element (input)
  - Trap focus inside modal (Tab loops within modal)
  - On modal close: return focus to trigger button
  - Escape key: always closes modal
  - aria-modal="true" + role="dialog"
Tests:
  - Open modal: focus in input (verify with DevTools)
  - Tab: loops within modal
  - Escape: closes + focus returns to button
Commit: a11y(modals): implement focus management + trap


RUN 4.13: Color & Icon Consistency Audit
──────────────────────────────────────────
Issues:
  - Some buttons use --color-accent-success, others use hardcoded #48bb78
  - Icons: mix of SVG, emoji, CSS pseudo-elements
  - Spacing around icons: inconsistent (5px? 8px? 12px?)
Deliverables:
  - Audit all colors: use design tokens only (no hardcoded hex)
  - Audit all icons: pick one approach (SVG sprite + <use>, or icon font)
  - Icon spacing: consistent 8px (--spacing-sm)
  - Document in DESIGN_SYSTEM.md
Tests:
  - No hardcoded colors in .css or .js
  - All icons same type/size/spacing
Commit: design(consistency): unify colors + icons + spacing


RUN 4.14: Responsive Input Fields & Buttons
─────────────────────────────────────────────
Issues:
  - Input field: font size < 16px on mobile (triggers zoom-on-focus)
  - Button: too small on mobile (< 44px)
  - Touch target spacing: buttons too close on mobile
Deliverables:
  - Broadcast input: 16px font on mobile (no zoom)
  - All buttons: 44px minimum on mobile
  - Spacing between buttons: min 8px
  - Reduce on desktop (buttons can be 32px, closer together)
Tests:
  - Input on mobile: no unwanted zoom
  - Button tap: easy to hit on mobile
  - Layout: buttons don't overlap
Commit: fix(mobile): proper touch targets + no unwanted zoom


RUN 4.15: Accessibility Color-Blind Mode Test
────────────────────────────────────────────────
Issues:
  - Status shown by color only (red=error, green=success)
  - Sentinel=red, Aurora=blue: hard to distinguish for some users
  - No icon/pattern backup
Deliverables:
  - Add icons (✓, !, ?, —) to status (color + icon)
  - Add patterns (if needed): striping or dotted
  - Test with Coblis (color-blind simulator)
  - Document in KNOWN_LIMITS if truly unfixable
Tests:
  - Simulate Deuteranopia: status still readable
  - Simulate Protanopia: status still readable
Commit: a11y(colorblind): add icons + patterns for status


═══════════════════════════════════════════════════════════════════════════════
TIER 5: ADVANCED FEATURES & POLISH (10 Runs)
═══════════════════════════════════════════════════════════════════════════════

RUN 5.1: Agent Quick-Actions Menu
────────────────────────────────────
Goal: Right-click context menu for agents.
Current workflow: Open drawer → click stop/kill. Too many clicks.
Deliverables:
  - Right-click card: context menu appears
    - Pin / Unpin
    - Stop
    - Restart
    - Delete
    - Duplicate (clone config)
    - Copy logs (to clipboard)
    - Share (generate shareable JSON)
  - Keyboard: Alt+Click, or keyboard shortcut (Alt+A for menu)
  - Menu positions smartly (not off-screen)
Tests:
  - Right-click: menu appears
  - Click option: action executes + menu closes
  - Keyboard: Alt+A opens menu
Commit: feat(ux): add context menu for quick actions


RUN 5.2: Arena Search & Filter
────────────────────────────────
Goal: Find agents quickly in large swarms.
Deliverables:
  - Search bar (top of arena): filter by agent name, role, status
  - Filter chips: "Running", "Stopped", "Error"
  - Highlight matching cards
  - Clear button to reset
Tests:
  - Type "sentinel": shows only Sentinel cards
  - Click "Running": shows only running agents
  - Search + filter combo works
Commit: feat(ux): add search + filter for arena


RUN 5.3: Arena Drag-and-Drop Reordering
─────────────────────────────────────────
Goal: Custom card order (instead of fixed rows).
Current: Cards in spawn order. User wants custom layout.
Deliverables:
  - Drag card: reorder in grid
  - Persist order: save to localStorage + arena.json
  - Visual feedback: ghost image while dragging, drop zone highlight
  - Touch support: long-press to start drag
Tests:
  - Drag card: position changes
  - Refresh: order persists
  - Touch: long-press starts drag
Commit: feat(ux): add drag-and-drop reordering


RUN 5.4: Export/Import Arena Snapshots
────────────────────────────────────────
Goal: Save + restore swarm configurations.
Deliverables:
  - Export button: download arena.json + all sessions.json
  - Import button: upload .zip file, restore state
  - Confirmation: "This will overwrite current arena. Continue?"
  - Timestamp: filename = agentforge-snapshot-2026-05-30T14:30.zip
Tests:
  - Export: file downloads
  - Import: state restored (agents, logs, worktrees)
Commit: feat(ux): add export/import snapshots


RUN 5.5: Agent Log Export & Analytics
────────────────────────────────────────
Goal: Analyze agent performance over time.
Deliverables:
  - Export agent logs: CSV + JSON formats
  - Metrics: execution time, output length, success/error count
  - Chart: timeline of agent runs (Recharts)
  - Filter by date range
Tests:
  - Export: CSV opens in Excel cleanly
  - Metrics: match reality (count = actual runs)
Commit: feat(ux): add log export + basic analytics


RUN 5.6: Collaborator Mode (Multi-User Preview)
─────────────────────────────────────────────────
Goal: Multiple browsers watch same cockpit (read-only or controlled).
Current: Single-user only.
Deliverables:
  - Generate share link: localhost:4173?token=xyz
  - Token auth: read-only by default, optional write
  - Broadcast updates: all browsers see state changes in real-time
  - Cursor + presence: (optional) show who's controlling
Tests:
  - Open 2 browsers with same token
  - Update in one: other updates within 500ms
Commit: feat(collab): add multi-browser mode (preview)


RUN 5.7: Agent Templates & Presets
────────────────────────────────────
Goal: Save + reuse agent configurations.
Deliverables:
  - "Save as Template" button on agent card
  - Template manager: list saved templates
  - "New from Template": spawn agent with saved config
  - Presets: community-shared templates (optional)
Tests:
  - Save template: appears in list
  - Spawn from template: config matches
Commit: feat(ux): add templates + presets


RUN 5.8: Undo/Redo Stack
──────────────────────────
Goal: Undo accidental agent deletions, config changes.
Current: No undo (dangerous).
Deliverables:
  - Undo/Redo buttons (top toolbar)
  - Keyboard: Ctrl+Z (undo), Ctrl+Y (redo)
  - Stack: last 50 actions
  - Actions: spawn, delete, config change, rename
Tests:
  - Delete agent: undo restores it
  - Rename: undo reverts
  - Stack: max 50 actions
Commit: feat(ux): add undo/redo


RUN 5.9: Themes & Customization
─────────────────────────────────
Goal: Let users customize colors, fonts, layout.
Deliverables:
  - Theme picker: built-in themes (dark, light, high-contrast, cyber)
  - Font size: slider (12px–20px)
  - Compact layout: toggle (cards smaller, more fit per row)
  - Accent color: pick primary color (blue, purple, green, red)
  - Persist: localStorage
Tests:
  - Change theme: UI updates
  - Font size: readable (no overflow)
  - Compact layout: more cards visible
Commit: feat(ux): add themes + customization


RUN 5.10: Notifications & Do-Not-Disturb
──────────────────────────────────────────
Goal: Alert when agent finishes, but respect focus time.
Deliverables:
  - Browser notifications: "Sentinel completed task"
  - DND mode: toggle (notifications muted, visual indicators only)
  - Notification preferences: per-agent (always, on error, never)
  - Sound: optional alert sound (muted by default)
Tests:
  - Agent finishes: notification appears
  - DND enabled: no notifications
  - Settings: persist
Commit: feat(ux): add notifications + dnd


═══════════════════════════════════════════════════════════════════════════════
TIER 6: FINAL POLISH & DOCUMENTATION (4 Runs)
═══════════════════════════════════════════════════════════════════════════════

RUN 6.1: Comprehensive Bug-Bash & QA
──────────────────────────────────────
Goal: Final sweep for any remaining issues.
Process:
  - Run cockpit for 2 hours: spawn agents, dispatch goals, watch for crashes
  - DevTools: check console for errors
  - E2E tests: re-run all (ensure no regressions)
  - Cross-platform: test on Mac, Windows, Linux (if possible)
  - Mobile: test on real phone (or simulate thoroughly)
Deliverables:
  - Bug list: all issues found logged
  - Fixes: prioritize + fix top 20
  - Re-test: verify fixes don't break other things
Tests:
  - Cockpit stable for 2+ hours
  - No console errors (except expected warnings)
  - All E2E tests green
Commit: fix(bugs): final sweep + stability


RUN 6.2: Performance Benchmarking & Documentation
────────────────────────────────────────────────────
Goal: Measure + document performance improvements from Tier 3.
Deliverables:
  - Benchmark (before/after):
    - Load time: [X] ms → [Y] ms
    - Animation FPS: [A] fps → [B] fps
    - Memory: [M] MB → [N] MB
    - Bundle size: [S] KB → [T] KB
  - BENCHMARKS.md: updated with new numbers
  - Lighthouse scores: before/after
  - Real device testing: measure on Pixel 3a (old device)
Tests:
  - Improvements documented
  - Numbers verified by measuring again
Commit: bench(polish): document tier-3 improvements


RUN 6.3: User Experience Testing
──────────────────────────────────
Goal: Get feedback from fresh users (simulate).
Process:
  - Pretend you're a new user (first time using AgentForge)
  - Common tasks: spawn agent, send goal, read logs, close drawer
  - Timing: how long each task?
  - Pain points: what's confusing?
  - Delight moments: what feels good?
Deliverables:
  - UX audit checklist
  - Quick fixes for common pain points
  - Highlight delightful moments (document for marketing)
Tests:
  - Spawn agent: < 5 seconds, obvious how to do it
  - Send goal: input is clear, button is obvious
  - Read logs: text readable, easy to scroll
Commit: ux(user-testing): address pain points


RUN 6.4: Final Documentation & Changelog
──────────────────────────────────────────
Goal: Document all Roadmap 2.0 changes.
Deliverables:
  - CHANGELOG.md: v2.0.0 entry
    - UI Polish (Tier 1)
    - Mascot Deep-Dive (Tier 2)
    - Performance (Tier 3)
    - Bug Fixes (Tier 4)
    - Advanced Features (Tier 5)
    - Quality Assurance (Tier 6)
  - DESIGN_SYSTEM.md: finalized (from Run 1.1)
  - BENCHMARKS.md: finalized (from Run 6.2)
  - Known issues: any Tier-6 issues deferred → next roadmap
  - Git tag: v2.0.0
Tests:
  - Changelog complete
  - Tag created
Commit: chore(release): v2.0.0 changelog + documentation

═══════════════════════════════════════════════════════════════════════════════
ROADMAP 2.0 SUMMARY
═══════════════════════════════════════════════════════════════════════════════

50 Runs across 6 Tiers:
  - Tier 1 (8 runs): Visual polish, design system, responsive, animations
  - Tier 2 (7 runs): Deep mascot character work, state system, personality
  - Tier 3 (6 runs): Performance, bundle, memory, Lighthouse
  - Tier 4 (15 runs): Bug bash, edge cases, accessibility fixes
  - Tier 5 (10 runs): Advanced UX (context menu, search, drag-drop, export, collab)
  - Tier 6 (4 runs): Final QA, benchmarking, UX testing, documentation

Timeline estimate:
  - Tier 1: 8–10 days (visual work is iterative)
  - Tier 2: 5–7 days (mascots are detailed but parallel-able)
  - Tier 3: 4–6 days (performance audits, fixes, profiling)
  - Tier 4: 10–15 days (bug fixes are high-touch, lots of testing)
  - Tier 5: 7–10 days (features are complex, need design + testing)
  - Tier 6: 3–4 days (final sweep + documentation)

Total: ~40–50 days (6–7 weeks) if full-time. Can be parallelized (e.g., Tier 1+2 simultaneously).

Git strategy:
  - One branch per Tier (feature/tier-1-polish, feature/tier-2-mascots, etc.)
  - Per-Run commits (Conventional: feat(ui), fix(bugs), perf(scroll), etc.)
  - PR at end of Tier
  - Main must stay green (no partial merges)

Success criteria:
  - No console errors or warnings (except expected)
  - Lighthouse ≥95 (Performance, Accessibility)
  - Animation: 60fps minimum
  - E2E all green (with new Tier-5 features tested)
  - User feedback: "Wow, this is polished."
  - No known bugs (Tier 4 swept clean)

═══════════════════════════════════════════════════════════════════════════════

