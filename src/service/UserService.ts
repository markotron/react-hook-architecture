import {User, UserId} from "../model/Model";
import Axios from "axios-observable";
import {map, publishReplay, refCount, retry, share} from "rxjs/operators";
import {Observable} from "rxjs";
import {unsupported} from "../Common";

interface UserService {
    getUserWithId: (id: UserId) => Observable<User>
}

class UserServiceImpl implements UserService {

    private readonly baseUrl = "http://localhost:5000/";
    private readonly userRequests: Map<UserId, Observable<User>> = new Map();

    getUserWithId(id: UserId): Observable<User> {

        if(this.userRequests.has(id))
            return this.userRequests.get(id) ?? unsupported("Can't happen!");

        const path = `users/?userId=${id}`;
        const userRequest = Axios
            .get(this.baseUrl + path)
            .pipe(
                map(response => response.data),
                publishReplay(1),
                refCount()
            );
        this.userRequests.set(id, userRequest);
        return userRequest;
    }
}

export default new UserServiceImpl();
