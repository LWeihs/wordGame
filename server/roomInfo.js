const Globals = require('./globals');

class RoomInfo {
    constructor(room_name, max_players, make_private) {
        //public variables
        this.name = room_name;
        this.private = !!make_private; //can be undefined as param

        //private variables
        this._game_active = false;
        this._max_players = max_players;
        this._players = new Array(max_players).fill(null);
        this._active_players = 0;
        this._ordered_teams = null; //filled on game start
        //cursors for iteration
        this._cur_player_cursor = null; //iterates players
        this._cur_team_cursor = null; //iterates teams
    }

    /*---------------------------------------------------------------------*/

    isActive() {
        return this._game_active;
    }

    /*---------------------------------------------------------------------*/

    isEmpty() {
        return this._active_players === 0;
    }

    /*---------------------------------------------------------------------*/

    containsMultiplePlayers() {
        return this._active_players > 1;
    }

    /*---------------------------------------------------------------------*/

    containsMultipleTeams() {
        return this.checkForMinimumNumberOfTeams(2);
    }

    /*---------------------------------------------------------------------*/

    canStartGame(players_are_teams = false) {
        const res = {
            can_start: true,
            error_msg: '',
        };
        const set_error = (error_msg) => {
            res.can_start = false;
            res.error_msg = error_msg;
        };
        //check if game is currently going on
        if (this._game_active) {
            set_error(Globals.game_text.filler);
            return res;
        }
        //a single player can not start a game
        if (!this.containsMultiplePlayers()) {
            set_error(Globals.game_text.idle_only_one_player);
            return res;
        }
        //check if any player is not yet ready
        for (const socket of this._players) {
            if (socket && !socket.game_state.ready) {
                set_error(Globals.game_text.idle_awaiting_ready);
                return res;
            }
        }
        //all players can not be in the same team
        if (players_are_teams && !this.containsMultipleTeams()) {
            set_error(Globals.game_text.idle_only_one_team);
            return res;
        }
        //no reason found not to start game, return positive response
        return res;
    }

    /*---------------------------------------------------------------------*/

    canAddPlayer() {
        return this._active_players+1 <= this._max_players;
    }

    /*---------------------------------------------------------------------*/

    isPlayerActivePlayer(user_id) {
        for (const socket of this._players) {
            if (socket && socket.user_id === user_id) {
                return socket.game_state.is_current_player;
            }
        }
        return false;
    }

    /*---------------------------------------------------------------------*/

    hasActivePlayer() {
        for (const socket of this._players) {
            if (socket && socket.game_state.is_current_player) return true;
        }
        return false;
    }

    /*---------------------------------------------------------------------*/

    isTeamAlive(team_id) {
        for (const socket of this._players) {
            if (socket && socket.game_state.team === team_id) {
                return socket.game_state.alive;
            }
        }
        return false;
    }

    /*---------------------------------------------------------------------*/

    checkForMinimumNumberOfPlayers(min, check_fn) {
        let no_teams = 0;
        for (const socket of this._players) {
            if (socket && (!check_fn || check_fn(socket))) {
                no_teams++;
                if (no_teams === min) {
                    return true;
                }
            }
        }
        return false;
    }

    /*---------------------------------------------------------------------*/

    checkForMinimumNumberOfLivePlayers(min) {
        return this.checkForMinimumNumberOfPlayers(min, socket => {
            return socket.game_state.alive;
        });
    }

    /*---------------------------------------------------------------------*/

    checkForMinimumNumberOfTeams(min, check_fn) {
        let no_teams = 0;
        const teams_found = new Set();
        for (const socket of this._players) {
            if (socket && !teams_found.has(socket.game_state.team)
                && (!check_fn || check_fn(socket))) {
                no_teams++;
                if (no_teams === min) {
                    return true;
                }
                teams_found.add(socket.game_state.team);
            }
        }
        return false;
    }

    /*---------------------------------------------------------------------*/

    checkForMinimumNumberOfLiveTeams(min) {
        return this.checkForMinimumNumberOfTeams(min, socket => {
            return socket.game_state.alive;
        });
    }

