import {setInputLengthFilter} from "../helpers/inputFilter";
import Globals from "../globals";

export default class ChatControls {
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

        setInputLengthFilter(this._controls.input_text, Globals.chat_max_len_message);
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

    fillTextInput(fill_msg) {
        this._controls.input_text.value = fill_msg;
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

