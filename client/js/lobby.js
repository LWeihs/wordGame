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
    const host_name = window.location.hostname;
    const socket = io(`${host_name}:8081`, { query: `source=lobby`});

    game_join_controls.initSocket(socket);

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
