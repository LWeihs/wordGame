export default class GameStartControls {
    initControls() {
        this._socket = null; // to be filled by initSocketEvents()
        this._readyButton = document.querySelector('#game-ready-button');
        this._startButton = document.querySelector('#game-start-button');
    }

    /*---------------------------------------------------------------------*/

    initSocketEvents(socket) {
        //ready button for regular users
        this._readyButton.addEventListener('click', () => {
            socket.emit('change-ready-state');
        });
        //game start button for room lead only
        this._startButton.addEventListener('click', () => {
            socket.emit('start-game');
        });
    }

    /*---------------------------------------------------------------------*/

    setButtonAsReadyButton() {
        this._readyButton.classList.remove('negative-action');
        this._readyButton.classList.add('positive-action');
        this._readyButton.innerHTML = 'Ready!';
    }

    /*---------------------------------------------------------------------*/

    setButtonAsCancelButton() {
        this._stripStateClasses(this._readyButton);
        this._readyButton.classList.add('negative-action');
        this._readyButton.innerHTML = 'Cancel';
    }

    /*---------------------------------------------------------------------*/

    enableReadyButton() {
        this._stripStateClasses(this._readyButton);
        this._readyButton.classList.add('positive-action');
        this._readyButton.disabled = false;
    }

    /*---------------------------------------------------------------------*/

    disableReadyButton() {
        this._stripStateClasses(this._readyButton);
        this._readyButton.classList.add('inactive-action');
        this._readyButton.disabled = true;
    }

    /*---------------------------------------------------------------------*/

    enableStartButton() {
        this._stripStateClasses(this._startButton);
        this._startButton.classList.add('positive-action');
        this._startButton.disabled = false;
    }

    /*---------------------------------------------------------------------*/

    disableStartButton() {
        this._stripStateClasses(this._startButton);
        this._startButton.classList.add('inactive-action');
        this._startButton.disabled = true;
    }

    /*---------------------------------------------------------------------*/

    switchToRoomRegularUserState() {
        this._readyButton.style.display = '';
        this._startButton.style.display = 'none';
    }

    /*---------------------------------------------------------------------*/

    switchToRoomLeadState() {
        this._readyButton.style.display = 'none';
        this._startButton.style.display = '';
    }

    /*---------------------------------------------------------------------*/

    _stripStateClasses(button) {
        button.classList.remove('positive-action');
        button.classList.remove('negative-action');
        button.classList.remove('inactive-action');
    }
}