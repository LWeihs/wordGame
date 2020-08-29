import Globals from "../globals";
import {setInputIntegerFilter} from "../helpers/inputFilter";

/**
 * Player info is provided by the server via socket update. This is translated into
 * list elements displayed in player list.
 */
export default class PlayerListControls {
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
