const fs = require('fs');

class NameGenerator {
    constructor(list_locations) {
        this._name_lists = {};
        Object.entries(list_locations).forEach(([key, loc]) => {
            //assumes generator is created during server build, so sync is fine here
            const raw_data = fs.readFileSync(__dirname + `/../${loc}`);
            this._name_lists[key] = JSON.parse(raw_data);
        });
    }

    /*---------------------------------------------------------------------*/

    /**
     * field -> optional
     */
    generate(key, field) {
        const rnd_item = randomItemFromArray(this._name_lists[key]);
        return field ? rnd_item[field] : rnd_item;
    }
}

/*---------------------------------------------------------------------*/

function randomItemFromArray(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = NameGenerator;