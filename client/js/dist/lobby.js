(function (factory) {
    typeof define === 'function' && define.amd ? define(factory) :
    factory();
}((function () { 'use strict';

    function disableSubmitAllForms() {
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', e => {
                e.preventDefault();
            });
        });
    }

    const Globals = {
        player_name_max_len: 8, //in characters
        room_name_max_len: 8, //in characters
        player_list_div_height: 65, //in px
        connect_try_interval: 2000, //in ms
        game_error_persistance: 2000, //in ms
        active_typer_persistance: 5000, //in ms
        winner_msg_persistance: 5000, //in ms
        image_folder_path: 'images',
        images: {
            tick: 'tick.png',
            cross: 'cross.png',
            trophy: 'trophy.png',
            crown: 'crown.png',
        },
        highlight_colors: {
            0: '#ff0000',
            1: '#ff7f00',
            2: '#ffff00',
            3: '#00ff00',
            4: '#0000ff',
            5: '#4b0082',
            default: '#9400d3',
        },
    };

    //restricts input to only display value according to given regular expression
    function setInputFilter(input, regex) {
        ["input", "keydown", "keyup", "mousedown", "mouseup", "select", "contextmenu", "drop"].forEach(listener => {
            input.addEventListener(listener, function () {
                if (regex.test(this.value)) {
                    this.oldValue = this.value;
                    this.oldSelectionStart = this.selectionStart;
                    this.oldSelectionEnd = this.selectionEnd;
                } else if (this.hasOwnProperty("oldValue")) {
                    this.value = this.oldValue;
                    this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd);
                } else {
                    this.value = "";
                }
            });
        });
    }

    /*---------------------------------------------------------------------*/

    //restrict input to maximum length
    function setInputLengthFilter(input, max_len) {
        const regex = new RegExp(`^.{0,${max_len}}$`);
        setInputFilter(input, regex);
    }

    class GameJoinControls {
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

})));