    /*---------------------------------------------------------------------*/

    setActive() {
        this._game_active = true;
    }

    /*---------------------------------------------------------------------*/

    setInactive() {
        this._game_active = false;
        //reset players' socket fields
        this._restoreInitialPlayerGameState();
        //reset cursors
        this._cur_player_cursor = null;
        this._cur_team_cursor = null;
    }

    /*---------------------------------------------------------------------*/

    addPlayer(socket) {
        if (!this.canAddPlayer()) return;

        for (let i=0; i<this._max_players; ++i) {
            if (!this._players[i]) { //write into first empty slot
                this._players[i] = socket;
                break;
            }
        }
        this._active_players++;
    }

    /*---------------------------------------------------------------------*/

    removePlayer(user_id) {
        for (let i=0; i<this._max_players; ++i) {
            const socket = this._players[i];
            if (socket === undefined) {
                continue;
            }
            if (socket.user_id === user_id) {
                this._players[i] = undefined;
                this._active_players--;
                break;
            }
        }
    }

    /*---------------------------------------------------------------------*/

    getFirstPlayer() {
        if (this._active_players === 0) return null;
        for (const socket of this._players) {
            if (socket) {
                return socket;
            }
        }
        return null; //default case, should not happen in practice
    }

    /*---------------------------------------------------------------------*/

    getFirstPlayerAlive() {
        for (const socket of this._players) {
            if (socket && socket.game_state.alive) {
                return socket;
            }
        }
        return null; //can happen if last live player(s) leave the room
    }

    /*---------------------------------------------------------------------*/

    getRoomLead() {
        if (this._active_players === 0) return null;
        for (const socket of this._players) {
            if (socket && socket.is_room_lead) {
                return socket;
            }
        }
        return null; //default case, should not happen in practice
    }

    /*---------------------------------------------------------------------*/

    findAllPlayersOfTeam(team_id) {
        const sockets = [];
        this.iteratePlayerSockets(socket => {
            if (socket.game_state.team === team_id) {
                sockets.push(socket);
            }
        });
        return sockets;
    }

    /*---------------------------------------------------------------------*/

    getFreeTeamId() {
        const taken_teams = new Set();
        this._players.forEach(socket => {
            if (socket && socket.game_state.team !== undefined) {
                taken_teams.add(socket.game_state.team);
            }
        });
        let next = 1;
        while (taken_teams.has(next)) {
            next++;
        }
        return next;
    }

    /*---------------------------------------------------------------------*/

    getPlayerInfo() {
        //apply any necessary manipulations for better readability etc.
        this._applySameNameNumberingToPlayerArray();
        //transform player array to format client uses
        return this._translatePlayersToOutput();
    }

    /*---------------------------------------------------------------------*/

    getNextPlayer() {
        //find first candidate index
        const prev_idx = this._cur_player_cursor;
        let start_idx;
        if (prev_idx === null) {
            start_idx = 0;
        } else {
            start_idx = this._advancePlayerIndex(prev_idx);
        }
        //iterate players, find next in line which is alive
        let next_idx = start_idx;
        do {
            const socket = this._players[next_idx];
            if (socket && socket.game_state.alive) {
                this._cur_player_cursor = next_idx;
                return socket;
            }
            next_idx = this._advancePlayerIndex(next_idx);
        } while (next_idx !== prev_idx && next_idx !== start_idx);
        return null; //might happen (very rarely) if player leaves during time step
    }

    /*---------------------------------------------------------------------*/

    getNextTeam() {
        const prev_idx = this._cur_team_cursor;
        let start_idx;
        if (prev_idx === null) {
            start_idx = 0;
        } else {
            start_idx = this._advanceTeamIndex(prev_idx);
        }

        //iterate teams, find next in line which is alive
        let next_idx = start_idx;
        do {
            const next_team_id = this._ordered_teams[next_idx];
            if (this.isTeamAlive(next_team_id)) {
                this._cur_team_cursor = next_idx;
                return this.findAllPlayersOfTeam(next_team_id);
            }
            next_idx = this._advanceTeamIndex(next_idx);
        } while (next_idx !== prev_idx && next_idx !== start_idx);
        return null;
    }

