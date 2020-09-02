'use strict';

//node modules
const socketIo = require('socket.io');
const crypto = require('crypto');
//local imports
const Globals = require('./globals');
const RoomInfo = require('./roomInfo');
const NameGenerator = require('./nameGenerator');
const SemanticAnalyser = require('./semanticComponentAnalyser');
const WordGame = require('./game/wordGame');

class GameServer {
    /**
     * Set up the server, set port.
     *
     * @param server - express server or port number
     */
    constructor(server) {
        this._server = server;
        //create name generator
        const list_locations = {};
        Object.entries(Globals.rnd_name_lists).forEach(([key, file_name]) => {
            if (key === 'path') return;
            list_locations[key] = `${Globals.rnd_name_lists.path}/${file_name}`;
        });
        this._name_generator = new NameGenerator(list_locations);
        //logged information
        this._last_whispered_by = {}; //user_id to user_id
        this._room_infos = {}; //rooms to boolean
        this._room_games = {}; //rooms to WordGame
    }

    /*---------------------------------------------------------------------*/

    /**
     * Start the server, watch for specified events.
     */
    start() {
        this._initializeSocketIo();

        console.log(`Game server running!`);
    }

    /*---------------------------------------------------------------------*/

    /**
     * Set up the socket.IO server. Watches specified events.
     *
     * @private
     */
    _initializeSocketIo() {
        this._io = socketIo(this._server);

        //react to different types of events (client connection), ALL clients
        this._io.on('connection', socket => {
            let {source} = socket.handshake.query;
            switch (source) {
                case 'lobby':
                    this._connectSocketLobby(socket);
                    break;
                case 'game_room':
                    this._connectSocketGameRoom(socket);
                    break;
            }
        });
    }

    /*---------------------------------------------------------------------*/

    _connectSocketLobby(socket) {
        this._setSocketHandlersLobby(socket);
    }

    /*---------------------------------------------------------------------*/

    _setSocketHandlersLobby(socket) {
        socket.on('attempt-redirect-to-game', ({join_type, room: roomName, make_private}) => {
            const redirect_info = {
                room_name: undefined,
                make_private: false,
            };
            switch (join_type) {
                case 'random':
                    //try to find a room with remaining player slots which is not private
                    roomName = this._findRoomWithRemainingSlots((room_info) => {
                        return !room_info.private;
                    });
                    //if no such room exists, prompt server to create new room
                    if (!roomName) {
                        roomName = this._name_generator.generate('room', 'name');
                    }
                    break;
                case 'specific':
                    if (!roomName) {
                        socket.emit('redirect-error', Globals.error_messages.missing_room_name);
                        return;
                    }
                    if (!this._doesRoomExist(roomName)) {
                        socket.emit('redirect-error', Globals.error_messages.room_does_not_exist);
                        return;
                    }
                    break;
                case 'new':
                    if (!roomName) {
                        socket.emit('redirect-error', Globals.error_messages.missing_room_name);
                        return;
                    }
                    if (this._doesRoomExist(roomName)) {
                        socket.emit('redirect-error', Globals.error_messages.room_exists);
                        return;
                    }
                    //no errors, set privacy setting
                    redirect_info.make_private = make_private;
                    break;
            }
            //no errors, permit redirect
            redirect_info.room_name = roomName;
            socket.emit('permit-redirect', redirect_info);
        });
    }

    /*---------------------------------------------------------------------*/

    _connectSocketGameRoom(socket) {
        this._handleConnection(socket);
        this._setSocketHandlersGameRoom(socket);
    }

    /*---------------------------------------------------------------------*/

    _setSocketHandlersGameRoom(socket) {
        //RESERVED EVENTS

        //remove traces of disconnected socket
        socket.on('disconnect', () => {
            this._handleDisconnect(socket);
        });

        //SELF-DEFINED EVENTS

        //handle continuous room connection attempts from socket
        socket.on('retry-connect', () => {
            this._attemptRoomJoin(socket);
        });
        //handle chat input send by socket
        socket.on('process-chat-input', msg => {
            this._processChatMessage(socket, msg);
        });
        //handle team switching
        socket.on('change-team', team_id => {
            this._handleTeamSwitch(socket, team_id);
        });
        //handle ready state change send by socket
        socket.on('change-ready-state', () => {
            this._handleReadyStateChange(socket);
        });
        //handle game start request send by socket
        socket.on('start-game', () => {
            this._handleGameStart(socket);
        });
        //handle game option change requested by room lead
        socket.on('change-game-option', opts_texts => {
            this._setRoomGameOpts(socket.room, opts_texts);
        });
    }

