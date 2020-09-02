import Globals from "../globals";
import {setInputIntegerFilter} from "../helpers/inputFilter";

/**
 * Player info is provided by the server via socket update. This is translated into
 * list elements displayed in player list.
 */
export default class PlayerListControls {
    initControls() {
        this._player_list = document.querySelector('#player-items');
        this._element_update_fns = {}; //filled during element creation
        //control setting of team input field
        this._must_set_team_input = {};
    }

    /*---------------------------------------------------------------------*/

    initSocket(socket) {
        this._socket = socket; //to allow event emits in dynamically created elements
    }

    /*---------------------------------------------------------------------*/

    createPlayerElements(max_players) {
        //care if server restarts! to be safe: clear any previous elements
        this._clearExistingElements();
        //create new elements
        for (let i = 0; i < max_players; ++i) {
            //create an object to hold quick update functions for created elements
            const element_update_fns = {
                set_name: () => {},
                set_wins: () => {},
                switch_ready_state: () => {},
                switch_team_visibility: () => {},
                enable_team_input: () => {},
                set_team_str: () => {},
                set_team_input: () => {},
                set_room_lead: () => {},
                set_current_player: () => {},
                set_alive: () => {},
                switch_to_empty: () => {},
                switch_to_filled: () => {},
            };
            //create player element and insert functions for updating them
            const player_element = this._createPlayerListItem(element_update_fns);
            //add created element to DOM
            this._player_list.appendChild(player_element);
            //set internal data structures for element manipulation
            this._element_update_fns[i] = element_update_fns;
            this._must_set_team_input[i] = true;
        }
        //perform any remaining steps
        this._processCreatedPlayerList();
    }

    /*---------------------------------------------------------------------*/

    updatePlayerList(user_info, game_info, player_info_arr) {
        //create the new entries of player list
        player_info_arr.forEach((player_info, i) => {
            if (!player_info) {
                this._updatePlayerListSlotEmpty(i);
            } else {
                this._updatePlayerListSlotFilled(i, user_info, game_info, player_info);
            }
        });
    }

    /*---------------------------------------------------------------------*/

    prepareForGameStart() {
        Object.keys(this._must_set_team_input).forEach(key => {
            this._must_set_team_input[key] = true;
        });
    }

    /*---------------------------------------------------------------------*/
    /* CREATION OF THE DIFFERENT (PARTS OF) LIST ELEMENTS */
    /*---------------------------------------------------------------------*/

    _clearExistingElements() {
        this._player_list.innerHTML = '';
    }

    /*---------------------------------------------------------------------*/

    _createPlayerListItem(element_update_fns) {
        //create container with both empty and filled state
        const container = this._createContainerItem(element_update_fns);
        const empty_item = this._createEmptyPlayerItem();
        container.appendChild(empty_item);
        const filled_item = this._createFilledPlayerItem(element_update_fns);
        filled_item.style.display = 'none';
        container.appendChild(filled_item);

        //extend update functions
        element_update_fns.switch_to_empty = () => {
            filled_item.style.display = 'none';
            empty_item.style.display = '';
        };
        element_update_fns.switch_to_filled = () => {
            empty_item.style.display = 'none';
            filled_item.style.display = '';
        };
        element_update_fns.set_current_player = (is_current_player) => {
            if (is_current_player) {
                this._addCurrentPlayerStateToItem(filled_item);
            } else {
                this._removeCurrentPlayerStateFromItem(filled_item)
            }
        };
        element_update_fns.set_alive = (is_alive) => {
            if (is_alive) {
                this._removeDefeatedStateFromItem(filled_item);
            } else {
                this._addDefeatedStateToItem(filled_item);
            }
        };

        return container;
    }

    /*---------------------------------------------------------------------*/

    _createContainerItem(element_update_fns) {
        const item = document.createElement('div');
        item.classList.add('player-item-container');
        item.style.height = `${Globals.player_list_div_height}px`;
        return item;
    }

    /*---------------------------------------------------------------------*/

    _createEmptyPlayerItem() {
        const item = document.createElement('div');
        item.classList.add('unfilled-player-item');
        item.innerHTML = '- Free -';
        return item;
    }

    /*---------------------------------------------------------------------*/

