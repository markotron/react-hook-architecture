import React, {useReducer} from "react";
import {UserId} from "../model/Model";
import {initialState, LoadOlderMessages, reducerWithProps, useFeedbacks} from "./StateMachine";
import {TableContainer} from "@material-ui/core";
import Table from "@material-ui/core/Table";
import Paper from "@material-ui/core/Paper";
import TableBody from "@material-ui/core/TableBody";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import makeStyles from "@material-ui/core/styles/makeStyles";
import Container from "@material-ui/core/Container";
import TableHead from "@material-ui/core/TableHead";
import IconButton from "@material-ui/core/IconButton";
import {Autorenew} from "@material-ui/icons";

const useStyles = makeStyles({
    table: {
        minWidth: 650,
    },
});
export const StarredMessages: React.FC<{ me: UserId }> = ({me}) => {

    const [state, dispatch] = useReducer(reducerWithProps, initialState);
    useFeedbacks(me, state, dispatch);

    const classes = useStyles();
    return (
        <Container fixed maxWidth="md">
            <h1>Favorites</h1>
            <div>
                <IconButton onClick = {_ => dispatch(new LoadOlderMessages())}>
                    <Autorenew />
                </IconButton>
            </div>
            <TableContainer component={Paper}>
                <Table className={classes.table} aria-label="simple table">
                    <TableHead>
                        <TableRow>
                            <TableCell>Text</TableCell>
                            <TableCell align="right">Message ID</TableCell>
                            <TableCell align="right">User ID</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {state.messages.map(m => (
                            <TableRow key={m.id}>
                                <TableCell component="th" scope="row">
                                    {m.message}
                                </TableCell>
                                <TableCell align="right">{m.id}</TableCell>
                                <TableCell align="right">{m.userId}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Container>
    );
};
