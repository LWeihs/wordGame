import disableSubmitAllForms from "./helpers/formDisable";
import GameJoinControls from "./lobby/gameJoinControls";

const game_join_controls = new GameJoinControls();

/*---------------------------------------------------------------------*/

function initialize() {
    disableSubmitAllForms();
    initializeControls();
    initializeSocketIo();
}

/*---------------------------------------------------------------------*/

function initializeControls() {
    game_join_controls.initControls();
}

/*---------------------------------------------------------------------*/

function initializeSocketIo() {
    const socket = io({
        transports: ['websocket'],
        upgrade: false,
        query: `source=lobby`
    });

    //initialize event emitting
    game_join_controls.initSocket(socket);

    //initialize event handling
    socket.on('redirect-error', error_msg => {
        game_join_controls.displayErrorMessage(error_msg);
    });

    socket.on('permit-redirect', room_name => {
        redirectToRoom(room_name);
    });
}

/*---------------------------------------------------------------------*/

function redirectToRoom(room_name) {
    //create url base including room name parameter
    let url = `game?room=${room_name}`;
    //extend url by user name if name is given
    const user_name = game_join_controls.getInputUserName();
    if (user_name) {
        url += `&userName=${user_name}`;
    }
    //redirect
    location.href = url;
}

/*---------------------------------------------------------------------*/

//connect page initialization to page load
window.addEventListener('load', initialize);
