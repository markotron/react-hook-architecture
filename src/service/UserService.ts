import {User, UserId} from "../model/Model";
import Axios from "axios-observable";
import {map, share, tap} from "rxjs/operators";
import {Observable, of} from "rxjs";
import {unsupported} from "../Common";
import LRU from "lru-cache";

interface UserService {
    getUserWithId: (id: UserId) => Observable<User>
}

interface ValueAndRequest<Value> {
    value?: Value
    request: Observable<Value>
}

class UserServiceImpl implements UserService {

    private static readonly baseUrl = "http://localhost:5000/";
    private static readonly cacheOptions = {
        max: 100,
        maxAge: 1000 * 60 * 60
    };

    private readonly userCache = new LRU<UserId, ValueAndRequest<User>>(UserServiceImpl.cacheOptions);

    getUserWithId(id: UserId): Observable<User> {

        const valueAndRequest = this.userCache.get(id);
        if(valueAndRequest && valueAndRequest.value) return of(valueAndRequest.value);
        if(valueAndRequest) return valueAndRequest.request;

        const path = `users/?userId=${id}`;
        const userRequest = Axios
            .get(UserServiceImpl.baseUrl + path)
            .pipe(
                map(response => response.data),
                tap(user => this.cacheUser(id, user)),
                share(),
            );
        this.userCache.set(id, {
           request: userRequest
        });
        return userRequest;
    }

    private cacheUser(id: UserId, user: User) {
        const valueAndRequest = this.userCache.get(id);
        if(!valueAndRequest) unsupported("There must be a request cached at this point!");
        if(valueAndRequest.value) unsupported("Value must be undefined at this point!");
        valueAndRequest.value = user;
    }
}

export default new UserServiceImpl();
