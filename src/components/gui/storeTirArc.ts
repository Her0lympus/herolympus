import { createStore } from "vuex";
import { Result } from "./results/ResultsContent.vue";

const results: Result[] = [{ place: 1, name: "Sebastien", result: "0" }];

// Create a new store instance.
export const storeTirArc = createStore({
  state() {
    return {
      score: 0,
      positionH: -10,
      positionV: -10,
      speed: 35,
      results: results,
      playable: false,
      initialState: {
        positionH: -4,
        positionV: -1,
        increasing: true,
        horizontalPlaying: true,
        verticalPlaying: false,
        isGameActive: false,
      },
    };
  },
  mutations: {
    setScore(state, value) {
      state.score = value;
    },
    setPosH(state, value) {
      state.positionH = value;
    },
    setPosV(state, value) {
      state.positionV = value;
    },
    setSpeed(state, value) {
      state.speed = value;
    },
    setResults(state, value) {
      state.results = value;
    },
    setInitialState(state, value) {
      state.initialState = value;
    },
    setGameActive(state, value) {
      state.initialState.isGameActive = value;
    },
    setPlayable(state, value) {
      state.playable = value;
    },
  },
});
