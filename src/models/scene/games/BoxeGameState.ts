import { Game } from "@/models/Game";
import { GameState } from "@/models/GameState";
import { PlayerInputBoxeGame } from "@/models/inputsMangement/PlayerInputBoxeGame";
import BoxeGameSettings from "@/../public/boxeGameSettings.json";
import { boxeGameEnv } from "@/models/environments/boxeGameEnv";
import {
  Animation,
  FreeCamera,
  HemisphericLight,
  Mesh,
  Vector3,
} from "@babylonjs/core";
import { PlayerBoxeGame } from "@/models/controller/PlayerBoxeGame";
import { BotBoxe } from "@/models/controller/BotBoxe";
import { storeBoxe } from "@/components/gui/storeBoxe.ts";
import { InGameState } from "@/models/scene/InGameState.ts";
import { storeTirArc } from "@/components/gui/storeTirArc.ts";
import { Result } from "@/components/gui/results/ResultsContent.vue";
import { storeSound } from "@/components/gui/storeSound.ts";
import { handleNewRecord } from "@/services/result-service.ts";

interface line {
  start: string;
  end: string;
}

interface botInfo {
  name: string;
  pathFile: string;
}

interface level {
  botInfo: botInfo[];
  pointToSucceed: number;
  timeout: number;
}

interface IBoxeGameState {
  placement: line[];
  level: {
    easy: level;
    intermediate: level;
    hard: level;
  };
}

export class BoxeGameState extends GameState {
  public _camera!: FreeCamera;

  private settings: IBoxeGameState;
  private startPlacement: Mesh[] = [];
  private endPlacement: Mesh[] = [];

  private player!: PlayerBoxeGame;
  private playerName: string;
  private _input: PlayerInputBoxeGame;

  private botArray: BotBoxe[] = [];

  private isMultiplayer: boolean = false;
  private difficulty: "easy" | "intermediate" | "hard";

  private countdownInProgress: boolean = false;
  private fightStartTime: number = 0;

  private gameStart: boolean = false;
  private display: boolean = false;
  private scoreboardIsShow: boolean = false;
  private continueButtonIsPressed: boolean = false;
  private results: Result[] = [];
  private score: string = "0";
  private endGame: boolean = false;

  constructor(
    game: Game,
    canvas: HTMLCanvasElement,
    difficulty?: "easy" | "intermediate" | "hard",
    multi?: boolean,
  ) {
    super(game, canvas);
    this._input = new PlayerInputBoxeGame(this.scene);
    this.playerName = localStorage.getItem("username") || "Playertest";
    this.settings = BoxeGameSettings; //settings running to do later
    this.difficulty = difficulty ? difficulty : "easy";
    storeBoxe.commit(
      "setTimeout",
      this.settings.level[this.difficulty].timeout,
    );
    this.isMultiplayer = multi ? multi : false;
    const soundActive = storeSound.state.etat;
    if (!soundActive) {
      this.game.playTrack("boxeTennis");
    } else {
      this.game.changeActive("boxeTennis");
    }
    document.getElementById("boxetp")!.classList.add("hidden");
  }

  async setEnvironment(): Promise<void> {
    try {
      const maps = new boxeGameEnv(this.scene);
      await maps.load();
    } catch (error) {
      throw new Error("Method not implemented.");
    }
  }

  private createLight() {
    const light = new HemisphericLight(
      "light",
      new Vector3(0, 2, 1),
      this.scene,
    );
    light.intensity = 0.7;
  }

  private setLinePlacement() {
    const startTab: Mesh[] = [];
    const EndTab: Mesh[] = [];
    const placement = this.settings.placement;
    placement.forEach((line) => {
      const startMesh = this.scene.getMeshByName(line.start) as Mesh;
      const firstEndMesh = this.scene.getMeshByName(line.end) as Mesh;
      startMesh.isVisible = false;
      firstEndMesh.isVisible = false;

      if (startMesh && firstEndMesh) {
        startTab.push(startMesh);
        EndTab.push(firstEndMesh);
      }
    });
    this.startPlacement = startTab;
    this.endPlacement = EndTab;
  }

  private async initPlayer() {
    const indexForPlayerPlacement = 0;
    const startMesh = this.startPlacement[indexForPlayerPlacement];
    const getFileName = localStorage.getItem("pathCharacter");
    this.player = new PlayerBoxeGame(
      startMesh.getAbsolutePosition().x || 0,
      startMesh.getAbsolutePosition().y || 0,
      startMesh.getAbsolutePosition().z || 0,
      this.scene,
      `./models/characters/${getFileName}`,
      this.endPlacement[indexForPlayerPlacement],
      this._input,
      false,
    );
    await this.player.init();

    // permet d'enlever la position du joueur de la liste des positions facilitera la suite
    this.startPlacement.splice(indexForPlayerPlacement, 1);
    this.endPlacement.splice(indexForPlayerPlacement, 1);
    // mettre de l'aléatoire dans les positions des bots
    {
      this.startPlacement, this.endPlacement;
    }
  }

