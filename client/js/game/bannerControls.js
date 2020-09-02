export default class BannerControls {
    init() {
        this._room_name = document.querySelector('#banner-header .main');
        this._private_notice = document.querySelector('#banner-header .private-notice');
    }

    /*---------------------------------------------------------------------*/

    setRoomName(room_name) {
        this._room_name.innerHTML = `* * * ${room_name} * * *`;
    }

    /*---------------------------------------------------------------------*/

    setPrivateNoticeVisibility(is_visible) {
        this._private_notice.style.display = is_visible ? '' : 'none';
    }
}