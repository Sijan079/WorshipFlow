# Laws of UX Audit Knowledge Base

Use this reference as a set of audit lenses, not as a scorecard. Apply only
the laws that explain a real operator problem. Name the observed behavior
first, then the relevant law; do not manufacture findings to mention more
laws.

Source: [Laws of UX](https://lawsofux.com/) by Jon Yablonski. The summaries
below are adapted for Worship Flow OS rather than copied from the site.

## Decision Load

- **Choice Overload** — Too many plausible options can stall a decision.
  Audit whether secondary actions, filters, or block types compete with the
  operator's likely next action.
- **Hick's Law** — Decisions take longer as choices grow in number and
  complexity. Prefer one primary action, progressive disclosure, and short
  contextual menus.
- **Cognitive Load** — Every unfamiliar label, state, and dependency consumes
  mental effort. Remove information that is not needed for the current step
  and keep required context visible.
- **Working Memory** — People can hold and manipulate only a small amount of
  information at once. Do not make operators remember values, prior screens,
  hidden validation rules, or service positions.
- **Miller's Law** — Group long information sets into meaningful chunks; do
  not treat seven as a hard item limit. Chunk by service phase, responsibility,
  or production purpose without changing stored order.
- **Chunking** — Meaningful groups make dense information easier to scan.
  Use headings, spacing, and alignment before adding more cards.
- **Tesler's Law** — Essential complexity must live somewhere. Let the system
  handle copying templates, preserving order, formatting, and safe defaults;
  keep irreducible domain choices visible to the operator.
- **Occam's Razor** — When alternatives work equally well, use the one with
  fewer assumptions. Prefer the most direct control and data flow that still
  communicates consequences.

## Familiarity and Expectations

- **Jakob's Law** — Familiar interaction patterns reduce relearning. Keep
  buttons, dialogs, tables, drag handles, and keyboard behavior conventional
  unless worship-production needs justify a difference.
- **Mental Model** — Labels and structure should match how teams understand a
  service: service, template, ordered block, participant, song, media, and
  output. Avoid generic admin terminology.
- **Paradox of the Active User** — People begin working instead of reading
  instructions. Make safe next steps discoverable in context; reserve help
  text for likely errors rather than explaining the whole screen.
- **Postel's Law** — Accept harmless input variation but return consistent,
  explicit output. Normalize whitespace and common formatting safely; never
  silently reinterpret service order or destructive intent.
- **Cognitive Bias** — Designers and operators can overvalue defaults,
  recent examples, or visually prominent states. Check important decisions
  against domain data and realistic workflows, not aesthetic confidence.

## Grouping and Visual Structure

- **Law of Proximity** — Nearby elements are read as related. Keep labels,
  values, validation, and row actions close to what they affect.
- **Law of Common Region** — A boundary implies a group. Add a panel only
  when it communicates a real section, task, or context; avoid decorative
  card nesting.
- **Law of Similarity** — Similar appearance implies similar behavior or
  status. Keep equivalent controls consistent and make different actions
  visibly distinct.
- **Law of Uniform Connectedness** — Connected elements appear more related
  than merely adjacent ones. Visually anchor expanded content, inline edits,
  reorder destinations, and inspector details to their source row.
- **Law of Prägnanz** — People first seek the simplest stable interpretation.
  Make hierarchy and state unambiguous; remove decoration that creates a
  competing reading.
- **Aesthetic-Usability Effect** — Polished interfaces feel easier to use,
  which can hide real defects. Keep the production-grade visual finish, but
  verify task completion, errors, and keyboard use independently.

## Attention and Action

- **Selective Attention** — Operators notice what serves their immediate
  goal and may miss everything else. Put blocking issues and the next required
  action in the workflow, not in peripheral chrome.
- **Von Restorff Effect** — One distinct item among similar items attracts
  attention. Reserve strong accent and alert treatments for the active block,
  live state, or exceptional risk; widespread emphasis cancels the effect.
- **Fitts's Law** — Large, nearby targets are faster to acquire. Keep frequent
  and urgent controls easy to hit, and avoid tiny icon-only actions or distant
  save buttons.
- **Serial Position Effect** — The first and last items in a sequence receive
  more attention. Place the highest-value context and actions at natural scan
  boundaries without changing the service's stored order.
- **Goal-Gradient Effect** — Visible progress can increase momentum near
  completion. Show truthful readiness or remaining-work cues when a workflow
  has a meaningful finish; do not invent gamified progress.
- **Zeigarnik Effect** — Unfinished work remains mentally salient. Preserve
  and expose dirty, incomplete, failed, or pending states so operators can
  resume without reconstructing context.

## Time, Feedback, and Flow

- **Doherty Threshold** — Fast feedback sustains productivity. Acknowledge
  actions immediately with pending state, optimistic UI only when safe, and
  clear completion or failure feedback.
- **Flow** — Unnecessary interruption breaks focused work. Keep routine
  editing inline or contextual; use dialogs for focused decisions and avoid
  surprise navigation.
- **Parkinson's Law** — Work tends to fill the time allowed. Prefer efficient
  defaults and bounded steps for preparation tasks, but never use artificial
  urgency.
- **Peak-End Rule** — People disproportionately remember intense moments and
  endings. Make destructive errors recoverable and make save, publish, export,
  and handoff outcomes explicit and trustworthy.
- **Pareto Principle** — A small set of workflows usually carries most use.
  Prioritize service creation, ordered flow editing, assignment, song/media
  work, and output handoff before polishing rare paths; confirm with evidence
  when usage data exists.

## Applying the Reference

For each project audit finding:

1. Observe a concrete usability problem in the screen or flow.
2. Identify the operator task and consequence.
3. Use one law, occasionally two, to explain the mechanism.
4. Recommend the smallest fix consistent with `DESIGN.md`, `tokens.css`,
   accessibility, and strict stored service order.

Do not use a law to justify:

- changing or hiding stored worship-service order
- replacing domain terms with generic SaaS language
- adding decorative progress, urgency, badges, or animation
- removing validation, error recovery, accessibility, or necessary complexity
- claiming user behavior without evidence when a quick usability check is
  needed
