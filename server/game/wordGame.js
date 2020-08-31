const randomWords = require('random-words');
const checkWord = require('check-word');

const TimedGame = require('./timedGame');
const Globals = require('../globals');

class WordGame extends TimedGame {
    constructor(param_obj) {
        super(param_obj);
        const {lang, max_generated_len} = param_obj;
        //extend game opts
        this.game_opts.mode = 'last_letter';
        //set once, immutable
        this._max_generated_len = max_generated_len;
        //keep track of accepted words (for duplicate detection)
        this._used_words = new Set();
        this._expected_word_start = undefined;
        //initialize word generation and checking functionality
        this._word_generator = randomWords;
        this._word_check = checkWord(lang ? lang : 'en');
    }

    /*---------------------------------------------------------------------*/

    /**
     * Override
     */
    subscribeSocket(socket) {
        super.subscribeSocket(socket);

        socket.on('player-typing', text => {
            //typing only processed from active player
            if (this._room_info.isPlayerActivePlayer(socket.user_id)) {
                this._sendTypingToPlayers(socket.shown_name, text);
            }
        });
    }

    /*---------------------------------------------------------------------*/

    /**
     * Override
     */
    handleGameInput(input) {
        const err_msg = this._validateInput(input);
        if (err_msg) {
            this._sendWordErrorToPlayers(err_msg);
        } else {
            this._handleValidInput(input);
        }
    }

    /*---------------------------------------------------------------------*/

    /**
     * Extend parent
     */
    handleGameStart() {
        super.handleGameStart();
        //start game with first word
        const start_word = this._generateStartWord();
        this._setExpectedWordStart(start_word);
        this._sendValidWordToPlayers(start_word);
    }

    /*---------------------------------------------------------------------*/

    /**
     * Override
     */
    handleGameEnd() {
        this._used_words = new Set();
        this._expected_word_start = undefined;
    }


    /*---------------------------------------------------------------------*/

    _setExpectedWordStart(word) {
        this._expected_word_start = word[word.length-1];
    }

    /*---------------------------------------------------------------------*/

    _validateExpectedWordStart(word) {
        return word[0] === this._expected_word_start;
    }

    /*---------------------------------------------------------------------*/

    _generateStartWord() {
        if (this._max_generated_len === undefined) {
            return this._generateRandomLengthWord();
        } else {
            return this._generateMaxLengthWord();
        }
    }

    /*---------------------------------------------------------------------*/

    _generateRandomLengthWord() {
        //careful: word generator creates array!
        return this._word_generator({exactly: 1})[0];
    }

    /*---------------------------------------------------------------------*/

    _generateMaxLengthWord() {
        //careful: word generator creates array!
        return this._word_generator(
            {exactly: 1, maxLength: this._max_generated_len}
        )[0];
    }

    /*---------------------------------------------------------------------*/

    _validateInput(input) {
        if (!this._validateExpectedWordStart(input)) {
            return Globals.error_messages.invalid_word_start;
        }
        if (this._used_words.has(input)) {
            return Globals.error_messages.duplicate_word;
        }
        if (!this._word_check.check(input)) {
            return Globals.error_messages.invalid_word;
        }
        return '';
    }

    /*---------------------------------------------------------------------*/

    _handleValidInput(valid_word) {
        this._used_words.add(valid_word);
        this._setExpectedWordStart(valid_word);
        this._sendValidWordToPlayers(valid_word);
        this.handlePlayerSuccess();
    }

    /*---------------------------------------------------------------------*/

    _sendTypingToPlayers(name, text) {
        this._io.in(this._room_info.name).emit('current-player-typing', name, text);
    }

    /*---------------------------------------------------------------------*/

    _sendValidWordToPlayers(word) {
        this._io.in(this._room_info.name).emit('receive-valid-word', word);
    }

    /*---------------------------------------------------------------------*/

    _sendWordErrorToPlayers(err_msg) {
        this._io.in(this._room_info.name).emit('receive-word-error', err_msg);
    }
}

module.exports = WordGame;