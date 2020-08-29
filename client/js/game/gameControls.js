import Globals from "../globals";

export default class GameControls {
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