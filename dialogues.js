/**
 * dialogues.js — Audio dialogue registry for Sparky's Carnival Quest
 *
 * Each game section maps dialogue clips to their role:
 *   intro       — Game explanation spoken at the start of a round
 *   guide       — Guiding prompts cycled during gameplay
 *   cheerup     — Encouraging lines played on a wrong answer
 *   matchSingle — Celebration when ONE shape is matched (shapes game)
 *   matchAll    — Celebration when ALL shapes are matched (shapes game)
 *   prize       — Prize reveal line (mystery box)
 *   allPopped   — Celebration when all 5 balloons are popped
 *
 * File paths are relative to the project root (served via HTTP).
 */

const D = 'Dialogues';

export const DIALOGUES = {
  // ── 1. FIND THE DIFFERENT ONE ───────────────────────────────────────────────
  different: {
    intro:   [`${D}/Find the Different One/T01.mp3`],
    guide:   [
      `${D}/Find the Different One/T02.mp3`,
      `${D}/Find the Different One/T03.mp3`,
      `${D}/Find the Different One/T04.mp3`,
    ],
    cheerup: [
      `${D}/Find the Different One/T05.mp3`,
      `${D}/Find the Different One/T06.mp3`,
      `${D}/Find the Different One/T07.mp3`,
      `${D}/Find the Different One/T08.mp3`,
    ],
  },

  // ── 2. FIND THE BIGGEST ONE ─────────────────────────────────────────────────
  biggest: {
    intro:   [`${D}/Find the Biggest One/T09.mp3`],
    guide:   [
      `${D}/Find the Biggest One/T10.mp3`,
      `${D}/Find the Biggest One/T11.mp3`,
      `${D}/Find the Biggest One/T12.mp3`,
    ],
    cheerup: [
      `${D}/Find the Biggest One/T13.mp3`,
      `${D}/Find the Biggest One/T14.mp3`,
      `${D}/Find the Biggest One/T15.mp3`,
      `${D}/Find the Biggest One/T16.mp3`,
    ],
  },

  // ── 3. COUNT MORE ───────────────────────────────────────────────────────────
  more: {
    intro:   [`${D}/Count More/T17.mp3`],
    guide:   [
      `${D}/Count More/T18.mp3`,
      `${D}/Count More/T19.mp3`,
      `${D}/Count More/T20.mp3`,
    ],
    cheerup: [
      `${D}/Count More/T21.mp3`,
      `${D}/Count More/T22.mp3`,
      `${D}/Count More/T23.mp3`,
      `${D}/Count More/T24.mp3`,
    ],
  },

  // ── 4. FIND THE LONGEST ONE ─────────────────────────────────────────────────
  longest: {
    intro:   [`${D}/Find the Longest One/T25.mp3`],
    guide:   [
      `${D}/Find the Longest One/T26.mp3`,
      `${D}/Find the Longest One/T27.mp3`,
      `${D}/Find the Longest One/T28.mp3`,
    ],
    cheerup: [
      `${D}/Find the Longest One/T29.mp3`,
      `${D}/Find the Longest One/T30.mp3`,
      `${D}/Find the Longest One/T31.mp3`,
      `${D}/Find the Longest One/T32.mp3`,
    ],
  },

  // ── 5. MATCH THE SHAPES ─────────────────────────────────────────────────────
  shapes: {
    intro:   [`${D}/Match the Shapes_ Introduction & Guidance/T33.mp3`],
    guide:   [
      `${D}/Match the Shapes_ Introduction & Guidance/T34.mp3`,
      `${D}/Match the Shapes_ Introduction & Guidance/T35.mp3`,
      `${D}/Match the Shapes_ Introduction & Guidance/T36.mp3`,
      `${D}/Match the Shapes_ Introduction & Guidance/T37.mp3`,
    ],
    cheerup: [
      `${D}/Match the Shapes_ Corrections & Celebrations/T38.mp3`,
      `${D}/Match the Shapes_ Corrections & Celebrations/T39.mp3`,
      `${D}/Match the Shapes_ Corrections & Celebrations/T40.mp3`,
      `${D}/Match the Shapes_ Corrections & Celebrations/T41.mp3`,
    ],
    matchSingle: [
      `${D}/Match the Shapes_ Corrections & Celebrations/T42.mp3`,
      `${D}/Match the Shapes_ Corrections & Celebrations/T43.mp3`,
    ],
    matchAll: [`${D}/Match the Shapes_ Corrections & Celebrations/T44.mp3`],
  },

  // ── 6. MYSTERY BOX BONUS ────────────────────────────────────────────────────
  mystery: {
    intro:   [`${D}/Mystery Box Bonus/T45.mp3`],
    guide:   [
      `${D}/Mystery Box Bonus/T46.mp3`,
      `${D}/Mystery Box Bonus/T47.mp3`,
      `${D}/Mystery Box Bonus/T48.mp3`,
    ],
    cheerup: [
      `${D}/Mystery Box Bonus/T49.mp3`,
      `${D}/Mystery Box Bonus/T50.mp3`,
    ],
    prize:   [`${D}/Mystery Box Bonus/T51.mp3`],
  },

  // ── 7. BALLOON POP BONUS ────────────────────────────────────────────────────
  balloons: {
    intro:     [`${D}/Balloon Pop Bonus/T52.mp3`],
    guide:     [
      `${D}/Balloon Pop Bonus/T53.mp3`,
      `${D}/Balloon Pop Bonus/T54.mp3`,
      `${D}/Balloon Pop Bonus/T55.mp3`,
    ],
    cheerup:   [
      `${D}/Balloon Pop Bonus/T56.mp3`,
      `${D}/Balloon Pop Bonus/T57.mp3`,
      `${D}/Balloon Pop Bonus/T58.mp3`,
    ],
    allPopped: [`${D}/Balloon Pop Bonus/T59.mp3`],
  },

  // ── 8. WELCOME / START PLAYING ──────────────────────────────────────────────
  welcome: {
    intro:   [`${D}/Welcome - Start Playing/T60 Welcome_introduction.mp3`],
    guide:   [
      `${D}/Welcome - Start Playing/T62 follow_instructions_and_tap.mp3`,
      `${D}/Welcome - Start Playing/T63 start_game.mp3`,
    ],
    cheerup: [
      `${D}/Welcome - Start Playing/T64 cheer_up_8_learn_with_practice.mp3`,
      `${D}/Welcome - Start Playing/T65 cheer_up_9_try_again.mp3`,
      `${D}/Welcome - Start Playing/T66 cheer_up_10_you_are_doing_great.mp3`,
      `${D}/Welcome - Start Playing/T67 cheer_up_11_sparky_will_help.mp3`,
    ],
  },
};