    _createFilledPlayerItem(element_update_fns) {
        const item = document.createElement('div');
        item.classList.add('filled-player-item');

        //create and add win tracker wrap
        const win_tracker_wrap = this._createWinTrackerWrap(element_update_fns);
        item.appendChild(win_tracker_wrap);

        //create and add div that contains the player name and team
        const name_tag_wrap = this._createNameTagWrap(element_update_fns);
        item.appendChild(name_tag_wrap);

        //create and add wrap for player status with ready state
        const player_status_wrap = this._createPlayerStatusWrap(element_update_fns);
        item.appendChild(player_status_wrap);

        return item;
    }

    /*---------------------------------------------------------------------*/

    _createWinTrackerWrap(element_update_fns) {
        const win_tracker_wrap = document.createElement('div');
        win_tracker_wrap.classList.add('win-tacker-wrap');

        //create trophy image to represent wins
        const trophy_img = this._createTrophyImage();
        //create div to represent number of wins
        const win_count = this._createWinCount(element_update_fns);

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

    _createWinCount(element_update_fns) {
        //create div with spans spelling win count (with "x" symbol)
        const win_count_div = document.createElement('div');
        win_count_div.classList.add('win-count-wrap');
        const x_span = document.createElement('span');
        x_span.innerHTML = 'x';
        const win_span = document.createElement('span');
        win_count_div.appendChild(x_span);
        win_count_div.appendChild(win_span);

        //extend update functions
        element_update_fns.set_wins = (wins) => {
            win_span.innerHTML = wins;
        };

        return win_count_div;
    }

    /*---------------------------------------------------------------------*/

    _createNameTagWrap(element_update_fns) {
        const name_tag_wrap = document.createElement('div');
        name_tag_wrap.classList.add('name-tag-wrap');

        //create and add the actual name tag
        const name_tag = this._createNameTag(element_update_fns);
        //create leader crown to show if player is room lead
        const crown_img = this._createCrownImage();
        crown_img.style.display = 'none';
        name_tag.appendChild(crown_img);
        name_tag_wrap.appendChild(name_tag);

        //create and add team tag to show if teams are toggled
        const team_tag = this._createTeamTag(element_update_fns);
        team_tag.style.display = 'none';
        name_tag_wrap.appendChild(team_tag);

        //extend update functions
        element_update_fns.set_room_lead = (is_room_lead) => {
            crown_img.style.display = is_room_lead ? '' : 'none';
        };

        return name_tag_wrap;
    }

    /*---------------------------------------------------------------------*/

    _createNameTag(element_update_fns) {
        const name_tag = document.createElement('div');
        name_tag.classList.add('player-name-tag');
        const name_div = document.createElement('div');
        name_div.classList.add('player-name');
        name_tag.appendChild(name_div);

        //extends update functions
        element_update_fns.set_name = (name) => {
            name_div.innerHTML = name;
        };

        return name_tag;
    }

    /*---------------------------------------------------------------------*/

    _createCrownImage() {
        const crown_img = document.createElement('img');
        crown_img.src = `${Globals.image_folder_path}/${Globals.images.crown}`;
        crown_img.alt = 'room lead';
        crown_img.width = Globals.image_sizes.crown.width;
        crown_img.height = Globals.image_sizes.crown.height;
        return crown_img;
    }

    /*---------------------------------------------------------------------*/

    _createTeamTag(element_update_fns) {
        const team_tag = document.createElement('div');
        team_tag.classList.add('player-team-tag');

        //create div containing the team name
        const team_name_div = document.createElement('div');
        team_name_div.classList.add('player-team-name');
        team_tag.appendChild(team_name_div);

        //if client can set team for this player, create form to change it
        const team_change_form = this._createTeamChangeForm(element_update_fns);
        team_change_form.style.display = 'none';
        team_tag.appendChild(team_change_form);

        //extend update functions
        element_update_fns.set_team_str = (team_str) => {
            team_name_div.innerHTML = team_str;
        };
        element_update_fns.switch_team_visibility = (teams_enabled) => {
            team_tag.style.display = teams_enabled ? '' : 'none';
        };

        return team_tag;
    }

    /*---------------------------------------------------------------------*/

    _createTeamChangeForm(element_update_fns) {
        const form = document.createElement('form');
        form.classList.add('team-set');
        form.autocomplete = 'off';
        //create input element, set value according to team or remembered value
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'team-set-text';
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
            }
        });
        //create label in relation to input's name tag
        const label = document.createElement('label');
        label.setAttribute('for', 'team-set-text');
        //finish the form: append children
        form.appendChild(label);
        form.appendChild(input);

        //extend update functions
        element_update_fns.enable_team_input = (should_enable) => {
            form.style.display = should_enable ? '' : 'none';
        };
        element_update_fns.set_team_input = (team_id) => {
            input.value = team_id;
        };

        return form;
    }

    /*---------------------------------------------------------------------*/

    _createPlayerStatusWrap(element_update_fns) {
        const player_status_wrap = document.createElement('div');
        player_status_wrap.classList.add('player-status-wrap');
        //add ready/not ready image to wrap
        const rdy_img = this._createReadyStatusImage(element_update_fns);
        player_status_wrap.appendChild(rdy_img);
        return player_status_wrap;
    }

    /*---------------------------------------------------------------------*/

    _createReadyStatusImage(element_update_fns) {
        const rdy_img = document.createElement('img');
        const set_ready = (ready) => {
            const image_name = ready ? Globals.images.tick : Globals.images.cross;
            const path = `${Globals.image_folder_path}/${image_name}`;
            const alt = ready ? 'ready' : 'not ready';
            rdy_img.src = path;
            rdy_img.alt = alt;
        };
        set_ready(false);
        rdy_img.classList.add('player-list-img');
        rdy_img.width = Globals.player_list_div_height;

        //extend update functions
        element_update_fns.switch_ready_state = set_ready;

        return rdy_img;
    }

    /*---------------------------------------------------------------------*/

    _addCurrentPlayerStateToItem(item) {
        item.classList.add('current-player');
    }

    /*---------------------------------------------------------------------*/

    _removeCurrentPlayerStateFromItem(item) {
        item.classList.remove('current-player');
    }

    /*---------------------------------------------------------------------*/

    _addDefeatedStateToItem(item) {
        item.classList.add('defeated');
    }

    /*---------------------------------------------------------------------*/

    _removeDefeatedStateFromItem(item) {
        item.classList.remove('defeated');
    }

    /*---------------------------------------------------------------------*/

    _processCreatedPlayerList() {
        const remaining_space_item = document.querySelector('#remaining-space');
        //hide unnecessary border if no remaining space remains
        const react_to_size = () => {
            if (remaining_space_item.clientHeight === 0) {
                remaining_space_item.style.border = '0';
            } else {
                remaining_space_item.style.border = '';
            }
        };
        //it seems the DOM only gets correct heights after function call, "wait" for that
        setTimeout(() => {
            react_to_size();
        }, 1);
        window.addEventListener('resize', react_to_size);
    }

    /*---------------------------------------------------------------------*/
    /* UPDATING OF INDIVIDUAL ELEMENTS */
    /*---------------------------------------------------------------------*/

    _updatePlayerListSlotEmpty(i) {
        const element_update_fns = this._element_update_fns[i];
        element_update_fns.switch_to_empty();
    }

    /*---------------------------------------------------------------------*/

    _updatePlayerListSlotFilled(i, user_info, game_info, player_info) {
        //preprocessing steps
        this._adaptPlayerInfo(user_info, player_info);
        const element_update_fns = this._element_update_fns[i];

        //directly transfer received object properties to element states
        element_update_fns.set_name(player_info.name);
        element_update_fns.set_wins(player_info.wins);
        element_update_fns.switch_ready_state(player_info.ready);
        element_update_fns.set_room_lead(player_info.is_room_lead);
        //setting of css classes
        element_update_fns.set_current_player(player_info.is_current_player);
        element_update_fns.set_alive(player_info.alive);

        //decide further element states based on given information
        element_update_fns.switch_team_visibility(game_info.teams_enabled);
        let enable_team_input = false;
        let team_str = 'Team';
        if (!game_info.game_in_progress && user_info.id === player_info.id) {
            enable_team_input = true;
        } else {
            team_str += ` ${player_info.team}`;
        }
        element_update_fns.set_team_str(team_str);
        if (this._must_set_team_input[i]) {
            element_update_fns.set_team_input(player_info.team);
            this._must_set_team_input[i] = false;
        }
        element_update_fns.enable_team_input(enable_team_input);

        //show filled element with updated content
        element_update_fns.switch_to_filled();
    }

    /*---------------------------------------------------------------------*/

    _adaptPlayerInfo(user_info, player_info) {
        //add personal brackets to name if user himself is represented
        if (user_info.id === player_info.id) {
            player_info.name += ' (You)';
        }
    }
}
