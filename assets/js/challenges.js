import Alpine from "alpinejs";
import dayjs from "dayjs";

import CTFd from "./index";

import { Modal, Tab, Tooltip } from "bootstrap";
import highlight from "./theme/highlight";

function addTargetBlank(html) {
  let dom = new DOMParser();
  let view = dom.parseFromString(html, "text/html");
  let links = view.querySelectorAll('a[href*="://"]');
  links.forEach(link => {
    link.setAttribute("target", "_blank");
  });
  return view.documentElement.outerHTML;
}

window.Alpine = Alpine;

Alpine.store("info", {
  categories: [],
  challenges: [],
  challenges_shown: [],
  selection: {
    // challenge which is shown at the info tab
    challenge_id: null,

    // index of the selected challenge within challenges_shown
    challenge_idx: 0,

    // currently selected category
    category: "all",

    // key for the challenge object which is used for sorting
    sort: "value",
  },

  getCategories() {
    const categories = [];

    this.challenges.forEach(challenge => {
      let { category } = challenge;
      category = category.toLowerCase();
      if (!categories.includes(category)) {
        categories.push(category);
      }
    });
    categories.sort();

    if (!categories.includes("all")) {
      categories.unshift("all");
    }
    return categories;
  },

  async loadChallengeList() {
    this.challenges = (await CTFd.pages.challenges.getChallenges()).map(challenge => {
      // retrieve difficulty
      const difficulty_str = challenge.tags?.find(f =>
        f.value.startsWith("difficulty-"),
      );
      let difficulty = 0;
      if (!!difficulty_str) {
        difficulty = parseInt(difficulty_str.value.substring("difficulty-".length));
        if (Number.isNaN(difficulty)) {
          difficulty = 0;
        }
      }
      challenge.difficulty = difficulty;

      return challenge;
    });

    this.categories = this.getCategories();
  },

  selectCategory(category) {
    category = category.toLowerCase();
    if (!this.categories.includes(category)) {
      console.warn(`There's no such category ${category}.`);
      category = "all";
    }
    this.selection.category = category;

    let challenges = this.challenges;

    if (category !== "all") {
      challenges = challenges.filter(challenge => challenge.category === category);
    }

    challenges.sort((a, b) => a[this.selection.sort] < b[this.selection.sort]);

    this.challenges_shown = challenges;
    if (this.challenges_shown.length > 0) {
      this.selectChallenge(this.challenges_shown[0].id);
    }
  },

  // load details of the challenge from server
  async loadChallenge(challengeId) {
    const idx = this.challenges.findIndex(c => c.id === challengeId);
    if (idx == -1) return null;

    if (!("detail" in this.challenges[idx])) {
      this.challenges[idx].detail = null;
      await CTFd.pages.challenge.displayChallenge(challengeId, challenge => {
        this.challenges[idx].detail = challenge.data;
        window.dispatchEvent(
          new CustomEvent("update-challenge", { detail: this.currentChallenge() }),
        );
      });
    }
  },

  // get the challenge which is selected from the list now.
  currentChallenge() {
    return this.challenges_shown[this.selection.challenge_idx];
  },

  selectChallenge(challengeId) {
    if (!challengeId) return;
    if (this.selection.challenge_id === challengeId) return; // TODO: open details

    let idx = this.challenges_shown.findIndex(c => c.id === challengeId);
    if (idx === -1) {
      // select all category and retry
      if (this.selection.category !== "all") {
        this.selectCategory("all");
        this.selectChallenge(challengeId);
      } else {
        console.warn(`Challenge ${challengeId} does not exist.`);
        return;
      }
    }
    this.selection.challenge_idx = idx;
    this.selection.challenge_id = challengeId;
    this.loadChallenge(challengeId);
    window.dispatchEvent(
      new CustomEvent("update-challenge", { detail: this.currentChallenge() }),
    );
  },

  selectNextChallenge() {
    let new_idx = this.selection.challenge_idx + 1;
    let l = this.challenges_shown.length;
    if (new_idx >= l) {
      new_idx = l - 1;
    } else {
      this.selectChallenge(this.challenges_shown[new_idx].id);
    }
  },

  selectPreviousChallenge() {
    let new_idx = this.selection.challenge_idx - 1;
    if (new_idx < 0) {
      new_idx = 0;
    } else {
      this.selectChallenge(this.challenges_shown[new_idx].id);
    }
  },
});

Alpine.store("challenge", {
  data: {
    view: "",
  },
});

Alpine.data("Hint", () => ({
  id: null,
  html: null,

  async showHint(event) {
    if (event.target.open) {
      let response = await CTFd.pages.challenge.loadHint(this.id);
      let hint = response.data;
      if (hint.content) {
        this.html = addTargetBlank(hint.html);
      } else {
        let answer = await CTFd.pages.challenge.displayUnlock(this.id);
        if (answer) {
          let unlock = await CTFd.pages.challenge.loadUnlock(this.id);

          if (unlock.success) {
            let response = await CTFd.pages.challenge.loadHint(this.id);
            let hint = response.data;
            this.html = addTargetBlank(hint.html);
          } else {
            event.target.open = false;
            CTFd._functions.challenge.displayUnlockError(unlock);
          }
        } else {
          event.target.open = false;
        }
      }
    }
  },
}));

