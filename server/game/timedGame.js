const Globals = require('../globals');

class TimedGame {
    constructor({turn_time, io, room_info, room_update_fn, game_end_callback}) {
        this.game_opts = {
            timer: turn_time, //in ms!
            teams: false,
        };
        this._io = io;
        this._room_info = room_info;
        this._room_update_fn = room_update_fn;
        this._defeat_timeout = null;
        this._default_winner = 'No one';
        //to handle necessary outside function calls on game end
        this._game_end_callback = game_end_callback;
    }

    /*---------------------------------------------------------------------*/

    processNewGameOpts(opts) {
        const post_processing = [];
        this._processNewTeamOpt(opts, post_processing);
        this._setGameOpts(opts);
        post_processing.forEach(f => {
            f();
        });
    }

    /*---------------------------------------------------------------------*/

    _processNewTeamOpt({teams: new_teams_val}, post_processing) {
        if (new_teams_val === undefined) return; //not all options have to be set
        const old_teams_val = this.game_opts.teams;
        if (old_teams_val && !new_teams_val) { //teams option becomes disabled
            post_processing.push(() => {
                this._room_info.iteratePlayerSockets(socket => {
                    this._assignTeamToPlayer(socket);
                });
            });
        }
    }

    /*---------------------------------------------------------------------*/

    _setGameOpts(opts) {
        Object.entries(opts).forEach(([key, val]) => {
            this.game_opts[key] = val;
        });
    }

    /*---------------------------------------------------------------------*/

    addPlayer(socket) {
        this.subscribeSocket(socket);
        this._assignTeamToPlayer(socket);
    }

    /*---------------------------------------------------------------------*/

    /**
     * Extend by children
     */
    subscribeSocket(socket) {
        socket.on('process-game-input', input => {
            //game input only processed from active player
            if (this._room_info.isPlayerActivePlayer(socket.user_id)) {
                this.handleGameInput(input);
            }
        });
    }

    /*---------------------------------------------------------------------*/

    /**
     * Override by children
     */
    handleGameInput(input) {
    }

    /*---------------------------------------------------------------------*/

    _assignTeamToPlayer(socket) {
        if (this.game_opts.teams) {
            socket.game_state.team = this._room_info.getFreeTeamId();
        } else {
            //slots start are 0-indexed, teams should start at 1
            socket.game_state.team = this._room_info.findSocketSlotNumber(socket.user_id)+1;
        }
    }

    /*---------------------------------------------------------------------*/

    start() {
        //mark the room as active (for room update in client)
        this._room_info.setActive();
        this.handleGameStart();
        //start the timer (internally and for client)
        this._timeStep();
    }

    /*---------------------------------------------------------------------*/

    /**
     * Extend by children
     */
    handleGameStart() {
        //create data structures for teams if necessary
        if (this.game_opts.teams) {
            this._room_info.establishTeamOrder();
        }
    }

    /*---------------------------------------------------------------------*/

    _timeStep() {
        if (this.canGameContinue()) {
            const next_sockets = this.getNextPlayers();
            if (!next_sockets) {
                this._timeStepEndGame();
            } else {
                this._timeStepContinueGame(next_sockets);
            }
        } else {
            this._timeStepEndGame();
        }
    }

    /*---------------------------------------------------------------------*/

    _timeStepContinueGame(next_sockets) {
        //update room info
        this._setCurrentPlayers(next_sockets);
        this._room_update_fn();
        //send further signals
        this._emitNextActivePlayers(next_sockets);
        this._emitTimerStart();
        this._defeat_timeout = setTimeout(() => {
            //handle player defeat
            this._setPlayersDefeated(next_sockets);
            this._room_update_fn();
            //recursively call time step
            this._timeStep();
        }, this.game_opts.timer);
    }

    /*---------------------------------------------------------------------*/

    _timeStepEndGame() {
        //cleanup own data structures
        this.handleGameEnd();
        //announce game end to client + winner name
        const winner_sockets = this.getWinners();
        this._addWinToWinners(winner_sockets);
        this._emitWinEvents(winner_sockets);
        //cleanup room info
        this._room_info.setInactive();
        this._room_update_fn();
        if (this._game_end_callback) {
            this._game_end_callback();
        }
    }

    /*---------------------------------------------------------------------*/