    /*---------------------------------------------------------------------*/

    _handleConnection(socket) {
        //set all relevant fields indented to be used here
        this._initiallyStatSocket(socket);

        //extend socket properties based on received query parameters
        let {id, name, room, make_private} = socket.handshake.query;

        //set unique ID for socket, notify client if new ID is generated
        if (!id) {
            id = this._createID();
            socket.emit('receive-id', id);
        }
        socket.user_id = id;

        //set socket name, potentially generate one if name was left empty
        socket.name = name
            ? name
            : this._name_generator.generate('player');

        //send important information back to the client
        const user_info = {
            id: id,
        };
        socket.emit('initial-connection-established', user_info);

        //handle room joining
        if (room) {
            socket.target_room = room;
            this._attemptRoomJoin(socket, make_private);
        }

        //socket fields all created, now prepare logging objects
        this._initiateSocketLogging(socket);
    }

    /*---------------------------------------------------------------------*/

    _attemptRoomJoin(socket, make_private) {
        const roomName = socket.target_room;
        let room_info = this._getRoomInfo(roomName);
        if (!room_info) { //room does not exist yet, apply privacy setting here
            //create tracked room objects
            this._handleRoomCreation(roomName, make_private);
            //first user to join room gets lead
            this._makeSocketRoomLead(socket);
        } else { //room exist, check if joining is permitted
            if (room_info.isActive()) {
                socket.emit('room-join-rejected', Globals.error_messages.active_room);
                return;
            }
            if (!room_info.canAddPlayer()) {
                socket.emit('room-join-rejected', Globals.error_messages.full_room);
                return;
            }
        }
        //room join is allowed to happen
        this._handleRoomJoin(socket, roomName);
    }

    /*---------------------------------------------------------------------*/

    _handleRoomCreation(roomName, make_private) {
        this._createRoomInfo(roomName, make_private);
        this._createRoomGame(roomName);
    }

    /*---------------------------------------------------------------------*/

    /**
     * Assumes that room already exists and is tracked internally.
     */
    _handleRoomJoin(socket, roomName) {
        //track socket in room info (must happen BEFORE player added to game)
        const room_info = this._getRoomInfo(roomName);
        room_info.addPlayer(socket);
        //add game relevant listeners to socket and assign team
        const room_game = this._getRoomGame(roomName);
        room_game.addPlayer(socket);

        //to client: provide critical style/layout info on accept
        const join_info = {
            max_players: Globals.game.max_players,
            no_remembered_words: Globals.game.no_remembered_words,
            is_private: room_info.private,
        };
        socket.emit('room-join-accepted', join_info);

        //finally, establish the actual room connection
        this._connectSocketToRoom(socket, roomName);
    }

    /*---------------------------------------------------------------------*/

    _handleRoomDestruction(roomName) {
        this._deleteRoomInfo(roomName);
        this._deleteRoomGame(roomName);
    }

    /*---------------------------------------------------------------------*/

    _makeSocketRoomLead(socket) {
        socket.is_room_lead = true;
        socket.game_state.ready = true;
        socket.emit('make-room-lead');
    }

    /*---------------------------------------------------------------------*/

    _handleDisconnect(socket) {
        if (socket.room) {
            const room_info = this._getRoomInfo(socket.room);
            room_info.removePlayer(socket.user_id);
            if (room_info.isEmpty()) { //close the room, stop logging room info
                this._handleRoomDestruction(socket.room);
            } else { //some players still remain in room
                //send leave notification
                this._emitLeaveMessageToChattersInRoom(socket.shown_name, socket.room);
                //elect new leader if necessary
                if (socket.is_room_lead) {
                    this._electNewRoomLeadForRoom(socket.room);
                }
                //let associated game handle potentially necessary turn skipping
                const room_game = this._getRoomGame(socket.room);
                room_game.handleDisconnect();
                //update player info for client
                this._updateRoom(socket.room);
            }
        }
        this._removeSocketLogging(socket);
    }

    /*---------------------------------------------------------------------*/

    _electNewRoomLeadForRoom(roomName) {
        const room_info = this._getRoomInfo(roomName);
        const first_player_socket = room_info.getFirstPlayer();
        this._makeSocketRoomLead(first_player_socket);
        this._emitOptionsToRoom(roomName, true);
    }

    /*---------------------------------------------------------------------*/

