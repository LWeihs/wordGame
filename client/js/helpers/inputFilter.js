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

/*---------------------------------------------------------------------*/

//restricts input to integer with 0 (empty string) to max_digits digits
function setInputIntegerFilter(input, max_digits) {
    const regex = new RegExp(`^[0-9]{0,${max_digits}}$`);
    setInputFilter(input, regex);
}

/*---------------------------------------------------------------------*/

export {
    setInputLengthFilter,
    setInputIntegerFilter,
}