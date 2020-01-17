import React, {Dispatch, Reducer, useReducer} from "react";
import {User} from "../model/Model";
import {feedbackFactory, noop, unsupported} from "../Common";
import userService from "../service/UserService";
import Container from "@material-ui/core/Container";
import {TableContainer} from "@material-ui/core";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import TableBody from "@material-ui/core/TableBody";

const randomUserIds = Array.from({length: 30}, () => Math.floor(Math.random() * 5));

interface State {
    users: Array<User>
}

const initialState: State = {
    users: randomUserIds.map(id => ({id, name: "-"}))
};

export const UserLoader: React.FC = () => {
    const [state, dispatch] = useReducer(reducer, initialState);
    useFeedbacks(state, dispatch);
    return (
        <Container fixed maxWidth="sm">
            <TableContainer component={Paper}>
                <Table aria-label="simple table">
                    <TableHead>
                        <TableRow>
                            <TableCell>User Id</TableCell>
                            <TableCell>User name</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {state.users.map(u => (
                            <TableRow>
                                <TableCell component="th" scope="row">
                                    {u.id}
                                </TableCell>
                                <TableCell component="th" scope="row">
                                    {u.name}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Container>
    );
};


type Action = { user: User }

const reducer: Reducer<State, Action> = (state, action) => {
    const index = state.users.findIndex(u => u.id === action.user.id && u.name ==="-");
    if (index === -1) unsupported("The user must be in the array!");
    state.users[index] = action.user;
    return {users: state.users};
};

const useFeedbacks = (state: State, dispatch: Dispatch<Action>) => {
    const useFeedback = feedbackFactory(state);
    useFeedback(
        s => s.users.map(u => u.id),
        ids => {
            ids.forEach(id => {
                setTimeout(_ => {
                    userService
                        .getUserWithId(id)
                        .subscribe(user => dispatch({user}))
                }, Math.random() * 10000);
            });
            return noop;
        }
    )
};
