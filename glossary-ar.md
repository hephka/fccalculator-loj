# Arabic glossary — game vocabulary

Working file for the Arabic translation. It exists because the app can't invent
its own words for things the game already names: a player reading "الموارد"
in-game and something else here would trust neither.

**Status: not started.** Nothing below is confirmed yet.

## Why this file exists

Roughly 74 of the app's ~206 strings are game vocabulary — 20 resource names
and 54 other terms (buildings, troops, research lines, tiers). Those have to
come from the game itself. The remaining ~130 are interface prose (buttons,
hints, notes) that can be written directly, without a source.

Nobody on this project reads Arabic. That's the whole constraint, and it's why
the method below is what it is: every entry has to be confirmed by two
independent signals, never by one.

## Method

For each batch of 3-5 terms, the same game screen is captured **twice**:

1. Game language set to **French** (or English) — screenshot.
2. Game language set to **Arabic**, same screen, same state, nothing scrolled —
   screenshot.

The pair gives two signals: **position** (the term sits in the same place in
both) and **meaning** (the Arabic word plausibly denotes that thing). An entry
is only written down when both agree.

A single Arabic screenshot is not enough. With one image the only way to say
which string means "Warden's Office" is to guess from context, and a confident
guess is exactly what this project can't ship.

When the two signals disagree, or a term isn't visible in the Arabic build, it
goes to **Unresolved** below rather than into the table. Missing is recoverable;
wrong is not, because nobody here can spot it afterwards.

## Confirmed

| Key | EN | FR | AR | Confirmed by |
| --- | --- | --- | --- | --- |
| _(empty)_ | | | | |

## Unresolved

Terms the pair of screenshots couldn't settle, with what's missing.

| Key | EN | FR | What's blocking it |
| --- | --- | --- | --- |
| _(empty)_ | | | |

## Batches

Ordered by how often a term appears in the app, so the most visible words are
settled first. Grouped by game screen, so one pair of screenshots covers
several terms at once.

### Batch 1 — base screen (not sent yet)

| Key | EN | FR |
| --- | --- | --- |
| `res_FC` | FC | FC |
| `res_AFC` | AFC | AFC |
| `res_Hyperalloy` | Hyperalloy | Hyperalliage |
| `building_warden_office` | Warden's Office | Bureau du Directeur |
| `building_fc_lab` | FC Lab | Laboratoire FC |

The three resources sit in the top bar of nearly every game screen, so they
usually come along with whatever else is captured.

### Later batches

- The 5 other support buildings (barracks, communication, command, medical)
- The 3 troop types
- The 9 T11 research lines
- Tomes & Collections: 6 resources, 18 terms
- Robots & Satellites: 5 resources, 7 terms
- Hero Equipment: 4 resources, 13 terms
- Hero Stars: 2 resources, 12 terms
