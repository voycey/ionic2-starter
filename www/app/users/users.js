import {IonicApp, IonicView, NavController, NavParams} from 'ionic/ionic';

@IonicView({
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