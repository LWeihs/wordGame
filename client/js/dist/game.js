(function (factory) {
    typeof define === 'function' && define.amd ? define(factory) :
    factory();
}((function () { 'use strict';

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

    function disableSubmitAllForms() {
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', e => {
                e.preventDefault();
            });
        });
    }

    class BannerControls {
        init() {
            this._room_name = document.querySelector('#banner-header .main');
        }

        /*---------------------------------------------------------------------*/

        setRoomName(room_name) {
            this._room_name.innerHTML = `* * * ${room_name} * * *`;
        }
    }

    class ConnectionControls {
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

    //restricts input to integer with 0 (empty string) to max_digits digits
    function setInputIntegerFilter(input, max_digits) {
        const regex = new RegExp(`^[0-9]{0,${max_digits}}$`);
        setInputFilter(input, regex);
    }

    /**
     * Player info is provided by the server via socket update. This is translated into
     * list elements displayed in player list.
     */
    class PlayerListControls {
        initControls() {
            this._game_wrap = document.querySelector('#game-wrap');
            this._player_list = document.querySelector('#players');
            //functions to execute after all page list elements are added to page, reference by key
            this._finish_callbacks = {};
            //further control parameters
            this.protect_input = false;
            this._remembered_input = '';
        }

        /*---------------------------------------------------------------------*/

        initSocket(socket) {
            this._socket = socket; //to allow event emits in dynamically created elements
        }

        /*---------------------------------------------------------------------*/

        scaleToPlayerNumber(max_players) {
            const wrap_size = max_players * Globals.player_list_div_height;
            this._game_wrap.style.gridTemplateRows = `${wrap_size}px 1fr`;
        }

        /*---------------------------------------------------------------------*/

        updatePlayerList(user_info, game_info, player_info_arr) {
            //delete previous entries of player list
            this._clearPlayerList();
            //create the new entries of player list
            player_info_arr.forEach(player_info => {
                const player_div = this._createPlayerListItem(user_info, game_info,
                    player_info);
                this._player_list.appendChild(player_div);
            });
            //execute any function that needed to wait for page completion
            Object.values(this._finish_callbacks).forEach(f => f());
        }

        /*---------------------------------------------------------------------*/

        _clearPlayerList() {
            while (this._player_list.firstChild) {
                this._player_list.removeChild(this._player_list.firstChild);
            }
        }

        /*---------------------------------------------------------------------*/

        _createPlayerListItem(user_info, game_info, player_info) {
            //base div is the same for free and filled list divs
            const player_div = this._createPlayerListItemBase();

            //shortcut if player_info is null
            if (!player_info) {
                this._styleEmptyItem(player_div);
                return player_div;
            }

            //adapt values of player info depending on user state
            this._adaptPlayerInfo(user_info, player_info);
            //extend the list item base to create filled item
            this._extendItemToFilledPlayerItem(player_div, user_info, game_info,
                player_info);
            //add css classes to style certain game states
            this._addGameStateClassesToItem(player_div, player_info);

            return player_div;
        }

        /*---------------------------------------------------------------------*/

        _createPlayerListItemBase() {
            const item = document.createElement('div');
            item.classList.add('player-item');
            item.style.height = `${Globals.player_list_div_height}px`;
            return item;
        }

        /*---------------------------------------------------------------------*/

        _styleEmptyItem(item) {
            item.classList.add('unfilled-player-item');
            item.innerHTML = '- Free -';
        }

        /*---------------------------------------------------------------------*/

        _adaptPlayerInfo(user_info, player_info) {
            //add personal brackets to name if user himself is represented
            if (user_info.id === player_info.id) {
                player_info.name += ' (You)';
            }
        }

        /*---------------------------------------------------------------------*/

        _extendItemToFilledPlayerItem(item, user_info, game_info, player_info) {
            item.classList.add('filled-player-item'); //flex properties controlled by css

            //create and add win tracker wrap
            const win_tracker_wrap = this._createWinTrackerWrap(player_info);
            item.appendChild(win_tracker_wrap);

            //create and add div that contains the player name and team
            const name_tag_wrap = this._createNameTagWrap(user_info, game_info,
                player_info);
            item.appendChild(name_tag_wrap);

            //create and add wrap for player status with ready state
            const player_status_wrap = this._createPlayerStatusWrap(player_info);
            item.appendChild(player_status_wrap);
        }

        /*---------------------------------------------------------------------*/

        _createWinTrackerWrap(player_info) {
            const win_tracker_wrap = document.createElement('div');
            win_tracker_wrap.classList.add('win-tacker-wrap');

            //create trophy image to represent wins
            const trophy_img = this._createTrophyImage();
            //create div to represent number of wins
            const win_count = this._createWinCount(player_info);

            //add components to wrapper in correct order
            win_tracker_wrap.appendChild(trophy_img);
            win_tracker_wrap.appendChild(win_count);

            return win_tracker_wrap;
        }

        /*---------------------------------------------------------------------*/

        _createTrophyImage() {
            const trophy_img = document.createElement('img');
            trophy_img.src = `${Globals.image_folder_path}/${Globals.images.trophy}`;
            trophy_img.alt = 'wins:';
            trophy_img.classList.add('player-list-img');
            trophy_img.width = Globals.player_list_div_height;
            return trophy_img;
        }

        /*---------------------------------------------------------------------*/

        _createWinCount({wins}) {
            const win_count_div = document.createElement('div');
            win_count_div.classList.add('win-count-wrap');
            const x_span = document.createElement('span');
            x_span.innerHTML = 'x';
            const win_span = document.createElement('span');
            win_span.innerHTML = wins;
            win_count_div.appendChild(x_span);
            win_count_div.appendChild(win_span);
            return win_count_div;
        }

        /*---------------------------------------------------------------------*/

        _createNameTagWrap(user_info, game_info, player_info) {
            const name_tag_wrap = document.createElement('div');
            name_tag_wrap.classList.add('name-tag-wrap');

            //create and add the actual name tag
            const name_tag = this._createNameTag(player_info);
            //create leader crown if player is room lead (is positioned absolute to name_tag)
            if (player_info.is_room_lead && !game_info.game_in_progress) {
                const crown_img = this._createCrownImage();
                name_tag.appendChild(crown_img);
            }
            name_tag_wrap.appendChild(name_tag);

            //create and add team tag if teams are to be displayed
            if (game_info.teams_enabled) {
                const team_tag = this._createTeamTag(user_info, game_info, player_info);
                name_tag_wrap.appendChild(team_tag);
            }

            return name_tag_wrap;
        }

        /*---------------------------------------------------------------------*/

        _createNameTag({name}) {
            const name_tag = document.createElement('div');
            name_tag.classList.add('player-name-tag');
            name_tag.innerHTML = name;
            return name_tag;
        }

        /*---------------------------------------------------------------------*/

        _createCrownImage() {
            const crown_img = document.createElement('img');
            crown_img.src = `${Globals.image_folder_path}/${Globals.images.crown}`;
            crown_img.alt = 'room lead';
            crown_img.width = 40;
            crown_img.height = 20;
            return crown_img;
        }

        /*---------------------------------------------------------------------*/

        _createTeamTag({id: user_id}, {game_in_progress}, player_info) {
            const team_tag = document.createElement('div');
            team_tag.classList.add('player-team-tag');

            //determine if teams can be set by the client for this player
            const {id: player_id, team} = player_info;
            const is_player_user = user_id === player_id;
            const can_team_be_set = is_player_user && !game_in_progress;

            //unchangeable content in string form
            let team_str = 'Team: ';
            if (!can_team_be_set) {
                team_str += team;
            }
            team_tag.innerHTML = team_str;

            //if client can set team for this player, create form to change it
            if (can_team_be_set) {
                const team_change_form = this._createTeamChangeForm(player_info);
                team_tag.appendChild(team_change_form);
            }

            return team_tag;
        }

        /*---------------------------------------------------------------------*/

        _createTeamChangeForm({team}) {
            const form = document.createElement('form');
            form.autocomplete = 'off';
            //create input element, set value according to team or remembered value
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'team-set-text';
            input.value = this.protect_input ? this._remembered_input : team;
            //only allow (up to 2 digit) integer input
            setInputIntegerFilter(input, 2);
            //scale input size to contained text
            const scale_input = () => {
                const len = input.value.length;
                input.style.width = `${len > 0 ? len : 1}em`;
            };
            scale_input();
            input.addEventListener('input', () => {
                scale_input();
                if (input.value) {
                    //notify server of new team
                    this._socket.emit('change-team', parseInt(input.value));
                    this.protect_input = false;
                } else {
                    this.protect_input = true;
                }
            });
            //refresh existing focus on reload
            input.addEventListener('focus', () => {
                this._finish_callbacks.focus_input = () => {
                    document.querySelector('#team-set-text').focus();
                };
            });
            input.addEventListener('blur', () => {
                delete this._finish_callbacks.focus_input;
            });
            //create label in relation to input's name tag
            const label = document.createElement('label');
            label.setAttribute('for', 'team-set-text');
            //finish the form: append children
            form.appendChild(label);
            form.appendChild(input);
            return form;
        }

        /*---------------------------------------------------------------------*/

        _createPlayerStatusWrap(player_info) {
            const player_status_wrap = document.createElement('div');
            player_status_wrap.classList.add('player-status-wrap');
            //add ready/not ready image to wrap
            const rdy_img = this._createReadyStatusImage(player_info);
            player_status_wrap.appendChild(rdy_img);
            return player_status_wrap;
        }

        /*---------------------------------------------------------------------*/

        _createReadyStatusImage({ready}) {
            const rdy_img = document.createElement('img');
            const image_name = ready ? Globals.images.tick : Globals.images.cross;
            rdy_img.src = `${Globals.image_folder_path}/${image_name}`;
            rdy_img.alt = ready ? 'ready' : 'not ready';
            rdy_img.classList.add('player-list-img');
            rdy_img.width = Globals.player_list_div_height;
            return rdy_img;
        }

        /*---------------------------------------------------------------------*/

        _addGameStateClassesToItem(item, player_info) {
            //mark currently active player as such (by css class)
            if (player_info.is_current_player) {
                this._addCurrentPlayerStateToItem(item);
            }
            //mark defeated players as such (by css class)
            if (!player_info.alive) {
                this._addDefeatedStateToItem(item);
            }
        }

        /*---------------------------------------------------------------------*/

        _addCurrentPlayerStateToItem(item) {
            item.classList.add('current-player');
        }

        /*---------------------------------------------------------------------*/

        _addDefeatedStateToItem(item) {
            item.classList.add('defeated');
        }
    }

    class GameControls {
        initControls() {
            //main wrapper
            this._game_content = document.querySelector('#game-content');

            //input elements
            this._game_input_form = document.querySelector('#game-input-form');
            this._game_input_text = document.querySelector('#game-input-text');

            //divs to display previous words in (do not exist on creation)
            this._previous_words = null;
            //div displaying hint for next word to guess
            this._hint_word = document.querySelector('.next-word-hint');

            //div to display currently typing player in
            this._game_cur_typer = document.querySelector('#game-cur-player-tag');
            //div to display what currently active player is typing
            this._typed_word = document.querySelector('#game-typed-word');
            //div to display game errors in (after submitting a word)
            this._typing_error = document.querySelector('#typing-error');

            //divs to remind current player that it is his turn
            this._cur_player_reminders = document.querySelectorAll('.your-turn-label');

            //div to display idle/victory message in
            this._idle_message = document.querySelector('#game-idle-message');

            //remember last few typed words (length not known on creation)
            this._last_typed = null;

            //data for blocking/unblocking of idle message setting
            this._idle_blocked = false;
            this._idle_timeout = undefined;
            this._queued_idle_message = undefined;

            //data to handle concurrent active players typing
            this._can_multiple_players_talk = false;
            this._cur_typer_fallback = '';
            this._cur_typer_reset_timeout = null;

            //data to handle game error fading
            this._game_error_reset_timeout = null;
        }

        /*---------------------------------------------------------------------*/

        initSocketEvents(socket) {
            //server checks input for correctness on submit
            this._game_input_form.addEventListener('submit', (e) => {
                e.preventDefault();
                const msg = this._game_input_text.value;
                this._game_input_text.value = '';
                socket.emit('process-game-input', msg);
            });

            //currently typed word is tracked by server
            this._game_input_text.addEventListener('input', (e) => {
                socket.emit('player-typing', this._game_input_text.value);
            });
        }

        /*---------------------------------------------------------------------*/

        createPrevTypedDivs(no_divs) {
            const parent = document.querySelector('#game-upper');
            for (let i=0; i<no_divs; ++i) {
                const item = document.createElement('div');
                item.classList.add('previously-typed-word');
                parent.insertBefore(item, parent.firstChild);
            }
            //set critical variables after game html is now complete
            this._previous_words = document.querySelectorAll('.previously-typed-word');
            this._last_typed = new Array(this._previous_words.length);
        }

        /*---------------------------------------------------------------------*/

        reset() {
            this.clearPrevTypedDivs();
            this.clearTypedText();
            this.clearGameError();
            if (this._previous_words) { //may not be created yet
                this._last_typed = new Array(this._previous_words.length);
            }
        }

        /*---------------------------------------------------------------------*/

        hideGameContent() {
            this._game_content.style.display = 'none';
        }

        /*---------------------------------------------------------------------*/

        showGameContent() {
            this._game_content.style.display = '';
        }

        /*---------------------------------------------------------------------*/

        handleActivePlayerChange(user_info, next_player_info) {
            //show current turn reminders to active players, disable for inactive
            let user_is_active = false;
            for (const {user_id} of next_player_info.players) {
                if (user_info.id === user_id) {
                    user_is_active = true;
                    break;
                }
            }
            if (user_is_active) {
                this.showCurrentPlayerReminders();
            } else {
                this.hideCurrentPlayerReminders();
            }

            //set active typer: either to only player or to team name (+ fallback enable)
            let next_typer;
            if (next_player_info.is_team) {
                this._can_multiple_players_talk = true;
                this._cur_typer_fallback = next_player_info.team;
                next_typer = next_player_info.team;
            } else {
                next_typer = next_player_info.players[0].name;
            }
            this.showActiveTyper(next_typer);
        }

        /*---------------------------------------------------------------------*/

        hideCurrentPlayerReminders() {
            //hide box shadow through class removal
            this._game_content.classList.remove('current-player');
            //hide reminder divs
            this._cur_player_reminders.forEach(div => {
                div.style.display = 'none';
            });
        }

        /*---------------------------------------------------------------------*/

        showCurrentPlayerReminders() {
            //show box shadow by adding class
            this._game_content.classList.add('current-player');
            //show reminder divs
            this._cur_player_reminders.forEach(div => {
                div.style.display = '';
            });
        }

        /*---------------------------------------------------------------------*/

        showActiveTyper(name) {
            if (this._cur_typer_reset_timeout) {
                clearTimeout(this._cur_typer_reset_timeout);
            }
            //set the name to received name
            this._game_cur_typer.innerHTML = name;
            //reset shown name to fallback after a small interval when multiple players can talk
            if (this._can_multiple_players_talk) {
                this._cur_typer_reset_timeout = setTimeout(() => {
                    this._game_cur_typer.innerHTML = this._cur_typer_fallback;
                    this.showTypedText('');
                }, Globals.active_typer_persistance);
            }
        }

        /*---------------------------------------------------------------------*/

        showTypedText(text) {
            if (!text) text = '...';
            this._typed_word.innerHTML = text;
        }

        /*---------------------------------------------------------------------*/

        clearTypedText() {
            this._typed_word.innerHTML = '...';
        }

        /*---------------------------------------------------------------------*/

        setGameError(err_msg) {
            if (this._game_error_reset_timeout) {
                clearTimeout(this._game_error_reset_timeout);
                this._game_error_reset_timeout = null;
            }
            this._typing_error.innerHTML = err_msg.toUpperCase();
            this._game_error_reset_timeout = setTimeout(() => {
                this.clearGameError();
            }, Globals.game_error_persistance);
        }

        /*---------------------------------------------------------------------*/

        clearGameError() {
            if (this._game_error_reset_timeout) {
                clearTimeout(this._game_error_reset_timeout);
                this._game_error_reset_timeout = null;
            }
            this._typing_error.innerHTML = '';
        }

        /*---------------------------------------------------------------------*/

        insertNewWord(word) {
            //update inner buffer of previously typed words
            this._updateLastTyped(word);
            //apply previously typed words to html elements
            this._updateHintDiv();
            this._updatePrevTypedDivs();
        }

        /*---------------------------------------------------------------------*/

        clearPrevTypedDivs() {
            if (!this._previous_words) return; //may be called before elements created
            this._previous_words.forEach(prev_word_div => {
                prev_word_div.innerHTML = '';
            });
        }

        /*---------------------------------------------------------------------*/

        setIdleMessage(message) {
            if (this._idle_blocked) {
                this._queued_idle_message = message;
            } else {
                this._idle_message.innerHTML = message;
            }
        }

        /*---------------------------------------------------------------------*/

        clearIdleMessage() {
            this._idle_message.innerHTML = '';
        }

        /*---------------------------------------------------------------------*/

        blockIdleMessageSetting(ms_time) {
            this._idle_blocked = true;
            this._idle_timeout = setTimeout(() => {
                this._idle_blocked = false; //unblock first, or end in loop
                if (this._queued_idle_message) {
                    this.setIdleMessage(this._queued_idle_message);
                    this._queued_idle_message = undefined;
                }
            }, ms_time);
        }

        /*---------------------------------------------------------------------*/

        unblockIdleMessageSetting() {
            this._idle_blocked = false;
            clearTimeout(this._idle_timeout);
        }

        /*---------------------------------------------------------------------*/

        _updateLastTyped(word) {
            let next_insert = word;
            for (let i=0; i<this._last_typed.length; ++i) {
                const temp = this._last_typed[i];
                this._last_typed[i] = next_insert;
                next_insert = temp;
            }
        }

        /*---------------------------------------------------------------------*/

        _updateHintDiv() {
            const cur_word = this._last_typed[0];
            if (!cur_word) return;
            const last_letter = cur_word[cur_word.length-1];
            const letter_color = this._getHighlightColorByIdx(0);
            const first_letter_span = this._createHighlightedLetter(last_letter, letter_color);
            this._hint_word.innerHTML = `${first_letter_span}...?`;
        }

        /*---------------------------------------------------------------------*/

        _updatePrevTypedDivs() {
            const last_idx = this._previous_words.length-1;
            //iterate divs to show and insert correct text
            let i=0;
            for (; i<this._last_typed.length; ++i) {
                const word = this._last_typed[i];
                if (!word) break;
                //first letter gets new color, first row is uncolored
                const first_letter = word[0];
                let first_letter_span;
                if (!this._last_typed[i+1]) {
                    first_letter_span = first_letter;
                } else {
                    const first_letter_color = this._getHighlightColorByIdx(i+1);
                    first_letter_span = this._createHighlightedLetter(first_letter,
                        first_letter_color);
                }
                //last letter same color as first letter of next word
                const last_letter = word[word.length-1];
                const last_letter_color = this._getHighlightColorByIdx(i);
                const last_letter_span = this._createHighlightedLetter(last_letter,
                    last_letter_color);
                //slice of remaining word between first and last letter
                const rem_word = word.slice(1, word.length-1);
                //create entry for the word with highlights
                const prev_word_div = this._previous_words[last_idx-i];
                prev_word_div.style.display = '';
                prev_word_div.innerHTML = `${first_letter_span}${rem_word}${last_letter_span}`;
            }
            //iterate remaining divs and hide them
            for (; i<this._previous_words.length; ++i) {
                this._previous_words[last_idx-i].style.display = 'none';
            }
        }

        /*---------------------------------------------------------------------*/

        _getHighlightColorByIdx(idx) {
            if (Globals.highlight_colors.hasOwnProperty(idx)) {
                return Globals.highlight_colors[idx];
            } else {
                return Globals.highlight_colors.default;
            }
        }

        /*---------------------------------------------------------------------*/

        _createHighlightedLetter(letter, color) {
            return `<span style="color:${color};">${letter}</span>`;
        }
    }

    const timer_colors = {
        time_map: new Map([
            [1, 'red'],
            [3, 'yellow'],
        ]),
        default: 'green',
    };

    class TimerControls {
        init() {
            this._timer = document.querySelector('#time-ticker');
            this._time_interval = null;
        }

        /*---------------------------------------------------------------------*/

        startTimer(rem) { //rem given in s!
            if (this._time_interval) {
                clearInterval(this._time_interval);
            }
            this._setTime(rem);
            this._time_interval = setInterval(() => {
                rem--;
                this._setTime(rem);
                if (rem === 0) {
                    this.clearTimerInterval();
                    this._time_interval = null;
                }
            }, 1000);
        }

        /*---------------------------------------------------------------------*/

        clearTimerInterval() {
            clearInterval(this._time_interval);
        }

        /*---------------------------------------------------------------------*/

        _setTime(time) {
            this._timer.innerHTML = time;
            this._setTimerColor(time);
        }

        /*---------------------------------------------------------------------*/

        _setTimerColor(rem) {
            let bg_color;
            for (const [time, color] of timer_colors.time_map.entries()) {
                if (rem <= time) {
                    bg_color = color;
                    break; //since the map is filled with ascending keys
                }
            }
            if (!bg_color) bg_color = timer_colors.default;
            this._timer.style.backgroundColor = bg_color;
        }
    }

    class ChatControls {
        constructor() {
            this._chat = '';
            this._socket = null; //to be filled by initSocketEvents()
        }

        /*---------------------------------------------------------------------*/

        initControls() {
            this._controls = {
                input_form: document.querySelector('#chat-input-form'),
                input_text: document.querySelector('#chat-input-text'),
                text_field: document.querySelector('#chat-text-area'),
            };

            this._controls.input_form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!this._socket) return;
                this._sendChatMessage();
            });
        }

        /*---------------------------------------------------------------------*/

        initSocketEvents(socket) {
            this._socket = socket;
        }

        /*---------------------------------------------------------------------*/

        addChatMessage(msg) {
            if (this._chat) {
                this._chat += '</br>';
            }
            this._chat += msg;
            this._controls.text_field.innerHTML = this._chat;
            this._scrollChatToBottom();
        }

        /*---------------------------------------------------------------------*/

        _sendChatMessage() {
            const msg = this._controls.input_text.value;
            this._socket.emit('process-chat-input', msg);
            this._controls.input_text.value = '';
        }

        /*---------------------------------------------------------------------*/

        _scrollChatToBottom() {
            this._controls.text_field.scrollTop = this._controls.text_field.scrollHeight;
        }

    }

    class OptionControls {
        initControls() {
            this._fixed_settings = document.querySelector('#game-opts-settings-fixed');
            this._changeable_settings = document.querySelector('#game-opts-settings-changeable');
        }

        /*---------------------------------------------------------------------*/

        initSocketEvents(socket) {
            //for droprights: change option on click
            const bind_dropright_event = (opt_key) => {
                const sel_str = `.${opt_key} .dropright-content > div`;
                const option_divs = this._changeable_settings.querySelectorAll(sel_str);
                option_divs.forEach(option_div => {
                    option_div.addEventListener('click', () => {
                        const opts_texts = {
                            [opt_key]: option_div.innerHTML,
                        };
                        socket.emit('change-game-option', opts_texts);
                    });
                });
            };
            bind_dropright_event('mode');
            bind_dropright_event('teams');

            //for the input based "turn timer" option: change on input
            const input = this._changeable_settings.querySelector('#turn-timer-input');
            setInputIntegerFilter(input, 2);
            input.addEventListener('input', () => {
                socket.emit('change-game-option', {
                    timer: parseInt(input.value)*1000, //server expects ms
                });
            });
        }

        /*---------------------------------------------------------------------*/

        enableSettingChanging() {
            this._fixed_settings.style.display = 'none';
            this._changeable_settings.style.display = '';
        }

        /*---------------------------------------------------------------------*/

        disableSettingChanging() {
            this._changeable_settings.style.display = 'none';
            this._fixed_settings.style.display = '';
        }

        /*---------------------------------------------------------------------*/

        setOptions(opts, force_override) {
            this._setFixedOptions(opts);
            this._setChangeableOptions(opts, force_override);
        }

        /*---------------------------------------------------------------------*/

        _setFixedOptions(opts) {
            this._setServerSetOptions(this._fixed_settings, opts);
        }

        /*---------------------------------------------------------------------*/

        _setChangeableOptions(opts, force_override) {
            this._setServerSetOptions(this._changeable_settings, opts);
            if (force_override) {
                this._setServerOverridableOptions(this._changeable_settings, opts);
            }
        }

        /*---------------------------------------------------------------------*/

        _setServerSetOptions(entry_el, opts) {
            entry_el.querySelectorAll('.server-set').forEach(el => {
                Object.keys(opts).forEach(key => {
                    if (el.classList.contains(key)) {
                        this._setElementText(el, opts[key]);
                    }
                });
            });
        }

        /*---------------------------------------------------------------------*/

        _setServerOverridableOptions(entry_el, opts) {
            entry_el.querySelectorAll('.server-overridable').forEach(el => {
                Object.keys(opts).forEach(key => {
                    if (el.classList.contains(key)) {
                        this._setElementText(el, opts[key]);
                    }
                });
            });
        }

        /*---------------------------------------------------------------------*/

        _setElementText(el, text) {
            let text_key;
            switch (el.nodeName) {
                case 'INPUT':
                    text_key = 'value';
                    break;
                default:
                    text_key = 'innerHTML';
                    break;
            }
            el[text_key] = text;
        }
    }

    class GameStartControls {
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

})));