    _initiallyStatSocket(socket) {
        socket.user_id = '';
        socket.name = '';
        socket.shown_name = '';
        socket.target_room = ''; //intent to join room
        socket.room = ''; //actually joined room
        socket.is_room_lead = false;
        socket.game_state = {
            ready: false, //socket is not ready on initial join
            alive: true,
            is_current_player: false, //handled by roomInfo
            wins: 0,
            team: undefined,
        };
    }

    /*---------------------------------------------------------------------*/

    _initiateSocketLogging(socket) {
        this._last_whispered_by[socket.user_id] = '';
    }

    /*---------------------------------------------------------------------*/

    _logLastMessageBetweenSockets(senderId, targetId) {
        this._last_whispered_by[targetId] = senderId;
    }

    /*---------------------------------------------------------------------*/

    _removeSocketLogging(socket) {
        delete this._last_whispered_by[socket.user_id];
    }

    /*---------------------------------------------------------------------*/

    _createRoomInfo(roomName, make_private) {
        this._room_infos[roomName] = new RoomInfo(roomName, Globals.game.max_players,
            make_private);
    }

    /*---------------------------------------------------------------------*/

    _getRoomInfo(roomName) {
        return this._room_infos[roomName];
    }

    /*---------------------------------------------------------------------*/

    _doesRoomExist(roomName) {
        for (const existing_name of Object.keys(this._room_infos)) {
            if (roomName === existing_name) return true;
        }
        return false;
    }

    /*---------------------------------------------------------------------*/

    /**
     * Find the name of a room with remaining player slots.
     *
     * @param validator {function} - callback to apply to iterated RoomInfo
     * objects. Only returns names of RoomInfos for which the validator returns
     * true (optional)
     * @returns {null|string} - name of room with remaining player slots
     * @private
     */
    _findRoomWithRemainingSlots(validator) {
        for (const room_info of Object.values(this._room_infos)) {
            if ((!validator || validator(room_info)) && room_info.canAddPlayer()) {
                return room_info.name;
            }
        }
        return null; //no active room with remaining slots
    }

    /*---------------------------------------------------------------------*/

    _deleteRoomInfo(roomName) {
        delete this._room_infos[roomName];
    }

    /*---------------------------------------------------------------------*/

    _createRoomGame(roomName) {
        const room_info = this._getRoomInfo(roomName);
        this._room_games[roomName] = new WordGame({
            //TimedGame params
            turn_time: Globals.game.turn_time*1000,
            io: this._io,
            room_info: room_info,
            room_update_fn: () => {
                this._updateRoom(roomName);
            },
            game_end_callback: () => {
                this._emitOptionsToRoom(roomName, true);
            },
            //WordGame params
            lang: Globals.game.language,
            max_generated_len: Globals.game.max_len_start_word,
        });
    }

    /*---------------------------------------------------------------------*/

    _getRoomGame(roomName) {
        return this._room_games[roomName];
    }

    /*---------------------------------------------------------------------*/

    _setRoomGameOpts(roomName, opts_texts) {
        const opts = this._translateClientTextToGameOpts(opts_texts);
        const room_game = this._getRoomGame(roomName);
        //let game handle new options (setting + possible reactionary function calls)
        room_game.processNewGameOpts(opts);
        //update clients in room
        this._emitOptionsToRoom(roomName, false);
        this._updateRoom(roomName);
    }

    /*---------------------------------------------------------------------*/

    _deleteRoomGame(roomName) {
        delete this._room_games[roomName];
    }

    /*---------------------------------------------------------------------*/

    _createID() {
        return crypto.randomBytes(16).toString('hex');
    }

    /*---------------------------------------------------------------------*/

    _connectSocketToRoom(socket, roomName) {
        //callback fires only when user actually joined the room
        socket.join(roomName, () => {
            //note the joined room
            socket.room = roomName;
            //update options and chatter list (order important!)
            this._emitOptionsToRoom(roomName, true);
            this._updateRoom(socket.room);
            //notify other players in the room (call after room info updates shown name)
            this._emitJoinMessageToChattersInRoom(socket.shown_name, socket.room);
        });
    }

    /*---------------------------------------------------------------------*/

    _updateRoom(roomName) {
        //check if everyone is ready/game can be started
        this._emitStartAllowanceToRoomLead(roomName);
        //update chatter lists
        this._emitPlayerInfoToRoom(roomName);
        //update idle message
        const room_info = this._getRoomInfo(roomName);
        if (!room_info.isActive()) {
            this._sendCorrectIdleMessageToRoom(roomName);
        }
    }

