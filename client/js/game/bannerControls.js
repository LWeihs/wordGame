export default class BannerControls {
    init() {
        this._room_name = document.querySelector('#banner-header .main');
    }

    /*---------------------------------------------------------------------*/

    setRoomName(room_name) {
        this._room_name.innerHTML = `* * * ${room_name} * * *`;
    }
}