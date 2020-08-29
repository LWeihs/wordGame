const Globals = {
    ports: {
        static_server: 8080,
        game_server: 8081,
    },
    rnd_name_lists: {
        path: 'resources/json',
        player: 'animals.json',
        room: 'countries.json',
    },
    game: {
        max_players: 10,
        no_remembered_words: 6,
        turn_time: 8, //in seconds
        language: 'en',
        max_len_start_word: 10,
    },

    game_text: {
        filler: '', //should not be shown, but used for error cases
        idle_only_one_player: 'Waiting for at least one more player to join...',
        idle_only_one_team: '"Team" mode requires at least 2 different teams to start!',
        idle_awaiting_ready: 'Waiting for all players to press "Ready"...',
        idle_awaiting_start_prefix: 'Waiting for ',
        idle_awaiting_start_suffix: ' to start the game...',
        win_suffix: ' wins!', //winner to be added as prefix
    },
    error_messages: {
        missing_room_name: 'Please enter a room name!',
        room_exists: 'Room with that name already exists!',
        room_does_not_exist: 'No room exists with that name!',
        full_room: 'Cannot join room: Room is full! Retrying...',
        active_room: 'Cannot join room: Game is already in progress! Retrying...',
        invalid_word: 'Not a word!',
        duplicate_word: 'Word already used before!',
        invalid_word_start: 'Word starts with wrong letter!',
    },
};

module.exports = Globals;