  private async runSoloGame() {
    await this.initSoloWithBot(this.difficulty);
    this.buildScoreBoard();
  }

  private async initSoloWithBot(difficulty: string) {
    const infoBot = this.settings.level[difficulty].botInfo;
    for (let i = 0; i < 1; i++) {
      const startMesh = this.startPlacement[i];
      const endMesh = this.endPlacement[i];
      //nicolas changer le pathfile dans le fichier natationGameSettings.json --> DONE
      const bot = new BotBoxe(
        "bot" + i,
        startMesh.getAbsolutePosition(),
        endMesh,
        this.scene,
        infoBot[i].pathFile,
        infoBot[i].speed,
      );
      await bot.init();
      this.botArray.push(bot);
    }
  }

  initGui() {
    document.getElementById("boxeGame-score")!.classList.remove("hidden");
  }

  // Implement abstract members of GameState
  async enter(): Promise<void> {
    try {
      //load the gui iin the mainmenu and not here only for prod
      this.game.engine.displayLoadingUI();
      this.scene.detachControl();

      document.getElementById("map-keybind")!.classList.add("hidden");

      // Inspector.Show(this.scene, {});
      await this.setEnvironment();
      this.createLight();
      this.setLinePlacement();

      // Init player
      await this.initPlayer(); //to resolve

      // lancer le bon mode de jeu
      // on init le jeu
      if (!this.isMultiplayer) {
        await this.runSoloGame(); //to resolve
      }

      this.runUpdateAndRender();

      this._camera = new FreeCamera(
        "cameraBoxe",
        new Vector3(-4, 4, 14.45),
        this.scene,
      );
      this._camera.rotation._y = Math.PI / 2;
      this._camera.rotation._x = Math.PI / 5;
      // Vector3(4.78, 3.27, 6.38)
      // this._camera.setTarget(this.player.transform.position); // pas besoin de target le player pour ce jeu

      document.getElementById("boxeGame-help")!.classList.remove("hidden");
      document
        .getElementById("boxeGame-action-container")!
        .classList.remove("hidden");
      this.addEventListenerById("close-help-boxe", "click", () => {
        document.getElementById("boxeGame-help")!.classList.add("hidden");
      });
      document
        .getElementById("boxeGame-skip-button")!
        .classList.remove("hidden");
      this.addEventListenerById("boxeGame-skip-button", "click", () => {
        document.getElementById("boxeGame-help")!.classList.add("hidden");
        this.scene.stopAnimation(this._camera);
        this.AfterCamAnim();
      });

      await this.scene.whenReadyAsync(); // on attends que la scene soit bien chargé
      this.scene.attachControl();
      this.game.engine.hideLoadingUI();

      this.CreateCameraMouv().then(() => {
        document.getElementById("boxeGame-help")!.classList.add("hidden");
        document
          .getElementById("boxeGame-ready-button")!
          .classList.remove("hidden");
        document
          .getElementById("boxeGame-skip-button")!
          .classList.add("hidden");
        this.addEventListenerById("boxeGame-ready-button", "click", () => {
          this.startCountdown([
            "boxeGame-text-1",
            "boxeGame-text-2",
            "boxeGame-text-3",
            "boxeGame-text-4",
          ]);
          this.AfterCamAnim();
          this.initGui();
          document
            .getElementById("boxeGame-ready-button")!
            .classList.add("hidden");
          this.game.canvas.focus();
        });
      });
    } catch (error) {
      throw new Error(`error in enter method : ${error}`);
    }
  }

  private startCountdown(countdownElements: string[]) {
    if (this.countdownInProgress) return; // Évite de démarrer le compte à rebours multiple fois
    let countdownIndex = 0;
    let previousElement = "";
    // (this._camera.position, this._camera.rotation);

    const countdownInterval = setInterval(() => {
      const countdownElement = countdownElements[countdownIndex];
      if (previousElement !== "")
        document.getElementById(previousElement)!.classList.add("hidden");
      document.getElementById(countdownElement)!.classList.remove("hidden");
      previousElement = countdownElement;
      countdownIndex++;

      if (countdownIndex >= countdownElements.length) {
        clearInterval(countdownInterval);

        // Cache le dernier élément après une seconde
        setTimeout(() => {
          document.getElementById(previousElement)!.classList.add("hidden");
        }, 500);

        // Permet au joueur de jouer ou exécutez d'autres actions nécessaires
        this.countdownInProgress = true;
        this.fightStartTime = performance.now();
      }
    }, 1000);
    setTimeout(() => {
      this.gameStart = true;
    }, 4500);
  }

  AfterCamAnim(): void {
    // this._camera.dispose();
    // this._camera = this.player.createCameraPlayer(this.player.transform);
    this._camera.position = new Vector3(-0.74, 0.4, 13.4);
    this._camera.rotation._y = -2 * Math.PI;
    this._camera.rotation._x = 0;
    this.player.setCamera(this._camera);
  }

