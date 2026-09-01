#!/usr/bin/env node
/**
 * Builds the save blob the store screenshots are captured against.
 *
 * A fresh install shows an empty collection, which is an honest picture of the
 * first thirty seconds and a useless picture of the game. The Play screenshots
 * were captured mid-trip; the App Store set has to match, and it has to be the
 * *same* trip so the two listings do not disagree about what the app looks like.
 *
 * Determinism matters more than realism here. The seed is a fixed list, not a
 * random sample: a screenshot set that reshuffles on every CI run cannot be
 * compared against the previous one, and "the map looks different" stops being
 * a signal. Nothing here is random and nothing reads the clock except the trip
 * history's completedAt, which is pinned below.
 *
 * The shape must match PersistedGameSnapshot as written by
 * StateService.saveSnapshot — specifically the *slim* form, where states carry
 * only ID and fnd because the seed data is re-merged from states.json on load.
 * If that shape changes, this file changes with it; `--verify` is the guard.
 *
 *   node scripts/make-screenshot-seed.mjs            # print the JSON
 *   node scripts/make-screenshot-seed.mjs --out f    # write it to a file
 *   node scripts/make-screenshot-seed.mjs --verify   # check it against states.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const statesPath = join(here, '..', 'src', 'data', 'states.json');
const allStates = JSON.parse(readFileSync(statesPath, 'utf8'));

/**
 * A road trip up the spine of the country and out to the coast — chosen so the
 * atlas reads as a plausible route rather than a scatter of disconnected fills,
 * and so the found states are spread across enough regions that the map does not
 * look like one dark corner. 28 of 51 is deliberately mid-trip: a nearly-full
 * board removes the reason to keep playing, and a nearly-empty one shows nothing.
 */
const FOUND = [
  'CA', 'NV', 'AZ', 'UT', 'CO', 'NM', 'TX', 'OK', 'KS', 'NE',
  'IA', 'MO', 'AR', 'LA', 'MS', 'AL', 'TN', 'KY', 'IL', 'IN',
  'OH', 'MI', 'WI', 'MN', 'PA', 'NY', 'MA', 'FL',
];

/**
 * Per-state progress. Distances are the distance-bonus miles the app awards, so
 * they have to look like real sightings: far-from-home plates score more, and a
 * handful of local ones score little. These are hand-set rather than generated
 * so the numbers on the Log screen stay stable between runs.
 */
const DISTANCE_BY_ABBRV = {
  CA: 12, NV: 210, AZ: 380, UT: 520, CO: 830, NM: 640, TX: 1180, OK: 1290,
  KS: 1340, NE: 1410, IA: 1580, MO: 1620, AR: 1490, LA: 1720, MS: 1810,
  AL: 1930, TN: 1880, KY: 1960, IL: 1740, IN: 1850, OH: 2040, MI: 2110,
  WI: 1830, MN: 1690, PA: 2380, NY: 2560, MA: 2740, FL: 2470,
};

/** Which of the found states also had trivia answered, and how many correct. */
const TRIVIA_BY_ABBRV = {
  CA: 3, NV: 2, AZ: 3, UT: 1, CO: 3, TX: 2, MO: 3, LA: 2,
  AL: 3, TN: 2, OH: 3, MI: 1, NY: 3, MA: 2, FL: 3,
};