    /*---------------------------------------------------------------------*/

    setPlayersAsCurrentPlayer(user_ids) {
        const user_id_set = new Set(user_ids);
        this._players.forEach(socket => {
            if (socket) {
                socket.game_state.is_current_player = user_id_set.has(socket.user_id);
            }
        });
    }

    /*---------------------------------------------------------------------*/

    setPlayerDefeated(user_id) {
        const socket = this._findSocketById(user_id);
        if (socket) {
            socket.game_state.alive = false;
        }
    }

    /*---------------------------------------------------------------------*/

    addWinToPlayer(user_id) {
        const socket = this._findSocketById(user_id);
        if (socket) {
            this._findSocketById(user_id).game_state.wins++;
        }
    }

    /*---------------------------------------------------------------------*/

    findSocketSlotNumber(user_id) {
        for (let i=0; i<this._players.length; ++i) {
            const socket = this._players[i];
            if (socket && socket.user_id === user_id) return i;
        }
        return -1; //should never happen in practice
    }

    /*---------------------------------------------------------------------*/

    /**
     * To be called on game start
     */
    establishTeamOrder() {
        this._ordered_teams = [];
        const found_teams = new Set();
        this.iteratePlayerSockets(socket => {
            if (!found_teams.has(socket.game_state.team)) {
                found_teams.add(socket.game_state.team);
                this._ordered_teams.push(socket.game_state.team);
            }
        });
    }

    /*---------------------------------------------------------------------*/

    iteratePlayerSockets(callback) {
        this._players.forEach(socket => {
            if (socket) {
                callback(socket);
            }
        });
    }

    /*---------------------------------------------------------------------*/

    _findSocketById(user_id) {
        for (const socket of this._players) {
            if (socket && socket.user_id === user_id) return socket;
        }
        return null;
    }

    /*---------------------------------------------------------------------*/

    _restoreInitialPlayerGameState() {
        this._players.forEach(socket => {
            if (socket) {
                socket.game_state.alive = true;
                socket.game_state.is_current_player = false;
                if (!socket.is_room_lead) {
                    socket.game_state.ready = false;
                }
            }
        });
    }

    /*---------------------------------------------------------------------*/

    _applySameNameNumberingToPlayerArray() {
        //first pass: count name occurrences
        const name_count = {};
        this._players.forEach(socket => {
            if (!socket) return; //ignore slots which are not taken
            if (!name_count.hasOwnProperty(socket.name)) {
                name_count[socket.name] = 1;
            } else {
                ++name_count[socket.name];
            }
        });
        //second pass: adjust shown_name property of sockets where necessary
        const next_numbers = {};
        this._players.forEach(socket => {
            if (!socket) return;
            if (name_count[socket.name] > 1) {
                if (!next_numbers.hasOwnProperty(socket.name)) {
                    next_numbers[socket.name] = 2;
                    socket.shown_name = `${socket.name}#1`;
                } else {
                    socket.shown_name = `${socket.name}#${next_numbers[socket.name]}`;
                    ++next_numbers[socket.name];
                }
            } else {
                socket.shown_name = socket.name;
            }
        });
    }

    /*---------------------------------------------------------------------*/

    _translatePlayersToOutput() {
        const output = [];
        this._players.forEach(socket => {
            if (!socket) {
                output.push(null);
            } else {
                output.push({
                    id: socket.user_id,
                    name: socket.shown_name, //contains processed name with number
                    is_current_player: socket.game_state.is_current_player,
                    is_room_lead: socket.is_room_lead,
                    ready: socket.game_state.ready,
                    alive: socket.game_state.alive,
                    wins: socket.game_state.wins,
                    team: socket.game_state.team,
                });
            }
        });
        return output;
    }

    /*---------------------------------------------------------------------*/

    _advancePlayerIndex(i) {
        return i === this._max_players ? 0 : i+1;
    }

    /*---------------------------------------------------------------------*/

    _advanceTeamIndex(i) {
        return i === this._ordered_teams.length ? 0 : i+1;
    }
}

module.exports = RoomInfo;