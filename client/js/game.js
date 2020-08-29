import Globals from "./globals";
import disableSubmitAllForms from "./helpers/formDisable";
import BannerControls from "./game/bannerControls";
import ConnectionControls from "./game/connectionControls";
import PlayerListControls from "./game/playerListControls";
import GameControls from "./game/gameControls";
import TimerControls from "./game/timerControls";
import ChatControls from "./game/chatControls";
import OptionControls from "./game/optionControls";
import GameStartControls from "./game/gameStarting";

//log important information about the user (received on established server connection)
let user_info = {
    id: undefined,
    target_room: null,
    is_lead: false,
};
//log important information about the game's current option settings
let game_info = {
    teams_enabled: false,
    game_in_progress: false,
};

//preload images and keep reference in memory so they do not get garbage collected
const preloaded_images = {};

//instantiate the different page control classes
const banner_controls = new BannerControls();
const connection_controls = new ConnectionControls();
const player_list_controls = new PlayerListControls();
const game_controls = new GameControls();
const timer_controls = new TimerControls();
const chat_controls = new ChatControls();
const option_controls = new OptionControls();
const game_start_controls = new GameStartControls();

/*---------------------------------------------------------------------*/

function initialize() {
    //get room from url params
    const urlParams = new URLSearchParams(window.location.search);
    const room = urlParams.get('room');
    if (!room) {
        document.querySelector('#connect-message').innerHTML =
            'No room given! Cannot connect.';
        return;
    }
    const name = urlParams.get('userName');

    //disable form submits
    disableSubmitAllForms();

    //preload images mentioned in globals
    const preload_input = {};
    Object.entries(Globals.images).forEach(([img_key, img_file]) => {
        preload_input[img_key] = `${Globals.image_folder_path}/${img_file}`;
    });
    preloadImages(preload_input);

    //initialize page behavior
    initializePageControls();
    //establish socket connection (will connect to room if possible)
    initializeSocketIo(room, name);
}

/*---------------------------------------------------------------------*/

function preloadImages(img_refs) {
    Object.entries(img_refs).forEach(([img_key, img_src]) => {
        const img = new Image();
        img.src = img_src;
        preloaded_images[img_key] = img;
    });
}

/*---------------------------------------------------------------------*/

/**
 * All of this happens BEFORE socket connection is established. At this point,
 * all the client sees is a message telling him that connection is being made.
 * So, all page preparations are made here.
 */
function initializePageControls() {
    //connection handler
    connection_controls.init();

    //surrounding elements
    banner_controls.init();
    player_list_controls.initControls();

    //game elements
    timer_controls.init();
    game_controls.initControls();
    chat_controls.initControls();
    option_controls.initControls();

    //ready/start
    game_start_controls.initControls();
}

/*---------------------------------------------------------------------*/

/**
 * called exactly once when socket connection is first established.
 */
function processInitialPage() {
    option_controls.disableSettingChanging();
    game_start_controls.switchToRoomRegularUserState();
}

/*---------------------------------------------------------------------*/

/**
 * Called whenever page should be returned to pre/post game state
 */
function setPageToDefaultState() {
    //hide game elements while game is not ongoing
    timer_controls.clearTimerInterval();
    //hide game content, reset its various text fields
    game_controls.hideGameContent();
    game_controls.reset();
    //enable ready/start buttons
    if (!user_info.is_lead) {
        game_start_controls.enableReadyButton();
        game_start_controls.setButtonAsReadyButton();
    }
}

/*---------------------------------------------------------------------*/

/**
 * Called whenever page should be set to game state
 */
function setPageToGameState() {
    game_controls.unblockIdleMessageSetting();
    game_controls.clearIdleMessage();
    game_controls.showGameContent();
    game_start_controls.disableReadyButton();
    player_list_controls.protect_input = false;
}

/*---------------------------------------------------------------------*/

/**
 * Called on page load to establish connection to socket.io and to prepare
 * client-side socket events
 *
 * @param target_room - room to join. Must not be empty!
 * @param name - name to show for player. May be empty, is then randomized
 */
function initializeSocketIo(target_room, name) {
    let query = `source=game_room&room=${target_room}`;
    if (name) {
        query += `&name=${name}`;
    }
    user_info.target_room = target_room; //log target room
    const socket = io({
        transports: ['websocket'],
        upgrade: false,
        query: query
    });

    /* HANDLE EMITTED EVENTS FROM SERVER */

    initializeRoomInteractionEvents(socket);
    initializeReadyStateChanges(socket);
    initializeInformationRefreshing(socket);
    initializeGameEvents(socket);

    /* SET UP EMITTING OF EVENTS TO SERVER */

    player_list_controls.initSocket(socket);
    chat_controls.initSocketEvents(socket);
    game_controls.initSocketEvents(socket);
    game_start_controls.initSocketEvents(socket, user_info);
    option_controls.initSocketEvents(socket);
}

/*---------------------------------------------------------------------*/

