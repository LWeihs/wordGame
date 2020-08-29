const timer_colors = {
    time_map: new Map([
        [1, 'red'],
        [3, 'yellow'],
    ]),
    default: 'green',
};

export default class TimerControls {
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