    /*---------------------------------------------------------------------*/

    _emitStartAllowanceToRoomLead(roomName) {
        const room_info = this._getRoomInfo(roomName);
        const room_game = this._getRoomGame(roomName);
        const room_lead_socket = room_info.getRoomLead();
        const start_info = room_info.canStartGame(room_game.game_opts.teams);
        if (start_info.can_start) {
            room_lead_socket.emit('can-start-game');
        } else {
            room_lead_socket.emit('can-not-start-game');
        }
    }

    /*---------------------------------------------------------------------*/

    _emitPlayerInfoToRoom(roomName) {
        const room_info = this._getRoomInfo(roomName);
        const player_info = room_info.getPlayerInfo();
        this._io.in(roomName).emit('refresh-players', player_info);
    }

    /*---------------------------------------------------------------------*/

    _emitOptionsToRoom(roomName, force_override) {
        const room_game = this._getRoomGame(roomName);
        this._io.in(roomName).emit('refresh-options', room_game.game_opts, force_override);
    }

    /*---------------------------------------------------------------------*/

    _translateClientTextToGameOpts(opts_texts) {
        const opts = {};
        Object.entries(opts_texts).forEach(([key, val]) => {
            if (val === undefined || val === null) return; //skip empty values
            let opt_val;
            switch (key) {
                case 'teams':
                    opt_val = val === 'On';
                    break;
                case 'mode':
                    switch (val) {
                        case 'Last Letter':
                            opt_val = 'last_letter';
                            break;
                    }
                    break;
                default:
                    opt_val = val;
                    break;
            }
            opts[key] = opt_val;
        });
        return opts;
    }

    /*---------------------------------------------------------------------*/

    _processChatMessage(socket, raw_msg) {
        if (this._isMessageChatCommand(raw_msg)) {
            this._processChatCommand(socket, raw_msg);
        } else { //message is regular chat message
            const msg = this._constructRegularChatMessage(socket.name, raw_msg);
            this._emitMessageToChattersInRoom(socket.room, msg);
        }
    }

    /*---------------------------------------------------------------------*/

    _isMessageChatCommand(msg) {
        return msg[0] === '/';
    }

    /*---------------------------------------------------------------------*/

    _processChatCommand(socket, raw_msg) {
        //define logging of errors
        let error_info = {
            error: false,
            error_message: '',
        };
        const log_error = (error_msg) => {
            error_info.error = true;
            error_info.error_message = error_msg;
        };
        //process received message
        const semantic_analyser = new SemanticAnalyser(raw_msg);
        const command = semantic_analyser.findNext();
        let msg;
        switch (command) {
            case '/w':
                const recipient = semantic_analyser.findNext();
                msg = semantic_analyser.getRemainingMessage();
                this._processPrivateMessage(socket, recipient, msg, log_error);
                break;
            case '/r':
                msg = semantic_analyser.getRemainingMessage();
                this._processQuickResponse(socket, msg, log_error);
                break;
            default:
                log_error(`Invalid chat command: "${command}"`);
                break;
        }
        if (error_info.error) {
            const error_msg = this._constructSystemErrorMessage(error_info.error_message);
            this._sendSystemMessage(socket, error_msg);
        }
    }

    /*---------------------------------------------------------------------*/

    _processPrivateMessage(sender, recipient, msg, log_error) {
        if (!recipient) {
            log_error(`No whisper target given!`);
        } else {
            //match target exactly by its room and shown name
            const target = this._findSocketByRoomAndShownName(sender.room, recipient);
            if (!target) {
                log_error(`No such player: "${recipient}"`);
            } else {
                this._sendPrivateMessage(sender, target, msg);
                this._logLastMessageBetweenSockets(sender.user_id, target.user_id);
            }
        }
    }

    /*---------------------------------------------------------------------*/

    _processQuickResponse(sender, msg, log_error) {
        const last_whispered = this._last_whispered_by[sender.user_id];
        if (!last_whispered) {
            log_error('No one to respond to!');
            return;
        }
        const target = this._findSocketByUserId(last_whispered);
        if (!target || target.room !== sender.room) {
            log_error('Can not respond: Target can no longer be found in your room!');
            return;
        }
        this._sendPrivateMessage(sender, target, msg);
        this._logLastMessageBetweenSockets(sender.user_id, target.user_id);
    }

    /*---------------------------------------------------------------------*/

    _constructRegularChatMessage(sender, msg) {
        return `<strong>${sender}</strong>: ${msg}`;
    }

