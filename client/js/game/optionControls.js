import {setInputIntegerFilter} from "../helpers/inputFilter";

export default class OptionControls {
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