function buildSnapshot() {
  const found = new Set(FOUND);

  const states = allStates.map((state) => {
    if (!found.has(state.Abbrv)) {
      return { ID: state.ID, fnd: { distance: 0, stateFound: false, questionsCorrect: 0 } };
    }
    return {
      ID: state.ID,
      fnd: {
        distance: DISTANCE_BY_ABBRV[state.Abbrv] ?? 0,
        stateFound: true,
        questionsCorrect: TRIVIA_BY_ABBRV[state.Abbrv] ?? 0,
        mode: TRIVIA_BY_ABBRV[state.Abbrv] ? 'trivia' : 'classic',
        difficulty: TRIVIA_BY_ABBRV[state.Abbrv] >= 3 ? 'hard' : 'medium',
      },
    };
  });

  // Points are SCORED, not summed. Distance points come off a tier curve and
  // question points off a per-difficulty value — totalling the raw miles instead
  // would put ~43,000 on the header where the real game shows ~90, which is the
  // sort of number that makes a store screenshot look faked.
  //
  // These three functions mirror RewardService.getStateDiscoveryReward,
  // RewardService.getDistanceReward and QuizService.POINTS_MAP. They are
  // duplicated rather than imported because those are TypeScript in the Angular
  // injector and this is a plain node script — `--verify` re-checks the totals,
  // but if the curves in RewardService move, they have to be moved here too.
  const stateReward = (d) => (d > 2000 ? 3 : d > 1000 ? 2 : 1);
  const distanceReward = (d) =>
    d <= 0 ? 0 : d <= 500 ? 1 : d <= 1000 ? 2 : d <= 2000 ? 3 : d <= 3000 ? 5 : 8;
  const questionValue = { easy: 1, medium: 2, hard: 3 };

  let statePoints = 0;
  let questionPoints = 0;
  let distancePoints = 0;
  for (const state of states) {
    if (!state.fnd.stateFound) continue;
    statePoints += stateReward(state.fnd.distance);
    distancePoints += distanceReward(state.fnd.distance);
    questionPoints += state.fnd.questionsCorrect * (questionValue[state.fnd.difficulty] ?? 0);
  }

  return {
    states,
    points: { state: statePoints, question: questionPoints, distance: distancePoints },
    hasSeenOnboarding: true,
    gameMode: 'trivia',
    difficulty: 'medium',
    // One finished trip in the history so the Summary screen has something to
    // show. Pinned date: a screenshot set that changes because the clock moved
    // is not reproducible.
    tripHistory: [
      {
        id: 'trip-screenshot-001',
        completedAt: '2026-07-04T17:30:00.000Z',
        foundCount: 34,
        totalStates: 51,
        // In the same scoring universe as the live totals above — a finished trip
        // slightly ahead of the current one, not a number from another game.
        finalScore: 296,
        miles: 3120,
        triviaCorrect: 22,
      },
    ],
    challengeStreak: { current: 4, best: 9, lastCompletedDay: '2026-07-04' },
  };
}

function verify(snapshot) {
  const problems = [];
  const byAbbrv = new Map(allStates.map((s) => [s.Abbrv, s]));

  for (const abbrv of FOUND) {
    if (!byAbbrv.has(abbrv)) problems.push(`FOUND lists ${abbrv}, which is not in states.json`);
    if (!(abbrv in DISTANCE_BY_ABBRV)) problems.push(`${abbrv} is found but has no distance`);
  }
  for (const abbrv of Object.keys(TRIVIA_BY_ABBRV)) {
    if (!FOUND.includes(abbrv)) problems.push(`${abbrv} has trivia but was never found`);
  }
  if (snapshot.states.length !== allStates.length) {
    problems.push(`seed has ${snapshot.states.length} states, states.json has ${allStates.length}`);
  }
  const foundCount = snapshot.states.filter((s) => s.fnd.stateFound).length;
  if (foundCount !== FOUND.length) {
    problems.push(`marked ${foundCount} found, expected ${FOUND.length}`);
  }
  // Distance points are tiered (max 8 per state), not miles. Summing raw miles
  // here once put 43,212 on the header against a real ceiling of 224 — a total
  // far outside the scoring rules is the clearest signal the seed has drifted
  // away from RewardService.
  const maxDistancePoints = foundCount * 8;
  if (snapshot.points.distance > maxDistancePoints) {
    problems.push(
      `distance points ${snapshot.points.distance} exceed the tier ceiling ${maxDistancePoints} ` +
      `(${foundCount} states x 8) — points are scored, not summed miles`,
    );
  }
  const maxQuestionPoints = foundCount * 3 * 3; // 3 questions x 3 points at hard
  if (snapshot.points.question > maxQuestionPoints) {
    problems.push(`question points ${snapshot.points.question} exceed the ceiling ${maxQuestionPoints}`);
  }
  // The slim shape is the contract with StateService.saveSnapshot. A seed
  // carrying extra keys would still load, but it would stop being a faithful
  // sample of what the app writes, which is the whole point of seeding.
  for (const state of snapshot.states) {
    const keys = Object.keys(state).sort().join(',');
    if (keys !== 'ID,fnd') {
      problems.push(`state ${state.ID} has keys [${keys}], expected [ID,fnd]`);
      break;
    }
  }
  return problems;
}

const snapshot = buildSnapshot();
const args = process.argv.slice(2);

if (args.includes('--verify')) {
  const problems = verify(snapshot);
  if (problems.length) {
    console.error('screenshot seed is invalid:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  const foundCount = snapshot.states.filter((s) => s.fnd.stateFound).length;
  console.log(`screenshot seed OK — ${foundCount}/${snapshot.states.length} states found, ` +
    `${snapshot.points.state + snapshot.points.question + snapshot.points.distance} points`);
  process.exit(0);
}

const json = JSON.stringify(snapshot);
const outIndex = args.indexOf('--out');
if (outIndex !== -1 && args[outIndex + 1]) {
  writeFileSync(args[outIndex + 1], json, 'utf8');
  console.log(`wrote ${json.length} bytes to ${args[outIndex + 1]}`);
} else {
  process.stdout.write(json);
}
