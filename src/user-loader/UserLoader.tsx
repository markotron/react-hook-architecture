import React, {Dispatch, Reducer, useReducer} from "react";
import {User, UserId} from "../model/Model";
import {assertNever, useFeedbackSet} from "../Common";
import userService from "../service/UserService";
import Container from "@material-ui/core/Container";
import {IconButton, LinearProgress, TableContainer} from "@material-ui/core";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import TableBody from "@material-ui/core/TableBody";
import {catchError, map, switchMap, tap} from "rxjs/operators";
import {of, timer} from "rxjs";
import {Alert} from "@material-ui/lab";
import {Autorenew} from "@material-ui/icons";

export const UserLoader: React.FC = () => {
    const [state, dispatch] = useReducer(reducer, initialState);
    useFeedbacks(state, dispatch);
    const responseRow = (request: Request<UserId, User>) => {
        return (
            <TableRow>
                <TableCell component="th" scope="row">
                    {request.payload}
                </TableCell>
                <TableCell component="th" scope="row">
                    {
                        request.kind === 'inflight'
                            ? <LinearProgress/>
                            : request.kind === 'success'
                            ? request.response.name
                            : <Alert onClose={() => dispatch(new Retry(request.payload))}
                                     severity="error">{request.message}</Alert>
                    }
                </TableCell>
            </TableRow>
        )
    };
    return (
        <Container fixed maxWidth="sm">
            <IconButton onClick={_ => dispatch(new Refresh())}>
                <Autorenew/>
            </IconButton>
            <TableContainer component={Paper}>
                <Table aria-label="simple table">
                    <TableHead>
                        <TableRow>
                            <TableCell>User Id</TableCell>
                            <TableCell>User name</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {state.users.map(r => responseRow(r))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Container>
    );
};

// @formatter:off
const randomUserIds = () => Array.from({length: 10}, () => Math.floor(Math.random() * 20));
const randomUserRequests = () => randomUserIds().map(id => ({kind: 'inflight', payload: id} as Inflight<UserId>));

// This should be generalized. It's useful for all type of requests.
interface Inflight<P> { readonly kind: 'inflight', readonly payload: P }
interface Failure<P> { readonly kind: 'failure', readonly payload: P, readonly message: string }
interface Success<P, R> { readonly kind: 'success', readonly payload: P, readonly response: R }
type Request<P, R> = Inflight<P> | Success<P, R> | Failure<P>

interface State { users: Array<Request<UserId, User>> }
const initialState: State = {
    users: randomUserRequests()
};

class RequestSucceeded {
    kind = 'success' as const;
    constructor(readonly user: User, readonly payload: UserId) { }
}
class RequestFailed {
    kind = 'failure' as const;
    constructor(readonly message: string, readonly payload: UserId) { }
}
class Retry {
    kind = 'retry' as const;
    constructor(readonly payload: UserId) {}
}
class Refresh { kind = 'refresh' as const; }
// @formatter:on

type Action = RequestSucceeded | RequestFailed | Retry | Refresh

const reducer: Reducer<State, Action> = (state, action) => {

    const setResponse = (value: Request<UserId, User>) => action.kind === 'refresh'
        ? state
        : {users: state.users.map(r => r.payload === action.payload ? value : r)};

    switch (action.kind) {
        case "refresh":
            return {users: randomUserRequests()};
        case "retry":
            return setResponse({kind: "inflight", payload: action.payload});
        case "success":
            return setResponse({kind: "success", payload: action.payload, response: action.user});
        case "failure":
            return setResponse({kind: "failure", payload: action.payload, message: action.message});
        default:
            assertNever(action);
    }
};

const useFeedbacks = (state: State, dispatch: Dispatch<Action>) => {
    useFeedbackSet(
        state,
        s => new Set(s.users.filter(u => u.kind === "inflight").map(u => u.payload)),
        payload => {
            const subscription = timer(Math.random() * 10000)
                .pipe(
                    switchMap(_ => userService
                        .getUserWithId(payload)
                        .pipe(
                            map(user => new RequestSucceeded(user, payload)),
                            catchError(err => of(new RequestFailed(err.response.data.error, payload)))
                        )
                    )
                )
                .subscribe(action => dispatch(action));
            return () => subscription.unsubscribe();
        }
    )
};