function initializeRoomInteractionEvents(socket) {
    //handle initial connection (before room joining is decided)
    socket.on('initial-connection-established', server_user_info => {
        processInitialPage();
        setPageToDefaultState();
        user_info.id = server_user_info.id;
    });

    //connection handling (accept/reject join request)
    socket.on('room-join-accepted', join_info => {
        const {max_players, no_remembered_words} = join_info;
        //stop any further reconnection attempts (as connection is now achieved)
        connection_controls.stopOngoingConnectionAttempts();
        //set the room name on banner
        banner_controls.setRoomName(user_info.target_room);
        //dynamical creation of elements
        player_list_controls.scaleToPlayerNumber(max_players);
        game_controls.createPrevTypedDivs(no_remembered_words);
        //finally make game interface visible
        connection_controls.switchVisibilityToPageContent();
    });
    socket.on('room-join-rejected', error_msg => {
        connection_controls.setConnectMessage(error_msg);
        connection_controls.retryConnection(socket);
    });

    //become the room lead
    socket.on('make-room-lead', () => {
        option_controls.enableSettingChanging();
        game_start_controls.switchToRoomLeadState();
        //mark internally that player is room lead
        user_info.is_lead = true;
    });
}

/*---------------------------------------------------------------------*/

function initializeReadyStateChanges(socket) {
    //ready state changes
    socket.on('set-ready', () => {
        game_start_controls.setButtonAsCancelButton(); //client ready, button now cancels
    });
    socket.on('set-not-ready', () => {
        game_start_controls.setButtonAsReadyButton(); //client not ready, button makes ready
    });
    //ready state changes for room lead
    socket.on('can-start-game', () => {
        game_start_controls.enableStartButton();
    });
    socket.on('can-not-start-game', () => {
        game_start_controls.disableStartButton();
    });
}

/*---------------------------------------------------------------------*/

function initializeInformationRefreshing(socket) {
    //update the shown list of players
    socket.on('refresh-players', player_info_arr => {
        player_list_controls.updatePlayerList(user_info, game_info,
            player_info_arr);
    });

    //update the game options
    socket.on('refresh-options', (opts, force_override) => {
        game_info.teams_enabled = opts.teams;
        const opts_texts = translateGameOptsToClientText(opts);
        option_controls.setOptions(opts_texts, force_override);
    });

    //process newly received chat message
    socket.on('receive-chat-message', msg => {
        chat_controls.addChatMessage(msg);
    });

    //process newly received idle message
    socket.on('receive-idle-message', msg => {
        game_controls.setIdleMessage(msg);
    });
}

/*---------------------------------------------------------------------*/

/**
 * Received game options are to be translated to understandable text before
 * being displayed in the various divs
 */
function translateGameOptsToClientText(opts) {
    const opts_texts = {};
    Object.entries(opts).forEach(([key, val]) => {
        let text_val;
        switch (key) {
            case 'teams':
                if (val) {
                    text_val = 'On';
                } else {
                    text_val = 'Off';
                }
                break;
            case 'mode':
                switch (val) {
                    case 'last_letter':
                        text_val = 'Last Letter';
                        break;
                }
                break;
            case 'timer':
                text_val = val/1000; //display in s
                break;
            default:
                text_val = val;
                break;
        }
        opts_texts[key] = text_val;
    });
    return opts_texts;
}

/*---------------------------------------------------------------------*/

function initializeGameEvents(socket) {
    //change elements to be ready for the game
    socket.on('prepare-for-game-start', () => {
        game_info.game_in_progress = true;
        if (user_info.is_lead) {
            option_controls.disableSettingChanging();
        }
        setPageToGameState();
    });

    //receive name of new active player
    socket.on('active-player-change', next_player_info => {
        game_controls.handleActivePlayerChange(user_info, next_player_info);
    });

    //start timer with requested time
    socket.on('start-timer', ms_time => {
        timer_controls.clearTimerInterval(); //clear any remaining interval functions
        timer_controls.startTimer(ms_time/1000);
    });

    //handle the typing of words from currently active player
    socket.on('current-player-typing', (player_name, text) => {
        game_controls.showActiveTyper(player_name);
        game_controls.showTypedText(text);
    });

    //handle the sending of words from currently active player
    socket.on('receive-valid-word', word => {
        game_controls.clearGameError();
        game_controls.clearTypedText();
        game_controls.insertNewWord(word);
    });

    //handle words not accepted by the game
    socket.on('receive-word-error', err_msg => {
        game_controls.setGameError(err_msg);
    });

    //game ends, return to pre-game state, announce winner
    socket.on('game-end', () => {
        game_info.game_in_progress = false;
        if (user_info.is_lead) {
            option_controls.enableSettingChanging();
        }
        setPageToDefaultState();
    });

    //announce game winner inside idle message
    socket.on('announce-winner', winner_msg => {
        game_controls.setIdleMessage(winner_msg);
        game_controls.blockIdleMessageSetting(Globals.winner_msg_persistance);
    });
}

/*---------------------------------------------------------------------*/

//connect page initialization to page load
window.addEventListener('load', initialize);
