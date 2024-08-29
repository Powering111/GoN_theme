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
  selection: {
    challenge_idx: 0,
    category: null,
  },

  getCategories() {
    const categories = [];

    this.challenges.forEach(challenge => {
      const { category } = challenge;

      if (!categories.includes(category)) {
        categories.push(category);
      }
    });

    try {
      const f = CTFd.config.themeSettings.challenge_category_order;
      if (f) {
        const getSort = new Function(`return (${f})`);
        categories.sort(getSort());
      }
    } catch (error) {
      // Ignore errors with theme category sorting
      console.log("Error running challenge_category_order function");
      console.log(error);
    }

    return categories;
  },
  
  async loadChallengeList() {
    this.challenges = await CTFd.pages.challenges.getChallenges();
    this.categories = this.getCategories();
  },

  getChallengesOf(category) {
    let challenges = this.challenges;

    if (category !== null) {
      challenges = challenges.filter(challenge => challenge.category === category);
    }

    try {
      const f = CTFd.config.themeSettings.challenge_order;
      if (f) {
        const getSort = new Function(`return (${f})`);
        challenges.sort(getSort());
      }
    } catch (error) {
      // Ignore errors with theme challenge sorting
      console.log("Error running challenge_order function");
      console.log(error);
    }

    return challenges;
  },

  // load details of the challenge from server
  async loadChallenge(challengeId) {
    const idx = this.challenges.findIndex(c => c.id === challengeId);
    if(idx == -1) return null;
  
    if (!("detail" in this.challenges[idx])) {
      this.challenges[idx].detail = null;
      await CTFd.pages.challenge.displayChallenge(challengeId, challenge => { 
        this.challenges[idx].detail = challenge.data;
        window.dispatchEvent(new CustomEvent('update-challenge', {detail: this.currentChallenge()}))
      });
    }
  },

  currentChallengeId(){
    return this.getChallengesOf(this.selection.category)[this.selection.challenge_idx].id;
  },

  // get current challenge object
  currentChallenge(){
    return this.challenges.find(c => c.id === this.currentChallengeId());
  },

  selectChallenge(challengeId){
    if(this.currentChallengeId()===challengeId) return; // TODO: open details

    let idx = this.getChallengesOf(this.selection.category).findIndex(c => c.id === challengeId);
    if(idx === -1) {
      this.selection.category = null;
      idx = this.getChallengesOf(this.selection.category).findIndex(c => c.id === challengeId);
      if(idx === -1 ) {
        console.log(`Challenge ${challengeId} does not exist.`)
        return;
      }
    }
    this.selection.challenge_idx = idx;
    this.selection.challenge_id = challengeId;
    this.loadChallenge(challengeId);
    window.dispatchEvent(new CustomEvent('update-challenge', {detail: this.currentChallenge()}))

  },

  selectNextChallenge(){
    const current_list = this.getChallengesOf(this.selection.category);
    let new_idx = this.selection.challenge_idx + 1;
    let l = this.challenges.length;
    if(new_idx >= l) {
      new_idx = l - 1;
    }
    else{
      this.selectChallenge(current_list[new_idx].id)
    }
  },
  
  selectPreviousChallenge(){
    const current_list = this.getChallengesOf(this.selection.category);
    let new_idx = this.selection.challenge_idx - 1;
    if(new_idx < 0) {
      new_idx = 0;
    }
    else{
      this.selectChallenge(current_list[new_idx].id)
    }
  },
})


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
  challenge: null,

  async init() {
    await Alpine.store('info').loadChallengeList();
    this.loaded = true;

    if (window.location.hash) {
      let chalHash = decodeURIComponent(window.location.hash.substring(1));
      let idx = chalHash.lastIndexOf("-");
      if (idx >= 0) {
        let pieces = [chalHash.slice(0, idx), chalHash.slice(idx + 1)];
        let id = pieces[1];
        Alpine.store('info').selectChallenge(id);
      }
    }
    else{
      if(Alpine.store('info').challenges.length > 0){
        // automatically select the very first challenge
        Alpine.store('info').loadChallenge(Alpine.store('info').challenges[0].id);
      }

    }
  },
  
  handleWheel(event){
    if(event.deltaY > 0) {
      Alpine.store('info').selectNextChallenge();
    }
    else if(event.deltaY < 0){
      Alpine.store('info').selectPreviousChallenge();
    }
  },
}));

Alpine.data('ChallengeInfo', () => ({

  // copy of the current challenge, to make life easier
  challenge: {name: 'Nothing here', category: 'CTF'},
  loaded_challenge: null,

  // used only for loading animation
  loading: false,
  loading_timeout: null,

  getChallengeThumbnail() {
    const one = this.challenge.detail?.files?.find(f => f.includes('.png'))
    if (!one) return;
    const query_idx = one.lastIndexOf('?');
    return one.substring(0,query_idx)
  },
  
  getChallengeDifficulty() {
    const difficulty_str = this.challenge.tags?.find(f => f.value.startsWith('difficulty-'));
    if(!difficulty_str) {
      return 0;
    }
    const maybe_number = parseInt(difficulty_str.value.substring('difficulty-'.length))
    if(Number.isNaN(maybe_number)){
      return 0;
    }
    else{
      return maybe_number;
    }
  },

  handleUpdateChallenge(event) {
    this.loaded_challenge = event.detail;

    this.loading=true;
    if(this.loading_timeout){
      clearTimeout(this.loading_timeout)
    }
    this.loading_timeout = setTimeout(()=>{ 
      this.challenge=this.loaded_challenge;

      // this.loading is set to false when image is loaded.
      Alpine.nextTick(()=>{
        if(this.$refs.challenge_info_img.complete) {
          this.loading=false;
        }
      })
      
    },300);
  }
  
}));

Alpine.start();