    /**
     * Override further conditions by children
     */
    canGameContinue() {
        if (this.game_opts.teams) {
            return this._room_info.checkForMinimumNumberOfLiveTeams(2);
        } else {
            return this._room_info.checkForMinimumNumberOfLivePlayers(2);
        }
    }

    /*---------------------------------------------------------------------*/

    /**
     * Override by children
     */
    getNextPlayers() {
        if (this.game_opts.teams) {
            return this._room_info.getNextTeam();
        } else {
            const next_socket = this._room_info.getNextPlayer();
            if (!next_socket) {
                return null;
            } else {
                return [next_socket];
            }
        }
    }

    /*---------------------------------------------------------------------*/

    _setCurrentPlayers(next_sockets) {
        //transform sockets to array of user ids
        const user_ids = [];
        next_sockets.forEach(socket => {
            user_ids.push(socket.user_id);
        });
        //set players as current player
        this._room_info.setPlayersAsCurrentPlayer(user_ids);
    }

    /*---------------------------------------------------------------------*/

    _setPlayersDefeated(next_sockets) {
        next_sockets.forEach(socket => {
            this._room_info.setPlayerDefeated(socket.user_id);
        });
    }

    /*---------------------------------------------------------------------*/

    /**
     * Override by children
     */
    handleGameEnd() {
    }

    /*---------------------------------------------------------------------*/

    /**
     * Override by children
     */
    getWinners() {
        if (this.game_opts.teams) {
            const winner_socket = this._room_info.getFirstPlayerAlive();
            if (!winner_socket) {
                return null;
            }
            const winner_team = winner_socket.game_state.team;
            return this._room_info.findAllPlayersOfTeam(winner_team);
        } else {
            const winner_socket = this._room_info.getFirstPlayerAlive();
            if (!winner_socket) {
                return null;
            }
            return [winner_socket];
        }
    }

    /*---------------------------------------------------------------------*/

    _addWinToWinners(winner_sockets) {
        if (!winner_sockets) return;
        winner_sockets.forEach(winner_socket => {
            this._room_info.addWinToPlayer(winner_socket.user_id);
        });
    }

    /*---------------------------------------------------------------------*/

    /**
     * Override by children
     */
    findWinnerName(winner_sockets) {
        let winner_name;
        if (this.game_opts.teams) {
            if (winner_sockets && winner_sockets.length) {
                winner_name = `Team ${winner_sockets[0].game_state.team}`;
            }
        } else {
            if (winner_sockets && winner_sockets.length) {
                winner_name = winner_sockets[0].shown_name;
            }
        }
        return winner_name ? winner_name : this._default_winner;
    }

    /*---------------------------------------------------------------------*/

    /**
     * Timed game has no notion of when a player succeeds in the game. This function
     * consequently is called in extended classes only.
     */
    _handlePlayerSuccess() {
        if (this._defeat_timeout) {
            clearTimeout(this._defeat_timeout);
        }
        this._timeStep();
    }

    /*---------------------------------------------------------------------*/

    _emitWinEvents(winner_sockets) {
        const winner_name = this.findWinnerName(winner_sockets);
        this._emitGameEnd();
        this._emitWinnerAnnouncement(winner_name);
    }

    /*---------------------------------------------------------------------*/

    _emitNextActivePlayers(player_sockets) {
        const next_player_info = {
            is_team: this.game_opts.teams,
            team: this.game_opts.teams
                ? `Team ${player_sockets[0].game_state.team}`
                : undefined,
            players: [],
        };
        player_sockets.forEach(player_socket => {
            next_player_info.players.push({
                name: player_socket.shown_name,
                user_id: player_socket.user_id,
            });
        });
        this._io.in(this._room_info.name).emit('active-player-change', next_player_info);
    }

    /*---------------------------------------------------------------------*/

    _emitTimerStart() {
        this._io.in(this._room_info.name).emit('start-timer', this.game_opts.timer);
    }

    /*---------------------------------------------------------------------*/

    _emitGameEnd() {
        this._io.in(this._room_info.name).emit('game-end');
    }

    /*---------------------------------------------------------------------*/

    _emitWinnerAnnouncement(winner_name) {
        const winner_msg = winner_name + Globals.game_text.win_suffix;
        this._io.in(this._room_info.name).emit('announce-winner', winner_msg);
    }
}

module.exports = TimedGame;