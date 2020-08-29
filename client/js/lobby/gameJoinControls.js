import Globals from "../globals";
import {setInputLengthFilter} from "../helpers/inputFilter";

export default class GameJoinControls {
    constructor() {
        this._join_type = '';
        this._new_room_info = {
            private: false,
        };
    }

    /*---------------------------------------------------------------------*/

    initControls() {
        //inputs to read name and room from
        this._name_input = document.querySelector('#name-input-text');
        setInputLengthFilter(this._name_input, Globals.player_name_max_len);
        this._room_input = document.querySelector('#room-input-text');
        setInputLengthFilter(this._room_input, Globals.room_name_max_len);

        //elements to show/hide in different page states
        this._room_tag = document.querySelector('#room-tag');
        this._room_input_form = document.querySelector('#room-input-form');
        this._room_error = document.querySelector('#room-error');
        this._room_error.display = 'none';
        this._join_private_toggle = document.querySelector('#join-private-toggle');

        //"radio buttons" to trigger different further param listing
        this._join_type_divs = document.querySelectorAll('.join-type-choice');
        this._random_join_div = document.querySelector('#join-type-random');
        this._specific_join_div = document.querySelector('#join-type-specific');
        this._new_join_div = document.querySelector('#join-type-new');
        this._join_type_divs.forEach(div => {
            div.addEventListener('click', () => {
                this._handleSelectionJoinTypeDiv(div);
            });
        });
        this._handleSelectionJoinTypeDiv(this._join_type_divs[0]);

        //setting of "private" option for room creation
        this._join_private_toggle.addEventListener('click', () => {
            this._switchPrivateSetting();
        });

        //button to (attempt) room join/creation with
        this._game_join_button = document.querySelector('#game-join-button');
    }

    /*---------------------------------------------------------------------*/

    initSocket(socket) {
        this._game_join_button.addEventListener('click', () => {
            this._attemptRedirectToGame(socket);
        });
    }

    /*---------------------------------------------------------------------*/

    getInputUserName() {
        return this._name_input.value;
    }

    /*---------------------------------------------------------------------*/

    displayErrorMessage(error_msg) {
        this._room_error.innerHTML = error_msg;
        this._room_error.style.display = '';
    }

    /*---------------------------------------------------------------------*/

    _switchStateBasedOnJoinType() {
        switch (this._join_type) {
            case 'random':
                this._switchStateToRandomJoin();
                break;
            case 'specific':
                this._switchStateToSpecificJoin();
                break;
            case 'new':
                this._switchStateToNewJoin();
                break;
        }
    }

    /*---------------------------------------------------------------------*/

    _switchStateToRandomJoin() {
        this._room_tag.style.display = 'none';
        this._room_input_form.style.display = 'none';
        this._room_error.style.display = 'none'; //always hide on switch
        this._join_private_toggle.style.display = 'none';
    }

    /*---------------------------------------------------------------------*/

    _switchStateToSpecificJoin() {
        this._room_tag.style.display = '';
        this._room_input_form.style.display = '';
        this._room_error.style.display = 'none'; //always hide on switch
        this._join_private_toggle.style.display = 'none';
    }

    /*---------------------------------------------------------------------*/

    _switchStateToNewJoin() {
        this._room_tag.style.display = '';
        this._room_input_form.style.display = '';
        this._room_error.style.display = 'none'; //always hide on switch
        this._join_private_toggle.style.display = '';
    }

    /*---------------------------------------------------------------------*/

    _handleSelectionJoinTypeDiv(div) {
        this._setJoinTypeDivActive(div);
        this._join_type_divs.forEach(other_div => {
            if (other_div !== div) {
                this._setJoinTypeDivInactive(other_div);
            }
        });
        //handle room state
        if (div === this._random_join_div) {
            this._join_type = 'random';
        } else if (div === this._specific_join_div) {
            this._join_type = 'specific';
        } else if (div === this._new_join_div) {
            this._join_type = 'new';
        }
        this._switchStateBasedOnJoinType();
    }

    /*---------------------------------------------------------------------*/

    _switchPrivateSetting() {
        this._new_room_info.private = !this._new_room_info.private;
        if (this._new_room_info.private) {
            this._checkDivWithCheckbox(this._join_private_toggle);
        } else {
            this._uncheckDivWithCheckbox(this._join_private_toggle);
        }
    }

    /*---------------------------------------------------------------------*/

    _setJoinTypeDivActive(div) {
        const i = div.querySelector('i:first-child');
        i.classList.remove('far');
        i.classList.add('fas');
    }

    /*---------------------------------------------------------------------*/

    _setJoinTypeDivInactive(div) {
        const i = div.querySelector('i:first-child');
        i.classList.remove('fas');
        i.classList.add('far');
    }

    /*---------------------------------------------------------------------*/

    _checkDivWithCheckbox(div) {
        const i = div.querySelector('i:first-child');
        i.classList.remove('fa-square');
        i.classList.add('fa-check-square');
    }

    /*---------------------------------------------------------------------*/

    _uncheckDivWithCheckbox(div) {
        const i = div.querySelector('i:first-child');
        i.classList.remove('fa-check-square');
        i.classList.add('fa-square');
    }

    /*---------------------------------------------------------------------*/

    _attemptRedirectToGame(socket) {
        const join_info = {
            join_type: this._join_type,
            room: this._room_input.value,
            make_private: this._new_room_info.private,
        };
        socket.emit('attempt-redirect-to-game', join_info);
    }
}