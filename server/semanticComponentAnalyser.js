class SemanticAnalyser {
    constructor(raw_msg, split_symbol=' ') {
        this._msg = raw_msg;
        this._cursor = 0;
        this._split_symbol = split_symbol;
    }

    /*---------------------------------------------------------------------*/

    findNext() {
        let next = '';
        let next_char;
        while (this._cursor < this._msg.length) {
            next_char = this._msg[this._cursor];
            this._cursor++;
            if (next_char === this._split_symbol) {
                break;
            }
            next += next_char;
        }
        return next;
    }

    /*---------------------------------------------------------------------*/

    getRemainingMessage() {
        return this._msg.slice(this._cursor);
    }
}

module.exports = SemanticAnalyser;