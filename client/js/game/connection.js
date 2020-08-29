import Globals from "../globals";

export default class ConnectionControls {
    init() {
        this._page_content = document.querySelector('#page-wrap');
        this._connect_message_wrap = document.querySelector('#connect-message-wrap');
        this._connect_message = document.querySelector('#connect-message');
        this._repeating_interval = null; //controls continuous trying to connect to full rooms
    }

    /*---------------------------------------------------------------------*/

    setConnectMessage(msg) {
        this._connect_message.innerHTML = msg;
    }

    /*---------------------------------------------------------------------*/

    switchVisibilityToPageContent() {
        this._connect_message_wrap.style.display = 'none';
        this._page_content.style.display = 'flex';
    }

    /*---------------------------------------------------------------------*/

    retryConnection(socket) {
        if (this._repeating_interval) return; //do not set up multiple intervals!
        this._repeating_interval = setInterval(() => {
            socket.emit('retry-connect');
        }, Globals.connect_try_interval);
    }

    /*---------------------------------------------------------------------*/

    stopOngoingConnectionAttempts() {
        if (this._repeating_interval) {
            clearInterval(this._repeating_interval);
        }
    }
}