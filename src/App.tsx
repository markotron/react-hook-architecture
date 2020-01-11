import React, {Reducer, useContext, useReducer, useState} from 'react';
import './App.css';
import {Chat} from "./chat/Chat";
import {StarredMessages} from "./starred-messages/StarredMessages";
import {Grid} from "@material-ui/core";

function randUser() {
    return Math.round(Math.random() * 2);
}

function App() {
    const user = randUser();
    return (
        <div>
            <Grid container spacing={3}>
                <Grid item xs={6}>
                    <Chat me={user}/>
                </Grid>
                <Grid item xs={6}>
                    <StarredMessages me={user}/>
                </Grid>
            </Grid>
        </div>
    )
}

export default App;
