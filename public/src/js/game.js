class Game{
	constructor(...args){
		this.init(...args)
	}
	init(controller, selectedSong, songData){
		this.controller = controller
		this.selectedSong = selectedSong
		this.songData = songData
		this.elapsedTime = 0
		this.currentCircle = -1
		this.currentEvent = 0
		this.updateCurrentCircle()
		this.combo = 0
		this.rules = new GameRules(this)
		this.globalScore = {
			points: 0,
			good: 0,
			ok: 0,
			bad: 0,
			maxCombo: 0,
			drumroll: 0,
			gauge: 0,
			title: selectedSong.title,
			difficulty: this.rules.difficulty
		}
		var combo = this.songData.circles.filter(circle => {
			var type = circle.type
			return (type === "don" || type === "ka" || type === "daiDon" || type === "daiKa") && (!circle.branch || circle.branch.active)
		}).length
		this.soulPoints = this.rules.soulPoints(combo)
		this.paused = false
		this.started = false
		this.mainMusicPlaying = false
		this.musicFadeOut = 0
		this.fadeOutStarted = false
		this.currentTimingPoint = 0
		this.branchNames = ["normal", "advanced", "master"]
		this.resetSection()
		this.gameLagSync = !this.controller.touchEnabled && !(/Firefox/.test(navigator.userAgent))
		
		assets.songs.forEach(song => {
			if(song.id == selectedSong.folder){
				this.mainAsset = song.sound
			}
		})

		// --- MODIFICATION START ---
		// This variable will track the Go-Go Time state
		this.isGogo = false;
		
		// Find the visual metadata for the current song, or use the default
		let songVisuals = assets.songVisuals.find(v => v.songId === this.selectedSong.id);
		const defaultVisuals = assets.songVisuals.find(v => v.isDefault === true);

		if (!songVisuals) {
			songVisuals = {}; // Create an empty object if no specific entry is found
		}

		// Use song-specific assets, falling back to the default assets
		const background = songVisuals.background || defaultVisuals.background;
		const feverCrowd = songVisuals.feverCrowd || defaultVisuals.feverCrowd;
		this.chibiAssets = songVisuals.chibi || defaultVisuals.chibi;

		let dancer;
		if (songVisuals.dancer) {
			// Use the song's specific dancer
			dancer = songVisuals.dancer;
		} else if (defaultVisuals.randomDancers && defaultVisuals.randomDancers.length > 0) {
			// Pick a random dancer from the default list
			const randomIndex = Math.floor(Math.random() * defaultVisuals.randomDancers.length);
			dancer = defaultVisuals.randomDancers[randomIndex];
		}

		// Tell the view to set up all the assets for this song
		this.view.setDancer(dancer);
		this.view.setBackground(background);
		this.view.setFever(feverCrowd);
		// --- MODIFICATION END ---
	}

	run(){
		this.timeForDistanceCircle = 2500
		this.initTiming()
		this.view = this.controller.view
	}
	initTiming(){
		// Date when the chrono is started (before the game begins)
		var firstCircle = this.songData.circles[0]
		if(this.controller.calibrationMode){
			var offsetTime = 0
		}else{
			var offsetTime = Math.max(0, this.timeForDistanceCircle - (firstCircle ? firstCircle.ms : 0)) |0
		}
		if(this.controller.multiplayer){
			var syncWith = this.controller.syncWith
			var syncCircles = syncWith.game.songData.circles
			var syncOffsetTime = Math.max(0, this.timeForDistanceCircle - syncCircles[0].ms) |0
			offsetTime = Math.max(offsetTime, syncOffsetTime)
		}
		this.elapsedTime = -offsetTime
		// The real start for the game will start when chrono will reach 0
		this.startDate = Date.now() + offsetTime
	}

	update(){
		this.updateTime()
		// Main operations
		this.updateCirclesStatus()
		this.checkPlays()

		// --- MODIFICATION START ---
		const currentNote = this.songData.circles[this.currentCircle];
		if (currentNote) {
			const isCurrentlyGogo = currentNote.gogoTime;
			// Check if the Go-Go state has changed
			if (isCurrentlyGogo && !this.isGogo) {
				this.isGogo = true;
				this.view.startGogoTime();
			} else if (!isCurrentlyGogo && this.isGogo) {
				this.isGogo = false;
				this.view.stopGogoTime();
			}
		}
		// --- MODIFICATION END ---

		// Event operations
		this.whenFadeoutMusic()
		if(this.controller.multiplayer !== 2){
			this.whenLastCirclePlayed()
		}
	}
	
	updateGlobalScore(score, multiplier, gogoTime){
		// Circle score
		switch(score){
			case 450:
				this.globalScore.good++
				this.globalScore.gauge += this.soulPoints.good
				break
			case 230:
				this.globalScore.ok++
				this.globalScore.gauge += this.soulPoints.ok
				break
			case 0:
				this.globalScore.bad++
				this.globalScore.gauge += this.soulPoints.bad
				break
		}
		if (this.songData.scoremode) { 
			switch (score) {
				case 450:
					score = this.songData.scoreinit;
					break;
				case 230:
					score = Math.floor(this.songData.scoreinit / 2);
					break;
			}
		}
		// Gauge update
		if(this.globalScore.gauge < 0){
			this.globalScore.gauge = 0
		}else if(this.globalScore.gauge > 10000){
			this.globalScore.gauge = 10000
		}
		// Points update
		if (this.songData.scoremode == 2) {
			var diff_mul = 0;
			if (this.combo >= 100) {
				diff_mul = 8;
			} else if (this.combo >= 50) {
				diff_mul = 4;
			} else if (this.combo >= 30) {
				diff_mul = 2;
			} else if (this.combo >= 10) {
				diff_mul = 1;
			}
			score += this.songData.scorediff * diff_mul;
		} else { 
			score += Math.max(0, Math.floor((Math.min(this.combo, 100) - 1) / 10) * (this.songData.scoremode ? this.songData.scorediff : 100));
		}
		
		if(gogoTime){
			multiplier *= 1.2
		}
		this.globalScore.points += Math.floor(score * multiplier / 10) * 10
		
		// --- MODIFICATION START ---
		const isClear = this.globalScore.gauge >= this.rules.gaugeClear * 10000;
		this.view.updateBackgroundState(isClear);
		// --- MODIFICATION END ---
	}

	whenFadeoutMusic(){
		var started = this.fadeOutStarted
		if(started){
			var ms = this.elapsedTime
			var duration = this.mainAsset ? this.mainAsset.duration : 0
			var musicDuration = duration * 1000 - this.controller.offset
			if(this.musicFadeOut === 0){
				if(this.controller.multiplayer === 1){
					var obj = this.getGlobalScore()
					obj.name = account.loggedIn ? account.displayName : null
					p2.send("gameresults", obj)
				}
				this.musicFadeOut++
			}else if(this.musicFadeOut === 1 && ms >= started + 1600){
				this.controller.gameEnded()
				if(!p2.session && this.controller.multiplayer === 1){
					p2.send("gameend")
				}
				this.musicFadeOut++
			}else if(this.musicFadeOut === 2 && (ms >= Math.max(started + 8600, Math.min(started + 8600 + 5000, musicDuration + 250)))){
				// --- MODIFICATION START ---
				// This is where the results screen is triggered.
				// We tell the view to show the chibi animation.
				this.view.showResultsChibi(this.globalScore.gauge >= this.rules.gaugeClear * 10000, this.chibiAssets);
				// --- MODIFICATION END ---
				this.controller.displayResults()
				this.musicFadeOut++
			}else if(this.musicFadeOut === 3 && (ms >= Math.max(started + 9600, Math.min(started + 9600 + 5000, musicDuration + 1250)))){
				this.controller.clean()
				if(this.controller.scoresheet){
					this.controller.scoresheet.startRedraw()
				}
			}
		}
	}
	
	// No other changes are needed below this line.
	// The rest of the file can remain as it is in your project.
	// ... (rest of the original game.js code)
}

