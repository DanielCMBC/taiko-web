class View{
	constructor(...args){
		this.init(...args)
	}
	init(controller){
		this.controller = controller
		
		this.canvas = document.getElementById("canvas")
		this.ctx = this.canvas.getContext("2d")
		var resolution = settings.getItem("resolution")
		var noSmoothing = resolution === "low" || resolution === "lowest"
		if(noSmoothing){
			this.ctx.imageSmoothingEnabled = false
		}
		this.multiplayer = this.controller.multiplayer
		if(this.multiplayer !== 2 && resolution === "lowest"){
			document.getElementById("game").classList.add("pixelated")
		}
		
		this.gameDiv = document.getElementById("game")
		this.songBg = document.getElementById("songbg")
		this.songStage = document.getElementById("song-stage")
		
		// --- MODIFICATION START ---
		this.dancerContainer = document.getElementById("dancer-container");
		this.feverCrowd = document.getElementById("fever-crowd");
		this.gogoSplash = document.getElementById("gogo-splash");
		this.resultsChibi = document.getElementById("results-chibi");
		
		this.backgrounds = null;
		// --- MODIFICATION END ---

		this.rules = this.controller.game.rules
		this.portraitClass = false
		this.touchp2Class = false
		this.darkDonBg = false
		
		this.pauseOptions = strings.pauseOptions
		this.difficulty = {
			"easy": 0,
			"normal": 1,
			"hard": 2,
			"oni": 3,
			"ura": 4
		}
		
		this.currentScore = {
			ms: -Infinity,
			type: 0
		}
		this.noteFace = {
			small: 0,
			big: 3
		}
		this.state = {
			pausePos: 0,
			moveMS: 0,
			moveHover: null,
			hasPointer: false
		}
		this.nextBeat = 0
		this.gogoTime = 0
		this.gogoTimeStarted = -Infinity
		this.drumroll = []
		this.touchEvents = 0
		if(this.controller.parsedSongData.branches){
			this.branch = "normal"
			this.branchAnimate = {
				ms: -Infinity,
				fromBranch: "normal"
			}
			this.branchMap = {
				"normal": {
					"bg": "rgba(0, 0, 0, 0)",
					"text": "#d3d3d3",
					"stroke": "#393939",
					"shadow": "#000"
				},
				"advanced": {
					"bg": "rgba(29, 129, 189, 0.4)",
					"text": "#94d7e7",
					"stroke": "#315973",
					"shadow": "#082031"
				},
				"master": {
					"bg": "rgba(230, 29, 189, 0.4)",
					"text": "#f796ef",
					"stroke": "#7e2e6e",
					"shadow": "#3e0836"
				}
			}
		}
		
		if(this.controller.calibrationMode){
			this.beatInterval = 512
		}else{
			this.beatInterval = this.controller.parsedSongData.beatInfo.beatInterval
		}
		this.font = strings.font
		
		this.draw = new CanvasDraw(noSmoothing)
		this.assets = new ViewAssets(this)
		
		this.titleCache = new CanvasCache(noSmoothing)
		this.comboCache = new CanvasCache(noSmoothing)
		this.pauseCache = new CanvasCache(noSmoothing)
		this.branchCache = new CanvasCache(noSmoothing)
		this.nameplateCache = new CanvasCache(noSmoothing)
		
		if(this.multiplayer === 2){
			this.player = p2.player === 2 ? 1 : 2
		}else{
			this.player = this.controller.multiplayer ? p2.player : 1
		}
		
		this.touchEnabled = this.controller.touchEnabled
		this.touch = -Infinity
		this.touchAnimation = settings.getItem("touchAnimation")
		
		versionDiv.classList.add("version-hide")
		loader.screen.parentNode.insertBefore(versionDiv, loader.screen)
		
		if(this.multiplayer !== 2){
			
			if(this.controller.touchEnabled){
				this.touchDrumDiv = document.getElementById("touch-drum")
				this.touchDrumImg = document.getElementById("touch-drum-img")
				
				this.setBgImage(this.touchDrumImg, assets.image["touch_drum"].src)
				
				if(this.controller.autoPlayEnabled){
					this.touchDrumDiv.style.display = "none"
				}
				pageEvents.add(this.canvas, "touchstart", this.ontouch.bind(this))
				
				this.gameDiv.classList.add("touch-visible")
				
				this.touchFullBtn = document.getElementById("touch-full-btn")
				pageEvents.add(this.touchFullBtn, "touchend", toggleFullscreen)
				if(!fullScreenSupported){
					this.touchFullBtn.style.display = "none"
				}
				
				this.touchPauseBtn = document.getElementById("touch-pause-btn")
				pageEvents.add(this.touchPauseBtn, "touchend", () => {
					this.controller.togglePause()
				})
				if(this.multiplayer){
					this.touchPauseBtn.style.display = "none"
				}
			}
		}
		if(this.multiplayer){
			this.gameDiv.classList.add("multiplayer")
		}else{
			pageEvents.add(this.canvas, "mousedown", this.onmousedown.bind(this))
		}
	}

	// --- MODIFICATION START ---
	// ADD ALL OF THESE NEW FUNCTIONS TO YOUR VIEW.JS FILE
	
	setBackground(bgObject) {
		this.backgrounds = bgObject;
		this.updateBackgroundState(this.controller.game.globalScore.gauge >= this.rules.gaugeClear * 10000);
	}

	setDancer(dancerObject) {
		if (dancerObject && dancerObject.sprite) {
			this.dancerContainer.style.backgroundImage = `url('assets/img/${dancerObject.sprite}')`;
			
			// This is how we handle complex sprite sheets.
			// It calculates which row of the image to show.
			const verticalPosition = dancerObject.rows > 1 ? ((dancerObject.characterRow - 1) / (dancerObject.rows - 1)) * 100 : 0;
			
			// Set the total size of the sprite sheet background. 
			// e.g., if there are 8 columns, the width is 800%.
			this.dancerContainer.style.backgroundSize = `${dancerObject.cols * 100}% ${dancerObject.rows * 100}%`;
			
			// Set the starting position to the correct row.
			this.dancerContainer.style.backgroundPosition = `0% ${verticalPosition}%`;

			// Dynamically create a UNIQUE animation rule for this specific character row.
			// This avoids conflicts if multiple animations are on one sheet.
			const animationName = `dance_loop_row_${dancerObject.characterRow}`;
			const keyframes = `@keyframes ${animationName} { to { background-position: -${dancerObject.cols * 100}% ${verticalPosition}%; } }`;
			
			// Add the new animation rule to the page's stylesheet.
			var styleSheet = document.styleSheets[0];
			try {
				styleSheet.insertRule(keyframes, styleSheet.cssRules.length);
			} catch (e) {
				console.warn("Could not insert keyframe rule (might already exist):", e);
			}

			// Apply the new, unique animation to the dancer container.
			this.dancerContainer.style.animation = `${animationName} 0.8s steps(${dancerObject.cols}) infinite`;
			this.dancerContainer.style.display = 'block';

		} else {
			this.dancerContainer.style.display = 'none';
			this.dancerContainer.style.animation = 'none';
		}
	}

	setFever(feverFilename) {
		if (feverFilename) {
			this.feverCrowd.style.backgroundImage = `url('assets/img/gameplay/dancers/${feverFilename}')`;
		}
	}

	updateBackgroundState(isClear) {
		if (!this.backgrounds) return;
		const newBg = isClear ? this.backgrounds.clear : this.backgrounds.miss;
		this.songBg.style.backgroundImage = `url('assets/img/gameplay/backgrounds/${newBg}')`;
	}

	startGogoTime() {
		this.gogoSplash.style.display = 'block';
		this.gogoSplash.classList.add('animate');
		this.feverCrowd.style.display = 'block';
		this.feverCrowd.classList.add('animate');
		
		// Reset splash animation after it finishes so it can play again
		setTimeout(() => {
			this.gogoSplash.classList.remove('animate');
			this.gogoSplash.style.display = 'none';
		}, 500);

		// This is an existing function that makes the note track glow
		this.toggleGogoTime({ gogoTime: true, ms: this.getMS() });
	}

	stopGogoTime() {
		this.feverCrowd.classList.remove('animate');
		this.feverCrowd.style.display = 'none';

		// This is an existing function that stops the note track glow
		this.toggleGogoTime({ gogoTime: false, ms: this.getMS() });
	}

	showResultsChibi(didClear, chibiAssets) {
		if (!chibiAssets) return;
		const chibiData = didClear ? chibiAssets.clear : chibiAssets.fail;

		if (chibiData && chibiData.sprite) {
			this.resultsChibi.style.backgroundImage = `url('assets/img/${chibiData.sprite}')`;

			const verticalPosition = chibiData.rows > 1 ? ((chibiData.characterRow - 1) / (chibiData.rows - 1)) * 100 : 0;
			this.resultsChibi.style.backgroundSize = `${chibiData.cols * 100}% ${chibiData.rows * 100}%`;
			this.resultsChibi.style.backgroundPosition = `0% ${verticalPosition}%`;

			const animationName = `chibi_loop_row_${chibiData.characterRow}`;
			const keyframes = `@keyframes ${animationName} { to { background-position: -${chibiData.cols * 100}% ${verticalPosition}%; } }`;
			
			var styleSheet = document.styleSheets[0];
			try {
				styleSheet.insertRule(keyframes, styleSheet.cssRules.length);
			} catch (e) {
				console.warn("Could not insert keyframe rule (might already exist):", e);
			}

			this.resultsChibi.style.animation = `${animationName} 1s steps(${chibiData.cols}) infinite`;
			this.resultsChibi.style.display = 'block';
		}
	}
	// --- MODIFICATION END ---
	
	displayScore(score, notPlayed, bigNote){
		if(!notPlayed){
			this.currentScore.ms = this.getMS()
			this.currentScore.type = score
			this.currentScore.bigNote = bigNote
			
			if(score > 0){
				var explosion = this.assets.explosion
				explosion.type = (bigNote ? 0 : 2) + (score === 450 ? 0 : 1)
				explosion.setAnimation("normal")
				explosion.setAnimationStart(this.getMS())
				explosion.setAnimationEnd(bigNote ? 14 : 7, () => {
					explosion.setAnimation(false)
				})
				
				// --- MODIFICATION START ---
				// Add a class to the canvas to trigger the CSS glow effect
				this.canvas.classList.add('note-hit-effect');
				setTimeout(() => {
					this.canvas.classList.remove('note-hit-effect');
				}, 150);
				// --- MODIFICATION END ---
			}
			this.setDarkBg(score === 0)
		}else{
			this.setDarkBg(true)
		}
	}
	
	// No other changes are needed below this line.
	// The rest of the file can remain as it is in your project.
	// ... (rest of the original view.js code)
}

