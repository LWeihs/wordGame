const Globals = {
    player_name_max_len: 8, //in characters
    room_name_max_len: 8, //in characters
    player_list_div_height: 65, //in px
    connect_try_interval: 2000, //in ms
    game_error_persistance: 2000, //in ms
    active_typer_persistance: 5000, //in ms
    winner_msg_persistance: 5000, //in ms
    image_folder_path: 'images',
    images: {
        tick: 'tick.png',
        cross: 'cross.png',
        trophy: 'trophy.png',
        crown: 'crown.png',
    },
    image_sizes: {
        crown: {
            width: 40,
            height: 20,
        },
    },
    highlight_colors: {
        0: '#ff0000',
        1: '#ff7f00',
        2: '#ffff00',
        3: '#00ff00',
        4: '#0000ff',
        5: '#4b0082',
        default: '#9400d3',
    },
};

export default Globals;