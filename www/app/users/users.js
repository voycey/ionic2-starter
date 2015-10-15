import {IonicApp, Page, NavController, NavParams} from 'ionic/ionic';

@Page({
    templateUrl: 'app/users/users.html'
})

export class UsersPage {
    public userlist = {};

    constructor(app: IonicApp, nav: NavController) {
        this.nav = nav;

        fetch('http://api.702010forum.dev/users.json')
            .then((response) => {
                return response.json()
            }).then((json) => {
                this.userlist = json;
            });
    }
}

@Page({
    templateUrl: 'app/users/user-view.html'
})
export class UserViewPage {
    public user = {};

    constructor(app: IonicApp, nav: NavController) {
        this.nav = nav;

        fetch('http://api.702010forum.dev/users/1.json')
            .then((response) => {
                return response.json()
            }).then((json) => {
                this.user = json.data;
            });
    }
}