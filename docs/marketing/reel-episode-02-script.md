# Power Agents — Episode 02: "The Second Wave"

30 s · 1080×1920 · 30 fps · TikTok / Reels / Shorts. Same world, characters and pixel style as Episode 01. It is structured like a Saturday-morning ranger-team episode: villain taunt, alert, morph, team fight, monster grows, giant-robot finisher. New story beat: the monster comes back.

## Positioning

- **Formula:** Power Agents helps people who already use Codex, Claude and Gemini get one reviewed result by running them as a team on their own computer.
- **Episode angle:** "done" isn't done until someone checks it. Episode 01 was *assemble and win*; Episode 02 is *false victory → review catches it → version two wins*.
- **Tone:** tokusatsu announcer. Short shouted lines, called-out names, no tech jargon in voiceover. On-screen text carries the product facts.

## Script

| Time | Scene | Visual / action | VO (announcer) | On-screen text | Music / SFX |
|---|---|---|---|---|---|
| 0:00–0:01.5 | **Villain taunt** | Orbit lair above the city. The pixel boss cackles, points down and hurls a glowing "BIG TASK" orb, which lands as a monster. | Villain voice: "Deadline Beast — crush them!" | — | Evil synth sting, thunder |
| 0:01.5–0:02.5 | **Alert + title card** | A phone on a desk buzzes; a pixel chat bubble pops: "Plan v1 ready for approval". Hard cut to the title card. | "Alert! Plan ready." | EPISODE 02: THE SECOND WAVE | Two communicator chirps → snare fill |
| 0:02.5–0:04 | **Command center** | Laptop with the Power Agents UI. Cursor hits APPROVE; a pixel "APPROVED" stamp slams; screen shake. | "Commander approves." | YOU APPROVE THE PLAN | Riff kicks in on the stamp downbeat |
| 0:04–0:06.5 | **Morph sequence** | All three Rangers raise their wrists together, then three 0.6 s vertical cut-ins. Each has a provider-colour flash, helmet visor closing and weapon reveal, then a group pose with coloured smoke explosions behind them. | All three: "Power up, Agents!" | CODEX! · CLAUDE! · GEMINI! (one per cut) | Gang-shout each name on the beat; pose explosion on the downbeat |
| 0:06.5–0:10 | **Parallel strike** | Screen splits into three panels. Each Ranger fights a different minion at the same moment; hit sparks land on kicks. | "Three tasks. All at once." | INDEPENDENT TASKS RUN IN PARALLEL | Full riff, crash on each hit |
| 0:10–0:13 | **The question** | Claude's staff bounces off a shielded minion. Freeze-frame; pixel speech bubble: "Codex — which source?" Codex throws a glowing data orb, Claude catches it, the shield shatters. | "Stuck? Ask a teammate." | AGENTS ASK EACH OTHER | One bar half-time, then slam back on the shatter |
| 0:13–0:16 | **Leader combo** | Claude (this mission's leader) raises the staff; three energy streams converge. Boss HP 100 → 0, big explosion, Rangers pose in the smoke. | "The leader brings it together…" | LEADER COMBINES THE WORK | Build, cymbal swell, explosion hit |
| 0:16–0:18 | **False victory** | Smoke hangs. Gemini's visor scans; red HUD: "REVIEW: 2 ISSUES". The villain zaps the wreckage from orbit and the monster regrows, skyscraper-sized. | "Not so fast. Review found two issues." | VERSION 1 SENT BACK | Hard stop; low synth drone; heartbeat kick |
| 0:18–0:21 | **Regroup** | Fast montage: document pages flip v1 → v2, two red marks turn green, Rangers reload weapons. | "Back in. Version two." | REVIEW NOTES → NEW VERSION | Riff returns a whole step higher |
| 0:21–0:25 | **Giant-robot finisher** | Three pixel vehicles (one per Ranger, provider colours) roar in and lock together into the **Agent Megabot**, one locking clunk per piece. Cockpit cut-in: the three Rangers side by side. The Megabot draws a giant saber; six frames of slow motion, then a slash, whiteout and chained explosions across the skyline. | "Combine! Full power!" | — | Charge riser → biggest hit of the track |
| 0:25–0:27 | **Review pass** | Gemini scan turns green: "REVIEW PASSED". The villain in orbit slams a fist: "Curses!" The phone buzzes again: "Task complete". | "Review passed. Mission complete." | — | Victory brass stab |
| 0:27–0:30 | **End card** | Rooftop hero formation at dawn, logo slams in. | "Approved by you. Checked by the team. Power Agents." | POWER AGENTS · Your AI team, on your computer · Episode 03 soon — follow | Chant "Power Agents — assemble!" + final chord |

The announcer has about 45 words; character lines (villain, morph call) add about 8. That leaves room for gang shouts and music hits. Episode 01 used 73.

**Genre cues kept original:** the villain, the "Power up, Agents!" call and the "Agent Megabot" are new. Do not use "It's morphin' time", "Megazord", Zords, the Rangers' helmet designs, the lightning-bolt logo or footage from the show. These belong to the franchise and would invite a takedown.

## Music direction (theme-song energy, original composition)

- **Genre:** 90s Saturday-morning tokusatsu / arcade rock. Distorted palm-muted guitar riff in a minor key, driving eighth-note bass, punchy four-on-the-floor kick with snare on 2 and 4, synth-brass stabs.
- **Tempo:** 165 BPM, slightly faster than Episode 01's 160 for more urgency.
- **Feel to aim for:** the same *ingredients* as classic 90s superhero-team theme songs: crunchy power chords, a call-and-response chant, a key change and a heroic brass line. Write a new riff, melody and words.
- **Prompt for a music generator or composer:** "Original 165 BPM 90s tokusatsu action-rock theme, distorted palm-muted guitar riff in E minor, driving bass, four-on-the-floor drums, synth brass stabs, shouted gang vocals 'Power Agents — assemble!', whole-step key change at 18 seconds, big ending chord at 30 seconds, instrumental except chants."
- **Hook:** a shouted gang-vocal chant, "Power Agents — assemble!", at the end card, answered by a guitar squeal. Name callouts during the morph. A brief guitar-solo lick under the Megabot combine.
- **Structure:**
  - 0–2 s drum fill
  - 2–10 s main riff
  - 10–13 s half-time break
  - 13–16 s build
  - 16–18 s hard stop and drone
  - 18–25 s riff a whole step up (classic tokusatsu key change)
  - 25–27 s victory stab
  - 27–30 s chant and final chord
- **Hard limit:** it must be an original cue. No melody, chord-progression hook, lyric or "Go, go" chant from the Power Rangers theme, and don't name that song in prompts to a music generator. Using a soundalike exposes the reel to copyright claims and takedowns. "Same energy, different song" is the brief.

## Claim audit

Every product claim on screen maps to implemented behaviour in `docs/prototype.md`:

- **Plan ready / task complete alerts:** Telegram alerts for plan awaiting approval and completed run. Messages carry only the event type, run ID and plan version. Approval happens in the local app, never on the phone.
- **You approve the plan:** nothing runs until the plan is approved.
- **Parallel tasks:** independent tasks run in parallel (up to three turns at once).
- **Agents ask each other:** a question to a colleague is delivered in a separate turn, and the answer returns the waiting task to work.
- **Leader combines, another member reviews, notes produce a new version:** matches the guide.
- **On your computer:** the server runs locally on 127.0.0.1.

The fight is a metaphor. Like Episode 01, the reel should not imply the app *is* this battle game. Provider roles are this mission's example, not fixed roles. Show the chat alert as a generic pixel bubble, not a real messenger's logo.