Alpine.data("Challenge", () => ({
  id: null,
  next_id: null,
  submission: "",
  tab: null,
  solves: [],
  response: null,
  share_url: null,
  max_attempts: 0,
  attempts: 0,

  async init() {
    highlight();
  },

  getStyles() {
    let styles = {
      "modal-dialog": true,
    };
    try {
      let size = CTFd.config.themeSettings.challenge_window_size;
      switch (size) {
        case "sm":
          styles["modal-sm"] = true;
          break;
        case "lg":
          styles["modal-lg"] = true;
          break;
        case "xl":
          styles["modal-xl"] = true;
          break;
        default:
          break;
      }
    } catch (error) {
      // Ignore errors with challenge window size
      console.log("Error processing challenge_window_size");
      console.log(error);
    }
    return styles;
  },

  async showChallenge() {
    new Tab(this.$el).show();
  },

  async showSolves() {
    this.solves = await CTFd.pages.challenge.loadSolves(this.id);
    this.solves.forEach(solve => {
      solve.date = dayjs(solve.date).format("MMMM Do, h:mm:ss A");
      return solve;
    });
    new Tab(this.$el).show();
  },

  getNextId() {
    let data = Alpine.store("challenge").data;
    return data.next_id;
  },

  async nextChallenge() {
    let modal = Modal.getOrCreateInstance("[x-ref='challengeWindow']");

    // TODO: Get rid of this private attribute access
    // See https://github.com/twbs/bootstrap/issues/31266
    modal._element.addEventListener(
      "hidden.bs.modal",
      event => {
        // Dispatch load-challenge event to call loadChallenge in the ChallengeBoard
        Alpine.nextTick(() => {
          this.$dispatch("load-challenge", this.getNextId());
        });
      },
      { once: true },
    );
    modal.hide();
  },

  async getShareUrl() {
    let body = {
      type: "solve",
      challenge_id: this.id,
    };
    const response = await CTFd.fetch("/api/v1/shares", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    const url = data["data"]["url"];
    this.share_url = url;
  },

  copyShareUrl() {
    navigator.clipboard.writeText(this.share_url);
    let t = Tooltip.getOrCreateInstance(this.$el);
    t.enable();
    t.show();
    setTimeout(() => {
      t.hide();
      t.disable();
    }, 2000);
  },

  async submitChallenge() {
    this.response = await CTFd.pages.challenge.submitChallenge(
      this.id,
      this.submission,
    );

    await this.renderSubmissionResponse();
  },

  async renderSubmissionResponse() {
    if (this.response.data.status === "correct") {
      this.submission = "";
    }

    // Increment attempts counter
    if (this.max_attempts > 0 && this.response.data.status != "already_solved") {
      this.attempts += 1;
    }

    // Dispatch load-challenges event to call loadChallenges in the ChallengeBoard
    this.$dispatch("load-challenges");
  },
}));

Alpine.data("ChallengeBoard", () => ({
  loaded: false,

  async init() {
    await Alpine.store("info").loadChallengeList();
    Alpine.store("info").selectCategory("all");

    this.loaded = true;

    if (window.location.hash) {
      let chalHash = decodeURIComponent(window.location.hash.substring(1));
      let idx = chalHash.lastIndexOf("-");
      if (idx >= 0) {
        let pieces = [chalHash.slice(0, idx), chalHash.slice(idx + 1)];
        let id = pieces[1];
        Alpine.store("info").selectChallenge(id);
      }
    } else {
      if (Alpine.store("info").challenges.length > 0) {
        // automatically select the very first challenge
        Alpine.store("info").loadChallenge(Alpine.store("info").challenges[0].id);
      }
    }
  },

  handleWheel(event) {
    if (event.deltaY > 0) {
      Alpine.store("info").selectNextChallenge();
    } else if (event.deltaY < 0) {
      Alpine.store("info").selectPreviousChallenge();
    }
  },
}));

Alpine.data("ChallengeInfo", () => ({
  // copy of the current challenge, to make life easier
  challenge: { name: "Nothing here", category: "CTF" },
  loaded_challenge: null,

  // used only for loading animation
  loading: false,
  loading_timeout: null,

  getChallengeThumbnail() {
    const one = this.challenge.detail?.files?.find(f => {
      const lastslash = f.lastIndexOf("/");
      const questionmark = f.indexOf("?", lastslash);
      const filename = f.substring(lastslash, questionmark);
      return [".png", ".jpg", ".jpeg", ".gif", ".svg", "bmp"].some(ext =>
        filename.endsWith(ext),
      );
    });
    if (!one) return;
    const query_idx = one.lastIndexOf("?");
    return one.substring(0, query_idx);
  },

  handleUpdateChallenge(event) {
    this.loaded_challenge = event.detail;

    this.loading = true;
    if (this.loading_timeout) {
      clearTimeout(this.loading_timeout);
    }
    this.loading_timeout = setTimeout(() => {
      this.challenge = this.loaded_challenge;

      // this.loading is set to false when image is loaded.
      Alpine.nextTick(() => {
        if (this.$refs.challenge_info_img.complete) {
          this.loading = false;
        }
      });
    }, 100);
  },
}));

Alpine.start();