    /*---------------------------------------------------------------------*/

    _constructSystemErrorMessage(msg) {
        return `<span class="chat-error-message">${msg}</span>`;
    }

    /*---------------------------------------------------------------------*/

    _constructWhisperMessageSender(receiverName, msg) {
        const whisper_msg = `To [${receiverName}]: ${msg}`;
        return this._constructWhisperMessage(whisper_msg);
    }

    /*---------------------------------------------------------------------*/

    _constructWhisperMessageReceiver(senderName, msg) {
        const whisper_msg = `From [${senderName}]: ${msg}`;
        return this._constructWhisperMessage(whisper_msg);
    }

    /*---------------------------------------------------------------------*/

    _constructWhisperMessage(msg) {
        return `<span class="chat-whisper-message">${msg}</span>`;
    }

    /*---------------------------------------------------------------------*/

    _emitJoinMessageToChattersInRoom(userName, roomName) {
        const msg = `${userName} joined the room!`;
        this._emitMessageToChattersInRoom(roomName, msg);
    }

    /*---------------------------------------------------------------------*/

    _emitLeaveMessageToChattersInRoom(userName, roomName) {
        const msg = `${userName} left the room!`;
        this._emitMessageToChattersInRoom(roomName, msg);
    }

    /*---------------------------------------------------------------------*/

    _emitMessageToChattersInRoom(roomName, msg) {
        this._io.in(roomName).emit('receive-chat-message', msg);
    }

    /*---------------------------------------------------------------------*/

    _sendSystemMessage(socket, msg) {
        socket.emit('receive-chat-message', msg);
    }

    /*---------------------------------------------------------------------*/

    _sendPrivateMessage(sender, target, raw_msg) {
        //display whisper message for sender
        const sender_msg = this._constructWhisperMessageSender(target.shown_name, raw_msg);
        sender.emit('receive-chat-message', sender_msg);
        //send message to target
        const target_msg = this._constructWhisperMessageReceiver(sender.shown_name, raw_msg);
        target.emit('receive-chat-message', target_msg);
    }

    /*---------------------------------------------------------------------*/

    _sendCorrectIdleMessageToRoom(roomName) {
        const room_info = this._getRoomInfo(roomName);
        const room_game = this._getRoomGame(roomName);
        let {can_start, error_msg: idle_msg} = room_info.canStartGame(room_game.game_opts.teams);
        if (can_start) {
            const room_lead_name = room_info.getRoomLead().shown_name;
            idle_msg = Globals.game_text.idle_awaiting_start_prefix + room_lead_name +
                Globals.game_text.idle_awaiting_start_suffix;
        }
        this._updateIdleMessageInRoom(roomName, idle_msg);
    }

    /*---------------------------------------------------------------------*/

    _updateIdleMessageInRoom(roomName, msg) {
        this._io.in(roomName).emit('receive-idle-message', msg);
    }

    /*---------------------------------------------------------------------*/

    _handleTeamSwitch(socket, team_id) {
        if (Number.isInteger(team_id) && team_id >= 1) {
            socket.game_state.team = team_id;
        }
        this._updateRoom(socket.room);
    }

    /*---------------------------------------------------------------------*/

    _handleReadyStateChange(socket) {
        const ready_state = socket.game_state.ready;
        //change the ready state internally
        socket.game_state.ready = !ready_state;
        //let client react to ready state change
        if (ready_state) {
            socket.emit('set-not-ready');
        } else {
            socket.emit('set-ready');
        }
        //update player information in client
        this._updateRoom(socket.room);
    }

    /*---------------------------------------------------------------------*/

    _handleGameStart(socket) {
        //signify initial game starting to clients
        this._io.in(socket.room).emit('prepare-for-game-start');
        //create and start game instance
        const word_game = this._getRoomGame(socket.room);
        word_game.start(); //internally updates room after each time step
    }

    /*---------------------------------------------------------------------*/

    _findSocketByUserId(userId) {
        const potential_sockets = Object.values(this._io.sockets.connected);
        for (const socket of potential_sockets) {
            if (socket.user_id === userId) {
                return socket;
            }
        }
        return null;
    }

    /*---------------------------------------------------------------------*/

    _findSocketByRoomAndShownName(roomName, shownName) {
        const potential_sockets = Object.values(this._io.sockets.connected);
        for (const socket of potential_sockets) {
            if (socket.room === roomName && socket.shown_name === shownName) {
                return socket;
            }
        }
        return null;
    }
}

module.exports = {
    GameServer: GameServer,
};