  async CreateCameraMouv(): Promise<void> {
    const fps = 60;
    const camAnim = new Animation(
      "camAnim",
      "position",
      fps,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
      true,
    );

    const rotationAnim = new Animation(
      "rotationAnim",
      "rotation",
      fps,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
      true,
    );

    const camKeys: { frame: number; value: Vector3 }[] = [];
    const rotationKeys: { frame: number; value: Vector3 }[] = [];

    camKeys.push({ frame: 0, value: new Vector3(-4, 3.6, 14.45) });
    camKeys.push({ frame: 2 * fps, value: new Vector3(0, 3.6, 11) });
    camKeys.push({ frame: 4 * fps, value: new Vector3(4, 3.6, 14.45) });
    camKeys.push({ frame: 6 * fps, value: new Vector3(0, 3.6, 17.9) });
    camKeys.push({ frame: 9 * fps, value: new Vector3(-4, 2.5, 14.45) });
    camKeys.push({ frame: 11 * fps, value: new Vector3(-0.74, 0.4, 13.4) });

    rotationKeys.push({
      frame: 0,
      value: new Vector3(Math.PI / 4, Math.PI / 2, 0),
    });
    rotationKeys.push({
      frame: 2 * fps,
      value: new Vector3(Math.PI / 4, 0, 0),
    });
    rotationKeys.push({
      frame: 4 * fps,
      value: new Vector3(Math.PI / 4, -Math.PI / 2, 0),
    });
    rotationKeys.push({
      frame: 6 * fps,
      value: new Vector3(Math.PI / 4, -Math.PI, 0),
    });
    rotationKeys.push({
      frame: 9 * fps,
      value: new Vector3(Math.PI / 5, (-3 * Math.PI) / 2, 0),
    });
    rotationKeys.push({
      frame: 11 * fps,
      value: new Vector3(0, -2 * Math.PI, 0),
    });

    camAnim.setKeys(camKeys);
    rotationAnim.setKeys(rotationKeys);

    this._camera.animations.push(camAnim);
    this._camera.animations.push(rotationAnim);

    await this.scene.beginAnimation(this._camera, 0, 11 * fps).waitAsync();
    document.getElementById("boxeGame-skip-button")!.classList.add("hidden");
  }

  async exit(): Promise<void> {
    document.getElementById("boxeGame-score")!.classList.add("hidden");
    document.getElementById("boxeGame-results")!.classList.add("hidden");
    document
      .getElementById("boxeGame-action-container")!
      .classList.add("hidden");

    storeBoxe.commit("setScore", 0);
    storeBoxe.commit("resetTimer");
    storeBoxe.commit("setPlayable", false);
    storeBoxe.commit("setResults", []);

    this.cleanup();
  }

  update(): void {
    // ("update");
    if (this.gameStart && !this.display) {
      this.display = true;
      document.getElementById("boxeGame-container")!.classList.remove("hidden");
      storeBoxe.commit("setPlayable", true);
    }

    if (!storeBoxe.state.playable && this.gameStart && !this.endGame) {
      this.endGame = true;
      this.createFinaleScoreBoard();
      setTimeout(() => {
        document.getElementById("boxeGame-container")!.classList.add("hidden");
        this.showScoreBoard();
      }, 1000);
    }
  }

  async showScoreBoard(): Promise<void> {
    this.scoreboardIsShow = true;
    document.getElementById("boxeGame-text-finish")!.classList.remove("hidden");
    await handleNewRecord("boxing", Number(this.score), this.playerName);

    this.addEventListenerByQuerySelector(
      "#boxeGame-results #continue-button",
      "click",
      () => {
        this.continueButtonIsPressed = true;
        this.game.changeState(new InGameState(this.game, this.game.canvas));
      },
    );
    this.addEventListenerByQuerySelector(
      "#boxeGame-results #replay-button",
      "click",
      () => {
        this.game.changeState(
          new BoxeGameState(
            this.game,
            this.game.canvas,
            this.difficulty,
            this.isMultiplayer,
          ),
        );
      },
    );
    // attendre 2 secondes avant d'afficher le tableau des scores
    setTimeout(() => {
      document.getElementById("boxeGame-text-finish")!.classList.add("hidden");
      document.getElementById("boxeGame-results")!.classList.remove("hidden");
    }, 2000);
  }

  buildScoreBoard(): void {
    this.results.push({ place: 1, name: this.playerName, result: "0" });
    storeBoxe.commit("setResults", this.results);
  }

  createFinaleScoreBoard(): void {
    this.results = [];
    this.score = storeBoxe.state.score.toString();
    this.results.push({
      place: 1,
      name: this.playerName,
      result: this.score,
    });
    storeBoxe.commit("setResults", this.results);
    if (
      Number(this.score) >= this.settings.level[this.difficulty].pointToSucceed
    ) {
      if (
        this.difficulty === "easy" &&
        localStorage.getItem("levelBoxe") === "easy"
      ) {
        localStorage.setItem("levelBoxe", "intermediate");
      }
      if (
        this.difficulty === "intermediate" &&
        localStorage.getItem("levelBoxe") === "intermediate"
      ) {
        localStorage.setItem("levelBoxe", "hard");
      }
    }
  }
}
